// Escherichia coli, as data (PLAN §17). The same places as the human cell, a
// different envelope: the cell's boundary is the outer membrane, a thin
// periplasm with its peptidoglycan wall lies inside it, and inside that the
// inner (cytoplasmic) membrane, unrolled into the strip at the top. The
// periplasm above the strip is the proton reservoir. Glycolysis, pyruvate
// oxidation and the citric acid cycle share one cytoplasm, so there is no
// shuttle, no pyruvate carrier and no translocase. A nucleoid sits where the
// human nucleus would be.
//
// The chain: NADH dehydrogenase (NDH-1, Complex I's homologue), succinate
// dehydrogenase (Complex II), the quinone pool, then cytochrome bo₃ (a
// heme–copper oxidase like Complex IV) in air or nitrate reductase with
// nitrate, and ATP synthase. Homologues keep the human station ids (§17 D2).

import {
  CHAIN,
  CYCLE_SKELETONS,
  GLUCOSE_FEED,
  RING,
  STRIP_HALF,
  STRIP_Y,
  atpSynthase,
  attachTaps,
  belt,
  box,
  circleZone,
  complexOne,
  cycleBelts,
  cycleBoxes,
  cycleStations,
  dock,
  drift,
  edge,
  glycolysisBelts,
  glycolysisBoxes,
  glycolysisStations,
  loop,
  makeStubs,
  quinoneLoop,
  surplusWork,
  synthaseLoop,
  zonePath,
} from './parts.js';

const ROW_PAY = 1040;
const ROW_INV = 1240;

// The rod: a wide rounded body. Its boundary is the outer membrane. It ends
// a little right of the synthase loop (M6.5 P3); its corner still clears the
// periplasm pocket, so protons are placed exactly as before.
const outer = { type: 'roundRect', x: 110, y: 110, w: 1830, h: 1370, r: 330 };
const inner = { type: 'roundRect', x: 124, y: 124, w: 1802, h: 1342, r: 316 };
const wallLine = { type: 'roundRect', x: 117, y: 117, w: 1816, h: 1356, r: 323 };

// The strip runs from the left of the rod to here, then the inner membrane
// turns up to rejoin the envelope: the periplasm above the strip is a pocket.
const STRIP_END = 1620;

const BO3 = CHAIN.III;
const NAR = CHAIN.IV;
const O2_X = 1060;
const NO3_X = 1250;
const NO2_X = 1282;
const UNCOUPLER_X = 1370;
const CHIMNEY_LEFT = 215;
const CHIMNEY_RIGHT = 1322;
const PYRUVATE_Y = 960;

// In the free corner right of the glycolysis rows and below the synthase loop.
const NUCLEOID = { cx: 1720, cy: 1170, rx: 110, ry: 150 };

function nucleoidShape() {
  // A wandering loop of DNA: a closed curve with slow wiggles.
  const points = [];
  for (let i = 0; i < 96; i += 1) {
    const a = (i / 96) * Math.PI * 2;
    const k = 1 + 0.07 * Math.sin(a * 7 + 0.6) + 0.05 * Math.sin(a * 3 - 1.1);
    points.push({ x: NUCLEOID.cx + Math.cos(a) * NUCLEOID.rx * k, y: NUCLEOID.cy + Math.sin(a) * NUCLEOID.ry * k });
  }
  return points;
}

function nucleoidCoils() {
  // A few strands looping inside it, drawn faintly.
  const coils = [];
  for (let j = 0; j < 3; j += 1) {
    const points = [];
    const cy = NUCLEOID.cy + (j - 1) * NUCLEOID.ry * 0.55;
    const half = NUCLEOID.rx * 0.68;
    const k = NUCLEOID.rx / 250;
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      points.push({
        x: NUCLEOID.cx - half + t * half * 2,
        y: cy + Math.sin(t * Math.PI * 4 + j) * 34 * k + Math.sin(t * Math.PI * 9 + j * 2) * 10 * k,
      });
    }
    coils.push(points);
  }
  return coils;
}

export function buildBacterium() {
  const g = glycolysisBoxes(ROW_PAY, ROW_INV);
  const c = cycleBoxes();
  const { pk, gapdh } = g;
  const { pdh, idh, akgdh } = c;

  const bo3 = box('complex4', BO3, STRIP_Y, 84, 64, {
    kind: 'complex', shape: 'IV', reaction: 'bo3', zone: 'oxphos', acceptor: 'oxygen', names: ['bo₃', 'Cytochrome bo₃ oxidase'],
    times: { load: 0.3, work: 1.0, unload: 0.3 },
  });
  const nar = box('nar', NAR, STRIP_Y, 90, 64, {
    kind: 'complex', shape: 'I', reaction: 'nar', zone: 'oxphos', acceptor: 'nitrate', names: ['Nar', 'Nitrate reductase'],
    arm: { x: NAR, y: 360, w: 44, h: 56 },
    times: { load: 0.25, work: 0.6, unload: 0.25 },
  });
  const workM = box('workm', 1450, 965, 80, 56, {
    kind: 'work', reaction: 'cell-work', zone: 'cytosol', times: { load: 0.15, work: 0.25, unload: 0.15 },
  });
  const workC = box('workc', 270, ROW_PAY + 100, 80, 56, {
    kind: 'work', reaction: 'cell-work', zone: 'cytosol', times: { load: 0.25, work: 0.6, unload: 0.25 },
  });

  // Loops ---------------------------------------------------------------------

  // One carrier loop for the whole cytoplasm: NAD from glycolysis, pyruvate
  // dehydrogenase and the cycle to NDH-1, coenzyme A, and the cycle's ATP.
  const bus = loop('bus', [
    { x: 390, y: 392 }, { x: 390, y: 840 }, { x: 900, y: 840 }, { x: 900, y: 470 },
    { x: 1330, y: 470 }, { x: 1330, y: 900 }, { x: 330, y: 900 }, { x: 330, y: 392 },
  ], 20, { name: 'Carriers', compartment: 'cytosol', tint: 'carrier-nad' });
  const qLoop = quinoneLoop(NAR);
  qLoop.name = 'Quinone';
  const synLoop = { ...synthaseLoop(), compartment: 'cytosol' };
  const glycoLoop = loop('glyco', [
    { x: 330, y: ROW_PAY + 85 }, { x: 1290, y: ROW_PAY + 85 }, { x: 1290, y: ROW_PAY + 115 }, { x: 330, y: ROW_PAY + 115 },
  ], 15, { name: 'ATP and ADP', compartment: 'cytosol', tint: 'carrier-adenosine' });

  // Belts ---------------------------------------------------------------------

  const TRAY = {
    glucose: { x: 215, y: ROW_INV },
    oxygen: { x: O2_X, y: 48 },
    nitrate: { x: NO3_X, y: 48 },
    prompt: { x: 215, y: ROW_INV + 70 },
  };

  const belts = [
    ...glycolysisBelts(g, { tray: TRAY.glucose, rowPay: ROW_PAY, rowInv: ROW_INV }).map((entry) => ({ ...entry, compartment: 'cytosol' })),
    // No fermentation branch here (§17 D9): pyruvate goes straight to
    // pyruvate dehydrogenase, in the same cytoplasm.
    belt('pyruvate', [edge.top(pk), { x: pk.x, y: PYRUVATE_Y }, { x: pdh.x, y: PYRUVATE_Y }, edge.bottom(pdh)]),
    ...cycleBelts(c, { compartment: 'cytosol' }),
  ];

  // Drift paths ---------------------------------------------------------------

  const drifts = {
    // O₂ diffuses in from the top, through both membranes, to bo₃.
    o2: drift([TRAY.oxygen, { x: O2_X, y: 352 }, { x: BO3, y: 352 }], 20),
    // Nitrate comes in through a porin and NarK to nitrate reductase's head;
    // nitrite goes back out through NarK beside it.
    no3: drift([TRAY.nitrate, { x: NO3_X, y: 384 }], 20),
    arriveGlucose: drift([{ x: -260, y: TRAY.glucose.y }, TRAY.glucose]),
    arriveOxygen: drift([{ x: O2_X, y: -260 }, TRAY.oxygen]),
    arriveNitrate: drift([{ x: NO3_X, y: -260 }, TRAY.nitrate]),
    pdh: drift([edge.top(pdh), { x: 1150, y: 640 }, { x: 1260, y: 470 }, { x: CHIMNEY_RIGHT, y: 360 }, { x: CHIMNEY_RIGHT, y: -120 }], 80),
    idh: drift([edge.left(idh), { x: 300, y: 640 }, { x: CHIMNEY_LEFT, y: 560 }, { x: CHIMNEY_LEFT, y: -120 }], 70),
    akgdh: drift([edge.left(akgdh), { x: 290, y: 480 }, { x: CHIMNEY_LEFT, y: 420 }, { x: CHIMNEY_LEFT, y: -120 }], 60),
    // Water from bo₃ rises just left of it, water from nitrate reductase just
    // right of the O₂ lane; nitrite leaves up its own lane through NarK.
    complex4: drift([{ x: BO3 - 20, y: 374 }, { x: 890, y: 374 }, { x: 880, y: 340 }, { x: 880, y: -120 }], 24),
    narWater: drift([{ x: NAR - 20, y: 400 }, { x: 1110, y: 400 }, { x: 1110, y: 360 }, { x: 1110, y: -120 }], 24),
    no2: drift([{ x: NAR + 24, y: 404 }, { x: NO2_X, y: 404 }, { x: NO2_X, y: 360 }, { x: NO2_X, y: -120 }], 20),
  };

  // Stations ------------------------------------------------------------------

  const [cyc, ...cycleRest] = cycleStations(c);
  const stations = [
    ...glycolysisStations(g, { nad: 'bus', pyruvate: 'pyruvate' }),
    surplusWork(workC),
    cyc,
    ...cycleRest.map((def) => (def.id === 'complex2' ? { ...def, names: ['SDH', 'Succinate dehydrogenase (Complex II)'] } : def)),
    { ...complexOne('ndh1'), names: ['NDH-1', 'NADH dehydrogenase (NDH-1)'] },
    {
      ...bo3,
      store: { cap: 4 },
      modes: [
        {
          reaction: 'bo3-quinol',
          when: 'storeNotFull',
          times: { load: 0.25, work: 0.5, unload: 0.25 },
          inputs: [{ role: 'qh2', from: 'dock', dock: 'qh2' }],
          outputs: [
            { role: 'q', to: 'loop', loop: 'q', at: { x: BO3 - 20, y: STRIP_Y + 7 } },
            { role: 'hA', to: 'reservoir', at: { x: BO3 - 22, y: 262 } },
            { role: 'hB', to: 'reservoir', at: { x: BO3 + 22, y: 262 } },
            { role: 'eA', to: 'store' },
            { role: 'eB', to: 'store' },
          ],
        },
        {
          reaction: 'bo3',
          when: 'storeFull',
          inputs: [
            { role: 'e1', from: 'store' }, { role: 'e2', from: 'store' }, { role: 'e3', from: 'store' }, { role: 'e4', from: 'store' },
            { role: 'o2', from: 'dock', dock: 'o2' },
            { role: 'h1', from: 'bulk', at: { x: BO3 - 30, y: 352 } },
            { role: 'h2', from: 'bulk', at: { x: BO3 - 10, y: 360 } },
            { role: 'h3', from: 'bulk', at: { x: BO3 + 10, y: 360 } },
            { role: 'h4', from: 'bulk', at: { x: BO3 + 30, y: 352 } },
          ],
          outputs: [{ role: 'waterA', to: 'exhaust', drift: 'complex4' }, { role: 'waterB', to: 'exhaust', drift: 'complex4' }],
          pump: 4,
        },
      ],
      docks: {
        qh2: dock({ x: BO3 + 16, y: STRIP_Y }, 'qh2', ['q']),
        o2: dock({ x: BO3, y: 352 }, 'oxygen', [], { drift: 'o2' }),
      },
    },
    {
      ...nar,
      store: { cap: 2 },
      modes: [
        {
          reaction: 'nar-quinol',
          when: 'storeNotFull',
          times: { load: 0.25, work: 0.5, unload: 0.25 },
          inputs: [{ role: 'qh2', from: 'dock', dock: 'qh2' }],
          outputs: [
            { role: 'q', to: 'loop', loop: 'q', at: { x: NAR - 24, y: STRIP_Y + 7 } },
            { role: 'hA', to: 'reservoir', at: { x: NAR - 22, y: 262 } },
            { role: 'hB', to: 'reservoir', at: { x: NAR + 22, y: 262 } },
            { role: 'eA', to: 'store' },
            { role: 'eB', to: 'store' },
          ],
        },
        {
          reaction: 'nar',
          when: 'storeFull',
          inputs: [
            { role: 'e1', from: 'store' }, { role: 'e2', from: 'store' },
            { role: 'no3', from: 'dock', dock: 'no3' },
            { role: 'h1', from: 'bulk', at: { x: NAR - 16, y: 396 } },
            { role: 'h2', from: 'bulk', at: { x: NAR + 16, y: 396 } },
          ],
          outputs: [{ role: 'no2', to: 'exhaust', drift: 'no2' }, { role: 'water', to: 'exhaust', drift: 'narWater' }],
        },
      ],
      docks: {
        qh2: dock({ x: NAR - 16, y: STRIP_Y }, 'qh2', ['q']),
        no3: dock({ x: NO3_X, y: 384 }, 'nitrate', [], { drift: 'no3' }),
      },
    },
    atpSynthase(),
    // Cell work stands where the translocase stands in a mitochondrion. ATP
    // comes straight from the synthase loop and from the carrier loop.
    {
      ...workM,
      demand: 'clock',
      modes: [{
        reaction: 'cell-work',
        inputs: [{ role: 'atp', from: 'dock', dock: 'atp' }, { role: 'water', from: 'bulk', at: edge.left(workM) }],
        outputs: [{ role: 'adp', to: 'loop', loop: 'source:atp', at: edge.top(workM), group: 'adpPi' }, { role: 'pi', to: 'loop', loop: 'source:atp', at: edge.top(workM), group: 'adpPi' }, { role: 'h', to: 'bulk', at: edge.right(workM) }],
      }],
      docks: { atp: dock({ x: 1430, y: 899 }, 'atp', ['syn', 'bus'], { buffer: 1, places: [{ x: 1430, y: 899 }, { x: 1505, y: 899 }] }) },
    },
  ];

  const loops = { bus, q: qLoop, syn: synLoop, glyco: glycoLoop };
  attachTaps(stations, loops);

  const zones = [
    {
      id: 'glycolysis',
      name: 'Glycolysis',
      token: 'zone-glycolysis',
      path: zonePath([{ x: 210, y: ROW_PAY - 68 }, { x: 1384, y: ROW_PAY - 68 }, { x: 1384, y: ROW_INV + 108 }, { x: 210, y: ROW_INV + 108 }]),
      label: { x: 230, y: ROW_PAY - 48, align: 'left' },
    },
    {
      id: 'oxidation',
      name: 'Pyruvate Oxidation',
      token: 'zone-oxidation',
      path: zonePath([{ x: 962, y: 724 }, { x: 1118, y: 724 }, { x: 1118, y: 930 }, { x: 962, y: 930 }], 18),
      label: { x: 1126, y: 740, align: 'left' },
    },
    {
      id: 'krebs',
      name: 'Krebs Cycle',
      sub: 'Citric Acid Cycle',
      token: 'zone-krebs',
      path: circleZone(RING.x, RING.y, 236, 258),
      label: { x: RING.x, y: RING.y - 8, align: 'center' },
    },
    {
      id: 'oxphos',
      name: 'Oxidative Phosphorylation',
      token: 'zone-oxphos',
      path: zonePath([
        { x: 400, y: 140 }, { x: 1580, y: 140 }, { x: 1580, y: 460 }, { x: 1120, y: 460 },
        { x: 1120, y: 324 }, { x: 692, y: 324 }, { x: 692, y: 342 }, { x: 588, y: 342 }, { x: 588, y: 324 },
        { x: 400, y: 324 }, { x: 400, y: 412 }, { x: 236, y: 412 }, { x: 236, y: 300 },
      ], 18),
      label: { x: 420, y: 160, align: 'left' },
      parts: [
        { name: 'Electron Transport Chain', x: (CHAIN.I + NAR) / 2, y: 196 },
        { name: 'Chemiosmosis', x: CHAIN.SYN, y: 196 },
      ],
    },
  ];

  // Pores cross both membranes in pairs: a porin in the outer membrane, a
  // transporter in the inner one.
  const pores = [
    { id: 'porin-glc', name: 'Porin', short: 'OmpF', x: 124, y: TRAY.glucose.y, membrane: 'cell', w: 12, h: 30, pair: 'glut' },
    { id: 'glut', name: 'Glucose transporter', short: 'PTS', x: 141, y: TRAY.glucose.y, membrane: 'cell', w: 12, h: 30, quiet: true },
    { id: 'porin-n', name: 'Porin', short: 'OmpF', x: (NO3_X + NO2_X) / 2, y: outer.y + 7, membrane: 'outer', w: 58, h: 12, pair: 'nark' },
    { id: 'nark', name: 'Nitrate–nitrite antiporter', short: 'NarK', x: (NO3_X + NO2_X) / 2, y: STRIP_Y, membrane: 'inner', w: 58, h: 26 },
  ];

  const labels = [
    { text: 'Periplasm', x: 1060, y: 160, kind: 'compartment' },
    { text: 'Cytoplasm', x: 1720, y: 940, kind: 'compartment' },
    { text: 'Nucleoid', x: NUCLEOID.cx, y: NUCLEOID.cy + NUCLEOID.ry + 40, kind: 'compartment' },
    { text: 'Outer membrane', x: 1700, y: 92, kind: 'compartment' },
    { text: 'Inner membrane', x: 800, y: STRIP_Y, kind: 'membrane', lod: 'mid' },
    { text: 'Investment Phase', x: 1060, y: ROW_INV + 90, kind: 'phase', token: 'zone-glycolysis' },
    { text: 'Payoff Phase', x: 710, y: ROW_PAY + 60, kind: 'phase', token: 'zone-glycolysis' },
  ];

  return {
    id: 'bacterium',
    organism: 'bacterium',
    bounds: { x: 0, y: -10, w: outer.x + outer.w + 110, h: outer.y + outer.h + 30 },
    cell: { id: 'cytosol', name: 'Cytoplasm', fill: 'cytosol', stroke: 'membrane', strokeWidth: 1.5, shape: outer },
    nucleoid: { outline: nucleoidShape(), coils: nucleoidCoils(), ...NUCLEOID },
    envelope: {
      outer,
      inner,
      wall: wallLine,
      strip: { y: STRIP_Y, half: STRIP_HALF, x1: inner.x, x2: STRIP_END },
    },
    reservoir: {
      name: 'periplasm',
      x1: inner.x + 12,
      x2: STRIP_END - STRIP_HALF - 12,
      y1: inner.y + 8,
      y2: STRIP_Y - STRIP_HALF - 6,
      within: { type: 'roundRect', x: inner.x + 10, y: inner.y + 10, w: inner.w - 20, h: inner.h - 20, r: inner.r - 10 },
    },
    stations,
    belts,
    loops,
    stubs: makeStubs(stations, loops),
    drifts,
    lanes: [
      { id: 'o2', drift: 'o2', name: 'O₂', supply: 'oxygen' },
      { id: 'no3', drift: 'no3', name: 'NO₃⁻', supply: 'nitrate' },
    ],
    supplies: [
      { id: 'oxygen', species: 'oxygen', lane: 'o2', arrive: 'arriveOxygen', station: 'complex4', dock: 'o2' },
      { id: 'nitrate', species: 'nitrate', lane: 'no3', arrive: 'arriveNitrate', station: 'nar', dock: 'no3' },
    ],
    feed: GLUCOSE_FEED,
    skeletons: CYCLE_SKELETONS,
    life: { kind: 'demand', clock: 'workm' },
    gauges: ['atp', 'protons'],
    zones,
    pores,
    labels,
    tray: TRAY,
    chain: CHAIN,
    ring: RING,
    uncoupler: {
      dnp: { x: UNCOUPLER_X, y: STRIP_Y },
    },
    matrixCrossings: [
      { a: 'pyruvate', b: 'bus' },
      { a: 'pdh-cs', b: 'bus' },
    ],
    params: {
      minSpacing: 24,
      spacingFloor: 14,
      enzymeRate: 1,
      demand: 0.6,
      prime: {
        bus: [['nad', 24], ['coa', 8], ['adpPi', 3], ['atp', 1]],
        q: [['q', 9]],
        syn: [['atp', 3], ['adpPi', 3]],
        glyco: [['atp', 6], ['adpPi', 3], ['pi', 4], ['adp', 2]],
      },
    },
  };
}

export const bacteriumScene = buildBacterium();
