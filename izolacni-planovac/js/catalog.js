/*
 * KATALOG PRODUKTŮ A NORMOVÝCH HODNOT
 * ------------------------------------------------------------
 * !!! DŮLEŽITÉ !!!
 * Názvy produktů odpovídají sortimentu Knauf Insulation, ale hodnoty
 * λD, dostupné tloušťky a obsahy balení jsou ORIENTAČNÍ. Před nasazením
 * pro zákazníky je nahraďte daty z aktuálních technických listů a ceníku
 * (pole `packM2` = m² v jednom balení pro danou tloušťku).
 * Jakmile budou data ověřena, nastavte DATA_VERIFIED = true – tím zmizí
 * upozornění v aplikaci.
 */
(function (root) {
  'use strict';

  const DATA_VERIFIED = false;

  const BRAND = {
    appName: 'Plánovač zateplení',
    company: 'Knauf Insulation',
    contactUrl: '#',
  };

  /** Orientační m² v balení: role ~0,6 m³, desky ~0,36 m³ v balení. */
  function packTable(thicknesses, volumeM3, step) {
    const t = {};
    thicknesses.forEach((mm) => {
      const raw = volumeM3 / (mm / 1000);
      t[mm] = Math.round(Math.max(step, Math.round(raw / step) * step) * 100) / 100;
    });
    return t;
  }

  const T_ROLL = [50, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240];
  const T_ROLL_032 = [60, 80, 100, 120, 140, 160, 180, 200];
  const T_FKD = [40, 50, 60, 80, 100, 120, 140, 160, 180, 200];

  const PRODUCTS = {
    unifit032: {
      name: 'Unifit 032', lambda: 0.032, form: 'role',
      desc: 'Prémiová minerální izolace s nejnižší tepelnou vodivostí – nejtenčí vrstva.',
      thicknesses: T_ROLL_032, packM2: packTable(T_ROLL_032, 0.6, 0.12), packUnit: 'role',
    },
    unifit035: {
      name: 'Unifit 035', lambda: 0.035, form: 'role',
      desc: 'Univerzální minerální izolace do šikmých střech, stropů a lehkých stěn.',
      thicknesses: T_ROLL, packM2: packTable(T_ROLL, 0.6, 0.12), packUnit: 'role',
    },
    naturollpro: {
      name: 'Naturoll Pro', lambda: 0.039, form: 'role',
      desc: 'Cenově výhodná izolace v rolích pro střechy, podkroví a stropy.',
      thicknesses: T_ROLL, packM2: packTable(T_ROLL, 0.7, 0.12), packUnit: 'role',
    },
    classic040: {
      name: 'Classic 040', lambda: 0.040, form: 'role',
      desc: 'Ekonomická izolace v rolích pro pokládku na stropy a do půdních prostor.',
      thicknesses: T_ROLL, packM2: packTable(T_ROLL, 0.75, 0.12), packUnit: 'role',
    },
    naturboardfit: {
      name: 'NaturBoard FIT', lambda: 0.037, form: 'deska',
      desc: 'Mírně tuhá deska – pod krokve, do příček a předstěn.',
      thicknesses: [40, 50, 60, 80, 100, 120, 140, 160], packM2: packTable([40, 50, 60, 80, 100, 120, 140, 160], 0.36, 0.72), packUnit: 'balík',
    },
    naturboardventi: {
      name: 'NaturBoard VENTI', lambda: 0.035, form: 'deska',
      desc: 'Deska s povrchovou úpravou pro provětrávané fasády.',
      thicknesses: [50, 60, 80, 100, 120, 140, 160, 180, 200], packM2: packTable([50, 60, 80, 100, 120, 140, 160, 180, 200], 0.36, 0.72), packUnit: 'balík',
    },
    fkdsthermal: {
      name: 'FKD-S Thermal', lambda: 0.035, form: 'deska',
      desc: 'Fasádní deska z minerální vlny pro kontaktní zateplovací systémy (ETICS).',
      thicknesses: T_FKD, packM2: packTable(T_FKD, 0.3, 0.6), packUnit: 'balík',
    },
    akustikboard: {
      name: 'Akustik Board', lambda: 0.037, form: 'deska',
      desc: 'Akustická deska do sádrokartonových příček a předstěn.',
      thicknesses: [40, 50, 60, 75, 100], packM2: packTable([40, 50, 60, 75, 100], 0.36, 0.72), packUnit: 'balík',
    },
  };

  const ACCESSORIES = {
    lds100: { name: 'Homeseal LDS 100', desc: 'Parotěsná fólie (sd ≈ 100 m), role 1,5 × 50 m', unit: 'role', perUnit: 75, perLabel: 'm²' },
    soliplan: { name: 'Homeseal LDS Soliplan', desc: 'Lepicí páska na spoje fólií', unit: 'role', perUnit: 25, perLabel: 'm' },
    solimur: { name: 'Homeseal LDS Solimur', desc: 'Lepicí tmel pro napojení fólie na zdivo', unit: 'kartuše', perUnit: 8, perLabel: 'm' },
  };

  /* Normové hodnoty součinitele prostupu tepla U [W/(m²K)] dle ČSN 73 0540-2.
   * Pro pasivní úroveň je použita hodnota ze středu doporučeného rozpětí. */
  const LEVELS = {
    pozadovana: { label: 'Splnit normu', sub: 'Požadovaná hodnota ČSN 73 0540-2' },
    doporucena: { label: 'Doporučeno', sub: 'Doporučená hodnota – rozumný standard' },
    pasivni: { label: 'Pasivní standard', sub: 'Pro nízkoenergetické a pasivní domy' },
  };

  const U_TARGETS = {
    roof: { pozadovana: 0.24, doporucena: 0.16, pasivni: 0.12 },
    ceilingAttic: { pozadovana: 0.30, doporucena: 0.20, pasivni: 0.12 },
    wallExt: { pozadovana: 0.30, doporucena: 0.25, pasivni: 0.15 },
  };

  const PRIORITIES = {
    vykon: { label: 'Nejtenčí vrstva', sub: 'Maximum izolace na minimum místa', cavity: ['unifit032', 'unifit035'], loose: ['unifit035', 'classic040'] },
    vyvazeny: { label: 'Vyvážené', sub: 'Poměr cena / výkon', cavity: ['unifit035', 'unifit032'], loose: ['naturollpro', 'unifit035'] },
    cena: { label: 'Nejnižší cena', sub: 'Úsporné řešení', cavity: ['naturollpro', 'unifit035', 'unifit032'], loose: ['classic040', 'naturollpro'] },
  };

  /* Stávající konstrukce – orientační tepelný odpor R [m²K/W] */
  const EXISTING_WALLS = {
    cp450: { label: 'Plná cihla 450 mm', R: 0.62 },
    cp300: { label: 'Plná cihla 300 mm', R: 0.43 },
    cdm375: { label: 'Cihla CDm / CDK 375 mm', R: 0.85 },
    porotherm30: { label: 'Keramické tvárnice 300 mm (starší)', R: 1.25 },
    porotherm44: { label: 'Keramické tvárnice 440 mm', R: 2.4 },
    pb300: { label: 'Pórobeton 300 mm', R: 1.8 },
    panel: { label: 'Panelový dům (sendvičový panel)', R: 1.0 },
    kamen: { label: 'Smíšené / kamenné zdivo 600 mm', R: 0.45 },
  };

  const EXISTING_CEILINGS = {
    tramovy: { label: 'Dřevěný trámový strop s podbitím', R: 0.6, wooden: true },
    beton: { label: 'Železobetonový strop / panel', R: 0.15, wooden: false },
    keramicky: { label: 'Keramický strop (Hurdis, MIAKO)', R: 0.35, wooden: false },
  };

  const TYPES = {
    sikma: {
      label: 'Šikmá střecha / podkroví', short: 'Mezi a pod krokve',
      icon: 'roof', target: 'roof', engine: 'framed',
    },
    strop: {
      label: 'Strop pod nevytápěnou půdou', short: 'Pokládka na strop',
      icon: 'attic', target: 'ceilingAttic', engine: 'loose',
    },
    etics: {
      label: 'Fasáda – kontaktní zateplení', short: 'Systém ETICS',
      icon: 'wall', target: 'wallExt', engine: 'masonry',
    },
    venti: {
      label: 'Provětrávaná fasáda', short: 'S obkladem',
      icon: 'venti', target: 'wallExt', engine: 'masonry',
    },
    drevostavba: {
      label: 'Stěna dřevostavby', short: 'Mezi sloupky',
      icon: 'frame', target: 'wallExt', engine: 'framed',
    },
    pricka: {
      label: 'Akustická příčka / předstěna', short: 'Sádrokarton',
      icon: 'partition', target: null, engine: 'acoustic',
    },
  };

  const api = { DATA_VERIFIED, BRAND, PRODUCTS, ACCESSORIES, LEVELS, U_TARGETS, PRIORITIES, EXISTING_WALLS, EXISTING_CEILINGS, TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Catalog = api;
})(typeof window !== 'undefined' ? window : globalThis);
