import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
window.__pofBoot = true;

// ---------------------------------------------------------------------------
// Optics. Distances in the world are centimetres, measured from the lens's
// optical centre at x = 0; the optical axis runs along +x toward the valley.
// ---------------------------------------------------------------------------
const LENS_F = 50;                 // mm
const SENSOR_W = 36, SENSOR_H = 24; // mm, full frame
const COC = 0.03;                  // mm
const FOCUS_MIN = 25, FOCUS_MAX = 95;
const N_MIN = 2, N_MAX = 16;
const FOCUS_PRESETS = [38, 52, 78];
const AP_PRESETS = [2, 5.6, 16];
const HFOV = 2 * Math.atan(SENSOR_W / 2 / LENS_F);
const VFOV = 2 * Math.atan(SENSOR_H / 2 / LENS_F);
const TAN_H = Math.tan(HFOV / 2), TAN_V = Math.tan(VFOV / 2);

const AXIS_Y = 12;
const GLASS_W = 24, GLASS_H = 16;
const GLASS_X = -(GLASS_W / 2) / TAN_H;   // image distance that matches a 50 mm field of view
const LAYER_PHOTO = 1;

const CYAN = new THREE.Color(0x7fe3ff);
const AMBER = new THREE.Color(0xffb454);

function dofLimits(sCm, N) {
  const s = sCm * 10, f = LENS_F;
  const H = f * f / (N * COC) + f;
  const near = s * (H - f) / (H + s - 2 * f);
  const far = s < H ? s * (H - f) / (H - s) : Infinity;
  return { near: near / 10, far: far / 10 };
}
// blur-disc diameter on the sensor, mm
function cocMm(dCm, sCm, N) {
  const s = sCm * 10, d = dCm * 10, f = LENS_F;
  return (f * f / (N * (s - f))) * Math.abs(d - s) / d;
}
// how far the focusing group sits out from infinity, mm
function extensionMm(sCm) { const s = sCm * 10; return LENS_F * LENS_F / (s - LENS_F); }

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const rand = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

const SUBJECTS = [
  { key: 'pine', name: '松树', pos: new THREE.Vector3(38, 14, -7) },
  { key: 'cabin', name: '小屋', pos: new THREE.Vector3(52, 8.6, 6) },
  { key: 'peak', name: '山峰', pos: new THREE.Vector3(78, 25, -2) },
];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

const state = {
  focus: 38, focusTarget: 38,
  logN: Math.log(2), NTarget: 2,
  explode: 1, explodeTarget: 1,
  cinematic: !reduceMotion,
  lastControlAt: -1e9,
  get N() { return Math.exp(this.logN); },
};

// ---------------------------------------------------------------------------
// Renderer, scene, lights
// ---------------------------------------------------------------------------
const worldEl = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.localClippingEnabled = true;
worldEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.36;

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 1, 1200);
camera.layers.enable(LAYER_PHOTO);

function allLayers(o) { o.layers.enableAll(); return o; }
const hemi = allLayers(new THREE.HemisphereLight(0xa9c2ff, 0x2b2018, 0.6));
scene.add(hemi);
const key = allLayers(new THREE.DirectionalLight(0xffe4c4, 2.15));
key.position.set(22, 120, 85);
key.target.position.set(28, 0, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -95, right: 95, top: 80, bottom: -80, near: 20, far: 320 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
scene.add(key, key.target);
const rim = allLayers(new THREE.DirectionalLight(0x86a8ff, 0.9));
rim.position.set(-80, 40, -90);
scene.add(rim);
const warmRoom = new THREE.PointLight(0xff9c55, 900, 260, 1.6);
warmRoom.position.set(-95, 40, 30);
scene.add(warmRoom);

// shared uniforms that paint the plane-of-focus line onto the valley
const focusU = {
  uFocusX: { value: 38 }, uNearX: { value: 37 }, uFarX: { value: 39 }, uGlowOn: { value: 1 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
}
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
function toPhotoLayer(o) { o.traverse((m) => m.layers.enable(LAYER_PHOTO)); return o; }
// geometry built along +y (lathe, cylinder) turned to run along +x
function alongX(g) { g.rotateZ(-Math.PI / 2); return g; }

// Inject the glowing focus line + sharp-zone tint into a standard material.
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
      .replace('#include <common>', '#include <common>\nvarying vec3 vFW;\nuniform float uFocusX, uNearX, uFarX, uGlowOn;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float pofDist = abs(vFW.x - uFocusX);
        float pofLine = 1.0 - smoothstep(0.05, 0.42, pofDist);
        float pofZone = smoothstep(uNearX - 0.3, uNearX, vFW.x) * (1.0 - smoothstep(uFarX, uFarX + 0.3, vFW.x));
        totalEmissiveRadiance += uGlowOn * (vec3(0.5, 0.9, 1.0) * pofLine * 2.6 + vec3(0.3, 0.75, 1.0) * pofZone * 0.10);`);
  };
  mat.customProgramCacheKey = () => 'focusGlow';
  return mat;
}
