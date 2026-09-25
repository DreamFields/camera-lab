
// ---------------------------------------------------------------------------
// The location, at real scale: a paved plaza in front of a row of cafés, a
// road, trees and lamps, hills in the haze and a sky drawn by a shader.
// Everything here is seen by both the photo camera and the world view.
// ---------------------------------------------------------------------------
const world = new THREE.Group();
scene.add(world);
// identical materials are shared, so baking can merge their meshes
const _mats = new Map();
function glowMat(color, o = {}) {
  const plain = !Object.values(o).some((v) => v && v.isTexture);
  const key = plain && JSON.stringify([color, o]);
  if (key && _mats.has(key)) return _mats.get(key);
  const m = focusGlow(std(color, o));
  if (key) _mats.set(key, m);
  return m;
}

// --- ground ------------------------------------------------------------------------
{
  // sits a little under the paving, and its grid is offset so no vertex lands
  // right under the lens (a vertex at the camera's own depth clips badly)
  let g = new THREE.PlaneGeometry(1600, 1600, 80, 80);
  g.rotateX(-Math.PI / 2);
  g.translate(310, -0.03, 10);
  g = g.toNonIndexed();
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const greens = [0x5b8f3e, 0x66994a, 0x547f39, 0x6fa052].map((c) => new THREE.Color(c));
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const c = greens[Math.floor(hash1(x * 0.37 + z * 1.91) * greens.length)];
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const grass = new THREE.Mesh(g, glowMat(0xffffff, { vertexColors: true, roughness: 0.96, flatShading: true }));
  grass.receiveShadow = true;
  world.add(grass);
}

// paving stones, road and sidewalk as textured slabs
const tile = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const paveTex = tile(512, 512, (g, w) => {
  const n = 8, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const off = (j % 2) * s * 0.5;
    g.fillStyle = `hsl(${30 + rand() * 10} ${10 + rand() * 6}% ${64 + rand() * 9}%)`;
    g.fillRect(i * s + off, j * s, s, s);
    g.fillRect(i * s + off - w, j * s, s, s);
  }
  g.strokeStyle = 'rgba(70,60,50,.55)'; g.lineWidth = 3;
  for (let j = 0; j <= n; j++) {
    g.beginPath(); g.moveTo(0, j * s); g.lineTo(w, j * s); g.stroke();
    for (let i = 0; i <= n; i++) { const x = i * s + (j % 2) * s * 0.5; g.beginPath(); g.moveTo(x, j * s); g.lineTo(x, j * s + s); g.stroke(); }
  }
});
const asphaltTex = tile(512, 512, (g, w) => {
  g.fillStyle = '#3b3d42'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rand() * 0.06})`; g.fillRect(rand() * w, rand() * w, 2, 2); }
});
const concreteTex = tile(512, 512, (g, w) => {
  g.fillStyle = '#b9b4aa'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${rand() * 0.05})`; g.fillRect(rand() * w, rand() * w, 3, 3); }
  g.strokeStyle = 'rgba(60,55,50,.45)'; g.lineWidth = 3;
  for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(0, k * w / 4); g.lineTo(w, k * w / 4); g.stroke(); g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, w); g.stroke(); }
});
function slab(x0, x1, z0, z1, y, tex, rep, o = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y, z1 - z0);
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / rep, (z1 - z0) / rep);
  const m = new THREE.Mesh(g, glowMat(0xffffff, { map: t, roughness: 0.9, ...o }));
  m.position.set((x0 + x1) / 2, y / 2, (z0 + z1) / 2);
  m.receiveShadow = true;
  world.add(m);
  return m;
}
const PLAZA = { x0: -6, x1: 14.2, z0: -11, z1: 11 };
slab(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, 0.04, paveTex, 4);
slab(14.2, 14.5, -140, 140, 0.16, concreteTex, 1.5, { color: 0xd8d4cc });
slab(14.5, 18.7, -140, 140, 0.02, asphaltTex, 6, { roughness: 0.82 });
slab(18.7, 19.0, -140, 140, 0.16, concreteTex, 1.5, { color: 0xd8d4cc });
slab(19.0, 21.2, -140, 140, 0.15, concreteTex, 2.2);
{
  // lane markings and a zebra crossing
  const white = std(0xf1efe8, { roughness: 0.6 });
  const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.012, 2.2), focusGlow(white), 60);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) { m4.makeTranslation(16.6, 0.026, -130 + i * 4.4); dash.setMatrixAt(i, m4); }
  const zebra = new THREE.InstancedMesh(new THREE.BoxGeometry(3.6, 0.012, 0.45), focusGlow(white), 6);
  for (let i = 0; i < 6; i++) { m4.makeTranslation(16.6, 0.027, -2.6 + i * 0.9); zebra.setMatrixAt(i, m4); }
  dash.receiveShadow = zebra.receiveShadow = true;
  world.add(dash, zebra);
}

// planters with low hedges along the sides of the plaza
{
  const stone = glowMat(0x9c958a, { roughness: 0.9 });
  const hedge = glowMat(0x3f7a3c, { flatShading: true, roughness: 0.9 });
  for (const [x0, x1, z] of [[3.5, 7.5, -9.2], [3.5, 7.5, 9.4], [-4.5, 1.5, -9.4], [-4.5, 1.5, 9.6]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.5, 1.2), stone);
    b.position.set((x0 + x1) / 2, 0.25, z);
    const h = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.2, 0.5, 1.0, 4, 1, 2), hedge);
    h.position.set((x0 + x1) / 2, 0.72, z);
    const hp = h.geometry.attributes.position;
    for (let i = 0; i < hp.count; i++) if (hp.getY(i) > 0) hp.setY(i, hp.getY(i) + (hash1(hp.getX(i) * 3.1 + z) - 0.5) * 0.18);
    h.geometry.computeVertexNormals();
    world.add(shadows(b), shadows(h));
  }
}

// --- the row of buildings across the road ----------------------------------------------
const windowGlow = [];   // materials whose emissive follows the lighting preset
function facade(wM, hM, o) {
  const s = 40, W = Math.round(wM * s), H = Math.round(hM * s);
  const floors = o.floors, gf = 4.2, fh = 3.1;
  const lit = [];
  const draw = (g, emissive) => {
    g.fillStyle = emissive ? '#000' : o.wall; g.fillRect(0, 0, W, H);
    if (!emissive) {
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '40,30,20'},${rand() * 0.05})`; g.fillRect(rand() * W, rand() * H, 3, 3); }
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, H - gf * s - 6, W, 6);
    }
    // upper floors
    const n = Math.max(2, Math.floor(wM / 2.3)), gap = wM / n;
    for (let f = 0; f < floors; f++) {
      const y0 = H - (gf + f * fh) * s - 0.9 * s;
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * gap * s, ww = 1.05 * s, wh = 1.6 * s;
        const key = f * 100 + i;
        if (emissive) {
          if (lit.includes(key)) {
            const gr = g.createLinearGradient(0, y0 - wh, 0, y0);
            gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#ff9f45');
            g.fillStyle = gr; g.fillRect(cx - ww / 2, y0 - wh, ww, wh);
          }
          continue;
        }
        g.fillStyle = o.trim; g.fillRect(cx - ww / 2 - 5, y0 - wh - 5, ww + 10, wh + 12);
        const gr = g.createLinearGradient(0, y0 - wh, 0, y0);
        gr.addColorStop(0, '#39465a'); gr.addColorStop(1, '#1f2733');
        g.fillStyle = gr; g.fillRect(cx - ww / 2, y0 - wh, ww, wh);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(cx - ww / 2, y0 - wh, ww * 0.45, wh);
        g.fillStyle = o.trim; g.fillRect(cx - 2, y0 - wh, 4, wh);
        if (o.shutters) { g.fillStyle = o.shutters; g.fillRect(cx - ww / 2 - 22, y0 - wh, 16, wh); g.fillRect(cx + ww / 2 + 6, y0 - wh, 16, wh); }
        if (rand() < 0.5) lit.push(key);
      }
    }
    // shopfront on the ground floor
    const doorW = 1.2 * s, shopH = 2.7 * s, y1 = H - 0.25 * s;
    const bays = Math.max(1, Math.floor(wM / 3.4));
    for (let i = 0; i < bays; i++) {
      const bw = (wM / bays) * s, x0 = i * bw + 0.35 * s, x1 = (i + 1) * bw - 0.35 * s;
      if (emissive) {
        const gr = g.createLinearGradient(0, y1 - shopH, 0, y1);
        gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(1, '#ffae5c');
        g.fillStyle = gr; g.fillRect(x0, y1 - shopH, x1 - x0, shopH);
        continue;
      }
      g.fillStyle = '#2a2622'; g.fillRect(x0 - 6, y1 - shopH - 6, x1 - x0 + 12, shopH + 6);
      const gr = g.createLinearGradient(0, y1 - shopH, 0, y1);
      gr.addColorStop(0, '#4a4f58'); gr.addColorStop(1, '#23262c');
      g.fillStyle = gr; g.fillRect(x0, y1 - shopH, x1 - x0, shopH);
      g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x0, y1 - shopH, (x1 - x0) * 0.3, shopH);
      if (i === 0) { g.fillStyle = '#5a3a24'; g.fillRect(x1 - doorW, y1 - 2.4 * s, doorW - 8, 2.4 * s); }
    }
    if (o.sign && !emissive) {
      g.fillStyle = o.signBg; g.fillRect(W * 0.18, H - gf * s + 0.12 * s, W * 0.64, 0.75 * s);
      g.fillStyle = o.signFg; g.font = `700 ${0.46 * s}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(o.sign, W / 2, H - gf * s + 0.5 * s);
    } else if (o.sign && emissive) {
      g.fillStyle = '#ffe2b0'; g.font = `700 ${0.46 * s}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(o.sign, W / 2, H - gf * s + 0.5 * s);
    }
  };
  const map = canvasTex(W, H, (g) => draw(g, false));
  const emap = canvasTex(W, H, (g) => draw(g, true));
  return { map, emap };
}
const WALLS = ['#e9d8bd', '#d9a58a', '#b9c7b0', '#c9d3dc', '#efe6d2', '#d6b48c', '#c2a4a0', '#e2cfa8'];
function building(z0, z1, floors, o = {}) {
  const w = z1 - z0, h = 4.2 + floors * 3.1 + 0.4, x0 = 21.3, depth = 12;
  const { map, emap } = facade(w, h, { floors, wall: o.wall || WALLS[Math.floor(rand() * WALLS.length)], trim: o.trim || '#f4efe6', shutters: o.shutters, sign: o.sign, signBg: o.signBg, signFg: o.signFg });
  const front = glowMat(0xffffff, { map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85 });
  windowGlow.push(front);
  const side = glowMat(new THREE.Color(o.wall || '#d9c9ae').multiplyScalar(0.85), { roughness: 0.9 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(depth, h, w), [side, front, side, side, side, side]);
  b.position.set(x0 + depth / 2, h / 2, (z0 + z1) / 2);
  world.add(shadows(b));
  // cornice and roof
  const roofMat = glowMat(o.roof || 0x9a4f36, { flatShading: true, roughness: 0.8 });
  const cor = new THREE.Mesh(new THREE.BoxGeometry(depth + 0.5, 0.35, w + 0.3), glowMat(0xeae4d8));
  cor.position.set(x0 + depth / 2 - 0.2, h + 0.17, (z0 + z1) / 2);
  world.add(shadows(cor));
  if (o.pitched) {
    const s = new THREE.Shape([new THREE.Vector2(-depth / 2 - 0.4, 0), new THREE.Vector2(depth / 2 + 0.4, 0), new THREE.Vector2(0, 3.2)]);
    const g = new THREE.ExtrudeGeometry(s, { depth: w + 0.4, bevelEnabled: false });
    g.translate(0, 0, -(w + 0.4) / 2);
    const r = new THREE.Mesh(g, roofMat);
    r.position.set(x0 + depth / 2, h + 0.34, (z0 + z1) / 2);
    world.add(shadows(r));
  }
  // an awning over the shopfront
  if (o.awning) {
    const stripes = canvasTex(256, 64, (g, W, H) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4efe4' : o.awning; g.fillRect((i * W) / 8, 0, W / 8, H); } });
    stripes.wrapS = THREE.RepeatWrapping; stripes.repeat.set(w / 2.4, 1);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(1.7, w - 0.6), glowMat(0xffffff, { map: stripes, side: THREE.DoubleSide, roughness: 0.9 }));
    a.geometry.rotateY(Math.PI / 2).rotateX(Math.PI / 2);
    a.rotation.z = -0.42;
    a.position.set(x0 - 0.75, 3.55, (z0 + z1) / 2);
    world.add(shadows(a));
  }
  return b;
}
{
  let z = -48;
  while (z < -5.2) { const w = lerp(6.5, 10, rand()); const z1 = Math.min(z + w, -5.2); building(z, z1, 2 + Math.floor(rand() * 3), { pitched: rand() < 0.45, roof: rand() < 0.5 ? 0x9a4f36 : 0x5d6470, awning: rand() < 0.4 ? ['#2f6f73', '#b8483a', '#3c5a8a'][Math.floor(rand() * 3)] : null }); z = z1 + 0.15; }
  building(-5.05, 5.05, 2, { wall: '#efe3cc', trim: '#fffaf0', shutters: '#3f6d63', sign: 'CAFÉ · 咖啡', signBg: '#23413b', signFg: '#f6e6c8', awning: '#23413b', pitched: false });
  z = 5.2;
  while (z < 48) { const w = lerp(6.5, 10, rand()); building(z, z + w, 2 + Math.floor(rand() * 3), { pitched: rand() < 0.45, roof: rand() < 0.5 ? 0x9a4f36 : 0x5d6470, awning: rand() < 0.4 ? ['#2f6f73', '#b8483a', '#8a5a2f'][Math.floor(rand() * 3)] : null }); z += w + 0.15; }
  // a taller second row behind
  const backMat = [glowMat(0xb9b2a6, { roughness: 0.9 }), glowMat(0x9ea7b3, { roughness: 0.9 }), glowMat(0xc7b79c, { roughness: 0.9 })];
  for (let zz = -90; zz < 90; zz += 11 + rand() * 6) {
    const h = 16 + rand() * 14, w = 9 + rand() * 5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(14, h, w), backMat[Math.floor(rand() * 3)]);
    b.position.set(44 + rand() * 12, h / 2, zz);
    world.add(shadows(b));
  }
}

// --- trees -------------------------------------------------------------------------
function jitter(g, amt, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = hash1(x * 12.9 + y * 78.2 + z * 37.7 + seed);
    const s = 1 + (k - 0.5) * amt;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  return g;
}
const blob = (r, x, y, z, seed) => jitter(new THREE.IcosahedronGeometry(r, 1), 0.28, seed).translate(x, y, z);
const canopyGeo = mergeGeometries([blob(1.5, 0, 0, 0, 1), blob(1.15, 0.9, -0.35, 0.45, 2), blob(1.1, -0.85, -0.25, -0.5, 3), blob(0.95, 0.15, 0.75, -0.25, 4)]);
canopyGeo.computeVertexNormals();
const coneTree = mergeGeometries([0, 1, 2].map((k) => new THREE.ConeGeometry(1.5 - k * 0.38, 2.2 - k * 0.3, 8).toNonIndexed().translate(0, k * 1.2 + 1.1, 0)));
const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 7).translate(0, 0.5, 0);
const TREES = [];
{
  const add = (x, z, h, kind = 0) => TREES.push({ x, z, h, kind, r: rand() * 6.28 });
  for (const [x, z] of [[9.2, -7.8], [12.6, -8.6], [9.8, 8.2], [12.8, 9.0], [6.2, -10.3], [-2.5, -11.5]]) add(x, z, 5 + rand() * 2);
  for (let z = -60; z <= 60; z += 9.5) if (Math.abs(z) > 5) add(20.1, z + rand() * 1.5, 5.5 + rand() * 1.5);
  for (let i = 0; i < 70; i++) { const z = lerp(-120, 120, rand()); add(36 + rand() * 30, z, 7 + rand() * 5, rand() < 0.4 ? 1 : 0); }
  for (let i = 0; i < 40; i++) { const x = lerp(-10, 14, rand()), s = rand() < 0.5 ? -1 : 1; add(x, s * (15 + rand() * 25), 6 + rand() * 4, rand() < 0.5 ? 1 : 0); }
  const leafMat = glowMat(0xffffff, { flatShading: true, roughness: 0.88 });
  const round = TREES.filter((t) => t.kind === 0), pine = TREES.filter((t) => t.kind === 1);
  const canopies = new THREE.InstancedMesh(canopyGeo, leafMat, round.length);
  const cones = new THREE.InstancedMesh(coneTree, leafMat, pine.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, glowMat(0x6b4b35, { flatShading: true }), TREES.length);
  const greens = [0x3f7f3f, 0x4b8a45, 0x5a9446, 0x366f39, 0x6c9a42].map((c) => new THREE.Color(c));
  const pines = [0x2e5e3a, 0x376a40, 0x2a5534].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V3(0, 1, 0);
  let ri = 0, pi = 0;
  TREES.forEach((t, i) => {
    const trunkH = t.kind ? t.h * 0.25 : t.h * 0.45;
    m4.compose(V3(t.x, 0, t.z), q.setFromAxisAngle(up, t.r), V3(1 + t.h * 0.04, trunkH, 1 + t.h * 0.04));
    trunks.setMatrixAt(i, m4);
    if (t.kind === 0) {
      const s = t.h / 5.2;
      m4.compose(V3(t.x, trunkH + 1.2 * s, t.z), q.setFromAxisAngle(up, t.r), V3(s, s * 0.95, s));
      canopies.setMatrixAt(ri, m4); canopies.setColorAt(ri, greens[ri % greens.length]); ri++;
    } else {
      const s = t.h / 4.6;
      m4.compose(V3(t.x, trunkH * 0.6, t.z), q.setFromAxisAngle(up, t.r), V3(s * 0.9, s, s * 0.9));
      cones.setMatrixAt(pi, m4); cones.setColorAt(pi, pines[pi % pines.length]); pi++;
    }
  });
  world.add(shadows(canopies), shadows(cones), shadows(trunks));
}

// --- hills and mountains in the haze ---------------------------------------------------
function hill(x, z, r, h, cols, seed) {
  let g = new THREE.ConeGeometry(r, h, 9, 3, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > h / 2 - 1e-3) continue;
    const k = hash1(p.getX(i) * 0.013 + p.getZ(i) * 0.029 + seed);
    p.setXYZ(i, p.getX(i) * (0.8 + k * 0.4), y + (k - 0.5) * h * 0.12, p.getZ(i) * (0.8 + k * 0.4));
  }
  g = g.toNonIndexed();
  const pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const yy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, t = (yy + h / 2) / h;
    const col = cols[Math.min(cols.length - 1, Math.floor(t * cols.length + hash1(i + seed) * 0.6))];
    for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, glowMat(0xffffff, { vertexColors: true, flatShading: true, roughness: 0.95 }));
  m.position.set(x, h / 2 - 2, z);
  m.rotation.y = seed;
  world.add(m);
}
{
  const green = [0x4d7a44, 0x5b8a4b, 0x6e9656, 0x7f9d62].map((c) => new THREE.Color(c));
  const rock = [0x6d7a8c, 0x7b879a, 0x8b97aa, 0xdfe6ee].map((c) => new THREE.Color(c));
  for (let i = 0; i < 16; i++) hill(260 + rand() * 180, lerp(-520, 520, i / 15) + rand() * 40, 90 + rand() * 70, 40 + rand() * 50, green, i * 1.7);
  for (let i = 0; i < 9; i++) hill(820 + rand() * 260, lerp(-900, 900, i / 8), 260 + rand() * 120, 220 + rand() * 180, rock, 30 + i * 2.3);
}

// --- sky ---------------------------------------------------------------------------------
const skyU = {
  uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBelow: { value: new THREE.Color() },
  uSunDir: { value: V3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSunDisc: { value: 0 }, uGlow: { value: 0 },
  uCloudAmt: { value: 0.3 }, uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() },
  uStars: { value: 0 }, uMoonDir: { value: V3(0, 1, 0) }, uMoon: { value: 0 }, uTime: { value: 0 },
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyU,
  vertexShader: `varying vec3 vDir;
    void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; }`,
  fragmentShader: `
    uniform vec3 uZenith, uHorizon, uBelow, uSunDir, uSunCol, uCloudLit, uCloudDark, uMoonDir;
    uniform float uSunDisc, uGlow, uCloudAmt, uStars, uMoon, uTime;
    varying vec3 vDir;
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.42));
      col = mix(col, uBelow, smoothstep(0.0, -0.06, h));
      float mu = max(dot(d, uSunDir), 0.0);
      col += uSunCol * uGlow * (0.35 * pow(mu, 5.0) + 1.4 * pow(mu, 60.0));
      col += uSunCol * uSunDisc * smoothstep(0.99975, 0.99988, mu);
      if (h > 0.0) {
        vec2 uv = d.xz / (h + 0.08) * 1.3 + vec2(uTime * 0.004, 0.0);
        float n = fbm(uv * 0.7);
        float cov = smoothstep(1.0 - uCloudAmt, 1.0 - uCloudAmt + 0.3, n) * smoothstep(0.0, 0.1, h);
        float shade = smoothstep(0.35, 0.85, fbm(uv * 1.4 + 5.3));
        vec3 cl = mix(uCloudDark, uCloudLit, shade) + uSunCol * uGlow * 0.6 * pow(mu, 4.0);
        col = mix(col, cl, cov);
        vec2 sp = floor(d.xz / (h + 0.3) * 260.0);
        float st = step(0.9965, h21(sp)) * smoothstep(0.05, 0.3, h) * (1.0 - cov);
        col += vec3(0.8, 0.85, 1.0) * st * uStars * (0.4 + h21(sp + 3.0));
      }
      float mm = max(dot(d, uMoonDir), 0.0);
      col += vec3(0.85, 0.9, 1.0) * uMoon * (smoothstep(0.99955, 0.9997, mm) + 0.01 * pow(mm, 30.0));
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), skyMat);
sky.renderOrder = -1;
world.add(sky);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;

// --- lights ---------------------------------------------------------------------------------
const sun = allLayers(new THREE.DirectionalLight(0xffffff, 1));
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 260 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.02;
sun.target.position.set(9, 0, 0);
scene.add(sun, sun.target);
const hemi = allLayers(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
scene.add(hemi);
scene.fog = new THREE.FogExp2(0xffffff, 0.002);

// --- lamps, string lights, benches and café tables --------------------------------------
// Emissive strengths are in the page's exposure units: an 18 % grey card in the
// key light reads 0.18. Point lights are scaled by the exposure calibration.
const lampGlass = std(0x2a2620, { emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.3 });
const bulbMat = std(0x8c8478, { emissive: 0xffbd70, emissiveIntensity: 0, roughness: 0.4 });
const lampPoints = [];
{
  const metal = glowMat(0x1f2522, { metalness: 0.6, roughness: 0.45 });
  const postG = new THREE.CylinderGeometry(0.05, 0.07, 3, 8).translate(0, 1.5, 0);
  const baseG = new THREE.CylinderGeometry(0.14, 0.17, 0.42, 8).translate(0, 0.21, 0);
  const glassG = new THREE.CylinderGeometry(0.15, 0.11, 0.36, 6).translate(0, 3.22, 0);
  const capG = new THREE.ConeGeometry(0.21, 0.2, 6).translate(0, 3.5, 0);
  const parkLamp = (x, z, light) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(postG, metal), new THREE.Mesh(baseG, metal), new THREE.Mesh(glassG, lampGlass), new THREE.Mesh(capG, metal));
    g.position.set(x, 0.04, z);
    world.add(shadows(g));
    if (light) {
      const p = allLayers(new THREE.PointLight(0xffc27a, 0, 16, 2));
      p.position.set(x, 3.2, z);
      lampPoints.push(p); scene.add(p);
    }
  };
  parkLamp(2.1, 1.8, true);
  parkLamp(9.3, -5.7, true);
  parkLamp(9.5, 5.9, true);
  parkLamp(13.6, -9.6, false);
  parkLamp(13.6, 9.8, false);
  // street lamps with an arm over the road
  const tallG = new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8).translate(0, 2.7, 0);
  const armG = new THREE.BoxGeometry(1.4, 0.07, 0.07).translate(-0.7, 5.3, 0);
  const headG = new THREE.BoxGeometry(0.55, 0.12, 0.26).translate(-1.35, 5.22, 0);
  const lensG = new THREE.BoxGeometry(0.45, 0.02, 0.2).translate(-1.35, 5.15, 0);
  for (const z of [-26, -12.5, 13, 26.5]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(tallG, metal), new THREE.Mesh(armG, metal), new THREE.Mesh(headG, metal), new THREE.Mesh(lensG, lampGlass));
    g.position.set(19.5, 0.15, z);
    world.add(shadows(g));
    if (Math.abs(z) < 20) {
      const p = allLayers(new THREE.PointLight(0xffc27a, 0, 22, 2));
      p.position.set(18.1, 5.0, z);
      lampPoints.push(p); scene.add(p);
    }
  }
}
// string lights: little bulbs hung on sagging wires
const STRANDS = [
  { a: V3(12.4, 3.3, -7.4), b: V3(12.4, 3.3, 7.4), sag: 0.8, n: 38 },
  { a: V3(20.95, 3.95, -5.0), b: V3(20.95, 3.95, 5.0), sag: 0.3, n: 26 },
  { a: V3(12.4, 3.3, 7.4), b: V3(19.5, 4.6, 13), sag: 0.7, n: 24 },
  { a: V3(12.4, 3.3, -7.4), b: V3(19.5, 4.6, -12.5), sag: 0.7, n: 24 },
];
const BULBS = [];
{
  const wire = [];
  for (const s of STRANDS) {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40, p = s.a.clone().lerp(s.b, t); p.y -= s.sag * 4 * t * (1 - t); pts.push(p); }
    for (let i = 0; i < 40; i++) wire.push(pts[i], pts[i + 1]);
    for (let i = 1; i < s.n; i++) { const t = i / s.n, p = s.a.clone().lerp(s.b, t); p.y -= s.sag * 4 * t * (1 - t) + 0.05; BULBS.push(p); }
  }
  const wg = new THREE.BufferGeometry().setFromPoints(wire);
  world.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1b1a18 })));
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), bulbMat, BULBS.length);
  const m4 = new THREE.Matrix4();
  BULBS.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4); });
  world.add(bulbs);
  const pole = glowMat(0x2a2d31, { metalness: 0.5, roughness: 0.5 });
  for (const z of [-7.4, 7.4]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.35, 8).translate(0, 1.67, 0), pole);
    m.position.set(12.4, 0.04, z);
    world.add(shadows(m));
  }
}
{
  const wood = glowMat(0x9a6a44, { roughness: 0.8 });
  const iron = glowMat(0x25282c, { metalness: 0.6, roughness: 0.5 });
  const bench = (x, z, ry) => {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.11), wood); s.position.set(0, 0.45, -0.16 + k * 0.14); g.add(s); }
    for (let k = 0; k < 2; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.035), wood); s.position.set(0, 0.62 + k * 0.16, 0.23); s.rotation.x = -0.15; g.add(s); }
    for (const x of [-0.72, 0.72]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.46), iron); l.position.set(x, 0.225, 0.02); g.add(l); }
    g.position.set(x, 0.04, z); g.rotation.y = ry;
    world.add(shadows(g));
  };
  bench(6.8, -8.2, 0);
  bench(6.8, 8.4, Math.PI);
  bench(-1.2, -8.4, 0);
  // bollards between plaza and road
  const bollard = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.1, 0.8, 10).translate(0, 0.4, 0), iron, 12);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 12; i++) { m4.makeTranslation(13.9, 0.04, -10 + i * 1.82); bollard.setMatrixAt(i, m4); }
  world.add(shadows(bollard));
  // café tables on the far sidewalk
  const top = glowMat(0xe8e2d6, { roughness: 0.5 });
  const chairMat = glowMat(0x3e6b62, { roughness: 0.6 });
  for (const z of [-3.2, 0.2, 3.4]) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16), top); t.position.y = 0.74;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), iron); stem.position.y = 0.37;
    g.add(t, stem);
    for (const s of [-1, 1]) {
      const c = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), chairMat); seat.position.y = 0.45;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.04), chairMat); back.position.set(0, 0.68, 0.19);
      c.add(seat, back);
      for (const [a, b] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 5), iron); l.position.set(a, 0.225, b); c.add(l); }
      c.position.z = s * 0.52; c.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(c);
    }
    g.position.set(20.1, 0.15, z);
    world.add(shadows(g));
  }
}

// ---------------------------------------------------------------------------
// Lighting presets. `ev` is the incident-light exposure at the subject (what a
// hand-held meter held at the model's face would read, ISO 100) and `lightK`
// the colour temperature of the key light. Everything else sets the mood.
// Directions: az 0° = sun behind the camera, +90° = from the right.
// ---------------------------------------------------------------------------
const PRESETS = {
  sunny: {
    name: '晴天', ev: 15, lightK: 5600, world: 1.0, bloom: [0.32, 0.92],
    sun: { az: 38, el: 50, i: 3.0 }, hemi: { i: 1.0, sky: [0.55, 0.7, 1.0], ground: [0.5, 0.45, 0.35] }, env: 0.35,
    fog: [0.55, 0.66, 0.82, 0.0014],
    sky: { zenith: [0.07, 0.17, 0.45], horizon: [0.42, 0.55, 0.72], below: [0.32, 0.34, 0.3], glow: 0.3, disc: 50, cloud: 0.36, lit: [1.05, 1.05, 1.08], dark: [0.52, 0.58, 0.68], stars: 0, moon: 0 },
    lamps: 0, windows: 0, bulbs: 0, points: 0,
  },
  cloudy: {
    name: '阴天', ev: 12, lightK: 6500, world: 1.0, bloom: [0.3, 0.92],
    sun: { az: 25, el: 60, i: 0.28 }, hemi: { i: 2.6, sky: [0.9, 0.95, 1.0], ground: [0.45, 0.45, 0.42] }, env: 0.5,
    fog: [0.5, 0.52, 0.55, 0.0035],
    sky: { zenith: [0.46, 0.49, 0.54], horizon: [0.62, 0.64, 0.66], below: [0.35, 0.36, 0.36], glow: 0.05, disc: 0, cloud: 0.98, lit: [0.66, 0.67, 0.69], dark: [0.4, 0.42, 0.46], stars: 0, moon: 0 },
    lamps: 0, windows: 0.06, bulbs: 0, points: 0,
  },
  golden: {
    name: '黄昏', ev: 11, lightK: 3400, world: 0.95, bloom: [0.3, 1.4],
    sun: { az: -66, el: 8, i: 2.6 }, hemi: { i: 0.6, sky: [0.45, 0.55, 0.9], ground: [0.55, 0.4, 0.28] }, env: 0.3,
    fog: [0.78, 0.55, 0.42, 0.0019],
    sky: { zenith: [0.07, 0.11, 0.3], horizon: [0.95, 0.6, 0.36], below: [0.3, 0.22, 0.2], glow: 1.1, disc: 30, cloud: 0.42, lit: [1.1, 0.66, 0.46], dark: [0.36, 0.28, 0.38], stars: 0, moon: 0 },
    lamps: 4, windows: 0.3, bulbs: 14, points: 0.25,
  },
  night: {
    name: '夜晚', ev: 3.5, lightK: 3000, world: 0.42, bloom: [0.2, 8], moonK: 8200,
    sun: { az: 150, el: 36, i: 0.12 }, hemi: { i: 0.1, sky: [0.35, 0.45, 0.9], ground: [0.25, 0.22, 0.2] }, env: 0.15,
    fog: [0.02, 0.025, 0.045, 0.004],
    sky: { zenith: [0.003, 0.006, 0.018], horizon: [0.03, 0.028, 0.04], below: [0.01, 0.01, 0.012], glow: 0, disc: 0, cloud: 0.3, lit: [0.028, 0.028, 0.036], dark: [0.008, 0.009, 0.013], stars: 0.55, moon: 6 },
    lamps: 90, windows: 1.3, bulbs: 150, points: 1,
  },
};
const lightNominal = { sun: 1, hemi: 1, env: 0.3, points: 0 };
let lightScale = 1, lightVersion = 0;
function setLightScale(k) {
  lightScale = k;
  sun.intensity = lightNominal.sun * k;
  hemi.intensity = lightNominal.hemi * k;
  scene.environmentIntensity = lightNominal.env * k;
  for (const p of lampPoints) p.intensity = lightNominal.points * k;
}
const sunDirOf = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return V3(-Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); };
const lin = (a) => new THREE.Color(a[0], a[1], a[2]);
// apply a preset's look; the key light colour comes from state.lightK
function applyLighting() {
  lightVersion++;
  const p = PRESETS[state.preset];
  const night = state.preset === 'night';
  const dir = sunDirOf(p.sun.az, p.sun.el);
  sun.position.copy(sun.target.position).addScaledVector(dir, 150);
  sun.color.copy(kelvinColor(night ? p.moonK : state.lightK));
  sun.shadow.radius = state.preset === 'cloudy' ? 8 : 2;
  lightNominal.sun = p.sun.i;
  hemi.color.copy(lin(p.hemi.sky)); hemi.groundColor.copy(lin(p.hemi.ground));
  lightNominal.hemi = p.hemi.i;
  lightNominal.env = p.env;
  const lampC = kelvinColor(night ? state.lightK : 2900);
  lightNominal.points = p.points * 14;
  for (const l of lampPoints) { l.color.copy(lampC); l.visible = p.points > 0; }
  lampGlass.emissive.copy(lampC); lampGlass.emissiveIntensity = p.lamps;
  bulbMat.emissive.copy(kelvinColor(2400)); bulbMat.emissiveIntensity = p.bulbs;
  for (const m of windowGlow) { m.emissive.copy(kelvinColor(2900)); m.emissiveIntensity = p.windows; }
  // headlights and tail-lights come on after sunset
  for (const c of cars) { c.head.emissiveIntensity = night ? 60 : state.preset === 'golden' ? 6 : 0; c.tail.emissiveIntensity = night ? 14 : state.preset === 'golden' ? 2 : 0; }
  scene.fog.color.setRGB(p.fog[0], p.fog[1], p.fog[2]);
  scene.fog.density = p.fog[3];
  const s = p.sky;
  skyU.uZenith.value.copy(lin(s.zenith)); skyU.uHorizon.value.copy(lin(s.horizon)); skyU.uBelow.value.copy(lin(s.below));
  skyU.uSunDir.value.copy(dir); skyU.uSunCol.value.copy(kelvinColor(night ? p.moonK : state.lightK));
  skyU.uGlow.value = s.glow; skyU.uSunDisc.value = s.disc; skyU.uCloudAmt.value = s.cloud;
  skyU.uCloudLit.value.copy(lin(s.lit)); skyU.uCloudDark.value.copy(lin(s.dark));
  skyU.uStars.value = s.stars; skyU.uMoon.value = s.moon; skyU.uMoonDir.value.copy(sunDirOf(p.sun.az, p.sun.el));
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  setLightScale(lightScale);
}
bakeStatic(world, [sky]);
toPhoto(world);
