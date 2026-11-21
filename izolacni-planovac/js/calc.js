/*
 * VÝPOČETNÍ JÁDRO – čisté funkce bez vazby na UI (testovatelné v Node.js).
 * Součinitel prostupu tepla U se počítá dle principu ČSN EN ISO 6946
 * (u nehomogenních vrstev s dřevěnými prvky jako průměr horní a dolní meze).
 * Výsledky jsou orientační a nenahrazují projektovou dokumentaci.
 */
(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./catalog.js') : root.Catalog;

  const LAMBDA_WOOD = 0.13;
  const R_AIR_GAP = 0.15;
  const R_SDK = 0.0125 / 0.22;
  const ROOF_WINDOW_M2 = 0.78 * 1.18;
  const DOOR_M2 = 0.8 * 1.97;
  const EXTRA_GRID_FRACTION = 0.08;

  const num = (v, d = 0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : d; };
  const round = (v, p = 2) => Math.round(v * 10 ** p) / 10 ** p;

  /* ---------- kombinace tlouštěk ---------- */
  function combos(thicknesses, maxLayers) {
    const out = [];
    const rec = (start, picked, sum) => {
      if (picked.length) out.push({ parts: picked.slice(), total: sum });
      if (picked.length === maxLayers) return;
      for (let i = start; i < thicknesses.length; i++) {
        picked.push(thicknesses[i]);
        rec(i, picked, sum + thicknesses[i]);
        picked.pop();
      }
    };
    rec(0, [], 0);
    return out.map((c) => ({ ...c, parts: c.parts.sort((a, b) => b - a) }));
  }

  /** Největší skladba ≤ max (vyplnění dutiny), při shodě méně vrstev. */
  function bestFill(thicknesses, max, maxLayers = 2) {
    let best = null;
    for (const c of combos(thicknesses, maxLayers)) {
      if (c.total > max) continue;
      if (!best || c.total > best.total || (c.total === best.total && c.parts.length < best.parts.length)) best = c;
    }
    return best;
  }

  /** Nejmenší skladba ≥ need, při shodě méně vrstev. */
  function bestCover(thicknesses, need, maxLayers = 2) {
    let best = null;
    for (const c of combos(thicknesses, maxLayers)) {
      if (c.total < need) continue;
      if (!best || c.total < best.total || (c.total === best.total && c.parts.length < best.parts.length)) best = c;
    }
    return best;
  }

  /* ---------- U-hodnoty ---------- */
  /**
   * Konstrukce s nosnými prvky (krokve, sloupky, trámy).
   * cavity: {depth, fill, lambda, f}, extra: {t, lambda, f} | null
   */
  function uFramed({ rsi, rse, rOther, cavity, extra }) {
    const rIns1 = cavity.fill / 1000 / cavity.lambda + (cavity.depth - cavity.fill >= 5 ? R_AIR_GAP : 0);
    const rWood1 = cavity.depth / 1000 / LAMBDA_WOOD;
    const L1 = [{ f: 1 - cavity.f, R: rIns1 }, { f: cavity.f, R: rWood1 }];
    const L2 = extra && extra.t > 0
      ? [{ f: 1 - extra.f, R: extra.t / 1000 / extra.lambda }, { f: extra.f, R: extra.t / 1000 / LAMBDA_WOOD }]
      : [{ f: 1, R: 0 }];
    const base = rsi + rse + rOther;
    let invUpper = 0;
    for (const a of L1) for (const b of L2) invUpper += (a.f * b.f) / (base + a.R + b.R);
    const rUpper = 1 / invUpper;
    const eq = (L) => { const s = L.reduce((acc, p) => acc + (p.R > 0 ? p.f / p.R : 0), 0); return s > 0 ? 1 / s : 0; };
    const rLower = base + eq(L1) + eq(L2);
    return 2 / (rUpper + rLower);
  }

  function uHomogeneous({ rsi, rse, rOther, layers }) {
    const r = rsi + rse + rOther + layers.reduce((s, l) => s + l.t / 1000 / l.lambda, 0);
    return 1 / r;
  }

  /* ---------- geometrie ---------- */
  function geometry(item) {
    const t = item.type;
    if (item.mode === 'plocha') {
      const a = Math.max(0, num(item.area));
      return { area: a, perimeter: 4 * Math.sqrt(a), windows: num(item.windows) };
    }
    switch (t) {
      case 'sikma': {
        const sides = Math.max(1, Math.round(num(item.sides, 2)));
        const w = Math.max(0, Math.round(num(item.windows)));
        const plane = num(item.rafterLen) * num(item.roofLen);
        return { area: Math.max(0, plane * sides - w * ROOF_WINDOW_M2), perimeter: sides * 2 * (num(item.rafterLen) + num(item.roofLen)), windows: w };
      }
      case 'strop':
        return { area: num(item.len) * num(item.wid), perimeter: 2 * (num(item.len) + num(item.wid)), windows: 0 };
      case 'etics':
      case 'venti':
        return { area: Math.max(0, num(item.perimeter) * num(item.height) - num(item.openings)), perimeter: 0, windows: 0 };
      case 'drevostavba':
        return { area: Math.max(0, num(item.len) * num(item.height) - num(item.openings)), perimeter: 2 * (num(item.len) + num(item.height)), windows: 0 };
      case 'pricka':
        return { area: Math.max(0, num(item.len) * num(item.height) - Math.round(num(item.doors)) * DOOR_M2), perimeter: 0, windows: 0 };
      default:
        return { area: 0, perimeter: 0, windows: 0 };
    }
  }

  /* ---------- doporučení dle typu ---------- */
  function framedSetup(item) {
    if (item.type === 'sikma') {
      return { rsi: 0.10, rse: 0.10, rOther: R_SDK, cavityName: 'Mezi krokve', extraName: 'Pod krokve (na rošt)', frame: 'krokve' };
    }
    if (item.type === 'drevostavba') {
      return { rsi: 0.13, rse: 0.04, rOther: R_SDK + 0.015 / 0.13 + 0.10, cavityName: 'Mezi sloupky', extraName: 'Instalační předstěna', frame: 'sloupky' };
    }
    // strop – pochozí (trámy)
    const ex = C.EXISTING_CEILINGS[item.ceiling] || C.EXISTING_CEILINGS.tramovy;
    return { rsi: 0.10, rse: 0.10, rOther: Math.min(ex.R, 0.25) + 0.025 / 0.15, cavityName: 'Mezi trámy', extraName: 'Doplňková vrstva', frame: 'trámy' };
  }

  function recommendFramed(item, target, prio) {
    const s = framedSetup(item);
    const depth = num(item.frameDepth, 160);
    const width = num(item.frameWidth, 80);
    const spacing = Math.max(width + 1, num(item.frameSpacing, 900));
    const f = width / spacing;
    const maxExtra = Math.max(0, num(item.maxExtra, 100));
    const order = C.PRIORITIES[prio].cavity;

    const evaluate = (pid) => {
      const p = C.PRODUCTS[pid];
      const fill = bestFill(p.thicknesses, depth, 2);
      if (!fill) return null;
      const cavity = { depth, fill: fill.total, lambda: p.lambda, f };
      const calc = (t) => uFramed({ ...s, cavity, extra: t ? { t, lambda: p.lambda, f: EXTRA_GRID_FRACTION } : null });
      const u0 = calc(0);
      if (target == null || u0 <= target) return { pid, fill, extra: 0, U: u0, ok: true };
      for (const t of p.thicknesses) {
        if (t > maxExtra) break;
        const u = calc(t);
        if (u <= target) return { pid, fill, extra: t, U: u, ok: true };
      }
      const allowed = p.thicknesses.filter((t) => t <= maxExtra);
      const tMax = allowed.length ? allowed[allowed.length - 1] : 0;
      return { pid, fill, extra: tMax, U: calc(tMax), ok: false };
    };

    let chosen = null; let bestFail = null;
    for (const pid of order) {
      const r = evaluate(pid);
      if (!r) continue;
      if (r.ok) { chosen = r; break; }
      if (!bestFail || r.U < bestFail.U) bestFail = r;
    }
    const r = chosen || bestFail;
    const res = { U: r.U, ok: r.ok, layers: [], qtyLayers: [], notes: [], warnings: [] };
    const p = C.PRODUCTS[r.pid];
    res.layers.push({ name: s.cavityName, product: r.pid, parts: r.fill.parts, total: r.fill.total, f });
    r.fill.parts.forEach((t) => res.qtyLayers.push({ product: r.pid, t, factor: 1 - f }));
    if (r.extra) {
      res.layers.push({ name: s.extraName, product: r.pid, parts: [r.extra], total: r.extra, f: EXTRA_GRID_FRACTION });
      res.qtyLayers.push({ product: r.pid, t: r.extra, factor: 1 - EXTRA_GRID_FRACTION });
    }
    if (depth - r.fill.total >= 5) {
      res.notes.push(`Výška ${s.frame} je ${depth} mm, izolace ${r.fill.total} mm – zbývající ${depth - r.fill.total} mm ponechte jako vzduchovou mezeru pod pojistnou hydroizolací (nebo ověřte, zda ji nevyžaduje skladba střechy).`);
    }
    if (r.fill.parts.length > 1) res.notes.push(`Dutinu vyplňte dvěma vrstvami (${r.fill.parts.join(' + ')} mm) s vystřídanými spárami.`);
    res.notes.push(`Izolaci řežte o 10–20 mm širší, než je světlá vzdálenost mezi ${s.frame}, aby dokonale přilnula bez mezer.`);
    if (!r.ok) {
      res.warnings.push(`Cílové hodnoty U ≤ ${target.toFixed(2)} nelze s výškou ${s.frame} ${depth} mm a max. ${maxExtra} mm doplňkové vrstvy dosáhnout. Zvažte silnější doplňkovou vrstvu nebo nadkrokevní izolaci – rádi vám poradíme.`);
    }
    res.needsVaporBarrier = true;
    res.u = { target };
    return res;
  }

  function recommendLoose(item, target, prio) {
    const ex = C.EXISTING_CEILINGS[item.ceiling] || C.EXISTING_CEILINGS.beton;
    const rsi = 0.10; const rse = 0.10;
    for (const pid of C.PRIORITIES[prio].loose) {
      const p = C.PRODUCTS[pid];
      const needR = 1 / target - rsi - rse - ex.R;
      const need = Math.max(0, needR * p.lambda * 1000);
      const cover = bestCover(p.thicknesses, need, 2) || bestCover(p.thicknesses, need, 3);
      if (!cover) continue;
      let parts = cover.parts;
      // nad 160 mm vždy ve dvou křížených vrstvách (omezení tepelných mostů ve spárách)
      if (parts.length === 1 && parts[0] > 160) {
        const two = combos(p.thicknesses, 2).filter((c) => c.parts.length === 2 && c.total >= need)
          .sort((a, b) => a.total - b.total || Math.abs(a.parts[0] - a.parts[1]) - Math.abs(b.parts[0] - b.parts[1]))[0];
        if (two && two.total <= cover.total + 20) parts = two.parts;
      }
      const total = parts.reduce((a, b) => a + b, 0);
      const U = uHomogeneous({ rsi, rse, rOther: ex.R, layers: [{ t: total, lambda: p.lambda }] });
      const res = { U, ok: true, layers: [], qtyLayers: [], notes: [], warnings: [] };
      res.layers.push({ name: parts.length > 1 ? 'Na strop – ve vrstvách křížem' : 'Na strop', product: pid, parts, total, f: 0 });
      parts.forEach((t) => res.qtyLayers.push({ product: pid, t, factor: 1 }));
      if (parts.length > 1) res.notes.push('Druhou vrstvu pokládejte kolmo na první, aby se spáry nepřekrývaly.');
      res.notes.push('Izolaci nezatěžujte – pro skladování na půdě vytvořte pochozí lávku nad úrovní izolace.');
      if (ex.wooden) {
        res.notes.push('Na dřevěný strop nejprve položte parotěsnou fólii se slepenými spoji.');
        res.needsVaporBarrier = true;
      }
      return res;
    }
    return null;
  }

  function recommendMasonry(item, target) {
    const isVenti = item.type === 'venti';
    const pid = isVenti ? 'naturboardventi' : 'fkdsthermal';
    const p = C.PRODUCTS[pid];
    const wall = C.EXISTING_WALLS[item.wall] || C.EXISTING_WALLS.cp450;
    const rsi = 0.13; const rse = isVenti ? 0.13 : 0.04;
    const dU = isVenti ? 0.03 : 0.01;
    const rOther = wall.R + 0.03;
    const uBase = uHomogeneous({ rsi, rse, rOther, layers: [] });
    const need = Math.max(0, (1 / (target - dU) - rsi - rse - rOther) * p.lambda * 1000);
    let cover = bestCover(p.thicknesses, need, isVenti ? 2 : 1);
    let ok = true;
    if (!cover) { cover = { parts: [p.thicknesses[p.thicknesses.length - 1]], total: p.thicknesses[p.thicknesses.length - 1] }; ok = false; }
    const U = uHomogeneous({ rsi, rse, rOther, layers: [{ t: cover.total, lambda: p.lambda }] }) + dU;
    const res = { U, uBase, ok, layers: [], qtyLayers: [], notes: [], warnings: [] };
    res.layers.push({ name: isVenti ? 'Mezi nosný rošt fasády' : 'Lepeno a kotveno na fasádu', product: pid, parts: cover.parts, total: cover.total, f: 0 });
    cover.parts.forEach((t) => res.qtyLayers.push({ product: pid, t, factor: 1 }));
    res.notes.push(`Stávající stěna má orientačně U ≈ ${uBase.toFixed(2)} W/(m²K); po zateplení U ≈ ${U.toFixed(2)} W/(m²K).`);
    if (isVenti) {
      res.notes.push('Výpočet zahrnuje přirážku na tepelné mosty kotevních konzol (ΔU = 0,03).');
      res.notes.push('Mezi izolací a obkladem ponechte provětrávanou mezeru min. 40 mm.');
    } else {
      res.notes.push('Ostatní složky systému ETICS (lepidlo, hmoždinky – orientačně 6–8 ks/m², výztužná síťovina, omítka) volte v rámci jednoho certifikovaného systému.');
      res.notes.push('Minerální vata je nehořlavá (A1) a paropropustná – vhodná i pro výškové budovy a požární pásy.');
    }
    if (!ok) res.warnings.push('Cílové hodnoty nelze dosáhnout jednou vrstvou maximální tloušťky – kontaktujte technickou podporu.');
    return res;
  }

  function recommendAcoustic(item) {
    const pid = 'akustikboard';
    const p = C.PRODUCTS[pid];
    const profile = num(item.profile, 75);
    const fill = bestFill(p.thicknesses, profile, 1) || { parts: [p.thicknesses[0]], total: p.thicknesses[0] };
    const res = { U: null, ok: true, layers: [], qtyLayers: [], notes: [], warnings: [] };
    res.layers.push({ name: `Do profilů CW ${profile}`, product: pid, parts: fill.parts, total: fill.total, f: 0 });
    res.qtyLayers.push({ product: pid, t: fill.total, factor: 1 });
    res.notes.push('Pro nejlepší zvukovou izolaci vyplňte celou dutinu příčky a použijte dvojité opláštění sádrokartonem.');
    res.notes.push('Obvodové profily podlepte pružnou těsnicí páskou – omezíte přenos zvuku konstrukcí.');
    return res;
  }

  /* ---------- hlavní funkce ---------- */
  function recommend(item, ctx) {
    const type = C.TYPES[item.type];
    if (!type) return null;
    const geo = geometry(item);
    const levelKey = ctx.level || 'doporucena';
    const prio = ctx.priority || 'vyvazeny';
    const target = type.target ? C.U_TARGETS[type.target][levelKey] : null;

    let res;
    if (type.engine === 'acoustic') res = recommendAcoustic(item);
    else if (type.engine === 'masonry') res = recommendMasonry(item, target);
    else if (type.engine === 'loose') res = item.walkable ? recommendFramed(item, target, prio) : recommendLoose(item, target, prio);
    else res = recommendFramed(item, target, prio);
    if (!res) return null;

    res.item = item;
    res.typeInfo = type;
    res.area = geo.area;
    res.target = target;

    const wastePct = num(ctx.waste, NaN);
    res.lines = res.qtyLayers.map((q) => {
      const p = C.PRODUCTS[q.product];
      const waste = Number.isFinite(wastePct) ? wastePct / 100 : (p.form === 'role' ? 0.05 : 0.03);
      return { product: q.product, t: q.t, m2: geo.area * q.factor * (1 + waste) };
    });

    res.acc = [];
    if (res.needsVaporBarrier && geo.area > 0) {
      const foil = geo.area * 1.15;
      const tape = geo.area / 1.4 + geo.windows * 4.5;
      res.acc.push({ id: 'lds100', need: foil });
      res.acc.push({ id: 'soliplan', need: tape });
      if (geo.perimeter > 0) res.acc.push({ id: 'solimur', need: geo.perimeter });
    }
    if (geo.area <= 0) res.warnings.push('Zadejte rozměry – plocha konstrukce je zatím nulová.');
    return res;
  }

  /** Souhrnný nákupní seznam ze všech konstrukcí. */
  function aggregate(results) {
    const map = new Map();
    for (const r of results) {
      if (!r) continue;
      for (const l of r.lines) {
        const key = `${l.product}|${l.t}`;
        const e = map.get(key) || { product: l.product, t: l.t, m2: 0 };
        e.m2 += l.m2;
        map.set(key, e);
      }
    }
    const insulation = [...map.values()].map((e) => {
      const p = C.PRODUCTS[e.product];
      const per = p.packM2[e.t] || 1;
      return { ...e, perPack: per, packs: Math.ceil(e.m2 / per - 1e-9), m3: e.m2 * e.t / 1000 };
    }).sort((a, b) => a.product.localeCompare(b.product) || b.t - a.t);

    const accMap = new Map();
    for (const r of results) {
      if (!r) continue;
      for (const a of r.acc) accMap.set(a.id, (accMap.get(a.id) || 0) + a.need);
    }
    const accessories = [...accMap.entries()].map(([id, need]) => {
      const a = C.ACCESSORIES[id];
      return { id, need, qty: Math.ceil(need / a.perUnit - 1e-9) };
    });
    const totalArea = results.reduce((s, r) => s + (r ? r.area : 0), 0);
    return { insulation, accessories, totalArea, totalPacks: insulation.reduce((s, l) => s + l.packs, 0) };
  }

  const api = { recommend, aggregate, geometry, bestFill, bestCover, uFramed, uHomogeneous, num, round };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
