
// ---------------------------------------------------------------------------
// The miniature valley: a wooden tray (on a riser) holding a low-poly meadow,
// a toy train on a track through two tunnels, a windmill, a stream, string
// lights, a cabin, mountains and a painted sky. Everything here is also seen
// by the photo camera. World y = local y + RISE (the tray sits on the
// bench's console top).
// ---------------------------------------------------------------------------
const valley = new THREE.Group();
scene.add(valley);
valley.position.y = RISE;

// Night-lighting registry: every emissive light-source material/light here
// goes in, so the lighting module (elsewhere) can scale them per preset.
const VALLEY_GLOW = { windows: [], lamps: [], string: [], train: [] };
const valleyPoints = [];

// --- small helpers shared by several features below -------------------------
function v_colorFaces(g, pick) {
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.x += pos.getX(i + k) / 3, v.y += pos.getY(i + k) / 3, v.z += pos.getZ(i + k) / 3;
    const c = pick(v);
    for (let k = 0; k < 3; k++) cols.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}
const v_flatMat = (o = {}) => focusGlow(std(0xffffff, { vertexColors: true, flatShading: true, roughness: 0.88, ...o }));
const v_glowWarm = (i = 5) => std(0x201006, { emissive: 0xffb454, emissiveIntensity: i, roughness: 0.4 });

// --- the dirt path, the rail line, the stream, and ground height -----------
const PATH = [[24.5, 1.4], [29, 2.2], [33.5, 4.3], [38.5, 4.9], [43, 3.6], [46.5, 4.2], [48.8, 6]];
function distToPath(x, z) {
  let best = 1e9;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
const TRACK_X = 45, TRAIN_LOOP = 72;
const v_trackLevel = 5.3;                // flattened bed the rails sit on
const v_railTop = v_trackLevel + 0.48;   // local y of the top of the rail
const v_wheelR = 0.34;                   // toy-train wheel radius, cm
// a small stream: waterfall near the mountains -> winds to the front edge
const v_STREAM = [[75, 15.5], [66, 17.5], [58, 18.5], [50, 19.5], [45, 20], [39, 20.5], [32, 21.5], [26, 22]];
function v_distToStream(x, z) {
  let best = 1e9;
  for (let i = 0; i < v_STREAM.length - 1; i++) {
    const [ax, az] = v_STREAM[i], [bx, bz] = v_STREAM[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
function groundY(x, z) {
  let h = 5.2 + 0.9 * smooth(clamp((x - 40) / 30, 0, 1));
  h += 0.34 * Math.sin(x * 0.35 + z * 0.21) + 0.26 * Math.sin(z * 0.43 - x * 0.12) + 0.14 * Math.sin(x * 0.9 + z * 0.7);
  const edge = Math.min(x - 24, 92 - x, 31 - Math.abs(z));
  h = lerp(5.3, h, smooth(clamp(edge / 3, 0, 1)));
  h = lerp(5.6, h, smooth(clamp((Math.hypot(x - 52, z - 6) - 4.8) / 3, 0, 1)));
  h -= 0.16 * (1 - smooth(clamp(distToPath(x, z) / 1.4, 0, 1)));
  h = lerp(v_trackLevel, h, smooth(clamp((Math.abs(x - TRACK_X) - 1.5) / 1.7, 0, 1)));
  h -= 0.55 * (1 - smooth(clamp(v_distToStream(x, z) / 1.5, 0, 1)));
  h += 0.9 * Math.exp(-(((x - 64) ** 2 + (z + 14) ** 2) / 40));   // the windmill's gentle rise
  return h;
}
function groundAt(x, z) { return groundY(x, z) + RISE; }

// --- meadow ------------------------------------------------------------------
{
  let g = new THREE.PlaneGeometry(68, 62, 60, 54);
  g.rotateX(-Math.PI / 2);
  g.translate(58, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundY(p.getX(i), p.getZ(i)));
  g = g.toNonIndexed();
  const grass = [0x5f9e45, 0x6aa84f, 0x558f3f, 0x76b456, 0x64a24a].map((c) => new THREE.Color(c));
  const dirt = [0xb68c5c, 0xa87f52].map((c) => new THREE.Color(c));
  const stone = [0x9aa0ab, 0x878e9a].map((c) => new THREE.Color(c));
  v_colorFaces(g, (c) => {
    if (distToPath(c.x, c.z) < 1.25) return dirt[hash3(c.x, 0, c.z) > 0.5 ? 1 : 0];
    if (Math.abs(c.x - TRACK_X) < 1.5) return stone[hash3(c.x, 2, c.z) > 0.5 ? 1 : 0];
    if (v_distToStream(c.x, c.z) < 1.1) return stone[0];
    return grass[Math.floor(hash3(c.x, 1, c.z) * grass.length)];
  });
  g.computeVertexNormals();
  const meadow = new THREE.Mesh(g, v_flatMat());
  meadow.receiveShadow = true;
  valley.add(meadow);
}

// --- riser block: stands the tray on the bench's console top ----------------
{
  const h = RISE + 2.3;
  const riser = new THREE.Mesh(new THREE.BoxGeometry(69, h, 63.4), focusGlow(std(0x14161a, { metalness: 0.5, roughness: 0.55 })));
  riser.position.set(58, -h / 2, 0);
  riser.castShadow = true; riser.receiveShadow = true;
  valley.add(riser);
}

// --- wooden tray --------------------------------------------------------------
const v_woodTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#b3824f'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) {
    g.fillStyle = `hsl(28 ${38 + Math.random() * 10}% ${44 + Math.random() * 8}%)`;
    g.fillRect(0, y, w, 31);
    g.strokeStyle = 'rgba(70,40,20,.25)';
    for (let i = 0; i < 7; i++) { g.beginPath(); const yy = y + 3 + Math.random() * 26; g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + 3, w * .6, yy - 3, w, yy + 1); g.stroke(); }
    g.fillStyle = 'rgba(40,20,10,.55)'; g.fillRect(0, y + 31, w, 1);
  }
});
v_woodTex.wrapS = v_woodTex.wrapT = THREE.RepeatWrapping;
const v_woodMat = focusGlow(std(0xffffff, { map: v_woodTex, roughness: 0.62 }));
{
  const part = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), v_woodMat); m.position.set(x, y, z); valley.add(m); return m; };
  part(69, 1.2, 63.4, 58, 0.6, 0);        // floor board
  part(1.2, 5.2, 63.4, 23.9, 3.2, 0);     // front
  part(1.2, 5.6, 63.4, 92.1, 3.4, 0);     // back
  part(69, 5.4, 1.2, 58, 3.3, 31.1);      // sides
  part(69, 5.4, 1.2, 58, 3.3, -31.1);
}

// --- mountains -----------------------------------------------------------------
function v_mountain(cx, cz, r, h, baseY, rot) {
  let g = new THREE.ConeGeometry(r, h, 8, 4, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > h / 2 - 1e-3) continue;
    const k = (y + h / 2) / h, n = hash3(x.toFixed(3), y.toFixed(3), z.toFixed(3)), m = hash3(z.toFixed(3), x.toFixed(3), 3);
    const s = 1 + (n - 0.5) * 0.42 * (1 - k * 0.5);
    p.setXYZ(i, x * s, y + (m - 0.5) * h * 0.09 * (1 - k), z * s);
  }
  g = g.toNonIndexed();
  const rock = [0x7d88a0, 0x6c7690, 0x8f9ab0, 0x747f98].map((c) => new THREE.Color(c));
  const snow = [0xd9e2ee, 0xc9d4e3].map((c) => new THREE.Color(c));
  v_colorFaces(g, (c) => {
    const k = (c.y + h / 2) / h;
    const n = hash3(c.x, c.y, c.z);
    return k > 0.6 + (n - 0.5) * 0.14 ? snow[n > 0.5 ? 1 : 0] : rock[Math.floor(n * rock.length)];
  });
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, v_flatMat({ roughness: 0.8, side: THREE.DoubleSide }));
  mesh.position.set(cx, baseY + h / 2, cz);
  mesh.rotation.y = rot;
  mesh.castShadow = mesh.receiveShadow = true;
  valley.add(mesh);
}
v_mountain(78, -2, 13, 19, 6, 0.3);   // the peak
v_mountain(71, -20, 11, 13, 5.8, 1.1);
v_mountain(73, 18, 12, 15, 5.8, 2.0);
v_mountain(86, 8, 10, 13, 6, 0.7);
v_mountain(85, -27, 9, 11, 5.8, 2.6);
v_mountain(86, 27, 9, 12, 5.8, 1.7);

// --- pines, bushes, rocks (instanced); track / windmill / flowers stay clear ---
{
  const pineTrunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.2, 6).translate(0, 0.1, 0);
  const pineLeafGeo = mergeGeometries([[0.36, 0.42, 0.14], [0.29, 0.38, 0.36], [0.2, 0.36, 0.64]].map(([r, h, b]) => new THREE.ConeGeometry(r, h, 7).translate(0, b + h / 2, 0)));
  const trees = [{ x: 38, z: -7, h: 11, r: 0.2 }];
  const nearWindmill = (x, z) => Math.hypot(x - 64, z + 14) < 6.5;
  const nearFlowers = (x, z) => Math.hypot(x - 28.8, z + 8) < 3;
  const nearTrack = (x) => Math.abs(x - TRACK_X) < 2.8;
  const zones = [
    [29, 45, -29, -11, 8, 12, 9], [29, 46, 12, 29, 7, 11, 8], [54, 67, -27, -9, 6, 9, 8],
    [55, 67, 13, 28, 6, 9, 7], [57, 64, -2, 11, 7, 9, 3], [64, 71, -12, 12, 5, 7, 6],
  ];
  for (const [x0, x1, z0, z1, h0, h1, n] of zones) {
    let placed = 0, tries = 0;
    while (placed < n && tries++ < 400) {
      const x = lerp(x0, x1, rand()), z = lerp(z0, z1, rand());
      if (x < 52 && Math.abs(z - 6 * x / 52) < 5.5) continue;
      if (Math.hypot(x - 52, z - 6) < 8 || distToPath(x, z) < 2.4) continue;
      if (nearTrack(x) || nearWindmill(x, z) || nearFlowers(x, z) || v_distToStream(x, z) < 1.6) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.4)) continue;
      trees.push({ x, z, h: lerp(h0, h1, rand()), r: rand() * 6.28 });
      placed++;
    }
  }
  const leaf = new THREE.InstancedMesh(pineLeafGeo, focusGlow(std(0xffffff, { flatShading: true, roughness: 0.85 })), trees.length);
  const trunk = new THREE.InstancedMesh(pineTrunkGeo, focusGlow(std(0x6b4a33, { flatShading: true })), trees.length);
  const greens = [0x2f7a45, 0x3b8a4f, 0x2c6e3f, 0x468f53, 0x3f8446].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  trees.forEach((t, i) => {
    const w = t.h * (0.92 + rand() * 0.2);
    m4.compose(new THREE.Vector3(t.x, groundY(t.x, t.z) - 0.2, t.z), q.setFromAxisAngle(up, t.r), new THREE.Vector3(w, t.h, w));
    leaf.setMatrixAt(i, m4); trunk.setMatrixAt(i, m4);
    leaf.setColorAt(i, i === 0 ? new THREE.Color(0x3a8f52) : greens[i % greens.length]);
  });
  leaf.castShadow = trunk.castShadow = true;
  leaf.receiveShadow = true;
  valley.add(leaf, trunk);

  const bushGeo = new THREE.IcosahedronGeometry(1, 0);
  const bushes = new THREE.InstancedMesh(bushGeo, focusGlow(std(0xffffff, { flatShading: true, roughness: 0.9 })), 22);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), focusGlow(std(0x8b909b, { flatShading: true, roughness: 0.95 })), 16);
  const bushCols = [0x4d8f3f, 0x5a9c46, 0x437f38].map((c) => new THREE.Color(c));
  const place = (mesh, n, s0, s1, sy, cols) => {
    let i = 0;
    for (let tries = 0; i < n && tries < 500; tries++) {
      const x = lerp(27, 70, rand()), z = lerp(-28, 28, rand());
      if (x < 52 && Math.abs(z - 6 * x / 52) < 4) continue;
      if (Math.hypot(x - 52, z - 6) < 6.5 || Math.hypot(x - 38, z + 7) < 3) continue;
      if (nearTrack(x) || nearWindmill(x, z) || nearFlowers(x, z) || v_distToStream(x, z) < 1.3) continue;
      const s = lerp(s0, s1, rand());
      m4.compose(new THREE.Vector3(x, groundY(x, z) + s * sy * 0.35, z), q.setFromAxisAngle(up, rand() * 6), new THREE.Vector3(s, s * sy, s));
      mesh.setMatrixAt(i, m4);
      if (cols) mesh.setColorAt(i, cols[i % cols.length]);
      i++;
    }
    mesh.count = i;
    mesh.castShadow = mesh.receiveShadow = true;
    valley.add(mesh);
  };
  place(bushes, 22, 0.7, 1.4, 0.7, bushCols);
  place(rocks, 16, 0.35, 1.0, 0.6, null);
}

// --- the cabin, glowing windows and a porch light ---------------------------------
{
  const cabin = new THREE.Group();
  const gy = 5.6;
  const logTex = canvasTex(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 21) {
      g.fillStyle = `hsl(24 ${40 + Math.random() * 8}% ${34 + Math.random() * 7}%)`;
      g.fillRect(0, y, w, 21);
      g.fillStyle = 'rgba(30,14,6,.5)'; g.fillRect(0, y + 19, w, 2);
      g.fillStyle = 'rgba(255,220,180,.08)'; g.fillRect(0, y + 2, w, 3);
    }
  });
  const logs = focusGlow(std(0xffffff, { map: logTex, roughness: 0.8 }));
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 4.2, 7.4), logs);
  body.position.set(52, gy + 2.1, 6);
  cabin.add(body);
  const gable = new THREE.Shape([new THREE.Vector2(-3.7, 0), new THREE.Vector2(3.7, 0), new THREE.Vector2(0, 3)]);
  for (const x of [48.99, 55.01]) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(gable), logs);
    m.rotation.y = -Math.PI / 2 * Math.sign(52 - x);
    m.position.set(x, gy + 4.2, 6);
    cabin.add(m);
  }
  const roofMat = focusGlow(std(0x4a4550, { roughness: 0.75, flatShading: true }));
  const slope = Math.atan2(3.2, 4.3), len = Math.hypot(3.2, 4.3) + 0.5;
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.36, len), roofMat);
    m.position.set(52, gy + 4.2 + 1.55, 6 + s * 2.05);
    m.rotation.x = s * slope;
    cabin.add(m);
  }
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), focusGlow(std(0x7c6f68, { roughness: 0.9 })));
  chimney.position.set(54, gy + 6.4, 3.6);
  cabin.add(chimney);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 1.5), focusGlow(std(0x3d2717)));
  door.position.set(48.95, gy + 1.3, 6);
  cabin.add(door);
  const win = v_glowWarm(5.5);
  VALLEY_GLOW.windows.push({ mat: win, base: 5.5 });
  const wgeo = new THREE.BoxGeometry(0.16, 1.1, 1.1);
  for (const z of [3.9, 8.1]) { const w = new THREE.Mesh(wgeo, win); w.position.set(48.95, gy + 2.4, z); cabin.add(w); }
  const sgeo = new THREE.BoxGeometry(1.2, 1.1, 0.16);
  for (const x of [50.6, 53.4]) { const w = new THREE.Mesh(sgeo, win); w.position.set(x, gy + 2.4, 9.75); cabin.add(w); }
  const attic = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), win);
  attic.rotation.y = -Math.PI / 2; attic.position.set(48.9, gy + 5.2, 6);
  cabin.add(attic);
  shadows(cabin);
  valley.add(cabin);

  const porch = allLayers(new THREE.PointLight(0xffb366, 55, 20, 1.4));
  porch.position.set(47.5, 9.5, 5);
  porch.castShadow = false;
  porch.userData.base = 55;
  valley.add(porch);
  valleyPoints.push(porch);
}

// --- lamp posts along the path (third one moved clear of the track) ---------------
{
  const pole = focusGlow(std(0x23262d, { metalness: 0.6, roughness: 0.4 }));
  const bulb = v_glowWarm(9);
  VALLEY_GLOW.lamps.push({ mat: bulb, base: 9 });
  for (const [x, z] of [[31, 5], [39.5, 7], [48.6, 0.4]]) {
    const y = groundY(x, z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 6), pole);
    p.position.set(x, y + 2.2, z);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), bulb);
    b.position.set(x, y + 4.55, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 8), pole);
    cap.position.set(x, y + 5.0, z);
    p.castShadow = true;
    valley.add(p, b, cap);
    const lp = allLayers(new THREE.PointLight(0xffc27a, 22, 20, 1.4));
    lp.position.set(x, y + 4.55, z);
    lp.castShadow = false;
    lp.userData.base = 22;
    valley.add(lp);
    valleyPoints.push(lp);
  }
}

// --- painted sky on a big curved backdrop ------------------------------------------
function v_skyClouds(g, w, h, color, n, y0, y1, s0, s1) {
  g.filter = 'blur(6px)';
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const cx = Math.random() * w, cy = y0 + Math.random() * (y1 - y0), s = s0 + Math.random() * (s1 - s0);
    for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + (k - 2) * s * 0.55, cy + Math.sin(k * 2.1) * s * 0.18, s * (0.55 + Math.random() * 0.3), s * 0.36, 0, 0, 7); g.fill(); }
  }
  g.filter = 'none';
}
function v_skyRidge(g, w, h, color, base, amp) {
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += 64) g.lineTo(x, h * base - Math.abs(Math.sin(x * 0.011)) * amp - Math.random() * amp * 0.4);
  g.lineTo(w, h); g.fill();
}
function v_skyStars(g, w, h, n) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h * 0.72, r = Math.random() * 1.3 + 0.2;
    g.globalAlpha = 0.4 + Math.random() * 0.6;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}
const SKY_TEX = {
  sunny: canvasTex(1024, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#4f8fd0'); gr.addColorStop(0.55, '#8fc0ea'); gr.addColorStop(1, '#dcebf5');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    v_skyClouds(g, w, h, 'rgba(255,255,255,.85)', 16, 60, 60 + h * 0.5, 30, 80);
    v_skyRidge(g, w, h, 'rgba(150,178,210,.55)', 0.8, 70);
  }),
  cloudy: canvasTex(1024, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#818a97'); gr.addColorStop(1, '#c6cad0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    v_skyClouds(g, w, h, 'rgba(110,118,128,.5)', 12, 40, 40 + h * 0.55, 60, 140);
    v_skyClouds(g, w, h, 'rgba(230,233,237,.35)', 10, 30, 30 + h * 0.4, 40, 90);
    v_skyRidge(g, w, h, 'rgba(120,128,138,.6)', 0.82, 55);
  }),
  golden: canvasTex(1024, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#16264a'); gr.addColorStop(0.55, '#8a5a72'); gr.addColorStop(0.82, '#ff9a5c'); gr.addColorStop(1, '#ffd9a0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w * 0.62, h * 0.8, 4, w * 0.62, h * 0.8, 220);
    sun.addColorStop(0, 'rgba(255,235,190,.95)'); sun.addColorStop(0.4, 'rgba(255,190,120,.45)'); sun.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    v_skyClouds(g, w, h, 'rgba(255,210,180,.3)', 8, 50, 50 + h * 0.35, 50, 110);
    v_skyRidge(g, w, h, 'rgba(60,42,58,.7)', 0.86, 55);
  }),
  night: canvasTex(1024, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#050810'); gr.addColorStop(0.7, '#0c1730'); gr.addColorStop(1, '#182842');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    v_skyStars(g, w, h, 220);
    const moon = g.createRadialGradient(w * 0.74, h * 0.22, 2, w * 0.74, h * 0.22, 70);
    moon.addColorStop(0, 'rgba(235,240,250,.9)'); moon.addColorStop(0.25, 'rgba(210,220,240,.35)'); moon.addColorStop(1, 'rgba(210,220,240,0)');
    g.fillStyle = moon; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9edf5'; g.beginPath(); g.arc(w * 0.74, h * 0.22, 16, 0, 7); g.fill();
    v_skyRidge(g, w, h, 'rgba(4,8,18,.85)', 0.86, 45);
  }),
};
for (const t of Object.values(SKY_TEX)) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
// radius 210, nearest point x ~101 (clears the mountains out to x~99), arc
// wide enough and tall enough that a 24 mm lens from the origin never sees past it
const skyBackdrop = new THREE.Mesh(
  new THREE.CylinderGeometry(210, 210, 78, 48, 1, true, Math.PI / 2 - 0.55, 1.1),
  new THREE.MeshBasicMaterial({ map: SKY_TEX.golden, side: THREE.BackSide, color: 0xffffff })
);
skyBackdrop.position.set(101 - 210, 35.5, 0);
valley.add(skyBackdrop);

// --- the rail line: ballast, sleepers, two rails, a level crossing ----------------
{
  const ballastMat = focusGlow(std(0x746a5c, { flatShading: true, roughness: 0.95 }));
  const sleeperMat = focusGlow(std(0x3c2c1e, { flatShading: true, roughness: 0.9 }));
  const railMat = focusGlow(std(0xb7bcc4, { metalness: 0.8, roughness: 0.35 }));
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.26, 62.4), ballastMat);
  ballast.position.set(TRACK_X, v_trackLevel + 0.13, 0);
  ballast.receiveShadow = true;
  valley.add(ballast);
  const N_SLEEP = 54;
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.12, 0.3), sleeperMat, N_SLEEP);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N_SLEEP; i++) {
    m4.makeTranslation(TRACK_X, v_trackLevel + 0.26 + 0.06, lerp(-31, 31, i / (N_SLEEP - 1)));
    sleepers.setMatrixAt(i, m4);
  }
  sleepers.castShadow = sleepers.receiveShadow = true;
  valley.add(sleepers);
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 62.4), railMat);
    rail.position.set(TRACK_X + s * 0.62, v_trackLevel + 0.43, 0);
    rail.castShadow = true;
    valley.add(rail);
  }

  // level crossing: the dirt path over the rails, a flush deck + striped posts
  const crossZ = 3.94;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 3.1), v_woodMat);
  deck.position.set(TRACK_X, v_trackLevel + 0.3, crossZ);
  deck.castShadow = deck.receiveShadow = true;
  valley.add(deck);
  const stripeTex = canvasTex(16, 64, (g, w, h) => {
    for (let y = 0; y < h; y += 16) { g.fillStyle = (y / 16) % 2 ? '#1a1a1a' : '#e8b400'; g.fillRect(0, y, w, 16); }
  });
  const stripeMat = focusGlow(std(0xffffff, { map: stripeTex, roughness: 0.6 }));
  for (const [x, z] of [[TRACK_X - 1.5, crossZ - 1.7], [TRACK_X + 1.5, crossZ + 1.7]]) {
    const y = groundY(x, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 6), stripeMat);
    post.position.set(x, y + 0.95, z);
    post.castShadow = true;
    valley.add(post);
  }

  // two small rocky tunnel mounds, dark arch facing the camera, at the tray sides
  const rockMat = focusGlow(std(0x767f91, { flatShading: true, roughness: 0.92 }));
  const archMat = focusGlow(std(0x0a0a0c, { roughness: 1, side: THREE.DoubleSide }));
  for (const sgn of [-1, 1]) {
    const z = sgn * 26;
    const y = groundY(TRACK_X, z);
    const mound = new THREE.Group();
    const boulders = [[0, 0, 0, 2.2], [-1.7, 0.3, 1.0, 1.6], [1.8, 0.2, -1.1, 1.6], [-0.7, 1.3, -0.8, 1.3], [1.0, 1.2, 1.2, 1.3]];
    for (const [dx, dy, dz, r] of boulders) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
      b.position.set(TRACK_X + dx, y + dy + r * 0.55, z + dz);
      b.scale.set(1, 0.8, 1);
      mound.add(b);
    }
    const arch = new THREE.Shape();
    arch.moveTo(-1.4, 0); arch.lineTo(-1.4, 1.4);
    arch.absarc(0, 1.4, 1.4, Math.PI, 0, true);
    arch.lineTo(1.4, 0); arch.closePath();
    const archMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 0.3, bevelEnabled: false }), archMat);
    archMesh.position.set(TRACK_X - 1.35, y + 0.02, z);
    archMesh.rotation.y = Math.PI / 2;
    mound.add(archMesh);
    shadows(mound);
    valley.add(mound);
  }
}

// --- the toy train: locomotive + two carriages, running toward +z -----------------
const trainGroup = new THREE.Group();
valley.add(trainGroup);
const trainState = { v: state.trainSpeed, base: 0, tau0: 0 };
const v_trainWheels = [];
function v_trainDist(tau) { return trainState.base + trainState.v * (tau - trainState.tau0); }
// z of the locomotive's front, wrapped into the loop (52 visible + 20 hidden in tunnel)
function trainZ(tau) {
  const u = ((v_trainDist(tau) % TRAIN_LOOP) + TRAIN_LOOP) % TRAIN_LOOP;
  return -26 + Math.min(u, 52);
}
function setTrainSpeed(v, tauNow) {
  trainState.base = v_trainDist(tauNow);   // rebase so the front doesn't jump
  trainState.tau0 = tauNow;
  trainState.v = v;
}
{
  // all y below are relative to the axle/rail-contact height (0); trainGroup
  // itself carries the constant y = axleY offset up to the rails
  const axleY = v_railTop + v_wheelR;
  trainGroup.position.set(TRACK_X, axleY, trainZ(0));

  const blackLoco = focusGlow(std(0x17181b, { flatShading: true, roughness: 0.55, metalness: 0.2 }));
  const redLoco = focusGlow(std(0xa3231f, { flatShading: true, roughness: 0.5, metalness: 0.15 }));
  const brass = focusGlow(std(0xc79a3d, { roughness: 0.35, metalness: 0.75 }));
  const wheelMat = focusGlow(std(0x222222, { roughness: 0.6, metalness: 0.4 }));
  const headMat = std(0x241a06, { emissive: 0xfff0c0, emissiveIntensity: 7, roughness: 0.4 });
  VALLEY_GLOW.train.push({ mat: headMat, base: 7 });
  const winMat = std(0x1a1408, { emissive: 0xffb454, emissiveIntensity: 4, roughness: 0.5 });
  VALLEY_GLOW.train.push({ mat: winMat, base: 4 });
  const wheelGeo = new THREE.CylinderGeometry(v_wheelR, v_wheelR, 0.12, 12).rotateZ(Math.PI / 2);
  const addWheel = (parent, x, z) => { const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(x, 0, z); parent.add(w); v_trainWheels.push(w); };

  // locomotive: front tip (cow-catcher) at local z = 0, body running toward -z
  const loco = new THREE.Group();
  const cow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 4), blackLoco);
  cow.rotation.x = Math.PI / 2; cow.rotation.y = Math.PI / 4;
  cow.position.set(0, 0.28, -0.425);
  loco.add(cow);
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3.0, 12).rotateX(Math.PI / 2), blackLoco);
  boiler.position.set(0, 0.8, -1.8);
  loco.add(boiler);
  const smoke = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), blackLoco);
  smoke.position.set(0, 0.8, -0.3); smoke.rotation.y = Math.PI / 2;
  loco.add(smoke);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), headMat);
  head.position.set(0, 1.0, -0.32);
  loco.add(head);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.85, 10), blackLoco);
  chimney.position.set(0, 1.825, -0.75);
  loco.add(chimney);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.32, 10), brass);
  dome.position.set(0, 1.56, -1.9);
  loco.add(dome);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.5, 1.3), redLoco);
  cab.position.set(0, 0.99, -3.95);
  loco.add(cab);
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 1.45), blackLoco);
  cabRoof.position.set(0, 1.81, -3.95);
  loco.add(cabRoof);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6).rotateX(Math.PI / 2), brass); b.position.set(s * 0.5, 0.24, -4.75); loco.add(b); }
  addWheel(loco, -0.62, -1.0); addWheel(loco, 0.62, -1.0);
  addWheel(loco, -0.62, -2.7); addWheel(loco, 0.62, -2.7);
  trainGroup.add(loco);

  // two carriages: cream body, green roof, glowing windows
  function makeCarriage(dz) {
    const g = new THREE.Group();
    g.position.z = dz;
    const bodyMat = focusGlow(std(0xe9dcc0, { flatShading: true, roughness: 0.6 }));
    const roofMat = focusGlow(std(0x3f7a4e, { flatShading: true, roughness: 0.7 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 3.8), bodyMat);
    body.position.set(0, 0.765, -1.9);
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.22, 3.9), roofMat);
    roof.position.set(0, 1.40, -1.9);
    g.add(roof);
    const winGeo = new THREE.BoxGeometry(0.05, 0.4, 0.48);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(winGeo, winMat);
      w.position.set(s * 0.605, 0.64, -0.5 - i * 0.66);
      g.add(w);
    }
    addWheel(g, -0.62, -0.7); addWheel(g, 0.62, -0.7);
    addWheel(g, -0.62, -3.1); addWheel(g, 0.62, -3.1);
    return g;
  }
  trainGroup.add(makeCarriage(-5.3));
  trainGroup.add(makeCarriage(-9.8));

  shadows(trainGroup);
}

// --- the windmill, on a gentle rise, rotor spinning in animate() -------------------
const windmillRotor = new THREE.Group();
{
  const wx = 64, wz = -14, gy = groundY(wx, wz);
  const towerMat = focusGlow(std(0xe6ddc8, { roughness: 0.65 }));
  const capMat = focusGlow(std(0x3a3f47, { flatShading: true, roughness: 0.6 }));
  const bladeMat = focusGlow(std(0xf1ece0, { flatShading: true, roughness: 0.6 }));
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.5, 7.2, 10), towerMat);
  tower.position.set(wx, gy + 3.6, wz);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.3, 10), capMat);
  cap.position.set(wx, gy + 7.2 + 0.65, wz);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 8).rotateZ(Math.PI / 2), capMat);
  shaft.position.set(wx - 1.35, gy + 6.7, wz);
  windmillRotor.position.set(wx - 1.9, gy + 6.7, wz);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10).rotateZ(Math.PI / 2), capMat);
  windmillRotor.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.14, 4.8, 0.75).translate(0, 2.5, 0);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.x = i * (Math.PI / 2);
    windmillRotor.add(blade);
  }
  shadows(tower); shadows(cap);
  valley.add(tower, cap, shaft, windmillRotor);
}

// --- the stream: a small waterfall near the mountains, winding to the front edge --
const v_streamTex = canvasTex(64, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#2f6f80'); gr.addColorStop(1, '#3f8a9c');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w, y0 = Math.random() * h, len = 10 + Math.random() * 22;
    g.lineWidth = 0.6 + Math.random() * 1.2;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (Math.random() - 0.5) * 4, y0 + len); g.stroke();
  }
});
v_streamTex.wrapS = THREE.ClampToEdgeWrapping;
v_streamTex.wrapT = THREE.RepeatWrapping;
v_streamTex.repeat.set(1, 3);
{
  const n = v_STREAM.length;
  let total = 0; const cum = [0];
  for (let i = 1; i < n; i++) { total += Math.hypot(v_STREAM[i][0] - v_STREAM[i - 1][0], v_STREAM[i][1] - v_STREAM[i - 1][1]); cum.push(total); }
  const leftPts = [], rightPts = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = v_STREAM[i];
    const [dx, dz] = i === 0 ? [v_STREAM[1][0] - x, v_STREAM[1][1] - z] : i === n - 1 ? [x - v_STREAM[i - 1][0], z - v_STREAM[i - 1][1]] : [v_STREAM[i + 1][0] - v_STREAM[i - 1][0], v_STREAM[i + 1][1] - v_STREAM[i - 1][1]];
    const len = Math.hypot(dx, dz) || 1, px = -dz / len, pz = dx / len;
    const w = lerp(2.0, 0.9, cum[i] / total) / 2;
    leftPts.push([x + px * w, z + pz * w]);
    rightPts.push([x - px * w, z - pz * w]);
  }
  const pos = [], uv = [];
  for (let i = 0; i < n - 1; i++) {
    const v0 = cum[i] / total, v1 = cum[i + 1] / total;
    const quad = [[leftPts[i], v0, 0], [rightPts[i], v0, 1], [rightPts[i + 1], v1, 1], [leftPts[i], v0, 0], [rightPts[i + 1], v1, 1], [leftPts[i + 1], v1, 0]];
    for (const [[x, z], v, u] of quad) { pos.push(x, groundY(x, z) + 0.05, z); uv.push(u, v); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const streamMat = focusGlow(std(0xffffff, { map: v_streamTex, roughness: 0.16, metalness: 0.05, transparent: true, opacity: 0.92, emissive: 0x6fb8c8, emissiveIntensity: 0.18 }));
  const stream = new THREE.Mesh(geo, streamMat);
  valley.add(stream);
  // the little waterfall where it starts, off the mountainside
  const wf = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.4, 1, 8), streamMat);
  wf.position.set(75, groundY(75, 15.5) + 1.6, 15.2);
  wf.rotation.y = 0.35;
  valley.add(wf);
  // a tiny culvert where the stream passes under the rail bed
  const culvertMat = focusGlow(std(0x3a3a3e, { roughness: 0.8, flatShading: true }));
  const culvert = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.6, 10, 1, true).rotateZ(Math.PI / 2), culvertMat);
  culvert.position.set(TRACK_X, groundY(TRACK_X, 20) + 0.15, 20);
  valley.add(culvert);
}

// --- string lights: cabin porch corner to a new thin pole --------------------------
{
  const p0 = new THREE.Vector3(48.8, 10, 9.8);
  const poleX = 41, poleZ = 13, poleH = 4.6;
  const poleBaseY = groundY(poleX, poleZ);
  const p1 = new THREE.Vector3(poleX, poleBaseY + poleH, poleZ);
  const sag = 0.9;
  const curvePt = (t) => new THREE.Vector3().lerpVectors(p0, p1, t).setY(lerp(p0.y, p1.y, t) - sag * 4 * t * (1 - t));
  const wirePts = []; for (let i = 0; i <= 16; i++) wirePts.push(curvePt(i / 16));
  const wireMat = focusGlow(std(0x14151a, { roughness: 0.6 }));
  const wireTube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts), 24, 0.025, 5, false), wireMat);
  valley.add(wireTube);

  const poleMat = focusGlow(std(0x2b2e34, { metalness: 0.5, roughness: 0.5 }));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, poleH, 6), poleMat);
  pole.position.set(poleX, poleBaseY + poleH / 2, poleZ);
  pole.castShadow = true;
  valley.add(pole);

  const bulbMat = v_glowWarm(6);
  VALLEY_GLOW.string.push({ mat: bulbMat, base: 6 });
  const bulbGeo = new THREE.SphereGeometry(0.18, 8, 6);
  const N_BULB = 12;
  for (let i = 0; i < N_BULB; i++) {
    const t = (i + 0.5) / N_BULB;
    const p = curvePt(t);
    const b = new THREE.Mesh(bulbGeo, bulbMat);
    b.position.set(p.x, p.y - 0.12, p.z);
    valley.add(b);
    if (i === 2 || i === 9) {
      const lp = allLayers(new THREE.PointLight(0xffb46e, 8, 20, 1.4));
      lp.position.copy(b.position);
      lp.castShadow = false;
      lp.userData.base = 8;
      valley.add(lp);
      valleyPoints.push(lp);
    }
  }
}

// --- foreground flowers + grass tufts, close to the lens ---------------------------
{
  const fx = 28.8, fz = -8;
  const stemMat = focusGlow(std(0x4a7a36, { flatShading: true, roughness: 0.85 }));
  const grassMat = focusGlow(std(0x5a9c46, { flatShading: true, roughness: 0.9 }));
  const heads = [0xf2c14e, 0xf08a4b, 0xfaf3e6, 0xe86a5a, 0xffffff].map((c) => focusGlow(std(c, { flatShading: true, roughness: 0.75 })));
  const eyeMat = focusGlow(std(0x6b4a1e, { roughness: 0.6 }));
  for (let i = 0; i < 14; i++) {
    const a = rand() * 6.28, r = rand() * 1.7;
    const x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r * 0.7;
    const gy = groundY(x, z);
    const h = 0.55 + rand() * 0.35;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, h, 5), stemMat);
    stem.position.set(x, gy + h / 2, z);
    stem.rotation.set((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
    valley.add(stem);
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11 + rand() * 0.05, 1), heads[i % heads.length]);
    fl.position.set(x, gy + h, z);
    fl.scale.set(1, 0.55, 1);
    fl.rotation.set(rand(), rand(), rand());
    valley.add(fl);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat);
    eye.position.set(x, gy + h + 0.03, z);
    valley.add(eye);
  }
  const tuftGeo = mergeGeometries([0, 1, 2].map((k) => new THREE.ConeGeometry(0.03, 0.4 + k * 0.05, 4).translate((k - 1) * 0.05, 0.2, 0)));
  const tufts = new THREE.InstancedMesh(tuftGeo, grassMat, 24);
  const m4f = new THREE.Matrix4(), qf = new THREE.Quaternion(), upf = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 24; i++) {
    const a = rand() * 6.28, r = rand() * 2.1;
    const x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r * 0.7;
    const s = 0.7 + rand() * 0.6;
    m4f.compose(new THREE.Vector3(x, groundY(x, z), z), qf.setFromAxisAngle(upf, rand() * 6.28), new THREE.Vector3(s, s, s));
    tufts.setMatrixAt(i, m4f);
  }
  tufts.castShadow = tufts.receiveShadow = true;
  valley.add(tufts);
}

// --- subjects: where things are, for photo tags, the DOF scale, tap-to-focus ------
const SUBJECTS = [
  { key: 'flowers', name: '花丛', at: V3(28.8, groundY(28.8, -8) + 0.55 + RISE, -8), r: 1.8, up: 0.6, tag: true },
  { key: 'pine', name: '松树', at: V3(38, groundY(38, -7) - 0.2 + 11 * 0.55 + RISE, -7), r: 0.9, up: 1.2, tag: true },
  { key: 'train', name: '小火车', at: V3(trainGroup.position.x, trainGroup.position.y + RISE, trainGroup.position.z), r: 0.7, up: 0.9, tag: true, speed: trainState.v },
  { key: 'lights', name: '串灯', at: V3(44.9, lerp(10, groundY(41, 13) + 4.6, 0.5) - 0.9 + RISE, 11.4), r: 0.8, up: 0.4, tag: true },
  { key: 'cabin', name: '小屋', at: V3(52, 5.6 + 2.1 + RISE, 6), r: 3.6, up: 2.4, tag: true },
  { key: 'windmill', name: '风车', at: V3(64, groundY(64, -14) + 6.7 + RISE, -14), r: 1.5, up: 1.3, tag: true },
  { key: 'stream', name: '溪水', at: V3(50, groundY(50, 19.5) + 0.1 + RISE, 19.5), r: 0.8, up: 0.4, tag: true },
  { key: 'peak', name: '山峰', at: V3(78, 25 + RISE, -2), r: 9, up: 3, tag: true },
];
const SUB = Object.fromEntries(SUBJECTS.map((s) => [s.key, s]));

// --- per-frame pose: train, windmill rotor, stream flow. Cheap; no allocations ----
function animate(tau) {
  const d = v_trainDist(tau);
  const u = ((d % TRAIN_LOOP) + TRAIN_LOOP) % TRAIN_LOOP;
  const z = -26 + Math.min(u, 52);
  trainGroup.visible = u < 52;
  trainGroup.position.z = z;
  SUB.train.at.set(trainGroup.position.x, trainGroup.position.y + RISE, z);
  SUB.train.speed = trainState.v;
  const wheelAngle = d / v_wheelR;
  for (let i = 0; i < v_trainWheels.length; i++) v_trainWheels[i].rotation.x = wheelAngle;

  windmillRotor.rotation.x = 1.6 * tau;

  v_streamTex.offset.y = tau * 0.35;
}

// fewer draw calls: merge everything rigid (the valley is drawn up to 16x a frame);
// the train and the windmill rotor move each frame, so they stay unbaked
bakeStatic(valley, [trainGroup, windmillRotor]);
toPhoto(valley);
