
// ---------------------------------------------------------------------------
// The miniature valley: a wooden tray with meadow, pines, a cabin, mountains
// and a painted sky. Everything here is also seen by the photo camera.
// ---------------------------------------------------------------------------
const valley = new THREE.Group();
scene.add(valley);

const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
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
function groundY(x, z) {
  let h = 5.2 + 0.9 * smooth(clamp((x - 40) / 30, 0, 1));
  h += 0.34 * Math.sin(x * 0.35 + z * 0.21) + 0.26 * Math.sin(z * 0.43 - x * 0.12) + 0.14 * Math.sin(x * 0.9 + z * 0.7);
  const edge = Math.min(x - 24, 92 - x, 31 - Math.abs(z));
  h = lerp(5.3, h, smooth(clamp(edge / 3, 0, 1)));
  h = lerp(5.6, h, smooth(clamp((Math.hypot(x - 52, z - 6) - 4.8) / 3, 0, 1)));
  h -= 0.16 * (1 - smooth(clamp(distToPath(x, z) / 1.4, 0, 1)));
  return h;
}
function colorFaces(g, pick) {
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
const flatMat = (o = {}) => focusGlow(std(0xffffff, { vertexColors: true, flatShading: true, roughness: 0.88, ...o }));

// --- meadow --------------------------------------------------------------
{
  let g = new THREE.PlaneGeometry(68, 62, 60, 54);
  g.rotateX(-Math.PI / 2);
  g.translate(58, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundY(p.getX(i), p.getZ(i)));
  g = g.toNonIndexed();
  const grass = [0x5f9e45, 0x6aa84f, 0x558f3f, 0x76b456, 0x64a24a].map((c) => new THREE.Color(c));
  const dirt = [0xb68c5c, 0xa87f52].map((c) => new THREE.Color(c));
  colorFaces(g, (c) => (distToPath(c.x, c.z) < 1.25 ? dirt[hash3(c.x, 0, c.z) > 0.5 ? 1 : 0] : grass[Math.floor(hash3(c.x, 1, c.z) * grass.length)]));
  g.computeVertexNormals();
  const meadow = new THREE.Mesh(g, flatMat());
  meadow.receiveShadow = true;
  valley.add(meadow);
}

// --- wooden tray -----------------------------------------------------------
const woodTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#b3824f'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) {
    g.fillStyle = `hsl(28 ${38 + Math.random() * 10}% ${44 + Math.random() * 8}%)`;
    g.fillRect(0, y, w, 31);
    g.strokeStyle = 'rgba(70,40,20,.25)';
    for (let i = 0; i < 7; i++) { g.beginPath(); const yy = y + 3 + Math.random() * 26; g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + 3, w * .6, yy - 3, w, yy + 1); g.stroke(); }
    g.fillStyle = 'rgba(40,20,10,.55)'; g.fillRect(0, y + 31, w, 1);
  }
});
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
{
  const wood = focusGlow(std(0xffffff, { map: woodTex, roughness: 0.62 }));
  const part = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wood); m.position.set(x, y, z); valley.add(m); return m; };
  part(69, 1.2, 63.4, 58, 0.6, 0);        // floor board
  part(1.2, 5.2, 63.4, 23.9, 3.2, 0);     // front
  part(1.2, 5.6, 63.4, 92.1, 3.4, 0);     // back
  part(69, 5.4, 1.2, 58, 3.3, 31.1);      // sides
  part(69, 5.4, 1.2, 58, 3.3, -31.1);
}

// --- mountains ---------------------------------------------------------------
function mountain(cx, cz, r, h, baseY, rot) {
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
  colorFaces(g, (c) => {
    const k = (c.y + h / 2) / h;
    const n = hash3(c.x, c.y, c.z);
    return k > 0.6 + (n - 0.5) * 0.14 ? snow[n > 0.5 ? 1 : 0] : rock[Math.floor(n * rock.length)];
  });
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, flatMat({ roughness: 0.8, side: THREE.DoubleSide }));
  mesh.position.set(cx, baseY + h / 2, cz);
  mesh.rotation.y = rot;
  mesh.castShadow = mesh.receiveShadow = true;
  valley.add(mesh);
}
mountain(78, -2, 13, 19, 6, 0.3);   // the peak
mountain(71, -20, 11, 13, 5.8, 1.1);
mountain(73, 18, 12, 15, 5.8, 2.0);
mountain(86, 8, 10, 13, 6, 0.7);
mountain(85, -27, 9, 11, 5.8, 2.6);
mountain(86, 27, 9, 12, 5.8, 1.7);

// --- pines, bushes, rocks (instanced) -----------------------------------------
const pineTrunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.2, 6).translate(0, 0.1, 0);
const pineLeafGeo = mergeGeometries([[0.36, 0.42, 0.14], [0.29, 0.38, 0.36], [0.2, 0.36, 0.64]].map(([r, h, b]) => new THREE.ConeGeometry(r, h, 7).translate(0, b + h / 2, 0)));
const trees = [{ x: 38, z: -7, h: 11, r: 0.2 }];
{
  const zones = [
    [29, 45, -29, -11, 8, 12, 9], [29, 46, 12, 29, 7, 11, 8], [54, 67, -27, -9, 6, 9, 8],
    [55, 67, 13, 28, 6, 9, 7], [57, 64, -2, 11, 7, 9, 3], [64, 71, -12, 12, 5, 7, 6],
  ];
  for (const [x0, x1, z0, z1, h0, h1, n] of zones) {
    let placed = 0, tries = 0;
    while (placed < n && tries++ < 400) {
      const x = lerp(x0, x1, rand()), z = lerp(z0, z1, rand());
      if (x < 52 && Math.abs(z - 6 * x / 52) < 5.5) continue;          // keep the cabin visible
      if (Math.hypot(x - 52, z - 6) < 8 || distToPath(x, z) < 2.4) continue;
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

// --- the cabin -------------------------------------------------------------------
const glowWarm = (i = 5) => std(0x201006, { emissive: 0xffb454, emissiveIntensity: i, roughness: 0.4 });
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
  // gable ends
  const gable = new THREE.Shape([new THREE.Vector2(-3.7, 0), new THREE.Vector2(3.7, 0), new THREE.Vector2(0, 3)]);
  for (const x of [48.99, 55.01]) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(gable), logs);
    m.rotation.y = -Math.PI / 2 * Math.sign(52 - x);
    m.position.set(x, gy + 4.2, 6);
    cabin.add(m);
  }
  // roof
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
  const win = glowWarm(5.5);
  const wgeo = new THREE.BoxGeometry(0.16, 1.1, 1.1);
  for (const z of [3.9, 8.1]) { const w = new THREE.Mesh(wgeo, win); w.position.set(48.95, gy + 2.4, z); cabin.add(w); }
  const sgeo = new THREE.BoxGeometry(1.2, 1.1, 0.16);
  for (const x of [50.6, 53.4]) { const w = new THREE.Mesh(sgeo, win); w.position.set(x, gy + 2.4, 9.75); cabin.add(w); }
  const attic = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), win);
  attic.rotation.y = -Math.PI / 2; attic.position.set(48.9, gy + 5.2, 6);
  cabin.add(attic);
  shadows(cabin);
  valley.add(cabin);
}

// --- lamp posts along the path -----------------------------------------------------
{
  const pole = focusGlow(std(0x23262d, { metalness: 0.6, roughness: 0.4 }));
  const bulb = glowWarm(9);
  for (const [x, z] of [[31, 5], [39.5, 7], [46, 1.8]]) {
    const y = groundY(x, z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 6), pole);
    p.position.set(x, y + 2.2, z);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), bulb);
    b.position.set(x, y + 4.55, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 8), pole);
    cap.position.set(x, y + 5.0, z);
    p.castShadow = true;
    valley.add(p, b, cap);
  }
  const porch = allLayers(new THREE.PointLight(0xffb366, 55, 18, 1.4));
  porch.position.set(47.5, 9.5, 5);
  valley.add(porch);
}

// --- painted sky on a curved backdrop --------------------------------------------------
{
  const sky = canvasTex(1024, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#4f8fd0'); gr.addColorStop(0.55, '#8fc0ea'); gr.addColorStop(1, '#dcebf5');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.filter = 'blur(6px)';
    for (let i = 0; i < 16; i++) {
      const cx = Math.random() * w, cy = 60 + Math.random() * h * 0.5, s = 30 + Math.random() * 50;
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + (k - 2) * s * 0.55, cy + Math.sin(k * 2.1) * s * 0.18, s * (0.55 + Math.random() * 0.3), s * 0.36, 0, 0, 7); g.fill(); }
    }
    g.filter = 'none';
    g.fillStyle = 'rgba(150,178,210,.55)';
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 64) g.lineTo(x, h * 0.8 - Math.abs(Math.sin(x * 0.011)) * 70 - Math.random() * 30);
    g.lineTo(w, h); g.fill();
  });
  const geo = new THREE.CylinderGeometry(120, 120, 42, 40, 1, true, Math.PI / 2 - 0.31, 0.62);
  const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, color: 0xe8f0ff }));
  back.position.set(93 - 120, 21.5, 0);
  valley.add(back);
  const frame = std(0x1b1e24, { metalness: 0.5, roughness: 0.5 });
  for (const z of [-36, 36]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 44, 1.2), frame);
    post.position.set(93 - 120 + Math.sqrt(120 * 120 - z * z) + 0.4, 22, z);
    post.castShadow = true;
    valley.add(post);
  }
}
toPhotoLayer(valley);
