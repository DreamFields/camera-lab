
// ---------------------------------------------------------------------------
// The photo. Every frame the camera makes an exposure the way a real one does:
//   1. shutter — the scene is rendered at K instants inside the t seconds the
//      shutter is open and averaged (motion blur, camera shake);
//   2. lens    — each pixel carries the size of its blur disc, worked out from
//      depth with the thin-lens formula, and a gather pass spreads it
//      (depth of field, bokeh);
//   3. sensor  — light × exposure becomes electrons with shot noise and read
//      noise (ISO), clips at full well, gets white-balance gains and a tone
//      curve.
// ---------------------------------------------------------------------------
const PW = QUALITY.photoW, PH = Math.round(PW / 1.5);
const MAX_R = Math.round(PW * 0.07);          // largest blur radius drawn, px
const photoCam = new THREE.PerspectiveCamera(30, 1.5, 0.08, 1500);
photoCam.rotation.order = 'YXZ';
photoCam.layers.set(LAYER_PHOTO);

const floatRT = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, ...o });
const subRT = new THREE.WebGLRenderTarget(PW, PH, { type: THREE.HalfFloatType, samples: coarse ? 0 : 4, depthTexture: new THREE.DepthTexture(PW, PH) });
const accRT = floatRT(PW, PH, { minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: false });
const blurRT = floatRT(PW / 2, PH / 2);
const finalRT = new THREE.WebGLRenderTarget(PW, PH, { depthBuffer: false });
const MW = 48, MH = 32, HW = 160, HH = 106, SW = 540, SH = 360;
const meterRT = new THREE.WebGLRenderTarget(MW, MH, { depthBuffer: false });
const histRT = new THREE.WebGLRenderTarget(HW, HH, { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const snapRT = new THREE.WebGLRenderTarget(SW, SH, { depthBuffer: false });

const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsGeo = new THREE.PlaneGeometry(2, 2);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function fsPass(uniforms, fragmentShader, extra = {}) {
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false, ...extra });
  const s = new THREE.Scene(), m = new THREE.Mesh(fsGeo, mat);
  m.frustumCulled = false; s.add(m);
  return { mat, u: uniforms, scene: s };
}
function runPass(p, target) { renderer.setRenderTarget(target); renderer.render(p.scene, fsCam); }
const GLSL_RAND = `
  uvec3 pcg3d(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    return v;
  }
  vec3 rnd3(vec2 p, float s) { return vec3(pcg3d(uvec3(uvec2(p), uint(s)))) * (1.0 / 4294967296.0); }`;

// 1 → accumulate one sub-exposure: colour plus signed blur radius (+ behind the
// plane of focus, − in front), both weighted by 1/K
const packP = fsPass({
  tColor: { value: subRT.texture }, tDepth: { value: subRT.depthTexture },
  uNear: { value: photoCam.near }, uFar: { value: photoCam.far }, uFocus: { value: 3 }, uK: { value: 1 }, uMax: { value: MAX_R }, uW: { value: 1 }, uNanDebug: { value: 0 },
}, `
  uniform sampler2D tColor, tDepth;
  uniform float uNear, uFar, uFocus, uK, uMax, uW, uNanDebug;
  varying vec2 vUv;
  void main() {
    float z = texture2D(tDepth, vUv).x;
    float d = uNear * uFar / (uFar - z * (uFar - uNear));
    float coc = clamp(uK * (d - uFocus) / d, -uMax, uMax);
    vec3 c = texture2D(tColor, vUv).rgb;
    // one bad pixel would spread through the mip chain and the bokeh gather
    bool bad = any(isnan(c)) || any(isinf(c));
    c = bad ? vec3(uNanDebug * 1000.0, 0.0, uNanDebug * 1000.0) : min(c, vec3(60000.0));
    gl_FragColor = vec4(c, coc) * uW;
  }`, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });

// 2 → depth of field: scatter-as-gather on a golden-angle spiral, at half res,
// reading colour from a mip level that matches the tap spacing
const dofP = fsPass({
  tSrc: { value: accRT.texture }, uTexel: { value: new THREE.Vector2(1 / PW, 1 / PH) },
  uMaxR: { value: 4 }, uStep: { value: 1 }, uLod: { value: 0 }, uSeed: { value: 0 },
}, `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  uniform float uMaxR, uStep, uLod, uSeed;
  varying vec2 vUv;
  ${GLSL_RAND}
  void main() {
    float coc0 = textureLod(tSrc, vUv, 0.0).a;
    float r0 = min(abs(coc0), uMaxR);
    // the pixel's own light is spread over its disc too: read it pre-blurred to
    // match, or a bright point would keep a hot core in the middle of its bokeh
    vec3 col = textureLod(tSrc, vUv, clamp(log2(max(r0, 1.0)) - 0.5, 1.0, max(uLod, 1.0))).rgb;
    float tot = 1.0, spread = r0;
    float ang = rnd3(gl_FragCoord.xy, uSeed).x * 6.2831853;
    float rad = uStep;
    for (int i = 0; i < 400; i++) {
      if (rad >= uMaxR) break;
      vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * rad;
      float sc = textureLod(tSrc, tc, 0.0).a;
      vec3 sCol = textureLod(tSrc, tc, uLod).rgb;
      float sr = min(abs(sc), uMaxR);
      if (sc > coc0) sr = min(sr, r0 * 2.0);
      float m = smoothstep(rad - uStep, rad + uStep, sr);
      col += mix(col / tot, sCol, m);
      tot += 1.0;
      spread = max(spread, sr * step(0.5, m));
      rad += uStep / rad;
      ang += 2.39996323;
    }
    gl_FragColor = vec4(col / tot, spread);
  }`);

// 3 → sensor: exposure, vignetting, shot + read noise, clipping, white balance, tone curve
const sensorP = fsPass({
  tSharp: { value: accRT.texture }, tBlur: { value: blurRT.texture }, uUseBlur: { value: 1 },
  uExpo: { value: 1 }, uWB: { value: new THREE.Vector3(1, 1, 1) }, uFWC: { value: 48000 }, uRead: { value: READ_E },
  uSeed: { value: 0 }, uVig: { value: 0 }, uNoise: { value: 1 }, uHalfTexel: { value: new THREE.Vector2(2 / PW, 2 / PH) },
}, `
  uniform sampler2D tSharp, tBlur;
  uniform float uUseBlur, uExpo, uFWC, uRead, uSeed, uVig, uNoise;
  uniform vec3 uWB;
  uniform vec2 uHalfTexel;
  varying vec2 vUv;
  ${GLSL_RAND}
  vec3 gauss3(vec2 p, float s) {
    vec3 a = max(rnd3(p, s), 1e-7), b = rnd3(p, s + 7919.0);
    float r1 = sqrt(-2.0 * log(a.x)), r2 = sqrt(-2.0 * log(a.z));
    return vec3(r1 * cos(6.2831853 * a.y), r1 * sin(6.2831853 * a.y), r2 * cos(6.2831853 * b.x));
  }
  vec3 oetf(vec3 x) { return mix(x * 12.92, 1.055 * pow(x, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, x)); }
  void main() {
    vec4 s = textureLod(tSharp, vUv, 0.0);
    vec3 lin = s.rgb;
    if (uUseBlur > 0.5) {
      // a small tent filter over the half-res gather hides its sampling grain
      vec2 o = uHalfTexel * 0.75;
      vec4 b = 0.25 * (texture2D(tBlur, vUv + vec2(o.x, o.y)) + texture2D(tBlur, vUv + vec2(-o.x, o.y)) + texture2D(tBlur, vUv + vec2(o.x, -o.y)) + texture2D(tBlur, vUv - o));
      lin = mix(lin, b.rgb, smoothstep(0.6, 1.6, max(abs(s.a), b.a)));
    }
    vec2 q = (vUv - 0.5) * vec2(1.2, 0.8);
    lin *= exp2(-uVig * dot(q, q) * 1.923);
    vec3 e = max(lin * uExpo, 0.0) * uFWC;                     // expected electrons
    e += uNoise * gauss3(gl_FragCoord.xy, uSeed) * sqrt(e + uRead * uRead);
    vec3 raw = clamp(e / uFWC, 0.0, 1.0);                     // full well = 1
    vec3 c = min(raw * uWB, 1.0);
    c = oetf(c);
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
    gl_FragColor = vec4(c, 1.0);
  }`);

// 4 → what the camera's meter sees: block averages of the (un-exposed) light,
// log-encoded so 8 bits cover 24 stops
const meterP = fsPass({ tSrc: { value: accRT.texture }, uCell: { value: new THREE.Vector2(1 / MW, 1 / MH) } }, `
  uniform sampler2D tSrc; uniform vec2 uCell;
  varying vec2 vUv;
  void main() {
    vec3 s = vec3(0.0);
    // a meter cell saturates like the sensor does, so a few bare bulbs can't drag the reading up by stops
    for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) s += min(textureLod(tSrc, vUv + (vec2(i, j) - 1.5) / 4.0 * uCell, 2.0).rgb, vec3(1.0));
    s = max(s / 16.0, vec3(1.5e-5));
    gl_FragColor = vec4(clamp((log2(s) + 16.0) / 24.0, 0.0, 1.0), 1.0);
  }`);
const decLog = (v) => 2 ** ((v / 255) * 24 - 16);
// histogram and thumbnails: point-sample the finished photo (keeps the noise honest)
const histP = fsPass({ tImg: { value: finalRT.texture }, uSize: { value: new THREE.Vector2(PW, PH) } }, `
  uniform sampler2D tImg; uniform vec2 uSize;
  varying vec2 vUv;
  void main() { gl_FragColor = texelFetch(tImg, ivec2(vUv * uSize), 0); }`);
const copyP = fsPass({ tImg: { value: finalRT.texture } }, `
  uniform sampler2D tImg; varying vec2 vUv;
  void main() { gl_FragColor = texture2D(tImg, vUv); }`);

// 5 → onto the screen, with the camera's display aids
const displayP = fsPass({
  tImg: { value: finalRT.texture }, tSharp: { value: accRT.texture }, uTexel: { value: new THREE.Vector2(1 / PW, 1 / PH) },
  uPeak: { value: 0 }, uZebra: { value: 0 }, uTime: { value: 0 }, uCocOk: { value: 1 },
}, `
  uniform sampler2D tImg, tSharp;
  uniform vec2 uTexel;
  uniform float uPeak, uZebra, uTime, uCocOk;
  varying vec2 vUv;
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  void main() {
    vec3 c = texture2D(tImg, vUv).rgb;
    bool clipped = max(c.r, max(c.g, c.b)) > 0.985;
    if (uPeak > 0.5) {
      float coc = abs(textureLod(tSharp, vUv, 0.0).a);
      float inF = 1.0 - smoothstep(uCocOk, uCocOk * 1.5 + 0.3, coc);
      float gx = luma(texture2D(tImg, vUv + vec2(uTexel.x, 0.0)).rgb) - luma(texture2D(tImg, vUv - vec2(uTexel.x, 0.0)).rgb);
      float gy = luma(texture2D(tImg, vUv + vec2(0.0, uTexel.y)).rgb) - luma(texture2D(tImg, vUv - vec2(0.0, uTexel.y)).rgb);
      float edge = smoothstep(0.06, 0.18, length(vec2(gx, gy)));
      c = mix(c * mix(1.0, 0.72, 1.0 - inF), vec3(0.45, 0.95, 1.0), inF * edge);
      c += vec3(0.03, 0.09, 0.11) * inF;
    }
    if (uZebra > 0.5 && clipped) {
      float st = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 14.0 - uTime * 1.5));
      c = mix(vec3(1.0, 0.22, 0.2), vec3(0.08), st);
    }
    gl_FragColor = vec4(c, 1.0);
  }`);

// ---------------------------------------------------------------------------
// Exposure calibration. A hidden 18 % grey card at the model's spot, facing
// the camera, is rendered on its own; all lights are then scaled so it reads
// exactly 0.18. After that, "correct exposure" means EV(setting) = scene EV.
// ---------------------------------------------------------------------------
const calCard = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.18, 0.18, 0.18), roughness: 1, metalness: 0 }));
calCard.position.set(2.7, EYE + 0.1, 0);
calCard.layers.set(LAYER_CAL);
scene.add(calCard);
const calCam = new THREE.PerspectiveCamera(3, 1, 0.1, 10);
calCam.position.set(0, EYE + 0.1, 0);
calCam.lookAt(2.7, EYE + 0.1, 0);
calCam.layers.set(LAYER_CAL);
const calRT = floatRT(8, 8, { minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
const calOut = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
const calEnc = fsPass({ tSrc: { value: calRT.texture } }, `
  uniform sampler2D tSrc; varying vec2 vUv;
  void main() { vec3 s = max(textureLod(tSrc, vec2(0.5), 3.0).rgb, vec3(1.5e-5)); gl_FragColor = vec4(clamp((log2(s) + 16.0) / 24.0, 0.0, 1.0), 1.0); }`);
const calBuf = new Uint8Array(4);
function calibrate() {
  setLightScale(1);
  // the shadow map must exist before anything that samples it is drawn; with
  // only the card on this layer it comes out empty, so the card stays unshadowed
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(calRT);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, calCam);
  renderer.setClearColor(0x000000, 0);
  runPass(calEnc, calOut);
  // an async read-back still in flight leaves its pixel-pack buffer bound, which
  // would turn this synchronous read into an error; it rebinds its own buffer
  const gl = renderer.getContext();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  renderer.readRenderTargetPixels(calOut, 0, 0, 1, 1, calBuf);
  const r = decLog(calBuf[0]), g = decLog(calBuf[1]), b = decLog(calBuf[2]);
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  setLightScale(0.18 / Math.max(L, 1e-6));
  state.keyLightK = estimateKelvin(r, g, b);
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(null);
}

// ---------------------------------------------------------------------------
// The camera's brain: meter, auto modes, and the numbers the sensor pass uses.
// ---------------------------------------------------------------------------
const expo = { evSet: 11, evEff: 11, delta: 0, meterDelta: 0, gain: 1, K: 1, blurPx: 0, shakePx: 0, limited: '' };
const shakeSeeds = [0.9, 2.3, 5.1, 8.7].map((f, i) => ({ f, py: hash1(i * 3.1) * 6.28, pp: hash1(i * 7.7) * 6.28, w: [0.4, 0.5, 0.62, 0.45][i] }));
const shakeNorm = Math.sqrt(shakeSeeds.reduce((a, s) => a + s.w * s.w, 0));
function shakeAngles(tau) {
  if (state.hold === 'tripod') return [0, 0];
  const w = SHAKE_W / (state.hold === 'handIS' ? 2 ** state.isStops : 1);
  let yaw = 0, pitch = 0;
  for (const s of shakeSeeds) {
    const a = (w * s.w * Math.SQRT2) / shakeNorm / (2 * Math.PI * s.f);
    yaw += a * Math.sin(2 * Math.PI * s.f * tau + s.py);
    pitch += a * Math.sin(2 * Math.PI * s.f * 1.13 * tau + s.pp);
  }
  return [yaw, pitch];
}
function autoExposure(dt) {
  const fm = state.fmt, target = state.meterEV - state.nd - state.comp, N = state.cur.N;
  const rate = 1 - Math.exp(-7 * dt);
  const ease = (key, v) => { state[key] = Math.exp(lerp(Math.log(state[key]), Math.log(v), state.meterValid ? rate : 1)); };
  let limited = '';
  const isoFor = (n, t) => 100 * 2 ** (Math.log2((n * n) / t) - target);
  if (state.mode === 'A') {
    let iso = state.autoISO ? 100 : state.iso;
    let t = (N * N) / 2 ** (target + Math.log2(iso / 100));
    if (state.autoISO) {
      const tSlow = clamp(1 / (state.cur.f * fm.crop), 1 / 2000, 1 / 25);
      if (t > tSlow) { t = tSlow; iso = clamp(isoFor(N, t), 100, 25600); t = (N * N) / 2 ** (target + Math.log2(iso / 100)); }
      ease('iso', iso);
    }
    if (t > 1 / 25) limited = 'slow'; else if (t < 1 / 2000) limited = 'fast';
    ease('t', clamp(t, 1 / 2000, 1 / 25));
  } else if (state.mode === 'S') {
    const t = state.t;
    let iso = state.autoISO ? 100 : state.iso;
    let n = Math.sqrt(t * 2 ** (target + Math.log2(iso / 100)));
    if (state.autoISO && n < 1.4) { n = 1.4; iso = clamp(isoFor(n, t), 100, 25600); n = Math.sqrt(t * 2 ** (target + Math.log2(iso / 100))); }
    if (state.autoISO) ease('iso', iso);
    if (n < 1.4) limited = 'open'; else if (n > 22) limited = 'closed';
    ease('N', clamp(n, 1.4, 22));
  } else if (state.autoISO) {
    const iso = isoFor(N, state.t);
    if (iso > 25600) limited = 'isoMax'; else if (iso < 100) limited = 'isoMin';
    ease('iso', clamp(iso, 100, 25600));
  }
  expo.limited = limited;
}
function updateExposure() {
  const fm = state.fmt, f = state.cur.f, N = state.cur.N;
  expo.evSet = Opt.ev(N, state.t, state.iso);
  expo.evEff = expo.evSet + state.nd;            // an ND filter works like a higher EV
  expo.delta = state.sceneEV - expo.evEff;
  expo.meterDelta = state.meterEV - expo.evEff;
  expo.gain = 2 ** expo.delta;
  expo.fwc = Opt.fwc(state.iso, fm);
  // how many sub-exposures the shutter needs: enough that nothing jumps > ~2 px between them
  const pxPerMm = PW / fm.w;
  let blur = 0;
  const vis = (p) => { _pp.copy(p).project(photoCam); return Math.abs(_pp.x) < 1.3 && Math.abs(_pp.y) < 1.3 && _pp.z < 1; };
  for (const s of SUBJECTS) if (s.speed && vis(s.at)) blur = Math.max(blur, Opt.motion(s.speed, s.at.x, f, state.t) * pxPerMm);
  expo.blurPx = blur;
  expo.shakePx = state.hold === 'tripod' ? 0 : Opt.shake(f, state.t, state.hold === 'handIS' ? state.isStops : 0) * pxPerMm;
  expo.K = clamp(Math.ceil(Math.max(blur, expo.shakePx * 1.5) / 2.2), 1, QUALITY.kMax);
}
const _pp = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Rendering one photo.
// ---------------------------------------------------------------------------
let photoSeed = 1, photoSig = '';
function aimPhotoCam(tau) {
  const fm = state.fmt;
  photoCam.fov = THREE.MathUtils.radToDeg(Opt.fov(state.cur.f, fm.h));
  photoCam.aspect = fm.w / fm.h;
  photoCam.updateProjectionMatrix();
  const [yaw, pitch] = shakeAngles(tau);
  photoCam.position.set(0, EYE, 0);
  photoCam.rotation.set(pitch, -Math.PI / 2 + yaw, 0);
  photoCam.updateMatrixWorld();
}
function renderPhoto(tau) {
  const fm = state.fmt, f = state.cur.f, N = state.cur.N, s = state.cur.D;
  const K = expo.K, t = state.t;
  // nothing moved and nothing changed (time paused): keep the last exposure and
  // only let the sensor read out again, so the noise stays alive
  const sig = [tau, f, N, s, t, K, state.hold, state.format, lightScale, lightVersion, bikeState.kmh].join();
  const same = sig === photoSig;
  photoSig = sig;
  if (!same) exposeScene(tau, K, t, f, N, s, fm);
  developPhoto(f, N, s, fm);
}
let lastUseBlur = false;
function exposeScene(tau, K, t, f, N, s, fm) {
  focusU.uGlowOn.value = 0;
  renderer.shadowMap.needsUpdate = true;
  // blur radius (px) of a point at infinity; the render has no focus breathing,
  // so the thin-lens disc is scaled by (s − f)/s to match the image scale
  const kPx = ((f * f) / (N * s * 1000)) / fm.w * PW * 0.5;
  packP.u.uFocus.value = s;
  packP.u.uK.value = kPx;
  packP.u.uW.value = 1 / K;
  renderer.setRenderTarget(accRT);
  renderer.clear(true, false, false);
  const jit = rand();
  for (let i = 0; i < K; i++) {
    const ti = tau - t + t * ((i + (K > 1 ? jit : 1)) / K);
    animate(ti);
    aimPhotoCam(ti);
    renderer.setRenderTarget(subRT);
    renderer.clear(true, true, false);
    renderer.render(scene, photoCam);
    accRT.texture.generateMipmaps = i === K - 1;
    runPass(packP, accRT);
  }
  accRT.texture.generateMipmaps = false;
  animate(tau);
  aimPhotoCam(tau);
  // depth of field
  const nearMax = kPx * Math.max(0, (s - 0.62) / 0.62);
  const maxR = Math.min(Math.max(kPx, nearMax), MAX_R);
  const useBlur = (lastUseBlur = maxR > 0.8);
  if (useBlur) {
    const step = Math.max(0.55, (maxR * maxR) / (2 * QUALITY.taps));
    dofP.u.uMaxR.value = maxR;
    dofP.u.uStep.value = step;
    // read colour from a mip whose texels are about as wide as the gap between taps,
    // so sparse taps blur into a smooth disc instead of a ring of dots
    dofP.u.uLod.value = clamp(Math.log2(Math.sqrt(2 * Math.PI * step)) - 0.15, 0, 4.5);
    dofP.u.uSeed.value = photoSeed;
    runPass(dofP, blurRT);
  }
  focusU.uGlowOn.value = 1;
}
function developPhoto(f, N, s, fm) {
  const su = sensorP.u;
  su.uUseBlur.value = lastUseBlur ? 1 : 0;
  su.uExpo.value = expo.gain;
  su.uFWC.value = expo.fwc;
  const g = wbGains(state.wb);
  su.uWB.value.set(g[0], g[1], g[2]);
  su.uSeed.value = photoSeed++;
  su.uVig.value = 1.3 * smooth(clamp((4.5 - N) / 3.1, 0, 1)) + 0.35 * (F_MIN / f);
  runPass(sensorP, finalRT);
  // acceptable blur radius in px, for focus peaking
  displayP.u.uCocOk.value = ((fm.coc * (s * 1000 - f)) / (s * 1000)) / fm.w * PW * 0.5;
  renderer.setRenderTarget(null);
}
function drawPhoto(x, y, w, h, now) {
  const u = displayP.u;
  u.uPeak.value = state.overlays.peak ? 1 : 0;
  u.uZebra.value = state.overlays.zebra ? 1 : 0;
  u.uTime.value = now / 1000;
  renderer.setRenderTarget(null);
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.setScissorTest(true);
  renderer.render(displayP.scene, fsCam);
}

// --- read-backs: the light meter, the histogram, snapshots ------------------------------------
const meterBuf = new Uint8Array(MW * MH * 4), histBuf = new Uint8Array(HW * HH * 4);
const readBusy = { meter: false, hist: false };
let meterAt = 0, histAt = 0;
const histo = { r: new Float32Array(64), g: new Float32Array(64), b: new Float32Array(64), l: new Float32Array(64), clipHi: 0, clipLo: 0, fresh: false };
function readBacks(now) {
  if (!readBusy.meter && now - meterAt > 110) {
    readBusy.meter = true; meterAt = now;
    runPass(meterP, meterRT);
    renderer.readRenderTargetPixelsAsync(meterRT, 0, 0, MW, MH, meterBuf).then(() => {
      let sw = 0, sl = 0, sr = 0, sg = 0, sb = 0;
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const i = (y * MW + x) * 4;
        const r = decLog(meterBuf[i]), g = decLog(meterBuf[i + 1]), b = decLog(meterBuf[i + 2]);
        const dx = (x + 0.5) / MW - 0.5, dy = (y + 0.5) / MH - 0.5;
        const w = 0.3 + Math.exp(-(dx * dx * 1.2 + dy * dy * 2.0) * 10);
        sw += w; sl += w * (0.2126 * r + 0.7152 * g + 0.0722 * b);
        const cap = Math.min(1, 2.5 / Math.max(r, g, b));          // grey-world ignores light sources
        sr += w * r * cap; sg += w * g * cap; sb += w * b * cap;
      }
      state.meterRaw = state.sceneEV + Math.log2(Math.max(1e-6, sl / sw) / 0.18);
      state.meterRGB = [sr / sw, sg / sw, sb / sw];
      if (!state.meterValid) { state.meterEV = state.meterRaw; state.meterValid = true; }
      readBusy.meter = false;
    }).catch(() => { readBusy.meter = false; });
  }
  if (!readBusy.hist && now - histAt > 160) {
    readBusy.hist = true; histAt = now;
    runPass(histP, histRT);
    renderer.readRenderTargetPixelsAsync(histRT, 0, 0, HW, HH, histBuf).then(() => {
      for (const k of ['r', 'g', 'b', 'l']) histo[k].fill(0);
      let hi = 0, lo = 0;
      const n = HW * HH;
      for (let i = 0; i < n * 4; i += 4) {
        const r = histBuf[i], g = histBuf[i + 1], b = histBuf[i + 2];
        histo.r[r >> 2]++; histo.g[g >> 2]++; histo.b[b >> 2]++;
        histo.l[(0.299 * r + 0.587 * g + 0.114 * b) >> 2]++;
        if (Math.max(r, g, b) >= 252) hi++;
        if (Math.max(r, g, b) <= 3) lo++;
      }
      histo.clipHi = hi / n; histo.clipLo = lo / n; histo.fresh = true;
      readBusy.hist = false;
    }).catch(() => { readBusy.hist = false; });
  }
  renderer.setRenderTarget(null);
}
function snapshot() {
  runPass(copyP, snapRT);
  renderer.setRenderTarget(null);
  const buf = new Uint8Array(SW * SH * 4);
  return renderer.readRenderTargetPixelsAsync(snapRT, 0, 0, SW, SH, buf).then(() => {
    const c = document.createElement('canvas');
    c.width = SW; c.height = SH;
    const g = c.getContext('2d'), img = g.createImageData(SW, SH);
    for (let y = 0; y < SH; y++) img.data.set(buf.subarray((SH - 1 - y) * SW * 4, (SH - y) * SW * 4), y * SW * 4);
    g.putImageData(img, 0, 0);
    return c;
  });
}
lensParts.lcd.material = new THREE.ShaderMaterial({
  uniforms: { tImg: { value: finalRT.texture } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tImg; varying vec2 vUv; void main(){ gl_FragColor = vec4(pow(texture2D(tImg, vUv).rgb, vec3(2.2)) * 0.8, 1.0); }',
});
