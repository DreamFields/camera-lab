
// ---------------------------------------------------------------------------
// What the world view shows of the optics: the field of view, the plane of
// focus, the slab of acceptable sharpness, marks on the rail, and bundles of
// light from three subjects through the lens to the sensor — converging to a
// point for a subject in focus, spread into a blur disc for one that isn't.
// ---------------------------------------------------------------------------
const FRUST_FAR = 110;
const frustum = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.45, depthWrite: false }));
frustum.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 2 * 3), 3));
frustum.frustumCulled = false;
const fan = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
fan.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3 * 3), 3));
fan.frustumCulled = false;
scene.add(frustum, fan);

const planeU = { uSize: { value: new THREE.Vector2(1, 1) }, uCell: { value: 2 }, uAlpha: { value: 1 } };
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
      float edge = 1.0 - smoothstep(0.0, uCell * 0.14, min(e.x, e.y));
      float face = mix(0.2, 1.0, smoothstep(0.0, 0.6, vFace));
      float a = (0.035 + line * 0.22 * face + edge * 0.7) * uAlpha * mix(0.45, 1.0, face);
      gl_FragColor = vec4(vec3(0.5, 0.89, 1.0) * (0.7 + line * 0.6 + edge * 1.4), a);
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
}));
scene.add(focusPlane);
// the depth of field as a slice of the viewing pyramid
const slabGeo = new THREE.BufferGeometry();
slabGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
slabGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]);
const dofSlab = new THREE.Mesh(slabGeo, new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
const slabEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.45, depthWrite: false }));
slabEdges.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 2 * 3), 3));
dofSlab.frustumCulled = slabEdges.frustumCulled = false;
scene.add(dofSlab, slabEdges);
// marks on the rail: the plane of focus (bright), the near and far limits, the hyperfocal distance
const railMark = (color, w, h = 0.3) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6.5), new THREE.MeshBasicMaterial({ color })); scene.add(m); return m; };
const markFocus = railMark(CYAN.clone().multiplyScalar(2.5), 0.5);
const markNear = railMark(CYAN.clone().multiplyScalar(1.1), 0.25, 0.2);
const markFar = railMark(CYAN.clone().multiplyScalar(1.1), 0.25, 0.2);
const markH = railMark(AMBER.clone().multiplyScalar(1.8), 0.3, 0.25);
const markBand = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 6.3), new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(0.6), transparent: true, opacity: 0.5, depthWrite: false }));
scene.add(markBand);

let dof = { near: 37.7, far: 38.3, H: 4200 };
const _c4 = [0, 0, 0, 0].map(() => new THREE.Vector3());
function frameCorners(d, out) {
  const fm = state.fmt, f = state.cur.f;
  const hw = (d * fm.w) / (2 * f), hh = (d * fm.h) / (2 * f);
  out[0].set(d, AXIS_Y + hh, -hw); out[1].set(d, AXIS_Y + hh, hw); out[2].set(d, AXIS_Y - hh, hw); out[3].set(d, AXIS_Y - hh, -hw);
  return out;
}
const _cn = [0, 0, 0, 0].map(() => new THREE.Vector3()), _cf = [0, 0, 0, 0].map(() => new THREE.Vector3());
const _o = new THREE.Vector3();
function updateOptics() {
  const s = state.cur.D, f = state.cur.f, N = state.cur.N, fm = state.fmt;
  dof = Opt.dof(s, f, N, fm.coc);
  const w = (s * fm.w) / f, h = (s * fm.h) / f;
  focusPlane.position.set(s, AXIS_Y, 0);
  focusPlane.scale.set(1, h, w);
  planeU.uSize.value.set(w, h);
  planeU.uCell.value = [0.5, 1, 2, 5, 10].find((c) => w / c < 14) || 10;
  // frustum from the front of the lens
  const c = frameCorners(FRUST_FAR, _c4);
  const fp = frustum.geometry.attributes.position.array;
  let i = 0;
  const put = (v) => { fp[i++] = v.x; fp[i++] = v.y; fp[i++] = v.z; };
  const o = _o.copy(lensAnchor('front'));
  for (let k = 0; k < 4; k++) { put(o); put(c[k]); }
  for (let k = 0; k < 4; k++) { put(c[k]); put(c[(k + 1) % 4]); }
  frustum.geometry.attributes.position.needsUpdate = true;
  const ap = fan.geometry.attributes.position.array;
  i = 0;
  for (let k = 0; k < 4; k++) for (const v of [o, c[k], c[(k + 1) % 4]]) { ap[i++] = v.x; ap[i++] = v.y; ap[i++] = v.z; }
  fan.geometry.attributes.position.needsUpdate = true;
  // the slab between the near and far limits
  const near = Math.max(dof.near, 1), far = Math.min(dof.far, 140);
  const cn = frameCorners(near, _cn), cf = frameCorners(far, _cf);
  const sp = slabGeo.attributes.position.array;
  for (let k = 0; k < 4; k++) { sp.set([cn[k].x, cn[k].y, cn[k].z], k * 3); sp.set([cf[k].x, cf[k].y, cf[k].z], (k + 4) * 3); }
  slabGeo.attributes.position.needsUpdate = true;
  slabGeo.computeBoundingSphere();
  const ep = slabEdges.geometry.attributes.position.array;
  i = 0;
  const pe = (v) => { ep[i++] = v.x; ep[i++] = v.y; ep[i++] = v.z; };
  for (let k = 0; k < 4; k++) { pe(cn[k]); pe(cn[(k + 1) % 4]); pe(cf[k]); pe(cf[(k + 1) % 4]); pe(cn[k]); pe(cf[k]); }
  slabEdges.geometry.attributes.position.needsUpdate = true;
  slabEdges.material.opacity = isFinite(dof.far) ? 0.45 : 0.25;
  // rail
  markFocus.position.set(s, 0.16, 0);
  markNear.position.set(near, 0.1, 0);
  markFar.position.set(far, 0.1, 0); markFar.visible = isFinite(dof.far) && dof.far < RAIL_X1;
  markH.position.set(dof.H, 0.13, 0); markH.visible = dof.H < RAIL_X1;
  markBand.position.set((near + Math.min(far, RAIL_X1)) / 2, 0.04, 0); markBand.scale.x = Math.max(0.05, Math.min(far, RAIL_X1) - near);
  // the glowing line where the plane cuts the valley
  focusU.uFocusX.value = s;
  focusU.uNearX.value = near;
  focusU.uFarX.value = far;
  focusU.uLineW.value = 0.25 + s * 0.004;
}

// --- light from three subjects, through the lens, onto the sensor ----------------------------------------------------
const RAY_SUBJECTS = ['pine', 'cabin', 'peak'].map((k) => SUB[k]).filter(Boolean);
const RAYS = 14;
const rayPos = new Float32Array(RAY_SUBJECTS.length * RAYS * 4 * 2 * 3);
const rayCol = new Float32Array(RAY_SUBJECTS.length * RAYS * 4 * 2 * 4);
const rayGeo = new THREE.BufferGeometry();
rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPos, 3).setUsage(THREE.DynamicDrawUsage));
rayGeo.setAttribute('color', new THREE.BufferAttribute(rayCol, 4).setUsage(THREE.DynamicDrawUsage));
const rayLines = new THREE.LineSegments(rayGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
rayLines.frustumCulled = false;
const CONE_TRIS = RAYS * 7;
const conePos = new Float32Array(RAY_SUBJECTS.length * CONE_TRIS * 9);
const coneCol = new Float32Array(RAY_SUBJECTS.length * CONE_TRIS * 12);
const coneGeo = new THREE.BufferGeometry();
coneGeo.setAttribute('position', new THREE.BufferAttribute(conePos, 3).setUsage(THREE.DynamicDrawUsage));
coneGeo.setAttribute('color', new THREE.BufferAttribute(coneCol, 4).setUsage(THREE.DynamicDrawUsage));
const cones = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
cones.frustumCulled = false;
const RING_SEG = 48;
const ringPos = new Float32Array(RAY_SUBJECTS.length * RING_SEG * 2 * 3);
const ringCol = new Float32Array(RAY_SUBJECTS.length * RING_SEG * 2 * 3);
const ringGeo = new THREE.BufferGeometry();
ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3).setUsage(THREE.DynamicDrawUsage));
ringGeo.setAttribute('color', new THREE.BufferAttribute(ringCol, 3).setUsage(THREE.DynamicDrawUsage));
const discRings = new THREE.LineSegments(ringGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
discRings.frustumCulled = false;
scene.add(cones, rayLines, discRings);

const subjectState = RAY_SUBJECTS.map(() => ({ sharp: false, cocMm: 0, img: new THREE.Vector3(), disc: 0 }));
const _p = new THREE.Vector3();
const sensorPlaneX = () => camBody.position.x + 0.06;
function updateRays() {
  const s = state.cur.D, N = state.cur.N, f = state.cur.f, fm = state.fmt;
  const rA = irisRadius(N) * 0.92;
  const xF = lensAnchor('front').x + 0.4, xA = lensAnchor('iris').x, xR = lensAnchor('rear').x - 0.4;
  const rings = [[xF, rA * 1.2], [xA, rA], [xR, rA * 0.96]];
  const xS = sensorPlaneX();
  const halfW = (fm.w * SEN_K) / 2, halfH = (fm.h * SEN_K) / 2;
  let vi = 0, ti = 0, tc = 0, ri = 0, rc = 0;
  const put = (x, y, z, c, a) => { rayPos[vi * 3] = x; rayPos[vi * 3 + 1] = y; rayPos[vi * 3 + 2] = z; rayCol[vi * 4] = c.r * a; rayCol[vi * 4 + 1] = c.g * a; rayCol[vi * 4 + 2] = c.b * a; rayCol[vi * 4 + 3] = a; vi++; };
  const tri = (a, b, d, c, alphas) => {
    for (const [k, v] of [a, b, d].entries()) { conePos.set(v, ti); ti += 3; coneCol[tc] = c.r; coneCol[tc + 1] = c.g; coneCol[tc + 2] = c.b; coneCol[tc + 3] = alphas[k]; tc += 4; }
  };
  RAY_SUBJECTS.forEach((sub, j) => {
    const st = subjectState[j];
    const P = sub.at, d = P.x;
    st.sharp = d >= dof.near - 0.05 && d <= dof.far + 0.05;
    st.cocMm = Opt.coc(d, s, f, N);
    _p.copy(P).project(photoCam);
    // the image is upside down and mirrored
    const I = st.img.set(xS, AXIS_Y - _p.y * halfH, -_p.x * halfW);
    const rd = (st.cocMm * SEN_K) / 2;
    st.disc = rd;
    const sign = d < s ? 1 : -1;
    const col = st.sharp ? CYAN : AMBER;
    const boost = st.sharp ? 0.95 : 0.7;
    const ringPt = (k, x, r) => { const a = (k / RAYS) * Math.PI * 2; return [x, AXIS_Y + Math.cos(a) * r, Math.sin(a) * r]; };
    const gPt = (k) => { const a = (k / RAYS) * Math.PI * 2; return [xS, I.y + sign * Math.cos(a) * rd, I.z + sign * Math.sin(a) * rd]; };
    const Pa = [P.x, P.y, P.z];
    for (let k = 0; k < RAYS; k++) {
      const F = ringPt(k, ...rings[0]), A = ringPt(k, ...rings[1]), R = ringPt(k, ...rings[2]), G = gPt(k);
      put(...Pa, col, 0.16 * boost); put(...F, col, 0.5 * boost);
      put(...F, col, 0.5 * boost); put(...A, col, 0.6 * boost);
      put(...A, col, 0.6 * boost); put(...R, col, 0.6 * boost);
      put(...R, col, 0.6 * boost); put(...G, col, 0.9 * boost);
      const k2 = (k + 1) % RAYS;
      const F2 = ringPt(k2, ...rings[0]), A2 = ringPt(k2, ...rings[1]), R2 = ringPt(k2, ...rings[2]), G2 = gPt(k2);
      const fa = st.sharp ? 0.07 : 0.045;
      tri(Pa, F, F2, col, [0, fa, fa]);
      tri(F, A, A2, col, [fa, fa, fa]); tri(F, A2, F2, col, [fa, fa, fa]);
      tri(A, R, R2, col, [fa, fa, fa]); tri(A, R2, A2, col, [fa, fa, fa]);
      tri(R, G, G2, col, [fa, fa * 1.4, fa * 1.4]); tri(R, G2, R2, col, [fa, fa * 1.4, fa]);
    }
    // the blur disc, drawn on the sensor
    const rr = Math.max(rd, 0.06);
    for (let k = 0; k < RING_SEG; k++) {
      for (const kk of [k, k + 1]) {
        const a = (kk / RING_SEG) * Math.PI * 2;
        ringPos[ri++] = xS + 0.03; ringPos[ri++] = I.y + Math.cos(a) * rr; ringPos[ri++] = I.z + Math.sin(a) * rr;
        ringCol[rc++] = col.r * 2; ringCol[rc++] = col.g * 2; ringCol[rc++] = col.b * 2;
      }
    }
  });
  rayGeo.attributes.position.needsUpdate = rayGeo.attributes.color.needsUpdate = true;
  coneGeo.attributes.position.needsUpdate = coneGeo.attributes.color.needsUpdate = true;
  ringGeo.attributes.position.needsUpdate = ringGeo.attributes.color.needsUpdate = true;
}
