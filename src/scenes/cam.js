// A CAM leaf cell (pineapple, cacti), as data (M7b, M6 plan §3.6, §14). C3's
// cell and positions (D7), with the CO₂ pump split in time instead of space.
//
// By night the stomata open and the light is off. Glucose leaves the starch
// grain through the sugar exporter, night glycolysis splits it as far as
// PEP and NADH, PEP carboxylase fixes CO₂ from the air space onto PEP, and
// NAD-malate dehydrogenase makes malate, which is stored in the vacuole.
//
// By day the stomata close and the light comes on. Malate leaves the
// vacuole for the chloroplast, malic enzyme releases its CO₂ into the
// closed leaf's air space, where RuBisCO takes it, and the pyruvate goes
// back to sugar: PPDK makes PEP, which becomes 3-phosphoglycerate and joins
// the Calvin cycle at phosphoglycerate kinase. The ring's surplus G3P is
// made into glucose for the grain (starch synthesis), not exported.
//
// PEP carboxylase rests by day (malate inhibits it); RuBisCO, PPDK and
// malic enzyme rest by night (RuBisCO and PPDK need light to be switched
// on): the clock's patches (E10).

import { BUS, C3_RING, PEROXISOME, calvinCycle, lightReactions } from './c3.js';
import { inEllipse } from './geometry.js';
import { attachTaps, belt, box, circleZone, dock, drift, edge, loop, makeStubs, zonePath } from './parts.js';
import { LEAF, leafPlace, lumenReservoir } from './plant.js';

// The cell is C3's, the same size, with a wide, flat vacuole beneath the
// chloroplast and the night's machinery in the cytosol beside it. The
// nucleus is pressed against the wall on the left, as the vacuole pushes it
// in many plant cells (Nico, M8.13: the cell had been taller, with blank
// space above the vacuole).
export const LEAF_CAM = {
  ...LEAF,
  vacuole: { type: 'roundRect', x: 560, y: 1110, w: 740, h: 230, r: 100 },
  nucleus: { type: 'ellipse', cx: 40, cy: 790, rx: 46, ry: 78 },
  grana: [[1215, 1010]],
};

// The inspector's words for where a point is.
export function camPlace(x, y) {
  if (inEllipse(PEROXISOME, x, y)) return 'in a peroxisome';
  if (inEllipse(LEAF_CAM.nucleus, x, y)) return 'in the nucleus';
  const vac = LEAF_CAM.vacuole;
  if (x >= vac.x && x <= vac.x + vac.w && y >= vac.y && y <= vac.y + vac.h) {
    // Inside the vacuole's rounded box (the corners are cut by its radius).
    const cx = Math.min(Math.max(x, vac.x + vac.r), vac.x + vac.w - vac.r);
    const cy = Math.min(Math.max(y, vac.y + vac.r), vac.y + vac.h - vac.r);
    if (Math.hypot(x - cx, y - cy) <= vac.r) return 'in the vacuole';
  }
  const place = leafPlace(x, y);
  // C3's vacuole and nucleus are elsewhere: there, CAM's cell is cytosol.
  return place === 'in the vacuole' || place === 'in the nucleus' ? 'in the cytosol' : place;
}

export function buildCAM() {
  const strip = lightReactions(0);
  const { PSII, B6F, PSI, SYN } = strip.chain;
  const calvin = calvinCycle();
  const { pgpStation } = calvin;

  // The air space and the routes the gases take.
  const GAS = { x1: 10, x2: 1330, y1: LEAF.epidermis.y2 + 12, y2: LEAF.wall.y - 22 };
  const NIGHT_X = 120;

  // Night: in the cytosol under the chloroplast -------------------------------------

  // The sugar exporter on the chloroplast's lower envelope, beside the grain.
  const glcex = box('glcex', 548, 1054, 30, 36, { kind: 'transport', reaction: 'glc-out', zone: 'glycolysis', names: ['Export', 'Sugar exporter'], labelSide: 'right', times: { load: 0.25, work: 0.3, unload: 0.25 } });
  const nightgly = box('nightgly', 340, 1185, 320, 130, {
    kind: 'compound', reaction: 'nightgly', zone: 'pump', names: ['Glycolysis', 'Night glycolysis'],
    times: { load: 0.5, work: 4.2, unload: 0.5 },
    atpKind: 'held',
    // Each glucose broken down at night comes off the Glucose chip, so the
    // chip counts net sugar: six CO₂ fixed make one (§5.10).
    ledger: { glucose: -1 },
    // The hopper sits right of centre, clear of the station's name above it.
    hopper: { belts: ['glcex-ngly'], species: 'glucose', count: 1, dx: 56, dy: -44, places: [{ x: 396, y: 1141 }] },
    // Its own two adenosines, primed as ATP (§3.6).
    internal: { atpA: 'atp', atpB: 'atp' },
    internalAt: { atpA: { x: 122, y: -38 }, atpB: { x: 122, y: -4 } },
    inner: {
      cols: 5,
      scale: 4,
      dy: 4,
      // Sites 40 apart: pads 32 wide leave a gap between neighbours.
      pad: { w: 32, h: 20 },
      // A snake: the investment steps left to right along the top, the
      // payoff steps right to left along the bottom, ending by the belt to
      // PEP carboxylase. Each step is a short glide from the one before.
      sites: {
        hk: { x: -128, y: -2, name: 'HK' },
        pgi: { x: -88, y: -2, name: 'PGI' },
        pfk: { x: -48, y: -2, name: 'PFK' },
        ald: { x: -8, y: -2, name: 'Aldolase' },
        tpi: { x: 32, y: -2, name: 'TPI' },
        gapdh: { x: 72, y: 34, name: 'GAPDH', below: true },
        pgk: { x: 24, y: 34, name: 'PGK', below: true },
        pgm: { x: -24, y: 34, name: 'PGM', below: true },
        eno: { x: -72, y: 34, name: 'Enolase', below: true },
      },
      steps: { hexokinase: 'hk', pgi: 'pgi', pfk: 'pfk', aldolase: 'ald', tpi: 'tpi', gapdh: 'gapdh', pgk: 'pgk', pgm: 'pgm', enolase: 'eno' },
      rest: {
        pepA: { x: -130, y: 18 }, pepB: { x: -130, y: 40 },
        nadA: { x: 90, y: 54 }, nadB: { x: 118, y: 54 },
        atpA: { x: 122, y: -38 }, atpB: { x: 122, y: -4 },
        waterA: { x: 146, y: 20 }, waterB: { x: 146, y: 42 },
        h1: { x: -6, y: 56 }, h2: { x: 10, y: 56 }, h3: { x: 26, y: 56 }, h4: { x: 42, y: 56 },
      },
    },
  });
  const pepc = box('pepc', 90, 1185, 70, 56, { kind: 'enzyme', reaction: 'pepc', zone: 'pump', names: ['PEPC', 'PEP carboxylase'], times: { load: 0.25, work: 0.8, unload: 0.25 } });
  const mdh = box('mdhnad', 90, 1300, 70, 48, { kind: 'enzyme', reaction: 'mdh-nad', zone: 'pump', names: ['MDH', 'NAD-malate dehydrogenase'], times: { load: 0.25, work: 0.7, unload: 0.25 } });
  // The vacuole's malate store, along its upper edge (E11). Malate goes in
  // by night and comes back out by day, through the tonoplast.
  const MALATE = Array.from({ length: 4 }, (_, i) => ({ x: 740 + i * 120, y: 1300 }));
  const vacuole = box('vacuole', 925, 1300, 650, 64, {
    kind: 'store', zone: 'pump', look: 'vacuole', names: ['Malate store', 'Vacuole (malate store)'], labelSide: 'below',
    park: { species: 'malate', cap: 4, in: ['mdh-vac'], out: 'vac-dit', give: 'day', ahead: 1, places: MALATE },
    waits: 'Your atom is stored in the vacuole, in malate, until morning.',
  });

  // Day: on the stroma's right, beside the ring -------------------------------------------

  const dit = box('dit', 1294, 880, 30, 36, { kind: 'transport', reaction: 'dit', zone: 'pump', names: ['DiT', 'Dicarboxylate transporter'], labelSide: 'above-left', times: { load: 0.25, work: 0.3, unload: 0.25 } });
  const me = box('me', 1200, 880, 88, 60, { kind: 'enzyme', reaction: 'me', zone: 'pump', names: ['ME', 'NADP-malic enzyme'], labelSide: 'below', times: { load: 0.25, work: 0.8, unload: 0.25 } });
  const ppdk = box('ppdk', 1110, 590, 200, 100, {
    kind: 'compound', reaction: 'pump', zone: 'pump', names: ['PPDK', 'PPDK and recharge'],
    times: { load: 0.4, work: 2.4, unload: 0.4 },
    inner: {
      cols: 4,
      scale: 4,
      dy: 8,
      sites: {
        ppdk: { x: -56, y: 6, name: 'PPDK', below: true },
        adk: { x: 8, y: -12, name: 'Adenylate kinase' },
        ppase: { x: 64, y: 18, name: 'PPase', below: true },
      },
      steps: { ppdk: 'ppdk', adk: 'adk', ppase: 'ppase' },
      rest: {
        pep: { x: 0, y: -36 },
        adp1: { x: -84, y: -30 }, adp2: { x: -84, y: -8 },
        pi1: { x: -84, y: 14 }, pi2: { x: -84, y: 32 },
        h1: { x: 40, y: -36 }, h2: { x: 86, y: 36 },
      },
    },
  });
  const pep3pg = box('pep3pg', 1076, 735, 140, 64, {
    kind: 'compound', reaction: 'pep3pg', zone: 'pump', names: ['PEP→3-PG', 'PEP to 3-phosphoglycerate'],
    times: { load: 0.3, work: 1.2, unload: 0.3 },
    inner: {
      cols: 2,
      scale: 4,
      dy: 0,
      sites: { eno: { x: 26, y: -2, name: 'Enolase', below: true }, pgm: { x: -26, y: -2, name: 'PGM', below: true } },
      steps: { 'enolase-back': 'eno', 'pgm-back': 'pgm' },
      rest: { pg: { x: -30, y: 26 } },
    },
  });

  // Starch: under the bus, at the bottom of the stroma ------------------------------------

  const starch = box('starch', 700, 990, 240, 84, {
    kind: 'compound', reaction: 'starch', zone: 'glycolysis', names: ['Synthesis', 'Starch synthesis'],
    times: { load: 0.4, work: 3.2, unload: 0.4 },
    hopper: { belts: ['export'], species: 'g3p', count: 2, places: [{ x: 640, y: 966 }, { x: 680, y: 966 }] },
    inner: {
      cols: 4,
      scale: 4,
      dy: 12,
      sites: {
        tpi: { x: -90, y: 12, name: 'TPI', below: true },
        ald: { x: -45, y: 12, name: 'Aldolase', below: true },
        fbpase: { x: 0, y: 12, name: 'FBPase', below: true },
        pgi: { x: 45, y: 12, name: 'PGI', below: true },
        g6pase: { x: 90, y: 12, name: 'G6Pase', below: true },
      },
      steps: { 'tpi-back': 'tpi', 'aldolase-back': 'ald', fbpase: 'fbpase', 'pgi-back': 'pgi', g6pase: 'g6pase' },
      rest: { glc: { x: -96, y: -18 }, pi1: { x: 60, y: -26 }, pi2: { x: 90, y: -26 } },
    },
  });
  // The starch grain: glucose parked in a granule (E11), drawn at half size.
  const GRAIN = [];
  for (let row = 0; row < 2; row += 1) for (let col = 0; col < 6; col += 1) GRAIN.push({ x: 300 + col * 36, y: 970 + row * 32 });
  const grain = box('grain', 390, 986, 250, 80, {
    kind: 'store', zone: 'glycolysis', look: 'grain', names: ['Grain', 'Starch grain'], labelSide: 'above-left',
    park: { species: 'glucose', cap: 12, prime: 11, in: ['starch-grain'], out: 'grain-exp', give: 'night', ahead: 1, places: GRAIN, scale: 4 },
    waits: 'Your atom is stored in the starch grain. Night glycolysis will draw on it after dark, or the rest of the plant will take it.',
  });

  // Belts ----------------------------------------------------------------------------------

  const junction = { x: C3_RING.x, y: C3_RING.y + C3_RING.r };
  const camBelts = [
    belt('export', [junction, edge.top(starch)], { compartment: 'stroma', underpass: true }),
    belt('starch-grain', [{ x: starch.x - starch.w / 2, y: 970 }, { x: grain.x + grain.w / 2, y: 970 }], { compartment: 'stroma' }),
    belt('grain-exp', [{ x: grain.x + grain.w / 2, y: 1012 }, { x: glcex.x, y: 1012 }, edge.top(glcex)], { radius: 8, compartment: 'stroma' }),
    belt('glcex-ngly', [edge.bottom(glcex), { x: glcex.x, y: 1094 }, { x: nightgly.x + 56, y: 1094 }, { x: nightgly.x + 56, y: nightgly.y - nightgly.h / 2 }], { radius: 8, compartment: 'cytosol' }),
    belt('ngly-pepc', [edge.left(nightgly), edge.right(pepc)], { compartment: 'cytosol' }),
    belt('pepc-mdh', [edge.bottom(pepc), edge.top(mdh)], { compartment: 'cytosol' }),
    belt('mdh-vac', [edge.right(mdh), edge.left(vacuole)], { compartment: 'cytosol' }),
    belt('vac-dit', [edge.right(vacuole), { x: 1340, y: vacuole.y }, { x: 1340, y: dit.y }, edge.right(dit)], { radius: 10, compartment: 'cytosol' }),
    belt('dit-me', [edge.left(dit), edge.right(me)], { compartment: 'stroma' }),
    belt('me-ppdk', [{ x: me.x - 16, y: me.y - me.h / 2 }, { x: me.x - 16, y: ppdk.y + ppdk.h / 2 }], { compartment: 'stroma' }),
    belt('ppdk-pep3pg', [{ x: pep3pg.x, y: ppdk.y - ppdk.h / 2 }, edge.bottom(pep3pg)], { compartment: 'stroma' }),
    // 3-PG joins the ring at phosphoglycerate kinase, passing under the bus.
    belt('pep3pg-pgk', [edge.bottom(pep3pg), { x: pep3pg.x, y: 800 }, { x: 872, y: 800 }, { x: 872, y: 548 }, { x: 848.5, y: 548 }], { radius: 8, compartment: 'stroma', underpass: true }),
  ];
  const belts = [...calvin.belts.filter((entry) => entry.id !== 'export' && entry.id !== 'tpt-hexose'), ...camBelts];

  // Stations -------------------------------------------------------------------------------

  const camStations = [
    {
      ...grain,
      modes: [],
    },
    {
      ...glcex,
      modes: [
        // The rest of the plant takes glucose at a steady rate, and all the
        // grain cannot hold (CAM's life rule).
        { reaction: 'glc-out', when: 'drain', inputs: [{ role: 'glcIn', from: 'belt', belts: ['grain-exp'] }], outputs: [{ role: 'glcOut', to: 'exhaust', drift: 'sugar' }] },
        { reaction: 'glc-out', inputs: [{ role: 'glcIn', from: 'belt', belts: ['grain-exp'] }], outputs: [{ role: 'glcOut', to: 'belt', belt: 'glcex-ngly', max: 1 }] },
      ],
    },
    {
      ...nightgly,
      modes: [{
        reaction: 'nightgly',
        inputs: [
          { role: 'glc', from: 'hopper', index: 0 },
          { role: 'atpA', from: 'internal', slot: 'atpA' },
          { role: 'atpB', from: 'internal', slot: 'atpB' },
          { role: 'nadA', from: 'dock', dock: 'nad', slot: 0 },
          { role: 'nadB', from: 'dock', dock: 'nad', slot: 1 },
          { role: 'piA', from: 'dock', dock: 'pi', slot: 0 },
          { role: 'piB', from: 'dock', dock: 'pi', slot: 1 },
        ],
        outputs: [
          { role: 'pepA', to: 'belt', belt: 'ngly-pepc', max: 1 },
          { role: 'pepB', to: 'belt', belt: 'ngly-pepc' },
          { role: 'nadA', to: 'loop', loop: 'nadc', at: { x: 196, y: 1270 } },
          { role: 'nadB', to: 'loop', loop: 'nadc', at: { x: 226, y: 1270 } },
          { role: 'atpA', to: 'internal', slot: 'atpA' },
          { role: 'atpB', to: 'internal', slot: 'atpB' },
          ...[1, 2, 3, 4].map((n) => ({ role: `h${n}`, to: 'bulk', at: { x: 350 + 22 * n, y: 1268 } })),
          { role: 'waterA', to: 'bulk', at: { x: 522, y: 1160 } },
          { role: 'waterB', to: 'bulk', at: { x: 522, y: 1186 } },
        ],
      }],
      docks: {
        nad: dock({ x: 200, y: 1260 }, 'nad', ['nadc'], { count: 2, places: [{ x: 222, y: 1260 }, { x: 250, y: 1260 }] }),
        pi: dock({ x: 200, y: 1112 }, 'pi', ['pic'], { count: 2, places: [{ x: 214, y: 1110 }, { x: 246, y: 1110 }] }),
      },
    },
    {
      ...pepc,
      modes: [{
        reaction: 'pepc',
        inputs: [
          { role: 'pep', from: 'belt', belts: ['ngly-pepc'] },
          { role: 'co2', from: 'dock', dock: 'gas' },
          { role: 'water', from: 'bulk', at: { x: pepc.x - 50, y: pepc.y } },
        ],
        outputs: [
          { role: 'oaa', to: 'belt', belt: 'pepc-mdh', max: 1 },
          { role: 'pi', to: 'loop', loop: 'pic', at: { x: 150, y: 1094 } },
          { role: 'h', to: 'bulk', at: { x: pepc.x - 50, y: pepc.y + 20 } },
        ],
      }],
      docks: { gas: dock({ x: 100, y: 1124 }, 'co2', [], { buffer: 2, places: [{ x: 100, y: 1124 }, { x: NIGHT_X, y: 1092 }, { x: NIGHT_X, y: 1062 }] }) },
    },
    {
      ...mdh,
      modes: [{
        reaction: 'mdh-nad',
        inputs: [
          { role: 'oaa', from: 'belt', belts: ['pepc-mdh'] },
          { role: 'nadh', from: 'dock', dock: 'nadh' },
          { role: 'h', from: 'bulk', at: { x: mdh.x - 50, y: mdh.y } },
        ],
        outputs: [
          { role: 'mal', to: 'belt', belt: 'mdh-vac', max: 1 },
          { role: 'nad', to: 'loop', loop: 'nadc', at: { x: 160, y: 1290 } },
        ],
      }],
      docks: { nadh: dock({ x: 146, y: 1292 }, 'nadh', ['nadc']) },
    },
    {
      ...vacuole,
      modes: [],
    },
    {
      ...dit,
      modes: [{ reaction: 'dit', inputs: [{ role: 'malIn', from: 'belt', belts: ['vac-dit'] }], outputs: [{ role: 'malOut', to: 'belt', belt: 'dit-me' }] }],
    },
    {
      ...me,
      modes: [{
        reaction: 'me',
        inputs: [{ role: 'mal', from: 'belt', belts: ['dit-me'] }, { role: 'nadp', from: 'dock', dock: 'nadp' }],
        outputs: [
          { role: 'pyr', to: 'belt', belt: 'me-ppdk' },
          // The CO₂ joins the air space of the closed leaf, where RuBisCO
          // draws it; nothing else takes it by day. Malic enzyme waits while
          // the air already holds as much as the outside air, so it keeps pace
          // with RuBisCO.
          { role: 'co2', to: 'exhaust', drift: 'meco2', join: 'gas', cap: 8 },
          { role: 'nadph', to: 'loop', loop: 'sbus', at: { x: BUS.right, y: me.y + 24 } },
        ],
      }],
      docks: { nadp: dock({ x: 1000, y: me.y - 6 }, 'nadp', ['sbus']) },
    },
    {
      ...ppdk,
      modes: [{
        reaction: 'pump',
        inputs: [
          { role: 'pyr', from: 'belt', belts: ['me-ppdk'] },
          { role: 'atp1', from: 'dock', dock: 'atp', slot: 0 },
          { role: 'atp2', from: 'dock', dock: 'atp', slot: 1 },
          { role: 'pi', from: 'dock', dock: 'pi' },
          { role: 'water', from: 'bulk', at: { x: ppdk.x + 60, y: ppdk.y + 64 } },
        ],
        outputs: [
          { role: 'pep', to: 'belt', belt: 'ppdk-pep3pg' },
          { role: 'adp1', to: 'loop', loop: 'sbus', at: { x: BUS.right, y: 560 } },
          { role: 'adp2', to: 'loop', loop: 'sbus', at: { x: BUS.right, y: 582 } },
          { role: 'pi1', to: 'loop', loop: 'sbus', at: { x: BUS.right, y: 604 } },
          { role: 'pi2', to: 'loop', loop: 'sbus', at: { x: BUS.right, y: 626 } },
          { role: 'h1', to: 'bulk', at: { x: ppdk.x + 120, y: ppdk.y - 20 } },
          { role: 'h2', to: 'bulk', at: { x: ppdk.x + 120, y: ppdk.y + 20 } },
        ],
      }],
      docks: {
        atp: dock({ x: 1056, y: 506 }, 'atp', ['sbus'], { count: 2, places: [{ x: 1040, y: 506 }, { x: 1100, y: 506 }] }),
        pi: dock({ x: 1160, y: 506 }, 'pi', ['sbus']),
      },
    },
    {
      ...pep3pg,
      modes: [{
        reaction: 'pep3pg',
        inputs: [{ role: 'pep', from: 'belt', belts: ['ppdk-pep3pg'] }, { role: 'water', from: 'bulk', at: { x: pep3pg.x + 90, y: pep3pg.y + 20 } }],
        outputs: [{ role: 'pg', to: 'belt', belt: 'pep3pg-pgk' }],
      }],
    },
    {
      ...starch,
      modes: [{
        reaction: 'starch',
        inputs: [
          { role: 'x', from: 'hopper', index: 0 }, { role: 'y', from: 'hopper', index: 1 },
          { role: 'water1', from: 'bulk', at: { x: starch.x + 140, y: starch.y } },
          { role: 'water2', from: 'bulk', at: { x: starch.x + 140, y: starch.y + 20 } },
        ],
        outputs: [
          { role: 'glc', to: 'belt', belt: 'starch-grain' },
          { role: 'pi1', to: 'loop', loop: 'sbus', at: { x: starch.x + 60, y: BUS.bottom } },
          { role: 'pi2', to: 'loop', loop: 'sbus', at: { x: starch.x + 90, y: BUS.bottom } },
        ],
      }],
    },
  ];

  // The Calvin cycle as C3's, without the triose phosphate translocator and
  // hexose assembly; phosphoglycerate kinase also takes the day's 3-PG.
  const calvinStations = calvin.stations
    .filter((def) => def.id !== 'tpt' && def.id !== 'hexose')
    .map((def) => {
      if (def.id !== 'pgk') return def;
      const mode = def.modes[0];
      return { ...def, modes: [{ ...mode, inputs: [{ ...mode.inputs[0], belts: ['rubisco-pgk', 'pep3pg-pgk'] }, ...mode.inputs.slice(1)] }] };
    });

  // Cytochrome b₆f carries linear and cyclic flow, as in C4.
  const lightStations = strip.stations.map((def) => (def.id === 'b6f' ? { ...def, times: { load: 0.2, work: 0.3, unload: 0.2 } } : def));
  const stations = [...lightStations, ...calvinStations, ...camStations];

  const loops = {
    ...strip.loops,
    sbus: loop('sbus', [
      { x: BUS.end, y: BUS.topIn }, { x: BUS.rightIn, y: BUS.topIn }, { x: BUS.rightIn, y: BUS.bottomIn },
      { x: BUS.leftIn, y: BUS.bottomIn }, { x: BUS.leftIn, y: BUS.start }, { x: BUS.left, y: BUS.start },
      { x: BUS.left, y: BUS.bottom }, { x: BUS.right, y: BUS.bottom }, { x: BUS.right, y: BUS.top }, { x: BUS.end, y: BUS.top },
    ], 15, { name: 'Stroma carriers', compartment: 'stroma', tint: 'carrier-nad', hot: true, speed: 400 }),
    // The night's short cytosolic loops: phosphate from PEP carboxylase back
    // to night glycolysis, and NAD between it and malate dehydrogenase.
    pic: loop('pic', [{ x: 150, y: 1084 }, { x: 262, y: 1084 }, { x: 262, y: 1100 }, { x: 150, y: 1100 }], 8, { name: 'Phosphate', compartment: 'cytosol', tint: 'carrier-adenosine' }),
    nadc: loop('nadc', [{ x: 150, y: 1270 }, { x: 262, y: 1270 }, { x: 262, y: 1290 }, { x: 150, y: 1290 }], 8, { name: 'NAD', compartment: 'cytosol', tint: 'carrier-nad' }),
  };
  attachTaps(stations, loops);

  // Lanes and drifts ------------------------------------------------------------------------

  const TRAY = {
    water: { x: 240, y: 96 },
    co2: { x: 140, y: -262 },
    prompt: { x: 330, y: -282 },
  };
  const EXPORT_X = 515;
  const drifts = {
    h2o: drift([TRAY.water, { x: 240, y: 236 }, { x: PSII - 34, y: 252 }], 20),
    co2: drift([{ x: 140, y: GAS.y1 + 20 }, { x: 140, y: 382 }, { x: 596, y: 382 }], 24),
    // By night, CO₂ from the air space down the cytosol to PEP carboxylase.
    co2n: drift([{ x: NIGHT_X, y: GAS.y1 + 20 }, { x: NIGHT_X, y: 1092 }], 24),
    o2: drift([{ x: PSII + 30, y: 262 }, { x: 420, y: 230 }, { x: 420, y: -40 }], 40),
    arriveWater: drift([{ x: -160, y: TRAY.water.y }, TRAY.water]),
    arriveCo2: drift([{ x: 140, y: -600 }, TRAY.co2]),
    glycolate: Object.assign(drift([edge.left(pgpStation), { x: 166, y: 478 }, { x: PEROXISOME.cx, y: PEROXISOME.cy }], 10), { fade: 50 }),
    // Malic enzyme's CO₂ rises past the thylakoid into the air space.
    meco2: Object.assign(drift([{ x: me.x + 30, y: me.y - me.h / 2 }, { x: 1262, y: 820 }, { x: 1262, y: -60 }], 30), { speed: 200 }),
    // Glucose the rest of the plant takes leaves through the export port.
    sugar: Object.assign(drift([edge.bottom(glcex), { x: EXPORT_X, y: 1120 }, { x: EXPORT_X, y: LEAF_CAM.cell.y + LEAF_CAM.cell.h + 120 }], 10), { fade: 60 }),
  };

  // Zones and labels -------------------------------------------------------------------------

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
      id: 'night',
      name: 'CO₂ Capture',
      sub: 'by night',
      token: 'zone-pump',
      path: zonePath([{ x: 20, y: 1076 }, { x: 516, y: 1076 }, { x: 516, y: 1340 }, { x: 20, y: 1340 }], 22),
      label: { x: 506, y: 1300, align: 'right' },
    },
    {
      id: 'day',
      name: 'CO₂ Release',
      sub: 'by day',
      token: 'zone-pump',
      path: zonePath([{ x: 994, y: 494 }, { x: 1270, y: 494 }, { x: 1270, y: 924 }, { x: 994, y: 924 }], 22),
      label: { x: 1262, y: 958, align: 'right' },
    },
    {
      id: 'starch',
      name: 'Starch',
      token: 'zone-glycolysis',
      path: zonePath([{ x: 254, y: 942 }, { x: 832, y: 942 }, { x: 832, y: 1040 }, { x: 254, y: 1040 }], 18),
      label: { x: 850, y: 1000, align: 'left' },
    },
  ];

  const labels = [
    { text: 'Air Space', x: 700, y: -70, kind: 'compartment' },
    { text: 'Upper epidermis', x: 760, y: -175, kind: 'membrane', lod: 'mid' },
    { text: 'Stoma', x: 222, y: -175, kind: 'membrane', lod: 'mid' },
    { text: 'Chloroplast', x: 1150, y: 1082, kind: 'compartment' },
    { text: 'Stroma', x: 1150, y: 470, kind: 'compartment' },
    { text: 'Thylakoid Lumen', x: 740, y: 222, kind: 'compartment', lod: 'near' },
    { text: 'Thylakoid membrane', x: (B6F + PSI) / 2 - 2, y: 300, kind: 'membrane', lod: 'mid' },
    { text: 'Cytosol', x: 1230, y: 96, kind: 'compartment' },
    { text: 'Vacuole', x: LEAF_CAM.vacuole.x + LEAF_CAM.vacuole.w / 2, y: LEAF_CAM.vacuole.y + 48, kind: 'compartment' },
    { text: 'Peroxisome', x: PEROXISOME.cx, y: PEROXISOME.cy + PEROXISOME.ry + 16, kind: 'compartment', lod: 'mid' },
    { text: 'Nucleus', x: LEAF_CAM.nucleus.cx, y: LEAF_CAM.nucleus.cy + LEAF_CAM.nucleus.ry + 34, kind: 'compartment' },
    { text: 'Carboxylation', x: C3_RING.x, y: C3_RING.y - 72, kind: 'phase', token: 'zone-krebs' },
    { text: 'Reduction', x: C3_RING.x + 70, y: C3_RING.y + 40, kind: 'phase', token: 'zone-krebs' },
    { text: 'Regeneration', x: C3_RING.x + 30, y: C3_RING.y + 112, kind: 'phase', token: 'zone-krebs' },
  ];

  const pores = [
    { id: 'export-port', name: 'Sugar export (to the phloem)', short: 'Export', x: EXPORT_X, y: LEAF_CAM.cell.y + LEAF_CAM.cell.h, membrane: 'cell', w: 30, h: 28 },
    { id: 'salvage', name: 'Glycolate transporter', short: 'PLGG1', x: 166, y: 478, membrane: 'chloroplast', w: 28, h: 30, quiet: true, label: 'above' },
    { id: 'tono-in', name: 'Tonoplast malate channel', short: 'Malate', x: 582, y: vacuole.y, membrane: 'chloroplast', w: 26, h: 30, quiet: true, label: 'above' },
    { id: 'tono-out', name: 'Tonoplast malate channel', short: 'Malate', x: 1277, y: vacuole.y, membrane: 'chloroplast', w: 26, h: 30, quiet: true, label: 'above' },
  ];

  const ring = {
    ...C3_RING,
    belts: ['regen-rubisco', 'rubisco-pgk', 'pgk-gapdh', 'gapdh-junction', 'junction-regen'],
    stations: ['rubisco', 'pgk', 'gapdh', 'regen'],
  };

  return {
    id: 'cam',
    tab: 'photosynthesis',
    pathway: 'cam',
    bounds: LEAF_CAM.bounds,
    leaf: LEAF_CAM,
    place: camPlace,
    peroxisome: PEROXISOME,
    fadeTop: LEAF.epidermis.y1 - 20,
    fadeBottom: LEAF_CAM.cell.y + LEAF_CAM.cell.h,
    stations,
    belts,
    loops,
    stubs: makeStubs(stations, loops),
    drifts,
    lanes: [
      { id: 'h2o', drift: 'h2o', name: 'H₂O', supply: 'water' },
      { id: 'co2', drift: 'co2', name: 'CO₂' },
      { id: 'co2n', drift: 'co2n', name: 'CO₂' },
    ],
    supplies: [
      { id: 'water', species: 'water', lane: 'h2o', arrive: 'arriveWater', station: 'psii', dock: 'h2o', ahead: 4 },
    ],
    gas: {
      region: GAS,
      ambient: { co2: 8, oxygen: 8 },
      conductance: 0.25,
      stoma: { x: LEAF.stoma.x, inner: LEAF.epidermis.y2, outer: LEAF.epidermis.y1, exit: -470 },
      trays: [{ id: 'co2', species: 'co2', arrive: 'arriveCo2' }],
      draws: [
        // By night PEP carboxylase takes CO₂ from the air space, never O₂.
        { station: 'pepc', dock: 'gas', species: ['co2'], route: [{ x: NIGHT_X, y: GAS.y1 + 20 }, { x: NIGHT_X, y: 1074 }], lane: 'co2n', ahead: 3 },
        // By day RuBisCO takes CO₂ or O₂ from the closed air space (§3.4).
        { station: 'rubisco', dock: 'gas', species: ['co2', 'oxygen'], specificity: 32, route: [{ x: 140, y: GAS.y1 + 20 }, { x: 140, y: 382 }], lane: 'co2', ahead: 2 },
      ],
    },
    // The day and the night (E10): 80 s at 1x, 46 s of light and 34 of dark,
    // starting 8 s before dusk.
    clock: {
      period: 80,
      dayLength: 46,
      start: 38,
      phases: {
        day: { light: true, stomata: 0, off: ['pepc'] },
        // In the dark RuBisCO is not activated, PPDK is switched off by its
        // regulatory protein, and malic enzyme waits for the morning.
        night: { light: false, stomata: 1, off: ['rubisco', 'ppdk', 'me'] },
      },
    },
    // CAM needs 6 ATP to 2 NADPH per CO₂ by day: photosystem I takes about
    // twice the photons of photosystem II, the extra for cyclic flow.
    light: { psii: { ...strip.light.psii, flux: 1.2 }, psi: { ...strip.light.psi, flux: 2.6 } },
    exportDrift: 'sugar',
    matrixCrossings: [{ a: 'export', b: 'sbus' }, { a: 'pep3pg-pgk', b: 'sbus' }],
    zones,
    pores,
    labels,
    tray: TRAY,
    chain: { PSII, B6F, PSI, SYN },
    reservoir: lumenReservoir(),
    ring,
    skeletons: [
      ['rubp', 'regen-rubisco', 2, 0.85],
      ['rubp', 'rubisco-pgk', 0],
      ['pg3', 'rubisco-pgk', 2, 0.8],
      ['bpg', 'pgk-gapdh', 2, 0.8],
      ['g3p', 'gapdh-junction', 1, 0.5],
      ['g3p', 'junction-regen', 4, 0.9],
    ],
    // CAM lives on its starch grain (E11): the rest of the plant takes a
    // glucose about every four minutes.
    life: { kind: 'store', station: 'grain', belts: ['grain-exp'], stations: ['glcex'], drain: 1 / 240, starveAfter: 20 },
    gauges: ['reserve', 'protons'],
    ledger: {
      photons: 0, quenched: 0, split: 0, o2: 0, fixed: 0, glucose: 0, exported: 0, h2o: 0, co2: 0,
      atp: 0, atpSub: 0, atpOx: 0, atpPhoto: 0, atpUsed: 0, nadph: 0, nadphUsed: 0, cyclic: 0, oxygenated: 0, glycolate: 0,
      pumped: 0, released: 0,
    },
    params: {
      protons: 20,
      // The ring's belts rest soon after the last flux, so the cycle is
      // seen to stop at night (L6).
      holdBelt: 6,
      prime: {
        pq: [['pq', 9]],
        pc: [['pc', 10]],
        fd: [['fd', 12]],
        sbus: [['atp', 10], ['nadp', 6], ['adp', 8], ['nadph', 6], ['pi', 14]],
        pic: [['pi', 4]],
        nadc: [['nad', 4]],
      },
    },
  };
}


export const camScene = buildCAM();
