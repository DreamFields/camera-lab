
// ---------------------------------------------------------------------------
// Optics: the photo the lens forms (rendered once, blurred per focus setting),
// the ground glass that shows it upside down, the plane of focus, and rays.
// ---------------------------------------------------------------------------
const PHOTO_W = coarse ? 600 : 780, PHOTO_H = Math.round(PHOTO_W / 1.5);
const MAX_R = PHOTO_W * 0.028;
const photoCam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(VFOV), SENSOR_W / SENSOR_H, 10, 260);
photoCam.position.set(0, AXIS_Y, 0);
photoCam.lookAt(100, AXIS_Y, 0);
photoCam.updateMatrixWorld();
photoCam.layers.set(LAYER_PHOTO);

const photoRT = new THREE.WebGLRenderTarget(PHOTO_W, PHOTO_H, {
  type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(PHOTO_W, PHOTO_H),
});
const dofRT = new THREE.WebGLRenderTarget(PHOTO_W, PHOTO_H, { type: THREE.HalfFloatType });
const THUMB_W = 256;
const thumbRTs = screens.map(() => new THREE.WebGLRenderTarget(THUMB_W, Math.round(THUMB_W / 1.5), { type: THREE.HalfFloatType }));
screens.forEach((m, i) => { m.material.dispose(); m.material = new THREE.MeshBasicMaterial({ map: thumbRTs[i].texture }); });

const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const dofMat = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: photoRT.texture }, tDepth: { value: photoRT.depthTexture },
    uTexel: { value: new THREE.Vector2(1 / PHOTO_W, 1 / PHOTO_H) },
    uNear: { value: photoCam.near }, uFar: { value: photoCam.far },
    uFocus: { value: 38 }, uCoc: { value: 1 }, uMaxR: { value: 4 }, uStep: { value: 1.35 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tColor, tDepth;
    uniform vec2 uTexel;
    uniform float uNear, uFar, uFocus, uCoc, uMaxR, uStep;
    varying vec2 vUv;
    float dist(vec2 uv) { float z = texture2D(tDepth, uv).x; return uNear * uFar / (uFar - z * (uFar - uNear)); }
    float blurR(float d) { return min(uCoc * abs(d - uFocus) / d, uMaxR); }
    void main() {
      float d0 = dist(vUv), r0 = blurR(d0);
      vec3 col = texture2D(tColor, vUv).rgb;
      float tot = 1.0, rad = uStep, ang = 0.0;
      for (int i = 0; i < 420; i++) {
        if (rad >= uMaxR) break;
        vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * rad;
        vec3 sc = texture2D(tColor, tc).rgb;
        float sd = dist(tc), sr = blurR(sd);
        if (sd > d0) sr = min(sr, r0 * 2.0);
        float m = smoothstep(rad - uStep, rad + uStep, sr);
        col += mix(col / tot, sc, m);
        tot += 1.0;
        rad += uStep / rad;
        ang += 2.39996323;
      }
      gl_FragColor = vec4(col / tot, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const fsScene = new THREE.Scene();
fsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dofMat));

function renderPhoto() {
  focusU.uGlowOn.value = 0;
  renderer.setRenderTarget(photoRT);
  renderer.render(scene, photoCam);
  renderer.setRenderTarget(null);
  focusU.uGlowOn.value = 1;
}
function runDOF(target, focus, N) {
  const u = dofMat.uniforms;
  const coc = (LENS_F * LENS_F / (N * (focus * 10 - LENS_F))) / SENSOR_W * PHOTO_W * 0.5;
  u.uFocus.value = focus;
  u.uCoc.value = coc;
  u.uMaxR.value = clamp(coc * Math.max((focus - 24) / 24, (96 - focus) / 96), 1, MAX_R);
  renderer.setRenderTarget(target);
  renderer.render(fsScene, fsCam);
  renderer.setRenderTarget(null);
}

// --- the ground glass -----------------------------------------------------------------
const imagePlane = new THREE.Mesh(new THREE.PlaneGeometry(GLASS_W, GLASS_H), new THREE.ShaderMaterial({
  uniforms: { tImg: { value: dofRT.texture } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tImg;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tImg, 1.0 - vUv).rgb;          // a lens turns the world half a circle
      vec2 q = vUv - 0.5;
      c *= mix(0.6, 1.06, smoothstep(0.86, 0.22, length(q * vec2(1.0, 1.35))));
      float n = fract(sin(dot(floor(vUv * vec2(960.0, 640.0)), vec2(12.9898, 78.233))) * 43758.5453);
      c *= 0.95 + 0.05 * n;
      float e = max(abs(q.x), abs(q.y)) * 2.0;
      c += vec3(0.5, 0.89, 1.0) * smoothstep(0.978, 1.0, e) * 1.3;
      gl_FragColor = vec4(c, 1.0);
    }`,
  side: THREE.DoubleSide,
}));
imagePlane.rotation.y = -Math.PI / 2;
imagePlane.position.set(GLASS_X, AXIS_Y, 0);
scene.add(imagePlane);

// --- plane of focus and the sharp zone ---------------------------------------------------
const planeU = { uSize: { value: new THREE.Vector2(1, 1) }, uAlpha: { value: 1 } };
const focusPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
  uniforms: planeU,
  vertexShader: `varying vec2 vUv; varying float vFace;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vFace = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec2 uSize; uniform float uAlpha;
    varying vec2 vUv; varying float vFace;
    void main() {
      vec2 p = vUv * uSize / 2.0;
      vec2 g = abs(fract(p + 0.5) - 0.5);
      vec2 w = fwidth(p) * 1.2;
      float line = 1.0 - min(min(g.x / w.x, g.y / w.y), 1.0);
      vec2 e = min(vUv, 1.0 - vUv) * uSize;
      float edge = 1.0 - smoothstep(0.0, 0.3, min(e.x, e.y));
      float face = mix(0.18, 1.0, smoothstep(0.0, 0.6, vFace));
      float a = (0.035 + line * 0.22 * face + edge * 0.7) * uAlpha * mix(0.45, 1.0, face);
      gl_FragColor = vec4(vec3(0.5, 0.89, 1.0) * (0.7 + line * 0.6 + edge * 1.4), a);
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
}));
focusPlane.rotation.y = -Math.PI / 2;
scene.add(focusPlane);
const zoneBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
  color: 0x7fe3ff, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending,
}));
const zoneEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({
  color: 0x7fe3ff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(zoneBox, zoneEdges);
// a bright marker where the plane meets the rail
const railMark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 6.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe3ff).multiplyScalar(2.5) }));
scene.add(railMark);

let dof = dofLimits(38, 2);
function updateFocusPlane() {
  const s = state.focus;
  dof = dofLimits(s, state.N);
  const w = 2 * s * TAN_H, h = 2 * s * TAN_V;
  focusPlane.position.set(s, AXIS_Y, 0);
  focusPlane.scale.set(w, h, 1);
  planeU.uSize.value.set(w, h);
  const near = dof.near, far = Math.min(dof.far, 140);
  for (const m of [zoneBox, zoneEdges]) { m.position.set((near + far) / 2, AXIS_Y, 0); m.scale.set(far - near, h, w); }
  railMark.position.set(s, 0.13, 0);
  focusU.uFocusX.value = s;
  focusU.uNearX.value = near;
  focusU.uFarX.value = far;
}

// --- rays --------------------------------------------------------------------------------------
const RAYS = 14, SEGS = 4;
const rayPos = new Float32Array(SUBJECTS.length * RAYS * SEGS * 2 * 3);
const rayCol = new Float32Array(SUBJECTS.length * RAYS * SEGS * 2 * 4);
const rayGeo = new THREE.BufferGeometry();
rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPos, 3).setUsage(THREE.DynamicDrawUsage));
rayGeo.setAttribute('color', new THREE.BufferAttribute(rayCol, 4).setUsage(THREE.DynamicDrawUsage));
const rayLines = new THREE.LineSegments(rayGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
rayLines.frustumCulled = false;
const CONE_TRIS = RAYS * (1 + 2 + 2 + 2);
const conePos = new Float32Array(SUBJECTS.length * CONE_TRIS * 9);
const coneCol = new Float32Array(SUBJECTS.length * CONE_TRIS * 12);
const coneGeo = new THREE.BufferGeometry();
coneGeo.setAttribute('position', new THREE.BufferAttribute(conePos, 3).setUsage(THREE.DynamicDrawUsage));
coneGeo.setAttribute('color', new THREE.BufferAttribute(coneCol, 4).setUsage(THREE.DynamicDrawUsage));
const cones = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
cones.frustumCulled = false;
const RING_SEG = 48;
const ringPos = new Float32Array(SUBJECTS.length * 2 * RING_SEG * 2 * 3);
const ringCol = new Float32Array(SUBJECTS.length * 2 * RING_SEG * 2 * 3);
const ringGeo = new THREE.BufferGeometry();
ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3).setUsage(THREE.DynamicDrawUsage));
ringGeo.setAttribute('color', new THREE.BufferAttribute(ringCol, 3).setUsage(THREE.DynamicDrawUsage));
const glassRings = new THREE.LineSegments(ringGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
glassRings.frustumCulled = false;
scene.add(cones, rayLines, glassRings);

const subjectState = SUBJECTS.map(() => ({ sharp: false, cocMm: 0, img: new THREE.Vector3(), disc: 0 }));
const _p = new THREE.Vector3();
function updateRays() {
  const s = state.focus, N = state.N;
  const rA = irisRadius(N) * 0.92;
  const xF = lensAnchor('front').x + 0.4, xA = lensAnchor('iris').x, xR = lensAnchor('rear').x - 0.4;
  const rings = [[xF, rA * 1.2], [xA, rA], [xR, rA * 0.96]];
  let vi = 0, ci = 0, ti = 0, tc = 0, ri = 0, rc = 0;
  const put = (x, y, z, c, a) => { rayPos.set([x, y, z], vi * 3); rayCol.set([c.r * a, c.g * a, c.b * a, a], vi * 4); vi++; };
  const tri = (pts, c, alphas) => {
    for (let k = 0; k < 3; k++) { conePos.set(pts[k], ti); ti += 3; const a = alphas[k]; coneCol.set([c.r, c.g, c.b, a], tc); tc += 4; }
  };
  SUBJECTS.forEach((sub, j) => {
    const st = subjectState[j];
    const P = sub.pos, d = P.x;
    st.sharp = d >= dof.near - 0.05 && d <= dof.far + 0.05;
    st.cocMm = cocMm(d, s, N);
    _p.copy(P).project(photoCam);
    const I = st.img.set(GLASS_X + 0.02, AXIS_Y - _p.y * GLASS_H / 2, -_p.x * GLASS_W / 2);
    const rd = (st.cocMm / SENSOR_W) * GLASS_W / 2;
    st.disc = rd;
    const sign = d < s ? 1 : -1;
    const col = st.sharp ? CYAN : AMBER;
    const boost = st.sharp ? 0.95 : 0.7;
    const ringPt = (k, x, r) => { const a = (k / RAYS) * Math.PI * 2; return [x, AXIS_Y + Math.cos(a) * r, Math.sin(a) * r]; };
    const gPt = (k) => { const a = (k / RAYS) * Math.PI * 2; return [GLASS_X + 0.03, I.y + sign * Math.cos(a) * rd, I.z + sign * Math.sin(a) * rd]; };
    for (let k = 0; k < RAYS; k++) {
      const F = ringPt(k, ...rings[0]), A = ringPt(k, ...rings[1]), R = ringPt(k, ...rings[2]), G = gPt(k);
      put(P.x, P.y, P.z, col, 0.18 * boost); put(...F, col, 0.55 * boost);
      put(...F, col, 0.55 * boost); put(...A, col, 0.6 * boost);
      put(...A, col, 0.6 * boost); put(...R, col, 0.6 * boost);
      put(...R, col, 0.6 * boost); put(...G, col, 0.9 * boost);
      const k2 = (k + 1) % RAYS;
      const F2 = ringPt(k2, ...rings[0]), A2 = ringPt(k2, ...rings[1]), R2 = ringPt(k2, ...rings[2]), G2 = gPt(k2);
      const fa = st.sharp ? 0.07 : 0.045;
      tri([[P.x, P.y, P.z], F, F2], col, [0.0, fa, fa]);
      tri([F, A, A2], col, [fa, fa, fa]); tri([F, A2, F2], col, [fa, fa, fa]);
      tri([A, R, R2], col, [fa, fa, fa]); tri([A, R2, A2], col, [fa, fa, fa]);
      tri([R, G, G2], col, [fa, fa * 1.4, fa * 1.4]); tri([R, G2, R2], col, [fa, fa * 1.4, fa]);
    }
    // the blur disc drawn on both faces of the glass
    const rr = Math.max(rd, 0.14);
    for (const dx of [0.05, -0.05]) {
      for (let k = 0; k < RING_SEG; k++) {
        for (const kk of [k, k + 1]) {
          const a = (kk / RING_SEG) * Math.PI * 2;
          ringPos.set([GLASS_X + dx, I.y + Math.cos(a) * rr, I.z + Math.sin(a) * rr], ri); ri += 3;
          ringCol.set([col.r * 2, col.g * 2, col.b * 2], rc); rc += 3;
        }
      }
    }
  });
  rayGeo.attributes.position.needsUpdate = rayGeo.attributes.color.needsUpdate = true;
  coneGeo.attributes.position.needsUpdate = coneGeo.attributes.color.needsUpdate = true;
  ringGeo.attributes.position.needsUpdate = ringGeo.attributes.color.needsUpdate = true;
}
