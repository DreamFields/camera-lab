
// ---------------------------------------------------------------------------
// The zoom lens: 24-135 mm, optical centre fixed at x = 0 (the aperture
// stop). Built along +x at height AXIS_Y. Sub-assemblies live in their own
// group (lensParts) so "taken apart" can spread them along the axis; the
// focus and zoom glass groups (focusCell / zoomCell) additionally travel
// inside their own housing as D / f change. Rings are turned by the controls
// module (see lensRings) — this file only builds them and reads their
// rotation back for the follow-focus pinion.
// ---------------------------------------------------------------------------
const lens = new THREE.Group();
lens.position.y = AXIS_Y;
scene.add(lens);

const lensParts = {};
const lensRings = {};
const focusCell = new THREE.Group();
const zoomCell = new THREE.Group();
const bellows = new THREE.Mesh(new THREE.BufferGeometry(), cuttable(std(0x101114, { roughness: 0.95, metalness: 0.05 })));
bellows.castShadow = bellows.receiveShadow = true;
lens.add(bellows);

const IRIS_BLADES = 9, IRIS_MAX = 5.0;
function irisRadius(N) { return IRIS_MAX * (1.4 / N); }

let buildIris, lensAnchor, filterMount, updateLens;

{
  // ---- private helpers, state and geometry -------------------------------
  const ALPHA_MARK = 0.6;              // rad; where every ring's index mark sits
  const idxMat = { color: '#ffffff', gain: 2.0 };

  function part(name, dx) { const g = new THREE.Group(); lens.add(g); lensParts[name] = { g, dx }; return g; }

  // a lens element: two spherical-ish caps, sag a (front, +x) and b (back)
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
    m.castShadow = false; rim.castShadow = false;
    m.receiveShadow = rim.receiveShadow = true;
    grp.add(m, rim);
    grp.position.x = x;
    return grp;
  }

  // a ribbed rubber-grip texture; `period` px per rib pair (wider = fewer, fatter ribs)
  function ribbedMat(period, base = '#1c1e23', rib = '#0b0c0f') {
    const t = canvasTex(256, 16, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += period) { g.fillStyle = rib; g.fillRect(x, 0, period * 0.42, h); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.round(256 / period) * 3, 1);
    return std(0xffffff, { map: t, roughness: 0.88 });
  }
  const focusGripMat = cuttable(ribbedMat(22));
  const zoomGripMat = cuttable(ribbedMat(40));            // wider ribs: visibly different from focus
  const apGripMat = cuttable(std(0x2c2f36, { metalness: 0.75, roughness: 0.4 }));
  const barrelMat = cuttable(blackMat);
  const darkRingMat = cuttable(std(0x1f2228, { roughness: 0.6, metalness: 0.4 }));
  const focusTubeMat = cuttable(std(0x2b2f37, { metalness: 0.5, roughness: 0.4 }));
  const zoomTubeMat = cuttable(std(0x262a32, { metalness: 0.5, roughness: 0.4 }));

  // a small bright glyph on a ring or on the static barrel, at ring-local
  // angle a: position (x, r cos a, r sin a), facing outward.
  function glyph(parent, text, x, r, a, h, o = {}) {
    const m = labelPlane(text, h, { color: '#eef2f8', ...o });
    m.position.set(x, r * Math.cos(a), r * Math.sin(a));
    m.rotation.x = a - Math.PI / 2;
    m.material.clippingPlanes = [cutPlane, cutTop]; m.material.clipIntersection = true;
    parent.add(m);
    return m;
  }
  // a printed scale on a ring: entries {p, text, color?, h?}; angle(p) = ALPHA_MARK - p*span
  function ringScale(rot, x, r, span, entries) {
    for (const e of entries) glyph(rot, e.text, x, r, ALPHA_MARK - e.p * span, e.h || 0.9, { color: e.color });
  }
  function ringDots(rot, x, r, span, ps) {
    for (const p of ps) glyph(rot, '·', x, r, ALPHA_MARK - p * span, 0.5);
  }
  function indexMark(staticParent, x, r) {
    glyph(staticParent, '▮', x, r + 0.18, ALPHA_MARK, 0.55, idxMat);
  }

  // =========================================================================
  // REAR CELL  [-5.5, -2.6]  (dx -4)
  // =========================================================================
  const pRear = part('rear', -4);
  pRear.add(tube(-5.7, -5.4, 5.8, 5.15, chromeMat));              // mount flange, bellows attaches at -5.5
  pRear.add(tube(-5.4, -2.6, 5.6, 5.15, barrelMat));
  pRear.add(element(-4.6, 4.2, 0.8, 0.6, 0.3));
  pRear.add(element(-3.4, 4.4, 0.6, -0.3, 0.7));

  // =========================================================================
  // APERTURE RING  [-2.6, -1.4]  (dx -2.2) — housing + grip + copper gear
  // =========================================================================
  const pAp = part('apRing', -2.2);
  pAp.add(tube(-2.6, -2.0, 6.3, 5.8, darkRingMat));
  const apRot = new THREE.Group();
  const apGrip = tube(-2.0, -1.65, 6.35, 5.85, apGripMat);
  const apGear = gear(-1.65, -1.4, 6.5, 64, 0.55, copperMat);
  apRot.add(apGrip, apGear);
  pAp.add(apRot);
  indexMark(pAp, -2.05, 6.3);
  {
    const N_LEN = N_STOPS.length;
    const fullSet = new Set(FULL_N);
    const nums = [], dots = [];
    for (let i = 0; i < N_LEN; i++) {
      const v = N_STOPS[i], p = i / (N_LEN - 1);
      if (fullSet.has(v)) nums.push({ p, text: String(v) }); else dots.push(p);
    }
    ringScale(apRot, -1.8, 6.55, 2.4, nums);
    ringDots(apRot, -1.8, 6.55, 2.4, dots);
  }
  lensRings.aperture = { rot: apRot, pick: [apGrip, apGear], x0: -2.6, x1: -1.4, r: 6.5 };

  // =========================================================================
  // IRIS  (dx -1.2) — 9-blade shape at x = -1.0, own thin housing
  // =========================================================================
  const pIris = part('iris', -1.2);
  pIris.add(tube(-1.4, 0.7, 6.4, 6.05, darkRingMat));
  const irisMat = std(0x2a2d34, { metalness: 0.7, roughness: 0.42, side: THREE.DoubleSide });
  const iris = new THREE.Mesh(new THREE.BufferGeometry(), irisMat);
  iris.position.x = -1.0;
  iris.castShadow = false;
  const irisSeams = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x55606f }));
  irisSeams.position.x = -0.97;
  pIris.add(iris, irisSeams);
  const IRIS_OUT = 6.3;
  buildIris = function (N) {
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
  };

  // =========================================================================
  // FOCUS RING  [0.7, 6.3]  (dx +2.2) — housing + grip + gear + motor
  // FOCUS CELL  inside [0.8, 5.2] — glass, travels with D (own group, dx +1.2)
  // =========================================================================
  const pFocusRing = part('ring', 2.2);
  pFocusRing.add(tube(0.7, 6.3, 6.3, 5.85, barrelMat));
  const focusRot = new THREE.Group();
  const focusGrip = tube(0.85, 4.5, 6.35, 5.9, focusGripMat, 96);
  const FOCUS_GEAR_R = 6.45;
  const focusGear = gear(4.6, 6.1, FOCUS_GEAR_R, 84, 0.6, copperMat);
  focusRot.add(focusGrip, focusGear);
  pFocusRing.add(focusRot);
  indexMark(pFocusRing, 0.75, 6.3);
  ringScale(focusRot, 2.7, 6.6, 4.2, [25, 30, 35, 40, 50, 60, 80, 100].map((D) => ({ p: logPos(D, D_MIN, D_MAX), text: String(D) })));
  glyph(focusRot, 'cm', 2.7, 6.6, ALPHA_MARK - 1.06 * 4.2, 0.55);

  // follow-focus motor + pinion meshing the gear on top. Both the ring gear
  // and the pinion turn about axes parallel to the barrel's own x axis (two
  // spur gears meshing side-on), so the pinion needs no extra reorientation —
  // just a position above the ring gear with its teeth tips just touching.
  const PINION_R = 2.2;
  const pinion = gear(-1.1, 1.1, PINION_R, 22, 0.55, copperMat);
  const pinionPivot = new THREE.Group();
  pinionPivot.position.set(5.35, 9.7, 0);                    // (focusGear tip 7.05) + (pinion tip 2.75) - 0.1 overlap
  pinionPivot.add(pinion);
  const motorBody = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.0, 3.6), std(0xd08a3c, { metalness: 0.9, roughness: 0.38 }));
  motorBody.position.set(3.1, 13.0, 0);
  const motorCap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.5), blackMat);
  motorCap.position.set(3.1, 15.0, 0);
  shadows(motorBody); shadows(motorCap);
  pFocusRing.add(pinionPivot, motorBody, motorCap);

  lensRings.focus = { rot: focusRot, pick: [focusGrip, focusGear, motorBody, pinion], x0: 0.7, x1: 6.3, r: FOCUS_GEAR_R };

  const pFocus = part('focus', 1.2);
  pFocus.add(focusCell);
  focusCell.add(tube(0.8, 5.2, 5.75, 5.3, focusTubeMat));
  focusCell.add(element(1.8, 5.0, 0.9, 0.8, 0.4));
  focusCell.add(element(4.2, 5.2, 0.6, -0.3, 0.9));

  // =========================================================================
  // ZOOM RING  [6.3, 11.1]  (dx +3.8) — housing + grip + gear
  // ZOOM CELL  inside [6.4, 11] — glass, travels with f (nested, same dx)
  // =========================================================================
  const pZoom = part('zoom', 3.8);
  pZoom.add(tube(6.3, 11.1, 6.5, 6.05, barrelMat));
  const zoomRot = new THREE.Group();
  const zoomGrip = tube(6.45, 9.3, 6.55, 6.1, zoomGripMat, 96);
  const zoomGear = gear(9.4, 10.9, 6.65, 80, 0.6, copperMat);
  zoomRot.add(zoomGrip, zoomGear);
  pZoom.add(zoomRot);
  indexMark(pZoom, 6.35, 6.5);
  ringScale(zoomRot, 7.8, 6.85, 2.4, [24, 35, 50, 70, 85, 105, 135].map((f) => ({ p: logPos(f, F_MIN, F_MAX), text: String(f) })));

  lensRings.zoom = { rot: zoomRot, pick: [zoomGrip, zoomGear], x0: 6.3, x1: 11.1, r: 6.65 };

  pZoom.add(zoomCell);
  zoomCell.add(tube(6.4, 11.0, 5.9, 5.45, zoomTubeMat));
  zoomCell.add(element(7.6, 5.6, 0.8, 0.7, 0.4));
  zoomCell.add(element(9.6, 5.9, 0.6, -0.3, 0.9));

  // =========================================================================
  // FRONT BARREL  [11.1, 17.75]  (dx +6)
  // =========================================================================
  const pFront = part('front', 6);
  pFront.add(tube(11.1, 17.0, 6.8, 6.35, barrelMat));
  pFront.add(element(12.9, 6.0, 0.7, -0.3, 1.0));
  pFront.add(element(15.8, 6.6, 1.2, 1.4, 0.6));
  {
    const t = canvasTex(1536, 40, (g, w, h) => {
      g.fillStyle = '#0f1013'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c8d2e0'; g.font = '600 22px ' + MONO;
      g.fillText('ZOOM 24–135mm 1:1.4   ⌀ 77   BENCH OPTICS   ZOOM 24–135mm 1:1.4   ⌀ 77   BENCH OPTICS', 24, 27);
    });
    pFront.add(tube(17.0, 17.42, 6.83, 6.78, cuttable(std(0xffffff, { map: t, roughness: 0.4 })), 96));
  }
  pFront.add(gear(17.42, 17.75, 6.78, 60, 0.06, chromeMat));   // filter thread (fine ridges, not cut)

  // =========================================================================
  // updateLens
  // =========================================================================
  let lastIrisN = -1, lastBellowsLen = -1;
  updateLens = function (dt) {
    const t = smooth(state.explode);
    for (const k in lensParts) lensParts[k].g.position.x = lensParts[k].dx * t;

    const D = state.cur.D, f = state.cur.f, N = state.cur.N;
    focusCell.position.x = 2.6 * (1 - logPos(D, D_MIN, D_MAX));
    zoomCell.position.x = 3 * logPos(f, F_MIN, F_MAX);

    if (Math.abs(N - lastIrisN) > 1e-3) { buildIris(N); lastIrisN = N; }

    pinion.rotation.x = -lensRings.focus.rot.rotation.x * (FOCUS_GEAR_R / PINION_R);

    // bellows: rear flange of the lens to the mount face of the body
    const xLens = -5.5 + lensParts.rear.dx * t;
    const xBody = mountX(f) - 5 * t;
    const len = Math.max(1.8, xLens - xBody);
    bellows.position.x = xBody;
    if (Math.abs(len - lastBellowsLen) > 0.2) {
      const rOut = 6.0, rIn = 5.55, cap = 5.85;
      const half = clamp(Math.round(len / 0.85), 2, 70);
      const pts = [new THREE.Vector2(cap, 0)];
      for (let i = 0; i <= half; i++) pts.push(new THREE.Vector2(i % 2 === 0 ? rOut : rIn, (i / half) * len));
      pts.push(new THREE.Vector2(cap, len));
      bellows.geometry.dispose();
      bellows.geometry = alongX(new THREE.LatheGeometry(pts, 40));
      lastBellowsLen = len;
    }

    cutPlane.constant = lerp(60, 0.4, t);
  };

  lensAnchor = function (name, y = 0) {
    const t = smooth(state.explode);
    let x;
    if (name === 'bellows') {
      const xLens = -5.5 + lensParts.rear.dx * t;
      const xBody = mountX(state.cur.f) - 5 * t;
      x = (xLens + xBody) / 2;
    } else {
      const base = { front: 15.8, rear: -5.5, iris: -1.0, focus: 3.0, ring: 3.5, zoom: 8.6, apRing: -2.0 }[name];
      const extra = name === 'focus' ? focusCell.position.x : name === 'zoom' ? zoomCell.position.x : 0;
      x = lensParts[name].dx * t + base + extra;
    }
    return new THREE.Vector3(x, AXIS_Y + y, 0);
  };

  filterMount = function () {
    return new THREE.Vector3(17.75 + lensParts.front.dx * smooth(state.explode), AXIS_Y, 0);
  };

  // initial pose so the lens looks right before the first updateLens() tick
  shadows(lens);
  lens.traverse((m) => { if (m.isMesh && (m.material === glassMat || m.material === rimMat)) m.castShadow = false; });
  buildIris(state.cur.N || 2);
  lastIrisN = state.cur.N || 2;
  updateLens(0);
}
