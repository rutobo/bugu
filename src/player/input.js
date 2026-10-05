// Keyboard, mouse (pointer lock) and touch input.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.pressed = new Set(); // keys pressed since last frame
    this.touchMove = { x: 0, y: 0 };
    this.touchJump = false;
    this.touchRun = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = false;
    this.dragging = false;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (this.enabled && !this.isTouch && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.()?.catch?.(() => {});
      }
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.look.dx += e.movementX;
        this.look.dy += e.movementY;
      } else if (this.dragging) {
        this.look.dx += e.movementX * 1.5;
        this.look.dy += e.movementY * 1.5;
      }
    });
    // Drag-to-look fallback when pointer lock is unavailable.
    canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== canvas && e.button === 2) this.dragging = true;
    });
    addEventListener('mouseup', () => (this.dragging = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        this.zoom += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false }
    );

    if (this.isTouch) this.setupTouch();
  }

  setupTouch() {
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    const jump = document.getElementById('btn-jump');
    const run = document.getElementById('btn-run');
    document.body.classList.add('touch');
    let stickId = null;
    let lookId = null;
    let origin = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    const R = 55;

    const onStart = (e) => {
      for (const t of e.changedTouches) {
        if (t.target.closest('.touch-btn, .panel, button')) continue;
        if (t.clientX < innerWidth * 0.45 && stickId === null) {
          stickId = t.identifier;
          origin = { x: t.clientX, y: t.clientY };
          stick.style.left = `${t.clientX - 60}px`;
          stick.style.top = `${t.clientY - 60}px`;
          stick.style.bottom = 'auto';
          stick.classList.add('active');
        } else if (lookId === null) {
          lookId = t.identifier;
          last = { x: t.clientX, y: t.clientY };
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - origin.x;
          let dy = t.clientY - origin.y;
          const len = Math.hypot(dx, dy);
          if (len > R) {
            dx = (dx / len) * R;
            dy = (dy / len) * R;
          }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.touchMove.x = dx / R;
          this.touchMove.y = dy / R;
        } else if (t.identifier === lookId) {
          this.look.dx += (t.clientX - last.x) * 2.2;
          this.look.dy += (t.clientY - last.y) * 2.2;
          last = { x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null;
          this.touchMove.x = this.touchMove.y = 0;
          knob.style.transform = '';
          stick.classList.remove('active');
        } else if (t.identifier === lookId) {
          lookId = null;
        }
      }
    };
    this.canvas.addEventListener('touchstart', onStart, { passive: true });
    addEventListener('touchmove', onMove, { passive: false });
    addEventListener('touchend', onEnd);
    addEventListener('touchcancel', onEnd);
    jump.addEventListener('touchstart', (e) => {
      this.touchJump = true;
      e.preventDefault();
    });
    run.addEventListener('touchstart', (e) => {
      this.touchRun = !this.touchRun;
      run.classList.toggle('on', this.touchRun);
      e.preventDefault();
    });
  }

  // Movement intent in camera space: x = right, y = forward.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    x += this.touchMove.x;
    y -= this.touchMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  get running() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchRun;
  }

  consumeJump() {
    const j = this.pressed.has('Space') || this.touchJump;
    this.touchJump = false;
    return j;
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.look.dx = 0;
    this.look.dy = 0;
    this.zoom = 0;
  }
}
