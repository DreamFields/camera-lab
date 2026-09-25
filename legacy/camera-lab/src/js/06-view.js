
// ---------------------------------------------------------------------------
// The world view: a free camera that orbits the set, plus a bloom pass so the
// plane of focus glows. `goal` is where the camera wants to be; the real one
// eases toward it, so every move is smooth.
// ---------------------------------------------------------------------------
const worldCam = new THREE.PerspectiveCamera(42, 16 / 9, 0.03, 3000);
worldCam.layers.enable(LAYER_PHOTO);
const view = { pos: V3(0, 0, 0), tgt: V3(0, 0, 0), gPos: V3(0, 0, 0), gTgt: V3(0, 0, 0) };
const VIEWS = {
  behind: { pos: V3(-6.2, 4.3, 7.4), tgt: V3(6.5, 0.8, 0.4) },
  side: { pos: V3(4.5, 6.2, 14.5), tgt: V3(7.5, 1.2, 0) },
  top: { pos: V3(10.5, 36, 0.02), tgt: V3(10.5, 0, 0) },
  rig: { pos: V3(-0.55, 1.78, 0.62), tgt: V3(0.02, 1.5, 0) },
};
function setView(name, snap = false) {
  const v = VIEWS[name];
  view.gPos.copy(v.pos); view.gTgt.copy(v.tgt);
  if (snap) { view.pos.copy(v.pos); view.tgt.copy(v.tgt); }
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
}
function clearViewPressed() { document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false')); }
const _off = new THREE.Vector3(), _sph = new THREE.Spherical();
function orbit(dTheta, dPhi) {
  _off.copy(view.gPos).sub(view.gTgt);
  _sph.setFromVector3(_off);
  _sph.theta += dTheta;
  _sph.phi = clamp(_sph.phi + dPhi, 0.03, 1.62);
  _off.setFromSpherical(_sph);
  view.gPos.copy(view.gTgt).add(_off);
  clearViewPressed();
}
function dolly(factor) {
  _off.copy(view.gPos).sub(view.gTgt);
  const r = clamp(_off.length() * factor, 0.25, 260);
  view.gPos.copy(view.gTgt).add(_off.setLength(r));
  clearViewPressed();
}
const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3();
function pan(dx, dy, h) {
  const r = view.gPos.distanceTo(view.gTgt);
  worldCam.matrixWorld.extractBasis(_right, _up, _fwd);
  const k = (2 * r * Math.tan(THREE.MathUtils.degToRad(worldCam.fov / 2))) / Math.max(h, 1);
  const d = _right.multiplyScalar(-dx * k).add(_up.multiplyScalar(dy * k));
  view.gPos.add(d); view.gTgt.add(d);
  clearViewPressed();
}
function walk(forward, strafe, dt) {
  const r = Math.max(2, view.gPos.distanceTo(view.gTgt));
  _fwd.copy(view.gTgt).sub(view.gPos).setY(0).normalize();
  _right.set(-_fwd.z, 0, _fwd.x);
  const d = _fwd.multiplyScalar(forward).add(_right.multiplyScalar(strafe)).multiplyScalar(r * 0.6 * dt);
  view.gPos.add(d); view.gTgt.add(d);
  clearViewPressed();
}
function turn(angle) {
  _off.copy(view.gTgt).sub(view.gPos).applyAxisAngle(V3(0, 1, 0), angle);
  view.gTgt.copy(view.gPos).add(_off);
  clearViewPressed();
}
function updateWorldCam(dt) {
  const f = 1 - Math.exp(-7 * dt);
  view.pos.lerp(view.gPos, f);
  view.tgt.lerp(view.gTgt, f);
  worldCam.position.copy(view.pos);
  worldCam.lookAt(view.tgt);
  worldCam.updateMatrixWorld();
}

const worldComposer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: coarse ? 0 : 4 }));
worldComposer.addPass(new RenderPass(scene, worldCam));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.45, 0.92);
worldComposer.addPass(bloom);
worldComposer.addPass(new OutputPass());
const worldSize = { w: 0, h: 0 };
function drawWorld(x, y, w, h) {
  if (w < 2 || h < 2) return;
  if (w !== worldSize.w || h !== worldSize.h) {
    worldSize.w = w; worldSize.h = h;
    worldCam.aspect = w / h;
    worldCam.updateProjectionMatrix();
    worldComposer.setPixelRatio(Math.min(renderer.getPixelRatio(), QUALITY.worldDpr));
    worldComposer.setSize(w, h);
  }
  const p = PRESETS[state.preset];
  renderer.toneMappingExposure = 1.5 * p.world;
  bloom.strength = p.bloom[0];
  bloom.threshold = p.bloom[1];
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.setScissorTest(true);
  focusU.uGlowOn.value = 1;
  worldComposer.render();
}
