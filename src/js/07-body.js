
// ---------------------------------------------------------------------------
// The camera body: a 2.5x mirrorless shell sliding on the rail. Body-local x
// is measured from the sensor plane; the group only ever translates in x —
// every child is built at its real world y / z. Top dials are turned by the
// controls module (rotation.y = p*span); this file only builds them.
//
// Front is +x (the mount), the photographer's right is +z (the grip), and
// that is the side the viewer usually sees. Satin-painted magnesium, a
// pebbled leatherette grip, brushed-steel fittings. Taken apart, a window
// opens in that side (bodyCutPlanes) onto the shutter, the stabilised sensor
// and the boards behind it.
// ---------------------------------------------------------------------------
const camBody = new THREE.Group();
scene.add(camBody);

const bodyDials = {};
const bodyButtons = {};
const bodyLcd = new THREE.Mesh(new THREE.PlaneGeometry(18.75, 12.5), new THREE.MeshBasicMaterial({ color: 0x05070a }));
const bodySensor = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ color: 0x11151c }));
const bodyCutPlanes = [];

let triggerShutter, shutterBusy, bodyAnchor, updateBody;

{
  // ---- layout --------------------------------------------------------------
  const DIAL_Y = 26;                    // shell top plate, where every dial sits
  const PHI_MARK = -Math.PI / 2 - 0.3;  // index-mark / psi0 angle for every top dial
  const OW = 9.6, OH = 6.6;             // shutter opening
  const SHUT_X = 1.3;
  const X0 = -14.5, X1 = 4.5;           // back and front (mount) faces of the shell
  const Z0 = -15.5, Z1 = 16.5;          // left and right (grip) sides
  const Y0 = 3.5;                       // underside, on the carriage
  const RAD = 1.5;                      // edge radius of the shell
  const BTN = { x: 7.2, y: 24.9, z: 14.2 };   // shutter release, on top of the grip
  const MODE_Z = 9.35;

  // the cut-away window: the grip side, between the sensor's back and the mount
  const bcY1 = new THREE.Plane(new THREE.Vector3(0, -1, 0), 5);      // clips y > 5
  const bcY2 = new THREE.Plane(new THREE.Vector3(0, 1, 0), -23);     // clips y < 23
  const bcX1 = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);      // clips x > world(sensor - 9)
  const bcX2 = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);       // clips x < world(mount), just short of the front face
  bodyCutPlanes.push(cutPlane, bcY1, bcY2, bcX1, bcX2);

  // ---- surface finishes ------------------------------------------------------
  // All procedural, drawn once. A local generator leaves the shared rand()
  // sequence (the valley, the bench) as it was.
  let seed = 0x2f6b1a;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function dataTex(n, fill) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n);
    fill(img.data);
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  const gray = (d, i, v) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = clamp(v, 0, 1) * 255; d[i * 4 + 3] = 255; };

  // Leatherette: a cellular grain (Worley F2 − F1), every cell a small pebble
  // with a crease round it, tiling seamlessly. The height becomes a normal
  // map; the creases are rougher than the pebble tops.
  const PEB = 512, CELLS = 46;
  const pebH = (() => {
    const cs = PEB / CELLS, px = new Float32Array(CELLS * CELLS), py = new Float32Array(CELLS * CELLS);
    for (let k = 0; k < CELLS * CELLS; k++) {
      px[k] = ((k % CELLS) + 0.15 + 0.7 * rnd()) * cs;
      py[k] = (Math.floor(k / CELLS) + 0.15 + 0.7 * rnd()) * cs;
    }
    const h = new Float32Array(PEB * PEB);
    for (let y = 0; y < PEB; y++) for (let x = 0; x < PEB; x++) {
      const ci = Math.floor(x / cs), cj = Math.floor(y / cs);
      let f1 = 1e9, f2 = 1e9;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = (ci + di + CELLS) % CELLS, j = (cj + dj + CELLS) % CELLS, k = j * CELLS + i;
        const dx = px[k] + (ci + di - i) * cs - x, dy = py[k] + (cj + dj - j) * cs - y, d = dx * dx + dy * dy;
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      const e = (Math.sqrt(f2) - Math.sqrt(f1)) / cs;
      h[y * PEB + x] = smooth(Math.min(1, e * 2.4)) * (1 - (0.3 * Math.sqrt(f1)) / cs) + 0.05 * rnd();
    }
    return h;
  })();
  const pebNormal = dataTex(PEB, (d) => {
    const H = (x, y) => pebH[((y + PEB) % PEB) * PEB + ((x + PEB) % PEB)];
    for (let y = 0; y < PEB; y++) for (let x = 0; x < PEB; x++) {
      // canvas rows run down, texture v runs up
      const sx = (H(x + 1, y) - H(x - 1, y)) * 2.2, sy = (H(x, y + 1) - H(x, y - 1)) * 2.2;
      const l = Math.hypot(sx, sy, 1), o = (y * PEB + x) * 4;
      d[o] = (-sx / l * 0.5 + 0.5) * 255; d[o + 1] = (sy / l * 0.5 + 0.5) * 255; d[o + 2] = (0.5 / l + 0.5) * 255; d[o + 3] = 255;
    }
  });
  const pebRough = dataTex(PEB, (d) => { for (let i = 0; i < PEB * PEB; i++) gray(d, i, 0.95 - 0.32 * pebH[i]); });
  for (const t of [pebNormal, pebRough]) t.repeat.set(0.13, 0.13);   // one tile ≈ 7.7 cm: pebbles ≈ 1.7 mm (0.7 mm on a real camera)

  // Paint: a fine, tileable grain in the roughness, so reflections break up a little
  const grain = dataTex(256, (d) => {
    const oct = (G) => { const v = Float32Array.from({ length: G * G }, rnd); return (x, y) => {
      const fx = x * G, fy = y * G, i = Math.floor(fx), j = Math.floor(fy), u = smooth(fx - i), w = smooth(fy - j);
      const at = (a, b) => v[(b % G) * G + (a % G)];
      return lerp(lerp(at(i, j), at(i + 1, j), u), lerp(at(i, j + 1), at(i + 1, j + 1), u), w);
    }; };
    const lo = oct(32), hi = oct(128);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) gray(d, y * 256 + x, 0.4 + 0.05 * lo(x / 256, y / 256) + 0.07 * hi(x / 256, y / 256) + 0.05 * rnd());
  });
  // Brushed metal: streaks along u
  const brushed = dataTex(256, (d) => {
    const row = Float32Array.from({ length: 256 }, rnd);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) gray(d, y * 256 + x, 0.2 + 0.2 * row[y] + 0.06 * rnd());
  });
  // solder mask with traces and pads, for the boards inside
  const pcbTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#10261a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(104,160,98,.5)'; g.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      let x = Math.floor(rnd() * 32) * 8, y = Math.floor(rnd() * 32) * 8;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        const s = (rnd() < 0.5 ? -8 : 8) * (1 + Math.floor(rnd() * 5));
        if (rnd() < 0.5) x += s; else y += s;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = '#c9a24a';
    for (let i = 0; i < 90; i++) g.fillRect(Math.floor(rnd() * 64) * 4, Math.floor(rnd() * 64) * 4, 3, 3);
  });
  pcbTex.wrapS = pcbTex.wrapT = THREE.RepeatWrapping;
  pcbTex.repeat.set(0.25, 0.25);
  // the hot shoe's contact block
  const shoeTex = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#0c0d10'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d4ac52';
    for (let i = 0; i < 5; i++) g.fillRect(17 + i * 20, 20, 9, 24);
  });

  // satin paint over magnesium; RoundedBox faces are mapped 0 … 1, extrusions in cm
  const paint = (rep) => {
    const t = grain.clone();
    t.repeat.set(rep, rep);
    return new THREE.MeshPhysicalMaterial({ color: 0x17181c, metalness: 0.3, roughness: 1, roughnessMap: t, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  };
  const paintBox = paint(2), paintExt = paint(1 / 8);
  const shellMat = cuttable(paintBox, bodyCutPlanes);
  const leather = std(0x0e0f12, { roughness: 1, roughnessMap: pebRough, normalMap: pebNormal, normalScale: new THREE.Vector2(0.9, 0.9) });
  // the grip's back half runs inside the shell: taken apart, all of that goes, top to bottom
  const leatherCut = cuttable(leather, [cutPlane, bcX2]);
  const rubber = std(0x0c0c0e, { roughness: 0.93 });
  const seamMat = std(0x040405, { roughness: 1 });
  const steel = std(0xb9bfc8, { metalness: 1, roughness: 1, roughnessMap: brushed });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06 });
  const darkMetal = std(0x1b1d22, { roughness: 0.5, metalness: 0.6 });
  const dialTopMat = std(0x0e0f13, { roughness: 0.5, metalness: 0.4 });
  const goldMat = std(0xc9a24a, { metalness: 0.9, roughness: 0.35 });
  const bladeMat = std(0x0a0b0d, { roughness: 0.6, metalness: 0.5 });
  const recMat = std(0xb3261e, { roughness: 0.35, metalness: 0.1 });
  const lampMat = std(0x3d1a06, { roughness: 0.16, emissive: 0x2a0e02 });
  // inside the shell: bare machined magnesium, boards and parts
  const alloy = std(0x8c939d, { metalness: 0.85, roughness: 0.38 });
  const linerMat = cuttable(std(0x3f444c, { metalness: 0.75, roughness: 0.48 }), bodyCutPlanes);
  linerMat.side = THREE.BackSide;
  const throatMat = cuttable(std(0x0b0c0e, { roughness: 0.85 }), bodyCutPlanes);
  const pcbMat = std(0xffffff, { map: pcbTex, roughness: 0.55, metalness: 0.1 });
  const chipMat = std(0x141518, { roughness: 0.45, metalness: 0.2 });
  const nickel = std(0xc2c7ce, { metalness: 1, roughness: 0.28 });
  const flexMat = std(0xc47a22, { roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide });
  const connMat = std(0xd8cfb8, { roughness: 0.6 });
  const shoeMat = std(0xffffff, { map: shoeTex, roughness: 0.5, metalness: 0.3 });

  // ---- shaping helpers ---------------------------------------------------------
  // a rounded rectangle [a0, a1] × [b0, b1] in shape coordinates
  function rrect(a0, b0, a1, b1, r) {
    const s = new THREE.Shape();
    s.moveTo(a0 + r, b0);
    s.lineTo(a1 - r, b0); s.absarc(a1 - r, b0 + r, r, -Math.PI / 2, 0, false);
    s.lineTo(a1, b1 - r); s.absarc(a1 - r, b1 - r, r, 0, Math.PI / 2, false);
    s.lineTo(a0 + r, b1); s.absarc(a0 + r, b1 - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(a0, b0 + r); s.absarc(a0 + r, b0 + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  // a shape extruded 0 … t along its own z, its edges rounded by `bev`
  function slab(shape, t, bev = 0, seg = 12) {
    const b = Math.min(bev, t / 2 - 1e-3);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(t - 2 * Math.max(b, 0), 1e-3), curveSegments: seg,
      bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: b > 0.3 ? 3 : 2,
    });
    return b > 0 ? g.translate(0, 0, b) : g;
  }
  // …stood on the body: shape (z, y) spanning x0 … x0 + t; shape (x, z)
  // spanning y0 … y0 + t; shape (x, y) spanning z0 … z0 + t
  const slabX = (s, x0, t, bev, seg) => slab(s, t, bev, seg).rotateY(-Math.PI / 2).translate(x0 + t, 0, 0);
  const slabY = (s, y0, t, bev, seg) => slab(s, t, bev, seg).rotateX(Math.PI / 2).translate(0, y0 + t, 0);
  const slabZ = (s, z0, t, bev, seg) => slab(s, t, bev, seg).translate(0, 0, z0);
  // a button or knob standing out of a face, axis along x
  const stubX = (r, h, x0, y, z) => alongX(new THREE.CylinderGeometry(r, r, Math.abs(h), 28)).translate(x0 + h / 2, y, z);

  // everything that never moves goes in here and is merged by material at the end
  const deco = new THREE.Group();
  camBody.add(deco);
  const put = (geo, mat) => { const m = new THREE.Mesh(geo, mat); deco.add(m); return m; };

  // a flat glyph laid on the top plate, facing +y (readable from above)
  function topGlyph(text, x, z, h, o = {}) {
    const m = labelPlane(text, h, { color: '#eef2f8', ...o });
    m.rotateX(-Math.PI / 2);
    m.position.set(x, DIAL_Y + 0.1, z);
    camBody.add(m);
    return m;
  }
  // a small printed word on the back plate, facing −x
  function backGlyph(text, y, z, h) {
    const m = labelPlane(text, h, { font: FONT, weight: 700, color: '#c9d0da' });
    m.rotation.y = -Math.PI / 2;
    m.position.set(X0 - 0.01, y, z);
    camBody.add(m);
    return m;
  }

  // =========================================================================
  // shell, the seam under the top plate, EVF hump
  // =========================================================================
  const boxCentre = [(X0 + X1) / 2, (Y0 + DIAL_Y) / 2, (Z0 + Z1) / 2];
  put(new RoundedBoxGeometry(X1 - X0, DIAL_Y - Y0, Z1 - Z0, 6, RAD).translate(...boxCentre), shellMat);
  // the inside face of the walls, seen through the cut-away
  const liner = put(new RoundedBoxGeometry(X1 - X0 - 0.8, DIAL_Y - Y0 - 0.8, Z1 - Z0 - 0.8, 4, RAD - 0.4).translate(...boxCentre), linerMat);
  {
    const o = rrect(X0 - 0.04, Z0 - 0.04, X1 + 0.04, Z1 + 0.04, RAD + 0.04);
    o.holes.push(rrect(X0 + 0.06, Z0 + 0.06, X1 - 0.06, Z1 - 0.06, RAD - 0.06));
    put(slabY(o, 23.7, 0.14, 0, 6), seamMat);
  }
  {
    // side profile: a sloped front carrying the name, rounded into the top
    const s = new THREE.Shape();
    s.moveTo(X0, 24.6);
    s.lineTo(1.6, 24.6);
    s.lineTo(1.6, 26.0);
    s.lineTo(-1.62, 30.02);
    s.quadraticCurveTo(-2.4, 31.0, -3.6, 31.0);
    s.lineTo(X0 + 0.9, 31.0);
    s.quadraticCurveTo(X0, 31.0, X0, 30.1);
    s.lineTo(X0, 24.6);
    put(slabZ(s, -6.5, 13, 0.8), paintExt);
    const n = V3(0.781, 0.625, 0);
    const name = labelPlane('BENCH Ⅰ', 0.95, { font: FONT, weight: 700, color: '#e9edf3', gain: 1.5 });
    name.position.set(0, 28.0, 0).addScaledVector(n, 0.03);
    name.lookAt(name.position.clone().add(n));
    camBody.add(name);
  }

  // =========================================================================
  // grip: seen from above a rounded D, wrapped in leatherette. Its back half
  // runs into the shell so the top meets the front at full height.
  // =========================================================================
  {
    const s = new THREE.Shape();              // shape (x, z)
    s.moveTo(3.0, 9.6);
    s.lineTo(3.0, 16.9);
    s.bezierCurveTo(6.9, 17.7, 10.3, 17.4, 10.5, 15.1);
    s.quadraticCurveTo(10.95, 13.5, 10.7, 11.9);
    s.bezierCurveTo(10.4, 10.2, 6.6, 9.4, 3.0, 9.6);
    put(slabY(s, 3.9, 20.85, 1.3), leatherCut);
  }
  // leatherette on the other side of the mount, curving round it
  {
    const RC = 7.5, ZI = -5.0, dy = Math.sqrt(RC * RC - ZI * ZI);
    const s = new THREE.Shape();              // shape (z, y)
    s.moveTo(-13.9, 5.8);
    s.quadraticCurveTo(-13.9, 5.1, -13.2, 5.1);
    s.lineTo(ZI - 0.6, 5.1);
    s.quadraticCurveTo(ZI, 5.1, ZI, 5.7);
    s.lineTo(ZI, AXIS_Y - dy);
    s.absarc(0, AXIS_Y, RC, Math.atan2(-dy, ZI), Math.atan2(dy, ZI), true);
    s.lineTo(ZI, 22.0);
    s.quadraticCurveTo(ZI, 22.6, ZI - 0.6, 22.6);
    s.lineTo(-13.2, 22.6);
    s.quadraticCurveTo(-13.9, 22.6, -13.9, 21.9);
    s.lineTo(-13.9, 5.8);
    put(slabX(s, X1, 0.28, 0.1), leather);
  }

  // =========================================================================
  // lens mount: brushed flange with four screws and bayonet tabs, a dark
  // throat into the body, the alignment dot; release button, AF lamp
  // =========================================================================
  put(tube(4.45, 4.85, 6.6, 5.4, steel).geometry, steel).position.y = AXIS_Y;
  put(tube(2.3, 4.45, 5.45, 5.2, throatMat).geometry, throatMat).position.y = AXIS_Y;
  for (let k = 0; k < 3; k++) {
    const pts = [[4.95, 4.1], [5.42, 4.1], [5.42, 4.45], [4.95, 4.45], [4.95, 4.1]].map(([r, x]) => new THREE.Vector2(r, x));
    put(alongX(new THREE.LatheGeometry(pts, 12, 0.35 + (k * Math.PI * 2) / 3, 0.95)), steel).position.y = AXIS_Y;
  }
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    put(stubX(0.2, 0.1, 4.85, AXIS_Y + 6.3 * Math.sin(a), 6.3 * Math.cos(a)), darkMetal);
  }
  put(new THREE.CircleGeometry(0.28, 20).rotateY(Math.PI / 2).translate(X1 + 0.012, AXIS_Y + 6.95, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.1, 1.1) }));
  put(stubX(1.08, 0.26, 4.78, 12.0, -9.2), steel);
  put(stubX(0.82, 0.46, 4.78, 12.0, -9.2), darkMetal);
  put(stubX(0.64, 0.1, X1, 21.3, 8.3), steel);
  put(stubX(0.5, 0.15, X1, 21.3, 8.3), lampMat);

  // =========================================================================
  // top dials
  // =========================================================================
  function knurl(h, r, teeth, depth, mat) {
    const g = gear(0, h, r, teeth, depth, mat);
    g.geometry.rotateZ(Math.PI / 2);           // gear()'s extrude axis (x) -> y, so it spins about local y
    return g;
  }
  function topDial(key, x, z, r, entries, span, h = 1.8) {
    const rot = new THREE.Group();
    rot.position.set(x, DIAL_Y, z);
    camBody.add(rot);
    const rim = knurl(h, r, Math.round(r * 9), 0.22, darkMetal);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.15, r - 0.15, 0.3, 40), dialTopMat);
    cap.position.y = h;
    // a bright, diamond-cut edge round the cap
    const edge = new THREE.Mesh(new THREE.TorusGeometry(r - 0.17, 0.045, 6, 72).rotateX(Math.PI / 2), chromeMat);
    edge.position.y = h + 0.15;
    const sc = arcLabels(entries, { r: r - 0.35, psi0: PHI_MARK, span, radial: 'in', h: entries[0].h || 0.85 });
    sc.rotateX(-Math.PI / 2);
    sc.position.y = h + 0.15;
    rot.add(rim, cap, edge, sc);
    shadows(rot);
    // fixed white index mark, just outside the rim, on the static top plate
    const ix = x + Math.cos(PHI_MARK) * (r + 0.35), iz = z - Math.sin(PHI_MARK) * (r + 0.35);
    topGlyph('▮', ix, iz, 0.55, { color: '#ffffff', gain: 2.0 });
    bodyDials[key] = { rot, pick: [rim, cap], r };
    return rot;
  }

  const T_ENT = FULL_T.map((v) => ({ p: stopIndex(v, T_STOPS) / 19, text: String(v) }));
  topDial('shutter', -4.5, 10.5, 3.4, T_ENT, 4.4);
  topGlyph('SHUTTER', -4.5 - 3.4 - 1.4, 10.5, 0.6);

  const ISO_ENT = FULL_ISO.map((v) => ({ p: stopIndex(v, ISO_STOPS) / 24, text: String(v), h: v >= 10000 ? 0.68 : 0.85 }));
  topDial('iso', -4.5, -10.5, 3.4, ISO_ENT, 4.4);
  topGlyph('ISO', -4.5 - 3.4 - 1.4, -10.5, 0.6);

  const WB_ENT = [3000, 4000, 5000, 6000, 7000, 8000].map((k) => ({ p: (k - 2800) / 5200, text: Math.round(k / 1000) + 'k', color: '#' + kelvinColor(k).getHexString() }));
  topDial('wb', -10.5, -13.8, 2.6, WB_ENT, 3.6);
  topGlyph('WB', -10.5 - 2.6 - 1.3, -13.8, 0.6);

  const COMP_ENT = [-3, -2, -1, 0, 1, 2, 3].map((c) => ({ p: (c + 3) / 6, text: c === 0 ? '0' : (c > 0 ? '+' : '−') + Math.abs(c), color: c === 0 ? '#ffffff' : '#9aa3b4' }));
  topDial('comp', -10.5, 14.8, 2.6, COMP_ENT, 3.2);
  topGlyph('±EV', -10.5 - 2.6 - 1.3, 14.8, 0.6);

  const MODE_ENT = [{ p: 0, text: 'M' }, { p: 0.5, text: 'A' }, { p: 1, text: 'S' }].map((e) => ({ ...e, h: 1.05 }));
  topDial('mode', -10.5, MODE_Z, 2.2, MODE_ENT, 1.6);
  topGlyph('MODE', -10.5 - 2.2 - 1.3, MODE_Z, 0.6);

  // movie record button; front and rear command wheels
  put(new THREE.CylinderGeometry(0.74, 0.78, 0.22, 28).translate(1.5, DIAL_Y + 0.11, 12.6), steel);
  put(new THREE.CylinderGeometry(0.55, 0.55, 0.36, 28).translate(1.5, DIAL_Y + 0.22, 12.6), recMat);
  for (const [x, y, z] of [[9.55, 23.45, 13.9], [-13.9, 25.05, 12.4]]) {
    const w = knurl(0.7, 1.55, 20, 0.13, darkMetal);
    w.position.set(x, y, z);
    deco.add(w);
  }

  // hot shoe on the hump: brushed rails over a contact block
  {
    const sx = -8.4, sy = 31.0;
    put(new THREE.BoxGeometry(6.0, 0.2, 5.8).translate(sx, sy + 0.1, 0), steel);
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(6.0, 0.42, 0.45).translate(sx, sy + 0.41, s * 2.62), steel);
      put(new THREE.BoxGeometry(6.0, 0.12, 0.9).translate(sx, sy + 0.68, s * 2.4), steel);
    }
    put(new THREE.PlaneGeometry(4.6, 3.3).rotateX(-Math.PI / 2).translate(sx + 0.2, sy + 0.215, 0), shoeMat);
  }

  // =========================================================================
  // shutter release button, in a power-switch collar on the grip
  // =========================================================================
  {
    const g = new THREE.Group();
    g.position.set(BTN.x, BTN.y, BTN.z);
    camBody.add(g);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.35, 32), chromeMat);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.5, 32), std(0xb0342a, { roughness: 0.4, metalness: 0.2 }));
    cap.position.y = 0.15;
    g.add(ring, cap);
    shadows(g);
    bodyButtons.shutter = { g, pick: [cap, ring] };
    const collar = [[1.42, 0], [1.95, 0], [1.95, 0.26], [1.42, 0.26], [1.42, 0]].map(([r, y]) => new THREE.Vector2(r, y));
    put(new THREE.LatheGeometry(collar, 40).translate(BTN.x, 24.72, BTN.z), darkMetal);
    put(new THREE.BoxGeometry(1.3, 0.24, 0.7).translate(BTN.x + 1.75, 24.84, BTN.z - 0.9), darkMetal);
  }

  // =========================================================================
  // the back: EVF eyecup, the screen in a glossy frame, the thumb's controls
  // =========================================================================
  {
    const o = rrect(-4.4, 25.9, 4.4, 31.3, 1.3);
    o.holes.push(rrect(-2.9, 26.9, 2.9, 30.3, 0.7));
    put(slabX(o, X0 - 1.7, 1.7, 0.4, 6), rubber);
    put(new THREE.PlaneGeometry(5.9, 3.5).rotateY(-Math.PI / 2).translate(X0 - 0.5, 28.6, 0), gloss);
    put(new THREE.CylinderGeometry(0.8, 0.8, 0.45, 24).rotateX(Math.PI / 2).translate(-12.9, 29.6, 6.72), darkMetal);   // dioptre wheel
  }
  put(slabX(rrect(-11.9, 7.7, 7.9, 21.3, 0.7), X0 - 0.25, 0.25, 0.08, 5), gloss);
  bodyLcd.rotation.y = -Math.PI / 2;
  bodyLcd.position.set(X0 - 0.27, 14.5, -2);
  camBody.add(bodyLcd);
  put(slabX(rrect(9.0, 18.0, 15.0, 24.2, 1.0), X0 - 0.35, 0.35, 0.12, 6), leather);   // thumb rest
  put(stubX(0.72, -0.36, X0, 22.9, 7.6), darkMetal);        // AF-ON
  backGlyph('AF-ON', 21.75, 7.6, 0.4);
  put(stubX(0.95, -0.16, X0, 16.9, 12.0), darkMetal);       // joystick
  put(stubX(0.55, -0.62, X0, 16.9, 12.0), rubber);
  {
    const w = gear(X0 - 0.36, X0, 1.95, 44, 0.14, darkMetal);   // control wheel and its centre button
    w.position.set(0, 11.2, 12.0);
    deco.add(w);
  }
  put(stubX(0.8, -0.28, X0, 11.2, 12.0), darkMetal);
  put(stubX(0.6, -0.3, X0, 6.6, 9.6), darkMetal);           // MENU, play
  put(stubX(0.6, -0.3, X0, 6.6, 13.4), darkMetal);
  backGlyph('MENU', 5.55, 9.6, 0.34);
  backGlyph('▶', 5.55, 13.4, 0.34);

  // =========================================================================
  // flanks: card door on the grip side, rubber port covers opposite, lugs
  // =========================================================================
  put(slabZ(rrect(-12.6, 6.4, -9.4, 18.6, 0.6), Z1, 0.12, 0.05, 5), paintExt);
  for (const [b0, b1] of [[12.3, 20.6], [5.6, 11.7]]) put(slabZ(rrect(-12.4, b0, -6.4, b1, 0.8), Z0 - 0.22, 0.22, 0.08, 5), rubber);
  for (const s of [-1, 1]) {
    const zs = s > 0 ? Z1 : Z0;
    put(new RoundedBoxGeometry(1.9, 1.3, 0.9, 2, 0.3).translate(-3.2, 23.9, zs + s * 0.3), paintBox);
    put(new THREE.TorusGeometry(0.62, 0.16, 10, 28).rotateY(Math.PI / 2).translate(-3.2, 23.9, zs + s * 0.95), steel);
  }

  // =========================================================================
  // sensor (+ its stabilised stage, heat sink and flex) and the main board
  // =========================================================================
  bodySensor.rotation.y = Math.PI / 2;
  bodySensor.position.set(0.02, AXIS_Y, 0);
  const sensorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.2, 10.2), goldMat);
  sensorFrame.position.set(-0.3, AXIS_Y, 0);
  const sensorPcb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.4, 11.4), pcbMat);
  sensorPcb.position.set(-0.85, AXIS_Y, 0);
  camBody.add(bodySensor, sensorFrame, sensorPcb);
  {
    const s = rrect(-7.3, AXIS_Y - 5.6, 7.3, AXIS_Y + 5.6, 0.7);
    s.holes.push(rrect(-6.0, AXIS_Y - 4.5, 6.0, AXIS_Y + 4.5, 0.4));
    put(slabX(s, -1.75, 0.5, 0.08, 5), alloy);                      // the floating stage's frame
    for (const [y, z] of [[5, 6.65], [5, -6.65], [-5, 6.65], [-5, -6.65]]) put(new THREE.BoxGeometry(0.5, 1.1, 1.1).translate(-1.05, AXIS_Y + y, z), nickel);
    for (const z of [6.65, -6.65]) put(new THREE.TorusGeometry(0.75, 0.22, 10, 24).rotateY(Math.PI / 2).translate(-1.1, AXIS_Y, z), copperMat);
    put(new THREE.BoxGeometry(0.3, 7.8, 10.6).translate(-2.1, AXIS_Y, 0), alloy);   // heat sink and fins
    for (let k = 0; k < 7; k++) put(new THREE.BoxGeometry(1.6, 7.4, 0.16).translate(-3.05, AXIS_Y, -4.8 + k * 1.6), alloy);
    // flex cable from the sensor board down to the main board
    const c = new THREE.CatmullRomCurve3([V3(-0.85, AXIS_Y - 4.1, 0), V3(-0.9, 9.4, 0), V3(-1.9, 6.6, 0), V3(-4.0, 5.5, 0), V3(-5.95, 6.4, 0)]);
    const P = c.getPoints(24), pos = [], uv = [], idx = [];
    P.forEach((p, i) => { pos.push(p.x, p.y, -1.5, p.x, p.y, 1.5); uv.push(i / 24, 0, i / 24, 1); });
    for (let i = 0; i < 24; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fg.setIndex(idx);
    fg.computeVertexNormals();
    put(fg, flexMat);
    // main board, parts facing the sensor
    put(new THREE.BoxGeometry(0.28, 15.6, 24).translate(-6.45, 13.4, -0.5), pcbMat);
    const part = (y, z, h, w, t = 0.34, mat = chipMat) => put(new THREE.BoxGeometry(t, h, w).translate(-6.31 + t / 2, y, z), mat);
    part(15.8, -3.0, 3.6, 3.6, 0.4);                             // image processor under a heat spreader
    part(15.8, -3.0, 2.8, 2.8, 0.5, alloy);
    part(10.6, -6.2, 2.0, 2.8); part(10.6, -2.6, 2.0, 2.8);      // memory
    part(18.8, 5.8, 1.6, 1.6); part(12.8, 6.4, 1.2, 2.2);
    part(6.4, 0, 0.9, 3.8, 0.5, connMat);                        // where the flex lands
    for (let k = 0; k < 6; k++) put(stubX(0.28, 0.55, -6.31, 7.9, 1.8 + k * 1.1), alloy);
  }

  // =========================================================================
  // focal-plane shutter: a unit plate with its charge motor, two 4-blade curtains
  // =========================================================================
  {
    const s = rrect(-5.9, AXIS_Y - 4.7, 5.9, AXIS_Y + 4.7, 0.5);
    s.holes.push(rrect(-OW / 2 - 0.1, AXIS_Y - OH / 2 - 0.1, OW / 2 + 0.1, AXIS_Y + OH / 2 + 0.1, 0.25));
    put(slabX(s, 1.56, 0.42, 0.06, 5), darkMetal);
    put(new THREE.CylinderGeometry(0.62, 0.62, 2.3, 20).rotateX(Math.PI / 2).translate(1.95, AXIS_Y + 5.45, -3.6), darkMetal);
    put(new THREE.CylinderGeometry(0.67, 0.67, 1.0, 20).rotateX(Math.PI / 2).translate(1.95, AXIS_Y + 5.45, -3.6), copperMat);
    for (const [y, z] of [[4.2, 5.45], [4.2, -5.45], [-4.2, 5.45], [-4.2, -5.45]]) put(stubX(0.2, 0.1, 1.98, AXIS_Y + y, z), nickel);
  }
  const shutterGroup = new THREE.Group();
  camBody.add(shutterGroup);
  const bladeH = OH / 4;
  const c1Blades = [], c2Blades = [];
  const HOME1 = [], TILE1 = [], HOME2 = [], TILE2 = [];
  for (let k = 0; k < 4; k++) {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, bladeH * 1.02, OW), bladeMat);
    b1.position.set(SHUT_X - 0.12, 0, 0);
    shutterGroup.add(b1); c1Blades.push(b1);
    HOME1.push(AXIS_Y - OH / 2 - 0.2 - 0.09 * k);
    TILE1.push(AXIS_Y - OH / 2 + (k + 0.5) * bladeH);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, bladeH * 1.02, OW), bladeMat);
    b2.position.set(SHUT_X + 0.12, 0, 0);
    shutterGroup.add(b2); c2Blades.push(b2);
    HOME2.push(AXIS_Y + OH / 2 + 0.2 + 0.09 * k);
    TILE2.push(AXIS_Y + OH / 2 - (k + 0.5) * bladeH);
  }
  shadows(shutterGroup, false, true);
  function poseShutter(c1, c2) {
    for (let k = 0; k < 4; k++) {
      c1Blades[k].position.y = lerp(HOME1[k], TILE1[k], smooth(clamp(c1 * 4 - k, 0, 1)));
      c2Blades[k].position.y = lerp(HOME2[k], TILE2[k], smooth(clamp(c2 * 4 - k, 0, 1)));
    }
  }
  poseShutter(0, 0);

  const SP = [0.12, 0.18, 0.18, 0.10, 0.25];
  const ST = [SP[0], SP[0] + SP[1], SP[0] + SP[1] + SP[2], SP[0] + SP[1] + SP[2] + SP[3], SP[0] + SP[1] + SP[2] + SP[3] + SP[4]];
  const SHUTTER_TOTAL = ST[4];
  function shutterTimeline(e) {
    if (e < ST[0]) return [e / SP[0], 0];
    if (e < ST[1]) return [1 - (e - ST[0]) / SP[1], 0];
    if (e < ST[2]) return [0, (e - ST[1]) / SP[2]];
    if (e < ST[3]) return [0, 1];
    if (e < ST[4]) return [0, 1 - (e - ST[3]) / SP[4]];
    return [0, 0];
  }
  let shutterT = Infinity;
  triggerShutter = function () { shutterT = 0; };
  shutterBusy = function () { return shutterT < SHUTTER_TOTAL; };

  // =========================================================================
  // rail carriage
  // =========================================================================
  const carriage = new THREE.Mesh(new RoundedBoxGeometry(15, 3.5, 8.4, 2, 0.4), alu);
  carriage.position.set(-4.5, 1.75, 0);
  const clampKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.1, 16).rotateX(Math.PI / 2), darkSteel);
  clampKnob.position.set(-4.5, 1.75, 4.75);
  camBody.add(carriage, clampKnob);

  shadows(camBody, true, true);
  bodySensor.castShadow = bodyLcd.castShadow = liner.castShadow = false;
  // printed glyphs are flat quads: they must not cast square shadows
  camBody.traverse((m) => { if (m.isMesh && m.material.isMeshBasicMaterial && m.material.transparent) m.castShadow = false; });
  bakeStatic(deco);

  // =========================================================================
  // updateBody / bodyAnchor
  // =========================================================================
  updateBody = function (dt) {
    camBody.position.x = sensorX(state.cur.f) - 5 * smooth(state.explode);
    bcX1.constant = camBody.position.x + (0.02 - 9);
    bcX2.constant = -(camBody.position.x + X1 - 0.02);

    if (shutterT < SHUTTER_TOTAL) {
      shutterT = Math.min(shutterT + dt, SHUTTER_TOTAL);
      const [c1, c2] = shutterTimeline(shutterT);
      poseShutter(c1, c2);
    }
  };

  bodyAnchor = function (name) {
    const bx = camBody.position.x;
    const p = {
      sensor: [bx + 0.02, AXIS_Y, 0], shutter: [bx + SHUT_X, AXIS_Y, 0],
      lcd: [bx + X0 - 0.27, 14.5, -2], mount: [bx + 4.5, AXIS_Y, 0],
      shutterDial: [bx - 4.5, DIAL_Y, 10.5], isoDial: [bx - 4.5, DIAL_Y, -10.5],
      wbDial: [bx - 10.5, DIAL_Y, -13.8], compDial: [bx - 10.5, DIAL_Y, 14.8],
      modeDial: [bx - 10.5, DIAL_Y, MODE_Z], shutterBtn: [bx + BTN.x, BTN.y, BTN.z],
      top: [bx - 5, 26, 0],
    }[name] || [bx, AXIS_Y, 0];
    return new THREE.Vector3(p[0], p[1], p[2]);
  };

  updateBody(0);
}
