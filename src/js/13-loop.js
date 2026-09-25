
// ---------------------------------------------------------------------------
// The frame loop and start-up.
// ---------------------------------------------------------------------------
addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));

// drop quality a notch if the machine can't keep up
const perf = { t0: performance.now(), frames: 0, level: 0 };
function watchPerf(now) {
  perf.frames++;
  if (now - perf.t0 < 2000) return;
  const ms = (now - perf.t0) / perf.frames;
  perf.t0 = now; perf.frames = 0;
  if (ms > 40 && perf.level < 3) {
    perf.level++;
    QUALITY.kMax = Math.max(4, Math.round(QUALITY.kMax / 2));
    QUALITY.taps = Math.max(80, Math.round(QUALITY.taps * 0.7));
    QUALITY.worldDpr = Math.max(1, QUALITY.worldDpr - 0.4);
    worldSize.w = 0;
    // last resort: the lens glass stops refracting the room (a whole extra render)
    if (perf.level === 3) { glassMat.transmission = 0; glassMat.transparent = true; glassMat.opacity = 0.32; glassMat.needsUpdate = true; }
  }
}

let last = performance.now(), started = false, readoutAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!window.__labHold) tick(now);
}
function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  sim.tau += dt * state.timeScale;
  runSweep(now);
  if (calPending) calibrate();
  if (state.meterValid && state.meterRaw !== undefined) state.meterEV = damp(state.meterEV, state.meterRaw, 5, dt);
  autoExposure(dt);
  if (state.awb && state.modules.brain) {
    const [r, g, b] = state.meterRGB, k = estimateKelvin(r, g, b);
    state.wb = clamp(1e6 / damp(1e6 / state.wb, 1e6 / k, 3, dt), K_MIN, K_MAX);
  }
  // the optics ease toward the settings, so zooming, focusing and stopping down glide
  const c = state.cur;
  for (const [k, rate] of [['N', 9], ['f', 5], ['D', 8]]) {
    c[k] = Math.exp(damp(Math.log(c[k]), Math.log(state[k]), rate, dt));
    if (Math.abs(Math.log(c[k] / state[k])) < 1e-4) c[k] = state[k];
  }
  state.explode = damp(state.explode, state.explodeTarget, 3.6, dt);
  if (Math.abs(state.explode - state.explodeTarget) < 1e-3) state.explode = state.explodeTarget;

  updateWorldCam(dt);
  updateLens(dt);
  updateBody(dt);
  updateOptics();
  updateExposure();
  renderPhoto(sim.tau);
  readBacks(now);
  renderThumbs(now);
  syncControls(now);
  updateBench(dt, now);
  updateRays();

  renderer.setRenderTarget(null);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.clear(true, true, false);
  if (state.bigView) {
    readSlot();
    drawPhoto(slotRect.x, slotRect.glY, slotRect.w, slotRect.h, now);
    updateTags();
    drawHisto();
  } else {
    // the world casts shadows too (the photo pass only drew the valley's)
    renderer.shadowMap.needsUpdate = true;
    drawWorld(innerWidth, innerHeight);
  }
  renderer.setScissorTest(false);
  updateLabels();
  if (now - readoutAt > 100) { readoutAt = now; updateReadouts(); }
  if (!window.__labHold) watchPerf(now);
  if (!started) { started = true; $('loading').classList.add('gone'); }
}

// --- start-up --------------------------------------------------------------------------------------------
for (const k of MODULE_KEYS) for (const fn of moduleWatchers) fn(k, state.modules[k]);
for (const k in state.overlays) setOverlay(k, state.overlays[k]);
showTab('dof');
applyPreset(state.preset, true);
setTrainSpeed(state.trainSpeed, sim.tau);
animate(sim.tau);
startCinematic(state.cinematic);
if (state.cinematic) setGoal(V3(...SHOTS[0].a), V3(...SHOTS[0].la), true);
else setView('home', true);
requestAnimationFrame(frame);
