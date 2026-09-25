
// ---------------------------------------------------------------------------
// Post-processing, resize, and the frame loop.
// ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 46 : 34;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
}
addEventListener('resize', resize);
resize();

{
  startCinematic(state.cinematic);
  if (state.cinematic) {
    const s = SHOTS[0];
    setGoal(V3(...s.a), V3(...s.la), true);
  } else {
    const h = homePose();
    setGoal(h.pos, h.tgt, true);
  }
}

let last = performance.now(), photoReady = false, started = false;
let dofS = -1, dofN = -1, thumbN = -1, thumbAt = 0;
const nearestPreset = (N) => AP_PRESETS.reduce((b, p, i) => (Math.abs(Math.log(p / N)) < Math.abs(Math.log(AP_PRESETS[b] / N)) ? i : b), 0);
function frame(now) {
  requestAnimationFrame(frame);
  tick(now);
}
function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  state.focus = damp(state.focus, state.focusTarget, 6.5, dt);
  if (Math.abs(state.focus - state.focusTarget) < 0.004) state.focus = state.focusTarget;
  const lt = Math.log(state.NTarget);
  state.logN = damp(state.logN, lt, 5.5, dt);
  if (Math.abs(state.logN - lt) < 1e-4) state.logN = lt;
  state.explode = damp(state.explode, state.explodeTarget, 3.6, dt);
  if (Math.abs(state.explode - state.explodeTarget) < 1e-3) state.explode = state.explodeTarget;

  applyKeys(dt);
  updateCamera(dt);
  updateLens(dt);
  updateFocusPlane();
  updateRays();

  // console widgets follow the focus
  knob.position.x = focusToStripX(state.focus);
  dial.rotation.z = -(state.focus - FOCUS_MIN) / (FOCUS_MAX - FOCUS_MIN) * Math.PI * 1.5 + Math.PI * 0.25;
  let near = 0;
  for (let i = 1; i < STRIP.n; i++) if (Math.abs(stripDist(i) - state.focus) < Math.abs(stripDist(near) - state.focus)) near = i;
  selFrame.position.x = damp(selFrame.position.x, stripX(near), 10, dt);
  const ap = nearestPreset(state.N);
  apButtons.forEach((b, i) => b.ring.material.color.set(i === ap ? 0x7fe3ff : 0x3a4250).multiplyScalar(i === ap ? 2.2 : 1));

  // the photo only changes when focus or aperture does
  if (!photoReady) { renderPhoto(); photoReady = true; }
  const N = state.N;
  if (Math.abs(state.focus - dofS) > 0.003 || Math.abs(N - dofN) > 1e-3) { runDOF(dofRT, state.focus, N); dofS = state.focus; dofN = N; }
  if (Math.abs(N - thumbN) > 1e-3 && now - thumbAt > 140) { thumbRTs.forEach((rt, i) => runDOF(rt, stripDist(i), N)); thumbN = N; thumbAt = now; }

  updateReadouts();
  updateLabels();
  composer.render();
  if (!started) { started = true; $('loading').classList.remove('err'); $('loading').classList.add('gone'); }
}
requestAnimationFrame(frame);
