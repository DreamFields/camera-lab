
// ---------------------------------------------------------------------------
// The optical bench: a rail with a centimetre scale (and, behind the lens,
// where the sensor sits for each focal length), cradles for the lens, the
// console underneath with an instrument for every parameter, a monitor, and
// the studio around it all. Also binds the lens rings and body dials to their
// parameters.
// ---------------------------------------------------------------------------
const bench = new THREE.Group();
scene.add(bench);
const box = (sx, sy, sz, mat, x, y, z, parent = bench) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

// --- rail -------------------------------------------------------------------------------------------
const RAIL_X0 = -100, RAIL_X1 = 104;
box(RAIL_X1 - RAIL_X0, 2.5, 6, alu, (RAIL_X0 + RAIL_X1) / 2, -1.25, 0);
{
  const len = RAIL_X1 - RAIL_X0, W = 8192;
  const t = canvasTex(W, 96, (g, w, h) => {
    g.fillStyle = '#12151b'; g.fillRect(0, 0, w, h);
    const X = (x) => ((x - RAIL_X0) / len) * w;
    g.fillStyle = '#c9d2e2'; g.font = `500 22px ${MONO}`; g.textAlign = 'center';
    for (let x = 0; x <= RAIL_X1; x++) {
      const big = x % 10 === 0, mid = x % 5 === 0;
      g.fillRect(X(x) - 1, 0, 2, big ? 26 : mid ? 18 : 10);
      if (big) g.fillText(x === 100 ? '100 cm' : String(x), X(x), 52);
    }
    // behind the optical centre: where the sensor sits for each focal length
    g.fillStyle = '#ffb454'; g.font = `500 20px ${MONO}`;
    for (const f of [24, 35, 50, 70, 85, 105, 135]) {
      const px = X(sensorX(f));
      g.fillRect(px - 1.5, 0, 3, 30);
      g.fillText(f + (f === 135 ? ' mm' : ''), px, 56);
    }
    g.fillStyle = 'rgba(255,180,84,.55)'; g.font = `500 18px ${FONT}`; g.textAlign = 'center';
    g.fillText(`← 像距 = ${IMG_0} cm + ${IMG_K} cm × 焦距 mm（传感器在这里）`, X((sensorX(F_MIN) + sensorX(F_MAX)) / 2), 86);
    g.fillStyle = 'rgba(201,210,226,.55)'; g.textAlign = 'left';
    g.fillText('物距（从光心量起）→', X(2), 86);
  });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2), std(0xffffff, { map: t, roughness: 0.5 }));
  strip.position.set((RAIL_X0 + RAIL_X1) / 2, -1.2, 3.02);
  bench.add(strip);
}
// lens cradles under the aperture section and the front barrel
for (const [x, r] of [[-1.2, 8.1], [14.4, 8.4]]) {
  box(5, 1.6, 8, darkSteel, x, 0.8, 0);
  box(1.6, AXIS_Y - r - 1.6, 1.6, alu, x, 1.6 + (AXIS_Y - r - 1.6) / 2, 0);
  const cradle = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 32, 1, true, Math.PI * 0.22, Math.PI * 0.56), std(0xd9823a, { metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }));
  alongX(cradle.geometry);
  cradle.position.set(x, AXIS_Y, 0);
  bench.add(cradle);
}

// --- the console ----------------------------------------------------------------------------------------
const consoleG = new THREE.Group();
scene.add(consoleG);
const CON = { x0: -104, x1: 160, y0: -62, y1: -3, zf: 38, zb: -36 };
const conMat = std(0x1b1f28, { roughness: 0.48, metalness: 0.35 });
box(CON.x1 - CON.x0, CON.y1 - CON.y0, CON.zf - CON.zb, conMat, (CON.x0 + CON.x1) / 2, (CON.y0 + CON.y1) / 2, (CON.zf + CON.zb) / 2, consoleG);
// the top slab is also in the photo: a wide-angle frame's bottom corners see it
toPhoto(box(CON.x1 - CON.x0 + 2, 1.2, CON.zf - CON.zb + 2, focusGlow(std(0x242935, { roughness: 0.4, metalness: 0.35 })), (CON.x0 + CON.x1) / 2, CON.y1, (CON.zf + CON.zb) / 2, consoleG));
box(CON.x1 - CON.x0 - 4, 3, 1, std(0x0e1016, { roughness: 0.6 }), (CON.x0 + CON.x1) / 2, CON.y0 + 1.5, CON.zf + 0.2, consoleG);
const ZF = CON.zf + 0.02;
// raised panels, one per section
const SECTIONS = [
  { x0: -102, x1: -49, title: '机身 · BODY', col: 0x151922 },
  { x0: -47, x1: 63, title: '对焦 · FOCUS', col: 0x121620 },
  { x0: 65, x1: 115, title: '镜头 · LENS', col: 0x151922 },
  { x0: 117, x1: 158, title: '场景 · SCENE', col: 0x121620 },
];
for (const s of SECTIONS) {
  const p = new THREE.Mesh(new RoundedBoxGeometry(s.x1 - s.x0, CON.y1 - CON.y0 - 4, 0.8, 2, 0.4), std(s.col, { roughness: 0.55, metalness: 0.35 }));
  p.position.set((s.x0 + s.x1) / 2, (CON.y0 + CON.y1) / 2 - 0.5, ZF + 0.2);
  p.receiveShadow = true;
  consoleG.add(p);
  const t = caption(s.title, 1.25, { color: '#8f9bb3' });
  t.position.set((s.x0 + s.x1) / 2, CON.y0 + 4.2, ZF + 0.65);
  consoleG.add(t);
}
const FZ = ZF + 0.6;       // instruments sit on the panels
const T_LABELS = FULL_T.map((d) => ({ p: stopIndex(d, T_STOPS) / (T_STOPS.length - 1), text: d >= 1000 ? d / 1000 + 'k' : String(d) }));
const ISO_LABELS = FULL_ISO.map((s) => ({ p: stopIndex(s, ISO_STOPS) / (ISO_STOPS.length - 1), text: s >= 1000 ? (s / 1000).toString().replace(/\.0$/, '') + 'k' : String(s) }));
const N_LABELS = FULL_N.map((n) => ({ p: stopIndex(n, N_STOPS) / (N_STOPS.length - 1), text: String(n) }));
const stopTicks = (n, fullIdx) => [...Array(n + 1).keys()].map((i) => [i / n, fullIdx.includes(i) ? 1.1 : 0.55]);
const T_TICKS = stopTicks(T_STOPS.length - 1, FULL_T.map((d) => T_STOPS.indexOf(d)));
const ISO_TICKS = stopTicks(ISO_STOPS.length - 1, FULL_ISO.map((s) => ISO_STOPS.indexOf(s)));
const N_TICKS = stopTicks(N_STOPS.length - 1, FULL_N.map((n) => N_STOPS.indexOf(n)));

// BODY: shutter, ISO, white balance; the camera's brain below
makeKnob(consoleG, { key: 't', name: '快门旋钮', x: -89, y: -24, z: FZ, r: 5, labels: T_LABELS, ticks: T_TICKS, caption: '快门 t（秒）', lamp: true });
makeKnob(consoleG, { key: 'iso', name: 'ISO 旋钮', x: -71, y: -24, z: FZ, r: 5, labels: ISO_LABELS, ticks: ISO_TICKS, labelH: 0.72, caption: 'ISO', lamp: true });
makeFader(consoleG, {
  key: 'wb', name: '白平衡推子', x: -58, y: -29, z: FZ, len: 20, caption: '白平衡 K', lamp: true,
  gradient: ['#7fb2ff', '#e8eef8', '#ffc27a'],
  labels: [3000, 4000, 5000, 6000, 7000, 8000].map((k) => ({ p: (k - K_MIN) / (K_MAX - K_MIN), text: k / 1000 + 'k' })),
  ticks: [3000, 4000, 5000, 6000, 7000, 8000].map((k) => [(k - K_MIN) / (K_MAX - K_MIN), 0.7]),
});
makeLever(consoleG, { key: 'mode', name: '模式拨杆', x: -94, y: -48, z: FZ, module: 'brain', labels: [{ p: 0, text: 'M' }, { p: 0.5, text: 'A' }, { p: 1, text: 'S' }], caption: '模式' });
makeToggle(consoleG, { name: '自动 ISO', x: -84, y: -47, z: FZ, module: 'brain', caption: '自动ISO', get: () => state.autoISO, set: () => toggleAutoISO(), tip: () => (state.autoISO ? '开：ISO 交给相机' : '关') });
makeKnob(consoleG, {
  key: 'comp', name: '曝光补偿旋钮', x: -73, y: -47.5, z: FZ, r: 3, module: 'brain', caption: '补偿 ±EV', captionGap: 3.6, labelR: 2.1, labelH: 0.65,
  labels: [-3, -2, -1, 0, 1, 2, 3].map((v) => ({ p: (v + 3) / 6, text: (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) })),
  ticks: [...Array(19).keys()].map((i) => [i / 18, i % 3 ? 0.4 : 0.8]),
});
makeToggle(consoleG, { name: '自动白平衡', x: -63, y: -47, z: FZ, module: 'brain', caption: 'AWB', get: () => state.awb, set: () => toggleAWB(), tip: () => (state.awb ? '开：灰度世界估色温' : '关') });
makeButton(consoleG, { name: '对齐光源', x: -55, y: -47.5, z: FZ, r: 1.5, module: 'brain', caption: '对齐', color: 0x5b6474, onClick: () => matchWB(), tip: () => `把白平衡设成主光色温 ${fmtK(state.keyLightK)}` });

// FOCUS: a big live screen with the focus slider under it; to its right the
// meter, the focus dial and the module switches
const LIVE = { x: -16, y: -24.6, w: 48, h: 32, sliderY: -48.5 };
const liveScreen = new THREE.Mesh(new THREE.PlaneGeometry(LIVE.w, LIVE.h), new THREE.MeshBasicMaterial({ color: 0x10151f }));
// the AF frame that flashes where the screen was tapped
const afBox = new THREE.Group();
const afMat = new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(2.4), transparent: true, opacity: 0, depthWrite: false });
let afAt = -1e9;
{
  const M = 1.4, CHIN = 3.2;             // bezel margin; the chin carries a tally light and the captions
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(LIVE.w + 2 * M, LIVE.h + M + CHIN, 1.2, 2, 0.45), std(0x0a0d13, { roughness: 0.35, metalness: 0.5 }));
  bezel.position.set(LIVE.x, LIVE.y + (M - CHIN) / 2, FZ + 0.6);
  liveScreen.position.set(LIVE.x, LIVE.y, FZ + 1.24);
  consoleG.add(bezel, liveScreen);
  const cy = LIVE.y - LIVE.h / 2 - CHIN / 2, x0 = LIVE.x - LIVE.w / 2, x1 = LIVE.x + LIVE.w / 2, z = FZ + 1.25;
  lamp(consoleG, x0 + 0.8, cy, FZ + 1.2, 0.42).emissive.setRGB(3.2, 0.28, 0.2);
  const onAir = labelPlane('LIVE', 0.7, { color: '#ff8a80' });
  onAir.position.set(x0 + 1.9 + onAir.userData.w / 2, cy, z);
  const name = caption('实时画面', 0.78, { color: '#8f9bb3' });
  name.position.set(onAir.position.x + onAir.userData.w / 2 + 1 + name.userData.w / 2, cy, z);
  const how = caption('点按画面对焦 · V 放大', 0.7, { color: '#6f7a90' });
  how.position.set(x1 - how.userData.w / 2, cy, z);
  consoleG.add(onAir, name, how);
  const s = 4.4, t = 0.26;
  for (const [w, h, x, y] of [[s, t, 0, s / 2], [s, t, 0, -s / 2], [t, s, s / 2, 0], [t, s, -s / 2, 0]]) box(w, h, 0.05, afMat, x, y, 0, afBox);
  afBox.visible = false;
  liveScreen.add(afBox);
}
// a tap on the live screen: the AF frame flashes there and the lens focuses
// on whatever is under it, like a touchscreen camera
function tapLive(p) {
  const l = liveScreen.worldToLocal(p.clone()), hs = 2.6;
  afBox.position.set(clamp(l.x, hs - LIVE.w / 2, LIVE.w / 2 - hs), clamp(l.y, hs - LIVE.h / 2, LIVE.h / 2 - hs), 0.06);
  afAt = performance.now();
  const flip = liveScreen.material.uniforms.uFlip.value;
  const u = l.x / LIVE.w + 0.5, v = l.y / LIVE.h + 0.5;
  focusOnPhoto((flip.x ? 1 - u : u) * 2 - 1, (flip.y ? 1 - v : v) * 2 - 1);
}
addControl({
  key: 'D', kind: 'button', rot: new THREE.Group(), pick: [liveScreen], name: '实时屏', how: '点按画面：对焦到那里 · V 放大',
  tip: () => `对焦 ${fmtLen(state.D)} · 清晰区 ${isFinite(dof.far) ? fmtLen(dof.far - dof.near) : '到 ∞'}`,
  onClick: (p) => { if (p) tapLive(p); },
});
const D_RULER = [25, 30, 35, 40, 50, 60, 70, 80, 100];
makeFader(consoleG, {
  key: 'D', name: '对焦滑块', x: LIVE.x, y: LIVE.sliderY, z: FZ, len: LIVE.w, vertical: false,
  labels: D_RULER.map((d) => ({ p: logPos(d, D_MIN, D_MAX), text: d === 100 ? '100 cm' : String(d) })),
  // every centimetre up close, every five further out, where the log scale bunches up
  ticks: [...Array(76).keys()].map((i) => i + 25).filter((d) => d < 50 || d % 5 === 0).map((d) => [logPos(d, D_MIN, D_MAX), d % 10 === 0 ? 1.0 : d % 5 === 0 ? 0.7 : 0.35]),
});
{
  const face = canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 10, c, c, c);
    gr.addColorStop(0, '#3a404d'); gr.addColorStop(1, '#1d2129');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
    g.fillStyle = 'rgba(210,222,240,.8)'; g.font = `600 64px ${MONO}`; g.textAlign = 'center';
    g.fillText('FOCUS', c, c * 1.52);
  });
  const k = makeKnob(consoleG, {
    key: 'D', name: '对焦刻度盘', x: 30, y: -31.5, z: FZ, r: 5.2, caption: '对焦 D（cm）', captionGap: 3.9,
    labels: [25, 30, 40, 50, 60, 80, 100].map((d) => ({ p: logPos(d, D_MIN, D_MAX), text: String(d) })),
    ticks: [...Array(16).keys()].map((i) => 25 + i * 5).map((d) => [logPos(d, D_MIN, D_MAX), d % 10 === 0 ? 0.9 : 0.5]),
  });
  Object.assign(k.pick[1].material, { map: face, metalness: 0.25, roughness: 0.55 });
  k.pick[1].material.color.set(0xffffff);
}
makeButton(consoleG, { name: '超焦距', x: 47, y: -31.5, z: FZ, r: 2, caption: '超焦距 H', color: 0xb07a2e, onClick: () => focusHyper(), tip: () => `H = ${fmtLen(Opt.hyper(state.f, state.N, state.fmt.coc) / 10)}` });

// the exposure meter: a needle over −3 … +3 EV, its top level with the live screen's
const meter = { needle: null, face: null, lampMat: null, x: 36, y: -13.65 };
{
  const W = 22, H = 11.5;
  const g = new THREE.Group();
  g.position.set(meter.x, meter.y, FZ);
  consoleG.add(g);
  const frame = new THREE.Mesh(new RoundedBoxGeometry(W + 1.6, H + 1.4, 1.2, 2, 0.4), std(0x2a2f39, { metalness: 0.7, roughness: 0.35 }));
  frame.position.z = 0.4;
  g.add(frame);
  // a dark face with pale printing, like the knobs around it
  const faceT = canvasTex(1024, 512, (c, w, h) => {
    const cx = w / 2, cy = h * 1.02, R = h * 0.78;
    const bg = c.createRadialGradient(cx, h * 0.45, 20, cx, h * 0.45, w * 0.6);
    bg.addColorStop(0, '#262b36'); bg.addColorStop(1, '#12151b');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const A = (ev) => -Math.PI / 2 + (ev / 3) * 0.9;
    c.lineWidth = 26;
    for (const [a, b, col] of [[-3, -1, '#5e86ff'], [-1, 1, '#4a5263'], [1, 3, '#ff9f45']]) { c.strokeStyle = col; c.beginPath(); c.arc(cx, cy, R + 20, A(a), A(b)); c.stroke(); }
    c.strokeStyle = '#c9d2e2'; c.fillStyle = '#dfe6f2'; c.lineWidth = 4; c.font = `600 44px ${MONO}`; c.textAlign = 'center';
    c.beginPath(); c.arc(cx, cy, R, A(-3), A(3)); c.stroke();
    for (let k = -9; k <= 9; k++) {
      const a = A(k / 3), big = k % 3 === 0;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - (big ? 40 : 22)), cy + Math.sin(a) * (R - (big ? 40 : 22))); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
      if (big) c.fillText(k === 0 ? '0' : (k > 0 ? '+' : '−') + Math.abs(k / 3), cx + Math.cos(a) * (R - 80), cy + Math.sin(a) * (R - 80) + 14);
    }
    c.fillStyle = '#8f9bb3'; c.font = `700 38px ${FONT}`; c.fillText('测光 EV', cx, h * 0.93);
  });
  // lit mostly from behind, so the printing reads the same by day and by night and doesn't bloom in the sun
  meter.face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: faceT, color: 0x808080, roughness: 0.6, envMapIntensity: 0.3, emissive: 0xffffff, emissiveMap: faceT, emissiveIntensity: 0.5 }));
  meter.face.position.z = 1.02;
  g.add(meter.face);
  const piv = new THREE.Group();
  piv.position.set(0, -H / 2 + 0.2, 1.1);
  const nd = new THREE.Mesh(new THREE.BoxGeometry(0.18, H * 0.78, 0.05).translate(0, H * 0.39, 0), new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
  piv.add(nd);
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), capMat);
  hub.position.z = 0.03;
  piv.add(hub);
  g.add(piv);
  meter.needle = piv;
  meter.lampMat = lamp(g, W / 2 - 0.9, H / 2 - 0.9, 1.2, 0.45);
  // the glass only adds its reflections: even a faint white film turns a black face grey
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.05, clearcoat: 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glass.position.z = 1.25;
  g.add(glass);
}
// the shutter release (module "shoot")
const releaseBtn = makeButton(consoleG, { name: '快门按钮', x: 55, y: -13.65, z: FZ, r: 2.5, module: 'shoot', caption: '拍照', color: 0xc0392b, onClick: () => shoot(), tip: () => '拍一张，存进底片夹' });

// LENS: aperture knob + presets, zoom fader; format switch (module "kit")
makeKnob(consoleG, { key: 'N', name: '光圈旋钮', x: 79, y: -24, z: FZ, r: 5, labels: N_LABELS, ticks: N_TICKS, caption: '光圈 ƒ', lamp: true });
makeFader(consoleG, {
  key: 'f', name: '变焦推子', x: 101, y: -29, z: FZ, len: 20, caption: '焦距 f（mm）',
  labels: [24, 35, 50, 85, 135].map((f) => ({ p: logPos(f, F_MIN, F_MAX), text: String(f) })),
  ticks: F_MARKS.map((f) => [logPos(f, F_MIN, F_MAX), 0.7]),
});
function drawIris(g, w, N) {
  const c = w / 2;
  g.fillStyle = '#0f1218'; g.fillRect(0, 0, w, w);
  g.fillStyle = '#2b303b'; g.beginPath(); g.arc(c, c, c * 0.92, 0, 7); g.fill();
  const r = c * 0.78 * (1.6 / N) + 6;
  g.beginPath();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + N * 0.1; g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r); }
  g.closePath();
  const gl = g.createRadialGradient(c, c, 0, c, c, r);
  gl.addColorStop(0, '#f4fbff'); gl.addColorStop(1, '#8fdcf5');
  g.fillStyle = gl; g.fill();
  g.strokeStyle = 'rgba(160,175,200,.5)'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + N * 0.1;
    g.beginPath(); g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    g.lineTo(c + Math.cos(a + 1.1) * c * 0.9, c + Math.sin(a + 1.1) * c * 0.9); g.stroke();
  }
}
const AP_PRESETS = [2, 5.6, 16];
AP_PRESETS.forEach((N, i) => {
  const t = canvasTex(256, 256, (g, w) => drawIris(g, w, N));
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.95, 40), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3 }));
  makeButton(consoleG, { name: `光圈 ${fmtN(N)}`, x: 71 + i * 8.5, y: -47.5, z: FZ, r: 2.1, caption: fmtN(N), face, onClick: () => setParam('N', N), tip: () => '一键设到这一档', key: 'N', lampState: () => 'off' });
});
makeKnob(consoleG, {
  key: 'format', name: '画幅旋钮', x: 108.5, y: -47.5, z: FZ, r: 2.6, span: Math.PI * 0.8, psi0: Math.PI * 0.9, module: 'kit', caption: '画幅', captionGap: 3.6, labelR: 2.2, labelH: 0.62,
  labels: [{ p: 0, text: 'FF' }, { p: 0.5, text: 'APS-C' }, { p: 1, text: 'M4/3' }], ticks: [[0, 0.7], [0.5, 0.7], [1, 0.7]],
});

// SCENE: light, train speed, brightness, colour; the damping table (module "kit")
makeKnob(consoleG, {
  key: 'preset', name: '光线预设', x: 128, y: -24, z: FZ, r: 4.2, span: Math.PI * 1.1, psi0: Math.PI * 1.05, caption: '光线',
  labels: PRESET_KEYS.map((k, i) => ({ p: i / 3, text: PRESETS[k].name })), labelH: 0.8, labelR: 3.2, ticks: [0, 1, 2, 3].map((i) => [i / 3, 0.8]),
});
makeKnob(consoleG, {
  key: 'train', name: '火车调速器', x: 148, y: -24, z: FZ, r: 4.2, caption: '火车 v（cm/s）',
  labels: [0, 10, 20, 30, 40].map((v) => ({ p: v / TRAIN_MAX, text: String(v) })), ticks: [...Array(9).keys()].map((i) => [i / 8, i % 2 ? 0.5 : 0.9]),
});
makeKnob(consoleG, {
  key: 'sceneEV', name: '亮度旋钮', x: 125, y: -47.5, z: FZ, r: 3, caption: '亮度 EV', captionGap: 3.6, labelR: 2.2, labelH: 0.62,
  labels: [0, 5, 10, 15].map((v) => ({ p: (v + 2) / 19, text: String(v) })), ticks: [...Array(20).keys()].map((i) => [i / 19, 0.5]),
});
makeKnob(consoleG, {
  key: 'lightK', name: '色温旋钮', x: 138.5, y: -47.5, z: FZ, r: 3, caption: '色温 K', captionGap: 3.6, labelR: 2.2, labelH: 0.62,
  labels: [2000, 4000, 6000, 8000, 10000].map((k) => ({ p: (k - 2000) / 8000, text: k / 1000 + 'k' })), ticks: [...Array(9).keys()].map((i) => [i / 8, 0.5]),
});
makeLever(consoleG, {
  key: 'hold', name: '减震开关', x: 151.5, y: -48, z: FZ, module: 'kit', span: 1.0, caption: '减震', labelH: 0.8,
  labels: [{ p: 0, text: '开' }, { p: 0.5, text: '关' }, { p: 1, text: '防抖' }],
});

// scene time and a reset, top of the scene section
makeToggle(consoleG, { name: '场景时间', x: 128, y: -10.5, z: FZ, caption: '时间走', get: () => state.timeScale > 0, set: (on) => { state.timeScale = on ? 1 : 0; }, tip: () => (state.timeScale ? '走：火车、风车、溪水在动' : '停：画面定格，只有噪点还在跳') });
makeButton(consoleG, { name: '复位', x: 146, y: -10.5, z: FZ, r: 1.8, caption: '复位', color: 0x5b6474, onClick: () => resetAll(), tip: () => '所有参数回到开场状态' });

// module switches, bottom right of the focus section (clear of the cards in every view)
const moduleSwitches = MODULE_KEYS.map((k, i) => makeToggle(consoleG, {
  name: '模块：' + MODULES[k].name, x: 29.5 + i * 7, y: -49, z: FZ, caption: ['模式', 'ND等', '实验', '拍照'][i],
  get: () => state.modules[k], set: (on) => setModule(k, on), tip: () => (state.modules[k] ? '开 · ' : '关 · ') + MODULES[k].desc,
}));
{
  const t = caption('模块', 0.9, { color: '#7f8aa2' });
  t.position.set(23, -49, FZ + 0.3);
  consoleG.add(t);
}

// --- ND filters (module "kit"): a rack in front of the lens; click one to screw it on --------------------------
const ndRack = new THREE.Group();
consoleG.add(ndRack);
const ndFilters = [];
{
  const base = new THREE.Mesh(new RoundedBoxGeometry(27, 1.6, 7, 2, 0.4), std(0x2a2f39, { metalness: 0.6, roughness: 0.4 }));
  base.position.set(22, CON.y1 + 0.2, 27);
  ndRack.add(base);
  const cap = caption('ND 减光镜', 0.9, { color: '#9aa6bc' });
  cap.rotation.x = -Math.PI / 2;
  cap.position.set(22, CON.y1 + 1.05, 31);
  ndRack.add(cap);
  [3, 6, 10].forEach((stops, i) => {
    const g = new THREE.Group();
    const ringM = std(0x1b1d22, { metalness: 0.7, roughness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.45, 12, 48), ringM);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(4.0, 40), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.05, 0.05, 0.06), transparent: true, opacity: [0.55, 0.75, 0.9][i], roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }));
    const lab = labelPlane(`ND${2 ** stops}`, 0.8, { color: '#e8edf5' });
    lab.position.set(0, -2.6, 0.06);
    g.add(ring, glass, lab);
    const home = V3(12 + i * 10, CON.y1 + 5.4, 27);
    g.position.copy(home);
    ndRack.add(g);
    const f = { g, stops, home, homeQ: new THREE.Quaternion(), onQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), k: 0 };
    ndFilters.push(f);
    addControl({ kind: 'button', rot: new THREE.Group(), pick: [ring, glass], module: 'kit', name: `ND${2 ** stops} 减光镜`, how: '点按装上 / 取下', tip: () => `减 ${stops} 档，进光 1/${2 ** stops}`, onClick: () => setParam('nd', state.nd === stops ? 0 : stops) });
  });
}
onModule((k, on) => { if (k === 'kit') ndRack.visible = on; });

// --- the monitor, on an arm at the right of the valley -----------------------------------------------------
const MON = { w: 36, h: 24, x: 126, y: 22, z: 20 };
const monitor = new THREE.Group();
monitor.position.set(MON.x, MON.y, MON.z);
monitor.rotation.y = -0.32;
scene.add(monitor);
const monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(MON.w, MON.h), new THREE.MeshBasicMaterial({ color: 0x10151f }));
monitorScreen.position.z = 1.3;
{
  const shell = new THREE.Mesh(new RoundedBoxGeometry(MON.w + 3, MON.h + 3, 2.4, 3, 0.8), std(0x15171c, { roughness: 0.5, metalness: 0.4 }));
  const hood = new THREE.Mesh(new THREE.BoxGeometry(MON.w + 3.4, 0.6, 6), std(0x0e0f12, { roughness: 0.8 }));
  hood.position.set(0, MON.h / 2 + 1.6, 3);
  monitor.add(shell, monitorScreen, hood);
  const cap = caption('监视器 · 点按放大', 0.9, { color: '#8f9bb3' });
  cap.position.set(0, -MON.h / 2 - 2.4, 1.3);
  monitor.add(cap);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, MON.y - CON.y1 - MON.h / 2, 16), alu);
  pole.position.set(0, -(MON.y - CON.y1) / 2 - MON.h / 4, -1.8);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 32), darkSteel);
  foot.position.set(0, CON.y1 + 0.6 - MON.y, -1.8);
  monitor.add(pole, foot);
  shadows(monitor, true, true);
  addControl({ kind: 'button', rot: new THREE.Group(), pick: [monitorScreen, shell], name: '监视器', how: '点按放大取景（V）', tip: () => '相机处理后的照片（正像）', onClick: () => openBigView(true) });
}
shadows(consoleG, true, true);
// printed glyphs and the AF frame are flat quads: they must not cast square shadows
consoleG.traverse((m) => { if (m.isMesh && m.material.isMeshBasicMaterial && m.material.transparent) m.castShadow = false; });
shadows(bench, true, true);

// --- the lens rings and the body's dials are controls too ----------------------------------------------------
addControl({ key: 'D', kind: 'ring', rot: lensRings.focus.rot, axis: 'x', span: 4.2, pick: lensRings.focus.pick, name: '对焦环' });
addControl({ key: 'f', kind: 'ring', rot: lensRings.zoom.rot, axis: 'x', span: 2.4, pick: lensRings.zoom.pick, name: '变焦环' });
addControl({ key: 'N', kind: 'ring', rot: lensRings.aperture.rot, axis: 'x', span: 2.4, pick: lensRings.aperture.pick, name: '光圈环' });
addControl({ key: 't', kind: 'dial', rot: bodyDials.shutter.rot, axis: 'y', span: 4.4, pick: bodyDials.shutter.pick, name: '快门转盘' });
addControl({ key: 'iso', kind: 'dial', rot: bodyDials.iso.rot, axis: 'y', span: 4.4, pick: bodyDials.iso.pick, name: 'ISO 转盘' });
addControl({ key: 'wb', kind: 'dial', rot: bodyDials.wb.rot, axis: 'y', span: 3.6, pick: bodyDials.wb.pick, name: '白平衡转盘' });
addControl({ key: 'comp', kind: 'dial', rot: bodyDials.comp.rot, axis: 'y', span: 3.2, pick: bodyDials.comp.pick, module: 'brain', g: bodyDials.comp.g || bodyDials.comp.rot, name: '曝光补偿转盘' });
addControl({ key: 'mode', kind: 'dial', rot: bodyDials.mode.rot, axis: 'y', span: 1.6, pick: bodyDials.mode.pick, module: 'brain', g: bodyDials.mode.g || bodyDials.mode.rot, name: '模式转盘' });
addControl({ kind: 'button', rot: bodyButtons.shutter.g, pick: bodyButtons.shutter.pick, pressDir: AXES.y, pressDepth: 0.3, module: 'shoot', g: bodyButtons.shutter.g, name: '机身快门按钮', tip: () => '拍一张', onClick: () => shoot() });
addControl({ kind: 'button', rot: new THREE.Group(), pick: [bodyLcd], name: '机背屏', how: '点按放大取景（V）', tip: () => '相机处理后的照片', onClick: () => openBigView(true) });
PICK_OCCLUDERS.push(lens, camBody, consoleG, monitor);

// --- per frame: the needle, the filters, the AF frame on the live screen ----------------------------------------
const _fq = new THREE.Quaternion();
function updateBench(dt, now) {
  // needle: where the meter says the exposure is (needs the camera's meter reading)
  const md = clamp(expo.meterDelta, -3.4, 3.4);
  meter.needle.rotation.z = damp(meter.needle.rotation.z, -(md / 3) * 0.9, 9, dt);
  const off = Math.abs(expo.meterDelta) > 3;
  meter.lampMat.emissive.copy(off && Math.floor(now / 400) % 2 ? LAMP_COL.amber : LAMP_COL.off);
  // filters fly to the front of the lens and back
  const mount = filterMount();
  for (const f of ndFilters) {
    f.k = damp(f.k, state.nd === f.stops && state.modules.kit ? 1 : 0, 6, dt);
    const e = smooth(clamp(f.k, 0, 1));
    f.g.position.copy(f.home).lerp(mount, e);
    f.g.position.y += Math.sin(e * Math.PI) * 12;
    f.g.quaternion.copy(_fq.copy(f.homeQ).slerp(f.onQ, e));
  }
  // the AF frame pops in where the screen was tapped, then fades
  const k = (now - afAt) / 1100;
  afBox.visible = k < 1;
  if (afBox.visible) {
    const a = clamp(k / 0.22, 0, 1);
    afBox.scale.setScalar(lerp(1.6, 1, smooth(a)));
    afMat.opacity = k < 0.22 ? a : 1 - smooth((k - 0.22) / 0.78);
  }
}

// --- the studio ------------------------------------------------------------------------------------------------
const room = new THREE.Group();
scene.add(room);
{
  const FLOOR = CON.y0;
  const tiles = canvasTex(512, 512, (g, w) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = `hsl(30 6% ${24 + Math.random() * 5}%)`; g.fillRect(i * s, j * s, s, s); }
    g.strokeStyle = '#1a1917'; g.lineWidth = 6;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(24, 16);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(960, 640), std(0xffffff, { map: tiles, roughness: 0.55, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(30, FLOOR, 120);
  floor.receiveShadow = true;
  room.add(floor);
  const panel = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#161b27'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(x + 3, 0, 2, h); }
  });
  panel.wrapS = THREE.RepeatWrapping;
  panel.repeat.set(8, 1);
  const wallMat = std(0xffffff, { map: panel, roughness: 0.85 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(960, 320), wallMat);
  back.position.set(30, FLOOR + 160, -130);
  room.add(back);
  for (const [x, ry] of [[-300, Math.PI / 2], [360, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(640, 320), wallMat);
    w.position.set(x, FLOOR + 160, 190); w.rotation.y = ry;
    room.add(w);
  }
  // light boxes on the back wall: the same pine from blurred to sharp
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
  [[14, -60], [6, 0], [0, 60]].forEach(([blur, x]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(48, 27), new THREE.MeshBasicMaterial({ map: drawBox(blur), color: new THREE.Color(1.25, 1.25, 1.25) }));
    m.position.set(x, 88, -129.5);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(50.8, 29.8), new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(0.9) }));
    fr.position.set(x, 88, -129.7);
    room.add(fr, m);
  });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.9, 12, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc89a).multiplyScalar(1.6) }));
    ring.position.set(170 + i * 22, 60, -129);
    room.add(ring);
  }
  const shelfMat = std(0x2a2f3b, { roughness: 0.7 });
  for (const y of [18, 34]) {
    box(70, 1.2, 12, shelfMat, 195, y, -123, room);
    for (let k = 0; k < 7; k++) box(3 + rand() * 3, 5 + rand() * 5, 8, std(new THREE.Color().setHSL(0.55 + rand() * 0.5, 0.25, 0.3 + rand() * 0.2)), 168 + k * 8.5, y + 3.5, -123, room);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(8, 6.5, 16, 24), std(0xc9c3b8, { roughness: 0.8 }));
  pot.position.set(-150, FLOOR + 8, -60);
  room.add(pot);
  const leafMat = std(0x2f6b3c, { flatShading: true, roughness: 0.8 });
  for (let i = 0; i < 18; i++) {
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), leafMat);
    const a = rand() * 6.28, r = 2 + rand() * 8, y = FLOOR + 20 + rand() * 34;
    l.position.set(-150 + Math.cos(a) * r, y, -60 + Math.sin(a) * r);
    l.scale.set(2.6, 8 + rand() * 4, 0.7);
    l.rotation.set(rand() - 0.5, a, (rand() - 0.5) * 1.2);
    room.add(l);
  }
  shadows(room, false, true);
}
