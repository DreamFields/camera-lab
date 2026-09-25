
// ---------------------------------------------------------------------------
// Optical bench, image-plane stand, the console underneath, and the room.
// ---------------------------------------------------------------------------
const pickables = [];
const bench = new THREE.Group();
scene.add(bench);
const alu = std(0xa9b1bd, { metalness: 0.9, roughness: 0.34 });
const darkSteel = std(0x1a1d23, { metalness: 0.55, roughness: 0.45 });
const box = (sx, sy, sz, mat, x, y, z, parent = bench) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

// --- rail with a centimetre scale -----------------------------------------------
const RAIL_X0 = -50, RAIL_X1 = 102;
box(RAIL_X1 - RAIL_X0, 2.5, 6, alu, (RAIL_X0 + RAIL_X1) / 2, -1.25, 0);
{
  const len = RAIL_X1 - RAIL_X0;
  const t = canvasTex(4096, 64, (g, w, h) => {
    g.fillStyle = '#12151b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9d2e2'; g.font = '500 22px DM Mono, monospace'; g.textAlign = 'center';
    for (let x = Math.ceil(RAIL_X0); x <= RAIL_X1; x++) {
      const px = ((x - RAIL_X0) / len) * w, big = x % 10 === 0, mid = x % 5 === 0;
      g.fillRect(px - 1, 0, 2, big ? 26 : mid ? 18 : 10);
      if (big && x >= 0) g.fillText(String(x), px, 52);
    }
  });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.6), std(0xffffff, { map: t, roughness: 0.5 }));
  strip.position.set((RAIL_X0 + RAIL_X1) / 2, -1.2, 3.02);
  bench.add(strip);
}
// lens cradles
for (const x of [-7, 9]) {
  box(5, 1.6, 8, darkSteel, x, 0.8, 0);
  box(1.6, 2.6, 1.6, alu, x, 2.9, 0);
  const cradle = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 3, 32, 1, true, Math.PI * 0.22, Math.PI * 0.56), std(0xd9823a, { metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }));
  alongX(cradle.geometry);
  cradle.position.set(x, AXIS_Y, 0);
  bench.add(cradle);
}

// --- image-plane stand -------------------------------------------------------------
const glassStand = new THREE.Group();
bench.add(glassStand);
{
  const gx = GLASS_X, top = AXIS_Y + GLASS_H / 2, bot = AXIS_Y - GLASS_H / 2, hw = GLASS_W / 2;
  box(1.2, 0.9, GLASS_W + 1.8, blackMat, gx, top + 0.45, 0, glassStand);
  box(1.2, 0.9, GLASS_W + 1.8, blackMat, gx, bot - 0.45, 0, glassStand);
  box(1.2, GLASS_H, 0.9, blackMat, gx, AXIS_Y, hw + 0.45, glassStand);
  box(1.2, GLASS_H, 0.9, blackMat, gx, AXIS_Y, -hw - 0.45, glassStand);
  for (const y of [top + 0.45, bot - 0.45]) for (const z of [hw + 0.45, -hw - 0.45]) box(1.8, 1.6, 1.6, darkSteel, gx, y, z, glassStand);
  for (const z of [hw + 2.2, -hw - 2.2]) {
    box(1.4, top + 1.2, 1.4, darkSteel, gx, (top + 1.2) / 2, z, glassStand);
    box(1.4, 1.2, 3.2, darkSteel, gx, top + 0.45, z - Math.sign(z) * 1.0, glassStand);
  }
  box(6, 1.6, GLASS_W + 8, darkSteel, gx, 0.8, 0, glassStand);
}

// --- the console ---------------------------------------------------------------------
const consoleG = new THREE.Group();
scene.add(consoleG);
const CON = { x0: -60, x1: 110, y0: -40, y1: -2.5, zf: 22, zb: -18 };
const conMat = std(0x1b1f28, { roughness: 0.48, metalness: 0.35 });
box(CON.x1 - CON.x0, CON.y1 - CON.y0, CON.zf - CON.zb, conMat, (CON.x0 + CON.x1) / 2, (CON.y0 + CON.y1) / 2, (CON.zf + CON.zb) / 2, consoleG);
box(CON.x1 - CON.x0 + 2, 1.2, CON.zf - CON.zb + 2, std(0x242935, { roughness: 0.38, metalness: 0.4 }), (CON.x0 + CON.x1) / 2, CON.y1 - 0.4, (CON.zf + CON.zb) / 2, consoleG);
box(CON.x1 - CON.x0 - 4, 3, 1, std(0x0e1016, { roughness: 0.6 }), (CON.x0 + CON.x1) / 2, CON.y0 + 1.5, CON.zf + 0.2, consoleG);

// film strip of five screens: the photo at five focus distances
const STRIP = { x0: -30, x1: 66, y: -14.5, w: 16, h: 16 / 1.5, n: 5 };
const stripDist = (i) => lerp(FOCUS_MIN + 7, FOCUS_MAX - 7, i / (STRIP.n - 1));
const stripX = (i) => lerp(STRIP.x0 + STRIP.w / 2, STRIP.x1 - STRIP.w / 2, i / (STRIP.n - 1));
const focusToStripX = (s) => stripX(0) + (s - stripDist(0)) * (stripX(1) - stripX(0)) / (stripDist(1) - stripDist(0));
const TRACK_X0 = focusToStripX(FOCUS_MIN), TRACK_X1 = focusToStripX(FOCUS_MAX);
const stripXToFocus = (x) => FOCUS_MIN + (x - TRACK_X0) / (TRACK_X1 - TRACK_X0) * (FOCUS_MAX - FOCUS_MIN);
box(STRIP.x1 - STRIP.x0 + 10, 26, 1, std(0x0c0f15, { roughness: 0.3, metalness: 0.5 }), (STRIP.x0 + STRIP.x1) / 2, -18, CON.zf - 0.3, consoleG);
const screens = [];
for (let i = 0; i < STRIP.n; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(STRIP.w, STRIP.h), new THREE.MeshBasicMaterial({ color: 0x223044 }));
  m.position.set(stripX(i), STRIP.y, CON.zf + 0.25);
  m.userData.pick = 'frame:' + i;
  consoleG.add(m);
  screens.push(m);
  pickables.push(m);
}
// glowing selection frame
const selFrame = new THREE.Group();
{
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe3ff).multiplyScalar(2.2) });
  const t = 0.35, W = STRIP.w + 1.2, H = STRIP.h + 1.2;
  box(W, t, 0.3, glow, 0, H / 2, 0, selFrame); box(W, t, 0.3, glow, 0, -H / 2, 0, selFrame);
  box(t, H, 0.3, glow, W / 2, 0, 0, selFrame); box(t, H, 0.3, glow, -W / 2, 0, 0, selFrame);
  selFrame.position.set(stripX(1), STRIP.y, CON.zf + 0.35);
  consoleG.add(selFrame);
}
// ruler + slider under the strip
const SLIDER_Y = -27;
{
  const len = TRACK_X1 - TRACK_X0;
  const t = canvasTex(2048, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(190,215,240,.75)'; g.font = '500 30px DM Mono, monospace'; g.textAlign = 'center';
    for (let d = FOCUS_MIN; d <= FOCUS_MAX; d++) {
      const px = ((d - FOCUS_MIN) / (FOCUS_MAX - FOCUS_MIN)) * (w - 8) + 4, big = d % 10 === 0, mid = d % 5 === 0;
      g.fillRect(px - 1.5, 0, 3, big ? 34 : mid ? 22 : 12);
      if (big) g.fillText(d + (d === 90 ? ' cm' : ''), px, 76);
    }
  });
  const ruler = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.3), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  ruler.position.set((TRACK_X0 + TRACK_X1) / 2, SLIDER_Y - 2.2, CON.zf + 0.25);
  consoleG.add(ruler);
  const track = box(len, 0.5, 0.6, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe3ff).multiplyScalar(0.55) }), (TRACK_X0 + TRACK_X1) / 2, SLIDER_Y, CON.zf + 0.3, consoleG);
  track.userData.pick = 'track';
  pickables.push(track);
}
const knob = new THREE.Group();
{
  const body = new THREE.Mesh(alongX(new THREE.CylinderGeometry(1.5, 1.5, 1.6, 32)).rotateY(Math.PI / 2), alu);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe3ff).multiplyScalar(2) }));
  cap.position.z = 0.82;
  knob.add(body, cap);
  body.userData.pick = 'knob';
  pickables.push(body);
  knob.position.set(0, SLIDER_Y, CON.zf + 0.9);
  consoleG.add(knob);
}
// arrows either side of the strip
for (const dir of [-1, 1]) {
  const s = new THREE.Shape([new THREE.Vector2(-1, 1.8), new THREE.Vector2(0.8, 0), new THREE.Vector2(-1, -1.8), new THREE.Vector2(-0.2, 0)].map((v) => new THREE.Vector2(v.x * dir, v.y)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe3ff).multiplyScalar(1.4) }));
  m.position.set(dir < 0 ? STRIP.x0 - 3.2 : STRIP.x1 + 3.2, STRIP.y, CON.zf + 0.3);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 7), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.copy(m.position);
  hit.userData.pick = 'arrow:' + dir;
  consoleG.add(m, hit);
  pickables.push(hit);
}
// focus dial on the left
const dial = new THREE.Group();
{
  const face = canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 10, c, c, c);
    gr.addColorStop(0, '#3a404d'); gr.addColorStop(1, '#1d2129');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
    g.strokeStyle = 'rgba(200,215,235,.55)'; g.lineWidth = 3;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r0 = i % 5 ? c * 0.86 : c * 0.8;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * c * 0.93, c + Math.sin(a) * c * 0.93); g.stroke();
    }
    g.fillStyle = '#7fe3ff'; g.fillRect(c - 5, c * 0.14, 10, c * 0.42);
    g.fillStyle = 'rgba(210,222,240,.8)'; g.font = '600 34px DM Mono, monospace'; g.textAlign = 'center';
    g.fillText('FOCUS', c, c * 1.46);
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.4, 2, 64).rotateX(Math.PI / 2), [alu, std(0xffffff, { map: face, roughness: 0.5, metalness: 0.3 }), alu]);
  const knurl = gear(-1, 1, 7.25, 120, 0.35, darkSteel);
  knurl.geometry.rotateY(Math.PI / 2);
  dial.add(disc, knurl);
  disc.userData.pick = 'dial'; knurl.userData.pick = 'dial';
  pickables.push(disc, knurl);
  dial.position.set(-47, -18, CON.zf + 1.1);
  consoleG.add(dial);
}
// three aperture buttons on the right
const apButtons = [];
function drawIris(g, w, N) {
  const c = w / 2;
  g.fillStyle = '#0f1218'; g.fillRect(0, 0, w, w);
  g.fillStyle = '#2b303b'; g.beginPath(); g.arc(c, c, c * 0.92, 0, 7); g.fill();
  const r = c * 0.78 * (2 / N) + 6;
  g.save(); g.beginPath();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + N * 0.1; g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r); }
  g.closePath();
  const gl = g.createRadialGradient(c, c, 0, c, c, r);
  gl.addColorStop(0, '#f4fbff'); gl.addColorStop(1, '#8fdcf5');
  g.fillStyle = gl; g.fill(); g.restore();
  g.strokeStyle = 'rgba(160,175,200,.5)'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + N * 0.1;
    g.beginPath(); g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    g.lineTo(c + Math.cos(a + 1.1) * c * 0.9, c + Math.sin(a + 1.1) * c * 0.9); g.stroke();
  }
  g.fillStyle = 'rgba(220,230,245,.85)'; g.font = '500 44px DM Mono, monospace'; g.textAlign = 'center';
}
AP_PRESETS.forEach((N, i) => {
  const t = canvasTex(256, 256, (g, w) => drawIris(g, w, N));
  const grp = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.2, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.28, 8, 64), new THREE.MeshBasicMaterial({ color: 0x3a4250 }));
  face.position.z = 0.05;
  grp.add(face, ring);
  const cap = canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#c9d2e2'; g.font = '500 30px DM Mono, monospace'; g.textAlign = 'center'; g.fillText('ƒ/' + N, w / 2, 34); });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshBasicMaterial({ map: cap, transparent: true }));
  lab.position.y = -6.4;
  grp.add(lab);
  grp.position.set(79 + i * 11, -16.5, CON.zf + 0.3);
  face.userData.pick = 'ap:' + i;
  pickables.push(face);
  consoleG.add(grp);
  apButtons.push({ ring, N });
});
shadows(consoleG, false, true);
shadows(bench, true, true);

// --- room -------------------------------------------------------------------------------
const room = new THREE.Group();
scene.add(room);
{
  const tiles = canvasTex(512, 512, (g, w) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = `hsl(30 6% ${24 + Math.random() * 5}%)`;
      g.fillRect(i * s, j * s, s, s);
    }
    g.strokeStyle = '#1a1917'; g.lineWidth = 6;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(18, 12);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(720, 480), std(0xffffff, { map: tiles, roughness: 0.55, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(25, -40, 60);
  floor.receiveShadow = true;
  room.add(floor);
  const panel = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#161b27'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(x + 3, 0, 2, h); }
  });
  panel.wrapS = THREE.RepeatWrapping;
  panel.repeat.set(6, 1);
  const wallMat = std(0xffffff, { map: panel, roughness: 0.85 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(720, 260), wallMat);
  back.position.set(25, 90, -80);
  back.receiveShadow = true;
  room.add(back);
  for (const [x, ry] of [[-190, Math.PI / 2], [240, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(480, 260), wallMat);
    w.position.set(x, 90, 60); w.rotation.y = ry;
    room.add(w);
  }
  // light boxes on the wall: the same pine, from blurred to sharp
  const drawBox = (blur) => canvasTex(640, 360, (g, w, h) => {
    g.fillStyle = '#0d1a2a'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w * 0.3, h * 0.5, 10, w * 0.3, h * 0.5, h * 0.7);
    gr.addColorStop(0, 'rgba(127,227,255,.25)'); gr.addColorStop(1, 'rgba(127,227,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.filter = `blur(${blur}px)`;
    g.fillStyle = '#dff6ff';
    for (let k = 0; k < 3; k++) { const y0 = 250 - k * 55, r = 70 - k * 16; g.beginPath(); g.moveTo(w * 0.3 - r, y0); g.lineTo(w * 0.3, y0 - 95); g.lineTo(w * 0.3 + r, y0); g.fill(); }
    g.fillRect(w * 0.3 - 6, 250, 12, 40);
    g.filter = 'none';
    g.strokeStyle = 'rgba(223,246,255,.7)'; g.lineWidth = 2;
    const fx = w * 0.62, tx = w * 0.9, spread = 8 + blur * 3.2;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(fx, h / 2 + k * 22); g.lineTo(tx, h / 2 + k * spread / 3); g.stroke(); }
    g.fillStyle = 'rgba(223,246,255,.9)'; g.fillRect(tx, h / 2 - spread - 4, 4, spread * 2 + 8);
  });
  [[14, -38], [6, 20], [0, 78]].forEach(([blur, x]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 22.5), new THREE.MeshBasicMaterial({ map: drawBox(blur), color: new THREE.Color(1.25, 1.25, 1.25) }));
    m.position.set(x, 62, -79.5);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(42.4, 24.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe3ff).multiplyScalar(0.9) }));
    fr.position.set(x, 62, -79.7);
    room.add(fr, m);
  });
  // round lamps and shelves at the right
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.8, 12, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc89a).multiplyScalar(1.6) }));
    ring.position.set(128 + i * 19, 36, -79);
    room.add(ring);
  }
  const shelfMat = std(0x2a2f3b, { roughness: 0.7 });
  for (const y of [8, 22]) {
    box(60, 1.2, 12, shelfMat, 150, y, -73, room);
    for (let k = 0; k < 6; k++) box(3 + rand() * 3, 5 + rand() * 5, 8, std(new THREE.Color().setHSL(0.55 + rand() * 0.5, 0.25, 0.3 + rand() * 0.2)), 126 + k * 8, y + 3.5, -73, room);
  }
  // a plant on the left
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(7, 5.5, 14, 24), std(0xc9c3b8, { roughness: 0.8 }));
  pot.position.set(-92, -33, -30);
  room.add(pot);
  const leafMat = std(0x2f6b3c, { flatShading: true, roughness: 0.8 });
  for (let i = 0; i < 16; i++) {
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), leafMat);
    const a = rand() * 6.28, r = 2 + rand() * 7, y = -22 + rand() * 30;
    l.position.set(-92 + Math.cos(a) * r, y, -30 + Math.sin(a) * r);
    l.scale.set(2.4, 7 + rand() * 4, 0.6);
    l.rotation.set(rand() - 0.5, a, (rand() - 0.5) * 1.2);
    room.add(l);
  }
  shadows(room, false, true);
}
