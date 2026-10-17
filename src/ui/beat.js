// The guide's beat card, placed beside the followed particle, and the end
// card shown when a journey finishes. Both are plain DOM over the canvas.

const RING = 2 * Math.PI * 7;

export function bindBeat(handlers) {
  const root = document.getElementById('beat');
  const end = document.getElementById('endcard');
  let current = null;

  root.addEventListener('pointerenter', () => {
    if (current) current.held = true;
  });
  root.addEventListener('pointerleave', () => {
    if (current) current.held = false;
  });
  root.addEventListener('click', (event) => {
    if (!current) return;
    const button = event.target.closest('button[data-choice]');
    if (current.choices && !button) return;
    finish(button ? button.dataset.choice : null);
  });

  function finish(choice) {
    const done = current;
    current = null;
    root.hidden = true;
    if (done) handlers.onContinue(done, choice ?? done.fallback ?? null);
  }

  function show(beat, duration) {
    current = { ...beat, left: duration, duration, held: false, fallback: beat.choices?.[0]?.id ?? null };
    root.replaceChildren();
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('class', 'ring');
    ring.setAttribute('viewBox', '0 0 18 18');
    ring.setAttribute('aria-hidden', 'true');
    for (const cls of ['track', 'fill']) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', cls);
      circle.setAttribute('cx', '9');
      circle.setAttribute('cy', '9');
      circle.setAttribute('r', '7');
      if (cls === 'fill') {
        circle.setAttribute('stroke-dasharray', String(RING));
        circle.setAttribute('stroke-dashoffset', '0');
      }
      ring.append(circle);
    }
    const title = document.createElement('strong');
    title.textContent = beat.title;
    const text = document.createElement('div');
    text.textContent = beat.text;
    root.append(ring, title, text);
    if (beat.choices) {
      const row = document.createElement('div');
      row.className = 'choices';
      beat.choices.forEach((choice, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.choice = choice.id;
        button.textContent = choice.label;
        if (i === 0) button.className = 'primary';
        row.append(button);
      });
      root.append(row);
    }
    root.hidden = false;
  }

  return {
    get showing() {
      return current != null;
    },
    show,
    // Counts down while the pointer is away, and continues at zero.
    tick(dt) {
      if (!current) return;
      if (!current.held) current.left -= dt;
      const fill = root.querySelector('.ring .fill');
      if (fill) fill.setAttribute('stroke-dashoffset', String(RING * (1 - Math.max(0, current.left) / current.duration)));
      if (current.left <= 0) finish(null);
    },
    continueNow() {
      if (current) finish(null);
    },
    cancel() {
      current = null;
      root.hidden = true;
    },
    place(screen, viewport) {
      if (!current) return;
      const width = root.offsetWidth || 300;
      const height = root.offsetHeight || 80;
      let x = screen ? screen.x + 26 : 16;
      let y = screen ? screen.y - height - 18 : 16;
      if (x + width > viewport.width - 12) x = screen ? screen.x - width - 26 : 16;
      x = Math.min(viewport.width - width - 12, Math.max(12, x));
      if (y < 12) y = screen ? screen.y + 24 : 12;
      y = Math.min(viewport.height - height - 70, Math.max(12, y));
      root.style.left = `${Math.round(x)}px`;
      root.style.top = `${Math.round(y)}px`;
    },
    get endShowing() {
      return !end.hidden;
    },
    showEnd(card, actions) {
      end.replaceChildren();
      const title = document.createElement('h2');
      title.id = 'endcard-title';
      title.textContent = card.title;
      const text = document.createElement('p');
      text.textContent = card.text;
      end.append(title, text);
      if (card.summary) {
        const summary = document.createElement('p');
        summary.className = 'summary';
        summary.textContent = card.summary;
        end.append(summary);
      }
      const row = document.createElement('div');
      row.className = 'actions';
      actions.forEach((action, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label;
        if (i === 0) button.className = 'primary';
        button.addEventListener('click', () => {
          end.hidden = true;
          action.run();
        });
        row.append(button);
      });
      end.append(row);
      end.hidden = false;
      row.querySelector('button')?.focus({ preventScroll: true });
    },
    hideEnd() {
      end.hidden = true;
    },
  };
}
