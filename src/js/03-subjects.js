
// ---------------------------------------------------------------------------
// Subjects: a model with test charts at 3 m, a row of distance signs, flowers
// right in front of the lens, and things that move — a cyclist, cars and a
// fountain — so the shutter has something to freeze or smear. animate(τ)
// poses everything for scene time τ, so the photo can be rendered at several
// instants inside one exposure.
// ---------------------------------------------------------------------------
const subjects = new THREE.Group();
scene.add(subjects);
const _q = new THREE.Quaternion(), _y = V3(0, 1, 0), _d = new THREE.Vector3();
// place a unit (height 1, base at origin) mesh so it spans a → b
function span(mesh, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(_y, _d.divideScalar(len || 1));
  mesh.scale.set(1, len, 1);
  return mesh;
}
const unitCyl = (r0, r1, seg = 10) => new THREE.CylinderGeometry(r1, r0, 1, seg).translate(0, 0.5, 0);
// centre a y-aligned mesh (capsule, cylinder) between a and b
function between(mesh, a, b) {
  mesh.position.lerpVectors(a, b, 0.5);
  mesh.quaternion.setFromUnitVectors(_y, _d.subVectors(b, a).normalize());
  return mesh;
}
function faceCamera(g) { g.rotateY(-Math.PI / 2); return g; }   // plane facing −x, texture upright

// --- the model --------------------------------------------------------------------------
const MODEL = V3(3, 0.04, 0);
{
  const g = new THREE.Group();
  const skin = glowMat(0xc98f6b, { roughness: 0.55 });
  const hair = glowMat(0x2a1b14, { roughness: 0.65 });
  const coat = glowMat(0xc4553c, { roughness: 0.82 });
  const jeans = glowMat(0x34465c, { roughness: 0.85 });
  const shoe = glowMat(0x2b2623, { roughness: 0.6 });
  const scarf = glowMat(0xe2b95a, { roughness: 0.9 });
  const dark = std(0x1a1210, { roughness: 0.4 });
  const lips = std(0x9a4a45, { roughness: 0.5 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.052, 0.8, 14).translate(0, 0.48, 0), jeans);
    leg.position.z = s * 0.095;
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.18, 4, 10).rotateZ(Math.PI / 2), shoe);
    foot.position.set(-0.05, 0.05, s * 0.095);
    g.add(leg, foot);
  }
  const prof = [[0.0, 0.7], [0.205, 0.7], [0.2, 0.86], [0.185, 1.0], [0.2, 1.18], [0.218, 1.32], [0.2, 1.41], [0.12, 1.46], [0.0, 1.47]];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 24), coat);
  torso.scale.set(0.64, 1, 1);
  g.add(torso);
  // lapels and buttons: a darker strip down the front
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.62, 0.05), glowMat(0x8e3a28));
  placket.position.set(-0.128, 1.08, 0);
  g.add(placket);
  for (const s of [-1, 1]) {
    const shoulder = V3(0.0, 1.39, s * 0.23), elbow = V3(-0.02, 1.1, s * 0.255), wrist = V3(-0.07, 0.86, s * 0.262);
    const up = between(new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.26, 4, 10), coat), shoulder, elbow);
    const fore = between(new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.22, 4, 10), coat), elbow, wrist);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.043, 12, 10), skin);
    hand.position.set(-0.08, 0.8, s * 0.262); hand.scale.set(0.8, 1.15, 0.7);
    g.add(up, fore, hand);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.14, 12), skin);
  neck.position.y = 1.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.106, 28, 20), skin);
  head.position.set(0, 1.635, 0); head.scale.set(0.9, 1.1, 0.86);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.114, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.position.set(0.012, 1.648, 0); cap.scale.set(0.95, 1.1, 0.92); cap.rotation.z = -0.5;
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), hair);
  bob.position.set(0.04, 1.585, 0); bob.scale.set(0.78, 1.15, 1.06);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), hair);
  bun.position.set(0.075, 1.745, 0);
  g.add(neck, head, cap, bob, bun);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 10, 8), dark);
    eye.position.set(-0.089, 1.647, s * 0.036);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.007, 0.032), hair);
    brow.position.set(-0.089, 1.672, s * 0.037); brow.rotation.x = s * 0.12;
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), std(0xd9806e, { roughness: 0.7, transparent: true, opacity: 0.35 }));
    cheek.position.set(-0.083, 1.612, s * 0.05); cheek.scale.set(0.3, 0.7, 1);
    g.add(eye, brow, cheek);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), skin);
  nose.position.set(-0.099, 1.624, 0); nose.scale.set(1, 1.3, 0.9);
  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.03, 3, 6).rotateX(Math.PI / 2), lips);
  mouth.position.set(-0.092, 1.591, 0);
  g.add(nose, mouth);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.034, 10, 24).rotateX(Math.PI / 2), scarf);
  ring.position.y = 1.455; ring.scale.set(0.8, 1, 1);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.075), scarf);
  tail.position.set(-0.13, 1.3, 0.05); tail.rotation.x = 0.08;
  g.add(ring, tail);
  g.position.copy(MODEL);
  subjects.add(shadows(g));
}

// --- test charts beside the model: a colour checker and a Siemens star ----------------------
const CHECKER = ['#735244', '#c29682', '#627a9d', '#576c43', '#8580b1', '#67bdaa', '#d67e2c', '#505ba6', '#c15a63', '#5e3c6c', '#9dbc40', '#e0a32e',
  '#383d96', '#469449', '#af363c', '#e7c71f', '#bb5695', '#0885a1', '#f3f3f2', '#c8c8c8', '#a0a0a0', '#7a7a79', '#555555', '#343434'];
function easel(x, z, top, mat) {
  const g = new THREE.Group();
  for (const [dx, dz] of [[0.18, 0], [-0.1, 0.16], [-0.1, -0.16]]) g.add(span(new THREE.Mesh(unitCyl(0.012, 0.009, 6), mat), V3(x + dx, 0.04, z + dz), V3(x + 0.02, top, z)));
  return g;
}
{
  const legs = glowMat(0x2a2c30, { metalness: 0.5, roughness: 0.5 });
  const tex = canvasTex(720, 500, (g, w, h) => {
    g.fillStyle = '#161616'; g.fillRect(0, 0, w, h);
    const pw = 100, gap = 14, x0 = (w - 6 * pw - 5 * gap) / 2, y0 = 28;
    CHECKER.forEach((c, i) => { g.fillStyle = c; g.fillRect(x0 + (i % 6) * (pw + gap), y0 + Math.floor(i / 6) * (pw + gap), pw, pw); });
    g.fillStyle = '#d8d8d8'; g.font = `600 22px ${MONO}`; g.textAlign = 'left';
    g.fillText('COLOR CHECKER 24', x0, h - 18);
    g.textAlign = 'right'; g.fillText('18% ▸', x0 + 6 * pw + 5 * gap, h - 18);
  });
  const board = new THREE.Mesh(faceCamera(new THREE.PlaneGeometry(0.4, 0.278)), glowMat(0xffffff, { map: tex, roughness: 0.92 }));
  board.position.set(3, 1.24, -0.52);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.29, 0.41), legs);
  back.position.set(3.012, 1.24, -0.52);
  subjects.add(shadows(board), shadows(back), shadows(easel(3.02, -0.52, 1.12, legs)));

  const star = canvasTex(720, 720, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#111';
    for (let i = 0; i < 36; i++) { const a0 = (i / 36) * Math.PI * 2, a1 = a0 + Math.PI / 36; g.beginPath(); g.moveTo(c, c - 20); g.arc(c, c - 20, c * 0.78, a0, a1); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(c, c - 20, 10, 0, 7); g.fillStyle = '#f4f4f0'; g.fill();
    g.fillStyle = '#111'; g.font = `600 30px ${MONO}`; g.textAlign = 'center';
    g.fillText('SIEMENS STAR · 36', c, w - 22);
    g.lineWidth = 6; g.strokeStyle = '#111'; g.strokeRect(8, 8, w - 16, w - 16);
  });
  const sb = new THREE.Mesh(faceCamera(new THREE.PlaneGeometry(0.4, 0.4)), glowMat(0xffffff, { map: star, roughness: 0.9 }));
  sb.position.set(3, 1.3, 0.52);
  const sbb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.41, 0.41), legs);
  sbb.position.set(3.012, 1.3, 0.52);
  subjects.add(shadows(sb), shadows(sbb), shadows(easel(3.02, 0.52, 1.12, legs)));
}

// --- distance signs, stepping away to the left -----------------------------------------------
const SIGN_D = [1, 2, 3, 5, 7, 10, 15, 20];
{
  const post = glowMat(0x30343a, { metalness: 0.4, roughness: 0.5 });
  const stripes = ['#e0523f', '#f0a028', '#e6c928', '#5bbf5a', '#2fa7b8', '#3f7ad8', '#8a5bd6', '#d6589a'];
  SIGN_D.forEach((d, i) => {
    const tex = canvasTex(320, 208, (g, w, h) => {
      g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h);
      g.fillStyle = stripes[i]; g.fillRect(0, 0, w, 30);
      g.fillStyle = '#16181c'; g.font = `800 120px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(d + ' m', w / 2, h / 2 + 16);
      g.lineWidth = 8; g.strokeStyle = '#16181c'; g.strokeRect(4, 4, w - 8, h - 8);
    });
    const z = -(0.45 + 0.15 * d), y = d <= 2 ? 1.2 : 1.02;
    const b = new THREE.Mesh(faceCamera(new THREE.PlaneGeometry(0.4, 0.26)), glowMat(0xffffff, { map: tex, roughness: 0.7 }));
    b.position.set(d, y, z);
    const p = span(new THREE.Mesh(unitCyl(0.022, 0.02, 8), post), V3(d + 0.02, 0.04, z), V3(d + 0.02, y - 0.13, z));
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.27, 0.41), post);
    bk.position.set(d + 0.011, y, z);
    subjects.add(shadows(b), shadows(p), shadows(bk));
  });
}

// --- foreground: a blossoming branch top-left, flowers bottom-right -----------------------------
{
  const bark = glowMat(0x5a4032, { flatShading: true, roughness: 0.9 });
  const pts = [V3(1.25, 2.55, -1.45), V3(1.18, 2.2, -1.0), V3(1.12, 1.98, -0.62), V3(1.07, 1.8, -0.36), V3(1.05, 1.74, -0.25)];
  for (let i = 0; i < pts.length - 1; i++) subjects.add(span(new THREE.Mesh(unitCyl(0.028 - i * 0.005, 0.024 - i * 0.005, 7), bark), pts[i], pts[i + 1]));
  const petals = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.022, 0), glowMat(0xffffff, { flatShading: true, roughness: 0.7 }), 90);
  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.03, 0), glowMat(0x4f8a3c, { flatShading: true, roughness: 0.8 }), 30);
  const pink = [0xf5b8c9, 0xf9d3de, 0xffffff, 0xee9fb6].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), s = new THREE.Vector3();
  for (let i = 0; i < 90; i++) {
    const t = 0.25 + rand() * 0.75, k = Math.min(3, Math.floor(t * 4)), f = t * 4 - k;
    const p = pts[k].clone().lerp(pts[k + 1], f).add(V3((rand() - 0.5) * 0.08, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12));
    const r = 0.7 + rand() * 0.6;
    m4.compose(p, _q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, 0)), s.set(r, r * 0.7, r));
    petals.setMatrixAt(i, m4); petals.setColorAt(i, pink[i % pink.length]);
  }
  for (let i = 0; i < 30; i++) {
    const t = rand(), k = Math.min(3, Math.floor(t * 4)), f = t * 4 - k;
    const p = pts[k].clone().lerp(pts[k + 1], f).add(V3((rand() - 0.5) * 0.1, (rand() - 0.5) * 0.14, (rand() - 0.5) * 0.14));
    m4.compose(p, _q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, 0)), s.set(1.6, 0.35, 0.9));
    leaves.setMatrixAt(i, m4);
  }
  subjects.add(petals, leaves);

  const stone = glowMat(0xd9d2c4, { roughness: 0.7 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.02, 16), stone);
  stand.position.set(0.78, 0.04 + 0.51, 0.32);
  const vaseP = [[0, 0], [0.07, 0], [0.09, 0.05], [0.085, 0.14], [0.055, 0.2], [0.065, 0.24], [0, 0.24]].map(([r, y]) => new THREE.Vector2(r, y));
  const vase = new THREE.Mesh(new THREE.LatheGeometry(vaseP, 20), glowMat(0x2f6f8f, { roughness: 0.3, metalness: 0.1 }));
  vase.position.set(0.78, 1.06, 0.32);
  subjects.add(shadows(stand), shadows(vase));
  const stem = glowMat(0x4a7a36);
  const heads = [0xf2c14e, 0xf08a4b, 0xfaf3e6, 0xe86a5a, 0xf2c14e];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28 + 0.4, top = V3(0.78 + Math.cos(a) * 0.07, 1.36 + rand() * 0.07, 0.32 + Math.sin(a) * 0.08);
    subjects.add(span(new THREE.Mesh(unitCyl(0.005, 0.004, 5), stem), V3(0.78, 1.2, 0.32), top));
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.036, 1), glowMat(heads[i], { flatShading: true, roughness: 0.8 }));
    fl.position.copy(top); fl.scale.set(1, 0.55, 1); fl.rotation.set(rand(), rand(), rand());
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), glowMat(0x6b4a1e));
    eye.position.copy(top).add(V3(-0.012, 0.016, 0));
    subjects.add(fl, eye);
  }
}

// --- the cyclist ---------------------------------------------------------------------------------
const BIKE_X = 7, BIKE_SPAN = 30, WHEEL_R = 0.34;
const bike = new THREE.Group();
const bikeParts = {};
{
  const frameM = glowMat(0xd63d3a, { metalness: 0.3, roughness: 0.35 });
  const blackM = glowMat(0x17181b, { roughness: 0.6 });
  const steel = glowMat(0xc9ccd2, { metalness: 0.9, roughness: 0.3 });
  const jersey = glowMat(0x1f8a8a, { roughness: 0.7 });
  const shorts = glowMat(0x1d1f24, { roughness: 0.7 });
  const skinM = glowMat(0xb87a56, { roughness: 0.6 });
  const helmet = glowMat(0xf2f2ee, { roughness: 0.35 });
  const wheel = () => {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.017, 0.019, 8, 36).rotateY(Math.PI / 2), blackM));
    w.add(new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.045, 0.008, 6, 36).rotateY(Math.PI / 2), steel));
    for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.004, WHEEL_R * 0.9, 0.004).translate(0, WHEEL_R * 0.45, 0), steel); s.rotation.x = (i / 12) * Math.PI * 2; w.add(s); }
    // a coloured valve cap so the spin is readable
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), frameM); v.position.y = WHEEL_R - 0.06; w.add(v);
    w.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10).rotateZ(Math.PI / 2), steel));
    return w;
  };
  const R = V3(0, WHEEL_R, -0.52), F = V3(0, WHEEL_R, 0.52), B = V3(0, 0.3, -0.02), S = V3(0, 0.84, -0.2), H = V3(0, 0.82, 0.37), Hb = V3(0, 0.66, 0.41);
  for (const [a, b, r] of [[B, S, 0.018], [S, H, 0.016], [B, Hb, 0.02], [B, R, 0.012], [S, R, 0.011], [Hb, H, 0.02], [Hb, F, 0.013]]) bike.add(span(new THREE.Mesh(unitCyl(r, r, 8), frameM), a, b));
  const rear = wheel(); rear.position.copy(R);
  const front = wheel(); front.position.copy(F);
  bike.add(rear, front);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.22), blackM); seat.position.set(0, 0.9, -0.21);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 2), blackM); bar.position.set(0, 0.92, 0.39);
  const stemB = span(new THREE.Mesh(unitCyl(0.014, 0.014, 6), blackM), H, V3(0, 0.92, 0.39));
  bike.add(seat, bar, stemB);
  const crank = new THREE.Group(); crank.position.copy(B);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 24).rotateY(Math.PI / 2), steel);
  ring.position.x = -0.05; crank.add(ring);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.17, 0.025).translate(0, 0.085, 0), steel);
    a.position.x = s * 0.07; a.rotation.x = s > 0 ? Math.PI : 0; crank.add(a); arms.push(a);
  }
  bike.add(crank);
  // rider
  const pelvis = V3(0, 0.98, -0.2), shoulder = V3(0, 1.4, 0.14);
  const torsoM = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 12), jersey);
  torsoM.quaternion.setFromUnitVectors(_y, shoulder.clone().sub(pelvis).normalize());
  torsoM.position.lerpVectors(pelvis, shoulder, 0.5); torsoM.scale.set(1.05, 1, 0.8);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), skinM); headM.position.set(0, 1.55, 0.27);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.118, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), helmet); helm.position.set(0, 1.575, 0.25); helm.rotation.x = 0.35;
  bike.add(torsoM, headM, helm);
  for (const s of [-1, 1]) {
    const hand = V3(s * 0.2, 0.93, 0.4), sh = V3(s * 0.17, 1.38, 0.13);
    const elbow = sh.clone().lerp(hand, 0.5).add(V3(s * 0.04, 0.05, -0.06));
    bike.add(span(new THREE.Mesh(unitCyl(0.042, 0.038, 8), jersey), sh, elbow));
    bike.add(span(new THREE.Mesh(unitCyl(0.034, 0.03, 8), skinM), elbow, hand));
  }
  const legs = [-1, 1].map((s) => {
    const thigh = new THREE.Mesh(unitCyl(0.07, 0.05, 10), shorts);
    const shin = new THREE.Mesh(unitCyl(0.045, 0.035, 10), skinM);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.2), blackM);
    bike.add(thigh, shin, foot);
    return { s, thigh, shin, foot };
  });
  Object.assign(bikeParts, { rear, front, crank, arms, legs, B, pelvis });
  bike.position.set(BIKE_X, 0.04, 0);
  subjects.add(shadows(bike));
}
const _hip = new THREE.Vector3(), _ped = new THREE.Vector3(), _knee = new THREE.Vector3(), _dir = new THREE.Vector3();
function poseBike(dist) {
  const { rear, front, crank, legs, B, pelvis } = bikeParts;
  const wa = dist / WHEEL_R;
  rear.rotation.x = front.rotation.x = wa;
  const ca = wa / 2.6;
  crank.rotation.x = ca;
  legs.forEach((L, i) => {
    const a = ca + (i ? Math.PI : 0);
    _ped.set(L.s * 0.1, B.y + Math.cos(a) * 0.17, B.z + Math.sin(a) * 0.17);
    _hip.set(L.s * 0.1, pelvis.y, pelvis.z);
    const L1 = 0.44, L2 = 0.44;
    _dir.subVectors(_ped, _hip);
    const len = Math.min(_dir.length(), L1 + L2 - 1e-3);
    _dir.normalize();
    const along = (L1 * L1 - L2 * L2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
    _knee.copy(_hip).addScaledVector(_dir, along).add(V3(0, _dir.z * h, -_dir.y * h));
    span(L.thigh, _hip, _knee);
    span(L.shin, _knee, _ped);
    L.foot.position.copy(_ped).add(V3(0, -0.02, 0.03));
  });
}

// --- cars on the road ------------------------------------------------------------------------------
const CAR_SPAN = 110;
const cars = [];
function car(color, x, dir, kmh, phase) {
  const g = new THREE.Group();
  const paint = glowMat(color, { metalness: 0.45, roughness: 0.3 });
  const glass = std(0x1d2733, { metalness: 0.6, roughness: 0.12 });
  const tyre = glowMat(0x151618, { roughness: 0.8 });
  const rim = glowMat(0xb9bec6, { metalness: 0.9, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.62, 4.2, 1, 1, 3), paint);
  body.position.y = 0.58;
  const bp = body.geometry.attributes.position;
  for (let i = 0; i < bp.count; i++) if (Math.abs(bp.getZ(i)) > 2 && bp.getY(i) > 0) bp.setY(i, bp.getY(i) - 0.1);
  body.geometry.computeVertexNormals();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.56, 2.2), glass);
  const cp = cab.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) if (cp.getY(i) > 0) { cp.setZ(i, cp.getZ(i) * 0.72 - 0.1); cp.setX(i, cp.getX(i) * 0.9); }
  cab.geometry.computeVertexNormals();
  cab.position.set(0, 1.16, -0.2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.05, 1.5), paint); roof.position.set(0, 1.45, -0.28);
  g.add(body, cab, roof);
  const wheels = [];
  for (const [wx, wz] of [[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.35], [0.8, -1.35]]) {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 18).rotateZ(Math.PI / 2), tyre));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.24, 6).rotateZ(Math.PI / 2), rim);
    w.add(hub);
    w.position.set(wx, 0.32, wz);
    g.add(w); wheels.push(w);
  }
  const head = std(0x333333, { emissive: 0xfff2d8, emissiveIntensity: 0 });
  const tail = std(0x3a0d0d, { emissive: 0xff2a1a, emissiveIntensity: 0 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.04), head); h.position.set(s * 0.6, 0.66, 2.1);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.04), tail); t.position.set(s * 0.62, 0.72, -2.1);
    g.add(h, t);
  }
  g.rotation.y = dir > 0 ? 0 : Math.PI;
  g.position.set(x, 0.02, 0);
  subjects.add(shadows(g));
  const c = { g, wheels, x, dir, kmh, phase, head, tail };
  cars.push(c);
  return c;
}
car(0x2f7fb8, 15.6, 1, 42, 0.1);
car(0xf0c040, 17.6, -1, 34, 0.55);
car(0xe9e4da, 15.6, 1, 42, 0.62);

// --- the fountain ------------------------------------------------------------------------------------
const FOUNTAIN = V3(10.6, 0.04, 3.5);
const fountainU = { uTime: { value: 0 } };
{
  const g = new THREE.Group();
  const stone = glowMat(0xcfc6b6, { roughness: 0.75 });
  const basinP = [[1.5, 0], [1.62, 0], [1.66, 0.42], [1.56, 0.47], [1.5, 0.44], [1.46, 0.08], [0, 0.08]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(basinP, 48), stone));
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.48, 48).rotateX(-Math.PI / 2), std(0x355a66, { roughness: 0.06, metalness: 0.2 }));
  water.position.y = 0.36;
  g.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.9, 16), stone); col.position.y = 0.45;
  const bowlP = [[0, 0], [0.55, 0.06], [0.62, 0.18], [0.58, 0.2], [0, 0.1]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlP, 32), stone); bowl.position.y = 0.88;
  g.add(col, bowl);
  // droplets: each one follows a ballistic arc computed in the vertex shader from uTime
  const JETS = [{ o: V3(0, 1.08, 0), v: V3(0, 4.3, 0), spread: 0.18 }];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; JETS.push({ o: V3(Math.cos(a) * 1.42, 0.46, Math.sin(a) * 1.42), v: V3(-Math.cos(a) * 1.25, 3.2, -Math.sin(a) * 1.25), spread: 0.08 }); }
  const PER = 80, n = JETS.length * PER;
  const geo = new THREE.IcosahedronGeometry(0.02, 1);
  const org = new Float32Array(n * 3), vel = new Float32Array(n * 3), pl = new Float32Array(n * 2);
  JETS.forEach((j, ji) => {
    const life = (2 * j.v.y) / 9.81 * (ji ? 0.96 : 1.02);
    for (let k = 0; k < PER; k++) {
      const i = ji * PER + k;
      org.set([j.o.x, j.o.y, j.o.z], i * 3);
      vel.set([j.v.x + (rand() - 0.5) * j.spread, j.v.y * (0.94 + rand() * 0.08), j.v.z + (rand() - 0.5) * j.spread], i * 3);
      pl.set([k / PER + rand() * 0.004, life], i * 2);
    }
  });
  const drops = new THREE.InstancedMesh(geo, std(0xe6f6ff, { roughness: 0.12, emissive: 0x9fcfe8, emissiveIntensity: 0.12 }), n);
  geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(org, 3));
  geo.setAttribute('aVel', new THREE.InstancedBufferAttribute(vel, 3));
  geo.setAttribute('aPL', new THREE.InstancedBufferAttribute(pl, 2));
  drops.material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = fountainU.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aOrigin; attribute vec3 aVel; attribute vec2 aPL; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float age = fract(uTime / aPL.y + aPL.x) * aPL.y;
        vec3 P = aOrigin + aVel * age + vec3(0.0, -4.905, 0.0) * age * age;
        float fade = smoothstep(0.0, 0.05, age) * (1.0 - smoothstep(aPL.y - 0.05, aPL.y, age));
        transformed = transformed * (0.6 + 0.6 * fade) + P;`);
  };
  drops.material.customProgramCacheKey = () => 'drops';
  drops.frustumCulled = false;
  drops.raycast = () => {};
  g.add(drops);
  g.position.copy(FOUNTAIN);
  subjects.add(shadows(g));
  drops.castShadow = false;
}

// --- where everything is, for the readouts, the tags and the DOF scale ---------------------------------
// at: where the subject is (its distance is at.x); r: how deep it is, so the
// tag's line-of-sight test ignores the subject itself; up: tag height above `at`
const SUBJECTS = [
  { key: 'flower', name: '花束', at: V3(0.78, 1.38, 0.32), r: 0.12, up: 0.1, tag: true },
  { key: 'branch', name: '花枝', at: V3(1.07, 1.8, -0.34), r: 0.2 },
  { key: 'model', name: '人物', at: V3(3, 1.635, 0), r: 0.3, up: 0.24, tag: true, main: true },
  { key: 'chart', name: '色卡', at: V3(3, 1.24, -0.52), r: 0.1, up: 0.17, tag: true },
  { key: 'star', name: '星标', at: V3(3, 1.3, 0.52), r: 0.1, up: 0.23, tag: true },
  { key: 'bike', name: '骑车人', at: V3(BIKE_X, 1.2, 0), r: 0.6, up: 0.55, tag: true, speed: 0 },
  { key: 'fountain', name: '喷泉', at: V3(FOUNTAIN.x, 1.4, FOUNTAIN.z), r: 1.7, up: 1.0, tag: true, speed: 3.5 },
  { key: 'lights', name: '串灯', at: V3(12.4, 2.55, 0), r: 0.3, up: 0.15, tag: true },
  { key: 'car', name: '汽车', at: V3(15.6, 1.0, 0), r: 1.2, up: 0.6, tag: true, speed: 0 },
  { key: 'cafe', name: '咖啡馆', at: V3(21.3, 3.0, 0), r: 0.6, up: 0.4, tag: true },
  { key: 'hills', name: '远山', at: V3(900, 60, 0), r: 50, far: true },
];
const SUB = Object.fromEntries(SUBJECTS.map((s) => [s.key, s]));
const bikeState = { kmh: 20 };
function animate(tau) {
  // cyclist: rides left to right across the plaza, then round again
  const v = bikeState.kmh / 3.6;
  const dist = v * tau;
  bike.position.z = -BIKE_SPAN / 2 + (((dist % BIKE_SPAN) + BIKE_SPAN) % BIKE_SPAN);
  poseBike(dist);
  SUB.bike.at.z = bike.position.z; SUB.bike.speed = v;
  for (const c of cars) {
    const cv = c.kmh / 3.6, d = cv * tau + c.phase * CAR_SPAN;
    const z = -CAR_SPAN / 2 + (((d % CAR_SPAN) + CAR_SPAN) % CAR_SPAN);
    c.g.position.z = c.dir * z;
    for (const w of c.wheels) w.rotation.x = (d / 0.32) * 1;
  }
  const lead = cars[0];
  SUB.car.at.z = lead.g.position.z; SUB.car.speed = lead.kmh / 3.6;
  fountainU.uTime.value = tau;
  skyU.uTime.value = tau;
}
// fewer draw calls: merge everything rigid (the scene is drawn up to 16× a frame)
bakeStatic(bikeParts.rear); bakeStatic(bikeParts.front); bakeStatic(bikeParts.crank);
bakeStatic(bike, [bikeParts.rear, bikeParts.front, bikeParts.crank, ...bikeParts.legs.flatMap((l) => [l.thigh, l.shin, l.foot])]);
for (const c of cars) bakeStatic(c.g, c.wheels);
bakeStatic(subjects, [bike, ...cars.map((c) => c.g)]);
toPhoto(subjects);
