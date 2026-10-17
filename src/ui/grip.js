// The rail's left edge can be dragged to make the rail wider or narrower,
// within a range that keeps both the stage and the rail readable. Arrow keys
// move it too, and a double click restores the default. The width is a
// per-viewer convenience kept in local storage when the browser allows it.

const DEFAULT = 340;
const MIN = 280;
const MAX = 520;
const MIN_STAGE = 600;
const STORE = 'metasim.rail';

function railBounds(viewportWidth) {
  return { min: MIN, max: Math.max(MIN, Math.min(MAX, viewportWidth - MIN_STAGE)) };
}

function clampRail(width, viewportWidth) {
  const { min, max } = railBounds(viewportWidth);
  return Math.round(Math.min(max, Math.max(min, width)));
}

export function bindRailGrip(app, grip) {
  // What the viewer chose, and what fits the window now.
  let wanted = DEFAULT;
  let width = DEFAULT;
  try {
    const saved = Number(localStorage.getItem(STORE));
    if (saved) wanted = saved;
  } catch {
    // Storage can be unavailable; the default width is fine.
  }

  function apply(next, save = false) {
    wanted = next;
    width = clampRail(next, window.innerWidth);
    app.style.setProperty('--rail-w', `${width}px`);
    const { min, max } = railBounds(window.innerWidth);
    grip.setAttribute('aria-valuemin', String(min));
    grip.setAttribute('aria-valuemax', String(max));
    grip.setAttribute('aria-valuenow', String(width));
    if (!save) return;
    try {
      wanted = width;
      localStorage.setItem(STORE, String(width));
    } catch {
      // Not saved; the width still applies for this visit.
    }
  }

  let drag = null;
  grip.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, width };
    grip.setPointerCapture(event.pointerId);
    grip.classList.add('dragging');
    event.preventDefault();
  });
  grip.addEventListener('pointermove', (event) => {
    if (!drag) return;
    apply(drag.width + (drag.x - event.clientX));
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    grip.classList.remove('dragging');
    apply(width, true);
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => apply(DEFAULT, true));
  grip.addEventListener('keydown', (event) => {
    const by = event.shiftKey ? 60 : 20;
    const { min, max } = railBounds(window.innerWidth);
    const keys = {
      ArrowLeft: width + by,
      ArrowRight: width - by,
      Home: max,
      End: min,
    };
    if (!(event.key in keys)) return;
    apply(keys[event.key], true);
    event.preventDefault();
  });
  window.addEventListener('resize', () => apply(wanted));
  apply(wanted);
}
