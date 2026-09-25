
// ---------------------------------------------------------------------------
// Layout, the frame loop and start-up.
// ---------------------------------------------------------------------------
function readSlots() {
  const H = innerHeight;
  for (const [k, el] of [['photo', photoSlot], ['world', worldSlot]]) {
    const b = el.getBoundingClientRect(), r = slotRect[k];
    r.x = b.left; r.y = b.top; r.w = b.width; r.h = b.height;
    r.glY = H - b.bottom;
    r.visible = b.bottom > 0 && b.top < H && b.width > 2 && b.height > 2;
  }
}
addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));

// drop quality a notch if the machine can't keep up
const perf = { t0: performance.now(), frames: 0, level: 0 };
function watchPerf(now) {
  perf.frames++;
  if (now - perf.t0 < 2000) return;
  const ms = (now - perf.t0) / perf.frames;
  perf.t0 = now; perf.frames = 0;
  if (ms > 40 && perf.level < 2) {
    perf.level++;
    QUALITY.kMax = Math.max(4, Math.round(QUALITY.kMax / 2));
    QUALITY.taps = Math.max(80, Math.round(QUALITY.taps * 0.7));
    QUALITY.worldDpr = Math.max(1, QUALITY.worldDpr - 0.4);
    worldSize.w = 0;
  }
}

let last = performance.now(), tau = 2.4, started = false, readoutAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!window.__labHold) tick(now);
}
function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  tau += dt * state.timeScale;
  runSweep(now);
  if (state.meterValid && state.meterRaw !== undefined) state.meterEV = damp(state.meterEV, state.meterRaw, 5, dt);
  autoExposure(dt);
  if (state.awb) {
    const [r, g, b] = state.meterRGB, k = estimateKelvin(r, g, b);
    state.wb = clamp(1e6 / damp(1e6 / state.wb, 1e6 / k, 3, dt), K_MIN, K_MAX);
  }
  // the optics ease toward the settings, so zooming, focusing and stopping down glide
  const c = state.cur;
  for (const [k, rate] of [['N', 9], ['f', 7], ['D', 8]]) {
    c[k] = Math.exp(damp(Math.log(c[k]), Math.log(state[k]), rate, dt));
    if (Math.abs(Math.log(c[k] / state[k])) < 1e-4) c[k] = state[k];
  }
  applyKeys(dt);
  updateWorldCam(dt);
  updateRig();
  updateOptics();
  updateExposure();
  readSlots();
  renderPhoto(tau);
  readBacks(now);

  renderer.setRenderTarget(null);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.clear(true, true, false);
  const p = slotRect.photo, w = slotRect.world;
  if (w.visible) drawWorld(w.x, w.glY, w.w, w.h);
  if (p.visible) drawPhoto(p.x, p.glY, p.w, p.h, now);
  renderer.setScissorTest(false);

  updateTags();
  updateLabels();
  drawHisto();
  if (now - readoutAt > 90) { readoutAt = now; updateReadouts(); }
  if (!window.__labHold) watchPerf(now);
  if (!started) { started = true; $('loading').classList.add('gone'); }
}

// --- start-up ---------------------------------------------------------------------------------
for (const k in ROWS) ROWS[k].row.classList.toggle('active', k === state.active);
document.querySelectorAll('[data-mode]').forEach((b) => setPressed(b, b.dataset.mode === state.mode));
for (const k in state.overlays) setOverlay(k, state.overlays[k]);
showTab('dof');
setView('behind', true);
applyPreset(state.preset, true);
animate(tau);
requestAnimationFrame(frame);
