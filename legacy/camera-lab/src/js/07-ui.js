
// ---------------------------------------------------------------------------
// Interface: controls, readouts, formulas, overlays, keys, experiments.
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const stageEl = $('stage'), photoSlot = $('photoSlot'), worldSlot = $('worldSlot');
const _txt = new Map();
function setText(el, v) { if (_txt.get(el) !== v) { _txt.set(el, v); el.textContent = v; } }
function setHTML(el, v) { if (_txt.get(el) !== v) { _txt.set(el, v); el.innerHTML = v; } }
function setPressed(el, on) { const v = String(!!on); if (el.getAttribute('aria-pressed') !== v) el.setAttribute('aria-pressed', v); }
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
const touch = () => { state.lastUserAt = performance.now(); };

// --- parameters ---------------------------------------------------------------------------
const snapF = (f) => { for (const m of F_MARKS) if (Math.abs(Math.log(f / m)) < 0.025) return m; return Math.round(f); };
const roundD = (d) => (d < 3 ? Math.round(d * 100) / 100 : d < 10 ? Math.round(d * 20) / 20 : Math.round(d * 10) / 10);
const nextIn = (list, v, dir) => (dir > 0 ? list.find((x) => x > v * 1.004) ?? list[list.length - 1] : [...list].reverse().find((x) => x < v / 1.004) ?? list[0]);
const SPECS = {
  N: {
    name: '光圈', sym: 'N', hint: '曝光 · 景深 · 衍射', min: 0, max: N_STOPS.length - 1, tab: 'dof',
    get: () => state.N, toPos: (v) => stopIndex(v, N_STOPS), fromPos: (p) => N_STOPS[Math.round(p)], fmt: fmtN,
    ticks: FULL_N.map((n) => [stopIndex(n, N_STOPS), String(n)]),
    step: (v, d, big) => N_STOPS[clamp(Math.round(stopIndex(v, N_STOPS)) + d * (big ? 3 : 1), 0, N_STOPS.length - 1)],
  },
  t: {
    name: '快门', sym: 't', hint: '曝光 · 运动模糊 · 手抖', min: 0, max: T_STOPS.length - 1, tab: 'motion',
    get: () => state.t, toPos: (v) => stopIndex(1 / v, T_STOPS), fromPos: (p) => 1 / T_STOPS[Math.round(p)], fmt: (v) => fmtT(v) + ' s',
    ticks: FULL_T.map((d) => [stopIndex(d, T_STOPS), d >= 1000 ? d / 1000 + 'k' : String(d)]),
    step: (v, d, big) => 1 / T_STOPS[clamp(Math.round(stopIndex(1 / v, T_STOPS)) + d * (big ? 3 : 1), 0, T_STOPS.length - 1)],
  },
  iso: {
    name: 'ISO', sym: 'S', hint: '画面亮度 · 噪点', min: 0, max: ISO_STOPS.length - 1, tab: 'iso',
    extra: '<button class="p-btn" id="autoIsoBtn" aria-pressed="false" title="自动 ISO">自动</button>',
    get: () => state.iso, toPos: (v) => stopIndex(v, ISO_STOPS), fromPos: (p) => ISO_STOPS[Math.round(p)], fmt: fmtISO,
    ticks: FULL_ISO.map((s) => [stopIndex(s, ISO_STOPS), String(s)]),
    step: (v, d, big) => ISO_STOPS[clamp(Math.round(stopIndex(v, ISO_STOPS)) + d * (big ? 3 : 1), 0, ISO_STOPS.length - 1)],
  },
  f: {
    name: '焦距', sym: 'f', hint: '视角 · 主体大小 · 景深', min: 0, max: 1000, tab: 'fov',
    get: () => state.f, toPos: (v) => logPos(v, F_MIN, F_MAX) * 1000, fromPos: (p) => snapF(logVal(p / 1000, F_MIN, F_MAX)), fmt: fmtF,
    ticks: [24, 35, 50, 70, 85, 105, 135].map((f) => [logPos(f, F_MIN, F_MAX) * 1000, String(f)]),
    step: (v, d, big) => (big ? nextIn(F_MARKS, v, d) : clamp(snapF(v * (d > 0 ? 1.05 : 1 / 1.05)), F_MIN, F_MAX)),
  },
  D: {
    name: '对焦', sym: 'D', hint: '清晰平面 · 前后景虚化', min: 0, max: 1000, tab: 'dof',
    extra: '<button class="p-btn" id="hyperBtn" title="对焦到超焦距">超焦距</button>',
    get: () => state.D, toPos: (v) => logPos(v, D_MIN, D_MAX) * 1000, fromPos: (p) => roundD(logVal(p / 1000, D_MIN, D_MAX)), fmt: fmtM,
    ticks: [0.5, 1, 2, 3, 5, 10, 20].map((d) => [logPos(d, D_MIN, D_MAX) * 1000, String(d)]),
    step: (v, d, big) => clamp(big ? nextIn(D_MARKS, v, d) : roundD(v * (d > 0 ? 1.06 : 1 / 1.06)), D_MIN, D_MAX),
  },
  wb: {
    name: '白平衡', sym: 'T', hint: '冷暖色偏 · 设高偏暖，设低偏冷', min: K_MIN, max: K_MAX, tab: 'wb', cls: 'wb',
    extra: '<button class="p-btn" id="matchBtn" title="把白平衡设成光源的色温">对齐光源</button><button class="p-btn" id="awbBtn" aria-pressed="false" title="自动白平衡（灰度世界）">AWB</button>',
    get: () => state.wb, toPos: (v) => v, fromPos: (p) => Math.round(p / 50) * 50, fmt: fmtK,
    ticks: [3000, 4000, 5000, 6000, 7000, 8000].map((k) => [k, k / 1000 + 'k']),
    step: (v, d, big) => clamp(Math.round((v + d * (big ? 500 : 100)) / 50) * 50, K_MIN, K_MAX),
  },
};
const MORE = {
  comp: {
    name: '曝光补偿', sym: 'EV', hint: '只在 A / S 挡或自动 ISO 下生效', min: -COMP_MAX, max: COMP_MAX, tab: 'ev',
    get: () => state.comp, toPos: (v) => v, fromPos: (p) => Math.round(p * 3) / 3, fmt: (v) => fmtEV(v) + ' EV',
    ticks: [-3, -2, -1, 0, 1, 2, 3].map((v) => [v, (v > 0 ? '+' : '') + v]),
    step: (v, d, big) => clamp(Math.round((v + d * (big ? 1 : 1 / 3)) * 3) / 3, -COMP_MAX, COMP_MAX),
  },
  bike: {
    name: '骑车速度', sym: 'v', hint: '被摄物越快、越近、焦距越长，拖影越长', min: 0, max: 40, tab: 'motion',
    get: () => bikeState.kmh, toPos: (v) => v, fromPos: (p) => Math.round(p), fmt: (v) => Math.round(v) + ' km/h',
    ticks: [0, 10, 20, 30, 40].map((v) => [v, String(v)]),
    step: (v, d, big) => clamp(v + d * (big ? 10 : 2), 0, 40),
  },
  sceneEV: {
    name: '环境亮度', sym: 'EV', hint: '光线强弱（切换光线预设会重置）', min: -2, max: 17, tab: 'ev',
    get: () => state.sceneEV, toPos: (v) => v, fromPos: (p) => Math.round(p * 2) / 2, fmt: (v) => 'EV ' + v.toFixed(1),
    ticks: [0, 3, 6, 9, 12, 15].map((v) => [v, String(v)]),
    step: (v, d, big) => clamp(v + d * (big ? 1 : 0.5), -2, 17),
  },
  lightK: {
    name: '光源色温', sym: 'K', hint: '主光的颜色（切换光线预设会重置）', min: 2000, max: 10000, tab: 'wb', cls: 'wb',
    get: () => state.lightK, toPos: (v) => v, fromPos: (p) => Math.round(p / 100) * 100, fmt: fmtK,
    ticks: [2000, 4000, 6000, 8000, 10000].map((k) => [k, k / 1000 + 'k']),
    step: (v, d, big) => clamp(v + d * (big ? 1000 : 100), 2000, 10000),
  },
};
const ALL = { ...SPECS, ...MORE };
const ROWS = {};
function buildRow(parent, key, spec) {
  const row = document.createElement('div');
  row.className = 'param'; row.dataset.param = key;
  row.innerHTML = `<div class="p-head"><span class="p-name">${spec.name}</span><i class="p-sym">${spec.sym}</i>${spec.extra || ''}<span class="p-badge" hidden>AUTO</span><b class="p-val"></b></div>
    <div class="track"><input type="range" step="any" min="${spec.min}" max="${spec.max}" aria-label="${spec.name}"${spec.cls ? ` class="${spec.cls}"` : ''}><div class="ticks"></div></div>
    <div class="p-hint">${spec.hint}</div>`;
  parent.appendChild(row);
  const input = row.querySelector('input'), ticks = row.querySelector('.ticks');
  for (const [pos, label] of spec.ticks) {
    const s = document.createElement('span');
    s.style.left = (((pos - spec.min) / (spec.max - spec.min)) * 100).toFixed(2) + '%';
    s.textContent = label;
    ticks.appendChild(s);
  }
  input.addEventListener('input', () => setParam(key, spec.fromPos(+input.value)));
  input.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (!d) return;
    e.preventDefault();
    stepParam(key, d, e.shiftKey);
  });
  input.addEventListener('pointerdown', () => setActive(key));
  input.addEventListener('focus', () => setActive(key));
  ROWS[key] = { row, input, val: row.querySelector('.p-val'), badge: row.querySelector('.p-badge'), dragging: false };
  input.addEventListener('pointerdown', () => { ROWS[key].dragging = true; });
  input.addEventListener('pointerup', () => { ROWS[key].dragging = false; });
  input.addEventListener('blur', () => { ROWS[key].dragging = false; });
}
for (const k in SPECS) buildRow($('params'), k, SPECS[k]);
{
  const more = $('moreParams');
  const seg = (id, label, hint, items) => {
    const d = document.createElement('div');
    d.className = 'param';
    d.innerHTML = `<div class="row"><span class="p-name">${label}</span><div class="seg" id="${id}" role="group" aria-label="${label}">${items.map(([v, t]) => `<button data-v="${v}" aria-pressed="false">${t}</button>`).join('')}</div></div><div class="p-hint">${hint}</div>`;
    more.appendChild(d);
  };
  buildRow(more, 'comp', MORE.comp);
  seg('holdSeg', '持机', '手持时相机会抖：焦距越长、快门越慢越明显', [['tripod', '三脚架'], ['hand', '手持'], ['handIS', '手持 + 防抖']]);
  seg('ndSeg', 'ND 减光镜', '给镜头戴墨镜：ND8 / 64 / 1000 分别减 3 / 6 / 10 档，晴天用大光圈全靠它', [['0', '无'], ['3', 'ND8'], ['6', 'ND64'], ['10', 'ND1000']]);
  seg('fmtSeg', '画幅', '画幅越小：视角越窄、容许弥散圆越小、噪点越多', [['ff', '全画幅'], ['apsc', 'APS-C'], ['m43', 'M4/3']]);
  buildRow(more, 'bike', MORE.bike);
  buildRow(more, 'sceneEV', MORE.sceneEV);
  buildRow(more, 'lightK', MORE.lightK);
  const r = document.createElement('div');
  r.className = 'param';
  r.innerHTML = '<div class="row"><span class="p-hint">把所有参数恢复到开场状态</span><button class="p-btn" id="resetBtn">复位</button></div>';
  more.appendChild(r);
}

function setActive(key) {
  if (state.active === key) return;
  state.active = key;
  for (const k in ROWS) ROWS[k].row.classList.toggle('active', k === key);
  if (ALL[key]?.tab) showTab(ALL[key].tab);
}
function isAuto(key) {
  return (key === 't' && state.mode === 'A') || (key === 'N' && state.mode === 'S') || (key === 'iso' && state.autoISO) || (key === 'wb' && state.awb);
}
function setParam(key, v, user = true) {
  if (user && isAuto(key)) {
    if (key === 'wb') { state.awb = false; }
    else if (key === 'iso') { state.autoISO = false; }
    else { toast(key === 't' ? 'A 挡下快门由相机决定——切到 M 或 S 才能手动调快门' : 'S 挡下光圈由相机决定——切到 M 或 A 才能手动调光圈'); return; }
  }
  if (key === 'N') state.N = clamp(v, 1.4, 22);
  else if (key === 't') state.t = clamp(v, 1 / 2000, 1 / 25);
  else if (key === 'iso') state.iso = clamp(v, 100, 25600);
  else if (key === 'f') state.f = clamp(v, F_MIN, F_MAX);
  else if (key === 'D') state.D = clamp(v, D_MIN, D_MAX);
  else if (key === 'wb') state.wb = clamp(v, K_MIN, K_MAX);
  else if (key === 'comp') state.comp = clamp(v, -COMP_MAX, COMP_MAX);
  else if (key === 'bike') bikeState.kmh = clamp(v, 0, 40);
  else if (key === 'sceneEV') state.sceneEV = v;
  else if (key === 'lightK') { state.lightK = v; applyLighting(); calibrate(); }
  if (user) { touch(); setActive(key); if (sweep && sweep.key === key) stopSweep(); }
}
function stepParam(key, dir, big) {
  const spec = ALL[key];
  if (!spec) return;
  setParam(key, spec.step(spec.get(), dir, big));
}
$('autoIsoBtn').addEventListener('click', () => { state.autoISO = !state.autoISO; touch(); setActive('iso'); });
$('awbBtn').addEventListener('click', () => { state.awb = !state.awb; touch(); setActive('wb'); });
$('matchBtn').addEventListener('click', () => { state.awb = false; setParam('wb', clamp(Math.round(state.keyLightK / 50) * 50, K_MIN, K_MAX)); toast(`白平衡对齐主光：${fmtK(state.keyLightK)}`); });
$('hyperBtn').addEventListener('click', () => {
  const H = Opt.hyper(state.f, state.N, state.fmt.coc) / 1000;
  if (H > D_MAX) { setParam('D', D_MAX); toast(`超焦距 ${fmtM(H)} 超出对焦范围——收小光圈或换短焦试试`); }
  else { setParam('D', roundD(Math.max(H, D_MIN))); toast(`对焦到超焦距 ${fmtM(H)}：从 ${fmtM(H / 2)} 到 ∞ 都清晰`); }
});
function bindSeg(id, fn) { $(id).querySelectorAll('button').forEach((b) => b.addEventListener('click', () => fn(b.dataset.v, b))); }
bindSeg('holdSeg', (v) => { state.hold = v; touch(); showTab('motion'); });
bindSeg('ndSeg', (v) => { state.nd = +v; touch(); showTab('ev'); if (+v) toast(`ND 减光 ${v} 档：进光量只剩 1/${2 ** +v}`); });
bindSeg('fmtSeg', (v) => { state.format = v; touch(); const fm = FORMATS[v]; toast(`${fm.name}：画幅系数 ${fm.crop.toFixed(2)}，${Math.round(state.f)} mm 相当于全画幅 ${Math.round(state.f * fm.crop)} mm`); showTab('fov'); });

// --- modes, presets, overlays, views ------------------------------------------------------------
const MODE_TEXT = {
  M: '全手动：光圈、快门、ISO 都由你决定。测光表只负责提示，亮暗后果自负。',
  A: '光圈优先：你定光圈（控制景深），相机按测光结果自动选快门。',
  S: '快门优先：你定快门（控制动感），相机自动选光圈。',
};
function setMode(m) {
  state.mode = m; touch();
  document.querySelectorAll('[data-mode]').forEach((b) => setPressed(b, b.dataset.mode === m));
  showTab('ev');
}
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
// a sensible exposure for a new light, the way a photographer would start
function programExposure() {
  const ev = state.sceneEV - state.nd;
  let N = state.N, iso = 100, t = (N * N) / 2 ** ev;
  if (t < 1 / 2000) { t = 1 / 2000; N = clamp(Math.sqrt(t * 2 ** ev), 1.4, 22); }
  if (t > 1 / 60) { iso = clamp(100 * 2 ** Math.log2(t * 60), 100, 25600); t = (N * N) / 2 ** (ev + Math.log2(iso / 100)); }
  state.N = nearestStop(N, N_STOPS);
  state.iso = nearestStop(iso, ISO_STOPS);
  state.t = 1 / nearestStop(1 / clamp((state.N * state.N) / 2 ** (ev + Math.log2(state.iso / 100)), 1 / 2000, 1 / 25), T_STOPS);
}
function applyPreset(key, quiet = false) {
  const p = PRESETS[key];
  state.preset = key;
  state.sceneEV = p.ev;
  state.lightK = p.lightK;
  state.meterValid = false;
  applyLighting();
  calibrate();
  document.querySelectorAll('[data-preset]').forEach((b) => setPressed(b, b.dataset.preset === key));
  if (!quiet && state.mode === 'M' && !state.autoISO) {
    programExposure();
    toast(`${p.name}：场景 EV ${p.ev}，已重设曝光 ${fmtN(state.N)} · ${fmtT(state.t)} · ISO ${fmtISO(state.iso)}`);
  }
}
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { applyPreset(b.dataset.preset); touch(); }));
function setOverlay(k, on) {
  state.overlays[k] = on;
  document.querySelectorAll(`[data-ov="${k}"]`).forEach((b) => setPressed(b, on));
  $('gridSvg').style.display = state.overlays.grid ? '' : 'none';
  $('histo').style.display = state.overlays.hist ? '' : 'none';
  $('tags').style.display = state.overlays.tags ? '' : 'none';
}
document.querySelectorAll('[data-ov]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setOverlay(b.dataset.ov, !state.overlays[b.dataset.ov]); }));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setView(b.dataset.view); }));
function swapViews() {
  state.view = state.view === 'photo' ? 'world' : 'photo';
  stageEl.classList.toggle('swapped', state.view === 'world');
}
$('swapBtn').addEventListener('click', (e) => { e.stopPropagation(); swapViews(); });
function setTime(on) { state.timeScale = on ? 1 : 0; setPressed($('timeBtn'), !on); $('timeBtn').textContent = on ? '❚❚' : '▶'; $('timeBtn').title = on ? '暂停场景时间 · K' : '继续场景时间 · K'; }
$('timeBtn').addEventListener('click', () => setTime(!state.timeScale));

// --- readouts --------------------------------------------------------------------------------------
{
  const m = $('evMeter');
  for (let k = -9; k <= 9; k++) {
    const x = ((k / 3 + 3) / 6) * 100;
    const t = document.createElement('i');
    t.className = 'ev-tick' + (k % 3 ? ' minor' : '');
    t.style.left = x + '%';
    m.appendChild(t);
    if (k % 3 === 0) { const n = document.createElement('span'); n.className = 'ev-num'; n.style.left = x + '%'; n.textContent = k === 0 ? '0' : (k > 0 ? '+' : '−') + Math.abs(k / 3); m.appendChild(n); }
  }
}
const STAT_KEYS = [['fov', '视角'], ['size', '主体大小'], ['motion', '运动模糊'], ['shake', '手抖'], ['noise', '噪点'], ['wb', '白平衡'], ['diff', '衍射'], ['vig', '暗角']];
const STATS = {};
for (const [k, name] of STAT_KEYS) {
  const d = document.createElement('div');
  d.className = 'stat';
  d.innerHTML = `<i>${name}</i><b></b><small></small>`;
  $('stats').appendChild(d);
  STATS[k] = { el: d, b: d.querySelector('b'), s: d.querySelector('small'), cls: '' };
}
function stat(k, big, small, cls = '') {
  const s = STATS[k];
  setText(s.b, big); setText(s.s, small);
  if (s.cls !== cls) { s.el.className = 'stat' + (cls ? ' ' + cls : ''); s.cls = cls; }
}
const MODEL_H = 1.76;
const joinNames = (list) => (list.length <= 2 ? list.join('和') : list.slice(0, -1).join('、') + '和' + list[list.length - 1]);
function subjectCoc(s) { const d = s.far ? 1e5 : s.at.x; return { d, c: Opt.coc(d, state.cur.D, state.cur.f, state.cur.N) }; }
function inFrame(p, margin = 1) { _pp.copy(p).project(photoCam); return _pp.z < 1 && Math.abs(_pp.x) < margin && Math.abs(_pp.y) < margin; }
function dofX(d) { if (!isFinite(d) || d > 60) return 290; return 12 + (Math.log(Math.max(d, 0.4) / 0.4) / Math.log(60 / 0.4)) * 262; }
function drawDofScale() {
  const near = dof.near, far = dof.far, D = state.cur.D, c0 = state.fmt.coc;
  let s = '';
  s += `<rect x="${dofX(near).toFixed(1)}" y="40" width="${Math.max(1.5, dofX(far) - dofX(near)).toFixed(1)}" height="12" rx="3" fill="rgba(127,227,255,.28)" stroke="rgba(127,227,255,.75)"/>`;
  s += '<line x1="12" y1="52" x2="296" y2="52" stroke="rgba(255,255,255,.35)"/>';
  for (const d of [0.5, 1, 2, 3, 5, 10, 20, 40]) { const x = dofX(d); s += `<line x1="${x}" y1="52" x2="${x}" y2="56" stroke="rgba(255,255,255,.4)"/><text x="${x}" y="66" text-anchor="middle">${d}</text>`; }
  s += '<text x="290" y="66" text-anchor="middle">∞</text><text x="296" y="78" text-anchor="end">m</text>';
  const H = dof.H;
  if (H < 60) s += `<line x1="${dofX(H)}" y1="36" x2="${dofX(H)}" y2="56" stroke="#ffb454" stroke-dasharray="2 2"/><text x="${dofX(H)}" y="78" text-anchor="middle" style="fill:#ffb454">H</text>`;
  s += `<line x1="${dofX(D)}" y1="34" x2="${dofX(D)}" y2="58" stroke="#fff" stroke-width="1.6"/><text x="${dofX(D)}" y="78" text-anchor="middle" style="fill:#fff">D</text>`;
  const shown = SUBJECTS.filter((x) => ['flower', 'model', 'bike', 'fountain', 'car', 'cafe', 'hills'].includes(x.key));
  let row = 0, lastX = -99;
  s += '<g class="sub">';
  for (const sub of shown) {
    const { d, c } = subjectCoc(sub), x = dofX(d), ok = c <= c0;
    row = x - lastX < 34 ? 1 - row : 0; lastX = x;
    const y = row ? 12 : 26;
    s += `<line x1="${x}" y1="${y + 3}" x2="${x}" y2="40" stroke="${ok ? '#7fe3ff' : '#ffb454'}" stroke-opacity=".6"/><circle cx="${x}" cy="40" r="2.6" fill="${ok ? '#7fe3ff' : '#ffb454'}"/>`;
    s += `<text x="${x}" y="${y}" text-anchor="middle" style="fill:${ok ? '#bff2ff' : '#ffd6a0'}">${sub.name}</text>`;
  }
  s += '</g>';
  setHTML($('dofScale'), s);
}
function exposureWords(d) {
  const a = Math.abs(d);
  if (a < 0.35) return '曝光正常';
  const n = a.toFixed(1);
  return d > 0 ? `过曝 ${n} 档` : `欠曝 ${n} 档`;
}
function lcdHTML() {
  const auto = (k) => (isAuto(k) ? ' class="auto"' : '');
  const lim = expo.limited;
  const blink = (k) => ((k === 't' && (lim === 'slow' || lim === 'fast')) || (k === 'N' && (lim === 'open' || lim === 'closed')) || (k === 'iso' && lim.startsWith('iso')) ? ' class="blink"' : auto(k));
  const md = state.mode + (state.autoISO ? '·ISO' : '');
  let scale = '';
  const md2 = clamp(Math.round(expo.meterDelta * 3), -9, 9);
  for (let k = -9; k <= 9; k += 1) {
    if (k % 3 && Math.abs(k) !== Math.abs(md2)) continue;
    const on = md2 !== 0 && ((md2 > 0 && k > 0 && k <= md2) || (md2 < 0 && k < 0 && k >= md2));
    scale += `<i class="${k === 0 ? 'z' : ''}${on ? ' on' : ''}"></i>`;
  }
  return `<span class="md">${md}</span><span${blink('t')}>${fmtT(state.t)}</span><span${blink('N')}>${fmtN(state.cur.N).replace('ƒ/', 'F')}</span><span${blink('iso')}>ISO ${fmtISO(state.iso)}</span>` +
    `<span>${fmtEV(state.comp)}</span>${state.nd ? `<span>ND${2 ** state.nd}</span>` : ''}<span>${Math.round(state.cur.f)}mm</span><span>${fmtM(state.cur.D)}</span><span${auto('wb')}>${fmtK(state.wb)}</span>` +
    `<span class="scale" title="测光指示">−${scale}+</span>`;
}
function updateReadouts() {
  const fm = state.fmt, f = state.cur.f, N = state.cur.N, D = state.cur.D, t = state.t;
  // exposure
  const md = expo.meterDelta, needle = $('evNeedle');
  needle.style.left = (((clamp(md, -3.25, 3.25) + 3) / 6) * 100).toFixed(2) + '%';
  needle.className = 'ev-needle' + (Math.abs(md) > 3 ? ' off' : md > 0.35 ? ' over' : md < -0.35 ? ' under' : '');
  setText($('evNums'), `测光 EV ${state.meterEV.toFixed(1)} · 设置 EV ${expo.evSet.toFixed(1)}${state.nd ? ' + ND ' + state.nd : ''}`);
  let note = `<b>${exposureWords(expo.delta)}</b>`;
  if (Math.abs(expo.delta) >= 0.35) note += expo.delta > 0 ? '：进光比需要的多，高光先溢出成白色。' : '：进光不足，画面发暗，暗部噪点更显眼。';
  else note += '：人物脸上的中灰落在 18% 左右。';
  if (Math.abs(expo.delta - md) > 0.6) note += md > expo.delta ? ` 测光表却读 ${fmtEV(md)}：它被画面里的亮灯、天空或白墙骗了，照它调人物会偏暗。` : ` 测光表却读 ${fmtEV(md)}：它被大片暗部骗了，照它调人物会偏亮。`;
  if (expo.limited) note += { slow: ' 快门已到最慢 1/25，仍然不够亮。', fast: ' 快门已到最快 1/2000，仍然过亮——收小光圈或降 ISO。', open: ' 光圈已开到最大 ƒ/1.4。', closed: ' 光圈已收到最小 ƒ/22。', isoMax: ' ISO 已到 25600 上限。', isoMin: ' ISO 已是最低 100。' }[expo.limited];
  if (state.overlays.hist && histo.clipHi > 0.02) note += ` 约 ${Math.round(histo.clipHi * 100)}% 的像素已经溢出。`;
  setHTML($('evNote'), note);
  // depth of field
  setText($('dofNums'), isFinite(dof.far) ? `${fmtM(dof.near)} – ${fmtM(dof.far)}` : `${fmtM(dof.near)} – ∞`);
  const total = isFinite(dof.far) ? dof.far - dof.near : Infinity;
  setHTML($('dofKV'), `<span><i>景深</i>${isFinite(total) ? fmtM(total) : '∞'}</span><span><i>前</i>${fmtM(D - dof.near)}</span><span><i>后</i>${isFinite(dof.far) ? fmtM(dof.far - D) : '∞'}</span><span><i>超焦距</i>${fmtM(dof.H)}</span><span><i>c₀</i>${fm.coc.toFixed(3)} mm</span>`);
  drawDofScale();
  // stats
  const hf = THREE.MathUtils.radToDeg(Opt.fov(f, fm.w)), vf = THREE.MathUtils.radToDeg(Opt.fov(f, fm.h)), df = THREE.MathUtils.radToDeg(Opt.fov(f, Math.hypot(fm.w, fm.h)));
  stat('fov', `${hf.toFixed(1)}° × ${vf.toFixed(1)}°`, fm.crop > 1.01 ? `等效 ${Math.round(f * fm.crop)} mm` : `对角线 ${df.toFixed(0)}°`);
  const hImg = (MODEL_H * f) / 3, frac = hImg / fm.h;
  stat('size', `${Math.round(frac * 100)}% 画高`, frac > 1.05 ? `人物只拍到${frac > 1.8 ? '头肩' : '半身'}` : `人物像高 ${hImg.toFixed(1)} mm`, frac > 1.05 ? 'warn' : '');
  const bike = SUB.bike, bMm = Opt.motion(bike.speed, bike.at.x, f, t), bPx = (bMm / fm.w) * PW;
  stat('motion', bike.speed > 0 ? `${bPx < 10 ? bPx.toFixed(1) : Math.round(bPx)} px` : '静止', bike.speed > 0 ? `骑车人移动 ${(bike.speed * t * 100).toFixed(1)} cm` : '骑车速度为 0', bPx > 6 ? 'warn' : bPx < 1 ? 'good' : '');
  const safe = 1 / (f * fm.crop), shPx = expo.shakePx, safeTxt = (s) => (s < 1 / 20 ? '1/' + Math.round(1 / s) : fmtT(s));
  if (state.hold === 'tripod') stat('shake', '三脚架', `手持安全快门 ${safeTxt(safe)}`, 'good');
  else stat('shake', `${shPx < 10 ? shPx.toFixed(1) : Math.round(shPx)} px`, `安全快门 ${safeTxt(state.hold === 'handIS' ? safe * 2 ** state.isStops : safe)}${state.hold === 'handIS' ? ' · 防抖' : ''}`, shPx > 3 ? 'bad' : shPx > 1.2 ? 'warn' : 'good');
  const lvl = 0.18 * expo.gain, e = lvl * Opt.fwc(state.iso, fm), snr = Opt.snr(Math.min(lvl, 1), state.iso, fm);
  stat('noise', `SNR ${snr >= 100 ? Math.round(snr) : snr.toFixed(1)}`, `中灰 ${e >= 1000 ? (e / 1000).toFixed(1) + 'k' : Math.round(e)} 个光电子`, snr < 8 ? 'bad' : snr < 20 ? 'warn' : 'good');
  const dM = mired(state.wb) - mired(state.keyLightK);
  stat('wb', Math.abs(dM) < 12 ? '准确' : dM < 0 ? '偏暖' : '偏冷', `差 ${Math.round(Math.abs(dM))} mired · 主光 ${fmtK(state.keyLightK)}`, Math.abs(dM) < 12 ? 'good' : Math.abs(dM) > 60 ? 'warn' : '');
  const airy = Opt.airy(N) * 1000;
  stat('diff', `${airy.toFixed(0)} µm`, airy > fm.coc * 1000 * 0.8 ? `≈ 容许 ${Math.round(fm.coc * 1000)} µm，开始发软` : `艾里斑 < 容许 ${Math.round(fm.coc * 1000)} µm`, airy > fm.coc * 1000 * 0.8 ? 'warn' : '');
  const vig = sensorP.u.uVig.value;
  stat('vig', vig > 0.05 ? `−${vig.toFixed(1)} EV` : '几乎没有', N < 4 ? '四角进光少' : '收小光圈后消失', vig > 0.8 ? 'warn' : '');
  // mode line
  setText($('modeDesc'), MODE_TEXT[state.mode] + (state.autoISO ? ' 自动 ISO：ISO 也交给相机。' : ''));
  for (const k in SPECS) { ROWS[k].badge.hidden = !isAuto(k); ROWS[k].input.disabled = isAuto(k) && k !== 'wb' && k !== 'iso'; }
  setPressed($('autoIsoBtn'), state.autoISO);
  setPressed($('awbBtn'), state.awb);
  document.querySelectorAll('#holdSeg button').forEach((b) => setPressed(b, b.dataset.v === state.hold));
  document.querySelectorAll('#fmtSeg button').forEach((b) => setPressed(b, b.dataset.v === state.format));
  document.querySelectorAll('#ndSeg button').forEach((b) => setPressed(b, +b.dataset.v === state.nd));
  for (const k in ALL) {
    const r = ROWS[k];
    if (!r) continue;
    const v = ALL[k].get();
    setText(r.val, ALL[k].fmt(v));
    const pos = ALL[k].toPos(v);
    if (!r.dragging) { const sv = pos.toFixed(3); if (r.input.value !== sv) r.input.value = sv; }
    const pct = (((pos - ALL[k].min) / (ALL[k].max - ALL[k].min)) * 100).toFixed(2) + '%';
    if (_txt.get(r.input) !== pct) { _txt.set(r.input, pct); r.input.style.setProperty('--p', pct); }
  }
  setHTML($('lcd'), lcdHTML());
  setHTML($('explain'), explainText());
  refreshFormulas();
}
function explainText() {
  const out = [];
  const fm = state.fmt, f = state.cur.f, D = state.cur.D;
  // depth of field: who is sharp
  const cand = SUBJECTS.filter((s) => ['flower', 'model', 'bike', 'fountain', 'lights', 'car', 'cafe', 'hills'].includes(s.key) && (s.far || inFrame(s.at, 1.02)));
  const sharp = cand.filter((s) => subjectCoc(s).c <= fm.coc).map((s) => s.name);
  const soft = cand.filter((s) => subjectCoc(s).c > fm.coc).map((s) => s.name);
  const zone = isFinite(dof.far) ? `${fmtM(dof.near)} 到 ${fmtM(dof.far)}` : `${fmtM(dof.near)} 到无穷远`;
  if (!cand.length) out.push(`画面里只剩背景。清晰区从 ${zone}。`);
  else if (!sharp.length) out.push(`焦平面（${fmtM(D)}）上没有被摄物：清晰区 ${zone} 里空无一物，${joinNames(soft.slice(0, 3))}都落成了<b class="am">光斑</b>。`);
  else if (!soft.length) out.push(`${joinNames(sharp)}全在清晰区（${zone}）里，整张照片都清楚。`);
  else out.push(`清晰区从 ${zone}：<b class="cy">${joinNames(sharp)}</b>清楚，${joinNames(soft.slice(0, 3))}落成<b class="am">光斑</b>。`);
  // motion
  const bike = SUB.bike;
  if (bike.speed > 0 && inFrame(bike.at, 1.05)) {
    const px = (Opt.motion(bike.speed, bike.at.x, f, state.t) / fm.w) * PW;
    if (px > 4) out.push(`骑车人在 ${fmtT(state.t)} s 里移动了 ${(bike.speed * state.t * 100).toFixed(1)} cm，拖出 <b>${Math.round(px)} px</b> 的残影。`);
    else if (px < 1) out.push(`${fmtT(state.t)} s 足够快，骑车人被<b class="cy">冻结</b>住了。`);
  }
  if (state.hold !== 'tripod' && expo.shakePx > 1.5) out.push(`手持 ${fmtT(state.t)} s 慢于安全快门 ${(state.hold === 'handIS' ? fmtT(2 ** state.isStops / (f * fm.crop)) : '1/' + Math.round(f * fm.crop))}，整张照片被手抖拖糊约 <b class="am">${expo.shakePx.toFixed(1)} px</b>。`);
  // exposure and noise
  if (Math.abs(expo.delta) >= 0.7) out.push(expo.delta > 0 ? `曝光多了 ${expo.delta.toFixed(1)} 档，亮部冲成白色。` : `曝光少了 ${(-expo.delta).toFixed(1)} 档，画面发暗。`);
  const snr = Opt.snr(Math.min(0.18 * expo.gain, 1), state.iso, fm);
  if (snr < 14) out.push(`ISO ${fmtISO(state.iso)} 下中灰每个像素只收到约 ${Math.round(0.18 * expo.gain * Opt.fwc(state.iso, fm))} 个光电子，噪点${snr < 7 ? '<b class="am">很明显</b>' : '开始显现'}。`);
  // white balance
  const dM = mired(state.wb) - mired(state.keyLightK);
  if (Math.abs(dM) > 30) out.push(`白平衡设为 ${fmtK(state.wb)}，比主光（约 ${fmtK(state.keyLightK)}）${dM < 0 ? '高' : '低'}，画面<b class="${dM < 0 ? 'am' : 'cy'}">偏${dM < 0 ? '暖' : '冷'}</b>。`);
  return out.slice(0, 4).join('');
}

// --- formulas (KaTeX, loaded lazily; plain text until it arrives) ----------------------------------------
let katex = null;
function plainTex(s) {
  return s.replace(/\\(mathrm|text|operatorname)\{([^}]*)\}/g, '$2').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\(qquad|quad|,|;|!)/g, ' ').replace(/\\times/g, '×').replace(/\\approx/g, '≈').replace(/\\le/g, '≤').replace(/\\cdot/g, '·')
    .replace(/\\log_2/g, 'log₂').replace(/\\arctan/g, 'arctan').replace(/\\Delta/g, 'Δ').replace(/\\lambda/g, 'λ').replace(/\\sigma/g, 'σ').replace(/\\theta/g, 'θ').replace(/\\omega/g, 'ω')
    .replace(/\\mu/g, 'µ').replace(/\\propto/g, '∝').replace(/\\sqrt\{([^}]*)\}/g, '√($1)').replace(/[{}]/g, '').replace(/\\/g, '');
}
function tex(el, s) {
  if (katex) { try { katex.render(s, el, { throwOnError: false, displayMode: true, output: 'html' }); el.classList.remove('fallback'); return; } catch { /* fall through */ } }
  el.textContent = plainTex(s); el.classList.add('fallback');
}
const TABS = [['ev', '曝光'], ['dof', '景深'], ['motion', '快门'], ['iso', 'ISO'], ['fov', '焦距'], ['wb', '白平衡']];
let fTab = 'dof', fSig = '';
for (const [k, name] of TABS) {
  const b = document.createElement('button');
  b.role = 'tab'; b.dataset.tab = k; b.textContent = name;
  b.addEventListener('click', () => showTab(k));
  $('fTabs').appendChild(b);
}
function showTab(k) {
  fTab = k; fSig = '';
  document.querySelectorAll('#fTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
  refreshFormulas(true);
}
const n2 = (v, d = 2) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d));
function formulaBlocks() {
  const fm = state.fmt, f = state.cur.f, N = state.cur.N, D = state.cur.D, t = state.t, iso = state.iso, c0 = fm.coc;
  const tDen = Math.round(1 / t), F = Math.round(f);
  const al = (...rows) => String.raw`\begin{aligned}` + rows.join(String.raw`\\`) + String.raw`\end{aligned}`;
  switch (fTab) {
    case 'ev': {
      const a = Math.log2((N * N) / t), b = Math.log2(iso / 100);
      return [
        ['p', '曝光值把光圈、快门、ISO 折算成一个数：每差 1，进光量差一倍。'],
        ['eq', String.raw`\mathrm{EV}_{100}=\log_2\frac{N^2}{t}-\log_2\frac{S}{100}`],
        ['live', al(String.raw`&=\log_2\frac{${n2(N, 1)}^2}{1/${tDen}}-\log_2\frac{${Math.round(iso)}}{100}`, String.raw`&=${n2(a)}-${n2(b)}=${n2(a - b)}`)],
        ...(state.nd ? [['live', String.raw`\mathrm{EV}_{\text{等效}}=${n2(a - b)}+\underbrace{${state.nd}}_{\mathrm{ND}}=${n2(expo.evEff)}`]] : []),
        ['live', al(String.raw`\Delta\mathrm{EV}&=\mathrm{EV}_{\text{场景}}-\mathrm{EV}_{\text{设置}}`, String.raw`&=${n2(state.sceneEV, 1)}-${n2(expo.evEff)}=${expo.delta >= 0 ? '+' : ''}${n2(expo.delta)}`)],
        ['p', `画面亮度 × 2<sup>${n2(expo.delta, 1)}</sup> ≈ <b>${n2(expo.gain, expo.gain < 10 ? 2 : 0)} 倍</b>。${state.mode === 'M' && !state.autoISO ? '在 M 挡，这个偏差全靠你自己消掉。' : `相机按测光 EV ${state.meterEV.toFixed(1)}${state.comp ? `、补偿 ${fmtEV(state.comp)}` : ''} 自动选了${state.mode === 'A' ? '快门' : state.mode === 'S' ? '光圈' : 'ISO'}。`}`],
      ];
    }
    case 'dof': {
      const H = Opt.hyper(f, N, c0) / 1000, sub = SUB.cafe, cc = Opt.coc(sub.at.x, D, f, N);
      return [
        ['p', `容许弥散圆 c₀ = ${c0.toFixed(3)} mm（${fm.name}）。先算超焦距 H：`],
        ['live', al(String.raw`H&=\frac{f^2}{N c_0}+f`, String.raw`&=\frac{${F}^2}{${n2(N, 1)}\times${c0.toFixed(3)}}+${F}\,\mathrm{mm}=${n2(H)}\,\mathrm{m}`)],
        ['p', '再得清晰范围的近点和远点：'],
        ['live', isFinite(dof.far)
          ? al(String.raw`D_{\text{近}}&=\frac{D(H-f)}{H+D-2f}=${n2(dof.near)}\,\mathrm{m}`, String.raw`D_{\text{远}}&=\frac{D(H-f)}{H-D}=${n2(dof.far)}\,\mathrm{m}`)
          : al(String.raw`D&=${n2(D)}\,\mathrm{m}\ \ge H`, String.raw`D_{\text{近}}&=${n2(dof.near)}\,\mathrm{m},\ \ D_{\text{远}}=\infty`)],
        ['p', `背景里 ${sub.at.x.toFixed(0)} m 外的咖啡馆，在传感器上摊成：`],
        ['live', al(String.raw`c&=\frac{f^2}{N(D-f)}\cdot\frac{|d-D|}{d}`, String.raw`&=\frac{${F}^2}{${n2(N, 1)}\times${Math.round(D * 1000 - f)}}\cdot\frac{${n2(Math.abs(sub.at.x - D), 1)}}{${n2(sub.at.x, 1)}}=${cc.toFixed(3)}\,\mathrm{mm}`)],
        ['p', `是容许值的 <b>${n2(cc / c0, 1)} 倍</b>${cc > c0 ? '，所以糊' : '，所以清楚'}。`],
      ];
    }
    case 'motion': {
      const bike = SUB.bike, v = bike.speed, b = Opt.motion(v, bike.at.x, f, t), sh = expo.shakePx;
      const w = SHAKE_W / (state.hold === 'handIS' ? 2 ** state.isStops : 1);
      return [
        ['p', `快门开着的 t 秒里，横穿画面的物体（v 米/秒，d 米外）在传感器上划出的距离（mm）：`],
        ['live', al(String.raw`b&=\frac{v\,t\,f}{d}`, String.raw`&=\frac{${n2(v, 1)}\times\frac{1}{${tDen}}\times${F}}{${n2(bike.at.x, 1)}}=${b.toFixed(3)}\,\mathrm{mm}`)],
        ['p', `≈ 画面宽度的 ${n2((b / fm.w) * 100, 2)}%，也就是 <b>${n2((b / fm.w) * PW, 1)} px</b>。这台相机在这 t 秒里渲染了 <b>${expo.K}</b> 个瞬间再平均。`],
        ['live', state.hold === 'tripod'
          ? String.raw`\text{手持安全快门：}\ t\le\frac{1}{f\,k}=\frac{1}{${Math.round(f * fm.crop)}}\,\mathrm{s}`
          : al(String.raw`b_{\text{抖}}&=f\,\omega\,t`, String.raw`&=${F}\times${w.toFixed(4)}\times\frac{1}{${tDen}}=${(f * w * t).toFixed(3)}\,\mathrm{mm}`)],
        ...(state.hold !== 'tripod' ? [['p', `手抖拖影约 <b>${n2(sh, 1)} px</b>（ω = ${w.toFixed(4)} rad/s${state.hold === 'handIS' ? '，已被防抖除以 2⁴' : ''}）。`]] : []),
      ];
    }
    case 'iso': {
      const lvl = Math.min(0.18 * expo.gain, 1), fwc = Opt.fwc(iso, fm), e = lvl * fwc, snr = Opt.snr(lvl, iso, fm);
      return [
        ['p', `ISO 只放大信号，不增加光。${fm.name}每个显示像素在 ISO 100 满阱约 ${Math.round(FWC_FF * fm.area).toLocaleString()} 个电子；中灰此刻收到的光电子：`],
        ['live', String.raw`n=${Math.round(FWC_FF * fm.area)}\times\frac{100}{${Math.round(iso)}}\times${lvl.toFixed(3)}=${Math.round(e)}`],
        ['live', String.raw`\mathrm{SNR}=\frac{n}{\sqrt{n+\sigma_r^2}}=\frac{${Math.round(e)}}{\sqrt{${Math.round(e)}+${READ_E}^2}}=${n2(snr, 1)}`],
        ['p', `噪声约为信号的 <b>${n2(100 / Math.max(snr, 0.01), 1)}%</b>。ISO 每升一档，SNR 约降为 1/√2；暗部光子更少，所以噪点先在阴影里出现。`],
      ];
    }
    case 'fov': {
      const hf = THREE.MathUtils.radToDeg(Opt.fov(f, fm.w)), hImg = (MODEL_H * f) / 3;
      return [
        ['p', `水平视角（画幅宽 w = ${fm.w} mm）：`],
        ['live', String.raw`\theta=2\arctan\frac{w}{2f}=2\arctan\frac{${fm.w}}{2\times${F}}=${n2(hf, 1)}^\circ`],
        ['p', '3 m 外 1.76 m 高的人物，在传感器上的像高：'],
        ['live', String.raw`h'=\frac{h\,f}{d}=\frac{1.76\times${F}}{3}=${n2(hImg, 1)}\,\mathrm{mm}`],
        ['p', hImg > fm.h ? `比画幅高度 ${fm.h} mm 还大，只拍得到 ${Math.round((fm.h / hImg) * 100)}% 的身体。` : `占画幅高度 ${fm.h} mm 的 ${Math.round((hImg / fm.h) * 100)}%。`],
        ...(fm.crop > 1.01 ? [['live', String.raw`f_{\text{等效}}=k\,f=${fm.crop.toFixed(2)}\times${F}=${Math.round(f * fm.crop)}\,\mathrm{mm}`]] : []),
      ];
    }
    case 'wb': {
      const [r, g, b] = kelvinRGB(state.wb), gains = wbGains(state.wb), dM = mired(state.wb) - mired(state.keyLightK);
      return [
        ['p', `设定 T = ${fmtK(state.wb)}：相机假设光是这个颜色的黑体，把它变白所需的增益：`],
        ['live', al(String.raw`(R,G,B)_T&=(${r.toFixed(2)},\ ${g.toFixed(2)},\ ${b.toFixed(2)})`, String.raw`g_R&=\tfrac{G}{R}=${gains[0].toFixed(2)},\quad g_B=\tfrac{G}{B}=${gains[2].toFixed(2)}`)],
        ['p', `主光实际约 ${fmtK(state.keyLightK)}。两者用米勒德（M = 10⁶/T）比较：`],
        ['live', al(String.raw`\Delta M&=\frac{10^6}{T_{\text{设}}}-\frac{10^6}{T_{\text{光}}}`, String.raw`&=${n2(mired(state.wb), 1)}-${n2(mired(state.keyLightK), 1)}=${n2(dM, 1)}`)],
        ['p', Math.abs(dM) < 12 ? '差不到 12 mired，几乎看不出偏色。' : dM < 0 ? '设定比光源高 → 红色被放大得偏多，画面<b class="am">偏暖</b>。' : '设定比光源低 → 蓝色被放大得偏多，画面<b class="cy">偏冷</b>。'],
      ];
    }
  }
  return [];
}
let fAt = 0;
function refreshFormulas(force = false) {
  const now = performance.now();
  if (!force && now - fAt < 160) return;
  fAt = now;
  const blocks = formulaBlocks();
  const sig = fTab + JSON.stringify(blocks) + !!katex;
  if (sig === fSig) return;
  fSig = sig;
  const body = $('fBody');
  body.textContent = '';
  for (const [kind, s] of blocks) {
    const el = document.createElement(kind === 'p' ? 'p' : 'div');
    if (kind === 'p') el.innerHTML = s;
    else { el.className = 'eq' + (kind === 'live' ? ' live' : ''); tex(el, s); }
    body.appendChild(el);
  }
}
function renderStaticTex() { document.querySelectorAll('[data-tex]').forEach((el) => tex(el, el.dataset.tex)); }
import('https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.mjs')
  .then((m) => { katex = m.default || m; renderStaticTex(); refreshFormulas(true); })
  .catch(() => renderStaticTex());

// --- histogram -----------------------------------------------------------------------------------------
const hctx = $('histo').getContext('2d');
function drawHisto() {
  if (!histo.fresh || !state.overlays.hist) return;
  histo.fresh = false;
  $('histo').classList.add('ready');
  const c = hctx, W = 340, H = 156;
  c.clearRect(0, 0, W, H);
  let mx = 1;
  for (let i = 1; i < 63; i++) mx = Math.max(mx, histo.l[i], histo.r[i], histo.g[i], histo.b[i]);
  const y = (v) => H - 6 - Math.min(1, Math.sqrt(v / mx)) * (H - 16);
  const path = (arr) => { c.beginPath(); c.moveTo(6, H - 6); for (let i = 0; i < 64; i++) c.lineTo(6 + (i / 63) * (W - 12), y(arr[i])); c.lineTo(W - 6, H - 6); c.closePath(); };
  c.globalCompositeOperation = 'lighter';
  for (const [k, col] of [['r', 'rgba(255,80,80,.42)'], ['g', 'rgba(80,255,120,.36)'], ['b', 'rgba(90,140,255,.46)']]) { path(histo[k]); c.fillStyle = col; c.fill(); }
  c.globalCompositeOperation = 'source-over';
  path(histo.l); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.18)';
  for (const q of [0.25, 0.5, 0.75]) c.fillRect(6 + q * (W - 12), 6, 1, H - 12);
  if (histo.clipHi > 0.005) { c.fillStyle = '#ff6b5e'; c.fillRect(W - 8, 6, 5, H - 12); }
  if (histo.clipLo > 0.01) { c.fillStyle = '#6f94ff'; c.fillRect(3, 6, 5, H - 12); }
}

// --- tags on the photo, labels in the world view ---------------------------------------------------------
function makeTag(parent, cls) { const el = document.createElement('div'); el.className = cls; el.innerHTML = '<span></span><em></em>'; parent.appendChild(el); return { el, a: el.querySelector('span'), b: el.querySelector('em'), on: false }; }
const TAGS = SUBJECTS.filter((s) => s.tag).map((s) => ({ s, ...makeTag($('tags'), 'tag') }));
const slotRect = { photo: { x: 0, y: 0, w: 1, h: 1 }, world: { x: 0, y: 0, w: 1, h: 1 } };
function place(t, on, x, y, w) {
  if (t.on !== on) { t.el.classList.toggle('on', on); t.on = on; }
  if (!on) return;
  if (w) { const half = (t.w || (t.w = t.el.offsetWidth)) / 2 + 4; x = clamp(x, half, w - half); }
  t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
}
const tagRay = new THREE.Raycaster();
tagRay.layers.set(LAYER_PHOTO);
let tagCheck = 0;
// is anything nearer than the subject in the way? (a few tags per frame)
function tagHidden(t) {
  const origin = photoCam.position, dir = _d.copy(t.s.at).sub(origin), dist = dir.length();
  tagRay.set(origin, dir.divideScalar(dist));
  tagRay.far = Math.max(0.1, dist - t.s.r);
  const hit = tagRay.intersectObjects([world, subjects], true)[0];
  return !!hit && !(t.s.key === 'bike' && bike.getObjectById(hit.object.id)) && !(t.s.key === 'car' && cars[0].g.getObjectById(hit.object.id));
}
const _ta = new THREE.Vector3();
const placed = [];
function updateTags() {
  if (!state.overlays.tags) return;
  const r = slotRect.photo, c0 = state.fmt.coc;
  for (let i = 0; i < 3; i++) { const t = TAGS[tagCheck++ % TAGS.length]; t.hidden = tagHidden(t); }
  // nearer subjects claim their spot first; a tag that would overlap one already placed is dropped
  placed.length = 0;
  for (const t of TAGS) {
    _pp.copy(_ta.copy(t.s.at).setY(t.s.at.y + (t.s.up || 0))).project(photoCam);
    let on = !t.hidden && _pp.z < 1 && Math.abs(_pp.x) < 0.94 && Math.abs(_pp.y) < 0.9;
    const x = (_pp.x * 0.5 + 0.5) * r.w, y = (-_pp.y * 0.5 + 0.5) * r.h - 4, hw = (t.w || 70) / 2 + 3;
    if (on && (y < 44 || placed.some((p) => Math.abs(p[0] - x) < p[2] + hw && Math.abs(p[1] - y) < 22))) on = false;
    if (on) {
      placed.push([x, y, hw]);
      const { d, c } = subjectCoc(t.s), ok = c <= c0;
      setText(t.a, t.s.name); setText(t.b, fmtM(d));
      if (t.ok !== ok) { t.el.classList.toggle('soft', !ok); t.ok = ok; }
    }
    place(t, on, x, y, r.w);
  }
}
const LABELS = [
  { ...makeTag($('labels'), 'lbl'), at: () => V3(-0.05, EYE + 0.22, 0), text: () => ['相机', `${Math.round(state.cur.f)} mm · ${fmtN(state.cur.N)}`] },
  { ...makeTag($('labels'), 'lbl'), at: () => V3(state.cur.D, EYE + (state.cur.D * state.fmt.h) / state.cur.f / 2 + 0.15, 0), text: () => ['焦平面', fmtM(state.cur.D)] },
  { ...makeTag($('labels'), 'lbl'), at: () => V3(dof.near, 0.15, ((dof.near * state.fmt.w) / state.cur.f / 2) * 0.9), text: () => ['近界', fmtM(dof.near)] },
  { ...makeTag($('labels'), 'lbl'), at: () => V3(Math.min(dof.far, 40), 0.15, -((Math.min(dof.far, 40) * state.fmt.w) / state.cur.f / 2) * 0.9), text: () => ['远界', isFinite(dof.far) ? fmtM(dof.far) : '∞'], show: () => dof.far < 60 || !isFinite(dof.far) },
  { ...makeTag($('labels'), 'lbl warm'), at: () => V3(dof.H, 0.1, 0), text: () => ['超焦距', fmtM(dof.H)], show: () => dof.H < 40 },
  { ...makeTag($('labels'), 'lbl warm'), at: () => V3(SUB.bike.at.x, 2.05, SUB.bike.at.z), text: () => ['骑车人', `${Math.round(bikeState.kmh)} km/h`] },
];
function updateLabels() {
  const r = slotRect.world;
  placed.length = 0;
  for (const l of LABELS) {
    const p = _pp.copy(l.at());
    const dist = p.distanceTo(worldCam.position);
    p.project(worldCam);
    let on = (!l.show || l.show()) && p.z < 1 && Math.abs(p.x) < 0.96 && Math.abs(p.y) < 0.92 && dist < 120;
    const x = (p.x * 0.5 + 0.5) * r.w, y = (-p.y * 0.5 + 0.5) * r.h - 6, hw = (l.w || 80) / 2 + 3;
    // earlier labels win; one that would sit on top of another waits its turn
    if (on && placed.some((q) => Math.abs(q[0] - x) < q[2] + hw && Math.abs(q[1] - y) < 22)) on = false;
    if (on) { placed.push([x, y, hw]); const [a, b] = l.text(); setText(l.a, a); setText(l.b, b); }
    place(l, on, x, y, r.w);
  }
}

// --- pointer: orbit the world view, tap the photo to focus -------------------------------------------------
const pointers = new Map();
let drag = null, pinchD = 0;
worldSlot.addEventListener('contextmenu', (e) => e.preventDefault());
worldSlot.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  worldSlot.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); drag = { kind: 'pinch' }; return; }
  drag = { kind: e.button === 2 || e.shiftKey ? 'pan' : 'orbit', x: e.clientX, y: e.clientY };
  worldSlot.classList.add('grabbing');
});
worldSlot.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  if (!drag) return;
  if (drag.kind === 'pinch') {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD > 0) dolly(pinchD / d);
    pinchD = d;
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.kind === 'orbit') orbit(-dx * 0.006, -dy * 0.005);
  else pan(dx, dy, slotRect.world.h);
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) { drag = null; worldSlot.classList.remove('grabbing'); }
  else if (drag && drag.kind === 'pinch') drag = null;
}
worldSlot.addEventListener('pointerup', endPointer);
worldSlot.addEventListener('pointercancel', endPointer);
worldSlot.addEventListener('wheel', (e) => { e.preventDefault(); dolly(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

const raycaster = new THREE.Raycaster();
raycaster.layers.set(LAYER_PHOTO);
sky.raycast = () => {};
let tapStart = null;
photoSlot.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) tapStart = { x: e.clientX, y: e.clientY }; });
photoSlot.addEventListener('pointerup', (e) => {
  if (!tapStart || Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 8) { tapStart = null; return; }
  tapStart = null;
  const b = photoSlot.getBoundingClientRect();
  const nx = ((e.clientX - b.left) / b.width) * 2 - 1, ny = -((e.clientY - b.top) / b.height) * 2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), photoCam);
  const hit = raycaster.intersectObjects([world, subjects], true)[0];
  const ping = document.createElement('div');
  ping.className = 'focus-ping';
  ping.style.left = e.clientX - b.left + 'px'; ping.style.top = e.clientY - b.top + 'px';
  photoSlot.appendChild(ping);
  setTimeout(() => ping.remove(), 900);
  if (!hit) { setParam('D', D_MAX); toast('那是天空：对焦到最远 20 m'); return; }
  const d = hit.point.x;
  const near = SUBJECTS.filter((s) => !s.far).map((s) => [s, s.at.distanceTo(hit.point)]).sort((a, b2) => a[1] - b2[1])[0];
  const name = near && near[1] < 0.9 ? near[0].name : '';
  if (d > D_MAX) { setParam('D', D_MAX); toast(`${name || '那里'}在 ${fmtM(d)} 外，超出对焦范围：设到 20 m`); }
  else if (d < D_MIN) { setParam('D', D_MIN); toast('太近了，最近只能对焦 0.5 m'); }
  else { setParam('D', roundD(d)); toast(`对焦到${name ? ' ' + name : ''} ${fmtM(d)}`); }
  setActive('D');
});

// --- keys ------------------------------------------------------------------------------------------------
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'Escape') { closeAll(); return; }
  if (!$('help').hidden || !$('snapView').hidden) return;
  const inInput = e.target instanceof HTMLInputElement;
  if (drag && 'wasdqe'.includes(k) && k.length === 1) { keys.add(k); e.preventDefault(); return; }
  if (inInput && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown')) return;
  const order = ['N', 't', 'iso', 'f', 'D', 'wb'];
  if (k >= '1' && k <= '6') { const key = order[+k - 1]; setActive(key); ROWS[key].input.focus({ preventScroll: true }); }
  else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); stepParam(state.active, k === 'ArrowRight' ? 1 : -1, e.shiftKey); }
  else if (k === ' ') { if (e.target instanceof HTMLButtonElement) return; e.preventDefault(); shoot(); }
  else if (k === 'm' || k === 'a' || k === 's') setMode(k.toUpperCase());
  else if (k === 'k') setTime(!state.timeScale);
  else if (k === 'v') swapViews();
  else if (k === 'g') setOverlay('grid', !state.overlays.grid);
  else if (k === 'p') setOverlay('peak', !state.overlays.peak);
  else if (k === 'z') setOverlay('zebra', !state.overlays.zebra);
  else if (k === 'h') setOverlay('hist', !state.overlays.hist);
  else if (k === 'l') setOverlay('tags', !state.overlays.tags);
  else if (k === 'r') setView('behind');
  else if (k === '?' || k === '/') { e.preventDefault(); openModal('help'); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
function applyKeys(dt) {
  if (!keys.size) return;
  if (!drag) { keys.clear(); return; }
  const fw = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), st = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  if (fw || st) walk(fw, st, dt);
  const tr = (keys.has('q') ? 1 : 0) - (keys.has('e') ? 1 : 0);
  if (tr) turn(tr * 1.2 * dt);
}

// --- dialogs and menus ------------------------------------------------------------------------------------
function openModal(id) { $(id).hidden = false; $(id).querySelector('[data-close]').focus(); }
function closeAll() { for (const id of ['help', 'snapView']) $(id).hidden = true; showMenu(false); }
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; });
  m.querySelector('[data-close]').addEventListener('click', () => { m.hidden = true; });
});
$('helpBtn').addEventListener('click', () => openModal('help'));

// --- experiments ------------------------------------------------------------------------------------------
const EXPERIMENTS = [
  { title: '曝光三角', tab: 'ev', text: 'M 挡下光圈、快门、ISO 各管一份进光量。试着先把光圈开大三档，再把快门调快三档：测光指针回到 0，亮度不变，但景深变了。', set: { preset: 'golden', mode: 'M', autoISO: false, N: 8, t: 1 / 60, iso: 100, f: 50, D: 3 } },
  { title: '大光圈人像', tab: 'dof', text: '85 mm、ƒ/1.8、对焦 3 m：清晰区只有十几厘米，人物之外的咖啡馆和串灯都化成光斑。点“自动演示”，看光圈一路收到 ƒ/16 时背景怎样回来。', set: { preset: 'golden', mode: 'A', autoISO: true, N: 1.8, f: 85, D: 3 }, sweep: { key: 'N', a: 1.8, b: 16, dur: 7 } },
  { title: '超焦距风光', tab: 'dof', text: '24 mm、ƒ/11，对焦放在超焦距 H：从 H/2 到无穷远全部清晰——前面的标牌和远处的山同时清楚。对比对焦在 20 m 时近处的样子。', set: { preset: 'sunny', mode: 'A', autoISO: true, N: 11, f: 24, D: 1.75 }, sweep: { key: 'D', a: 0.6, b: 20, dur: 8 } },
  { title: '冻结与拖影', tab: 'motion', text: 'S 挡，对焦在骑车人经过的 7 m。1/2000 s 连车轮辐条都冻住；慢到 1/25 s，骑车人拉成残影，喷泉变成一根根水线。阴天的光刚好让整个快门范围都能正确曝光。', set: { preset: 'cloudy', mode: 'S', autoISO: false, iso: 100, t: 1 / 2000, f: 50, D: 7, hold: 'tripod' }, sweep: { key: 't', a: 1 / 2000, b: 1 / 25, dur: 7 } },
  { title: '夜景与高感', tab: 'iso', text: '夜晚只有 EV 3.5。ƒ/2.8、1/125 s 要 ISO 6400 才够亮，暗部冒出彩色颗粒。换成 1/25 s + ISO 1250 更干净，代价是骑车人糊了。', set: { preset: 'night', mode: 'M', autoISO: false, N: 2.8, t: 1 / 125, iso: 6400, f: 50, D: 3, wb: 3000 }, sweep: { key: 'iso', a: 800, b: 25600, dur: 8 } },
  { title: '白平衡与色温', tab: 'wb', text: '夜里路灯约 3000 K、天光偏蓝。白平衡设成 5500 K（日光）时画面一片橙黄；设到 3000 K，路灯下的人物恢复正常，天空却更蓝——混合光只能照顾一种。', set: { preset: 'night', mode: 'A', autoISO: true, N: 2, f: 50, D: 3, wb: 5500 }, sweep: { key: 'wb', a: 2800, b: 8000, dur: 8 } },
  { title: '焦距与视角', tab: 'fov', text: '从 24 mm 推到 135 mm：水平视角从 74° 收到 15°，人物从全身变成特写，景深也随之变浅。相机没动，透视关系其实没变。', set: { preset: 'cloudy', mode: 'A', autoISO: true, N: 4, f: 24, D: 3 }, sweep: { key: 'f', a: 24, b: 135, dur: 8 } },
  { title: '安全快门', tab: 'motion', text: '手持、135 mm、1/25 s——比安全快门 1/135 慢了两档多，整张照片都被手抖拖糊。打开防抖或换三脚架对比；再把快门提到 1/250 试试。', set: { preset: 'cloudy', mode: 'S', autoISO: true, t: 1 / 25, f: 135, D: 3, hold: 'hand' } },
  { title: '拉焦', tab: 'dof', text: 'ƒ/1.4 下把对焦从 0.5 m 拉到 20 m：现场视图里焦平面扫过整个广场，依次掠过花束、标牌、人物、喷泉和咖啡馆。', set: { preset: 'golden', mode: 'A', autoISO: true, N: 1.4, f: 50, D: 0.5 }, sweep: { key: 'D', a: 0.5, b: 20, dur: 9 } },
  { title: '画幅与等效', tab: 'fov', text: '同样 50 mm、ƒ/2，把画幅换成 M4/3：视角窄得像 104 mm，容许弥散圆只有 0.015 mm，同样 ISO 下噪点也更多。', set: { preset: 'cloudy', mode: 'A', autoISO: false, iso: 1600, N: 2, f: 50, D: 3, format: 'm43' } },
];
let sweep = null, curExp = null;
function showMenu(on) {
  $('expMenu').hidden = !on;
  $('expBtn').setAttribute('aria-expanded', String(on));
}
EXPERIMENTS.forEach((x, i) => {
  const b = document.createElement('button');
  b.role = 'menuitem';
  b.innerHTML = `<b>${i + 1}. ${x.title}</b><small>${x.text.slice(0, 44)}…</small>`;
  b.addEventListener('click', () => { showMenu(false); startExperiment(x); });
  $('expMenu').appendChild(b);
});
$('expBtn').addEventListener('click', (e) => { e.stopPropagation(); showMenu($('expMenu').hidden); });
addEventListener('click', (e) => { if (!$('expMenu').hidden && !e.target.closest('#expMenu')) showMenu(false); });
function applySettings(s) {
  if (s.preset) applyPreset(s.preset, true);
  if (s.mode) setMode(s.mode);
  if ('autoISO' in s) state.autoISO = s.autoISO;
  if (s.format) state.format = s.format; else if (s.preset) state.format = 'ff';
  if ('nd' in s) state.nd = s.nd; else if (s.preset) state.nd = 0;
  state.hold = s.hold || (s.preset ? 'tripod' : state.hold);
  for (const k of ['N', 't', 'iso', 'f', 'D', 'wb']) if (k in s) state[k] = s[k];
  if ('wb' in s) state.awb = false;
  state.meterValid = false;
}
function startExperiment(x) {
  stopSweep();
  curExp = x;
  applySettings(x.set);
  $('expCard').hidden = false;
  setText($('expTitle'), '实验 · ' + x.title);
  setText($('expText'), x.text);
  $('expPlay').hidden = !x.sweep;
  setText($('expHint'), x.sweep ? `在 ${ALL[x.sweep.key].fmt(x.sweep.a)} 与 ${ALL[x.sweep.key].fmt(x.sweep.b)} 之间来回` : '');
  showTab(x.tab);
  if (x.sweep) setActive(x.sweep.key);
  $('left').scrollTo({ top: 0, behavior: 'smooth' });
}
function stopSweep() { sweep = null; setPressed($('expPlay'), false); setText($('expPlay'), '▶ 自动演示'); }
$('expPlay').addEventListener('click', () => {
  if (sweep) { stopSweep(); return; }
  if (!curExp || !curExp.sweep) return;
  sweep = { ...curExp.sweep, t0: performance.now() };
  setPressed($('expPlay'), true); setText($('expPlay'), '■ 停止演示');
});
$('expClose').addEventListener('click', () => { stopSweep(); curExp = null; $('expCard').hidden = true; });
function runSweep(now) {
  if (!sweep) return;
  const k = ((now - sweep.t0) / 1000 / sweep.dur) % 2, u = smooth(k < 1 ? k : 2 - k);
  const v = Math.exp(lerp(Math.log(sweep.a), Math.log(sweep.b), u));
  const spec = ALL[sweep.key];
  setParam(sweep.key, sweep.key === 'D' || sweep.key === 'f' || sweep.key === 'wb' ? v : spec.fromPos(spec.toPos(v)), false);
}

// --- shooting ---------------------------------------------------------------------------------------------
const SHOTS = [];
function shoot() {
  const fl = $('flash');
  fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  const meta = {
    preset: state.preset, mode: state.mode, autoISO: state.autoISO, N: state.cur.N, t: state.t, iso: state.iso, f: state.cur.f, D: state.cur.D, wb: state.wb,
    format: state.format, hold: state.hold, nd: state.nd, ev: expo.delta, lightK: state.keyLightK,
  };
  snapshot().then((canvas) => {
    SHOTS.unshift({ canvas, meta, at: new Date() });
    if (SHOTS.length > 9) SHOTS.pop();
    renderRoll();
  });
}
$('shutterBtn').addEventListener('click', shoot);
const shotLine = (m) => `${fmtN(m.N)} · ${fmtT(m.t)} · ISO ${fmtISO(m.iso)} · ${Math.round(m.f)}mm`;
function renderRoll() {
  const roll = $('roll');
  roll.textContent = '';
  SHOTS.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'shot';
    b.title = shotLine(s.meta);
    const c = document.createElement('canvas');
    c.width = 180; c.height = 120;
    c.getContext('2d').drawImage(s.canvas, 0, 0, 180, 120);
    const cap = document.createElement('span');
    cap.textContent = shotLine(s.meta);
    b.append(c, cap);
    b.addEventListener('click', () => openShot(i));
    roll.appendChild(b);
  });
}
let viewing = null;
function openShot(i) {
  const s = SHOTS[i];
  viewing = s;
  const body = $('snapBody');
  body.textContent = '';
  const img = document.createElement('canvas');
  img.width = SW; img.height = SH; img.className = 'snap-img';
  img.getContext('2d').drawImage(s.canvas, 0, 0);
  const m = s.meta;
  const meta = document.createElement('div');
  meta.className = 'snap-meta';
  meta.innerHTML = [['模式', m.mode + (m.autoISO ? ' · 自动 ISO' : '')], ['光圈', fmtN(m.N)], ['快门', fmtT(m.t) + ' s'], ['ISO', fmtISO(m.iso)], ['焦距', Math.round(m.f) + ' mm'], ['对焦', fmtM(m.D)], ['白平衡', fmtK(m.wb)], ['曝光', fmtEV(m.ev) + ' EV'], ['光线', PRESETS[m.preset].name], ['画幅', FORMATS[m.format].name], ...(m.nd ? [['ND', `ND${2 ** m.nd}`]] : [])]
    .map(([a, b]) => `<span><i>${a}</i>${b}</span>`).join('');
  body.append(img, meta);
  setText($('snapTitle'), `底片 #${SHOTS.length - i} · ${s.at.toLocaleTimeString()}`);
  openModal('snapView');
}
$('snapRestore').addEventListener('click', () => {
  if (!viewing) return;
  const m = viewing.meta;
  applySettings({ preset: m.preset, mode: m.mode, autoISO: m.autoISO, N: m.N, t: m.t, iso: m.iso, f: m.f, D: m.D, wb: m.wb, format: m.format, hold: m.hold, nd: m.nd });
  $('snapView').hidden = true;
  toast('已恢复这张照片的参数');
});
$('snapSave').addEventListener('click', () => {
  if (!viewing) return;
  viewing.canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `camera-lab-${shotLine(viewing.meta).replace(/[^\w.]+/g, '_')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
});
$('resetBtn').addEventListener('click', () => {
  stopSweep();
  applySettings({ preset: 'golden', mode: 'M', autoISO: false, N: 2.8, t: 1 / 250, iso: 100, f: 85, D: 3, wb: 5200, format: 'ff', hold: 'tripod' });
  state.comp = 0; state.nd = 0; bikeState.kmh = 20;
  setView('behind');
  toast('已复位');
});
