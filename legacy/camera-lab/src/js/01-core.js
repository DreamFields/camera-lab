import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
window.__labBoot = true;

// ---------------------------------------------------------------------------
// Units. The world is in metres: the lens sits at (0, EYE, 0) and looks down
// +x, +z is the right-hand side of the frame, +y is up. Sensor sizes, focal
// lengths and blur discs are in millimetres, the way a camera spec sheet has
// them. Every number the page shows comes out of the formulas below.
// ---------------------------------------------------------------------------
const EYE = 1.5;
const FF_DIAG = Math.hypot(36, 24);
function sensor(key, name, w, h) {
  const crop = FF_DIAG / Math.hypot(w, h);
  return { key, name, w, h, crop, coc: 0.03 / crop, area: (w * h) / (36 * 24) };
}
const FORMATS = {
  ff: sensor('ff', '全画幅', 36, 24),
  apsc: sensor('apsc', 'APS-C', 23.5, 15.6),
  m43: sensor('m43', 'M4/3', 17.3, 11.5),
};

// the click-stops a camera actually offers: 1/3 EV apart
const N_STOPS = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
const T_STOPS = [25, 30, 40, 50, 60, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000];
const ISO_STOPS = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600];
const FULL_N = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const FULL_T = [30, 60, 125, 250, 500, 1000, 2000];
const FULL_ISO = [100, 400, 1600, 6400, 25600];
const F_MIN = 24, F_MAX = 135, F_MARKS = [24, 28, 35, 50, 70, 85, 105, 135];
const D_MIN = 0.5, D_MAX = 20, D_MARKS = [0.5, 0.7, 1, 1.5, 2, 3, 5, 10, 20];
const K_MIN = 2800, K_MAX = 8000;
const COMP_MAX = 3;

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
function fmtM(m, unit = true) {
  if (!isFinite(m)) return '∞';
  const s = m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : Math.round(m).toString();
  return unit ? s + ' m' : s;
}
const fmtF = (f) => Math.round(f) + ' mm';
const fmtK = (k) => Math.round(k / 50) * 50 + ' K';
const fmtEV = (e, digits = 1) => (e >= 0.05 ? '+' : e <= -0.05 ? '−' : '±') + Math.abs(e).toFixed(digits);

// ---------------------------------------------------------------------------
// Optics, exposure and the sensor, all in one place.
// ---------------------------------------------------------------------------
const LAMBDA = 0.00055;   // mm, green light: sets the size of the diffraction disc
const SHAKE_W = 0.035;    // rad/s, how fast a steady adult hand drifts
const FWC_FF = 48000;     // electrons one displayed pixel holds at ISO 100 on full frame
const READ_E = 3;         // read noise, electrons
const Opt = {
  // exposure value of a setting, normalised to ISO 100
  ev: (N, t, iso) => Math.log2((N * N) / t) - Math.log2(iso / 100),
  // hyperfocal distance, mm
  hyper: (f, N, c) => (f * f) / (N * c) + f,
  // near / far limits of acceptable sharpness, metres
  dof(sM, f, N, c) {
    const s = sM * 1000, H = Opt.hyper(f, N, c);
    const near = (s * (H - f)) / (H + s - 2 * f);
    const far = s < H ? (s * (H - f)) / (H - s) : Infinity;
    return { near: near / 1000, far: far / 1000, H: H / 1000 };
  },
  // blur-disc diameter on the sensor of a point at dM when focused at sM, mm
  coc(dM, sM, f, N) {
    const s = sM * 1000, d = dM * 1000;
    return ((f * f) / (N * (s - f))) * (Math.abs(d - s) / d);
  },
  cocInf: (sM, f, N) => (f * f) / (N * (sM * 1000 - f)),
  airy: (N) => 2.44 * LAMBDA * N,
  fov: (f, size) => 2 * Math.atan(size / (2 * f)),
  mag: (sM, f) => f / (sM * 1000 - f),
  // how far a subject crossing the frame at v m/s smears on the sensor, mm
  motion: (v, dM, f, t) => (v * t * f) / dM,
  // camera shake smear, mm (stops = stabiliser gain)
  shake: (f, t, stops) => ((f * SHAKE_W) / 2 ** stops) * t,
  // electrons at clipping and signal-to-noise for a raw level (1 = clipped)
  fwc: (iso, fmt) => (FWC_FF * fmt.area * 100) / iso,
  snr(level, iso, fmt) { const e = level * Opt.fwc(iso, fmt); return e / Math.sqrt(e + READ_E * READ_E); },
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

const coarse = matchMedia('(pointer: coarse)').matches;
const QUALITY = coarse
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
  N: 2.8, t: 1 / 250, iso: 100, f: 85, D: 3, wb: 5200, awb: false,
  hold: 'tripod',                       // tripod | hand | handIS
  isStops: 4,
  timeScale: 1,
  cur: { N: 2.8, f: 85, D: 3 },
  meterEV: 11, meterValid: false,
  meterRGB: [1, 1, 1],
  keyLightK: 3400,
  view: 'photo',
  overlays: { grid: true, peak: false, zebra: false, hist: true, tags: true },
  active: 'N',
  lastUserAt: -1e9,
  get fmt() { return FORMATS[this.format]; },
};

// ---------------------------------------------------------------------------
// Renderer and scene. One canvas covers the window; the photo and the world
// view are drawn into the rectangles of two DOM slots.
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
renderer.domElement.id = 'gl';
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const LAYER_PHOTO = 1, LAYER_CAL = 2;
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
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const FONT = '"Noto Sans SC","PingFang SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif';
const MONO = '"DM Mono",ui-monospace,Menlo,Consolas,monospace';

// Shared uniforms that paint the plane of focus onto every surface in the
// world view: a bright line where the plane cuts an object, a faint tint over
// the depth of field. The photo camera renders with the glow switched off.
const focusU = {
  uFocusX: { value: 3 }, uNearX: { value: 2.7 }, uFarX: { value: 3.4 }, uGlowOn: { value: 1 }, uLineW: { value: 0.04 },
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
        totalEmissiveRadiance += uGlowOn * (vec3(0.5, 0.9, 1.0) * pofLine * 1.3 + vec3(0.3, 0.75, 1.0) * pofZone * 0.05);`);
  };
  mat.customProgramCacheKey = () => 'focusGlow';
  return mat;
}

// Merge every rigid mesh under `root` that shares a material into one mesh, so
// the scene costs a few dozen draw calls per render instead of hundreds — it
// is rendered up to 16 times a frame for motion blur. Subtrees in `skip`
// (wheels, legs, anything animated) and instanced / multi-material meshes stay.
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
  // drop groups left empty
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
