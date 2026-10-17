// A respiring eukaryotic cell, as data. World units, y downward. The proton
// reservoir (intermembrane space) is above the strip of inner membrane; the
// matrix, where ATP is made, is below. PLAN §6.6 and §16: nucleus bottom
// right, a wide mitochondrion with both membranes, the chain in textbook
// order, the cycle hanging under Complex II, glycolysis below, and between
// the two a "U" where pyruvate forks into the mitochondrion or fermentation.
// buildCell makes the human cell (lactate dehydrogenase) and the yeast cell
// (pyruvate decarboxylase and alcohol dehydrogenase) from the same plan.

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
  enzyme,
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

export { STRIP_HALF, STRIP_Y };

// Everything below the mitochondrion sits this much lower than in M4, to
// open the U for fermentation.
const DY = 130;
const CELL_H = 1500 + DY;

const outer = { type: 'roundRect', x: 110, y: 110, w: 1500, h: 830, r: 120 };
const inner = { type: 'roundRect', x: 124, y: 124, w: 1472, h: 802, r: 106 };

const ROW_PAY = 1110 + DY;
const ROW_INV = 1310 + DY;

const CORRIDOR_Y = 990;
const FORK = { x: 380, y: 1075 };
const FERM_Y = 1075;
const NAD_TOP = 1132;
const NAD_BOT = 1154;

const O2_X = 1262;
const UNCOUPLER_X = 1370;

export function buildCell(options) {
  const fermentKind = options.ferment; // 'lactic' or 'ethanol'

  const g = glycolysisBoxes(ROW_PAY, ROW_INV);
  const c = cycleBoxes();
  const { pk, gapdh } = g;
  const { pdh, idh, akgdh } = c;

  const complex3 = box('complex3', CHAIN.III, STRIP_Y, 92, 64, {
    kind: 'complex', shape: 'III', reaction: 'complex3', zone: 'oxphos',
    times: { load: 0.3, work: 0.8, unload: 0.3 },
  });
  const complex4 = box('complex4', CHAIN.IV, STRIP_Y, 84, 64, {
    kind: 'complex', shape: 'IV', reaction: 'oxidase', zone: 'oxphos',
    times: { load: 0.3, work: 1.0, unload: 0.3 },
  });

  const MEMBRANE_Y = outer.y + outer.h - 7;
  const shuttle = box('shuttle', 1260, MEMBRANE_Y, 40, 36, {
    kind: 'transport', reaction: 'shuttle', zone: 'transport', times: { load: 0.3, work: 0.6, unload: 0.3 },
  });
  const ant = box('ant', 1430, MEMBRANE_Y, 36, 36, {
    kind: 'transport', reaction: 'ant', zone: 'transport', times: { load: 0.15, work: 0.15, unload: 0.15 },
  });
  const workM = box('workm', 1460, 1314 + DY, 80, 56, {
    kind: 'work', reaction: 'cell-work', zone: 'cytosol', times: { load: 0.15, work: 0.25, unload: 0.15 },
  });
  const workC = box('workc', 270, 1210 + DY, 80, 56, {
    kind: 'work', reaction: 'cell-work', zone: 'cytosol', times: { load: 0.25, work: 0.6, unload: 0.25 },
  });

  // Fermentation sits in the U between the pyruvate belt and the payoff row.
  const fermentTimes = { load: 0.5, work: 0.7, unload: 0.4 };
  const ldh = enzyme('ldh', 'ldh', 520, FERM_Y, 'ferment');
  ldh.times = fermentTimes;
  const pdc = enzyme('pdc', 'pdc', 520, FERM_Y, 'ferment');
  pdc.times = fermentTimes;
  const adh = enzyme('adh', 'adh', 760, FERM_Y, 'ferment');
  adh.times = fermentTimes;
  const fermentEnd = fermentKind === 'lactic' ? ldh : adh;
  const nadLeft = fermentEnd.x - 40;

  // Loops ---------------------------------------------------------------------

  const bus = loop('bus', [
    { x: 390, y: 392 }, { x: 390, y: 840 }, { x: 900, y: 840 }, { x: 900, y: 470 },
    { x: 1330, y: 470 }, { x: 1330, y: 900 }, { x: 330, y: 900 }, { x: 330, y: 392 },
  ], 20, { name: 'Matrix carriers', compartment: 'matrix', tint: 'carrier-nad' });

  const qLoop = loop('q', [
    { x: CHAIN.I, y: STRIP_Y - 7 }, { x: CHAIN.III, y: STRIP_Y - 7 },
    { x: CHAIN.III, y: STRIP_Y + 7 }, { x: CHAIN.I, y: STRIP_Y + 7 },
  ], 7, { name: 'Ubiquinone', compartment: 'membrane', tint: 'carrier-q' });

  const cytLoop = loop('cyt', [
    { x: CHAIN.III, y: 252 }, { x: CHAIN.IV, y: 252 }, { x: CHAIN.IV, y: 234 }, { x: CHAIN.III, y: 234 },
  ], 9, { name: 'Cytochrome c', compartment: 'ims', tint: 'carrier-cyt' });

  const synLoop = synthaseLoop();

  const exportLoop = loop('export', [
    { x: 1415, y: 975 }, { x: 1415, y: 1240 + DY }, { x: 1505, y: 1240 + DY }, { x: 1505, y: 975 },
  ], 45, { name: 'ATP and ADP', compartment: 'cytosol', tint: 'carrier-adenosine' });

  // From glyceraldehyde 3-phosphate dehydrogenase left along the U to the
  // fermentation enzyme, then up to the shuttle, then back. The fermentation
  // enzyme comes first, but docks NADH only while its substrate is waiting,
  // so in a healthy cell every NADH goes on to the shuttle.
  const nadLoop = loop('nadc', [
    { x: nadLeft, y: NAD_BOT }, { x: nadLeft, y: NAD_TOP }, { x: 1244, y: NAD_TOP },
    { x: 1244, y: 965 }, { x: 1276, y: 965 }, { x: 1276, y: NAD_BOT },
  ], 11, { name: 'NAD', compartment: 'cytosol', tint: 'carrier-nad' });

  const glycoLoop = loop('glyco', [
    { x: 330, y: 1195 + DY }, { x: 1290, y: 1195 + DY }, { x: 1290, y: 1225 + DY }, { x: 330, y: 1225 + DY },
  ], 15, { name: 'ATP and ADP', compartment: 'cytosol', tint: 'carrier-adenosine' });

  // Belts ---------------------------------------------------------------------

  const TRAY = {
    glucose: { x: 150, y: ROW_INV },
    oxygen: { x: O2_X, y: 48 },
    prompt: { x: 60, y: ROW_INV + 50 },
  };

  const belts = [
    ...glycolysisBelts(g, { tray: TRAY.glucose, rowPay: ROW_PAY, rowInv: ROW_INV }),
    // Pyruvate rises from pyruvate kinase to the fork. The first branch goes
    // into the mitochondrion; the second, used only when the first has backed
    // up, goes to fermentation (§16 D3).
    belt('pk-fork', [edge.top(pk), FORK], { fork: { to: ['pyruvate', 'pyr-ferm'], queue: 3 } }),
    belt('pyruvate', [FORK, { x: FORK.x, y: CORRIDOR_Y }, { x: pdh.x, y: CORRIDOR_Y }, edge.bottom(pdh)], { gates: ['mpc'], junction: true }),
    belt('pyr-ferm', [FORK, edge.left(fermentKind === 'lactic' ? ldh : pdc)], { junction: true }),
    ...cycleBelts(c, { compartment: 'matrix' }),
  ];
  if (fermentKind === 'ethanol') belts.push(belt('pdc-adh', [edge.right(pdc), edge.left(adh)]));

  // Drift paths ---------------------------------------------------------------

  const CHIMNEY_LEFT = 215;
  const CHIMNEY_RIGHT = 1322;

  const drifts = {
    // O₂ diffuses in from the top, through both membranes, to Complex IV's
    // matrix face. It needs no transporter.
    o2: drift([TRAY.oxygen, { x: O2_X, y: 352 }, { x: CHAIN.IV, y: 352 }], 20),
    arriveGlucose: drift([{ x: -260, y: TRAY.glucose.y }, TRAY.glucose]),
    arriveOxygen: drift([{ x: O2_X, y: -260 }, TRAY.oxygen]),
    pdh: drift([edge.top(pdh), { x: 1150, y: 640 }, { x: 1260, y: 470 }, { x: CHIMNEY_RIGHT, y: 360 }, { x: CHIMNEY_RIGHT, y: -120 }], 80),
    idh: drift([edge.left(idh), { x: 300, y: 640 }, { x: CHIMNEY_LEFT, y: 560 }, { x: CHIMNEY_LEFT, y: -120 }], 70),
    akgdh: drift([edge.left(akgdh), { x: 290, y: 480 }, { x: CHIMNEY_LEFT, y: 420 }, { x: CHIMNEY_LEFT, y: -120 }], 60),
    // Water leaves Complex IV's matrix face under the O₂ lane's turn.
    complex4: drift([{ x: CHAIN.IV + 20, y: 374 }, { x: CHIMNEY_RIGHT - 30, y: 374 }, { x: CHIMNEY_RIGHT, y: 340 }, { x: CHIMNEY_RIGHT, y: -120 }], 30),
  };
  if (fermentKind === 'lactic') {
    // Lactate leaves through its transporter in the plasma membrane.
    drifts.ldh = drift([edge.left(ldh, 20), { x: -180, y: ldh.y + 20 }], 16);
  } else {
    // Fermentation CO₂ rises over the pyruvate belt and up the gap between
    // the cell membrane and the mitochondrion. Ethanol diffuses out left.
    drifts.pdc = drift([edge.top(pdc), { x: pdc.x, y: 1014 }, { x: 60, y: 1014 }, { x: 60, y: -140 }], 30);
    drifts.adh = drift([edge.top(adh), { x: adh.x, y: 1014 }, { x: -180, y: 1014 }], 20);
  }

  // Stations ------------------------------------------------------------------

  const [cyc, ...cycleRest] = cycleStations(c);
  const stations = [
    ...glycolysisStations(g, { nad: 'nadc', pyruvate: 'pk-fork' }),
    surplusWork(workC),
    {
      ...shuttle,
      modes: [{
        reaction: 'shuttle',
        inputs: [{ role: 'cytNadh', from: 'dock', dock: 'cyt' }, { role: 'matNad', from: 'dock', dock: 'mat' }],
        outputs: [{ role: 'cytNad', to: 'loop', loop: 'nadc', at: edge.bottom(shuttle) }, { role: 'matNadh', to: 'loop', loop: 'bus', at: edge.top(shuttle) }],
      }],
      docks: {
        cyt: dock(edge.bottom(shuttle), 'nadh', ['nadc']),
        mat: dock(edge.top(shuttle), 'nad', ['bus']),
      },
    },
    cyc,
    ...cycleRest,
    complexOne('complex1'),
    {
      ...complex3,
      modes: [{
        reaction: 'complex3',
        inputs: [
          { role: 'qh2', from: 'dock', dock: 'qh2' },
          { role: 'cytA', from: 'dock', dock: 'cytA' },
          { role: 'cytB', from: 'dock', dock: 'cytB' },
        ],
        outputs: [
          { role: 'q', to: 'loop', loop: 'q', at: { x: CHAIN.III - 20, y: STRIP_Y + 7 } },
          { role: 'cytA', to: 'loop', loop: 'cyt', at: { x: CHAIN.III, y: 268 }, group: 'cyt' },
          { role: 'cytB', to: 'loop', loop: 'cyt', at: { x: CHAIN.III, y: 268 }, group: 'cyt' },
          { role: 'hA', to: 'reservoir', at: { x: CHAIN.III - 22, y: 268 } },
          { role: 'hB', to: 'reservoir', at: { x: CHAIN.III + 22, y: 268 } },
        ],
        pump: 2,
      }],
      docks: {
        qh2: dock({ x: CHAIN.III + 16, y: STRIP_Y }, 'qh2', ['q']),
        cytA: dock({ x: CHAIN.III - 12, y: 262 }, 'cytc', ['cyt']),
        cytB: dock({ x: CHAIN.III + 12, y: 262 }, 'cytc', ['cyt']),
      },
    },
    {
      ...complex4,
      store: { cap: 4 },
      modes: [
        {
          reaction: 'cytdeliver',
          when: 'storeNotFull',
          times: { load: 0.15, work: 0.2, unload: 0.15 },
          inputs: [{ role: 'cyt', from: 'dock', dock: 'cyt' }],
          outputs: [{ role: 'cyt', to: 'loop', loop: 'cyt', at: { x: CHAIN.IV, y: 268 } }, { role: 'e', to: 'store' }],
        },
        {
          reaction: 'oxidase',
          when: 'storeFull',
          inputs: [
            { role: 'e1', from: 'store' }, { role: 'e2', from: 'store' }, { role: 'e3', from: 'store' }, { role: 'e4', from: 'store' },
            { role: 'o2', from: 'dock', dock: 'o2' },
            { role: 'h1', from: 'bulk', at: { x: CHAIN.IV - 30, y: 352 } },
            { role: 'h2', from: 'bulk', at: { x: CHAIN.IV - 10, y: 360 } },
            { role: 'h3', from: 'bulk', at: { x: CHAIN.IV + 10, y: 360 } },
            { role: 'h4', from: 'bulk', at: { x: CHAIN.IV + 30, y: 352 } },
          ],
          outputs: [{ role: 'waterA', to: 'exhaust', drift: 'complex4' }, { role: 'waterB', to: 'exhaust', drift: 'complex4' }],
          pump: 4,
        },
      ],
      docks: {
        cyt: dock({ x: CHAIN.IV, y: 262 }, 'cytcr', ['cyt']),
        o2: dock({ x: CHAIN.IV, y: 352 }, 'oxygen', [], { drift: 'o2' }),
      },
    },
    atpSynthase(),
    {
      ...ant,
      modes: [{
        reaction: 'ant',
        inputs: [
          { role: 'atpIn', from: 'dock', dock: 'atp' },
          { role: 'adpIn', from: 'dock', dock: 'adp' },
          { role: 'piIn', from: 'dock', dock: 'pi' },
        ],
        outputs: [
          { role: 'atpOut', to: 'loop', loop: 'export', at: edge.bottom(ant, 8) },
          { role: 'adpOut', to: 'loop', loop: 'source:atp', at: edge.top(ant), group: 'adpPi' },
          { role: 'piOut', to: 'loop', loop: 'source:atp', at: edge.top(ant), group: 'adpPi' },
        ],
      }],
      // ATP waits on the matrix face, side by side; ADP and phosphate wait in
      // pairs in the cytosol, left of the export loop.
      docks: {
        atp: dock({ x: ant.x, y: 899 }, 'atp', ['syn', 'bus'], { buffer: 1, places: [{ x: ant.x, y: 899 }, { x: ant.x + 75, y: 899 }] }),
        adp: dock({ x: 1360, y: 977 }, 'adp', ['export'], { buffer: 1, places: [{ x: 1360, y: 977 }, { x: 1360, y: 1041 }] }),
        pi: dock({ x: 1360, y: 1007 }, 'pi', ['export'], { buffer: 1, places: [{ x: 1360, y: 1007 }, { x: 1360, y: 1071 }] }),
      },
    },
    {
      ...workM,
      demand: 'clock',
      modes: [{
        reaction: 'cell-work',
        inputs: [{ role: 'atp', from: 'dock', dock: 'atp' }, { role: 'water', from: 'bulk', at: edge.left(workM) }],
        outputs: [{ role: 'adp', to: 'loop', loop: 'source:atp', at: edge.top(workM), group: 'adpPi' }, { role: 'pi', to: 'loop', loop: 'source:atp', at: edge.top(workM), group: 'adpPi' }, { role: 'h', to: 'bulk', at: edge.right(workM) }],
      }],
      docks: { atp: dock({ x: workM.x - 36, y: workM.y - 44 }, 'atp', ['export', 'glyco'], { buffer: 1, places: [{ x: workM.x - 36, y: workM.y - 44 }, { x: workM.x + 36, y: workM.y - 44 }] }) },
    },
  ];

  if (fermentKind === 'lactic') {
    stations.push({
      ...ldh,
      modes: [{
        reaction: 'ldh',
        inputs: [
          { role: 'pyr', from: 'belt', belts: ['pyr-ferm'] },
          { role: 'nadh', from: 'dock', dock: 'nadh' },
          { role: 'h', from: 'bulk', at: edge.top(ldh) },
        ],
        outputs: [
          { role: 'lac', to: 'exhaust', drift: 'ldh' },
          { role: 'nad', to: 'loop', loop: 'nadc', at: edge.bottom(ldh, 18) },
        ],
      }],
      docks: { nadh: dock(edge.bottom(ldh, -12), 'nadh', ['nadc'], { when: 'substrate' }) },
    });
  } else {
    stations.push({
      ...pdc,
      modes: [{
        reaction: 'pdc',
        inputs: [
          { role: 'pyr', from: 'belt', belts: ['pyr-ferm'] },
          { role: 'h', from: 'bulk', at: edge.bottom(pdc) },
        ],
        outputs: [
          { role: 'ald', to: 'belt', belt: 'pdc-adh' },
          { role: 'co2', to: 'exhaust', drift: 'pdc' },
        ],
      }],
    }, {
      ...adh,
      modes: [{
        reaction: 'adh',
        inputs: [
          { role: 'ald', from: 'belt', belts: ['pdc-adh'] },
          { role: 'nadh', from: 'dock', dock: 'nadh' },
          { role: 'h', from: 'bulk', at: edge.top(adh, 30) },
        ],
        outputs: [
          { role: 'eth', to: 'exhaust', drift: 'adh' },
          { role: 'nad', to: 'loop', loop: 'nadc', at: edge.bottom(adh, 18) },
        ],
      }],
      docks: { nadh: dock(edge.bottom(adh, -12), 'nadh', ['nadc'], { when: 'substrate' }) },
    });
  }

  const loops = { bus, q: qLoop, cyt: cytLoop, syn: synLoop, export: exportLoop, nadc: nadLoop, glyco: glycoLoop };
  attachTaps(stations, loops);
  const stubs = () => makeStubs(stations, loops);

  const fermentRight = fermentEnd.x + fermentEnd.w / 2 + 20;
  const zones = [
    {
      id: 'glycolysis',
      name: 'Glycolysis',
      token: 'zone-glycolysis',
      path: zonePath([{ x: 210, y: 1042 + DY }, { x: 1384, y: 1042 + DY }, { x: 1384, y: 1418 + DY }, { x: 210, y: 1418 + DY }]),
      label: { x: 230, y: 1062 + DY, align: 'left' },
    },
    {
      id: 'ferment',
      name: fermentKind === 'lactic' ? 'Lactic Acid Fermentation' : 'Ethanol Fermentation',
      token: 'zone-ferment',
      path: zonePath([{ x: 398, y: 1024 }, { x: fermentRight, y: 1024 }, { x: fermentRight, y: 1120 }, { x: 398, y: 1120 }], 18),
      label: { x: fermentRight + 12, y: FERM_Y, align: 'left' },
    },
    {
      id: 'oxidation',
      name: 'Pyruvate Oxidation',
      token: 'zone-oxidation',
      path: zonePath([{ x: 962, y: 724 }, { x: 1118, y: 724 }, { x: 1118, y: 956 }, { x: 962, y: 956 }], 18),
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
        { x: 140, y: 140 }, { x: 1580, y: 140 }, { x: 1580, y: 460 }, { x: 1120, y: 460 },
        { x: 1120, y: 324 }, { x: 692, y: 324 }, { x: 692, y: 342 }, { x: 588, y: 342 }, { x: 588, y: 324 },
        { x: 400, y: 324 }, { x: 400, y: 412 }, { x: 140, y: 412 },
      ], 18),
      label: { x: 158, y: 160, align: 'left' },
      parts: [
        { name: 'Electron Transport Chain', x: (CHAIN.I + CHAIN.IV) / 2, y: 196 },
        { name: 'Chemiosmosis', x: CHAIN.SYN, y: 196 },
      ],
    },
  ];

  const pores = [
    { id: 'glut', name: 'Glucose transporter', short: 'GLUT', x: 0, y: TRAY.glucose.y, membrane: 'cell', w: 26, h: 30 },
    { id: 'vdac', name: 'Porin', short: 'VDAC', x: pdh.x, y: outer.y + outer.h, membrane: 'outer', w: 30, h: 12, pair: 'mpc' },
    { id: 'mpc', name: 'Pyruvate carrier', short: 'MPC', x: pdh.x, y: inner.y + inner.h, membrane: 'inner', w: 30, h: 12 },
  ];
  if (fermentKind === 'lactic') {
    pores.splice(1, 0, { id: 'mct', name: 'Lactate transporter', short: 'MCT', x: 0, y: ldh.y + 20, membrane: 'cell', w: 26, h: 30 });
  }

  const labels = [
    { text: 'Cytosol', x: 1690, y: 150, kind: 'compartment' },
    { text: 'Nucleus', x: 1655, y: 1355 + DY, kind: 'compartment' },
    { text: 'Mitochondrion', x: 1460, y: 92, kind: 'compartment' },
    { text: 'Intermembrane space', x: 1060, y: 160, kind: 'compartment' },
    { text: 'Matrix', x: 236, y: 780, kind: 'compartment' },
    { text: 'Inner membrane', x: 800, y: STRIP_Y, kind: 'membrane', lod: 'mid' },
    { text: 'Investment Phase', x: 1060, y: 1400 + DY, kind: 'phase', token: 'zone-glycolysis' },
    { text: 'Payoff Phase', x: 710, y: 1300, kind: 'phase', token: 'zone-glycolysis' },
  ];

  const cell = { type: 'roundRect', x: 0, y: 0, w: 1800, h: CELL_H, r: 170 };
  const reservoir = {
    name: 'intermembrane space',
    x1: inner.x + 12,
    x2: inner.x + inner.w - 12,
    y1: inner.y + 8,
    y2: STRIP_Y - STRIP_HALF - 6,
    within: { type: 'roundRect', x: inner.x + 10, y: inner.y + 10, w: inner.w - 20, h: inner.h - 20, r: inner.r - 10 },
  };

  return {
    id: options.id,
    organism: options.organism,
    bounds: { x: -10, y: -10, w: 1820, h: CELL_H + 20 },
    cell: { id: 'cytosol', name: 'Cytosol', fill: 'cytosol', stroke: 'ink', strokeWidth: 1.25, shape: cell },
    nucleus: {
      id: 'nucleus',
      name: 'Nucleus',
      fill: 'paper',
      stroke: 'ink-soft',
      strokeWidth: 1.15,
      shape: { type: 'ellipse', cx: 1655, cy: 1355 + DY, rx: 100, ry: 72 },
    },
    mitochondrion: {
      id: 'mitochondrion',
      outer,
      inner,
      strip: { y: STRIP_Y, half: STRIP_HALF, x1: inner.x, x2: inner.x + inner.w },
      reservoir,
    },
    reservoir,
    stations,
    belts,
    loops,
    stubs: stubs(),
    drifts,
    lanes: [{ id: 'o2', drift: 'o2', name: 'O₂' }],
    // What the engine pulls in, and what keeps the cell alive (M6 plan §4.1).
    feed: GLUCOSE_FEED,
    supplies: [{ id: 'oxygen', species: 'oxygen', lane: 'o2', arrive: 'arriveOxygen', station: 'complex4', dock: 'o2' }],
    skeletons: CYCLE_SKELETONS,
    life: { kind: 'demand', clock: 'workm' },
    gauges: ['atp', 'protons'],
    zones,
    pores,
    labels,
    tray: TRAY,
    chain: CHAIN,
    ring: RING,
    brownFatLabel: { x: 900, y: 60 },
    uncoupler: {
      dnp: { x: UNCOUPLER_X, y: STRIP_Y },
      ucp1: { x: UNCOUPLER_X, y: STRIP_Y },
    },
    matrixCrossings: [
      { a: 'pyruvate', b: 'bus' },
      { a: 'pdh-cs', b: 'bus' },
    ],
    params: options.params,
  };
}
