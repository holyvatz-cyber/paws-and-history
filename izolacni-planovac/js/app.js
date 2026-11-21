/* UI plánovače – vanilla JS, bez závislostí. */
(function () {
  'use strict';
  const C = window.Catalog;
  const K = window.Calc;
  const STORE_KEY = 'izolacni-planovac-v1';

  /* ---------- pomocné ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 1) => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtU = (n) => fmt(n, 2);
  const uid = () => Math.random().toString(36).slice(2, 9);

  const ICONS = {
    roof: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 22 20 7l16 15"/><path d="M9 18l11-10 11 10" stroke-dasharray="2 2.5" stroke="var(--accent)"/><path d="M8 20v14h24V20"/></svg>',
    attic: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 18 20 5l16 13"/><path d="M8 18h24" /><path d="M10 15.5h20" stroke="var(--accent)" stroke-width="3"/><path d="M8 18v16h24V18"/></svg>',
    wall: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="6" width="16" height="28"/><path d="M7 13h16M7 20h16M7 27h16M15 6v7M11 13v7M19 13v7M15 20v7M11 27v7M19 27v7"/><rect x="25" y="6" width="7" height="28" stroke="var(--accent)"/></svg>',
    venti: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="6" width="13" height="28"/><rect x="20" y="6" width="7" height="28" stroke="var(--accent)"/><path d="M32 6v28M32 10h3M32 18h3M32 26h3"/></svg>',
    frame: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h28v28H6z"/><path d="M15 6v28M25 6v28"/><path d="M8 10h5M8 16h5M8 22h5M8 28h5M17 10h6M17 16h6M17 22h6M17 28h6M27 10h5M27 16h5M27 22h5M27 28h5" stroke="var(--accent)"/></svg>',
    partition: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v30M28 5v30"/><path d="M15 9c3 2 7-2 10 0M15 15c3 2 7-2 10 0M15 21c3 2 7-2 10 0M15 27c3 2 7-2 10 0" stroke="var(--accent)"/></svg>',
  };

  /* ---------- výchozí hodnoty ---------- */
  const DEFAULTS = {
    sikma: { name: 'Podkroví', mode: 'rozmery', rafterLen: '5', roofLen: '10', sides: '2', windows: '0', area: '80', frameDepth: '160', frameWidth: '80', frameSpacing: '900', maxExtra: '80' },
    strop: { name: 'Strop pod půdou', mode: 'rozmery', len: '10', wid: '8', area: '80', ceiling: 'beton', walkable: false, frameDepth: '180', frameWidth: '120', frameSpacing: '1000', maxExtra: '100' },
    etics: { name: 'Fasáda', mode: 'rozmery', perimeter: '40', height: '6', openings: '30', area: '200', wall: 'cp450' },
    venti: { name: 'Provětrávaná fasáda', mode: 'rozmery', perimeter: '40', height: '6', openings: '30', area: '200', wall: 'cp450' },
    drevostavba: { name: 'Obvodová stěna', mode: 'rozmery', len: '36', height: '2.7', openings: '22', area: '75', frameDepth: '160', frameWidth: '60', frameSpacing: '625', maxExtra: '60' },
    pricka: { name: 'Příčka', mode: 'rozmery', len: '4', height: '2.6', doors: '1', area: '10', profile: '75' },
  };

  const optionsFrom = (obj) => Object.entries(obj).map(([k, v]) => [k, v.label]);

  /* ---------- schéma formulářů ---------- */
  const FRAME = (label, labels) => [
    { sub: label },
    { k: 'frameDepth', label: labels[0], unit: 'mm' },
    { k: 'frameWidth', label: labels[1], unit: 'mm' },
    { k: 'frameSpacing', label: labels[2], unit: 'mm', hint: 'Měřeno ze středu na střed.' },
    { k: 'maxExtra', label: labels[3], unit: 'mm', hint: labels[4] },
  ];
  const FIELDS = {
    sikma: [
      { k: 'rafterLen', label: 'Délka krokve (zateplovaná část)', unit: 'm', mode: 'rozmery', hint: 'Od pozednice po hřeben, nebo po strop podkroví.' },
      { k: 'roofLen', label: 'Délka střechy', unit: 'm', mode: 'rozmery' },
      { k: 'sides', label: 'Počet střešních rovin', type: 'select', options: [['1', '1 – pultová'], ['2', '2 – sedlová'], ['4', '4 – valbová (orientačně)']], mode: 'rozmery' },
      { k: 'area', label: 'Plocha střechy k zateplení', unit: 'm²', mode: 'plocha', hint: 'Bez střešních oken.' },
      { k: 'windows', label: 'Střešní okna', unit: 'ks', hint: 'Odečteme jejich plochu a připočteme pásky.' },
      ...FRAME('Krokve', ['Výška krokve', 'Šířka krokve', 'Rozteč krokví', 'Max. izolace pod krokvemi', 'Kolik cm výšky podkroví můžete obětovat.']),
    ],
    strop: [
      { k: 'len', label: 'Délka stropu', unit: 'm', mode: 'rozmery' },
      { k: 'wid', label: 'Šířka stropu', unit: 'm', mode: 'rozmery' },
      { k: 'area', label: 'Plocha stropu', unit: 'm²', mode: 'plocha' },
      { k: 'ceiling', label: 'Stávající strop', type: 'select', options: optionsFrom(C.EXISTING_CEILINGS), wide: true },
      { k: 'walkable', label: 'Půdu chci používat jako pochozí (izolace mezi trámy, nahoře podlaha)', type: 'toggle', wide: true },
      ...FRAME('Stropní trámy', ['Výška trámu', 'Šířka trámu', 'Rozteč trámů', 'Max. doplňková vrstva', 'Např. pod trámy nebo na rošt nad nimi.']).map((f) => ({ ...f, show: (it) => it.walkable })),
    ],
    etics: [
      { k: 'perimeter', label: 'Obvod domu', unit: 'm', mode: 'rozmery' },
      { k: 'height', label: 'Výška zateplované fasády', unit: 'm', mode: 'rozmery', hint: 'Od soklu po okap; štíty připočtěte k ploše.' },
      { k: 'openings', label: 'Plocha oken a dveří', unit: 'm²', mode: 'rozmery' },
      { k: 'area', label: 'Plocha fasády bez otvorů', unit: 'm²', mode: 'plocha' },
      { k: 'wall', label: 'Stávající obvodová stěna', type: 'select', options: optionsFrom(C.EXISTING_WALLS), wide: true },
    ],
    drevostavba: [
      { k: 'len', label: 'Celková délka stěn', unit: 'm', mode: 'rozmery' },
      { k: 'height', label: 'Výška stěny', unit: 'm', mode: 'rozmery' },
      { k: 'openings', label: 'Plocha oken a dveří', unit: 'm²', mode: 'rozmery' },
      { k: 'area', label: 'Plocha stěn bez otvorů', unit: 'm²', mode: 'plocha' },
      ...FRAME('Sloupky', ['Hloubka sloupku', 'Šířka sloupku', 'Rozteč sloupků', 'Max. instalační předstěna', 'Doplňková izolace z interiéru.']),
    ],
    pricka: [
      { k: 'len', label: 'Délka příčky', unit: 'm', mode: 'rozmery' },
      { k: 'height', label: 'Výška příčky', unit: 'm', mode: 'rozmery' },
      { k: 'doors', label: 'Počet dveří', unit: 'ks', mode: 'rozmery' },
      { k: 'area', label: 'Plocha příčky', unit: 'm²', mode: 'plocha' },
      { k: 'profile', label: 'Šířka profilu CW', type: 'select', options: [['50', 'CW 50'], ['75', 'CW 75'], ['100', 'CW 100']] },
    ],
  };
  FIELDS.venti = FIELDS.etics;

  /* ---------- stav ---------- */
  const fresh = () => ({ project: { name: '', level: 'doporucena', priority: 'vyvazeny', waste: '' }, items: [], step: 1 });
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.project && Array.isArray(s.items)) return { ...fresh(), ...s, items: s.items.filter((i) => C.TYPES[i.type]) };
      }
    } catch (e) { /* úložiště nedostupné */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  const ctx = () => ({ level: state.project.level, priority: state.project.priority, waste: state.project.waste });

  /* ---------- krok 1 ---------- */
  function renderStep1() {
    $('#project-name').value = state.project.name;
    $('#waste').value = state.project.waste;
    const choice = (group, key, item, cur, tag) => `
      <label class="choice"><input type="radio" name="${group}" value="${key}" ${cur === key ? 'checked' : ''}>
        ${tag ? `<span class="tag">${tag}</span>` : ''}<strong>${esc(item.label)}</strong><small>${esc(item.sub)}</small></label>`;
    $('#level-choices').innerHTML = Object.entries(C.LEVELS).map(([k, v]) => choice('level', k, v, state.project.level, k === 'doporucena' ? 'Doporučujeme' : '')).join('');
    $('#priority-choices').innerHTML = Object.entries(C.PRIORITIES).map(([k, v]) => choice('priority', k, v, state.project.priority)).join('');
  }

  /* ---------- krok 2 ---------- */
  function renderTypeGrid() {
    $('#type-grid').innerHTML = Object.entries(C.TYPES).map(([k, t]) => `
      <button type="button" class="type-card" data-add="${k}">${ICONS[t.icon]}<strong>${esc(t.label)}</strong><small>${esc(t.short)}</small></button>`).join('');
  }

  function fieldHtml(item, f) {
    if (f.sub) return `<div class="sub-title">${esc(f.sub)}</div>`;
    const id = `f-${item.id}-${f.k}`;
    const wide = f.wide ? ' wide' : '';
    if (f.type === 'toggle') {
      return `<div class="field${wide}"><label class="toggle"><input type="checkbox" id="${id}" data-k="${f.k}" ${item[f.k] ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
    }
    if (f.type === 'select') {
      return `<div class="field${wide}"><label for="${id}">${esc(f.label)}</label><select id="${id}" data-k="${f.k}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(item[f.k]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    }
    return `<div class="field${wide}"><label for="${id}">${esc(f.label)}</label>
      <div class="input-unit"><input id="${id}" type="number" inputmode="decimal" min="0" step="any" data-k="${f.k}" value="${esc(item[f.k])}"><span>${esc(f.unit)}</span></div>
      ${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ''}</div>`;
  }

  function itemBodyHtml(item) {
    const fields = FIELDS[item.type].filter((f) => (!f.mode || f.mode === item.mode) && (!f.show || f.show(item)));
    return fields.map((f) => fieldHtml(item, f)).join('');
  }

  function renderItems() {
    const box = $('#items');
    if (!state.items.length) {
      box.innerHTML = '<div class="empty">Zatím nemáte žádnou konstrukci. Vyberte níže, co chcete zateplit.</div>';
    } else {
      box.innerHTML = state.items.map((item) => {
        const t = C.TYPES[item.type];
        return `<article class="item" data-id="${item.id}">
          <div class="item-head">${ICONS[t.icon]}
            <input class="name-input" type="text" data-k="name" value="${esc(item.name)}" aria-label="Název konstrukce" maxlength="50">
            <span class="item-type">${esc(t.label)}</span>
            <span class="item-area" data-area>${fmt(K.geometry(item).area)} m²</span>
            <button type="button" class="btn ghost icon" data-act="dup" title="Duplikovat" aria-label="Duplikovat">⧉</button>
            <button type="button" class="btn ghost icon" data-act="del" title="Odebrat" aria-label="Odebrat">✕</button>
          </div>
          <div class="item-body">
            <div class="seg" role="group" aria-label="Způsob zadání">
              <button type="button" data-act="mode" data-mode="rozmery" class="${item.mode === 'rozmery' ? 'on' : ''}">Zadat rozměry</button>
              <button type="button" data-act="mode" data-mode="plocha" class="${item.mode === 'plocha' ? 'on' : ''}">Znám plochu</button>
            </div>
            <div class="grid-fields">${itemBodyHtml(item)}</div>
          </div></article>`;
      }).join('');
    }
    $('#add-title').textContent = state.items.length ? 'Přidat další konstrukci' : 'Vyberte konstrukci';
    $('#btn-calc').disabled = !state.items.length;
  }

  function addItem(type) {
    const item = { id: uid(), type, ...structuredClone(DEFAULTS[type]) };
    const same = state.items.filter((i) => i.type === type).length;
    if (same) item.name += ` ${same + 1}`;
    state.items.push(item);
    save(); renderItems();
    const el = document.querySelector(`.item[data-id="${item.id}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.querySelector('.item-body input')?.focus({ preventScroll: true }); }
  }

  /* ---------- krok 3: vizualizace ---------- */
  function sectionSvg(res) {
    const W = 240; const H = 150;
    const wool = 'url(#wool)';
    const defs = `<defs><pattern id="wool" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="var(--wool)"/><path d="M0 5c2.5-3 5 3 7.5 0S10 5 10 5" stroke="var(--wool-line)" fill="none"/></pattern>
      <pattern id="brick" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#c97a5a"/><path d="M0 0h16M0 5h16M8 0v5M0 5v5" stroke="#a65d40" stroke-width="1"/></pattern>
      <pattern id="conc" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#a9b2ba"/><circle cx="2" cy="3" r=".9" fill="#7d8790"/><circle cx="6" cy="6" r=".7" fill="#7d8790"/></pattern></defs>`;
    const engine = res.typeInfo.engine === 'loose' && res.item.walkable ? 'framed' : res.typeInfo.engine;
    let g = '';
    if (engine === 'framed') {
      const cav = res.layers[0]; const ext = res.layers[1];
      const depth = Number(res.item.frameDepth) || cav.total;
      const total = depth + (ext ? ext.total : 0);
      const s = Math.min(0.5, 104 / total);
      const y0 = 18; const hC = depth * s; const hE = ext ? ext.total * s : 0;
      g += `<line x1="8" y1="${y0 - 4}" x2="${W - 8}" y2="${y0 - 4}" stroke="var(--brand)" stroke-width="2" stroke-dasharray="6 3"/>`;
      g += `<rect x="8" y="${y0}" width="${W - 16}" height="${hC}" fill="${wool}"/>`;
      const fill = cav.total * s;
      if (fill < hC - 1) g += `<rect x="8" y="${y0}" width="${W - 16}" height="${hC - fill}" fill="var(--card)"/>`;
      const fw = Math.max(8, (Number(res.item.frameWidth) || 80) * 0.18);
      [30, W / 2, W - 30].forEach((cx) => { g += `<rect x="${cx - fw / 2}" y="${y0}" width="${fw}" height="${hC}" fill="var(--wood)" stroke="#7a5532" stroke-width=".6"/>`; });
      if (ext) {
        g += `<rect x="8" y="${y0 + hC}" width="${W - 16}" height="${hE}" fill="${wool}" stroke="var(--wool-line)" stroke-width=".5"/>`;
        [60, W - 60].forEach((cx) => { g += `<rect x="${cx - 4}" y="${y0 + hC}" width="8" height="${hE}" fill="var(--wood)" opacity=".8"/>`; });
      }
      const yb = y0 + hC + hE;
      g += `<rect x="8" y="${yb}" width="${W - 16}" height="4" fill="#cfd6dc" stroke="#9aa5ae" stroke-width=".5"/>`;
      g += `<text x="${W - 10}" y="${y0 - 8}" text-anchor="end" font-size="9" fill="var(--ink-3)">${res.item.type === 'drevostavba' ? 'exteriér' : 'pojistná fólie'}</text>`;
      g += `<text x="${W - 10}" y="${yb + 16}" text-anchor="end" font-size="9" fill="var(--ink-3)">parozábrana + SDK · interiér</text>`;
    } else if (engine === 'loose') {
      const total = res.layers[0].total; const s = Math.min(0.42, 95 / total);
      const slab = 22; let y = H - 12 - slab;
      const wooden = (C.EXISTING_CEILINGS[res.item.ceiling] || {}).wooden;
      g += `<rect x="8" y="${y}" width="${W - 16}" height="${slab}" fill="${wooden ? 'var(--wood)' : 'url(#conc)'}"/>`;
      if (wooden) g += `<line x1="8" y1="${y - 1}" x2="${W - 8}" y2="${y - 1}" stroke="var(--brand)" stroke-width="2"/>`;
      res.layers[0].parts.slice().reverse().forEach((t) => {
        const h = t * s; y -= h;
        g += `<rect x="8" y="${y}" width="${W - 16}" height="${h}" fill="${wool}" stroke="var(--wool-line)" stroke-width=".8"/>`;
      });
      g += `<text x="${W - 10}" y="${y - 6}" text-anchor="end" font-size="9" fill="var(--ink-3)">nevytápěná půda</text>`;
      g += `<text x="${W - 10}" y="${H - 1}" text-anchor="end" font-size="9" fill="var(--ink-3)">vytápěná místnost</text>`;
    } else if (engine === 'masonry') {
      const total = res.layers[0].total; const s = Math.min(0.42, 90 / total);
      const wW = 70; const x0 = 40;
      g += `<rect x="${x0}" y="10" width="${wW}" height="${H - 20}" fill="url(#brick)"/>`;
      let x = x0 + wW;
      res.layers[0].parts.forEach((t) => { const w = t * s; g += `<rect x="${x}" y="10" width="${w}" height="${H - 20}" fill="${wool}" stroke="var(--wool-line)" stroke-width=".8"/>`; x += w; });
      if (res.item.type === 'venti') { x += 10; g += `<rect x="${x}" y="10" width="6" height="${H - 20}" fill="#6d7a86"/>`; }
      else g += `<rect x="${x}" y="10" width="4" height="${H - 20}" fill="#e9e4da" stroke="#b7b0a3" stroke-width=".5"/>`;
      g += `<text x="${x0 - 4}" y="${H / 2}" text-anchor="end" font-size="9" fill="var(--ink-3)">interiér</text>`;
    } else {
      const t = res.layers[0].total; const w = t * 0.9; const x0 = (W - w) / 2;
      g += `<rect x="${x0 - 8}" y="10" width="8" height="${H - 20}" fill="#cfd6dc" stroke="#9aa5ae"/>`;
      g += `<rect x="${x0}" y="10" width="${w}" height="${H - 20}" fill="${wool}"/>`;
      g += `<rect x="${x0 + w}" y="10" width="8" height="${H - 20}" fill="#cfd6dc" stroke="#9aa5ae"/>`;
      [40, 95].forEach((y) => { g += `<rect x="${x0}" y="${y}" width="${w}" height="3" fill="#8f9aa4"/>`; });
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Schéma skladby konstrukce">${defs}${g}</svg>`;
  }

  function ubarHtml(res) {
    if (res.U == null || res.target == null) return '';
    const scale = Math.max(res.target * 1.8, res.U * 1.1, res.uBase ? Math.min(res.uBase, res.target * 3) : 0);
    const pct = Math.min(100, (res.U / scale) * 100);
    const mark = (res.target / scale) * 100;
    return `<div class="ubar">
      <div class="ubar-row"><span>Součinitel prostupu tepla <b>U = ${fmtU(res.U)}</b> W/(m²K)</span>
      <span>cíl ≤ ${fmtU(res.target)} <span class="badge ${res.ok ? 'ok' : 'bad'}">${res.ok ? 'Splňuje' : 'Nesplňuje'}</span></span></div>
      <div class="ubar-track"><div class="ubar-fill ${res.ok ? '' : 'bad'}" style="width:${pct}%"></div><div class="ubar-mark" style="left:${mark}%" title="Cílová hodnota"></div></div>
    </div>`;
  }

  function levelsHtml(item) {
    if (!C.TYPES[item.type].target) return '';
    return `<div class="levels" role="group" aria-label="Porovnání úrovní">${Object.entries(C.LEVELS).map(([k, l]) => {
      const r = K.recommend(item, { ...ctx(), level: k });
      const t = r ? r.layers.reduce((s, x) => s + x.total, 0) : 0;
      return `<button type="button" data-level="${k}" class="${state.project.level === k ? 'on' : ''}">${esc(l.label)}: ${t} mm</button>`;
    }).join('')}</div>`;
  }

  function resultCard(res) {
    const t = res.typeInfo;
    const layers = res.layers.map((l) => {
      const p = C.PRODUCTS[l.product];
      return `<div class="layer"><span class="sw"></span><div><b>${esc(p.name)}</b> <small>${esc(l.name)} · λ = ${fmt(p.lambda, 3)} W/(mK)</small></div>
        <span class="t">${l.parts.join(' + ')} mm</span></div>`;
    }).join('');
    const lines = res.lines.map((l) => `${esc(C.PRODUCTS[l.product].name)} ${l.t} mm: ${fmt(l.m2)} m²`).join(' · ');
    return `<article class="rcard">
      <div class="rcard-visual">${sectionSvg(res)}</div>
      <div class="rcard-body">
        <div class="rcard-top"><h3>${esc(res.item.name || t.label)}</h3><small>${esc(t.label)} · ${fmt(res.area)} m²</small></div>
        ${levelsHtml(res.item)}
        ${layers}
        ${ubarHtml(res)}
        <div class="lines">Potřeba vč. prořezu: ${lines}</div>
        ${res.warnings.map((w) => `<div class="warning">${esc(w)}</div>`).join('')}
        ${res.notes.length ? `<ul class="notes">${res.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      </div></article>`;
  }

  let lastAgg = null;
  function renderResults() {
    const results = state.items.map((i) => K.recommend(i, ctx())).filter(Boolean);
    const agg = K.aggregate(results);
    lastAgg = agg;
    const lvl = C.LEVELS[state.project.level];
    $('#result-title').textContent = state.project.name ? state.project.name : 'Vaše doporučení';
    $('#result-sub').textContent = `Úroveň: ${lvl.label} · Priorita: ${C.PRIORITIES[state.project.priority].label}`;

    const withTarget = results.filter((r) => r.target != null);
    const okCount = withTarget.filter((r) => r.ok).length;
    const m3 = agg.insulation.reduce((s, l) => s + l.m3, 0);
    $('#tiles').innerHTML = [
      [fmt(agg.totalArea, 0) + ' m²', 'zateplovaná plocha'],
      [agg.totalPacks, 'balení izolace'],
      [fmt(m3, 1) + ' m³', 'objem izolace'],
      withTarget.length ? [`${okCount}/${withTarget.length}`, 'konstrukcí splňuje cíl'] : [results.length, 'konstrukcí'],
    ].map(([b, s]) => `<div class="tile"><b>${b}</b><span>${s}</span></div>`).join('');

    let rows = '<tr class="group"><td colspan="4">Izolace</td></tr>';
    rows += agg.insulation.map((l) => {
      const p = C.PRODUCTS[l.product];
      return `<tr><td><div class="pname">${esc(p.name)} · ${l.t} mm</div><div class="pdesc">${esc(p.desc)}</div></td>
        <td class="num">${fmt(l.m2)} m²</td><td class="num">${fmt(l.perPack, 2)} m²/${esc(p.packUnit)}</td>
        <td class="num"><span class="packs">${l.packs}</span> ${esc(p.packUnit === 'role' ? (l.packs === 1 ? 'role' : 'rolí') : (l.packs === 1 ? 'balík' : 'balíků'))}</td></tr>`;
    }).join('');
    if (agg.accessories.length) {
      rows += '<tr class="group"><td colspan="4">Vzduchotěsnost a příslušenství</td></tr>';
      rows += agg.accessories.map((a) => {
        const d = C.ACCESSORIES[a.id];
        return `<tr><td><div class="pname">${esc(d.name)}</div><div class="pdesc">${esc(d.desc)}</div></td>
          <td class="num">${fmt(a.need, 0)} ${esc(d.perLabel)}</td><td class="num">${d.perUnit} ${esc(d.perLabel)}/${esc(d.unit)}</td>
          <td class="num"><span class="packs">${a.qty}</span> ${esc(d.unit)}</td></tr>`;
      }).join('');
    }
    $('#shopping').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Produkt</th><th class="num">Potřeba</th><th class="num">Balení</th><th class="num">Koupit</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;

    $('#results').innerHTML = results.map(resultCard).join('') || '<div class="empty">Přidejte konstrukci v kroku 2.</div>';
  }

  function shoppingText() {
    if (!lastAgg) return '';
    const out = [`${state.project.name || 'Plánovač zateplení'} – nákupní seznam`, ''];
    lastAgg.insulation.forEach((l) => { const p = C.PRODUCTS[l.product]; out.push(`${p.name} ${l.t} mm – ${l.packs}× ${p.packUnit} (${fmt(l.m2)} m²)`); });
    lastAgg.accessories.forEach((a) => { const d = C.ACCESSORIES[a.id]; out.push(`${d.name} – ${a.qty}× ${d.unit}`); });
    out.push('', 'Konstrukce:');
    state.items.forEach((i) => { const r = K.recommend(i, ctx()); if (r) out.push(`• ${i.name} (${fmt(r.area)} m²): ${r.layers.map((l) => `${C.PRODUCTS[l.product].name} ${l.parts.join('+')} mm`).join(', ')}${r.U != null ? `, U = ${fmtU(r.U)}` : ''}`); });
    return out.join('\n');
  }

  /* ---------- navigace ---------- */
  function go(step) {
    step = Number(step);
    if (step === 3 && !state.items.length) { toast('Nejprve přidejte alespoň jednu konstrukci.'); step = 2; }
    state.step = step; save();
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = Number(p.dataset.step) !== step; });
    document.querySelectorAll('.step').forEach((b) => {
      const n = Number(b.dataset.go);
      b.classList.toggle('active', n === step); b.classList.toggle('done', n < step);
      b.setAttribute('aria-current', n === step ? 'step' : 'false');
    });
    if (step === 1) renderStep1();
    if (step === 2) renderItems();
    if (step === 3) renderResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------- události ---------- */
  document.addEventListener('click', (e) => {
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) { go(goBtn.dataset.go); return; }
    const add = e.target.closest('[data-add]');
    if (add) { addItem(add.dataset.add); return; }
    const lv = e.target.closest('[data-level]');
    if (lv) { state.project.level = lv.dataset.level; save(); renderResults(); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const card = act.closest('.item'); const idx = state.items.findIndex((i) => i.id === card.dataset.id);
      if (idx < 0) return;
      if (act.dataset.act === 'del') state.items.splice(idx, 1);
      if (act.dataset.act === 'dup') state.items.splice(idx + 1, 0, { ...structuredClone(state.items[idx]), id: uid(), name: state.items[idx].name + ' (kopie)' });
      if (act.dataset.act === 'mode') state.items[idx].mode = act.dataset.mode;
      save(); renderItems();
    }
  });

  $('#items').addEventListener('input', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const card = e.target.closest('.item'); const item = state.items.find((i) => i.id === card.dataset.id);
    if (!item) return;
    item[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    save();
    if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') renderItems();
    else card.querySelector('[data-area]').textContent = `${fmt(K.geometry(item).area)} m²`;
  });

  document.querySelector('[data-step="1"]').addEventListener('change', (e) => {
    if (e.target.name === 'level') state.project.level = e.target.value;
    if (e.target.name === 'priority') state.project.priority = e.target.value;
    save();
  });
  $('#project-name').addEventListener('input', (e) => { state.project.name = e.target.value; save(); });
  $('#waste').addEventListener('input', (e) => { state.project.waste = e.target.value; save(); });

  $('#btn-print').addEventListener('click', () => window.print());
  $('#btn-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shoppingText()); toast('Nákupní seznam zkopírován.'); }
    catch (err) { toast('Kopírování se nepodařilo.'); }
  });
  $('#btn-reset').addEventListener('click', () => {
    if (state.items.length && !confirm('Začít nový projekt? Současné zadání bude smazáno.')) return;
    state = fresh(); save(); go(1);
  });

  /* ---------- start ---------- */
  document.title = C.BRAND.appName;
  $('#app-name').textContent = C.BRAND.appName;
  $('#app-company').textContent = C.BRAND.company;
  $('#btn-contact').href = C.BRAND.contactUrl;
  $('#demo-banner').hidden = C.DATA_VERIFIED;
  renderTypeGrid();
  go(state.step || 1);
})();
