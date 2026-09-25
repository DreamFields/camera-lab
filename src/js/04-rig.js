
// ---------------------------------------------------------------------------
// Things only the world view sees (layer 0): the camera on its tripod, its
// field of view, the plane of focus and the slab of acceptable sharpness.
// ---------------------------------------------------------------------------
const rig = new THREE.Group();
scene.add(rig);
{
  const legM = std(0x2b2e33, { metalness: 0.6, roughness: 0.4 });
  const footM = std(0x111214, { roughness: 0.8 });
  const headY = 1.3;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI;
    const foot = V3(Math.cos(a) * 0.55, 0.04, Math.sin(a) * 0.55), top = V3(Math.cos(a) * 0.05, headY, Math.sin(a) * 0.05);
    rig.add(span(new THREE.Mesh(unitCyl(0.01, 0.016, 8), legM), foot, top));
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), footM); f.position.copy(foot); rig.add(f);
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.26, 10), legM); col.position.y = headY + 0.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), legM); head.position.y = EYE - 0.085;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.06), legM); plate.position.set(-0.075, EYE - 0.056, 0);
  rig.add(col, head, plate);
}
const camBody = new THREE.Group();
camBody.position.set(0, EYE, 0);
rig.add(camBody);
const lensParts = {};
{
  const bodyM = std(0x1b1c1f, { roughness: 0.55, metalness: 0.2 });
  const gripM = std(0x121315, { roughness: 0.9 });
  const metal = std(0x9aa0a8, { metalness: 0.9, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.098, 0.138), bodyM); body.position.set(-0.078, 0, 0);
  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.032, 0.056), bodyM); hump.position.set(-0.082, 0.062, 0);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.036), gripM); grip.position.set(-0.03, -0.004, 0.058);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 12), metal); btn.position.set(-0.04, 0.052, 0.056);
  const dialM = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 18), metal); dialM.position.set(-0.09, 0.053, -0.045);
  const mount = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 32)), metal); mount.position.x = -0.038;
  camBody.add(body, hump, grip, btn, dialM, mount);
  // the zoom lens: its barrel extends with focal length
  const barrelM = std(0x141518, { roughness: 0.5, metalness: 0.3 });
  const rubber = std(0x0d0e10, { roughness: 0.95 });
  const barrel = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.034, 0.034, 1, 32).translate(0, 0.5, 0)), barrelM);
  barrel.position.x = -0.035;
  const inner = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.031, 0.031, 1, 32).translate(0, 0.5, 0)), barrelM);
  const zoomRing = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 32)), rubber);
  const focusRing = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.0355, 0.0355, 0.014, 32)), rubber);
  const accent = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.0342, 0.0342, 0.002, 32)), std(0xc0392b, { roughness: 0.4 }));
  const front = new THREE.Group();
  const lip = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.035, 0.033, 0.01, 32)), barrelM);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.029, 32).rotateY(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x0a1420, roughness: 0.05, metalness: 0.2, iridescence: 0.6, clearcoat: 1, transparent: true, opacity: 0.55 }));
  glass.position.x = 0.0045;
  const iris = new THREE.Mesh(new THREE.BufferGeometry(), std(0x1a1b1e, { metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
  iris.position.x = -0.004;
  front.add(lip, glass, iris);
  camBody.add(barrel, inner, zoomRing, focusRing, accent, front);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.05).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x223044, toneMapped: false }));
  lcd.position.set(-0.1165, -0.008, 0);
  camBody.add(lcd);
  Object.assign(lensParts, { barrel, inner, zoomRing, focusRing, accent, front, iris, lcd });
}
bakeStatic(rig, [camBody]);
let rigIrisN = 0;
function buildIris(N) {
  const R = 0.029, r = R * 0.92 * Math.min(1, 1.4 / N * 1.0), rot = N * 0.12;
  const s = new THREE.Shape(); s.absarc(0, 0, R, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  for (let i = 0; i < 9; i++) { const a = -(i / 9) * Math.PI * 2 + rot; (i ? h.lineTo : h.moveTo).call(h, r * Math.cos(a), r * Math.sin(a)); }
  h.closePath(); s.holes.push(h);
  lensParts.iris.geometry.dispose();
  lensParts.iris.geometry = new THREE.ShapeGeometry(s, 24).rotateY(Math.PI / 2);
}
function updateRig() {
  const f = state.cur.f, len = 0.07 + ((f - F_MIN) / (F_MAX - F_MIN)) * 0.085;
  const { barrel, inner, zoomRing, focusRing, accent, front } = lensParts;
  barrel.scale.x = 0.07;
  inner.position.x = -0.035 + 0.068; inner.scale.x = Math.max(0.001, len - 0.07);
  zoomRing.position.x = 0.0;
  focusRing.position.x = -0.035 + len - 0.02;
  accent.position.x = -0.035 + len - 0.005;
  front.position.x = -0.035 + len;
  if (Math.abs(state.cur.N - rigIrisN) > 0.01) { buildIris(state.cur.N); rigIrisN = state.cur.N; }
}
const lensFrontX = () => lensParts.front.position.x;

// --- field of view, plane of focus, depth of field ------------------------------------------------------
const FRUST_FAR = 45;
const frustum = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.55, depthWrite: false }));
frustum.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 2 * 3), 3));
frustum.frustumCulled = false;
const fanMat = new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const fan = new THREE.Mesh(new THREE.BufferGeometry(), fanMat);
fan.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3 * 3), 3));
fan.frustumCulled = false;
scene.add(frustum, fan);

const planeU = { uSize: { value: new THREE.Vector2(1, 1) }, uCell: { value: 0.5 }, uAlpha: { value: 1 } };
const focusPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateY(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: planeU,
  vertexShader: `varying vec2 vUv; varying float vFace;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vFace = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec2 uSize; uniform float uCell, uAlpha;
    varying vec2 vUv; varying float vFace;
    void main() {
      vec2 p = vUv * uSize / uCell;
      vec2 g = abs(fract(p + 0.5) - 0.5);
      vec2 w = fwidth(p) * 1.2;
      float line = 1.0 - min(min(g.x / w.x, g.y / w.y), 1.0);
      vec2 e = min(vUv, 1.0 - vUv) * uSize;
      float edge = 1.0 - smoothstep(0.0, uCell * 0.12, min(e.x, e.y));
      float face = mix(0.25, 1.0, smoothstep(0.0, 0.6, vFace));
      float a = (0.03 + line * 0.2 * face + edge * 0.6) * uAlpha * mix(0.5, 1.0, face);
      gl_FragColor = vec4(vec3(0.5, 0.89, 1.0) * (0.45 + line * 0.4 + edge * 0.9), a);
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
}));
scene.add(focusPlane);
// the depth of field as a slice of the viewing pyramid
const slabGeo = new THREE.BufferGeometry();
slabGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
slabGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]);
const dofSlab = new THREE.Mesh(slabGeo, new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
const slabEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.5, depthWrite: false }));
slabEdges.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 2 * 3), 3));
dofSlab.frustumCulled = slabEdges.frustumCulled = false;
scene.add(dofSlab, slabEdges);
// a metre ruler along the optical axis, on the ground
{
  const pts = [V3(0, 0.06, 0), V3(26, 0.06, 0)];
  for (let d = 1; d <= 25; d++) { const big = [1, 2, 3, 5, 10, 15, 20, 25].includes(d); pts.push(V3(d, 0.06, -(big ? 0.25 : 0.12)), V3(d, 0.06, big ? 0.25 : 0.12)); }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.55, depthWrite: false })));
}

let dof = { near: 2.7, far: 3.4, H: 80 };
const _c = [0, 0, 0, 0].map(() => new THREE.Vector3());
function corners(d, out, grow = 1) {
  const fm = state.fmt, f = state.cur.f;
  const hw = ((d * fm.w) / (2 * f)) * grow, hh = ((d * fm.h) / (2 * f)) * grow;
  out[0].set(d, EYE + hh, -hw); out[1].set(d, EYE + hh, hw); out[2].set(d, EYE - hh, hw); out[3].set(d, EYE - hh, -hw);
  return out;
}
function updateOptics() {
  const s = state.cur.D, f = state.cur.f, N = state.cur.N, fm = state.fmt;
  dof = Opt.dof(s, f, N, fm.coc);
  const w = (s * fm.w) / f, h = (s * fm.h) / f;
  focusPlane.position.set(s, EYE, 0);
  focusPlane.scale.set(1, h, w);
  planeU.uSize.value.set(w, h);
  planeU.uCell.value = [0.1, 0.25, 0.5, 1, 2].find((c) => w / c < 16) || 2;
  // frustum lines and faint faces
  const c = corners(FRUST_FAR, _c);
  const fp = frustum.geometry.attributes.position.array;
  let i = 0;
  const put = (v) => { fp[i++] = v.x; fp[i++] = v.y; fp[i++] = v.z; };
  const o = V3(lensFrontX(), EYE, 0);
  for (let k = 0; k < 4; k++) { put(o); put(c[k]); }
  for (let k = 0; k < 4; k++) { put(c[k]); put(c[(k + 1) % 4]); }
  frustum.geometry.attributes.position.needsUpdate = true;
  const ap = fan.geometry.attributes.position.array;
  i = 0;
  for (let k = 0; k < 4; k++) for (const v of [o, c[k], c[(k + 1) % 4]]) { ap[i++] = v.x; ap[i++] = v.y; ap[i++] = v.z; }
  fan.geometry.attributes.position.needsUpdate = true;
  // the slab between the near and far limits
  const near = Math.max(dof.near, 0.05), far = Math.min(dof.far, 60);
  const cn = corners(near, [V3(), V3(), V3(), V3()]), cf = corners(far, [V3(), V3(), V3(), V3()]);
  const sp = slabGeo.attributes.position.array;
  [...cn, ...cf].forEach((v, k) => sp.set([v.x, v.y, v.z], k * 3));
  slabGeo.attributes.position.needsUpdate = true;
  slabGeo.computeBoundingSphere();
  const ep = slabEdges.geometry.attributes.position.array;
  i = 0;
  const pe = (v) => { ep[i++] = v.x; ep[i++] = v.y; ep[i++] = v.z; };
  for (let k = 0; k < 4; k++) { pe(cn[k]); pe(cn[(k + 1) % 4]); pe(cf[k]); pe(cf[(k + 1) % 4]); pe(cn[k]); pe(cf[k]); }
  slabEdges.geometry.attributes.position.needsUpdate = true;
  slabEdges.material.opacity = isFinite(dof.far) ? 0.5 : 0.3;
  focusU.uFocusX.value = s;
  focusU.uNearX.value = near;
  focusU.uFarX.value = far;
  focusU.uLineW.value = 0.025 + s * 0.006;
}
