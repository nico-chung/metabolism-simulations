const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];

export function bindTransport(handlers) {
  const play = document.getElementById('play');
  const back = document.getElementById('back');
  const step = document.getElementById('step');
  const slower = document.getElementById('slower');
  const faster = document.getElementById('faster');
  const feed = document.getElementById('feed');
  const speedLabel = document.getElementById('speed-label');
  let enabled = false;
  let canBack = false;

  play.addEventListener('click', handlers.onPlay);
  back.addEventListener('click', handlers.onBack);
  step.addEventListener('click', handlers.onStep);
  slower.addEventListener('click', () => handlers.onSpeed(-1));
  faster.addEventListener('click', () => handlers.onSpeed(1));
  feed.addEventListener('click', handlers.onFeed);
  document.getElementById('fit').addEventListener('click', handlers.onFit);
  document.getElementById('reset').addEventListener('click', handlers.onReset);
  const follow = document.getElementById('follow');
  follow.addEventListener('click', handlers.onFollow);
  let followShown = null;
  let following = null;

  function sync() {
    play.disabled = !enabled;
    step.disabled = !enabled;
    back.disabled = !enabled || !canBack;
    slower.disabled = !enabled;
    faster.disabled = !enabled;
    feed.disabled = !enabled;
  }

  return {
    speeds: SPEEDS,
    setPlaying(playing) {
      showState(play, playing ? 'pause' : 'play');
    },
    setSpeed(speed) {
      speedLabel.textContent = `${speed}×`;
    },
    setFeed(mode) {
      showState(feed, mode === 'one' ? 'one' : 'continuous');
    },
    setEnabled(on) {
      enabled = on;
      sync();
    },
    setCanBack(on) {
      canBack = on;
      sync();
    },
    // The Follow atom pill shows while an atom is selected and says whether
    // the camera is following it.
    setFollow(shown, on) {
      if (shown !== followShown) {
        followShown = shown;
        follow.classList.toggle('shown', shown);
      }
      if (on !== following) {
        following = on;
        follow.setAttribute('aria-pressed', String(on));
        showState(follow, on ? 'on' : 'off');
      }
    },
  };
}

// Buttons whose label changes hold every label in one grid cell and show
// one, so the toolbar keeps its width whatever they say.
function showState(button, state) {
  for (const label of button.querySelectorAll('[data-state]')) label.classList.toggle('on', label.dataset.state === state);
}
