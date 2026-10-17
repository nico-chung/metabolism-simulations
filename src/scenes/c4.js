// A C4 leaf, NADP-malic enzyme type (maize, sugarcane), as data (M7a, M6
// plan §3.5, §13.2). Kranz anatomy, drawn left to right: a vein (xylem and
// phloem), the bundle-sheath cell that wraps it, and a mesophyll cell under
// the stoma. The mesophyll chloroplast holds the light reactions (C3's
// compact strip, shifted right) and the CO₂ pump; the bundle-sheath
// chloroplast holds the Calvin cycle, at exactly C3's place, with no
// thylakoid stacks (it is agranal in maize).
//
// The pump: PEP carboxylase fixes CO₂ in the mesophyll cytosol, oxaloacetate
// is reduced to malate in the chloroplast, malate crosses the plasmodesmata,
// and NADP-malic enzyme releases the same carbon as CO₂ into the bundle
// sheath's own small gas pool, right beside RuBisCO. Pyruvate goes back and
// PPDK makes PEP again. The PEP–OAA–malate–pyruvate backbone circulates like
// the citric acid cycle's skeletons; only carbon 4 is added and removed.
//
// ATP and NADPH reach the bundle sheath on the stroma bus, which runs from
// the mesophyll chloroplast through both cells: a labelled stand-in. Real
// bundle-sheath chloroplasts make their own ATP with photosystem I and
// cyclic flow (M6 plan §3.5; model note).

import { BUS, C3_RING, PEROXISOME, calvinCycle, lightReactions } from './c3.js';
import { inEllipse, inRoundRect } from './geometry.js';
import { attachTaps, belt, box, circleZone, dock, drift, edge, loop, makeStubs, zonePath } from './parts.js';
import { LEAF, STRIP_HALF, STRIP_Y } from './plant.js';

// The mesophyll is C3's cell, shifted right.
export const DXM = 1460;

const shift = (shape, dx) => ({ ...shape, x: shape.x + dx });

const BS_CELL = {
  name: 'bundle sheath',
  cell: LEAF.cell,
  wall: LEAF.wall,
  chloroplast: LEAF.chloroplast,
  nucleus: { type: 'ellipse', cx: 1150, cy: 1250, rx: 84, ry: 60 },
};

// It is shorter than the bundle sheath: its chloroplast holds only the
// strip and the pump, with the vacuole and nucleus beneath.
const M_CELL = {
  name: 'mesophyll',
  cell: { ...shift(LEAF.cell, DXM), h: 1220 },
  wall: { ...shift(LEAF.wall, DXM), h: 1248 },
  chloroplast: {
    outer: { ...shift(LEAF.chloroplast.outer, DXM), h: 800 },
    inner: { ...shift(LEAF.chloroplast.inner, DXM), h: 776 },
  },
  sac: { x1: LEAF.sac.x1 + DXM, x2: LEAF.sac.x2 + DXM, roof: LEAF.sac.roof },
  grana: [[2630, 590], [2685, 710], [2560, 820]],
  vacuole: { type: 'roundRect', x: 2300, y: 990, w: 480, h: 210, r: 90 },
  nucleus: { type: 'ellipse', cx: 1720, cy: 1110, rx: 92, ry: 64 },
};

// The vein the bundle sheath wraps: xylem above, phloem below.
const VEIN = {
  shape: { type: 'roundRect', x: -250, y: 60, w: 216, h: 1300, r: 90 },
  xylem: { type: 'roundRect', x: -226, y: 110, w: 160, h: 560, r: 70 },
  phloem: { type: 'roundRect', x: -226, y: 760, w: 160, h: 560, r: 70 },
};

export const LEAF4 = {
  bounds: { x: -262, y: -500, w: 3124, h: 1990 },
  epidermis: LEAF.epidermis,
  stoma: { ...LEAF.stoma, x: LEAF.stoma.x + DXM },
  wall: LEAF.wall,
  cells: [BS_CELL, M_CELL],
  vein: VEIN,
};

// The bundle sheath's own gas pool: the stroma above its ring, where malic
// enzyme's CO₂ gathers beside RuBisCO.
const SHEATH = { x1: 290, x2: 1180, y1: 186, y2: 372 };

function sacShapeOf(cell) {
  const { x1, x2, roof } = cell.sac;
  return { type: 'roundRect', x: x1, y: roof, w: x2 - x1, h: STRIP_Y + STRIP_HALF - roof, r: 22 };
}

// The inspector's words for where a point is.
export function c4Place(x, y) {
  if (y < LEAF4.epidermis.y1) return 'in the air outside the leaf';
  if (y <= LEAF4.epidermis.y2) return Math.abs(x - LEAF4.stoma.x) < 20 ? 'in the stoma' : 'in the epidermis';
  if (inRoundRect(VEIN.shape, x, y)) {
    if (inRoundRect(VEIN.xylem, x, y)) return 'in the xylem of the vein';
    if (inRoundRect(VEIN.phloem, x, y)) return 'in the phloem of the vein';
    return 'in the vein';
  }
  for (const cell of [BS_CELL, M_CELL]) {
    if (!inRoundRect(cell.wall, x, y)) continue;
    const of = `(${cell.name})`;
    if (!inRoundRect(cell.cell, x, y)) return `in the cell wall ${of}`;
    if (inEllipse(cell.nucleus, x, y)) return `in the nucleus ${of}`;
    if (cell.vacuole && inRoundRect(cell.vacuole, x, y)) return `in the vacuole ${of}`;
    if (cell === BS_CELL && inEllipse(PEROXISOME, x, y)) return 'in a peroxisome (bundle sheath)';
    const { outer, inner } = cell.chloroplast;
    if (inRoundRect(inner, x, y)) {
      if (cell.sac && inRoundRect(sacShapeOf(cell), x, y)) return y < STRIP_Y - STRIP_HALF ? `in the thylakoid lumen ${of}` : `in the thylakoid membrane ${of}`;
      return `in the stroma ${of}`;
    }
    if (inRoundRect(outer, x, y)) return `crossing the chloroplast envelope ${of}`;
    return `in the cytosol ${of}`;
  }
  if (x > BS_CELL.wall.x + BS_CELL.wall.w && x < M_CELL.wall.x && y > 40) return 'in the wall between the cells';
  return 'in the air space inside the leaf';
}

export function buildC4() {
  const strip = lightReactions(DXM);
  const { PSII, PSI, B6F, SYN } = strip.chain;
  const calvin = calvinCycle();
  const { pgpStation, hexose } = calvin;

  // The CO₂ pump ----------------------------------------------------------------

  // Mesophyll: PEP carboxylase in the cytosol; three transporters on the
  // chloroplast's left envelope; malate dehydrogenase and PPDK in the stroma.
  const ENV_M = M_CELL.chloroplast.outer.x + 6;
  const pepc = box('pepc', 1520, 520, 70, 56, { kind: 'enzyme', reaction: 'pepc', zone: 'pump', names: ['PEPC', 'PEP carboxylase'], times: { load: 0.25, work: 0.8, unload: 0.25 } });
  const ppt = box('ppt', ENV_M, 520, 30, 36, { kind: 'transport', reaction: 'ppt', zone: 'pump', names: ['PPT', 'PEP–phosphate translocator'], labelSide: 'right', times: { load: 0.25, work: 0.3, unload: 0.25 } });
  const omt = box('omt', ENV_M, 640, 30, 70, { kind: 'transport', reaction: 'omt', zone: 'pump', names: ['OMT', 'Oxaloacetate–malate translocator'], times: { load: 0.25, work: 0.3, unload: 0.25 } });
  const pyrIn = box('pyrin', ENV_M, 760, 30, 36, { kind: 'transport', reaction: 'pyr-in', zone: 'pump', names: ['Pyr', 'Pyruvate transporter'], times: { load: 0.25, work: 0.3, unload: 0.25 } });
  const mdh = box('mdh', 1730, 640, 70, 48, { kind: 'enzyme', reaction: 'mdh-nadp', zone: 'pump', names: ['MDH', 'NADP-malate dehydrogenase'], times: { load: 0.25, work: 0.7, unload: 0.25 } });
  const ppdk = box('ppdk', 1950, 650, 220, 110, {
    kind: 'compound', reaction: 'pump', zone: 'pump', names: ['PPDK', 'PPDK and recharge'],
    times: { load: 0.4, work: 2.4, unload: 0.4 },
    inner: {
      cols: 4,
      scale: 4,
      dy: 8,
      sites: {
        ppdk: { x: -60, y: 6, name: 'PPDK', below: true },
        adk: { x: 10, y: -14, name: 'Adenylate kinase' },
        ppase: { x: 70, y: 18, name: 'PPase', below: true },
      },
      steps: { ppdk: 'ppdk', adk: 'adk', ppase: 'ppase' },
      rest: {
        pep: { x: -92, y: 30 },
        adp1: { x: 40, y: -38 }, adp2: { x: 70, y: -38 },
        pi1: { x: 98, y: -10 }, pi2: { x: 98, y: 10 },
        h1: { x: -40, y: -40 }, h2: { x: 96, y: 36 },
      },
    },
  });

  // Plasmodesmata in the wall between the two cells: malate across into the
  // bundle sheath, pyruvate back.
  const WALL_X = (BS_CELL.wall.x + BS_CELL.wall.w + M_CELL.wall.x) / 2;
  const plasmo = box('plasmo', WALL_X, 730, 36, 110, { kind: 'transport', reaction: 'plasmo', zone: 'pump', names: ['PD', 'Plasmodesmata'], labelSide: 'below', times: { load: 0.3, work: 0.4, unload: 0.3 } });

  // Bundle sheath: the dicarboxylate transporter and the pyruvate exporter
  // on the chloroplast's right envelope, and malic enzyme in the stroma.
  const ENV_B = BS_CELL.chloroplast.outer.x + BS_CELL.chloroplast.outer.w - 6;
  const dit = box('dit', ENV_B, 700, 30, 36, { kind: 'transport', reaction: 'dit', zone: 'pump', names: ['DiT', 'Dicarboxylate transporter'], labelSide: 'above-left', times: { load: 0.25, work: 0.3, unload: 0.25 } });
  const pyrOut = box('pyrout', ENV_B, 760, 30, 36, { kind: 'transport', reaction: 'pyr-out', zone: 'pump', names: ['Pyr', 'Pyruvate exporter'], times: { load: 0.25, work: 0.3, unload: 0.25 } });
  const me = box('me', 1150, 730, 88, 60, { kind: 'enzyme', reaction: 'me', zone: 'pump', names: ['ME', 'NADP-malic enzyme'], times: { load: 0.25, work: 0.8, unload: 0.25 } });

  const pumpBelts = [
    belt('ppt-pepc', [edge.left(ppt), edge.right(pepc)], { compartment: 'cytosol' }),
    belt('pepc-omt', [{ x: pepc.x - 15, y: pepc.y + pepc.h / 2 }, { x: pepc.x - 15, y: 628 }, { x: ENV_M - 15, y: 628 }], { radius: 8, compartment: 'cytosol' }),
    belt('omt-mdh', [{ x: ENV_M + 15, y: 628 }, { x: mdh.x - mdh.w / 2, y: 628 }], { compartment: 'stroma' }),
    belt('mdh-omt', [{ x: mdh.x - mdh.w / 2, y: 654 }, { x: ENV_M + 15, y: 654 }], { compartment: 'stroma' }),
    belt('omt-plasmo', [{ x: ENV_M - 15, y: 662 }, { x: 1500, y: 662 }, { x: 1500, y: 700 }, { x: plasmo.x + plasmo.w / 2, y: 700 }], { radius: 8, compartment: 'cytosol' }),
    belt('plasmo-dit', [{ x: plasmo.x - plasmo.w / 2, y: 700 }, edge.right(dit)], { compartment: 'cytosol' }),
    belt('dit-me', [edge.left(dit), { x: me.x + me.w / 2, y: 712 }], { compartment: 'stroma' }),
    belt('me-pyrout', [{ x: me.x + me.w / 2, y: 748 }, edge.left(pyrOut)], { compartment: 'stroma' }),
    belt('pyrout-plasmo', [edge.right(pyrOut), { x: plasmo.x - plasmo.w / 2, y: 760 }], { compartment: 'cytosol' }),
    belt('plasmo-pyrin', [{ x: plasmo.x + plasmo.w / 2, y: 760 }, edge.left(pyrIn)], { compartment: 'cytosol' }),
    belt('pyrin-ppdk', [edge.right(pyrIn), { x: 1880, y: 760 }, { x: 1880, y: ppdk.y + ppdk.h / 2 }], { radius: 10, compartment: 'stroma' }),
    belt('ppdk-ppt', [{ x: 1860, y: ppdk.y - ppdk.h / 2 }, { x: 1860, y: 520 }, edge.right(ppt)], { radius: 10, compartment: 'stroma' }),
  ];

  const pumpStations = [
    {
      ...pepc,
      modes: [{
        reaction: 'pepc',
        inputs: [
          { role: 'pep', from: 'belt', belts: ['ppt-pepc'] },
          { role: 'co2', from: 'dock', dock: 'gas' },
          { role: 'water', from: 'bulk', at: { x: pepc.x, y: pepc.y + 44 } },
        ],
        outputs: [
          { role: 'oaa', to: 'belt', belt: 'pepc-omt' },
          { role: 'pi', to: 'loop', loop: 'picm', at: { x: 1572, y: 570 } },
          { role: 'h', to: 'bulk', at: { x: pepc.x + 24, y: pepc.y + 44 } },
        ],
      }],
      docks: { gas: dock({ x: 1466, y: 520 }, 'co2', [], { buffer: 1, places: [{ x: 1466, y: 520 }, { x: 1462, y: 488 }] }) },
    },
    {
      ...ppt,
      modes: [{
        reaction: 'ppt',
        inputs: [{ role: 'pepIn', from: 'belt', belts: ['ppdk-ppt'] }, { role: 'piIn', from: 'dock', dock: 'pi' }],
        outputs: [{ role: 'pepOut', to: 'belt', belt: 'ppt-pepc' }, { role: 'piOut', to: 'loop', loop: 'sbus', at: { x: ENV_M + 40, y: BUS.topIn } }],
      }],
      docks: { pi: dock({ x: 1592, y: 548 }, 'pi', ['picm']) },
    },
    {
      ...omt,
      modes: [{
        reaction: 'omt',
        inputs: [{ role: 'oaaIn', from: 'belt', belts: ['pepc-omt'] }, { role: 'malIn', from: 'belt', belts: ['mdh-omt'] }],
        outputs: [{ role: 'oaaOut', to: 'belt', belt: 'omt-mdh' }, { role: 'malOut', to: 'belt', belt: 'omt-plasmo' }],
      }],
    },
    {
      ...pyrIn,
      modes: [{
        reaction: 'pyr-in',
        inputs: [{ role: 'pyrIn', from: 'belt', belts: ['plasmo-pyrin'] }],
        outputs: [{ role: 'pyrOut', to: 'belt', belt: 'pyrin-ppdk' }],
      }],
    },
    {
      ...mdh,
      modes: [{
        reaction: 'mdh-nadp',
        inputs: [
          { role: 'oaa', from: 'belt', belts: ['omt-mdh'] },
          { role: 'nadph', from: 'dock', dock: 'nadph' },
          { role: 'h', from: 'bulk', at: { x: mdh.x + 40, y: mdh.y + 30 } },
        ],
        outputs: [
          { role: 'mal', to: 'belt', belt: 'mdh-omt' },
          { role: 'nadp', to: 'loop', loop: 'sbus', at: { x: mdh.x + 20, y: BUS.topIn } },
        ],
      }],
      docks: { nadph: dock({ x: mdh.x, y: 576 }, 'nadph', ['sbus']) },
    },
    {
      ...ppdk,
      modes: [{
        reaction: 'pump',
        inputs: [
          { role: 'pyr', from: 'belt', belts: ['pyrin-ppdk'] },
          { role: 'atp1', from: 'dock', dock: 'atp', slot: 0 },
          { role: 'atp2', from: 'dock', dock: 'atp', slot: 1 },
          { role: 'pi', from: 'dock', dock: 'pi' },
          { role: 'water', from: 'bulk', at: { x: ppdk.x + 60, y: ppdk.y + 70 } },
        ],
        outputs: [
          { role: 'pep', to: 'belt', belt: 'ppdk-ppt' },
          { role: 'adp1', to: 'loop', loop: 'sbus', at: { x: 2010, y: BUS.topIn } },
          { role: 'adp2', to: 'loop', loop: 'sbus', at: { x: 2040, y: BUS.topIn } },
          { role: 'pi1', to: 'loop', loop: 'sbus', at: { x: 2070, y: BUS.topIn } },
          { role: 'pi2', to: 'loop', loop: 'sbus', at: { x: 2100, y: BUS.topIn } },
          { role: 'h1', to: 'bulk', at: { x: ppdk.x - 40, y: ppdk.y - 70 } },
          { role: 'h2', to: 'bulk', at: { x: ppdk.x + 90, y: ppdk.y + 70 } },
        ],
      }],
      docks: {
        atp: dock({ x: 1930, y: 548 }, 'atp', ['sbus'], { count: 2, places: [{ x: 1896, y: 548 }, { x: 1958, y: 548 }] }),
        pi: dock({ x: 2034, y: 548 }, 'pi', ['sbus']),
      },
    },
    {
      ...plasmo,
      modes: [{
        reaction: 'plasmo',
        inputs: [{ role: 'malIn', from: 'belt', belts: ['omt-plasmo'] }, { role: 'pyrIn', from: 'belt', belts: ['pyrout-plasmo'] }],
        outputs: [{ role: 'malOut', to: 'belt', belt: 'plasmo-dit' }, { role: 'pyrOut', to: 'belt', belt: 'plasmo-pyrin' }],
      }],
    },
    {
      ...dit,
      modes: [{ reaction: 'dit', inputs: [{ role: 'malIn', from: 'belt', belts: ['plasmo-dit'] }], outputs: [{ role: 'malOut', to: 'belt', belt: 'dit-me' }] }],
    },
    {
      ...me,
      modes: [{
        reaction: 'me',
        inputs: [{ role: 'mal', from: 'belt', belts: ['dit-me'] }, { role: 'nadp', from: 'dock', dock: 'nadp' }],
        outputs: [
          { role: 'pyr', to: 'belt', belt: 'me-pyrout' },
          // The CO₂ joins the bundle sheath's own pool, beside RuBisCO.
          { role: 'co2', to: 'gas', pool: 'sheath', at: { x: me.x, y: me.y - me.h / 2 } },
          { role: 'nadph', to: 'loop', loop: 'sbus', at: { x: BUS.right, y: me.y + 20 } },
        ],
      }],
      docks: { nadp: dock({ x: 1012, y: me.y - 10 }, 'nadp', ['sbus']) },
    },
    {
      ...pyrOut,
      modes: [{ reaction: 'pyr-out', inputs: [{ role: 'pyrIn', from: 'belt', belts: ['me-pyrout'] }], outputs: [{ role: 'pyrOut', to: 'belt', belt: 'pyrout-plasmo' }] }],
    },
  ];

  // Loops ---------------------------------------------------------------------------

  // The stroma bus runs from the mesophyll chloroplast, where ATP and NADPH
  // are made, through both cells to the bundle sheath's ring: C3's bus with
  // its open end stretched across (the stand-in link).
  const END = BUS.end + DXM;
  const loops = {
    ...strip.loops,
    sbus: loop('sbus', [
      { x: END, y: BUS.topIn }, { x: BUS.rightIn, y: BUS.topIn }, { x: BUS.rightIn, y: BUS.bottomIn },
      { x: BUS.leftIn, y: BUS.bottomIn }, { x: BUS.leftIn, y: BUS.start }, { x: BUS.left, y: BUS.start },
      { x: BUS.left, y: BUS.bottom }, { x: BUS.right, y: BUS.bottom }, { x: BUS.right, y: BUS.top }, { x: END, y: BUS.top },
    ], 15, { name: 'ATP and NADPH (stand-in link)', compartment: 'stroma', tint: 'carrier-nad', hot: true, standIn: true, speed: 460 }),
    pic: loop('pic', [
      { x: 790, y: 1078 }, { x: 860, y: 1078 }, { x: 860, y: 1200 }, { x: 790, y: 1200 },
    ], 14, { name: 'Phosphate', compartment: 'cytosol', tint: 'carrier-adenosine' }),
    picm: loop('picm', [
      { x: 1572, y: 556 }, { x: 1598, y: 556 }, { x: 1598, y: 606 }, { x: 1572, y: 606 },
    ], 10, { name: 'Phosphate', compartment: 'cytosol', tint: 'carrier-adenosine' }),
  };

  // Cytochrome b₆f carries linear and cyclic flow here, about four pairs of
  // electrons per CO₂ against C3's two, so it turns over faster.
  const lightStations = strip.stations.map((def) => (def.id === 'b6f' ? { ...def, times: { load: 0.2, work: 0.3, unload: 0.2 } } : def));
  const stations = [...lightStations, ...calvin.stations, ...pumpStations];
  attachTaps(stations, loops);

  // Lanes, drifts and gases ------------------------------------------------------------

  // Glucose runs under hexose assembly and out of the bundle sheath
  // where its wall is straight, into the phloem.
  const EXPORT_Y = 1200;
  const GAS = { x1: -240, x2: 2820, y1: LEAF4.epidermis.y2 + 12, y2: LEAF4.wall.y - 22 };
  const STOMA_X = LEAF4.stoma.x;

  const TRAY = {
    water: { x: -146, y: 96 },
    co2: { x: STOMA_X - 10, y: -262 },
    prompt: { x: STOMA_X + 180, y: -282 },
  };

  const drifts = {
    // Water up the xylem, across the bundle sheath and into the mesophyll,
    // to photosystem II's water dock.
    h2o: drift([TRAY.water, { x: PSII - 90, y: TRAY.water.y }, { x: PSII - 90, y: 236 }, { x: PSII - 34, y: 252 }], 20),
    // CO₂ from the air space, down the mesophyll's cytosol to PEP carboxylase.
    co2: drift([{ x: 1458, y: GAS.y1 + 20 }, { x: 1458, y: 488 }], 24),
    o2: drift([{ x: PSII + 30, y: 262 }, { x: PSII + 90, y: 230 }, { x: PSII + 90, y: -40 }], 40),
    arriveWater: drift([{ x: -146, y: 520 }, TRAY.water]),
    arriveCo2: drift([{ x: STOMA_X - 10, y: -600 }, TRAY.co2]),
    glycolate: Object.assign(drift([edge.left(pgpStation), { x: 166, y: 478 }, { x: PEROXISOME.cx, y: PEROXISOME.cy }], 10), { fade: 50 }),
    // Glucose leaves the bundle sheath into the phloem of the vein.
    sugar: Object.assign(drift([edge.bottom(hexose), { x: hexose.x, y: 1304 }, { x: 170, y: 1304 }, { x: 170, y: EXPORT_Y }, { x: VEIN.phloem.x + VEIN.phloem.w / 2, y: EXPORT_Y }, { x: VEIN.phloem.x + VEIN.phloem.w / 2, y: 1300 }], 30), { fade: 90 }),
  };

  // Zones and labels ----------------------------------------------------------------------

  const zones = [
    strip.zone,
    {
      id: 'calvin',
      name: 'Calvin Cycle',
      token: 'zone-krebs',
      path: circleZone(C3_RING.x, C3_RING.y, 270, 400),
      label: { x: C3_RING.x, y: C3_RING.y - 10, align: 'center' },
    },
    {
      id: 'pump',
      name: 'CO₂ Pump',
      token: 'zone-pump',
      path: zonePath([{ x: 1086, y: 488 }, { x: 2076, y: 488 }, { x: 2076, y: 800 }, { x: 1086, y: 800 }], 22),
      label: { x: 1100, y: 830, align: 'left' },
    },
    {
      id: 'export',
      name: 'Sugar Export',
      token: 'zone-glycolysis',
      path: zonePath([{ x: 480, y: 1010 }, { x: 880, y: 1010 }, { x: 880, y: 1300 }, { x: 480, y: 1300 }], 22),
      label: { x: 470, y: 1100, align: 'right' },
    },
  ];

  const labels = [
    { text: 'Air Space', x: 700, y: -70, kind: 'compartment' },
    { text: 'Upper epidermis', x: 2300, y: -175, kind: 'membrane', lod: 'mid' },
    { text: 'Stoma', x: STOMA_X + 72, y: -175, kind: 'membrane', lod: 'mid' },
    { text: 'Bundle-Sheath Cell', x: 1150, y: 1350, kind: 'compartment' },
    { text: 'Mesophyll Cell', x: 2060, y: 1230, kind: 'compartment' },
    { text: 'Vein', x: -146, y: 40, kind: 'compartment' },
    { text: 'Xylem', x: -146, y: 390, kind: 'compartment', lod: 'mid' },
    { text: 'Phloem', x: -146, y: 1040, kind: 'compartment', lod: 'mid' },
    { text: 'Chloroplast', x: 1150, y: 1082, kind: 'compartment' },
    { text: 'Chloroplast', x: 2610, y: 962, kind: 'compartment' },
    { text: 'Thylakoid Lumen', x: 740 + DXM, y: 222, kind: 'compartment' },
    { text: 'Thylakoid membrane', x: (B6F + PSI) / 2 - 2, y: STRIP_Y, kind: 'membrane', lod: 'mid' },
    { text: 'Peroxisome', x: PEROXISOME.cx, y: PEROXISOME.cy + PEROXISOME.ry + 16, kind: 'compartment', lod: 'mid' },
    { text: 'ATP and NADPH (stand-in link)', x: WALL_X, y: BUS.top - 26, kind: 'membrane', lod: 'mid' },
    { text: 'Carboxylation', x: C3_RING.x, y: C3_RING.y - 72, kind: 'phase', token: 'zone-krebs' },
    { text: 'Reduction', x: C3_RING.x + 70, y: C3_RING.y + 40, kind: 'phase', token: 'zone-krebs' },
    { text: 'Regeneration', x: C3_RING.x + 30, y: C3_RING.y + 112, kind: 'phase', token: 'zone-krebs' },
  ];

  const pores = [
    { id: 'export-port', name: 'Sugar export (to the phloem)', short: 'Export', x: LEAF.cell.x, y: EXPORT_Y, membrane: 'chloroplast', w: 28, h: 30 },
    { id: 'salvage', name: 'Glycolate transporter', short: 'PLGG1', x: 166, y: 478, membrane: 'chloroplast', w: 28, h: 30, quiet: true, label: 'above' },
  ];

  const ring = {
    ...C3_RING,
    belts: ['regen-rubisco', 'rubisco-pgk', 'pgk-gapdh', 'gapdh-junction', 'junction-regen'],
    stations: ['rubisco', 'pgk', 'gapdh', 'regen'],
  };

  return {
    id: 'c4',
    tab: 'photosynthesis',
    pathway: 'c4',
    bounds: LEAF4.bounds,
    leaf: LEAF4,
    place: c4Place,
    peroxisome: PEROXISOME,
    fadeTop: LEAF4.epidermis.y1 - 20,
    fadeBottom: LEAF4.bounds.y + LEAF4.bounds.h,
    stations,
    belts: [...calvin.belts, ...pumpBelts],
    loops,
    stubs: makeStubs(stations, loops),
    drifts,
    lanes: [
      { id: 'h2o', drift: 'h2o', name: 'H₂O', supply: 'water' },
      { id: 'co2', drift: 'co2', name: 'CO₂' },
    ],
    supplies: [
      { id: 'water', species: 'water', lane: 'h2o', arrive: 'arriveWater', station: 'psii', dock: 'h2o', ahead: 6 },
    ],
    gas: {
      region: GAS,
      ambient: { co2: 8, oxygen: 8 },
      conductance: 0.25,
      stoma: { x: STOMA_X, inner: LEAF4.epidermis.y2, outer: LEAF4.epidermis.y1, exit: -470 },
      trays: [{ id: 'co2', species: 'co2', arrive: 'arriveCo2' }],
      // The bundle sheath's pool: CO₂ that malic enzyme releases, about ten
      // times as concentrated as in the air space, and O₂ that seeps in
      // slowly from the air. No photosystem II makes O₂ here.
      inner: {
        sheath: {
          region: SHEATH,
          prime: { co2: 10, oxygen: 8 },
          cap: { co2: 12 },
          exchange: { oxygen: 0.08 },
          entry: [{ x: 760, y: -20 }, { x: 760, y: 100 }],
        },
      },
      draws: [
        // PEP carboxylase takes CO₂ from the air space, and never O₂.
        { station: 'pepc', dock: 'gas', species: ['co2'], route: [{ x: 1458, y: GAS.y1 + 20 }, { x: 1458, y: 470 }], lane: 'co2', ahead: 2 },
        // RuBisCO takes CO₂ or O₂ from the bundle sheath's pool (§3.4).
        { station: 'rubisco', dock: 'gas', pool: 'sheath', species: ['co2', 'oxygen'], specificity: 32, route: [], ahead: 2 },
      ],
    },
    // C4 needs 5 ATP to 2 NADPH per CO₂: photosystem I takes about twice the
    // photons of photosystem II, the extra for cyclic flow (§3.5).
    light: { psii: strip.light.psii, psi: { ...strip.light.psi, flux: 1.7 } },
    exportDrift: 'sugar',
    matrixCrossings: [{ a: 'export', b: 'sbus' }],
    zones,
    pores,
    labels,
    tray: TRAY,
    chain: { PSII, B6F, PSI, SYN },
    reservoir: {
      name: 'thylakoid lumen',
      x1: M_CELL.sac.x1 + 14,
      x2: M_CELL.sac.x2 - 14,
      y1: M_CELL.sac.roof + 8,
      y2: STRIP_Y - STRIP_HALF - 6,
      within: { type: 'roundRect', x: M_CELL.sac.x1 + 6, y: M_CELL.sac.roof + 6, w: M_CELL.sac.x2 - M_CELL.sac.x1 - 12, h: STRIP_Y - STRIP_HALF - M_CELL.sac.roof - 8, r: 16 },
    },
    ring,
    skeletons: [
      ['rubp', 'regen-rubisco', 2, 0.85],
      ['rubp', 'rubisco-pgk', 0],
      ['pg3', 'rubisco-pgk', 2, 0.8],
      ['bpg', 'pgk-gapdh', 2, 0.8],
      ['g3p', 'gapdh-junction', 1, 0.5],
      ['g3p', 'junction-regen', 4, 0.9],
      // The pump's backbones, spread round its belts.
      ['pep', 'ppt-pepc', 1, 0.5],
      ['oaa', 'pepc-omt', 1, 0.6],
      ['malate', 'mdh-omt', 1, 0.5],
      ['malate', 'omt-plasmo', 1, 0.6],
      ['malate', 'plasmo-dit', 1, 0.5],
      ['malate', 'dit-me', 1, 0.5],
      ['pyruvate', 'pyrout-plasmo', 1, 0.5],
      ['pyruvate', 'plasmo-pyrin', 1, 0.6],
      ['pyruvate', 'pyrin-ppdk', 1, 0.6],
      ['pep', 'ppdk-ppt', 1, 0.6],
    ],
    life: { kind: 'reserve', cap: 3, start: 2, drain: 0.003, starveAfter: 20 },
    gauges: ['reserve', 'protons'],
    ledger: {
      photons: 0, quenched: 0, split: 0, o2: 0, fixed: 0, glucose: 0, exported: 0, h2o: 0, co2: 0,
      atp: 0, atpSub: 0, atpOx: 0, atpPhoto: 0, atpUsed: 0, nadph: 0, nadphUsed: 0, cyclic: 0, oxygenated: 0, glycolate: 0,
      pumped: 0, released: 0,
    },
    params: {
      protons: 20,
      prime: {
        pq: [['pq', 9]],
        pc: [['pc', 10]],
        fd: [['fd', 9]],
        sbus: [['atp', 16], ['nadp', 6], ['adp', 12], ['nadph', 6], ['pi', 12]],
        pic: [['pi', 2]],
        picm: [['pi', 2]],
      },
    },
  };
}

export const c4Scene = buildC4();
