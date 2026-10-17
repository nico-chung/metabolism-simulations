// Pieces every respiring cell shares, as data: geometry helpers, the
// glycolysis rows, the citric acid cycle ring with pyruvate dehydrogenase,
// Complex II, ATP synthase, and the taps and stubs that join docks to loops.
// The eukaryotic cell (cell.js) and the bacterium (bacterium.js) put them in
// the same places, so switching organism reads as a comparison (§17 D1).

import { nearestS, pointAt, polyPath } from '../sim/path.js';
import { enzymeBox } from './sizes.js';

export const ENZYME = enzymeBox(['glucose', 'fbp']);
export const KREBS = enzymeBox(['citrate']);

export const STRIP_Y = 300;
export const STRIP_HALF = 14;

export const COLS = [380, 600, 820, 1040, 1260];
export const RING = { x: 640, y: 500, r: 190 };
export const CHAIN = { I: 350, II: 640, III: 950, IV: 1190, SYN: 1450 };

// A respiring cell pulls glucose in from its tray (M6 plan §4.1), and starts
// with three of the cycle's carbon skeletons on its belts.
export const GLUCOSE_FEED = { id: 'glucose', species: 'glucose', belt: 'feed', arrive: 'arriveGlucose' };
export const CYCLE_SKELETONS = [['oaa', 'mdh-cs'], ['malate', 'fum-mdh'], ['succinate', 'scs-ii']];

export function ringPoint(deg, radius = RING.r) {
  const a = (deg * Math.PI) / 180;
  return { x: RING.x + Math.sin(a) * radius, y: RING.y - Math.cos(a) * radius };
}

export function box(id, x, y, w, h, extra = {}) {
  return { id, x, y, w, h, ...extra };
}

export const edge = {
  left: (s, dy = 0) => ({ x: s.x - s.w / 2, y: s.y + dy }),
  right: (s, dy = 0) => ({ x: s.x + s.w / 2, y: s.y + dy }),
  top: (s, dx = 0) => ({ x: s.x + dx, y: s.y - s.h / 2 }),
  bottom: (s, dx = 0) => ({ x: s.x + dx, y: s.y + s.h / 2 }),
};

export function loop(id, points, radius, extra) {
  return { id, kind: 'loop', path: polyPath(points, radius, true), ...extra };
}

export function belt(id, points, extra = {}) {
  return { id, kind: 'line', path: polyPath(points, extra.radius ?? 20, false), compartment: 'cytosol', ...extra };
}

export function drift(points, radius = 70) {
  return polyPath(points, radius, false);
}

export function dock(at, species, loops, extra = {}) {
  return { at, species, loops, ...extra };
}

export function zonePath(points, radius = 24) {
  return polyPath(points, radius, true);
}

export function circleZone(cx, cy, r, chordY) {
  const points = [];
  if (cy - r >= chordY) {
    for (let i = 0; i < 72; i += 1) {
      const a = (i / 72) * Math.PI * 2;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return polyPath(points, 4, true);
  }
  const half = Math.acos((cy - chordY) / r);
  const start = -Math.PI / 2 + half;
  const end = (3 * Math.PI) / 2 - half;
  for (let i = 0; i <= 72; i += 1) {
    const a = start + ((end - start) * i) / 72;
    points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return polyPath(points, 4, true);
}

export function enzyme(id, reaction, x, y, zone) {
  return box(id, x, y, ENZYME.w, ENZYME.h, {
    kind: 'enzyme', reaction, zone, times: { load: 0.35, work: 1.3, unload: 0.35 },
  });
}

function krebs(id, reaction, deg) {
  const p = ringPoint(deg);
  return box(id, p.x, p.y, KREBS.w, KREBS.h, {
    kind: 'enzyme', reaction, zone: 'krebs', deg, times: { load: 0.35, work: 1.3, unload: 0.35 },
  });
}

// Glycolysis ------------------------------------------------------------------

// Two rows: investment left to right below, payoff right to left above.
export function glycolysisBoxes(rowPay, rowInv) {
  return {
    hk: enzyme('hexokinase', 'hexokinase', COLS[0], rowInv, 'glycolysis'),
    pgi: enzyme('pgi', 'pgi', COLS[1], rowInv, 'glycolysis'),
    pfk: enzyme('pfk', 'pfk', COLS[2], rowInv, 'glycolysis'),
    ald: enzyme('aldolase', 'aldolase', COLS[3], rowInv, 'glycolysis'),
    tpi: enzyme('tpi', 'tpi', COLS[4], rowInv, 'glycolysis'),
    gapdh: enzyme('gapdh', 'gapdh', COLS[4], rowPay, 'glycolysis'),
    pgk: enzyme('pgk', 'pgk', COLS[3], rowPay, 'glycolysis'),
    pgm: enzyme('pgm', 'pgm', COLS[2], rowPay, 'glycolysis'),
    eno: enzyme('enolase', 'enolase', COLS[1], rowPay, 'glycolysis'),
    pk: enzyme('pk', 'pk', COLS[0], rowPay, 'glycolysis'),
  };
}

// The belts between the glycolysis enzymes, from the feed to pyruvate kinase.
export function glycolysisBelts(g, { tray, rowPay, rowInv }) {
  const under = rowInv + 85;
  return [
    belt('feed', [tray, edge.left(g.hk)]),
    belt('hk-pgi', [edge.right(g.hk), edge.left(g.pgi)]),
    belt('pgi-pfk', [edge.right(g.pgi), edge.left(g.pfk)]),
    belt('pfk-ald', [edge.right(g.pfk), edge.left(g.ald)]),
    belt('ald-tpi', [edge.right(g.ald), edge.left(g.tpi)]),
    belt('ald-gapdh', [edge.bottom(g.ald), { x: g.ald.x, y: under }, { x: 1362, y: under }, { x: 1362, y: rowPay - 20 }, edge.right(g.gapdh, -20)]),
    belt('tpi-gapdh', [edge.right(g.tpi), { x: 1338, y: rowInv }, { x: 1338, y: rowPay + 20 }, edge.right(g.gapdh, 20)], { radius: 10 }),
    belt('gapdh-pgk', [edge.left(g.gapdh), edge.right(g.pgk)]),
    belt('pgk-pgm', [edge.left(g.pgk), edge.right(g.pgm)]),
    belt('pgm-eno', [edge.left(g.pgm), edge.right(g.eno)]),
    belt('eno-pk', [edge.left(g.eno), edge.right(g.pk)]),
  ];
}

// nad: the loop glyceraldehyde 3-phosphate dehydrogenase takes NAD⁺ from and
// returns NADH to. pyruvate: the belt pyruvate kinase hands pyruvate to.
export function glycolysisStations(g, { nad, pyruvate }) {
  const { hk, pgi, pfk, ald, tpi, gapdh, pgk, pgm, eno, pk } = g;
  return [
    {
      ...hk,
      modes: [{
        reaction: 'hexokinase',
        inputs: [{ role: 'glc', from: 'belt', belts: ['feed'] }, { role: 'atp', from: 'dock', dock: 'atp' }],
        outputs: [{ role: 'g6p', to: 'belt', belt: 'hk-pgi' }, { role: 'adp', to: 'loop', loop: 'glyco', at: edge.top(hk, -14) }, { role: 'h', to: 'bulk', at: edge.bottom(hk, 30) }],
      }],
      docks: { atp: dock(edge.top(hk, -14), 'atp', ['glyco']) },
    },
    {
      ...pgi,
      modes: [{ reaction: 'pgi', inputs: [{ role: 'g6p', from: 'belt', belts: ['hk-pgi'] }], outputs: [{ role: 'f6p', to: 'belt', belt: 'pgi-pfk' }] }],
    },
    {
      ...pfk,
      modes: [{
        reaction: 'pfk',
        inputs: [{ role: 'f6p', from: 'belt', belts: ['pgi-pfk'] }, { role: 'atp', from: 'dock', dock: 'atp' }],
        outputs: [{ role: 'fbp', to: 'belt', belt: 'pfk-ald' }, { role: 'adp', to: 'loop', loop: 'glyco', at: edge.top(pfk, -14) }, { role: 'h', to: 'bulk', at: edge.bottom(pfk, 30) }],
      }],
      docks: { atp: dock(edge.top(pfk, -14), 'atp', ['glyco']) },
    },
    {
      ...ald,
      modes: [{ reaction: 'aldolase', inputs: [{ role: 'fbp', from: 'belt', belts: ['pfk-ald'] }], outputs: [{ role: 'dhap', to: 'belt', belt: 'ald-tpi' }, { role: 'g3p', to: 'belt', belt: 'ald-gapdh' }] }],
    },
    {
      ...tpi,
      modes: [{ reaction: 'tpi', inputs: [{ role: 'dhap', from: 'belt', belts: ['ald-tpi'] }], outputs: [{ role: 'g3p', to: 'belt', belt: 'tpi-gapdh' }] }],
    },
    {
      ...gapdh,
      modes: [{
        reaction: 'gapdh',
        inputs: [
          { role: 'g3p', from: 'belt', belts: ['ald-gapdh', 'tpi-gapdh'] },
          { role: 'nad', from: 'dock', dock: 'nad' },
          { role: 'pi', from: 'dock', dock: 'pi' },
        ],
        outputs: [
          { role: 'bpg', to: 'belt', belt: 'gapdh-pgk' },
          { role: 'nadh', to: 'loop', loop: nad, at: edge.top(gapdh, 0) },
          { role: 'h', to: 'bulk', at: edge.top(gapdh, -40) },
        ],
      }],
      docks: {
        nad: dock(edge.top(gapdh, 0), 'nad', [nad]),
        pi: dock(edge.bottom(gapdh, -14), 'pi', ['glyco']),
      },
    },
    {
      ...pgk,
      modes: [{
        reaction: 'pgk',
        inputs: [{ role: 'bpg', from: 'belt', belts: ['gapdh-pgk'] }, { role: 'adp', from: 'dock', dock: 'adp' }],
        outputs: [{ role: 'pg3', to: 'belt', belt: 'pgk-pgm' }, { role: 'atp', to: 'loop', loop: 'glyco', at: edge.bottom(pgk, 14) }],
      }],
      docks: { adp: dock(edge.bottom(pgk, 14), 'adp', ['glyco']) },
    },
    {
      ...pgm,
      modes: [{ reaction: 'pgm', inputs: [{ role: 'pg3', from: 'belt', belts: ['pgk-pgm'] }], outputs: [{ role: 'pg2', to: 'belt', belt: 'pgm-eno' }] }],
    },
    {
      ...eno,
      modes: [{ reaction: 'enolase', inputs: [{ role: 'pg2', from: 'belt', belts: ['pgm-eno'] }], outputs: [{ role: 'pep', to: 'belt', belt: 'eno-pk' }, { role: 'water', to: 'bulk', at: edge.top(eno, 0) }] }],
    },
    {
      ...pk,
      modes: [{
        reaction: 'pk',
        inputs: [{ role: 'pep', from: 'belt', belts: ['eno-pk'] }, { role: 'adp', from: 'dock', dock: 'adp' }, { role: 'h', from: 'bulk', at: edge.left(pk, 20) }],
        outputs: [{ role: 'pyr', to: 'belt', belt: pyruvate }, { role: 'atp', to: 'loop', loop: 'glyco', at: edge.bottom(pk, 14) }],
      }],
      docks: { adp: dock(edge.bottom(pk, 14), 'adp', ['glyco']) },
    },
  ];
}

// The surplus cell work at the left end of the glycolysis ATP loop.
export function surplusWork(workC) {
  return {
    ...workC,
    demand: 'surplus',
    modes: [{
      reaction: 'cell-work',
      inputs: [{ role: 'atp', from: 'dock', dock: 'atp' }, { role: 'water', from: 'bulk', at: edge.top(workC) }],
      outputs: [{ role: 'adp', to: 'loop', loop: 'source:atp', at: edge.right(workC), group: 'adpPi' }, { role: 'pi', to: 'loop', loop: 'source:atp', at: edge.right(workC), group: 'adpPi' }, { role: 'h', to: 'bulk', at: edge.bottom(workC) }],
    }],
    docks: { atp: dock(edge.right(workC), 'atp', ['glyco']) },
  };
}

// The citric acid cycle --------------------------------------------------------

export function cycleBoxes() {
  return {
    pdh: enzyme('pdh', 'pdh', 1040, 800, 'oxidation'),
    cs: krebs('cs', 'cs', 135),
    aco: krebs('aconitase', 'aconitase', 180),
    idh: krebs('idh', 'idh', 225),
    akgdh: krebs('akgdh', 'akgdh', 270),
    scs: krebs('scs', 'scs', 315),
    fum: krebs('fumarase', 'fumarase', 45),
    mdh: krebs('mdh', 'mdh', 90),
    complex2: box('complex2', CHAIN.II, STRIP_Y, 84, 64, {
      kind: 'complex', shape: 'II', reaction: 'sdh', zone: 'oxphos', alsoZone: 'krebs', deg: 0,
      times: { load: 0.35, work: 1.3, unload: 0.35 },
    }),
  };
}

function ringExit(station, towardDeg) {
  const dir = Math.sign(towardDeg - station.deg);
  for (let d = 0; d < 40; d += 0.25) {
    const p = ringPoint(station.deg + dir * d);
    if (Math.abs(p.x - station.x) > station.w / 2 + 0.5 || Math.abs(p.y - station.y) > station.h / 2 + 0.5) {
      return station.deg + dir * d;
    }
  }
  return station.deg + dir * 20;
}

function ringArc(fromDeg, toDeg) {
  const points = [];
  const steps = Math.max(4, Math.ceil(Math.abs(toDeg - fromDeg) / 3));
  for (let i = 0; i <= steps; i += 1) points.push(ringPoint(fromDeg + ((toDeg - fromDeg) * i) / steps));
  return points;
}

// The ring's belts, clockwise from citrate synthase, plus pyruvate
// dehydrogenase's acetyl belt into citrate synthase.
export function cycleBelts(c, { compartment }) {
  const ringBelt = (id, from, to) => {
    const fromDeg = from.deg ?? 0;
    const toDeg = to.deg === 0 ? 360 : to.deg;
    const start = from === c.complex2 ? 25 : ringExit(from, toDeg);
    const end = to === c.complex2 ? 335 : ringExit({ ...to, deg: toDeg }, fromDeg);
    const points = ringArc(start, end);
    if (from === c.complex2) points.unshift(edge.right(c.complex2, 22));
    if (to === c.complex2) points.push(edge.left(c.complex2, 22));
    return belt(id, points, { radius: 6, compartment, ring: true });
  };
  return [
    belt('pdh-cs', [edge.left(c.pdh), { x: c.cs.x, y: c.pdh.y }, edge.bottom(c.cs)], { compartment }),
    ringBelt('cs-aco', c.cs, c.aco),
    ringBelt('aco-idh', c.aco, c.idh),
    ringBelt('idh-akg', c.idh, c.akgdh),
    ringBelt('akg-scs', c.akgdh, c.scs),
    ringBelt('scs-ii', c.scs, c.complex2),
    ringBelt('ii-fum', c.complex2, c.fum),
    ringBelt('fum-mdh', c.fum, c.mdh),
    ringBelt('mdh-cs', c.mdh, c.cs),
  ];
}

// Pyruvate dehydrogenase, the cycle's enzymes, and Complex II (succinate
// dehydrogenase and its quinone site). Carriers ride the bus.
export function cycleStations(c) {
  const { pdh, cs, aco, idh, akgdh, scs, complex2, fum, mdh } = c;
  return [
    {
      ...pdh,
      modes: [{
        reaction: 'pdh',
        inputs: [{ role: 'pyr', from: 'belt', belts: ['pyruvate'] }, { role: 'coa', from: 'dock', dock: 'coa' }, { role: 'nad', from: 'dock', dock: 'nad' }],
        outputs: [{ role: 'acetyl', to: 'belt', belt: 'pdh-cs' }, { role: 'co2', to: 'exhaust', drift: 'pdh' }, { role: 'nadh', to: 'loop', loop: 'bus', at: edge.bottom(pdh, 40) }],
      }],
      docks: {
        coa: dock(edge.bottom(pdh, -40), 'coa', ['bus']),
        nad: dock(edge.bottom(pdh, 40), 'nad', ['bus']),
      },
    },
    {
      ...cs,
      modes: [{
        reaction: 'cs',
        inputs: [{ role: 'acetyl', from: 'belt', belts: ['pdh-cs'] }, { role: 'oaa', from: 'belt', belts: ['mdh-cs'] }, { role: 'water', from: 'bulk', at: edge.left(cs) }],
        outputs: [{ role: 'cit', to: 'belt', belt: 'cs-aco' }, { role: 'coa', to: 'loop', loop: 'bus', at: edge.right(cs) }, { role: 'h', to: 'bulk', at: edge.left(cs) }],
      }],
    },
    {
      ...aco,
      modes: [{ reaction: 'aconitase', inputs: [{ role: 'cit', from: 'belt', belts: ['cs-aco'] }], outputs: [{ role: 'iso', to: 'belt', belt: 'aco-idh' }] }],
    },
    {
      ...idh,
      modes: [{
        reaction: 'idh',
        inputs: [{ role: 'iso', from: 'belt', belts: ['aco-idh'] }, { role: 'nad', from: 'dock', dock: 'nad' }],
        outputs: [{ role: 'akg', to: 'belt', belt: 'idh-akg' }, { role: 'co2', to: 'exhaust', drift: 'idh' }, { role: 'nadh', to: 'loop', loop: 'bus', at: edge.left(idh, 14) }],
      }],
      docks: { nad: dock(edge.left(idh, 14), 'nad', ['bus']) },
    },
    {
      ...akgdh,
      modes: [{
        reaction: 'akgdh',
        inputs: [{ role: 'akg', from: 'belt', belts: ['idh-akg'] }, { role: 'nad', from: 'dock', dock: 'nad' }, { role: 'coa', from: 'dock', dock: 'coa' }],
        outputs: [{ role: 'suc', to: 'belt', belt: 'akg-scs' }, { role: 'co2', to: 'exhaust', drift: 'akgdh' }, { role: 'nadh', to: 'loop', loop: 'bus', at: edge.left(akgdh, 18) }],
      }],
      docks: {
        nad: dock(edge.left(akgdh, 18), 'nad', ['bus']),
        coa: dock(edge.left(akgdh, -18), 'coa', ['bus']),
      },
    },
    {
      ...scs,
      modes: [{
        reaction: 'scs',
        inputs: [{ role: 'suc', from: 'belt', belts: ['akg-scs'] }, { role: 'adp', from: 'dock', dock: 'adpPi' }, { role: 'pi', from: 'dock', dock: 'pi' }],
        outputs: [{ role: 'succinate', to: 'belt', belt: 'scs-ii' }, { role: 'atp', to: 'loop', loop: 'bus', at: edge.left(scs, 22) }, { role: 'coa', to: 'loop', loop: 'bus', at: edge.left(scs, -22) }],
      }],
      docks: {
        adpPi: dock(edge.left(scs, 22), 'adp', ['bus']),
        pi: dock(edge.left(scs, -22), 'pi', ['bus']),
      },
    },
    {
      ...complex2,
      internal: { fad: 'fad' },
      modes: [
        {
          reaction: 'sdh',
          inputs: [{ role: 'succinate', from: 'belt', belts: ['scs-ii'] }, { role: 'fad', from: 'internal', slot: 'fad' }],
          outputs: [{ role: 'fum', to: 'belt', belt: 'ii-fum' }, { role: 'fadh2', to: 'internal', slot: 'fad' }],
        },
        {
          reaction: 'qsite',
          times: { load: 0.25, work: 0.6, unload: 0.25 },
          inputs: [{ role: 'fadh2', from: 'internal', slot: 'fad' }, { role: 'q', from: 'dock', dock: 'q' }],
          outputs: [{ role: 'fad', to: 'internal', slot: 'fad' }, { role: 'qh2', to: 'loop', loop: 'q', at: { x: CHAIN.II + 12, y: STRIP_Y - 7 } }],
        },
      ],
      docks: { q: dock({ x: CHAIN.II - 12, y: STRIP_Y + 7 }, 'q', ['q']) },
    },
    {
      ...fum,
      modes: [{ reaction: 'fumarase', inputs: [{ role: 'fum', from: 'belt', belts: ['ii-fum'] }, { role: 'water', from: 'bulk', at: edge.top(fum) }], outputs: [{ role: 'mal', to: 'belt', belt: 'fum-mdh' }] }],
    },
    {
      ...mdh,
      modes: [{
        reaction: 'mdh',
        inputs: [{ role: 'mal', from: 'belt', belts: ['fum-mdh'] }, { role: 'nad', from: 'dock', dock: 'nad' }],
        outputs: [{ role: 'oaa', to: 'belt', belt: 'mdh-cs' }, { role: 'nadh', to: 'loop', loop: 'bus', at: edge.right(mdh) }, { role: 'h', to: 'bulk', at: edge.left(mdh) }],
      }],
      docks: { nad: dock(edge.right(mdh), 'nad', ['bus']) },
    },
  ];
}

// The chain's first complex: Complex I in a mitochondrion, NDH-1 in E. coli.
export function complexOne(reaction) {
  const def = box('complex1', CHAIN.I, STRIP_Y, 90, 64, {
    kind: 'complex', shape: 'I', reaction, zone: 'oxphos',
    arm: { x: CHAIN.I, y: 356, w: 34, h: 48 },
    times: { load: 0.3, work: 1.0, unload: 0.3 },
  });
  return {
    ...def,
    modes: [{
      reaction,
      inputs: [
        { role: 'nadh', from: 'dock', dock: 'nadh' },
        { role: 'q', from: 'dock', dock: 'q' },
        { role: 'h1', from: 'bulk', at: { x: CHAIN.I - 28, y: 350 } },
        { role: 'h2', from: 'bulk', at: { x: CHAIN.I + 28, y: 350 } },
      ],
      outputs: [
        { role: 'nad', to: 'loop', loop: 'bus', at: { x: CHAIN.I, y: 380 } },
        { role: 'qh2', to: 'loop', loop: 'q', at: { x: CHAIN.I + 20, y: STRIP_Y - 7 } },
        { role: 'h', to: 'bulk', at: { x: CHAIN.I - 30, y: 372 } },
      ],
      pump: 4,
    }],
    docks: {
      nadh: dock({ x: CHAIN.I, y: 380 }, 'nadh', ['bus']),
      q: dock({ x: CHAIN.I - 16, y: STRIP_Y }, 'q', ['q']),
    },
  };
}

// ATP synthase: rotor in the strip, knob hanging into the matrix or cytoplasm.
export function atpSynthase(x = CHAIN.SYN) {
  const def = box('synthase', x, STRIP_Y + 40, 96, 150, {
    kind: 'synthase', reaction: 'synthase', zone: 'oxphos',
    rotor: { x, y: STRIP_Y, w: 70, h: 26 },
    knob: { x, y: 392, r: 30 },
    stator: { x: x + 47, y: STRIP_Y, w: 18, h: 36 },
    times: { load: 0.1, work: 0.3, unload: 0.1 },
  });
  return {
    ...def,
    modes: [{
      reaction: 'synthase',
      inputs: [
        { role: 'adp', from: 'dock', dock: 'adp' },
        { role: 'pi', from: 'dock', dock: 'pi' },
        { role: 'h', from: 'bulk', at: { x: x - 40, y: 400 } },
      ],
      outputs: [
        { role: 'atp', to: 'loop', loop: 'syn', at: { x, y: 440 } },
        { role: 'water', to: 'bulk', at: { x: x - 40, y: 420 } },
      ],
      pump: 4,
      pumpFrom: 'dock:h',
    }],
    // ADP and phosphate queue in pairs inside the synthase loop, under the
    // knob, clear of the carriers passing on either side (§16 W1).
    docks: {
      adp: dock({ x, y: 470 }, 'adp', ['syn'], { buffer: 1, places: [{ x, y: 470 }, { x, y: 534 }] }),
      pi: dock({ x, y: 500 }, 'pi', ['syn'], { buffer: 1, places: [{ x, y: 500 }, { x, y: 564 }] }),
      h: dock({ x: x + 47, y: 274 }, 'proton', [], { reservoir: true, count: 4, buffer: 8 }),
    },
  };
}

export function synthaseLoop(bottom = 880) {
  return loop('syn', [
    { x: CHAIN.SYN - 45, y: 440 }, { x: CHAIN.SYN - 45, y: bottom },
    { x: CHAIN.SYN + 45, y: bottom }, { x: CHAIN.SYN + 45, y: 440 },
  ], 45, { name: 'ATP and ADP', compartment: 'matrix', tint: 'carrier-adenosine' });
}

export function quinoneLoop(right) {
  return loop('q', [
    { x: CHAIN.I, y: STRIP_Y - 7 }, { x: right, y: STRIP_Y - 7 },
    { x: right, y: STRIP_Y + 7 }, { x: CHAIN.I, y: STRIP_Y + 7 },
  ], 7, { name: 'Ubiquinone', compartment: 'membrane', tint: 'carrier-q' });
}

// Taps and stubs ---------------------------------------------------------------

// Where each dock and each loop output meets its loop.
export function attachTaps(stations, loops) {
  for (const station of stations) {
    for (const entry of Object.values(station.docks ?? {})) {
      entry.taps = {};
      for (const id of entry.loops) entry.taps[id] = nearestS(loops[id].path, entry.at.x, entry.at.y);
    }
    for (const mode of station.modes) {
      for (const output of mode.outputs) {
        if (output.to !== 'loop' || output.loop.startsWith('source:')) continue;
        output.tap = nearestS(loops[output.loop].path, output.at.x, output.at.y);
      }
    }
  }
}

// Short connectors from each dock to its loop, drawn as tracks so every
// station is visibly joined to what feeds it.
export function makeStubs(stations, loops) {
  const list = [];
  const seen = new Set();
  const p = {};
  for (const station of stations) {
    const ends = [];
    for (const entry of Object.values(station.docks ?? {})) {
      for (const [loopId, s] of Object.entries(entry.taps ?? {})) ends.push({ at: entry.at, loopId, s });
    }
    for (const mode of station.modes) {
      for (const output of mode.outputs) {
        if (output.to === 'loop' && output.tap != null) ends.push({ at: output.at, loopId: output.loop, s: output.tap });
      }
    }
    for (const end of ends) {
      pointAt(loops[end.loopId].path, end.s, p);
      const key = `${station.id}:${Math.round(p.x)}:${Math.round(p.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const length = Math.hypot(p.x - end.at.x, p.y - end.at.y);
      if (length < 6) continue;
      list.push({ station: station.id, loop: end.loopId, from: { ...end.at }, to: { x: p.x, y: p.y } });
    }
  }
  return list;
}
