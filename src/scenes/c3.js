// A C3 leaf cell (rice, wheat, soybean), as data (M6 plan §5). The
// thylakoid strip reuses the mitochondrion's positions (D7): photosystem II
// at Complex I's x, cytochrome b₆f at Complex III's, photosystem I at
// Complex IV's, ATP synthase where it was. The lumen above the strip is the
// proton reservoir, the stroma below it the side where ATP and NADPH are
// made. The Calvin cycle hangs below the strip as the Krebs ring hangs
// below Complex II, turning clockwise as Campbell draws it: RuBisCO at the
// top, the reduction steps on the right, the junction at the bottom and
// Regeneration on the left. One G3P in six (by carbon balance) leaves
// through the triose phosphate translocator to hexose assembly in the
// cytosol, and glucose leaves the cell for the rest of the plant.

import {
  atpSynthase,
  attachTaps,
  belt,
  box,
  circleZone,
  dock,
  drift,
  edge,
  loop,
  makeStubs,
  zonePath,
} from './parts.js';
import { inEllipse } from './geometry.js';
import { LEAF, STRIP_HALF, STRIP_Y, leafPlace, lumenReservoir } from './plant.js';

// Ring enzymes are the Krebs ring's size, so the arcs between them hold a
// short queue (M6 plan §6.2).
const ENZ = { w: 88, h: 60 };
export const C3_RING = { x: 640, y: 620, r: 190 };

// A compact strip (M6.5 P4): the leaf no longer reuses the mitochondrion's
// x positions (D7); ids still line the two tabs up (counterparts.js).
export const STRIP = { PSII: 330, CYCLIC_X: 560, B6F: 640, PSI: 840, FNR_X: 975, SYN: 1120 };
const { PSII, B6F, PSI, SYN } = STRIP;
const LUMEN_FACE = STRIP_Y - STRIP_HALF;
const STROMA_FACE = STRIP_Y + STRIP_HALF;

// Lanes of the stroma bus (a two-lane U round the ring, like the matrix bus).
// Docks of the reduction enzymes sit between them and the bus.
const DOCK_X = 895;
// Phosphoglycolate phosphatase and the peroxisome glycolate leaves for (M7a).
const PGP = { x: 380, y: 478 };
export const PEROXISOME = { type: 'ellipse', cx: 64, cy: 478, rx: 40, ry: 34 };
export const BUS = { top: 440, topIn: 470, right: 970, rightIn: 940, bottom: 930, bottomIn: 900, left: 230, leftIn: 260, end: 1200, start: 560 };

function ringPoint(deg, r = C3_RING.r) {
  const a = (deg * Math.PI) / 180;
  return { x: C3_RING.x + Math.sin(a) * r, y: C3_RING.y - Math.cos(a) * r };
}

function onRing(id, reaction, deg, w = ENZ.w, h = ENZ.h, extra = {}) {
  const p = ringPoint(deg);
  return box(id, p.x, p.y, w, h, { kind: 'enzyme', reaction, zone: 'krebs', deg, times: { load: 0.25, work: 0.8, unload: 0.25 }, ...extra });
}

function exitDeg(station, toward) {
  const dir = Math.sign(toward - station.deg);
  for (let d = 0; d < 60; d += 0.25) {
    const p = ringPoint(station.deg + dir * d);
    if (Math.abs(p.x - station.x) > station.w / 2 + 0.5 || Math.abs(p.y - station.y) > station.h / 2 + 0.5) return station.deg + dir * d;
  }
  return station.deg + dir * 20;
}

function arc(fromDeg, toDeg) {
  const points = [];
  const steps = Math.max(4, Math.ceil(Math.abs(toDeg - fromDeg) / 3));
  for (let i = 0; i <= steps; i += 1) points.push(ringPoint(fromDeg + ((toDeg - fromDeg) * i) / steps));
  return points;
}

// The light reactions on the thylakoid strip (M6, compact since M6.5 P4),
// shifted right by dx. C3 draws them at dx 0; C4's mesophyll further right.
// `cyclicIdle` (C3 only, v1.1): seconds after which an unused cyclic route
// hands its plastoquinone back to the loop. C4 and CAM use the route every
// few seconds by day, and their tuned runs stay as they were.
export function lightReactions(dx = 0, { cyclicIdle = null } = {}) {
  const PSII = STRIP.PSII + dx;
  const CYCLIC_X = STRIP.CYCLIC_X + dx;
  const B6F = STRIP.B6F + dx;
  const PSI = STRIP.PSI + dx;
  const FNR_X = STRIP.FNR_X + dx;
  const SYN = STRIP.SYN + dx;

  const psii = box('psii', PSII, STRIP_Y, 120, 64, {
    kind: 'complex', shape: 'PS', reaction: 'psii-pq', zone: 'oxphos', names: ['PSII', 'Photosystem II'],
    store: { cap: 4, prime: 4, origin: 'the leaf’s water', smooth: true },
    storeAt: { x: PSII - 14, y: LUMEN_FACE + 6 },
    lightCap: 2,
    antenna: { x: PSII - 44, y: STRIP_Y },
  });
  const b6f = box('b6f', B6F, STRIP_Y, 92, 64, {
    kind: 'complex', shape: 'III', reaction: 'b6f', zone: 'oxphos', names: ['b₆f', 'Cytochrome b₆f'],
    times: { load: 0.3, work: 0.4, unload: 0.3 },
  });
  const cyclicSite = box('cyclic', CYCLIC_X, STRIP_Y, 40, 40, {
    kind: 'complex', shape: 'site', reaction: 'cyclic', zone: 'oxphos', names: ['Cyclic', 'Cyclic route'], labelSide: 'below',
    store: { cap: 2, smooth: true },
    times: { load: 0.2, work: 0.4, unload: 0.2 },
  });
  const psi = box('psi', PSI, STRIP_Y, 100, 64, {
    kind: 'complex', shape: 'PS', reaction: 'psi', zone: 'oxphos', names: ['PSI', 'Photosystem I'],
    lightCap: 2,
    antenna: { x: PSI - 38, y: STRIP_Y },
    times: { load: 0.1, work: 0.2, unload: 0.1 },
  });
  const fnr = box('fnr', FNR_X, 385, 64, 40, {
    kind: 'complex', shape: 'blob', reaction: 'fnr', zone: 'oxphos', names: ['FNR', 'NADP⁺ reductase'],
    store: { cap: 2, smooth: true },
    times: { load: 0.2, work: 0.4, unload: 0.2 },
  });

  const lightStations = [
    {
      ...psii,
      modes: [
        {
          reaction: 'psii-pq',
          when: 'storeAtLeast',
          atLeast: 2,
          times: { load: 0.2, work: 0.4, unload: 0.2 },
          inputs: [
            { from: 'light', count: 2 },
            { role: 'e1', from: 'store' }, { role: 'e2', from: 'store' },
            { role: 'pq', from: 'dock', dock: 'pq' },
            { role: 'h1', from: 'bulk', at: { x: PSII - 14, y: 352 } },
            { role: 'h2', from: 'bulk', at: { x: PSII + 14, y: 352 } },
          ],
          outputs: [{ role: 'pqh2', to: 'loop', loop: 'pq', at: { x: PSII + 20, y: STRIP_Y - 7 } }],
        },
        {
          reaction: 'psii-split',
          when: 'storeEmpty',
          times: { load: 0.3, work: 0.6, unload: 0.3 },
          inputs: [{ role: 'wA', from: 'dock', dock: 'h2o', slot: 0 }, { role: 'wB', from: 'dock', dock: 'h2o', slot: 1 }],
          outputs: [
            { role: 'o2', to: 'exhaust', drift: 'o2', join: 'gas' },
            { role: 'h1', to: 'reservoir', at: { x: PSII + 10, y: 262 } },
            { role: 'h2', to: 'reservoir', at: { x: PSII + 22, y: 262 } },
            { role: 'h3', to: 'reservoir', at: { x: PSII + 34, y: 262 } },
            { role: 'h4', to: 'reservoir', at: { x: PSII + 46, y: 262 } },
            { role: 'e1', to: 'store' }, { role: 'e2', to: 'store' }, { role: 'e3', to: 'store' }, { role: 'e4', to: 'store' },
          ],
        },
      ],
      docks: {
        pq: dock({ x: PSII - 16, y: STRIP_Y }, 'pq', ['pq']),
        h2o: dock({ x: PSII - 22, y: 254 }, 'water', [], { count: 2, places: [{ x: PSII - 34, y: 252 }, { x: PSII - 8, y: 248 }] }),
      },
    },
    {
      ...cyclicSite,
      modes: [
        {
          reaction: 'cyclic-load',
          when: 'storeNotFull',
          times: { load: 0.15, work: 0.15, unload: 0.15 },
          inputs: [{ role: 'fd', from: 'dock', dock: 'fd' }],
          outputs: [{ role: 'fd', to: 'loop', loop: 'fd', at: { x: CYCLIC_X + 18, y: 330 } }, { role: 'e', to: 'store' }],
        },
        {
          reaction: 'cyclic',
          when: 'storeFull',
          inputs: [
            { role: 'e1', from: 'store' }, { role: 'e2', from: 'store' },
            { role: 'pq', from: 'dock', dock: 'pq' },
            { role: 'h1', from: 'bulk', at: { x: CYCLIC_X - 12, y: 360 } },
            { role: 'h2', from: 'bulk', at: { x: CYCLIC_X + 12, y: 360 } },
          ],
          outputs: [{ role: 'pqh2', to: 'loop', loop: 'pq', at: { x: CYCLIC_X + 14, y: STRIP_Y - 7 } }],
        },
      ],
      docks: {
        fd: dock({ x: CYCLIC_X - 6, y: 326 }, 'fdr', ['fd']),
        // In C3, held only while the route is in use: there it can rest for
        // minutes, and its plastoquinone looked stuck (v1.1).
        pq: dock({ x: CYCLIC_X - 14, y: STRIP_Y + 7 }, 'pq', ['pq'], cyclicIdle ? { idle: cyclicIdle } : {}),
      },
    },
    {
      ...b6f,
      modes: [{
        reaction: 'b6f',
        inputs: [
          { role: 'pqh2', from: 'dock', dock: 'pqh2' },
          { role: 'pcA', from: 'dock', dock: 'pc', slot: 0 },
          { role: 'pcB', from: 'dock', dock: 'pc', slot: 1 },
        ],
        outputs: [
          { role: 'pq', to: 'loop', loop: 'pq', at: { x: B6F - 20, y: STRIP_Y + 7 } },
          { role: 'pcA', to: 'loop', loop: 'pc', at: { x: B6F + 20, y: 258 }, group: 'pcPair' },
          { role: 'pcB', to: 'loop', loop: 'pc', at: { x: B6F + 20, y: 258 }, group: 'pcPair2' },
          { role: 'hA', to: 'reservoir', at: { x: B6F - 22, y: 262 } },
          { role: 'hB', to: 'reservoir', at: { x: B6F - 34, y: 262 } },
        ],
        pump: 2,
      }],
      docks: {
        pqh2: dock({ x: B6F - 16, y: STRIP_Y }, 'pqh2', ['pq']),
        pc: dock({ x: B6F + 14, y: 266 }, 'pc', ['pc'], { count: 2, places: [{ x: B6F + 8, y: 265 }, { x: B6F + 30, y: 265 }] }),
      },
    },
    {
      ...psi,
      modes: [{
        reaction: 'psi',
        inputs: [{ from: 'light', count: 1 }, { role: 'pc', from: 'dock', dock: 'pc' }, { role: 'fd', from: 'dock', dock: 'fd' }],
        outputs: [
          { role: 'pc', to: 'loop', loop: 'pc', at: { x: PSI - 24, y: 272 } },
          { role: 'fd', to: 'loop', loop: 'fd', at: { x: PSI + 26, y: 330 } },
        ],
      }],
      docks: {
        pc: dock({ x: PSI - 14, y: 266 }, 'pcr', ['pc'], { buffer: 1, places: [{ x: PSI - 14, y: 265 }, { x: PSI - 36, y: 265 }] }),
        fd: dock({ x: PSI - 6, y: 334 }, 'fd', ['fd'], { buffer: 1, places: [{ x: PSI - 6, y: 334 }, { x: PSI - 28, y: 334 }] }),
      },
    },
    {
      ...fnr,
      modes: [
        {
          reaction: 'fnr-load',
          when: 'storeNotFull',
          times: { load: 0.1, work: 0.1, unload: 0.1 },
          inputs: [{ role: 'fd', from: 'dock', dock: 'fd' }],
          outputs: [{ role: 'fd', to: 'loop', loop: 'fd', at: { x: FNR_X - 10, y: 344 } }, { role: 'e', to: 'store' }],
        },
        {
          reaction: 'fnr',
          when: 'storeFull',
          inputs: [
            { role: 'e1', from: 'store' }, { role: 'e2', from: 'store' },
            { role: 'nadp', from: 'dock', dock: 'nadp' },
            { role: 'h', from: 'bulk', at: { x: FNR_X - 38, y: 400 } },
          ],
          outputs: [{ role: 'nadph', to: 'loop', loop: 'sbus', at: { x: FNR_X + 26, y: BUS.top } }],
        },
      ],
      docks: {
        fd: dock({ x: FNR_X + 16, y: 352 }, 'fdr', ['fd'], { buffer: 1, places: [{ x: FNR_X + 16, y: 352 }, { x: FNR_X + 42, y: 352 }] }),
        nadp: dock({ x: FNR_X - 10, y: 418 }, 'nadp', ['sbus'], { buffer: 1, places: [{ x: FNR_X - 10, y: 418 }, { x: FNR_X - 50, y: 418 }] }),
      },
    },
  ];

  const synthase = atpSynthase(SYN);
  synthase.atpKind = 'photo';
  synthase.names = ['ATP synthase', 'ATP synthase (CF₀ and CF₁)'];
  synthase.modes[0].outputs[0] = { role: 'atp', to: 'loop', loop: 'sbus', at: { x: SYN, y: BUS.top } };
  synthase.modes[0].inputs[2].at = { x: SYN - 40, y: 405 };
  synthase.modes[0].outputs[1].at = { x: SYN - 40, y: 415 };
  synthase.docks.adp = dock({ x: SYN - 66, y: 412 }, 'adp', ['sbus'], { buffer: 1, places: [{ x: SYN - 66, y: 412 }, { x: SYN - 66, y: 382 }] });
  synthase.docks.pi = dock({ x: SYN + 62, y: 412 }, 'pi', ['sbus'], { buffer: 1, places: [{ x: SYN + 62, y: 412 }, { x: SYN + 62, y: 382 }] });

  const loops = {
    pq: loop('pq', [
      { x: PSII, y: STRIP_Y - 7 }, { x: B6F, y: STRIP_Y - 7 }, { x: B6F, y: STRIP_Y + 7 }, { x: PSII, y: STRIP_Y + 7 },
    ], 7, { name: 'Plastoquinone', compartment: 'membrane', tint: 'carrier-q', hot: true }),
    pc: loop('pc', [
      { x: B6F, y: 258 }, { x: PSI, y: 258 }, { x: PSI, y: 272 }, { x: B6F, y: 272 },
    ], 7, { name: 'Plastocyanin', compartment: 'lumen', tint: 'carrier-cyt', hot: true }),
    fd: loop('fd', [
      { x: CYCLIC_X - 20, y: 330 }, { x: FNR_X + 30, y: 330 }, { x: FNR_X + 30, y: 344 }, { x: CYCLIC_X - 20, y: 344 },
    ], 7, { name: 'Ferredoxin', compartment: 'stroma', tint: 'carrier-fd', hot: true }),
  };
  const zone = {
      id: 'light',
      name: 'Light Reactions',
      token: 'zone-oxphos',
      path: zonePath([{ x: 200, y: 150 }, { x: SYN + 120, y: 150 }, { x: SYN + 120, y: 420 }, { x: FNR_X - 60, y: 420 }, { x: FNR_X - 60, y: 366 }, { x: 200, y: 366 }], 18),
      label: { x: SYN + 110, y: 132, align: 'right' },
      parts: [
        { name: 'Photosystem II', x: PSII, y: 196, midOnly: true },
        { name: 'Electron Transport', x: (PSII + B6F) / 2 + 45, y: 196 },
        { name: 'Photosystem I', x: PSI + 20, y: 196, midOnly: true },
        { name: 'Chemiosmosis', x: SYN, y: 196 },
      ],
    };
  const light = {
    psii: { flux: 0.8, from: { x: PSII - 300, y: -480 }, antenna: psii.antenna, spread: 90 },
    psi: { flux: 0.9, from: { x: PSI - 300, y: -480 }, antenna: psi.antenna, spread: 90 },
  };
  return { stations: [...lightStations, synthase], loops, zone, light, chain: { PSII, CYCLIC_X, B6F, PSI, FNR_X, SYN } };
}

// The Calvin cycle as a ring in the stroma, with photorespiration, the
// triose phosphate translocator and hexose assembly (M6, M7a). C3 draws it
// under its strip; C4 draws it, at the same place, in the bundle sheath.
export function calvinCycle() {

  const rubisco = onRing('rubisco', 'rubisco', 0, ENZ.w, ENZ.h, { names: ['RuBisCO', 'RuBisCO'], times: { load: 0.3, work: 1.1, unload: 0.3 } });
  const pgk = onRing('pgk', 'calvin-pgk', 60, ENZ.w, ENZ.h, { names: ['PGK', 'Phosphoglycerate kinase'] });
  const gapdh = onRing('gapdh', 'calvin-gapdh', 120, ENZ.w, ENZ.h, { names: ['GAPDH', 'G3P dehydrogenase'] });
  const regen = onRing('regen', 'regen', 240, 270, 150, {
    kind: 'compound', names: ['Regen', 'Regeneration'],
    times: { load: 0.5, work: 4.5, unload: 0.5 },
    hopper: { belts: ['junction-regen'], species: 'g3p', count: 5, spacing: 48, dy: 52 },
    inner: {
      cols: 5,
      scale: 4,
      dy: -18,
      // The assembly line (M6.5 P5). Aldolase, FBPase, transketolase and
      // SBPase pass intermediates back and forth one step apart, so they sit
      // in a diamond in the middle, each a short glide from the next.
      // TPI takes trioses in at the left; RPI, RPE and PRK finish on the
      // right, and RuBP waits at the top left, near its exit. Aldolase and
      // transketolase each work twice, as in the real pathway.
      sites: {
        tpi: { x: -110, y: 8, name: 'TPI', below: true },
        fbpase: { x: -66, y: -18, name: 'FBPase', below: true },
        ald: { x: 0, y: -44, name: 'Aldolase' },
        tk: { x: 0, y: 8, name: 'Transketolase', below: true },
        sbpase: { x: 66, y: -18, name: 'SBPase', below: true },
        rpi: { x: 66, y: 22, name: 'RPI', below: true },
        rpe: { x: 110, y: -52, name: 'RPE' },
        prk: { x: 50, y: -60, name: 'PRK' },
      },
      steps: {
        'tpi-back': 'tpi', 'aldolase-back': 'ald', 'aldolase-sbp': 'ald', fbpase: 'fbpase',
        'tk-f6p': 'tk', 'tk-s7p': 'tk', sbpase: 'sbpase', rpi: 'rpi', rpe: 'rpe', prk: 'prk',
      },
      rest: {
        rubp1: { x: -112, y: -60 }, rubp2: { x: -76, y: -60 }, rubp3: { x: -40, y: -60 },
        adp1: { x: -118, y: -36 }, adp2: { x: -118, y: -22 }, adp3: { x: -92, y: -36 },
        pi1: { x: -96, y: -22 }, pi2: { x: 112, y: 6 },
        h1: { x: 34, y: -70 }, h2: { x: 46, y: -70 }, h3: { x: 58, y: -70 },
      },
    },
  });
  const junction = ringPoint(180);
  // Photorespiration (M7a): phosphoglycolate phosphatase sits outside the
  // ring, up and to the left of RuBisCO, near the envelope that glycolate
  // leaves through.
  const pgpStation = box('pgp', PGP.x, PGP.y, 72, 44, { kind: 'enzyme', reaction: 'pgp', zone: 'krebs', names: ['PGP', 'Phosphoglycolate phosphatase'], times: { load: 0.25, work: 0.6, unload: 0.25 } });

  const tpt = box('tpt', 640, 1054, 34, 36, { kind: 'transport', reaction: 'tpt', zone: 'glycolysis', names: ['TPT', 'Triose phosphate translocator'], times: { load: 0.25, work: 0.3, unload: 0.25 } });
  const hexose = box('hexose', 640, 1225, 280, 110, {
    kind: 'compound', reaction: 'hexose', zone: 'glycolysis', names: ['Hexose', 'Hexose assembly'],
    times: { load: 0.4, work: 3.2, unload: 0.4 },
    hopper: { belts: ['tpt-hexose'], species: 'g3p', count: 2, spacing: 60, dy: -36 },
    inner: {
      cols: 4,
      scale: 4,
      dy: 12,
      // One row, left to right: TPI, aldolase, FBPase, PGI, glucose-6-phosphatase.
      sites: {
        tpi: { x: -100, y: 8, name: 'TPI', below: true },
        ald: { x: -50, y: 8, name: 'Aldolase', below: true },
        fbpase: { x: 0, y: 8, name: 'FBPase', below: true },
        pgi: { x: 50, y: 8, name: 'PGI', below: true },
        g6pase: { x: 100, y: 8, name: 'G6Pase', below: true },
      },
      steps: { 'tpi-back': 'tpi', 'aldolase-back': 'ald', fbpase: 'fbpase', 'pgi-back': 'pgi', 'g6pase': 'g6pase' },
      rest: { glc: { x: 70, y: 40 }, pi1: { x: 122, y: -10 }, pi2: { x: 122, y: 12 } },
    },
  });

  const ringBelt = (id, from, to, extra = {}) => {
    const toDeg = to.deg === 0 ? 360 : to.deg;
    return belt(id, arc(exitDeg(from, toDeg), exitDeg({ ...to, deg: toDeg }, from.deg)), { radius: 6, compartment: 'stroma', ring: true, ...extra });
  };
  const belts = [
    ringBelt('regen-rubisco', regen, rubisco),
    ringBelt('rubisco-pgk', rubisco, pgk),
    ringBelt('pgk-gapdh', pgk, gapdh),
    belt('gapdh-junction', arc(exitDeg(gapdh, 180), 180), {
      radius: 6, compartment: 'stroma', ring: true, fork: { to: ['export', 'junction-regen'], choose: 'carbonBalance' },
    }),
    belt('junction-regen', arc(180, exitDeg(regen, 180)), { radius: 6, compartment: 'stroma', ring: true }),
    belt('export', [junction, edge.top(tpt)], { compartment: 'stroma', underpass: true }),
    belt('tpt-hexose', [edge.bottom(tpt), edge.top(hexose)], { compartment: 'cytosol' }),
    // Phosphoglycolate leaves RuBisCO on its left, above the ring's arc.
    belt('rubisco-pgp', [{ x: rubisco.x - rubisco.w / 2, y: 418 }, { x: PGP.x, y: 418 }, edge.top(pgpStation)], { radius: 8, compartment: 'stroma' }),
  ];

  const calvinStations = [
    {
      ...rubisco,
      // RuBisCO fixes whichever gas is docked: CO₂, or O₂ (M7a, §3.4).
      modes: [
        {
          reaction: 'rubisco',
          inputs: [
            { role: 'rubp', from: 'belt', belts: ['regen-rubisco'] },
            { role: 'co2', from: 'dock', dock: 'gas' },
            { role: 'water', from: 'bulk', at: { x: 700, y: 400 } },
          ],
          outputs: [
            { role: 'pgA', to: 'belt', belt: 'rubisco-pgk' },
            { role: 'pgB', to: 'belt', belt: 'rubisco-pgk' },
            { role: 'hA', to: 'bulk', at: { x: 712, y: 418 } },
            { role: 'hB', to: 'bulk', at: { x: 712, y: 440 } },
          ],
        },
        {
          reaction: 'rubisco-o2',
          inputs: [
            { role: 'rubp', from: 'belt', belts: ['regen-rubisco'] },
            { role: 'o2', from: 'dock', dock: 'gas' },
            { role: 'water', from: 'bulk', at: { x: 700, y: 400 } },
          ],
          outputs: [
            { role: 'pg', to: 'belt', belt: 'rubisco-pgk' },
            { role: 'pgly', to: 'belt', belt: 'rubisco-pgp' },
            { role: 'waterOut', to: 'bulk', at: { x: 700, y: 400 } },
            { role: 'hA', to: 'bulk', at: { x: 712, y: 418 } },
            { role: 'hB', to: 'bulk', at: { x: 712, y: 440 } },
          ],
        },
      ],
      // A gas from the air space waits here, a second one queued behind it.
      docks: { gas: dock({ x: 596, y: 382 }, 'co2', [], { buffer: 1, places: [{ x: 596, y: 382 }, { x: 562, y: 382 }] }) },
    },
    {
      // Phosphoglycolate phosphatase (D17): the phosphate stays in the
      // stroma; glycolate leaves for the peroxisome.
      ...pgpStation,
      modes: [{
        reaction: 'pgp',
        inputs: [{ role: 'pgly', from: 'belt', belts: ['rubisco-pgp'] }, { role: 'water', from: 'bulk', at: { x: PGP.x + 10, y: PGP.y + 40 } }],
        outputs: [
          { role: 'glycolate', to: 'exhaust', drift: 'glycolate' },
          { role: 'pi', to: 'loop', loop: 'sbus', at: { x: BUS.leftIn, y: BUS.start + 30 } },
        ],
      }],
    },
    {
      ...pgk,
      modes: [{
        reaction: 'calvin-pgk',
        inputs: [{ role: 'pg3', from: 'belt', belts: ['rubisco-pgk'] }, { role: 'atp', from: 'dock', dock: 'atp' }],
        outputs: [{ role: 'bpg', to: 'belt', belt: 'pgk-gapdh' }, { role: 'adp', to: 'loop', loop: 'sbus', at: { x: DOCK_X, y: pgk.y + 18 } }],
      }],
      docks: { atp: dock({ x: DOCK_X, y: pgk.y - 14 }, 'atp', ['sbus']) },
    },
    {
      ...gapdh,
      modes: [{
        reaction: 'calvin-gapdh',
        inputs: [
          { role: 'bpg', from: 'belt', belts: ['pgk-gapdh'] },
          { role: 'nadph', from: 'dock', dock: 'nadph' },
          { role: 'h', from: 'bulk', at: { x: gapdh.x - 40, y: gapdh.y } },
        ],
        outputs: [
          { role: 'g3p', to: 'belt', belt: 'gapdh-junction' },
          { role: 'nadp', to: 'loop', loop: 'sbus', at: { x: DOCK_X, y: gapdh.y + 4 } },
          { role: 'pi', to: 'loop', loop: 'sbus', at: { x: DOCK_X, y: gapdh.y + 24 } },
        ],
      }],
      docks: { nadph: dock({ x: DOCK_X, y: gapdh.y - 18 }, 'nadph', ['sbus']) },
    },
    {
      ...regen,
      modes: [{
        reaction: 'regen',
        inputs: [
          ...['a', 'b', 'c', 'd', 'e'].map((role, index) => ({ role, from: 'hopper', index })),
          ...[0, 1, 2].map((slot) => ({ role: `atp${slot + 1}`, from: 'dock', dock: 'atp', slot })),
          { role: 'water1', from: 'bulk', at: { x: regen.x - 60, y: regen.y - 90 } },
          { role: 'water2', from: 'bulk', at: { x: regen.x + 60, y: regen.y - 90 } },
        ],
        outputs: [
          { role: 'rubp1', to: 'belt', belt: 'regen-rubisco' },
          { role: 'rubp2', to: 'belt', belt: 'regen-rubisco' },
          { role: 'rubp3', to: 'belt', belt: 'regen-rubisco' },
          ...[1, 2, 3].map((n) => ({ role: `adp${n}`, to: 'loop', loop: 'sbus', at: { x: BUS.leftIn + 26, y: regen.y + 20 * (n - 2) } })),
          { role: 'pi1', to: 'loop', loop: 'sbus', at: { x: BUS.leftIn + 26, y: regen.y + 50 } },
          { role: 'pi2', to: 'loop', loop: 'sbus', at: { x: BUS.leftIn + 26, y: regen.y + 64 } },
          ...[1, 2, 3].map((n) => ({ role: `h${n}`, to: 'bulk', at: { x: regen.x - 40 + 40 * (n - 1), y: regen.y - 90 } })),
        ],
      }],
      docks: {
        atp: dock({ x: BUS.leftIn + 30, y: regen.y }, 'atp', ['sbus'], {
          count: 3,
          places: [{ x: BUS.leftIn + 30, y: regen.y - 40 }, { x: BUS.leftIn + 30, y: regen.y - 4 }, { x: BUS.leftIn + 30, y: regen.y + 32 }],
        }),
      },
    },
    {
      ...tpt,
      modes: [{
        reaction: 'tpt',
        inputs: [{ role: 'g3pIn', from: 'belt', belts: ['export'] }, { role: 'piIn', from: 'dock', dock: 'pi' }],
        outputs: [{ role: 'g3pOut', to: 'belt', belt: 'tpt-hexose' }, { role: 'piOut', to: 'loop', loop: 'sbus', at: { x: tpt.x + 30, y: BUS.bottom } }],
      }],
      docks: { pi: dock({ x: tpt.x + 34, y: tpt.y + 12 }, 'pi', ['pic']) },
    },
    {
      ...hexose,
      modes: [{
        reaction: 'hexose',
        inputs: [
          { role: 'x', from: 'hopper', index: 0 }, { role: 'y', from: 'hopper', index: 1 },
          { role: 'water1', from: 'bulk', at: { x: hexose.x - 150, y: hexose.y } },
          { role: 'water2', from: 'bulk', at: { x: hexose.x - 150, y: hexose.y + 20 } },
        ],
        outputs: [
          { role: 'glc', to: 'exhaust', drift: 'sugar' },
          { role: 'pi1', to: 'loop', loop: 'pic', at: { x: edge.right(hexose).x + 14, y: hexose.y - 10 } },
          { role: 'pi2', to: 'loop', loop: 'pic', at: { x: edge.right(hexose).x + 14, y: hexose.y + 10 } },
        ],
      }],
    },
  ];

  return { stations: calvinStations, belts, rubisco, pgpStation, tpt, hexose };
}

export function buildC3() {
  const strip = lightReactions(0, { cyclicIdle: 15 });
  const calvin = calvinCycle();
  const { belts, pgpStation, hexose } = calvin;

  // Loops ---------------------------------------------------------------------------

  const loops = {
    ...strip.loops,
    sbus: loop('sbus', [
      { x: BUS.end, y: BUS.topIn }, { x: BUS.rightIn, y: BUS.topIn }, { x: BUS.rightIn, y: BUS.bottomIn },
      { x: BUS.leftIn, y: BUS.bottomIn }, { x: BUS.leftIn, y: BUS.start }, { x: BUS.left, y: BUS.start },
      { x: BUS.left, y: BUS.bottom }, { x: BUS.right, y: BUS.bottom }, { x: BUS.right, y: BUS.top }, { x: BUS.end, y: BUS.top },
    ], 15, { name: 'Stroma carriers', compartment: 'stroma', tint: 'carrier-nad', hot: true }),
    pic: loop('pic', [
      { x: 790, y: 1078 }, { x: 860, y: 1078 }, { x: 860, y: 1200 }, { x: 790, y: 1200 },
    ], 14, { name: 'Phosphate', compartment: 'cytosol', tint: 'carrier-adenosine' }),
  };

  const stations = [...strip.stations, ...calvin.stations];
  attachTaps(stations, loops);

  // Lanes and drifts ------------------------------------------------------------------

  // The air space between the epidermis and the cell wall (M7a, E9).
  const GAS = { x1: 10, x2: 1330, y1: LEAF.epidermis.y2 + 12, y2: LEAF.wall.y - 22 };

  const TRAY = {
    water: { x: 240, y: 96 },
    co2: { x: 140, y: -262 },
    prompt: { x: 330, y: -282 },
  };

  const drifts = {
    // Water from the xylem, across the cell and the chloroplast, into the
    // lumen to photosystem II's water dock.
    h2o: drift([TRAY.water, { x: 240, y: 236 }, { x: PSII - 34, y: 252 }], 20),
    // CO₂ from the air space, down beside the chloroplast, across the
    // envelope under the thylakoid, to RuBisCO (M7a, E9).
    co2: drift([{ x: 140, y: GAS.y1 + 20 }, { x: 140, y: 382 }, { x: 596, y: 382 }], 24),
    // O₂ from photosystem II up out of the cell into the air space, where it
    // joins the gas pool and leaves through the stoma down its gradient.
    o2: drift([{ x: PSII + 30, y: 262 }, { x: 420, y: 230 }, { x: 420, y: -40 }], 40),
    arriveWater: drift([{ x: -160, y: TRAY.water.y }, TRAY.water]),
    arriveCo2: drift([{ x: 140, y: -600 }, TRAY.co2]),
    // Glycolate leaves the chloroplast through its envelope for the
    // peroxisome, where the salvage pathway begins (M7a, D17).
    glycolate: Object.assign(drift([edge.left(pgpStation), { x: 166, y: PGP.y }, { x: PEROXISOME.cx, y: PEROXISOME.cy }], 10), { fade: 50 }),
    // Glucose leaves for the rest of the plant through the export port.
    sugar: drift([edge.bottom(hexose), { x: 640, y: LEAF.cell.y + LEAF.cell.h + 120 }], 10),
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
      id: 'export',
      name: 'Sugar Export',
      token: 'zone-glycolysis',
      path: zonePath([{ x: 480, y: 1010 }, { x: 880, y: 1010 }, { x: 880, y: 1300 }, { x: 480, y: 1300 }], 22),
      label: { x: 470, y: 1100, align: 'right' },
    },
  ];

  const labels = [
    { text: 'Air Space', x: 700, y: -70, kind: 'compartment' },
    { text: 'Upper epidermis', x: 760, y: -175, kind: 'membrane', lod: 'mid' },
    { text: 'Stoma', x: 222, y: -175, kind: 'membrane', lod: 'mid' },
    { text: 'Chloroplast', x: 1150, y: 1082, kind: 'compartment' },
    { text: 'Stroma', x: 1150, y: 990, kind: 'compartment' },
    { text: 'Thylakoid Lumen', x: 740, y: 222, kind: 'compartment' },
    { text: 'Thylakoid membrane', x: (B6F + PSI) / 2 - 2, y: STRIP_Y, kind: 'membrane', lod: 'mid' },
    { text: 'Cytosol', x: 1230, y: 96, kind: 'compartment' },
    { text: 'Vacuole', x: LEAF.vacuole.x + LEAF.vacuole.w / 2, y: LEAF.vacuole.y + LEAF.vacuole.h / 2, kind: 'compartment' },
    { text: 'Peroxisome', x: PEROXISOME.cx, y: PEROXISOME.cy + PEROXISOME.ry + 16, kind: 'compartment', lod: 'mid' },
    { text: 'Nucleus', x:LEAF.nucleus.cx, y: LEAF.nucleus.cy + LEAF.nucleus.ry + 34, kind: 'compartment' },
    { text: 'Thylakoids (grana)', x: 1180, y: 870, kind: 'compartment', lod: 'mid' },
    { text: 'Carboxylation', x: C3_RING.x, y: C3_RING.y - 72, kind: 'phase', token: 'zone-krebs' },
    { text: 'Reduction', x: C3_RING.x + 70, y: C3_RING.y + 40, kind: 'phase', token: 'zone-krebs' },
    { text: 'Regeneration', x: C3_RING.x + 30, y: C3_RING.y + 112, kind: 'phase', token: 'zone-krebs' },
  ];

  const pores = [
    { id: 'export-port', name: 'Sugar export (to the phloem)', short: 'Export', x: 640, y: LEAF.cell.y + LEAF.cell.h, membrane: 'cell', w: 30, h: 28 },
    { id: 'salvage', name: 'Glycolate transporter', short: 'PLGG1', x: 166, y: PGP.y, membrane: 'chloroplast', w: 28, h: 30, quiet: true, label: 'above' },
  ];

  return {
    id: 'c3',
    tab: 'photosynthesis',
    pathway: 'c3',
    bounds: LEAF.bounds,
    leaf: LEAF,
    place: (x, y) => (inEllipse(PEROXISOME, x, y) ? 'in a peroxisome' : leafPlace(x, y)),
    peroxisome: PEROXISOME,
    fadeTop: LEAF.epidermis.y1 - 20,
    fadeBottom: LEAF.cell.y + LEAF.cell.h,
    stations,
    belts,
    loops,
    stubs: makeStubs(stations, loops),
    drifts,
    lanes: [
      { id: 'h2o', drift: 'h2o', name: 'H₂O', supply: 'water' },
      { id: 'co2', drift: 'co2', name: 'CO₂' },
    ],
    supplies: [
      { id: 'water', species: 'water', lane: 'h2o', arrive: 'arriveWater', station: 'psii', dock: 'h2o', ahead: 2 },
    ],
    // The air space's gas pool and the stoma (M7a, E9, D18). Only the ratio
    // of the ambient counts matters to RuBisCO.
    gas: {
      region: GAS,
      ambient: { co2: 8, oxygen: 8 },
      conductance: 0.25,
      stoma: { x: LEAF.stoma.x, inner: LEAF.epidermis.y2, outer: LEAF.epidermis.y1, exit: -470 },
      trays: [{ id: 'co2', species: 'co2', arrive: 'arriveCo2' }],
      // RuBisCO takes CO₂ or O₂ by their counts in the air space, weighted
      // about 32 to 1 towards CO₂ (§3.4).
      draws: [{ station: 'rubisco', dock: 'gas', species: ['co2', 'oxygen'], specificity: 32, route: [{ x: 140, y: GAS.y1 + 20 }, { x: 140, y: 382 }], lane: 'co2', ahead: 2 }],
    },
    light: strip.light,
    exportDrift: 'sugar',
    // The export belt passes under the stroma bus (PLAN §6.5).
    matrixCrossings: [{ a: 'export', b: 'sbus' }],
    zones,
    pores,
    labels,
    tray: TRAY,
    chain: { PSII, B6F, PSI, SYN },
    reservoir: lumenReservoir(),
    // The Calvin ring, for the junction's carbon balance (E5).
    ring: {
      ...C3_RING,
      belts: ['regen-rubisco', 'rubisco-pgk', 'pgk-gapdh', 'gapdh-junction', 'junction-regen'],
      stations: ['rubisco', 'pgk', 'gapdh', 'regen'],
    },
    skeletons: [
      ['rubp', 'regen-rubisco', 2, 0.85],
      ['rubp', 'rubisco-pgk', 0],
      ['pg3', 'rubisco-pgk', 2, 0.8],
      ['bpg', 'pgk-gapdh', 2, 0.8],
      ['g3p', 'gapdh-junction', 1, 0.5],
      ['g3p', 'junction-regen', 4, 0.9],
    ],
    // The plant's stored sugar (M6.5 P6). Its own respiration and growth
    // drain about a tenth of what the leaf makes in light, so the store
    // fills by day and lasts a long night; only darkness that outlasts it
    // starves the cell, after about eleven minutes from a two-thirds store.
    life: { kind: 'reserve', cap: 3, start: 2, drain: 0.003, starveAfter: 20 },
    gauges: ['reserve', 'protons'],
    ledger: {
      photons: 0, quenched: 0, split: 0, o2: 0, fixed: 0, glucose: 0, exported: 0, h2o: 0, co2: 0,
      atp: 0, atpSub: 0, atpOx: 0, atpPhoto: 0, atpUsed: 0, nadph: 0, nadphUsed: 0, cyclic: 0, oxygenated: 0, glycolate: 0,
    },
    params: {
      protons: 20,
      prime: {
        pq: [['pq', 7]],
        pc: [['pc', 8]],
        fd: [['fd', 7]],
        sbus: [['atp', 10], ['nadp', 6], ['adp', 8], ['nadph', 6], ['pi', 8]],
        pic: [['pi', 2]],
      },
    },
  };
}

export const c3Scene = buildC3();
