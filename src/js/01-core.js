import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
window.__labBoot = true;

// ---------------------------------------------------------------------------
// Units. The world is in centimetres. The lens's optical centre sits at
// (0, AXIS_Y, 0) and looks down +x at a miniature valley 25–95 cm away; +z is
// the right-hand side of the frame, +y is up. Focal lengths, sensor sizes and
// blur discs are in millimetres, the way a camera spec sheet has them.
//
// The camera itself is a demonstration model: the body is built at 2.5 × life
// size (a 9 × 6 cm sensor), and it slides back along the rail as the lens
// zooms — longer lens, longer image distance, same sensor, narrower view. The
// image distance grows at the body's own scale, IMG_K cm per millimetre of
// focal length, on top of IMG_0 cm that keep the body clear of the lens's
// rear group at 24 mm.
// ---------------------------------------------------------------------------
const AXIS_Y = 16;          // height of the optical axis above the rail
const RISE = 4;             // the valley tray sits on a riser, level with the axis
const IMG_K = 0.25;         // cm of image distance per mm of focal length (2.5 ×, like the body)
const IMG_0 = 6;            // cm on top: 12 cm at 24 mm, just clear of the lens's rear group (retune with IMG_K)
const SEN_K = 0.25;         // cm of model sensor per mm of real sensor (9 × 6 cm)
const FLANGE = 4.5;         // cm from the lens mount face to the sensor
const imageDist = (f) => IMG_0 + IMG_K * f;   // cm, optical centre to sensor
const sensorX = (f) => -imageDist(f);
const mountX = (f) => sensorX(f) + FLANGE;

const FF_DIAG = Math.hypot(36, 24);
function sensorFmt(key, name, w, h) {
  const crop = FF_DIAG / Math.hypot(w, h);
  return { key, name, w, h, crop, coc: 0.03 / crop, area: (w * h) / (36 * 24) };
}
const FORMATS = {
  ff: sensorFmt('ff', '全画幅', 36, 24),
  apsc: sensorFmt('apsc', 'APS-C', 23.5, 15.6),
  m43: sensorFmt('m43', 'M4/3', 17.3, 11.5),
};

// the click-stops a camera actually offers: 1/3 EV apart
const N_STOPS = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
const T_STOPS = [25, 30, 40, 50, 60, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000];
const ISO_STOPS = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600];
const FULL_N = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const FULL_T = [25, 60, 125, 250, 500, 1000, 2000];
const FULL_ISO = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600];
const F_MIN = 24, F_MAX = 135, F_MARKS = [24, 28, 35, 50, 70, 85, 105, 135];
const D_MIN = 25, D_MAX = 100, D_MARKS = [25, 30, 35, 40, 50, 60, 70, 80, 100];
const K_MIN = 2800, K_MAX = 8000;
const COMP_MAX = 3;
const TRAIN_MAX = 40;       // cm/s

// piecewise-logarithmic position of a value inside a stop table (0 … len-1)
function stopIndex(v, list) {
  if (v <= list[0]) return 0;
  const n = list.length - 1;
  if (v >= list[n]) return n;
  let i = 0;
  while (list[i + 1] < v) i++;
  return i + Math.log(v / list[i]) / Math.log(list[i + 1] / list[i]);
}
function nearestStop(v, list) {
  let best = list[0];
  for (const s of list) if (Math.abs(Math.log(s / v)) < Math.abs(Math.log(best / v))) best = s;
  return best;
}
const logPos = (v, a, b) => Math.log(v / a) / Math.log(b / a);
const logVal = (p, a, b) => a * (b / a) ** p;

// --- formatting: like a camera, show the nearest marked stop --------------------------
const fmtN = (N) => 'ƒ/' + nearestStop(N, N_STOPS);
function fmtT(t) {
  if (t > 1 / 25 * 1.12) return t >= 1 ? t.toFixed(1).replace(/\.0$/, '') : '1/' + Math.round(1 / t);
  return '1/' + nearestStop(1 / t, T_STOPS);
}
const fmtISO = (iso) => String(nearestStop(iso, ISO_STOPS));
// a length in cm, in the unit that reads best
function fmtLen(cm, unit = true) {
  if (!isFinite(cm)) return '∞';
  let s, u;
  if (cm < 1) { const mm = cm * 10; s = mm < 1 ? mm.toFixed(2) : mm.toFixed(1); u = 'mm'; }
  else if (cm < 100) { s = cm.toFixed(1); u = 'cm'; }
  else { s = (cm / 100).toFixed(2); u = 'm'; }
  s = s.replace(/\.0$/, '');
  return unit ? s + ' ' + u : s;
}
const fmtF = (f) => Math.round(f) + ' mm';
const fmtK = (k) => Math.round(k / 50) * 50 + ' K';
const fmtEV = (e, digits = 1) => (e >= 0.05 ? '+' : e <= -0.05 ? '−' : '±') + Math.abs(e).toFixed(digits);

// ---------------------------------------------------------------------------
// Optics, exposure and the sensor, all in one place. Distances in cm.
// ---------------------------------------------------------------------------
const LAMBDA = 0.00055;   // mm, green light: sets the size of the diffraction disc
const SHAKE_W = 0.035;    // rad/s, how fast an unsteady mount drifts (a steady adult hand)
const FWC_FF = 48000;     // electrons one displayed pixel holds at ISO 100 on full frame
const READ_E = 3;         // read noise, electrons
const Opt = {
  // exposure value of a setting, normalised to ISO 100
  ev: (N, t, iso) => Math.log2((N * N) / t) - Math.log2(iso / 100),
  // hyperfocal distance, mm
  hyper: (f, N, c) => (f * f) / (N * c) + f,
  // near / far limits of acceptable sharpness and the hyperfocal distance, cm
  dof(sCm, f, N, c) {
    const s = sCm * 10, H = Opt.hyper(f, N, c);
    const near = (s * (H - f)) / (H + s - 2 * f);
    const far = s < H ? (s * (H - f)) / (H - s) : Infinity;
    return { near: near / 10, far: far / 10, H: H / 10 };
  },
  // blur-disc diameter on the sensor of a point at dCm when focused at sCm, mm
  coc(dCm, sCm, f, N) {
    const s = sCm * 10, d = dCm * 10;
    return ((f * f) / (N * (s - f))) * (Math.abs(d - s) / d);
  },
  cocInf: (sCm, f, N) => (f * f) / (N * (sCm * 10 - f)),
  airy: (N) => 2.44 * LAMBDA * N,
  fov: (f, size) => 2 * Math.atan(size / (2 * f)),
  mag: (sCm, f) => f / (sCm * 10 - f),
  // how far a subject crossing the frame at v cm/s, dCm away, smears on the sensor, mm
  motion: (v, dCm, f, t) => (v * t * f) / dCm,
  // shake smear, mm (stops = stabiliser gain)
  shake: (f, t, stops) => ((f * SHAKE_W) / 2 ** stops) * t,
  // electrons at clipping and signal-to-noise for a raw level (1 = clipped)
  fwc: (iso, fmt) => (FWC_FF * fmt.area * 100) / iso,
  snr(level, iso, fmt) { const e = level * Opt.fwc(iso, fmt); return e / Math.sqrt(e + READ_E * READ_E); },
  // how far the focusing group sits out from infinity, mm
  extension: (sCm, f) => (f * f) / (sCm * 10 - f),
};

// --- colour temperature ---------------------------------------------------------------
// Planckian locus (Krystek 1985, CIE 1960 uv) → XYZ → linear sRGB with Y = 1.
function kelvinRGB(T) {
  const u = (0.860117757 + 1.54118254e-4 * T + 1.28641212e-7 * T * T) / (1 + 8.42420235e-4 * T + 7.08145163e-7 * T * T);
  const v = (0.317398726 + 4.22806245e-5 * T + 4.20481691e-8 * T * T) / (1 - 2.89741816e-5 * T + 1.61456053e-7 * T * T);
  const den = 2 * u - 8 * v + 4, x = (3 * u) / den, y = (2 * v) / den;
  const X = x / y, Z = (1 - x - y) / y;
  const r = 3.2404542 * X - 1.5371385 - 0.4985314 * Z;
  const g = -0.969266 * X + 1.8760108 + 0.041556 * Z;
  const b = 0.0556434 * X - 0.2040259 + 1.0572252 * Z;
  return [Math.max(r, 1e-4), Math.max(g, 1e-4), Math.max(b, 1e-4)];
}
function kelvinColor(T, gain = 1) { const [r, g, b] = kelvinRGB(T); return new THREE.Color(r * gain, g * gain, b * gain); }
// the camera multiplies raw red and blue so that a light of temperature T turns grey
function wbGains(T) { const [r, g, b] = kelvinRGB(T); return [g / r, 1, g / b]; }
const mired = (T) => 1e6 / T;
const K_TABLE = [];
for (let T = 1800; T <= 14000; T += 25) { const [r, g, b] = kelvinRGB(T); K_TABLE.push([T, Math.log(r / g), Math.log(b / g)]); }
// nearest blackbody to an rgb light colour
function estimateKelvin(r, g, b) {
  const lr = Math.log(r / g), lb = Math.log(b / g);
  let best = 6500, bd = Infinity;
  for (const [T, R, B] of K_TABLE) { const d = (R - lr) ** 2 + (B - lb) ** 2; if (d < bd) { bd = d; best = T; } }
  return best;
}

// --- small helpers ---------------------------------------------------------------------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const rand = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
// ?lite: a lighter photo pipeline for slow machines (and for headless tests)
const LITE = /[?&]lite\b/.test(location.search);
const QUALITY = LITE
  ? { photoW: 540, kMax: 3, taps: 60, shadow: 1024, worldDpr: 1 }
  : coarse
    ? { photoW: 840, kMax: 8, taps: 96, shadow: 1024, worldDpr: 1.5 }
    : { photoW: 1080, kMax: 16, taps: 150, shadow: 2048, worldDpr: 1.75 };

// ---------------------------------------------------------------------------
// State. Values the user sets live at the top level; `cur` holds the values
// the optics are showing right now, which ease toward them.
// ---------------------------------------------------------------------------
const state = {
  preset: 'golden',
  sceneEV: 11, lightK: 3400,            // what the light is doing
  format: 'ff',
  mode: 'M', autoISO: false, comp: 0,   // how the camera meters
  nd: 0,                                // stops cut by an ND filter
  N: 2, t: 1 / 500, iso: 100, f: 50, D: 38, wb: 5200, awb: false,
  hold: 'tripod',                       // tripod (减震开) | hand (减震关) | handIS (减震关 + 防抖)
  isStops: 4,
  trainSpeed: 16,                       // cm/s
  timeScale: 1,
  cur: { N: 2, f: 50, D: 38 },
  meterEV: 11, meterValid: false,
  meterRGB: [1, 1, 1],
  keyLightK: 3400,
  explode: 1, explodeTarget: 1,         // 1 = the lens taken apart, the body cut open
  cinematic: !reduceMotion,
  bigView: false,
  overlays: { grid: true, peak: false, zebra: false, hist: true, tags: true },
  // optional modules; the core (six parameters, readouts, light) is always on
  modules: { brain: false, kit: false, lab: false, shoot: false },
  active: 'N',
  lastUserAt: -1e9,
  get fmt() { return FORMATS[this.format]; },
};

// ---------------------------------------------------------------------------
// Renderer and scene. One canvas covers the window: normally the world (the
// bench, the camera, the valley), or the finished photo in the big viewer.
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.localClippingEnabled = true;
renderer.domElement.id = 'gl';
document.getElementById('world').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const LAYER_PHOTO = 1, LAYER_CAL = 2, LAYER_PHOTO_ONLY = 3;   // 3: seen by the photo, hidden from the world view
function allLayers(o) { o.layers.enableAll(); return o; }
function toPhoto(o) { o.traverse((m) => m.layers.enable(LAYER_PHOTO)); return o; }

function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o }); }
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function shadows(o, cast = true, receive = true) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
  return o;
}
// geometry built along +y (lathe, cylinder) turned to run along +x
function alongX(g) { g.rotateZ(-Math.PI / 2); return g; }
const FONT = '"Noto Sans SC","PingFang SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif';
const MONO = '"DM Mono",ui-monospace,Menlo,Consolas,monospace';
const CYAN = new THREE.Color(0x7fe3ff);
const AMBER = new THREE.Color(0xffb454);

// Shared uniforms that paint the plane of focus onto every surface in the
// world view: a bright line where the plane cuts an object, a faint tint over
// the depth of field. The photo camera renders with the glow switched off.
const focusU = {
  uFocusX: { value: 38 }, uNearX: { value: 37.7 }, uFarX: { value: 38.3 }, uGlowOn: { value: 1 }, uLineW: { value: 0.28 },
};
function focusGlow(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, focusU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 pofW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          pofW = instanceMatrix * pofW;
        #endif
        vFW = (modelMatrix * pofW).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFW;\nuniform float uFocusX, uNearX, uFarX, uGlowOn, uLineW;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // flat shading takes the normal from screen-space derivatives; a
        // degenerate pixel quad would otherwise light the surface with NaN
        if (any(isnan(normal))) normal = vec3(0.0, 1.0, 0.0);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float pofDist = abs(vFW.x - uFocusX);
        float pofLine = 1.0 - smoothstep(uLineW * 0.35, uLineW, pofDist);
        float pofZone = smoothstep(uNearX - uLineW, uNearX, vFW.x) * (1.0 - smoothstep(uFarX, uFarX + uLineW, vFW.x));
        totalEmissiveRadiance += uGlowOn * (vec3(0.5, 0.9, 1.0) * pofLine * 2.2 + vec3(0.3, 0.75, 1.0) * pofZone * 0.08);`);
  };
  mat.customProgramCacheKey = () => 'focusGlow';
  return mat;
}

// Merge every rigid mesh under `root` that shares a material into one mesh, so
// the valley costs a few dozen draw calls per render instead of hundreds — it
// is rendered up to 16 times a frame for motion blur. Subtrees in `skip`
// (the train, the windmill blades, anything animated) and instanced /
// multi-material meshes stay as they are.
const KEEP_ATTR = ['position', 'normal', 'uv', 'color'];
function bakeStatic(root, skip = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), done = [];
  const walk = (o) => {
    if (skip.includes(o)) return;
    if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && o.geometry.attributes.normal) {
      const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      for (const name of Object.keys(g.attributes)) if (!KEEP_ATTR.includes(name) || (name === 'color' && !o.material.vertexColors)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.clearGroups();
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
      buckets.get(key).geos.push(g);
      done.push(o);
    }
    for (const c of o.children) walk(c);
  };
  for (const c of root.children) walk(c);
  for (const o of done) o.removeFromParent();
  const prune = (o) => { for (const c of [...o.children]) prune(c); if (o !== root && o.isGroup && !o.children.length) o.removeFromParent(); };
  prune(root);
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv;
    root.add(m);
  }
  return root;
}

// ---------------------------------------------------------------------------
// Shared hardware: materials, the cut-away plane, tubes and gears for the lens,
// the body and the console, and flat text for scales and dials.
// ---------------------------------------------------------------------------
const blackMat = std(0x16181d, { roughness: 0.55, metalness: 0.35 });
const chromeMat = std(0xd9dde4, { metalness: 1, roughness: 0.22 });
const copperMat = std(0xd9823a, { metalness: 1, roughness: 0.33 });
const alu = std(0xa9b1bd, { metalness: 0.9, roughness: 0.34 });
const darkSteel = std(0x1a1d23, { metalness: 0.55, roughness: 0.45 });
const rubberTex = canvasTex(256, 16, (g, w, h) => {
  g.fillStyle = '#1c1e23'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { g.fillStyle = '#0b0c0f'; g.fillRect(x, 0, 3, h); }
});
rubberTex.wrapS = rubberTex.wrapT = THREE.RepeatWrapping;
rubberTex.repeat.set(12, 1);
const rubberMat = std(0xffffff, { map: rubberTex, roughness: 0.9 });
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xeaf8ff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 1.2, ior: 1.52,
  attenuationColor: new THREE.Color(0x9fe0ff), attenuationDistance: 14, specularIntensity: 1, envMapIntensity: 1.4,
});
const rimMat = new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(1.6) });

// The cut-away. When the camera is taken apart, housings lose the slice that
// faces the viewer (z > cutPlane.constant) below AXIS_Y + 3: the glass, the
// iris, the shutter and the sensor show through, while the tops of the rings
// and dials — where their scales are read — stay. Clipping is an intersection:
// a fragment goes only when it is on the clipped side of every plane.
// Assembled, cutPlane.constant is 60 and nothing is clipped.
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 60);   // clips z > constant
const cutTop = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(AXIS_Y + 3));   // clips y < AXIS_Y + 3
const cutMats = [];
function cuttable(m, planes = [cutPlane, cutTop]) {
  const c = m.clone();
  c.clippingPlanes = planes; c.clipIntersection = true; c.side = THREE.DoubleSide;
  cutMats.push(c);
  return c;
}

// tube along x from x0 to x1 with outer radius ro, inner radius ri
function tube(x0, x1, ro, ri, mat, seg = 64) {
  const pts = [new THREE.Vector2(ri, x0), new THREE.Vector2(ro, x0), new THREE.Vector2(ro, x1), new THREE.Vector2(ri, x1), new THREE.Vector2(ri, x0)];
  return new THREE.Mesh(alongX(new THREE.LatheGeometry(pts, seg)), mat);
}
// a gear ring: teeth around a cylinder, along x from x0 to x1
function gear(x0, x1, r, teeth, depth, mat) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, da = Math.PI * 2 / teeth;
    const pts = [[r, a], [r + depth, a + da * 0.18], [r + depth, a + da * 0.5], [r, a + da * 0.68]];
    pts.forEach(([rr, aa], k) => (i === 0 && k === 0 ? s.moveTo : s.lineTo).call(s, rr * Math.cos(aa), rr * Math.sin(aa)));
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r - 1.1, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false, curveSegments: 24 });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return new THREE.Mesh(g, mat);
}

// Flat text on a plane `h` cm tall (the cap height of the text), facing +z.
// Composited through the world view's tone mapping, so it is drawn a little
// brighter than it should read.
function labelPlane(text, h, o = {}) {
  const { color = '#dfe6f2', font = MONO, weight = 500, bg = null, pad = 0.2, gain = 1.35 } = o;
  const px = 72;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const f = `${weight} ${px}px ${font}`;
  g.font = f;
  c.width = Math.max(8, Math.ceil(g.measureText(text).width + px * pad * 2));
  c.height = Math.ceil(px * (1 + pad * 2));
  g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2 + px * 0.05);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const hh = h * (1 + pad * 2), ww = (hh * c.width) / c.height;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: new THREE.Color(gain, gain, gain) }));
  m.userData.w = ww; m.userData.h = hh;
  return m;
}
// Labels around a circle in the XY plane (facing +z). An entry at position p
// (0 … 1) sits at angle psi0 − p·span, so a knob whose pointer starts at psi0
// points at it when rotation.z = −p·span. The same group laid flat with
// rotateX(−π/2) marks a dial that turns about +y: rotation.y = +p·span brings
// the entry at p round to psi0.
function arcLabels(entries, { r, psi0 = Math.PI * 1.25, span = Math.PI * 1.5, h = 0.8, radial = false, ...o }) {
  const g = new THREE.Group();
  for (const e of entries) {
    const a = psi0 - e.p * span;
    const m = labelPlane(e.text, e.h || h, { ...o, color: e.color || o.color });
    m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.01);
    // radial: false keeps labels upright, 'out' turns their tops away from the centre, 'in' toward it
    if (radial === 'out' || radial === true) m.rotation.z = a - Math.PI / 2;
    else if (radial === 'in') m.rotation.z = a + Math.PI / 2;
    g.add(m);
  }
  return g;
}
// tick marks for the same arc: [p, length] pairs, from radius r outward
function arcTicks(ticks, { r, psi0 = Math.PI * 1.25, span = Math.PI * 1.5, color = 0xc9d2e2, gain = 1.3 }) {
  const pts = [];
  for (const [p, len] of ticks) {
    const a = psi0 - p * span, c = Math.cos(a), s = Math.sin(a);
    pts.push(c * r, s * r, 0.01, c * (r + len), s * (r + len), 0.01);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(gain) }));
}
