(() => {
  const dpad = document.getElementById('dpad');
  if (!dpad) return;

  const buttons = [...dpad.querySelectorAll('.dir')];
  const codeFor = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
  };

  let pointerId = null;
  let activeDir = null;

  function send(type, dir) {
    if (!dir) return;
    window.dispatchEvent(new KeyboardEvent(type, {
      code: codeFor[dir],
      key: codeFor[dir],
      bubbles: true,
      cancelable: true,
    }));
  }

  function paint(dir) {
    activeDir = dir;
    dpad.dataset.activeDir = dir || '';
    for (const button of buttons) {
      button.classList.toggle('active', button.dataset.dir === dir);
    }
  }

  function setDirection(dir) {
    if (dir === activeDir) return;
    if (activeDir) send('keyup', activeDir);
    paint(dir);
    if (dir) send('keydown', dir);
  }

  function directionAt(clientX, clientY) {
    const rect = dpad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const deadZone = Math.min(rect.width, rect.height) * 0.105;

    if (Math.hypot(dx, dy) < deadZone) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  }

  function begin(event) {
    if (pointerId !== null || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    try { dpad.setPointerCapture(pointerId); } catch {}
    setDirection(directionAt(event.clientX, event.clientY));
  }

  function move(event) {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setDirection(directionAt(event.clientX, event.clientY));
  }

  function end(event) {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setDirection(null);
    try { dpad.releasePointerCapture(pointerId); } catch {}
    pointerId = null;
  }

  // Capture phase intentionally intercepts the original individual arrow-button
  // pointer handlers. Keyboard controls remain unchanged in game.js.
  dpad.addEventListener('pointerdown', begin, { capture: true });
  dpad.addEventListener('pointermove', move, { capture: true });
  dpad.addEventListener('pointerup', end, { capture: true });
  dpad.addEventListener('pointercancel', end, { capture: true });

  window.addEventListener('blur', () => {
    if (activeDir) send('keyup', activeDir);
    paint(null);
    pointerId = null;
  });
})();
