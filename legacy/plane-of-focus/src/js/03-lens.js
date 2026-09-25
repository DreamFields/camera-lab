
// ---------------------------------------------------------------------------
// The lens: barrel sections, glass groups, an iris and two geared rings.
// Every part sits in its own group so it can slide along the axis when the
// lens is taken apart. Built around the optical axis (x) at height AXIS_Y.
// ---------------------------------------------------------------------------
const lens = new THREE.Group();
lens.position.y = AXIS_Y;
scene.add(lens);

const blackMat = std(0x16181d, { roughness: 0.55, metalness: 0.35 });
const rubberTex = canvasTex(256, 16, (g, w, h) => {
  g.fillStyle = '#1c1e23'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { g.fillStyle = '#0b0c0f'; g.fillRect(x, 0, 3, h); }
});
rubberTex.wrapS = rubberTex.wrapT = THREE.RepeatWrapping;
rubberTex.repeat.set(12, 1);
const rubberMat = std(0xffffff, { map: rubberTex, roughness: 0.9 });
const chromeMat = std(0xd9dde4, { metalness: 1, roughness: 0.22 });
const copperMat = std(0xd9823a, { metalness: 1, roughness: 0.33 });
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xeaf8ff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 1.2, ior: 1.52,
  attenuationColor: new THREE.Color(0x9fe0ff), attenuationDistance: 14, specularIntensity: 1, envMapIntensity: 1.4,
});
const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe3ff).multiplyScalar(1.6) });
// the cut-away: clips the half of the housing that faces the viewer
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 40);
const cutMats = [];
function cuttable(m) { const c = m.clone(); c.clippingPlanes = [cutPlane]; c.side = THREE.DoubleSide; cutMats.push(c); return c; }

// tube along x from x0 to x1 with outer radius ro, inner radius ri
function tube(x0, x1, ro, ri, mat, seg = 64) {
  const pts = [new THREE.Vector2(ri, x0), new THREE.Vector2(ro, x0), new THREE.Vector2(ro, x1), new THREE.Vector2(ri, x1), new THREE.Vector2(ri, x0)];
  return new THREE.Mesh(alongX(new THREE.LatheGeometry(pts, seg)), mat);
}
// A gear ring: teeth around a cylinder, along x from x0 to x1.
function gear(x0, x1, r, teeth, depth, mat) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, da = Math.PI * 2 / teeth;
    const pts = [[r, a], [r + depth, a + da * 0.18], [r + depth, a + da * 0.5], [r, a + da * 0.68]];
    pts.forEach(([rr, aa], k) => (i === 0 && k === 0 ? s.moveTo : s.lineTo).call(s, rr * Math.cos(aa), rr * Math.sin(aa)));
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r - 1.1, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false, curveSegments: 24 });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return new THREE.Mesh(g, mat);
}
// a lens element: two spherical-ish caps, sag a (front, toward +x) and b (back)
function element(x, R, t, a, b) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) { const r = (i / n) * R; pts.push(new THREE.Vector2(r, -t / 2 - b * (1 - (r / R) ** 2))); }
  for (let i = n; i >= 0; i--) { const r = (i / n) * R; pts.push(new THREE.Vector2(r, t / 2 + a * (1 - (r / R) ** 2))); }
  const g = alongX(new THREE.LatheGeometry(pts, 48));
  const grp = new THREE.Group();
  const m = new THREE.Mesh(g, glassMat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 6, 64), rimMat);
  rim.rotation.y = Math.PI / 2;
  grp.add(m, rim);
  grp.position.x = x;
  return grp;
}

// --- parts: [group, assembled x offset, exploded x offset] -------------------
const parts = {};
function part(name, dx) { const g = new THREE.Group(); lens.add(g); parts[name] = { g, dx }; return g; }

// rear mount and rear group
const pMount = part('mount', -12);
pMount.add(tube(-15.6, -14, 5.6, 4.4, chromeMat));
pMount.add(tube(-14, -12.6, 6.8, 4.6, cuttable(blackMat)));
const pRear = part('rear', -8.5);
pRear.add(tube(-12.6, -6.2, 7.2, 6.6, cuttable(blackMat)));
pRear.add(element(-10.8, 4.6, 0.9, 0.7, 0.3), element(-8.6, 4.9, 0.6, -0.4, 0.9));
// aperture ring with its gear
const pAp = part('apRing', -5);
pAp.add(tube(-6.2, -2.6, 7.6, 6.9, cuttable(std(0x1f2228, { roughness: 0.6, metalness: 0.4 }))));
const apGear = gear(-5.6, -3.2, 7.7, 72, 0.7, copperMat);
pAp.add(apGear);
// the iris
const pIris = part('iris', -2.4);
const irisMat = std(0x2a2d34, { metalness: 0.7, roughness: 0.42, side: THREE.DoubleSide });
const iris = new THREE.Mesh(new THREE.BufferGeometry(), irisMat);
iris.position.x = -1.4;
const irisSeams = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x55606f }));
irisSeams.position.x = -1.36;
pIris.add(iris, irisSeams, tube(-1.9, -0.9, 6.7, 6.2, cuttable(blackMat)));
const IRIS_BLADES = 9, IRIS_OUT = 6.3, IRIS_MAX = 5.0;
function irisRadius(N) { return IRIS_MAX * (N_MIN / N); }
function buildIris(N) {
  const r = irisRadius(N), rot = (N - 2) * 0.09;
  const s = new THREE.Shape();
  s.absarc(0, 0, IRIS_OUT, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  const verts = [];
  for (let i = 0; i < IRIS_BLADES; i++) {
    const a = -(i / IRIS_BLADES) * Math.PI * 2 + rot;
    verts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  verts.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
  h.closePath();
  s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 24);
  g.rotateY(Math.PI / 2);
  iris.geometry.dispose();
  iris.geometry = g;
  const seg = [];
  for (let i = 0; i < IRIS_BLADES; i++) {
    const [x, y] = verts[i], a = Math.atan2(y, x) + 1.25;
    const ex = x + Math.cos(a) * (IRIS_OUT - r) * 1.15, ey = y + Math.sin(a) * (IRIS_OUT - r) * 1.15;
    const k = Math.min(1, IRIS_OUT / Math.hypot(ex, ey));
    seg.push(0, y, -x, 0, ey * k, -ex * k);
  }
  irisSeams.geometry.dispose();
  irisSeams.geometry = new THREE.BufferGeometry();
  irisSeams.geometry.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
}
// the focusing group rides inside the barrel
const pFocus = part('focus', 0.8);
const focusCell = new THREE.Group();
focusCell.add(element(1.2, 5.4, 1.0, 1.1, 0.5), element(3.4, 5.6, 0.7, 0.2, 1.0));
focusCell.add(tube(0, 4.6, 6.0, 5.6, cuttable(std(0x2b2f37, { metalness: 0.5, roughness: 0.4 }))));
pFocus.add(focusCell);
// focus ring: rubber grip plus the big gear you can drag
const pRing = part('ring', 2.5);
pRing.add(tube(-0.6, 8.6, 7.6, 7.1, cuttable(blackMat)));
const ringRot = new THREE.Group();
const grip = tube(0.2, 5.4, 8.2, 7.6, cuttable(rubberMat), 96);
const focusGear = gear(5.6, 8.2, 8.3, 90, 0.8, copperMat);
ringRot.add(grip, focusGear);
pRing.add(ringRot);
// front barrel and the big front element
const pFront = part('front', 5.2);
pFront.add(tube(8.6, 15.2, 7.9, 7.3, cuttable(blackMat)));
pFront.add(tube(15.2, 16.6, 8.3, 7.0, cuttable(std(0x0f1013, { roughness: 0.35, metalness: 0.5 }))));
const frontEl = element(13.4, 6.6, 1.2, 1.5, 0.6);
pFront.add(frontEl);
pFront.add(element(10.6, 6.0, 0.7, -0.3, 1.1));
// small bright ring of text-like ticks on the front lip
{
  const t = canvasTex(1024, 32, (g, w, h) => {
    g.fillStyle = '#0f1013'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8d2e0'; g.font = '600 18px DM Mono, monospace';
    g.fillText('50 mm  1:2   ⌀ 67   FOCUS PLANE LAB   50 mm  1:2   ⌀ 67', 20, 23);
  });
  const lip = tube(15.25, 16.55, 8.31, 8.3, std(0xffffff, { map: t, roughness: 0.4 }), 96);
  pFront.add(lip);
}

// the follow-focus motor with a pinion meshing into the focus gear
const motor = new THREE.Group();
const pinion = gear(-1.2, 1.2, 2.2, 22, 0.6, copperMat);
const pinionPivot = new THREE.Group();
pinionPivot.position.set(6.9 - 0.0, 8.3 + 0.8 + 2.2 + 0.5, 0);
pinion.position.x = 0;
pinionPivot.add(pinion);
const motorBody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 4.2), std(0xd08a3c, { metalness: 0.9, roughness: 0.38 }));
motorBody.position.set(6.9 - 3.6, 8.3 + 3.4, 0);
const motorCap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), blackMat);
motorCap.position.set(6.9 - 3.6, 8.3 + 5.6, 0);
motor.add(pinionPivot, motorBody, motorCap);
pRing.add(motor);

shadows(lens);
lens.traverse((m) => { if (m.isMesh && m.material === glassMat) m.castShadow = false; });
lens.traverse((m) => { if (m.isMesh && m.material === rimMat) m.castShadow = false; });

// handles for picking
const focusHandles = [grip, focusGear, motorBody, pinion];
focusHandles.forEach((m) => (m.userData.pick = 'ring'));

let lastIrisN = 0;
function updateLens(dt) {
  const t = smooth(state.explode);
  for (const k in parts) parts[k].g.position.x = parts[k].dx * t;
  // focusing group travels with the extension
  focusCell.position.x = (extensionMm(state.focus) - 2.8) * 0.3;
  const ringA = (extensionMm(state.focus) - 2.8) * 0.42;
  ringRot.rotation.x = ringA;
  pinion.rotation.x = -ringA * (8.3 / 2.2);
  apGear.rotation.x = Math.log2(state.N) * 0.5;
  if (Math.abs(state.N - lastIrisN) > 1e-3) { buildIris(state.N); lastIrisN = state.N; }
  // cut away the near half of the housing when taken apart
  cutPlane.constant = lerp(40, 0.4, t);
}
// world-space anchors used by rays and labels
const _v = new THREE.Vector3();
function lensAnchor(name, y = 0) {
  const p = parts[name].g;
  const x = { front: 13.4, rear: -9.7, iris: -1.4, focus: 2.3 + focusCell.position.x, ring: 6.9 }[name];
  return _v.set(p.position.x + x, AXIS_Y + y, 0).clone();
}
