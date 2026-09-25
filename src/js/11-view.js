
// ---------------------------------------------------------------------------
// The world view: a free camera that orbits the bench, a few set viewpoints,
// a loop of slow cinematic shots, and a bloom pass so the plane of focus
// glows. `goal` is where the camera wants to be; the real one eases toward it.
// ---------------------------------------------------------------------------
const worldCam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 1, 4000);
worldCam.layers.enable(LAYER_PHOTO);
const view = { pos: V3(0, 0, 0), tgt: V3(0, 0, 0), gPos: V3(0, 0, 0), gTgt: V3(0, 0, 0), name: 'home' };
// set viewpoints; the body one follows the body along the rail
const VIEWS = {
  // the left column of cards covers a quarter of the window: aim left of the bench's middle so it sits in the free part
  home: () => { const a = innerWidth / innerHeight, k = clamp(1.6 / a, 1, 2.2); const tgt = V3(-2, -8, 8); return { pos: tgt.clone().add(V3(-16, 100, 300).multiplyScalar(k)), tgt }; },
  lens: () => ({ pos: V3(24, 36, 62), tgt: V3(4, 15, 0) }),
  // steep enough that the finder hump doesn't hide the dials on the far shoulder
  body: () => { const x = camBody.position.x; return { pos: V3(x + 20, 92, 44), tgt: V3(x - 4, 22, 0) }; },
  valley: () => ({ pos: V3(8, 58, 104), tgt: V3(56, 8, 0) }),
  // the whole console, again clear of the cards on the left
  console: () => { const a = innerWidth / innerHeight, k = clamp(1.6 / a, 1, 2.2); return { pos: V3(-18, 30, 38 + 336 * k), tgt: V3(-18, -33, 38) }; },
};
function setGoal(pos, tgt, snap = false) {
  view.gPos.copy(pos); view.gTgt.copy(tgt);
  if (snap) { view.pos.copy(pos); view.tgt.copy(tgt); }
}
function setView(name, snap = false) {
  const v = VIEWS[name]();
  view.name = name;
  setGoal(v.pos, v.tgt, snap);
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
}
function clearViewName() { if (view.name) { view.name = ''; document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false')); } }
function goalFromCurrent() { view.gPos.copy(view.pos); view.gTgt.copy(view.tgt); }

const _off = new THREE.Vector3(), _sph = new THREE.Spherical();
function orbit(dTheta, dPhi) {
  _off.copy(view.gPos).sub(view.gTgt);
  _sph.setFromVector3(_off);
  _sph.theta += dTheta;
  _sph.phi = clamp(_sph.phi + dPhi, 0.1, 1.72);
  _off.setFromSpherical(_sph);
  view.gPos.copy(view.gTgt).add(_off);
  clearViewName();
}
function dolly(factor) {
  _off.copy(view.gPos).sub(view.gTgt);
  const r = clamp(_off.length() * factor, 8, 900);
  view.gPos.copy(view.gTgt).add(_off.setLength(r));
  clearViewName();
}
const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3();
function pan(dx, dy) {
  const r = view.gPos.distanceTo(view.gTgt);
  worldCam.matrixWorld.extractBasis(_right, _up, _fwd);
  const k = (2 * r * Math.tan(THREE.MathUtils.degToRad(worldCam.fov / 2))) / Math.max(innerHeight, 1);
  const d = _right.multiplyScalar(-dx * k).add(_up.multiplyScalar(dy * k));
  view.gPos.add(d); view.gTgt.add(d);
  clearViewName();
}
// double-click: keep the viewing direction, bring the spot to the centre and move in
function flyTo(p) {
  _off.copy(view.gPos).sub(view.gTgt);
  const r = clamp(_off.length() * 0.55, 18, 260);
  view.gTgt.copy(p);
  view.gPos.copy(p).add(_off.setLength(r));
  clearViewName();
}

// --- cinematic shots ------------------------------------------------------------------------------------
// While nobody touches anything for 20 s the shots may also turn the camera's
// controls — you can watch the rings and dials move.
const autoOk = () => performance.now() - state.lastUserAt > 20000;
const demo = (key, v) => { if (autoOk()) setParam(key, v, false); };
const demoExplode = (e) => { if (autoOk()) state.explodeTarget = e; };
const shotAt = (f) => (typeof f === 'function' ? f() : f);
const SHOTS = [
  { a: [-70, 70, 250], b: [90, 60, 240], la: [0, 4, 0], lb: [30, 4, 0], dur: 10,
    start: () => { demoExplode(1); demo('N', 2); demo('D', 38); } },
  { a: [30, 34, 58], b: [16, 30, 66], la: [2, 15, 0], lb: [6, 15, 0], dur: 9,
    during: (k) => demo('D', roundD(logVal(smooth(clamp((k - 0.15) / 0.7, 0, 1)) * 0.75 + 0.1, D_MIN, D_MAX))) },
  { a: () => [camBody.position.x + 30, 62, 58], b: () => [camBody.position.x + 12, 56, 66], la: () => [camBody.position.x - 4, 22, 4], lb: () => [camBody.position.x - 6, 20, 4], dur: 8,
    start: () => demo('N', 11), during: (k) => { if (k > 0.55) demo('N', 2.8); } },
  { a: [40, 66, 70], b: [72, 58, 62], la: [48, 8, -2], lb: [62, 8, -4], dur: 10,
    during: (k) => demo('D', roundD(logVal(smooth(clamp((k - 0.1) / 0.8, 0, 1)), D_MIN, D_MAX))) },
  { a: [-30, 40, 150], b: [10, 34, 140], la: [-30, 12, 0], lb: [-24, 12, 0], dur: 10,
    start: () => { demo('D', 52); demo('N', 5.6); }, during: (k) => demo('f', snapF(logVal(smooth(k < 0.5 ? k * 2 : 2 - k * 2), F_MIN, F_MAX))) },
  { a: [-40, 2, 150], b: [80, 2, 150], la: [-40, -30, 38], lb: [80, -30, 38], dur: 10,
    during: (k) => demo('D', roundD(logVal(smooth(k), D_MIN, D_MAX))) },
  { a: [96, 30, 92], b: [116, 26, 84], la: [124, 22, 20], lb: [126, 22, 20], dur: 7,
    start: () => { demo('D', 38); demo('N', 2); demo('f', 50); } },
];
const cine = { i: 0, t: 0 };
function startCinematic(on) {
  state.cinematic = on;
  if (on) { cine.i = 0; cine.t = 0; SHOTS[0].start?.(); clearViewName(); }
  else goalFromCurrent();
  document.getElementById('cineBtn').setAttribute('aria-pressed', String(on));
}
function stopCinematicByUser() { if (state.cinematic) startCinematic(false); }
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function updateWorldCam(dt) {
  let rate = 7;
  if (state.cinematic) {
    const shot = SHOTS[cine.i];
    cine.t += dt;
    const k = clamp(cine.t / shot.dur, 0, 1), e = smooth(k);
    view.gPos.copy(_a.fromArray(shotAt(shot.a))).lerp(_b.fromArray(shotAt(shot.b)), e);
    view.gTgt.copy(_a.fromArray(shotAt(shot.la))).lerp(_b.fromArray(shotAt(shot.lb)), e);
    shot.during?.(k);
    if (cine.t >= shot.dur) { cine.i = (cine.i + 1) % SHOTS.length; cine.t = 0; SHOTS[cine.i].start?.(); }
    rate = 1.5;
  } else if (view.name === 'body') {
    const v = VIEWS.body();           // the body slides with the zoom; keep it framed
    view.gPos.copy(v.pos); view.gTgt.copy(v.tgt);
  }
  const f = 1 - Math.exp(-rate * dt);
  view.pos.lerp(view.gPos, f);
  view.tgt.lerp(view.gTgt, f);
  worldCam.position.copy(view.pos);
  worldCam.lookAt(view.tgt);
  worldCam.updateMatrixWorld();
}

const worldComposer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: coarse ? 0 : 4 }));
worldComposer.addPass(new RenderPass(scene, worldCam));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.5, 0.95);
worldComposer.addPass(bloom);
worldComposer.addPass(new OutputPass());
const worldSize = { w: 0, h: 0 };
function drawWorld(w, h) {
  if (w !== worldSize.w || h !== worldSize.h) {
    worldSize.w = w; worldSize.h = h;
    worldCam.aspect = w / h;
    worldCam.fov = w / h < 1 ? 48 : 34;
    worldCam.updateProjectionMatrix();
    worldComposer.setPixelRatio(Math.min(renderer.getPixelRatio(), QUALITY.worldDpr));
    worldComposer.setSize(w, h);
    bloom.resolution.set(w, h);
  }
  const p = PRESETS[state.preset].world;
  renderer.toneMappingExposure = 1.05 * p.exposure;
  bloom.strength = p.bloom[0];
  bloom.threshold = p.bloom[1];
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  focusU.uGlowOn.value = 1;
  worldComposer.render();
}
