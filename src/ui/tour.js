// The welcome card and the four-step tour (M8.11). The overlay dims the whole
// window except one rounded hole, which clicks pass through, and puts a small
// card beside the hole. One flag in local storage remembers that the welcome
// was seen: no cookies, nothing sent anywhere.

export const WELCOME_KEY = 'metasim.welcome';

export const WELCOME = {
  title: 'metasim',
  text: 'metasim follows single atoms through cellular respiration and photosynthesis. Every atom keeps its identity: tag one and press play to follow it, reaction by reaction. Apply a poison or a drought to see how the whole network responds.',
};

// Text may mark italics with *asterisks*. Targets other than the feed
// molecule are parts of the page, found by selector.
export const STEPS = [
  {
    target: 'feed',
    title: 'Tag an atom',
    text: {
      respiration: 'This glucose is about to enter the cell. Every atom in it can be tagged. Click one.',
      photosynthesis: 'This CO₂ is about to enter the leaf. Every atom in it can be tagged. Click one.',
    },
  },
  {
    target: 'inspector',
    title: 'The inspector',
    text: {
      respiration: 'Your atom glows and the rest fades. The inspector follows it: the molecule it is in, its position, its oxidation state and its charge.',
      photosynthesis: 'Your atom glows and the rest fades. The inspector follows it: the molecule it is in, its position, its oxidation state and its charge.',
    },
  },
  {
    target: 'controls',
    title: 'Change the cell',
    text: {
      respiration: 'Switch to photosynthesis, choose yeast or *E. coli*, or poison the cell with cyanide, and observe how the effects spread. The ? button in the corner replays this tour.',
      photosynthesis: 'Switch to respiration, choose C4 or CAM, or impose a hot, dry day, and observe how the effects spread. The ? button in the corner replays this tour.',
    },
  },
  {
    target: 'transport',
    title: 'Press play',
    text: {
      respiration: 'Press Play, or Space. The camera follows your atom and pauses at each turning point to explain it. The arrows step one reaction back or forward.',
      photosynthesis: 'Press Play, or Space. The camera follows your atom and pauses at each turning point to explain it. The arrows step one reaction back or forward.',
    },
  },
];

const TARGETS = {
  inspector: ['.inspector'],
  controls: ['.tabs', '.panel:not([hidden])'],
  transport: ['.transport', '.follow.shown'],
};

// Sides to try for the card, in order, per target.
const SIDES = {
  feed: ['right', 'left', 'below', 'above'],
  inspector: ['left', 'below', 'above'],
  controls: ['left', 'below'],
  transport: ['above', 'right'],
};

// Moving from one step to the next: the hole glides from where it was (or
// from the welcome card) to its new place, and the card follows and fades in.
const MOVE_MS = 750;
const GAP = 16;
const MARGIN = 12;
const PAD = 6;
const SVG = 'http://www.w3.org/2000/svg';

// Whether the welcome opens on load: only on the first visit, and never with
// ?debug, so test sessions are not interrupted. Storage that is missing or
// throws counts as a first visit.
export function shouldWelcome(storage, search = '') {
  if (new URLSearchParams(search).has('debug')) return false;
  try {
    return storage?.getItem(WELCOME_KEY) !== 'seen';
  } catch {
    return true;
  }
}

function markSeen(storage) {
  try {
    storage?.setItem(WELCOME_KEY, 'seen');
  } catch {
    // Blocked storage: the welcome shows again next time, nothing else.
  }
}

export function plainText(text) {
  return text.replaceAll('*', '');
}

// handlers: storage, tab() → 'respiration' | 'photosynthesis', stage() → the
// stage's client rect, feed() → the feed molecule's client rect or null,
// spot() → the tagged atom's client circle or null, enter(step) and
// next(step) for the step's own moves, play() for the last step's Play.
export function createTour(handlers) {
  const root = document.createElement('div');
  root.className = 'tour';
  root.hidden = true;
  const svg = document.createElementNS(SVG, 'svg');
  const scrim = document.createElementNS(SVG, 'path');
  scrim.setAttribute('class', 'scrim');
  const ring = document.createElementNS(SVG, 'rect');
  ring.setAttribute('class', 'ring');
  const halo = document.createElementNS(SVG, 'circle');
  halo.setAttribute('class', 'ring');
  svg.append(scrim, ring, halo);
  const card = document.createElement('div');
  card.className = 'tour-card';
  root.append(svg, card);
  document.body.append(root);

  // -1 is the welcome card; 0 to 3 are the steps.
  let index = -1;
  let shownTab = null;
  let loop = 0;
  let shownHole = null;
  // Whether the card has a place on screen yet: the welcome fades in where
  // it belongs instead of gliding from wherever the card last was.
  let placed = false;
  let from = null;
  let fromCard = null;
  let since = 0;

  card.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const act = button.dataset.act;
    if (act === 'tour') go(0);
    else if (act === 'back') go(index - 1);
    else if (act === 'next') {
      handlers.next?.(STEPS[index]);
      go(index + 1);
    } else if (act === 'play') play();
    else close();
  });

  function go(next) {
    from = shownHole ?? (placed ? rectOf(card) : null);
    fromCard = placed ? { x: card.offsetLeft, y: card.offsetTop } : null;
    since = performance.now();
    index = next;
    render(handlers.tab());
    card.classList.remove('entering');
    void card.offsetWidth;
    card.classList.add('entering');
    if (index >= 0) {
      const step = STEPS[index];
      for (const selector of TARGETS[step.target] ?? []) document.querySelector(selector)?.scrollIntoView({ block: 'nearest' });
      handlers.enter?.(step);
    }
    cancelAnimationFrame(loop);
    update();
  }

  function render(tab) {
    shownTab = tab;
    card.replaceChildren();
    card.classList.toggle('welcome', index < 0);
    if (index < 0) {
      const title = document.createElement('h2');
      title.textContent = WELCOME.title;
      const text = document.createElement('p');
      text.textContent = WELCOME.text;
      card.append(title, text, actions([['skip', 'Skip'], ['tour', 'Take the tour', true]]));
      return;
    }
    const step = STEPS[index];
    const count = document.createElement('div');
    count.className = 'count';
    count.textContent = `${index + 1} of ${STEPS.length}`;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'close';
    x.dataset.act = 'close';
    x.setAttribute('aria-label', 'Close the tour');
    x.textContent = '×';
    const title = document.createElement('strong');
    title.textContent = step.title;
    const text = document.createElement('p');
    appendText(text, step.text[tab] ?? step.text.respiration);
    const last = index === STEPS.length - 1;
    const list = [['back', 'Back'], last ? ['play', 'Play', true] : ['next', 'Next', true]];
    const row = actions(list);
    if (index === 0) row.querySelector('[data-act="back"]').disabled = true;
    card.append(count, x, title, text, row);
  }

  function update() {
    loop = 0;
    if (root.hidden) return;
    const tab = handlers.tab();
    if (tab !== shownTab) render(tab);
    const width = window.innerWidth;
    const height = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    let d = `M0 0H${width}V${height}H0Z`;
    const step = STEPS[index];
    const target = step ? clip(step.target === 'feed' ? handlers.feed() : unionOf(TARGETS[step.target]), width, height) : null;
    const e = ease(Math.min(1, (performance.now() - since) / MOVE_MS));
    const hole = target && from && e < 1 ? mix(from, target, e) : target;
    shownHole = hole;
    let spot = step?.target === 'inspector' ? handlers.spot() : null;
    if (spot && e < 1) spot = { ...spot, r: spot.r * e };
    ring.style.display = hole ? '' : 'none';
    halo.style.display = spot ? '' : 'none';
    if (hole) {
      d += roundRect(hole, 10);
      ring.setAttribute('x', hole.left);
      ring.setAttribute('y', hole.top);
      ring.setAttribute('width', hole.width);
      ring.setAttribute('height', hole.height);
      ring.setAttribute('rx', 10);
    }
    if (spot) {
      d += `M${spot.x - spot.r} ${spot.y}a${spot.r} ${spot.r} 0 1 0 ${2 * spot.r} 0a${spot.r} ${spot.r} 0 1 0 ${-2 * spot.r} 0Z`;
      halo.setAttribute('cx', spot.x);
      halo.setAttribute('cy', spot.y);
      halo.setAttribute('r', spot.r);
    }
    scrim.setAttribute('d', d);
    const at = place(target, spot, step, width, height);
    const x = fromCard && e < 1 ? fromCard.x + (at.x - fromCard.x) * e : at.x;
    const y = fromCard && e < 1 ? fromCard.y + (at.y - fromCard.y) * e : at.y;
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
    placed = true;
    loop = requestAnimationFrame(update);
  }

  function place(hole, spot, step, width, height) {
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    let at = null;
    if (!hole) {
      const stage = handlers.stage();
      at = { x: stage.left + (stage.width - w) / 2, y: stage.top + (stage.height - h) / 2 };
    } else {
      const clear = [hole, spot && { left: spot.x - spot.r, top: spot.y - spot.r, width: 2 * spot.r, height: 2 * spot.r }].filter(Boolean);
      const sides = SIDES[step.target];
      for (const side of sides) {
        const option = beside(hole, side, w, h, width, height);
        if (fits(option, side, w, h, width, height) &&!clear.some((box) => overlaps(option, w, h, box))) {
          at = option;
          break;
        }
      }
      at ??= beside(hole, sides[0], w, h, width, height);
    }
    return { x: Math.min(width - w - MARGIN, Math.max(MARGIN, at.x)), y: Math.min(height - h - MARGIN, Math.max(MARGIN, at.y)) };
  }

  function start() {
    root.hidden = false;
    shownHole = null;
    placed = false;
    card.style.left = '';
    card.style.top = '';
    document.activeElement?.blur?.();
    go(-1);
  }

  function close() {
    markSeen(handlers.storage);
    root.hidden = true;
    shownHole = null;
    cancelAnimationFrame(loop);
    loop = 0;
    index = -1;
  }

  function play() {
    close();
    handlers.play?.();
  }

  return {
    get open() {
      return !root.hidden;
    },
    get last() {
      return !root.hidden && index === STEPS.length - 1;
    },
    start,
    close,
    play,
    // The user tagged an atom: step 1 moves on.
    tagged() {
      if (!root.hidden && STEPS[index]?.target === 'feed') go(index + 1);
    },
  };
}

function ease(t) {
  return (1 - Math.cos(Math.PI * t)) / 2;
}

function mix(a, b, t) {
  return {
    left: a.left + (b.left - a.left) * t,
    top: a.top + (b.top - a.top) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  };
}

function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function actions(list) {
  const row = document.createElement('div');
  row.className = 'actions';
  for (const [act, label, primary] of list) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.act = act;
    button.textContent = label;
    if (primary) button.className = 'primary';
    row.append(button);
  }
  return row;
}

function appendText(el, text) {
  text.split('*').forEach((part, i) => {
    if (!part) return;
    if (i % 2) {
      const em = document.createElement('i');
      em.textContent = part;
      el.append(em);
    } else el.append(part);
  });
}

function unionOf(selectors = []) {
  let box = null;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    box = box
      ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
      : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }
  return box && { left: box.left - PAD, top: box.top - PAD, width: box.right - box.left + 2 * PAD, height: box.bottom - box.top + 2 * PAD };
}

function clip(box, width, height) {
  if (!box) return null;
  const left = Math.max(4, box.left);
  const top = Math.max(4, box.top);
  const right = Math.min(width - 4, box.left + box.width);
  const bottom = Math.min(height - 4, box.top + box.height);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}

function roundRect({ left: x, top: y, width: w, height: h }, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function beside(hole, side, w, h) {
  const right = hole.left + hole.width;
  const bottom = hole.top + hole.height;
  if (side === 'right') return { x: right + GAP, y: hole.top };
  if (side === 'left') return { x: hole.left - GAP - w, y: hole.top };
  if (side === 'below') return { x: hole.left, y: bottom + GAP };
  return { x: hole.left, y: hole.top - GAP - h };
}

// A side fits when the card stays on screen along that side's axis; the
// other axis is clamped when the card is placed.
function fits(at, side, w, h, width, height) {
  if (side === 'right' || side === 'left') return at.x >= MARGIN && at.x + w <= width - MARGIN;
  return at.y >= MARGIN && at.y + h <= height - MARGIN;
}

function overlaps(at, w, h, box) {
  const x = Math.min(window.innerWidth - w - MARGIN, Math.max(MARGIN, at.x));
  const y = Math.min(window.innerHeight - h - MARGIN, Math.max(MARGIN, at.y));
  return x < box.left + box.width && x + w > box.left && y < box.top + box.height && y + h > box.top;
}
