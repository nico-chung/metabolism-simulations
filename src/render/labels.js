import { REACTIONS } from '../chem/reactions/catalog.js';
import { worldToScreen } from './camera.js';
import { lodAt } from './lod.js';
import { setScreen, setWorld } from './view.js';

const FONT_FALLBACK = 'system-ui, sans-serif';

const NAMES = {
  complex1: ['I', 'Complex I'],
  complex2: ['II', 'Complex II · succinate dehydrogenase'],
  complex3: ['III', 'Complex III'],
  complex4: ['IV', 'Complex IV'],
  synthase: ['ATP synthase', 'ATP synthase'],
  shuttle: ['Shuttle', 'NADH shuttle'],
  ant: ['ANT', 'ATP–ADP translocase (ANT)'],
  workm: ['Work', 'Cell work'],
  workc: ['Work', 'Cell work'],
};

function stationNames(def) {
  if (def.names) return def.names;
  if (NAMES[def.id]) return NAMES[def.id];
  const reaction = REACTIONS[def.reaction];
  return [reaction.short, reaction.enzyme];
}

// Every label on the stage at a given level of detail, in world positions
// with a screen font size. Pure, so the layout test can check overlaps.
export function labelList(scene, lod) {
  const list = [];
  for (const zone of scene.zones) {
    list.push({ text: zone.name, x: zone.label.x, y: zone.label.y, size: 13, weight: 600, align: zone.label.align, kind: 'zone', token: zone.token });
    if (zone.sub && lod !== 'far') list.push({ text: zone.sub, x: zone.label.x, y: zone.label.y + 18, size: 11, weight: 400, align: zone.label.align, kind: 'zone', screenDy: 16, token: zone.token });
    if (zone.parts && lod !== 'far') {
      // A part named like a station says it only at Mid; at Near the station
      // carries its full name itself.
      for (const part of zone.parts) if (!(part.midOnly && lod === 'near')) list.push({ text: part.name, x: part.x, y: part.y, size: 11, weight: 500, align: 'center', kind: 'zone', token: zone.token });
    }
  }
  for (const label of scene.labels) {
    if (label.lod === 'mid' && lod === 'far') continue;
    // A label crowded at Mid (CAM's smaller Fit) waits for Near.
    if (label.lod === 'near' && lod !== 'near') continue;
    if (label.kind === 'phase' && lod === 'far') continue;
    list.push({ text: label.text, x: label.x, y: label.y, size: 12, weight: label.kind === 'phase' ? 500 : 400, align: 'center', kind: label.kind, token: label.token });
  }
  if (lod === 'far') return list;
  for (const def of scene.stations) {
    const [short, full] = stationNames(def);
    const text = lod === 'near' ? full : short;
    const at = stationLabelAt(scene, def);
    list.push({ text, x: at.x, y: at.y, size: lod === 'near' ? 12 : 11, weight: 500, align: at.align, baseline: at.baseline, kind: 'station', station: def.id });
  }
  for (const pore of scene.pores) {
    if (pore.quiet && lod !== 'near') continue;
    const text = lod === 'near' ? `${pore.name} (${pore.short})` : pore.short;
    if (pore.label === 'above') {
      list.push({ text, x: pore.x, y: pore.y - pore.h / 2 - 4, size: 10.5, weight: 400, align: 'center', baseline: 'bottom', kind: 'pore' });
      continue;
    }
    const left = pore.membrane === 'cell';
    list.push({ text, x: pore.x + (left ? 24 : 22), y: pore.y + (left ? -22 : 0), size: 10.5, weight: 400, align: 'left', kind: 'pore' });
  }
  if (lod === 'near') {
    const syn = scene.stations.find((def) => def.kind === 'synthase');
    if (syn) {
      list.push({ text: 'Rotor', x: syn.rotor.x - syn.rotor.w / 2 - 6, y: syn.rotor.y + 26, size: 10.5, weight: 400, align: 'right', kind: 'part' });
      list.push({ text: 'Stator', x: syn.stator.x + 14, y: syn.stator.y + 22, size: 10.5, weight: 400, align: 'left', kind: 'part' });
      list.push({ text: 'Internal rod', x: syn.rotor.x - 10, y: (syn.rotor.y + syn.knob.y) / 2 + 6, size: 10.5, weight: 400, align: 'right', kind: 'part' });
      list.push({ text: 'Catalytic knob', x: syn.knob.x - syn.knob.r - 8, y: syn.knob.y + 10, size: 10.5, weight: 400, align: 'right', kind: 'part' });
    }
  }
  return list;
}

function stationLabelAt(scene, def) {
  // A station whose usual side is crowded names itself on another.
  if (def.labelSide === 'right') return { x: def.x + def.w / 2 + 6, y: def.y + 16, align: 'left', baseline: 'top' };
  if (def.labelSide === 'below') return { x: def.x, y: def.y + def.h / 2 + 6, align: 'center', baseline: 'top' };
  if (def.labelSide === 'above-left') return { x: def.x - def.w / 2 - 6, y: def.y - def.h / 2 - 4, align: 'right', baseline: 'bottom' };
  if (def.deg != null && def.zone === 'krebs') {
    const a = (def.deg * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    // Stations at the sides keep their names under them, clear of the
    // cycle's own name in the middle.
    if (Math.abs(dx) > 0.7) return { x: def.x, y: def.y + def.h / 2 + 6, align: 'center', baseline: 'top' };
    const r = scene.ring.r - Math.max(def.w, def.h) / 2 - 16;
    return {
      x: scene.ring.x + dx * r,
      y: scene.ring.y + dy * r,
      align: Math.abs(dx) < 0.3 ? 'center' : dx > 0 ? 'right' : 'left',
      baseline: 'middle',
    };
  }
  if (def.kind === 'complex' || def.kind === 'synthase') {
    // Complexes III and IV carry the cytochrome c loop above them, so their
    // names sit above the loop rather than on it.
    const loopAbove = Boolean(scene.loops?.cyt) && (def.id === 'complex3' || def.id === 'complex4');
    const top = def.kind === 'synthase' ? def.rotor.y - def.rotor.h / 2 : loopAbove ? 232 : def.y - def.h / 2;
    return { x: def.kind === 'synthase' ? def.rotor.x : def.x, y: top - 8, align: 'center', baseline: 'bottom' };
  }
  if (def.kind === 'transport') return { x: def.x - def.w / 2 - 6, y: def.y + 16, align: 'right', baseline: 'top' };
  if (def.kind === 'work') return { x: def.x, y: def.y + def.h / 2 + 6, align: 'center', baseline: 'top' };
  return { x: def.x, y: def.y - def.h / 2 - 6, align: 'center', baseline: 'bottom' };
}

export function drawLabels(ctx, frame) {
  const { scene, tokens, camera, viewport } = frame;
  const lod = lodAt(camera.zoom, frame.fitZoom || camera.zoom);
  const font = tokens.font || FONT_FALLBACK;
  ctx.save();
  setScreen(ctx, frame.dpr);
  for (const label of labelList(scene, lod)) {
    const screen = worldToScreen(camera, viewport, label.x, label.y);
    if (screen.x < -200 || screen.y < -40 || screen.x > viewport.width + 200 || screen.y > viewport.height + 40) continue;
    const y = screen.y + (label.screenDy ? label.screenDy - 18 * camera.zoom : 0);
    ctx.font = `${label.weight} ${label.size}px ${font}`;
    ctx.textAlign = label.align ?? 'center';
    ctx.textBaseline = label.baseline ?? 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = tokens.paper;
    ctx.globalAlpha = 0.85;
    ctx.strokeText(label.text, screen.x, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = label.token ? tokens[label.token] : label.kind === 'zone' ? tokens.ink : tokens['ink-soft'];
    ctx.fillText(label.text, screen.x, y);
  }
  ctx.restore();
  setWorld(ctx, frame.dpr, frame.viewport, camera);
}
