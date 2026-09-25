
// ---------------------------------------------------------------------------
// Lighting. A studio key lamp plays the sun (or the moon), a sky dome fills in,
// and after dark the valley's own windows, lamps and string lights take over.
//
// Exposure units: after calibration (see the photo module) an 18 % grey card in
// the valley reads exactly 0.18, whatever the preset. The key, the fill, the
// environment and the valley's point lights are scaled together by
// `lightScale` to get there; emissive surfaces and the painted sky are set
// directly in those units, so a bare bulb at night really is hundreds of
// times brighter than the moonlit grass.
// ---------------------------------------------------------------------------
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// The painted sky is sized so a 24 mm photo never sees past it, which makes
// it a wall that hides half the studio in the world view. The camera keeps
// the whole sheet; the world view gets its middle, the size of the old backdrop.
{
  const sheet = valley.children.find((m) => m.isMesh && m.material === skyBackdrop.material) || skyBackdrop;
  sheet.layers.set(LAYER_PHOTO_ONLY);
  sheet.updateMatrixWorld(true);
  const src = sheet.geometry.index ? sheet.geometry.toNonIndexed() : sheet.geometry;
  const pos = src.attributes.position, uv = src.attributes.uv, w = new THREE.Vector3(), P = [], U = [];
  for (let i = 0; i < pos.count; i += 3) {
    let ok = true;
    for (let k = 0; k < 3; k++) if (Math.abs(w.fromBufferAttribute(pos, i + k).applyMatrix4(sheet.matrixWorld).z) > 44) ok = false;
    if (ok) for (let k = 0; k < 3; k++) { P.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)); U.push(uv.getX(i + k), uv.getY(i + k)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  const skyWorld = new THREE.Mesh(g, sheet.material);
  skyWorld.position.copy(sheet.position); skyWorld.quaternion.copy(sheet.quaternion); skyWorld.scale.copy(sheet.scale);
  skyWorld.userData.noFly = true;
  sheet.parent.add(skyWorld);
}

const keyLight = allLayers(new THREE.DirectionalLight(0xffffff, 1));
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
Object.assign(keyLight.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 20, far: 700 });
keyLight.shadow.bias = -0.0004;
keyLight.shadow.normalBias = 0.04;
keyLight.target.position.set(20, 0, 0);
scene.add(keyLight, keyLight.target);
const skyFill = allLayers(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
scene.add(skyFill);
// the room around the bench, seen only in the world view (layer 0)
const roomFill = new THREE.HemisphereLight(0xa9bce0, 0x2b2018, 0.5);
const roomLamp = new THREE.PointLight(0xff9c55, 900, 420, 1.6);
roomLamp.position.set(-150, 70, 80);
scene.add(roomFill, roomLamp);

// Directions: az 0° = light from behind the camera, +90° = from the right (+z).
const sunDirOf = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return V3(-Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); };
const lin = (a) => new THREE.Color(a[0], a[1], a[2]);

// `ev` is the incident-light exposure at the valley (what a hand-held meter
// would read, ISO 100), `lightK` the colour of the key lamp. `glow` sets the
// valley's light sources in exposure units; `world` only styles the view of
// the room (exposure, bloom, the room's own lights).
const PRESETS = {
  sunny: {
    name: '晴天', ev: 15, lightK: 5600,
    key: { az: 38, el: 50, i: 3.0 }, hemi: { i: 1.0, sky: [0.55, 0.7, 1.0], ground: [0.5, 0.45, 0.35] }, env: 0.35,
    sky: 'sunny', skyGain: 1.1, glow: { windows: 0, lamps: 0, string: 0, train: 0 }, points: 0,
    world: { exposure: 1.0, bloom: [0.3, 0.95], room: 1.0 },
  },
  cloudy: {
    name: '阴天', ev: 12, lightK: 6500,
    key: { az: 25, el: 60, i: 0.28 }, hemi: { i: 2.6, sky: [0.9, 0.95, 1.0], ground: [0.45, 0.45, 0.42] }, env: 0.5,
    sky: 'cloudy', skyGain: 1.2, glow: { windows: 0.1, lamps: 0, string: 0, train: 0.2 }, points: 0,
    world: { exposure: 1.0, bloom: [0.3, 0.95], room: 0.9 },
  },
  golden: {
    name: '黄昏', ev: 11, lightK: 3400,
    key: { az: -66, el: 9, i: 2.6 }, hemi: { i: 0.6, sky: [0.45, 0.55, 0.9], ground: [0.55, 0.4, 0.28] }, env: 0.3,
    sky: 'golden', skyGain: 1.0, glow: { windows: 0.5, lamps: 5, string: 14, train: 5 }, points: 0.25,
    world: { exposure: 0.95, bloom: [0.32, 1.4], room: 0.8 },
  },
  night: {
    name: '夜晚', ev: 3.5, lightK: 3000, moonK: 8200,
    key: { az: 150, el: 36, i: 0.12 }, hemi: { i: 0.1, sky: [0.35, 0.45, 0.9], ground: [0.25, 0.22, 0.2] }, env: 0.12,
    sky: 'night', skyGain: 0.35, glow: { windows: 3, lamps: 90, string: 150, train: 70 }, points: 1,
    world: { exposure: 0.68, bloom: [0.22, 7], room: 0.5 },
  },
};
const PRESET_KEYS = ['sunny', 'cloudy', 'golden', 'night'];
const lightNominal = { key: 1, hemi: 1, env: 0.3, points: 0 };
let lightScale = 1, lightVersion = 0;
function setLightScale(k) {
  lightScale = k;
  keyLight.intensity = lightNominal.key * k;
  skyFill.intensity = lightNominal.hemi * k;
  scene.environmentIntensity = lightNominal.env * k;
  for (const l of valleyPoints) l.intensity = (l.userData.base || 1) * lightNominal.points * k;
}
// each glow group keeps its members' relative strengths; the brightest gets `level`
const GLOW_MAX = {};
for (const g in VALLEY_GLOW) GLOW_MAX[g] = Math.max(1e-6, ...VALLEY_GLOW[g].map((e) => e.base));
const GLOW_K = { windows: 2900, lamps: 0, string: 2400, train: 3600 };   // 0: the lamps follow state.lightK at night
// apply a preset's look; the key lamp's colour comes from state.lightK
function applyLighting() {
  lightVersion++;
  const p = PRESETS[state.preset];
  const night = state.preset === 'night';
  const dir = sunDirOf(p.key.az, p.key.el);
  keyLight.position.copy(keyLight.target.position).addScaledVector(dir, 400);
  keyLight.color.copy(kelvinColor(night ? p.moonK : state.lightK));
  keyLight.shadow.radius = state.preset === 'cloudy' ? 8 : 2;
  lightNominal.key = p.key.i;
  skyFill.color.copy(lin(p.hemi.sky)); skyFill.groundColor.copy(lin(p.hemi.ground));
  lightNominal.hemi = p.hemi.i;
  lightNominal.env = p.env;
  lightNominal.points = p.points;
  const lampC = kelvinColor(night ? state.lightK : 2900);
  for (const l of valleyPoints) { l.color.copy(lampC); l.visible = p.points > 0; }
  for (const g in VALLEY_GLOW) {
    const c = GLOW_K[g] ? kelvinColor(GLOW_K[g]) : lampC;
    for (const e of VALLEY_GLOW[g]) { e.mat.emissive.copy(c); e.mat.emissiveIntensity = (p.glow[g] || 0) * (e.base / GLOW_MAX[g]); }
  }
  skyBackdrop.material.map = SKY_TEX[p.sky];
  skyBackdrop.material.color.setScalar(p.skyGain);
  skyBackdrop.material.needsUpdate = true;
  roomFill.intensity = 0.55 * p.world.room;
  roomLamp.intensity = 900 * p.world.room;
  setLightScale(lightScale);
}
