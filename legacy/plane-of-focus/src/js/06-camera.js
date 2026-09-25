
// ---------------------------------------------------------------------------
// Camera: orbit / pan / zoom / walk, plus a loop of slow cinematic shots.
// `goal` is where the camera wants to be; the real camera eases toward it.
// ---------------------------------------------------------------------------
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const view = { pos: V3(0, 0, 0), tgt: V3(0, 0, 0), gPos: V3(0, 0, 0), gTgt: V3(0, 0, 0) };
function homePose() {
  const a = innerWidth / innerHeight;
  const k = clamp(1.5 / a, 1, 2.1);
  const tgt = a < 1 ? V3(12, 6, 0) : V3(13, 1, 0);
  return { pos: tgt.clone().add(V3(-6, 40, 182).multiplyScalar(k)), tgt };
}
function setGoal(pos, tgt, snap = false) {
  view.gPos.copy(pos); view.gTgt.copy(tgt);
  if (snap) { view.pos.copy(pos); view.tgt.copy(tgt); }
}
function goalFromCurrent() { view.gPos.copy(view.pos); view.gTgt.copy(view.tgt); }

const _off = new THREE.Vector3(), _sph = new THREE.Spherical();
function orbit(dTheta, dPhi) {
  _off.copy(view.gPos).sub(view.gTgt);
  _sph.setFromVector3(_off);
  _sph.theta += dTheta;
  _sph.phi = clamp(_sph.phi + dPhi, 0.12, 1.62);
  _off.setFromSpherical(_sph);
  view.gPos.copy(view.gTgt).add(_off);
}
function dolly(factor) {
  _off.copy(view.gPos).sub(view.gTgt);
  const r = clamp(_off.length() * factor, 12, 480);
  view.gPos.copy(view.gTgt).add(_off.setLength(r));
}
const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3();
function pan(dx, dy) {
  const r = view.gPos.distanceTo(view.gTgt);
  camera.matrixWorld.extractBasis(_right, _up, _fwd);
  const k = r * 0.0013;
  const d = _right.multiplyScalar(-dx * k).add(_up.multiplyScalar(dy * k));
  view.gPos.add(d); view.gTgt.add(d);
}
function walk(forward, strafe, dt) {
  const r = view.gPos.distanceTo(view.gTgt);
  _fwd.copy(view.gTgt).sub(view.gPos).setY(0).normalize();
  _right.set(-_fwd.z, 0, _fwd.x);
  const d = _fwd.multiplyScalar(forward).add(_right.multiplyScalar(strafe)).multiplyScalar(r * 0.7 * dt);
  view.gPos.add(d); view.gTgt.add(d);
}
function turn(angle) {
  _off.copy(view.gTgt).sub(view.gPos).applyAxisAngle(V3(0, 1, 0), angle);
  view.gTgt.copy(view.gPos).add(_off);
}

// --- cinematic shots -----------------------------------------------------------------
const demo = {
  focus: (s) => { if (autoOk()) state.focusTarget = s; },
  ap: (N) => { if (autoOk()) state.NTarget = N; },
  explode: (e) => { if (autoOk()) state.explodeTarget = e; },
};
function autoOk() { return performance.now() - state.lastControlAt > 20000; }
const SHOTS = [
  { a: [-34, 30, 118], b: [48, 26, 110], la: [14, 6, 0], lb: [30, 6, 0], dur: 9,
    start: () => { demo.explode(1); demo.ap(2); demo.focus(38); } },
  { a: [-64, 19, -17], b: [-61, 15, 15], la: [-18, 12, 0], lb: [-18, 12, 0], dur: 9,
    during: (k) => demo.focus(lerp(38, 78, smooth(clamp((k - 0.15) / 0.7, 0, 1)))) },
  { a: [-14, 27, 31], b: [9, 23, 29], la: [-4, 12, 0], lb: [5, 12, 0], dur: 8,
    start: () => demo.ap(16), during: (k) => { if (k > 0.55) demo.ap(2); } },
  { a: [38, 44, 54], b: [70, 40, 48], la: [46, 8, -2], lb: [62, 8, -4], dur: 10,
    during: (k) => demo.focus(lerp(30, 86, smooth(clamp((k - 0.1) / 0.8, 0, 1)))) },
  { a: [88, 36, -32], b: [85, 31, 26], la: [22, 12, 0], lb: [22, 12, 0], dur: 8,
    start: () => { demo.focus(52); demo.ap(5.6); } },
  { a: [-12, -4, 74], b: [62, -4, 74], la: [-4, -18, 22], lb: [58, -18, 22], dur: 9,
    during: (k) => demo.focus(lerp(32, 88, smooth(k))) },
  { a: [-26, 21, 27], b: [-18, 15, 25], la: [-30, 12, 0], lb: [-14, 12, 0], dur: 8,
    start: () => { demo.focus(78); demo.ap(2); } },
];
const cine = { i: 0, t: 0 };
function startCinematic(on) {
  state.cinematic = on;
  if (on) { cine.i = 0; cine.t = 0; SHOTS[0].start?.(); }
  else goalFromCurrent();
  document.getElementById('cineBtn').setAttribute('aria-pressed', String(on));
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function updateCamera(dt) {
  let rate = 7;
  if (state.cinematic) {
    const shot = SHOTS[cine.i];
    cine.t += dt;
    const k = clamp(cine.t / shot.dur, 0, 1), e = smooth(k);
    view.gPos.copy(_a.fromArray(shot.a)).lerp(_b.fromArray(shot.b), e);
    view.gTgt.copy(_a.fromArray(shot.la)).lerp(_b.fromArray(shot.lb), e);
    shot.during?.(k);
    if (cine.t >= shot.dur) { cine.i = (cine.i + 1) % SHOTS.length; cine.t = 0; SHOTS[cine.i].start?.(); }
    rate = 1.5;
  }
  const f = 1 - Math.exp(-rate * dt);
  view.pos.lerp(view.gPos, f);
  view.tgt.lerp(view.gTgt, f);
  camera.position.copy(view.pos);
  camera.lookAt(view.tgt);
}
