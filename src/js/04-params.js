
// ---------------------------------------------------------------------------
// Parameters. Every control on the bench — a ring on the lens, a dial on the
// body, a knob or fader on the console — turns one of these. `p` maps a value
// to its position along the control's travel (0 … 1) and `v` maps it back,
// snapping to the camera's click-stops; `stops` is the number of detents
// (0 = continuous).
// ---------------------------------------------------------------------------
const sim = { tau: 2.4 };      // scene time, seconds
const snapF = (f) => { for (const m of F_MARKS) if (Math.abs(Math.log(f / m)) < 0.025) return m; return Math.round(f); };
const roundD = (d) => (d < 50 ? Math.round(d * 10) / 10 : Math.round(d * 2) / 2);
const ND_STEPS = [0, 3, 6, 10];
const FORMAT_KEYS = ['ff', 'apsc', 'm43'];
const HOLD_KEYS = ['tripod', 'hand', 'handIS'];
const HOLD_NAMES = { tripod: '减震开', hand: '减震关', handIS: '减震关 + 防抖' };
const MODE_NAMES = { M: 'M 全手动', A: 'A 光圈优先', S: 'S 快门优先' };
const listParam = (list, get) => ({
  stops: list.length - 1,
  p: (v) => Math.max(0, list.indexOf(v)) / (list.length - 1),
  v: (p) => list[clamp(Math.round(p * (list.length - 1)), 0, list.length - 1)],
  get,
});
const PARAMS = {
  N: {
    name: '光圈', sym: 'N', hint: '曝光 · 景深 · 衍射', tab: 'dof', stops: N_STOPS.length - 1,
    get: () => state.N, p: (v) => stopIndex(v, N_STOPS) / (N_STOPS.length - 1), v: (p) => N_STOPS[clamp(Math.round(p * (N_STOPS.length - 1)), 0, N_STOPS.length - 1)], fmt: fmtN,
  },
  t: {
    name: '快门', sym: 't', hint: '曝光 · 运动模糊 · 抖动', tab: 'motion', stops: T_STOPS.length - 1,
    get: () => state.t, p: (v) => stopIndex(1 / v, T_STOPS) / (T_STOPS.length - 1), v: (p) => 1 / T_STOPS[clamp(Math.round(p * (T_STOPS.length - 1)), 0, T_STOPS.length - 1)], fmt: (v) => fmtT(v) + ' s',
  },
  iso: {
    name: 'ISO', sym: 'S', hint: '画面亮度 · 噪点', tab: 'iso', stops: ISO_STOPS.length - 1,
    get: () => state.iso, p: (v) => stopIndex(v, ISO_STOPS) / (ISO_STOPS.length - 1), v: (p) => ISO_STOPS[clamp(Math.round(p * (ISO_STOPS.length - 1)), 0, ISO_STOPS.length - 1)], fmt: fmtISO,
  },
  f: {
    name: '焦距', sym: 'f', hint: '视角 · 像距 · 景深', tab: 'fov', stops: 0,
    get: () => state.f, p: (v) => logPos(v, F_MIN, F_MAX), v: (p) => clamp(snapF(logVal(clamp(p, 0, 1), F_MIN, F_MAX)), F_MIN, F_MAX), fmt: fmtF,
  },
  D: {
    name: '对焦', sym: 'D', hint: '清晰平面 · 前后景虚化', tab: 'dof', stops: 0,
    get: () => state.D, p: (v) => logPos(v, D_MIN, D_MAX), v: (p) => clamp(roundD(logVal(clamp(p, 0, 1), D_MIN, D_MAX)), D_MIN, D_MAX), fmt: fmtLen,
  },
  wb: {
    name: '白平衡', sym: 'T', hint: '设高偏暖，设低偏冷', tab: 'wb', stops: 0,
    get: () => state.wb, p: (v) => (v - K_MIN) / (K_MAX - K_MIN), v: (p) => Math.round((K_MIN + clamp(p, 0, 1) * (K_MAX - K_MIN)) / 50) * 50, fmt: fmtK,
  },
  comp: {
    name: '曝光补偿', sym: 'EV', hint: '只在 A / S 挡或自动 ISO 下生效', tab: 'ev', stops: 18, module: 'brain',
    get: () => state.comp, p: (v) => (v + COMP_MAX) / (2 * COMP_MAX), v: (p) => Math.round((clamp(p, 0, 1) * 2 * COMP_MAX - COMP_MAX) * 3) / 3, fmt: (v) => fmtEV(v) + ' EV',
  },
  mode: { name: '拍摄模式', sym: '', hint: 'M 全手动 · A 光圈优先 · S 快门优先', tab: 'ev', module: 'brain', fmt: (v) => MODE_NAMES[v], ...listParam(['M', 'A', 'S'], () => state.mode) },
  train: {
    name: '火车速度', sym: 'v', hint: '越快、越近、焦距越长，拖影越长', tab: 'motion', stops: TRAIN_MAX,
    get: () => state.trainSpeed, p: (v) => v / TRAIN_MAX, v: (p) => Math.round(clamp(p, 0, 1) * TRAIN_MAX), fmt: (v) => Math.round(v) + ' cm/s',
  },
  sceneEV: {
    name: '环境亮度', sym: 'EV', hint: '光线强弱（换光线预设会重置）', tab: 'ev', stops: 38,
    get: () => state.sceneEV, p: (v) => (v + 2) / 19, v: (p) => Math.round((clamp(p, 0, 1) * 19 - 2) * 2) / 2, fmt: (v) => 'EV ' + v.toFixed(1),
  },
  lightK: {
    name: '光源色温', sym: 'K', hint: '白天是主灯的颜色，夜里是路灯的颜色', tab: 'wb', stops: 80,
    get: () => state.lightK, p: (v) => (v - 2000) / 8000, v: (p) => Math.round((2000 + clamp(p, 0, 1) * 8000) / 100) * 100, fmt: fmtK,
  },
  preset: { name: '光线', sym: '', hint: '晴天 · 阴天 · 黄昏 · 夜晚', tab: 'ev', fmt: (v) => PRESETS[v].name, ...listParam(PRESET_KEYS, () => state.preset) },
  nd: { name: 'ND 减光镜', sym: 'ND', hint: '给镜头戴墨镜：ND8 / 64 / 1000 减 3 / 6 / 10 档', tab: 'ev', module: 'kit', fmt: (v) => (v ? `ND${2 ** v}（−${v} 档）` : '无'), ...listParam(ND_STEPS, () => state.nd) },
  format: { name: '画幅', sym: '', hint: '画幅越小：视角越窄、容许弥散圆越小、噪点越多', tab: 'fov', module: 'kit', fmt: (v) => FORMATS[v].name, ...listParam(FORMAT_KEYS, () => state.format) },
  hold: { name: '减震', sym: '', hint: '关掉减震，台面会抖：焦距越长、快门越慢越明显', tab: 'motion', module: 'kit', fmt: (v) => HOLD_NAMES[v], ...listParam(HOLD_KEYS, () => state.hold) },
};

let toastT = 0;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}
function touch(key) {
  state.lastUserAt = performance.now();
  if (key && PARAMS[key]) state.active = key;
}
let calPending = false;
const requestCalibrate = () => { calPending = true; };

// with the "brain" on, the camera may be choosing some values itself
function isAuto(key) {
  if (!state.modules.brain) return false;
  return (key === 't' && state.mode === 'A') || (key === 'N' && state.mode === 'S') || (key === 'iso' && state.autoISO) || (key === 'wb' && state.awb);
}
const LOCK_TEXT = {
  t: 'A 挡下快门由相机决定——把模式拨到 M 或 S 才能手动转快门',
  N: 'S 挡下光圈由相机决定——把模式拨到 M 或 A 才能手动转光圈',
};
function setParam(key, v, user = true) {
  const P = PARAMS[key];
  if (!P || (P.module && !state.modules[P.module])) return false;
  if (user && isAuto(key)) {
    if (key === 'wb') state.awb = false;
    else if (key === 'iso') state.autoISO = false;
    else { toast(LOCK_TEXT[key]); return false; }
  }
  switch (key) {
    case 'N': state.N = clamp(v, 1.4, 22); break;
    case 't': state.t = clamp(v, 1 / 2000, 1 / 25); break;
    case 'iso': state.iso = clamp(v, 100, 25600); break;
    case 'f': state.f = clamp(v, F_MIN, F_MAX); break;
    case 'D': state.D = clamp(v, D_MIN, D_MAX); break;
    case 'wb': state.wb = clamp(v, K_MIN, K_MAX); break;
    case 'comp': state.comp = clamp(v, -COMP_MAX, COMP_MAX); break;
    case 'mode': state.mode = v; break;
    case 'train': state.trainSpeed = clamp(v, 0, TRAIN_MAX); setTrainSpeed(state.trainSpeed, sim.tau); break;
    case 'sceneEV': state.sceneEV = clamp(v, -2, 17); break;
    case 'lightK': if (state.lightK !== v) { state.lightK = v; applyLighting(); requestCalibrate(); } break;
    case 'preset': if (state.preset !== v) applyPreset(v, !user); break;
    case 'nd': state.nd = v; if (user) toast(v ? `装上 ND${2 ** v}：进光量只剩 1/${2 ** v}` : '取下 ND 减光镜'); break;
    case 'format': if (state.format !== v) { state.format = v; if (user) { const fm = FORMATS[v]; toast(`${fm.name}：画幅系数 ${fm.crop.toFixed(2)}，${Math.round(state.f)} mm 相当于全画幅 ${Math.round(state.f * fm.crop)} mm`); } } break;
    case 'hold': state.hold = v; break;
  }
  if (user) touch(key);
  return true;
}
function stepParam(key, dir, big) {
  const P = PARAMS[key];
  const n = P.stops || 60;
  setParam(key, P.v(clamp(P.p(P.get()) + (dir * (big ? 3 : 1)) / n, 0, 1)));
}
function toggleAutoISO() { if (!state.modules.brain) return; state.autoISO = !state.autoISO; touch('iso'); toast(state.autoISO ? '自动 ISO：ISO 交给相机' : '自动 ISO 已关'); }
function toggleAWB() { if (!state.modules.brain) return; state.awb = !state.awb; touch('wb'); toast(state.awb ? '自动白平衡：相机按灰度世界假设估色温' : '自动白平衡已关'); }
function matchWB() {
  if (!state.modules.brain) return;
  state.awb = false;
  setParam('wb', clamp(Math.round(state.keyLightK / 50) * 50, K_MIN, K_MAX));
  toast(`白平衡对齐主光：${fmtK(state.keyLightK)}`);
}
function focusHyper() {
  const H = Opt.hyper(state.f, state.N, state.fmt.coc) / 10;
  if (H > D_MAX) { setParam('D', D_MAX); toast(`超焦距 ${fmtLen(H)} 超出对焦范围——收小光圈或换短焦试试`); }
  else { setParam('D', roundD(Math.max(H, D_MIN))); toast(`对焦到超焦距 ${fmtLen(H)}：从 ${fmtLen(H / 2)} 到 ∞ 都清晰`); }
}

// nobody but you sets the exposure: M, and ISO not on auto
const manualExposure = () => !(state.modules.brain && (state.mode !== 'M' || state.autoISO));
// the widest aperture this light allows at 1/2000 and ISO 100
const widestN = () => clamp(Math.sqrt(2 ** (state.sceneEV - state.nd) / 2000), 1.4, 22);
// shutter and ISO for aperture N (N itself stays): the shutter first, then ISO
// once the shutter would drop below 1/60
function exposeFor(N) {
  const ev = state.sceneEV - state.nd;
  state.iso = nearestStop(clamp(100 * ((N * N) / 2 ** ev) * 60, 100, 25600), ISO_STOPS);
  state.t = 1 / nearestStop(1 / clamp((N * N) / 2 ** (ev + Math.log2(state.iso / 100)), 1 / 2000, 1 / 25), T_STOPS);
}
// a sensible exposure for a new light, the way a photographer would start
function programExposure() {
  state.N = nearestStop(Math.max(state.N, widestN()), N_STOPS);
  exposeFor(state.N);
}
function applyPreset(key, quiet = false) {
  const p = PRESETS[key];
  state.preset = key;
  state.sceneEV = p.ev;
  state.lightK = p.lightK;
  state.meterValid = false;
  applyLighting();
  requestCalibrate();
  if (!quiet && manualExposure()) {
    programExposure();
    toast(`${p.name}：场景 EV ${p.ev}，已重设曝光 ${fmtN(state.N)} · ${fmtT(state.t)} · ISO ${fmtISO(state.iso)}`);
  }
}

// ---------------------------------------------------------------------------
// Optional modules. Off means gone: their hardware and cards hide, and what
// they did goes back to neutral. Only the core is on the first time.
// ---------------------------------------------------------------------------
const MODULES = {
  brain: { name: '模式 + 测光大脑', desc: 'M/A/S 挡、自动 ISO、曝光补偿、自动白平衡、对齐光源' },
  kit: { name: 'ND / 画幅 / 减震', desc: 'ND 减光镜、APS-C 与 M4/3 画幅、减震台开关' },
  lab: { name: '实验 + 自动演示', desc: '十个带说明的小实验，演示时控件自己转' },
  shoot: { name: '拍照 + 底片夹', desc: '快门按钮、快门帘开合、底片夹对比与保存' },
};
const MODULE_KEYS = ['brain', 'kit', 'lab', 'shoot'];
const MOD_STORE = 'bench-camera-lab:modules';
const moduleWatchers = [];
const onModule = (fn) => { moduleWatchers.push(fn); };
try {
  const saved = JSON.parse(localStorage.getItem(MOD_STORE) || 'null');
  if (saved) for (const k of MODULE_KEYS) if (typeof saved[k] === 'boolean') state.modules[k] = saved[k];
} catch { /* private window or storage blocked: start from the defaults */ }
function saveModules() { try { localStorage.setItem(MOD_STORE, JSON.stringify(state.modules)); } catch { /* not persisted */ } }
function setModule(key, on, quiet = false) {
  on = !!on;
  if (state.modules[key] === on) return;
  state.modules[key] = on;
  if (!on) {
    if (key === 'brain') { state.mode = 'M'; state.autoISO = false; state.comp = 0; state.awb = false; }
    else if (key === 'kit') { state.nd = 0; state.format = 'ff'; state.hold = 'tripod'; }
  }
  for (const fn of moduleWatchers) fn(key, on);
  saveModules();
  if (!quiet) toast(`${on ? '已开启' : '已关闭'}模块：${MODULES[key].name}`);
}
function ensureModules(keys = []) {
  const opened = keys.filter((k) => !state.modules[k]);
  for (const k of opened) setModule(k, true, true);
  if (opened.length) toast(`已自动开启：${opened.map((k) => MODULES[k].name).join('、')}`);
}
