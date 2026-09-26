
// ---------------------------------------------------------------------------
// Interface: readout cards and a running commentary, the formula and readings
// drawers, the top bar, module switches, the big viewer, labels pinned into
// the world, experiments and the film roll. Nothing here sets a camera
// parameter by itself — that is what the hardware on the bench is for.
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const appEl = $('app');
const _txt = new Map();
function setText(el, v) { if (_txt.get(el) !== v) { _txt.set(el, v); el.textContent = v; } }
function setHTML(el, v) { if (_txt.get(el) !== v) { _txt.set(el, v); el.innerHTML = v; } }
function setPressed(el, on) { const v = String(!!on); if (el.getAttribute('aria-pressed') !== v) el.setAttribute('aria-pressed', v); }
const joinNames = (list) => (list.length <= 2 ? list.join('和') : list.slice(0, -1).join('、') + '和' + list[list.length - 1]);

// --- top bar -------------------------------------------------------------------------------------------------------
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => setParam('preset', b.dataset.preset)));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { stopCinematicByUser(); setView(b.dataset.view); }));
$('cineBtn').addEventListener('click', () => startCinematic(!state.cinematic));
$('explodeBtn').addEventListener('click', () => { state.explodeTarget = state.explodeTarget ? 0 : 1; touch(); });
$('bigBtn').addEventListener('click', () => openBigView(!state.bigView));
$('helpBtn').addEventListener('click', () => openModal('help'));
function showMenu(id, on) {
  for (const m of ['expMenu', 'modMenu']) {
    const open = m === id && on;
    $(m).hidden = !open;
    $(m === 'expMenu' ? 'expBtn' : 'modBtn').setAttribute('aria-expanded', String(open));
  }
}
$('expBtn').addEventListener('click', (e) => { e.stopPropagation(); showMenu('expMenu', $('expMenu').hidden); });
$('modBtn').addEventListener('click', (e) => { e.stopPropagation(); showMenu('modMenu', $('modMenu').hidden); });
addEventListener('click', (e) => { if (!e.target.closest('.menu')) showMenu(null, false); });
for (const k of MODULE_KEYS) {
  const b = document.createElement('button');
  b.setAttribute('role', 'menuitemcheckbox');
  b.dataset.mod = k;
  b.innerHTML = `<i class="chk"></i><span><b>${MODULES[k].name}</b><small>${MODULES[k].desc}</small></span>`;
  b.addEventListener('click', (e) => { e.stopPropagation(); setModule(k, !state.modules[k]); });
  $('modMenu').appendChild(b);
}
{
  const n = document.createElement('p');
  n.className = 'menu-note';
  n.textContent = '控制台「对焦」区右下角的四个拨杆与这里同步。关掉的模块，它的旋钮、按钮和卡片一起收起，效果回到中性。';
  $('modMenu').appendChild(n);
}
function syncModuleUI(k, on) {
  document.querySelectorAll(`[data-module="${k}"]`).forEach((el) => { el.hidden = !on; });
  document.querySelectorAll(`[data-mod="${k}"]`).forEach((el) => el.setAttribute('aria-checked', String(on)));
  if (k === 'lab' && !on) closeExperiment();
}
onModule(syncModuleUI);

// --- readouts --------------------------------------------------------------------------------------------------------
const CABIN_H = 7.5;   // cm, ground to chimney
const subjectCoc = (s) => ({ d: s.at.x, c: Opt.coc(s.at.x, state.cur.D, state.cur.f, state.cur.N) });
function exposureWords(d) {
  const a = Math.abs(d);
  if (a < 0.35) return '正常';
  return (d > 0 ? '过曝 ' : '欠曝 ') + a.toFixed(1);
}
const STAT_KEYS = [['fov', '视角'], ['size', '主体大小'], ['motion', '运动模糊'], ['shake', '抖动'], ['noise', '噪点'], ['wb', '白平衡'], ['diff', '衍射'], ['vig', '暗角']];
const STATS = {};
for (const [k, name] of STAT_KEYS) {
  const d = document.createElement('div');
  d.className = 'stat';
  d.innerHTML = `<i>${name}</i><b></b><small></small>`;
  $('stats8').appendChild(d);
  STATS[k] = { el: d, b: d.querySelector('b'), s: d.querySelector('small'), cls: '' };
}
function stat(k, big, small, cls = '') {
  const s = STATS[k];
  setText(s.b, big); setText(s.s, small);
  if (s.cls !== cls) { s.el.className = 'stat' + (cls ? ' ' + cls : ''); s.cls = cls; }
}
const DOF_A = 20, DOF_B = 200;
const dofX = (d) => (!isFinite(d) || d > DOF_B ? 290 : 12 + (Math.log(Math.max(d, DOF_A) / DOF_A) / Math.log(DOF_B / DOF_A)) * 262);
function drawDofScale() {
  const near = dof.near, far = dof.far, D = state.cur.D, c0 = state.fmt.coc;
  let s = `<rect x="${dofX(near).toFixed(1)}" y="40" width="${Math.max(1.5, dofX(far) - dofX(near)).toFixed(1)}" height="12" rx="3" fill="rgba(127,227,255,.28)" stroke="rgba(127,227,255,.75)"/>`;
  s += '<line x1="12" y1="52" x2="296" y2="52" stroke="rgba(255,255,255,.35)"/>';
  for (const d of [25, 30, 40, 50, 70, 100, 150]) { const x = dofX(d); s += `<line x1="${x}" y1="52" x2="${x}" y2="56" stroke="rgba(255,255,255,.4)"/><text x="${x}" y="66" text-anchor="middle">${d}</text>`; }
  s += '<text x="290" y="66" text-anchor="middle">∞</text><text x="296" y="78" text-anchor="end">cm</text>';
  if (dof.H < DOF_B) s += `<line x1="${dofX(dof.H)}" y1="36" x2="${dofX(dof.H)}" y2="56" stroke="#ffb454" stroke-dasharray="2 2"/><text x="${dofX(dof.H)}" y="78" text-anchor="middle" style="fill:#ffb454">H</text>`;
  s += `<line x1="${dofX(D)}" y1="34" x2="${dofX(D)}" y2="58" stroke="#fff" stroke-width="1.6"/><text x="${dofX(D)}" y="78" text-anchor="middle" style="fill:#fff">D</text>`;
  let row = 0, lastX = -99;
  s += '<g class="sub">';
  for (const sub of [...SUBJECTS].sort((a, b) => a.at.x - b.at.x)) {
    const { d, c } = subjectCoc(sub), x = dofX(d), ok = c <= c0;
    row = x - lastX < 30 ? 1 - row : 0; lastX = x;
    const y = row ? 12 : 26;
    s += `<line x1="${x}" y1="${y + 3}" x2="${x}" y2="40" stroke="${ok ? '#7fe3ff' : '#ffb454'}" stroke-opacity=".6"/><circle cx="${x}" cy="40" r="2.6" fill="${ok ? '#7fe3ff' : '#ffb454'}"/>`;
    s += `<text x="${x}" y="${y}" text-anchor="middle" style="fill:${ok ? '#bff2ff' : '#ffd6a0'}">${sub.name}</text>`;
  }
  s += '</g>';
  setHTML($('dofScale'), s);
}
const safeT = (s) => (s < 1 / 20 ? '1/' + Math.round(1 / s) : fmtT(s));
let lastActive = '';
function updateReadouts() {
  const fm = state.fmt, f = state.cur.f, N = state.cur.N, D = state.cur.D, t = state.t;
  const zone = isFinite(dof.far) ? dof.far - dof.near : Infinity;
  // the four cards
  setText($('stFocus'), fmtLen(D));
  setText($('stAp'), fmtN(N) + ' · ' + fmtT(t));
  setText($('stZone'), isFinite(zone) ? fmtLen(zone) : '到 ∞');
  const ev = $('stExpo');
  setText(ev, exposureWords(expo.delta));
  ev.parentElement.className = 'stat' + (Math.abs(expo.delta) < 0.35 ? ' good' : Math.abs(expo.delta) > 1.5 ? ' bad' : ' warn');
  setText($('stSub'), `${Math.round(f)} mm · ISO ${fmtISO(state.iso)} · ${fmtK(state.wb)}`);
  setHTML($('explain'), explainText());
  // the readings drawer
  if (!$('rDrawer').hidden) {
    setText($('dofNums'), isFinite(dof.far) ? `${fmtLen(dof.near)} – ${fmtLen(dof.far)}` : `${fmtLen(dof.near)} – ∞`);
    setHTML($('dofKV'), `<span><i>景深</i>${isFinite(zone) ? fmtLen(zone) : '∞'}</span><span><i>前</i>${fmtLen(D - dof.near)}</span><span><i>后</i>${isFinite(dof.far) ? fmtLen(dof.far - D) : '∞'}</span><span><i>超焦距</i>${fmtLen(dof.H)}</span><span><i>c₀</i>${fm.coc.toFixed(3)} mm</span>`);
    drawDofScale();
    setText($('evNums'), `测光 EV ${state.meterEV.toFixed(1)} · 设置 EV ${expo.evSet.toFixed(1)}${state.nd ? ' + ND ' + state.nd : ''} · 场景 EV ${state.sceneEV.toFixed(1)}`);
    const hf = THREE.MathUtils.radToDeg(Opt.fov(f, fm.w)), vf = THREE.MathUtils.radToDeg(Opt.fov(f, fm.h)), df = THREE.MathUtils.radToDeg(Opt.fov(f, Math.hypot(fm.w, fm.h)));
    stat('fov', `${hf.toFixed(1)}° × ${vf.toFixed(1)}°`, fm.crop > 1.01 ? `等效 ${Math.round(f * fm.crop)} mm` : `对角线 ${df.toFixed(0)}° · 像距 ${fmtLen(imageDist(f))}`);
    const hImg = (CABIN_H * f) / SUB.cabin.at.x, frac = hImg / fm.h;
    stat('size', `${Math.round(frac * 100)}% 画高`, `小屋像高 ${hImg.toFixed(1)} mm`, frac > 1.05 ? 'warn' : '');
    const tr = SUB.train, bMm = Opt.motion(tr.speed || 0, tr.at.x, f, t), bPx = (bMm / fm.w) * PW;
    stat('motion', tr.speed > 0 ? `${bPx < 10 ? bPx.toFixed(1) : Math.round(bPx)} px` : '静止', tr.speed > 0 ? `火车走了 ${fmtLen(tr.speed * t)}` : '火车停着', bPx > 6 ? 'warn' : bPx < 1 ? 'good' : '');
    const safe = 1 / (f * fm.crop), shPx = expo.shakePx;
    if (state.hold === 'tripod') stat('shake', '减震开', `不减震时安全快门 ${safeT(safe)}`, 'good');
    else stat('shake', `${shPx < 10 ? shPx.toFixed(1) : Math.round(shPx)} px`, `安全快门 ${safeT(state.hold === 'handIS' ? safe * 2 ** state.isStops : safe)}${state.hold === 'handIS' ? ' · 防抖' : ''}`, shPx > 3 ? 'bad' : shPx > 1.2 ? 'warn' : 'good');
    const lvl = 0.18 * expo.gain, e = lvl * Opt.fwc(state.iso, fm), snr = Opt.snr(Math.min(lvl, 1), state.iso, fm);
    stat('noise', `SNR ${snr >= 100 ? Math.round(snr) : snr.toFixed(1)}`, `中灰 ${e >= 1000 ? (e / 1000).toFixed(1) + 'k' : Math.round(e)} 个光电子`, snr < 8 ? 'bad' : snr < 20 ? 'warn' : 'good');
    const dM = mired(state.wb) - mired(state.keyLightK);
    stat('wb', Math.abs(dM) < 12 ? '准确' : dM < 0 ? '偏暖' : '偏冷', `差 ${Math.round(Math.abs(dM))} mired · 主光 ${fmtK(state.keyLightK)}`, Math.abs(dM) < 12 ? 'good' : Math.abs(dM) > 60 ? 'warn' : '');
    const airy = Opt.airy(N) * 1000;
    stat('diff', `${airy.toFixed(0)} µm`, airy > fm.coc * 800 ? `≈ 容许 ${Math.round(fm.coc * 1000)} µm，开始发软` : `艾里斑 < 容许 ${Math.round(fm.coc * 1000)} µm`, airy > fm.coc * 800 ? 'warn' : '');
    const vig = sensorP.u.uVig.value;
    stat('vig', vig > 0.05 ? `−${vig.toFixed(1)} EV` : '几乎没有', N < 4 ? '四角进光少' : '收小光圈后消失', vig > 0.8 ? 'warn' : '');
  }
  // the formula drawer follows whatever was touched last
  if (state.active !== lastActive) { lastActive = state.active; const tab = PARAMS[state.active]?.tab; if (tab && tab !== fTab) showTab(tab); }
  if (!$('fDrawer').hidden) refreshFormulas();
  // the top bar
  document.querySelectorAll('[data-preset]').forEach((b) => setPressed(b, b.dataset.preset === state.preset));
  setPressed($('explodeBtn'), state.explodeTarget === 1);
  $('explodeBtn').title = state.explodeTarget ? '组装相机' : '拆开相机';
  if (state.bigView) setHTML($('lcd'), lcdHTML());
}
function explainText() {
  const out = [];
  const fm = state.fmt, f = state.cur.f, D = state.cur.D;
  const cand = SUBJECTS.filter((s) => s.tag && inPhoto(s.at, 1.02));
  const sharp = cand.filter((s) => subjectCoc(s).c <= fm.coc).map((s) => s.name);
  const soft = cand.filter((s) => subjectCoc(s).c > fm.coc).map((s) => s.name);
  // a slab thinner than a centimetre would print as "38 cm 到 38 cm"
  const z = !isFinite(dof.far) ? `从 ${fmtLen(dof.near)} 到无穷远` : dof.far - dof.near < 1 ? `只有 ${fmtLen(D)} 前后 ${fmtLen(dof.far - dof.near)} 厚` : `从 ${fmtLen(dof.near)} 到 ${fmtLen(dof.far)}`;
  if (!cand.length) out.push(`画面里只剩天幕。清晰区${z}。`);
  else if (!sharp.length) out.push(`焦平面（${fmtLen(D)}）上没有东西：清晰区${z}，里面空无一物，${joinNames(soft.slice(0, 3))}落到传感器上都摊成了<b class="am">光斑</b>。`);
  else if (!soft.length) out.push(`${joinNames(sharp)}都在清晰区里（${z}）：光斑小到看不出来，整张照片都清楚。`);
  else out.push(`清晰区${z}：${sharp.length === 1 ? '只有' : ''}<b class="cy">${joinNames(sharp)}</b>的光在传感器上汇成<b>一个点</b>，${joinNames(soft.slice(0, 3))}摊成<b class="am">光斑</b>，所以糊了。`);
  const tr = SUB.train;
  if (tr.speed > 0 && inPhoto(tr.at, 1.05)) {
    const px = (Opt.motion(tr.speed, tr.at.x, f, state.t) / fm.w) * PW;
    if (px > 4) out.push(`小火车在 ${fmtT(state.t)} s 里开出 ${fmtLen(tr.speed * state.t)}，拖出 <b>${Math.round(px)} px</b> 的残影。`);
    else if (px < 1) out.push(`${fmtT(state.t)} s 足够快，小火车被<b class="cy">冻结</b>住了。`);
  }
  if (state.hold !== 'tripod' && expo.shakePx > 1.5) out.push(`减震关着，${fmtT(state.t)} s 慢于安全快门，整张照片被台面的抖动拖糊约 <b class="am">${expo.shakePx.toFixed(1)} px</b>。`);
  if (Math.abs(expo.delta) >= 0.7) {
    let w = expo.delta > 0 ? `曝光多了 ${expo.delta.toFixed(1)} 档，亮部冲成白色。` : `曝光少了 ${(-expo.delta).toFixed(1)} 档，画面发暗。`;
    // in an auto mode the camera trusted its meter, and the meter assumes the frame averages 18 % grey
    const auto = state.modules.brain && (state.mode !== 'M' || state.autoISO);
    if (auto && Math.abs(expo.delta - expo.meterDelta) > 0.6) w += expo.delta > expo.meterDelta ? '相机照测光表曝光，可画面里大片暗绿的树让它以为场景更暗——该用曝光补偿往回拨。' : '相机照测光表曝光，可亮天空和灯让它以为场景更亮——该用曝光补偿往上拨。';
    out.push(w);
  }
  const snr = Opt.snr(Math.min(0.18 * expo.gain, 1), state.iso, fm);
  if (snr < 14) out.push(`ISO ${fmtISO(state.iso)} 下中灰每个像素只收到约 ${Math.round(0.18 * expo.gain * Opt.fwc(state.iso, fm))} 个光电子，噪点${snr < 7 ? '<b class="am">很明显</b>' : '开始显现'}。`);
  const dM = mired(state.wb) - mired(state.keyLightK);
  if (Math.abs(dM) > 30) out.push(`白平衡 ${fmtK(state.wb)} 比主光（约 ${fmtK(state.keyLightK)}）${dM < 0 ? '高' : '低'}，照片<b class="${dM < 0 ? 'am' : 'cy'}">偏${dM < 0 ? '暖' : '冷'}</b>。`);
  return out.slice(0, 4).join('');
}
function lcdHTML() {
  const auto = (k) => (isAuto(k) ? ' class="auto"' : '');
  const lim = expo.limited;
  const blink = (k) => ((k === 't' && (lim === 'slow' || lim === 'fast')) || (k === 'N' && (lim === 'open' || lim === 'closed')) || (k === 'iso' && lim.startsWith('iso')) ? ' class="blink"' : auto(k));
  const md = (state.modules.brain ? state.mode : 'M') + (state.autoISO ? '·ISO' : '');
  let scale = '';
  const md2 = clamp(Math.round(expo.meterDelta * 3), -9, 9);
  for (let k = -9; k <= 9; k += 1) {
    if (k % 3 && Math.abs(k) !== Math.abs(md2)) continue;
    const on = md2 !== 0 && ((md2 > 0 && k > 0 && k <= md2) || (md2 < 0 && k < 0 && k >= md2));
    scale += `<i class="${k === 0 ? 'z' : ''}${on ? ' on' : ''}"></i>`;
  }
  return `<span class="md">${md}</span><span${blink('t')}>${fmtT(state.t)}</span><span${blink('N')}>${fmtN(state.cur.N).replace('ƒ/', 'F')}</span><span${blink('iso')}>ISO ${fmtISO(state.iso)}</span>` +
    `${state.comp ? `<span>${fmtEV(state.comp)}</span>` : ''}${state.nd ? `<span>ND${2 ** state.nd}</span>` : ''}<span>${Math.round(state.cur.f)}mm</span><span>${fmtLen(state.cur.D)}</span><span${auto('wb')}>${fmtK(state.wb)}</span>` +
    `<span class="scale" title="测光指示">−${scale}+</span>`;
}

// --- drawers ------------------------------------------------------------------------------------------------------------
function toggleDrawer(id, btn) {
  const d = $(id), on = d.hidden;
  d.hidden = !on;
  setPressed($(btn), on);
  if (on) { if (id === 'fDrawer') refreshFormulas(true); updateReadouts(); }
}
$('fBtn').addEventListener('click', () => toggleDrawer('fDrawer', 'fBtn'));
$('rBtn').addEventListener('click', () => toggleDrawer('rDrawer', 'rBtn'));

// --- formulas (KaTeX, loaded lazily; plain text until it arrives) -------------------------------------------------------
let katex = null;
function plainTex(s) {
  return s.replace(/\\(mathrm|text|operatorname)\{([^}]*)\}/g, '$2').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\(qquad|quad|,|;|!)/g, ' ').replace(/\\times/g, '×').replace(/\\approx/g, '≈').replace(/\\le/g, '≤').replace(/\\cdot/g, '·')
    .replace(/\\log_2/g, 'log₂').replace(/\\arctan/g, 'arctan').replace(/\\Delta/g, 'Δ').replace(/\\lambda/g, 'λ').replace(/\\sigma/g, 'σ').replace(/\\theta/g, 'θ').replace(/\\omega/g, 'ω')
    .replace(/\\mu/g, 'µ').replace(/\\propto/g, '∝').replace(/\\sqrt\{([^}]*)\}/g, '√($1)').replace(/\\(begin|end)\{aligned\}/g, '').replace(/&/g, '').replace(/\\\\/g, '  ').replace(/[{}]/g, '').replace(/\\/g, '');
}
function tex(el, s) {
  if (katex) { try { katex.render(s, el, { throwOnError: false, displayMode: true, output: 'html' }); el.classList.remove('fallback'); return; } catch { /* fall through */ } }
  el.textContent = plainTex(s); el.classList.add('fallback');
}
const TABS = [['ev', '曝光'], ['dof', '景深'], ['motion', '快门'], ['iso', 'ISO'], ['fov', '焦距'], ['wb', '白平衡']];
let fTab = 'dof', fSig = '';
for (const [k, name] of TABS) {
  const b = document.createElement('button');
  b.setAttribute('role', 'tab'); b.dataset.tab = k; b.textContent = name;
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
        ['p', `照片亮度 × 2<sup>${n2(expo.delta, 1)}</sup> ≈ <b>${n2(expo.gain, expo.gain < 10 ? 2 : 0)} 倍</b>。${!state.modules.brain || (state.mode === 'M' && !state.autoISO) ? '在 M 挡，这个偏差全靠你自己转转盘消掉——看控制台上的测光表指针。' : `相机按测光 EV ${state.meterEV.toFixed(1)}${state.comp ? `、补偿 ${fmtEV(state.comp)}` : ''} 自动选了${state.mode === 'A' ? '快门' : state.mode === 'S' ? '光圈' : 'ISO'}，对应的转盘自己转到了位。`}`],
      ];
    }
    case 'dof': {
      const H = Opt.hyper(f, N, c0) / 10, sub = SUB.peak, cc = Opt.coc(sub.at.x, D, f, N);
      return [
        ['p', `容许弥散圆 c₀ = ${c0.toFixed(3)} mm（${fm.name}）。距离都从光心量起。先算超焦距 H：`],
        ['live', al(String.raw`H&=\frac{f^2}{N c_0}+f`, String.raw`&=\frac{${F}^2}{${n2(N, 1)}\times${c0.toFixed(3)}}+${F}\,\mathrm{mm}=${n2(H, 1)}\,\mathrm{cm}`)],
        ['p', '再得清晰范围的近点和远点：'],
        ['live', isFinite(dof.far)
          ? al(String.raw`D_{\text{近}}&=\frac{D(H-f)}{H+D-2f}=${n2(dof.near)}\,\mathrm{cm}`, String.raw`D_{\text{远}}&=\frac{D(H-f)}{H-D}=${n2(dof.far)}\,\mathrm{cm}`)
          : al(String.raw`D&=${n2(D, 1)}\,\mathrm{cm}\ \ge H`, String.raw`D_{\text{近}}&=${n2(dof.near)}\,\mathrm{cm},\ \ D_{\text{远}}=\infty`)],
        ['p', `${sub.at.x.toFixed(0)} cm 外的山峰，在传感器上摊成：`],
        ['live', al(String.raw`c&=\frac{f^2}{N(D-f)}\cdot\frac{|d-D|}{d}`, String.raw`&=\frac{${F}^2}{${n2(N, 1)}\times${Math.round(D * 10 - f)}}\cdot\frac{${n2(Math.abs(sub.at.x - D), 1)}}{${n2(sub.at.x, 1)}}=${cc.toFixed(3)}\,\mathrm{mm}`)],
        ['p', `是容许值的 <b>${n2(cc / c0, 1)} 倍</b>${cc > c0 ? '，所以糊' : '，所以清楚'}。现场视图里琥珀色光锥在传感器上画出的圆，就是它。`],
      ];
    }
    case 'motion': {
      const tr = SUB.train, v = tr.speed || 0, b = Opt.motion(v, tr.at.x, f, t), sh = expo.shakePx;
      const w = SHAKE_W / (state.hold === 'handIS' ? 2 ** state.isStops : 1);
      return [
        ['p', '快门开着的 t 秒里，横穿画面的物体（速度 v，距离 d）在传感器上划出的距离：'],
        ['live', al(String.raw`b&=\frac{v\,t\,f}{d}`, String.raw`&=\frac{${n2(v, 1)}\,\mathrm{cm/s}\times\frac{1}{${tDen}}\,\mathrm{s}\times${F}\,\mathrm{mm}}{${n2(tr.at.x, 1)}\,\mathrm{cm}}=${b.toFixed(3)}\,\mathrm{mm}`)],
        ['p', `≈ 画面宽度的 ${n2((b / fm.w) * 100, 2)}%，也就是 <b>${n2((b / fm.w) * PW, 1)} px</b>。这台相机在这 t 秒里渲染了 <b>${expo.K}</b> 个瞬间再平均。`],
        ['live', state.hold === 'tripod'
          ? String.raw`\text{不减震时的安全快门：}\ t\le\frac{1}{f\,k}=\frac{1}{${Math.round(f * fm.crop)}}\,\mathrm{s}`
          : al(String.raw`b_{\text{抖}}&=f\,\omega\,t`, String.raw`&=${F}\times${w.toFixed(4)}\times\frac{1}{${tDen}}=${(f * w * t).toFixed(3)}\,\mathrm{mm}`)],
        ...(state.hold !== 'tripod' ? [['p', `抖动拖影约 <b>${n2(sh, 1)} px</b>（ω = ${w.toFixed(4)} rad/s${state.hold === 'handIS' ? '，已被防抖除以 2⁴' : ''}）。`]] : []),
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
      const hf = THREE.MathUtils.radToDeg(Opt.fov(f, fm.w)), hImg = (CABIN_H * f) / SUB.cabin.at.x;
      return [
        ['p', `水平视角（画幅宽 w = ${fm.w} mm）：`],
        ['live', String.raw`\theta=2\arctan\frac{w}{2f}=2\arctan\frac{${fm.w}}{2\times${F}}=${n2(hf, 1)}^\circ`],
        ['p', `对远处的物体，像落在光心后约 f 处——所以焦距越长，机身在导轨上退得越远（模型里是 ${IMG_0} cm + ${IMG_K} cm × ${F} = ${n2(imageDist(f), 1)} cm）。${n2(SUB.cabin.at.x, 0)} cm 外、${CABIN_H} cm 高的小屋，在传感器上的像高：`],
        ['live', String.raw`h'=\frac{h\,f}{d}=\frac{${CABIN_H}\times${F}}{${n2(SUB.cabin.at.x, 1)}}=${n2(hImg, 1)}\,\mathrm{mm}`],
        ['p', hImg > fm.h ? `比画幅高度 ${fm.h} mm 还大，只拍得到 ${Math.round((fm.h / hImg) * 100)}%。` : `占画幅高度 ${fm.h} mm 的 ${Math.round((hImg / fm.h) * 100)}%。`],
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
        ['p', Math.abs(dM) < 12 ? '差不到 12 mired，几乎看不出偏色。' : dM < 0 ? '设定比光源高 → 红色被放大得偏多，照片<b class="am">偏暖</b>。' : '设定比光源低 → 蓝色被放大得偏多，照片<b class="cy">偏冷</b>。'],
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

// --- the big viewer ---------------------------------------------------------------------------------------------------
const bigSlot = $('bigSlot');
const slotRect = { x: 0, y: 0, w: 1, h: 1, glY: 0 };
function readSlot() {
  const b = bigSlot.getBoundingClientRect();
  slotRect.x = b.left; slotRect.y = b.top; slotRect.w = b.width; slotRect.h = b.height;
  slotRect.glY = innerHeight - b.bottom;
}
function openBigView(on) {
  state.bigView = on;
  $('big').hidden = !on;
  appEl.classList.toggle('big-on', on);
  setPressed($('bigBtn'), on);
  showTip(null);
  if (on) { stopCinematicByUser(); histo.fresh = false; }
}
$('bigClose').addEventListener('click', () => openBigView(false));
function setOverlay(k, on) {
  state.overlays[k] = on;
  document.querySelectorAll(`[data-ov="${k}"]`).forEach((b) => setPressed(b, on));
  $('gridSvg').style.display = state.overlays.grid ? '' : 'none';
  $('histo').style.display = state.overlays.hist ? '' : 'none';
  $('tags').style.display = state.overlays.tags ? '' : 'none';
}
document.querySelectorAll('[data-ov]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setOverlay(b.dataset.ov, !state.overlays[b.dataset.ov]); }));
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
// subject tags on the photo
function makeTag(parent, cls) { const el = document.createElement('div'); el.className = cls; el.innerHTML = '<span></span><em></em>'; parent.appendChild(el); return { el, a: el.querySelector('span'), b: el.querySelector('em'), on: false }; }
const TAGS = SUBJECTS.filter((s) => s.tag).map((s) => ({ s, ...makeTag($('tags'), 'tag') }));
function place(t, on, x, y, w) {
  if (t.on !== on) { t.el.classList.toggle('on', on); t.on = on; }
  if (!on) return;
  if (w) { const half = (t.w || (t.w = t.el.offsetWidth)) / 2 + 4; x = clamp(x, half, w - half); }
  t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
}
const tagRay = new THREE.Raycaster();
tagRay.layers.set(LAYER_PHOTO);
tagRay.layers.enable(LAYER_PHOTO_ONLY);
let tagCheck = 0;
const _d = new THREE.Vector3(), _ta = new THREE.Vector3();
function tagHidden(t) {
  const origin = photoCam.position, dir = _d.copy(t.s.at).sub(origin), dist = dir.length();
  tagRay.set(origin, dir.divideScalar(dist));
  tagRay.far = Math.max(0.5, dist - t.s.r);
  const hit = tagRay.intersectObject(valley, true)[0];
  return !!hit && !(t.s.key === 'train' && trainGroup.getObjectById(hit.object.id));
}
const placed = [];
function updateTags() {
  if (!state.overlays.tags) return;
  const r = slotRect, c0 = state.fmt.coc;
  for (let i = 0; i < 3; i++) { const t = TAGS[tagCheck++ % TAGS.length]; t.hidden = tagHidden(t); }
  placed.length = 0;
  for (const t of TAGS) {
    _pp.copy(_ta.copy(t.s.at).setY(t.s.at.y + (t.s.up || 0))).project(photoCam);
    let on = !t.hidden && _pp.z < 1 && Math.abs(_pp.x) < 0.94 && Math.abs(_pp.y) < 0.9;
    const x = (_pp.x * 0.5 + 0.5) * r.w, y = (-_pp.y * 0.5 + 0.5) * r.h - 4, hw = (t.w || 70) / 2 + 3;
    if (on && (y < 44 || placed.some((p) => Math.abs(p[0] - x) < p[2] + hw && Math.abs(p[1] - y) < 22))) on = false;
    if (on) {
      placed.push([x, y, hw]);
      const { d, c } = subjectCoc(t.s), ok = c <= c0;
      setText(t.a, t.s.name); setText(t.b, fmtLen(d));
      if (t.ok !== ok) { t.el.classList.toggle('soft', !ok); t.ok = ok; }
    }
    place(t, on, x, y, r.w);
  }
}
// tap the photo to focus there, like a touchscreen camera: here in the big
// viewer, or on the live screen on the console. (nx, ny) is the spot in the
// photo, −1 … 1 from the bottom-left corner.
const focusRay = new THREE.Raycaster();
focusRay.layers.set(LAYER_PHOTO);
focusRay.layers.enable(LAYER_PHOTO_ONLY);
const _fxy = new THREE.Vector2();
function focusOnPhoto(nx, ny) {
  focusRay.setFromCamera(_fxy.set(nx, ny), photoCam);
  const hit = focusRay.intersectObject(valley, true)[0];
  if (!hit) { setParam('D', D_MAX); toast(`那里什么也没有：对焦到最远 ${D_MAX} cm`); return; }
  const d = hit.point.x;
  const near = SUBJECTS.map((s) => [s, s.at.distanceTo(hit.point) / Math.max(s.r, 1)]).sort((a, c) => a[1] - c[1])[0];
  const name = near && near[1] < 1.6 ? near[0].name : hit.object.material === skyBackdrop.material ? '天幕' : '';
  if (d > D_MAX) { setParam('D', D_MAX); toast(`${name || '那里'}在 ${fmtLen(d)} 外，超出对焦范围：设到 ${D_MAX} cm`); }
  else if (d < D_MIN) { setParam('D', D_MIN); toast(`太近了，最近只能对焦 ${D_MIN} cm`); }
  else { setParam('D', roundD(d)); toast(`对焦到${name ? ' ' + name : ''} ${fmtLen(d)}`); }
}
let tapStart = null;
bigSlot.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) tapStart = { x: e.clientX, y: e.clientY }; });
bigSlot.addEventListener('pointerup', (e) => {
  if (!tapStart || Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 8) { tapStart = null; return; }
  tapStart = null;
  const b = bigSlot.getBoundingClientRect();
  const ping = document.createElement('div');
  ping.className = 'focus-ping';
  ping.style.left = e.clientX - b.left + 'px'; ping.style.top = e.clientY - b.top + 'px';
  bigSlot.appendChild(ping);
  setTimeout(() => ping.remove(), 900);
  focusOnPhoto(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
});

// --- labels pinned into the world ------------------------------------------------------------------------------------------
const LABELS = [
  { ...makeTag($('labels'), 'lbl'), at: () => V3(state.cur.D, AXIS_Y + (state.cur.D * state.fmt.h) / state.cur.f / 2 + 1.2, 0), text: () => ['焦平面', fmtLen(state.cur.D)] },
  { ...makeTag($('labels'), 'lbl'), at: () => V3((Math.max(dof.near, 1) + Math.min(dof.far, 140)) / 2, 0.7, ((state.cur.D * state.fmt.w) / state.cur.f / 2) * 0.72 + 3), text: () => ['清晰区', isFinite(dof.far) ? fmtLen(dof.far - dof.near) : '到 ∞'] },
  { ...makeTag($('labels'), 'lbl warm'), at: () => V3(dof.H, 1.2, 3.2), text: () => ['超焦距', fmtLen(dof.H)], show: () => dof.H < RAIL_X1 },
  { ...makeTag($('labels'), 'lbl'), at: () => bodyAnchor('sensor').add(V3(0, 5, 2)), text: () => ['传感器', '倒像'], show: () => state.explode > 0.5 },
  { ...makeTag($('labels'), 'lbl'), at: () => bodyAnchor('shutter').add(V3(0, -5.5, 3)), text: () => ['快门帘', fmtT(state.t) + ' s'], show: () => state.explode > 0.5 },
  { ...makeTag($('labels'), 'lbl warm'), at: () => lensAnchor('bellows', 8.5), text: () => ['皮腔', `像距 ${fmtLen(imageDist(state.cur.f))}`], show: () => state.cur.f > 40 },
  { ...makeTag($('labels'), 'lbl'), at: () => lensAnchor('front', 10.2), text: () => ['前组', ''], show: () => state.explode > 0.5 },
  { ...makeTag($('labels'), 'lbl'), at: () => lensAnchor('zoom', 11), text: () => ['变焦组', `${Math.round(state.cur.f)} mm`], show: () => state.explode > 0.5 },
  { ...makeTag($('labels'), 'lbl'), at: () => lensAnchor('focus', -10), text: () => ['对焦组', ''], show: () => state.explode > 0.5 },
  { ...makeTag($('labels'), 'lbl'), at: () => lensAnchor('iris', 9.6), text: () => ['光圈', fmtN(state.cur.N)], show: () => state.explode > 0.5 },
  { ...makeTag($('labels'), 'lbl'), at: () => lensAnchor('rear', -8.4), text: () => ['后组', ''], show: () => state.explode > 0.5 },
];
const _lp = new THREE.Vector3();
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  placed.length = 0;
  for (const l of LABELS) {
    const p = _lp.copy(l.at());
    const dist = p.distanceTo(worldCam.position);
    p.project(worldCam);
    let on = !state.bigView && (!l.show || l.show()) && p.z < 1 && Math.abs(p.x) < 0.97 && Math.abs(p.y) < 0.94 && dist < 700;
    const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h - 6, hw = (l.w || 70) / 2 + 3;
    if (on && placed.some((q) => Math.abs(q[0] - x) < q[2] + hw && Math.abs(q[1] - y) < 22)) on = false;
    if (on) { placed.push([x, y, hw]); const [a, b] = l.text(); setText(l.a, a); setText(l.b, b); }
    place(l, on, x, y, 0);
  }
}

// --- keys: only the essentials ----------------------------------------------------------------------------------------------
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') { closeAll(); return; }
  if (!$('help').hidden || !$('snapView').hidden) return;
  if (e.key === 'v' || e.key === 'V') openBigView(!state.bigView);
});
function openModal(id) { $(id).hidden = false; $(id).querySelector('[data-close]').focus(); }
function closeAll() {
  if (!$('help').hidden || !$('snapView').hidden) { $('help').hidden = true; $('snapView').hidden = true; return; }
  if (!$('expMenu').hidden || !$('modMenu').hidden) { showMenu(null, false); return; }
  if (state.bigView) openBigView(false);
}
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; });
  m.querySelector('[data-close]').addEventListener('click', () => { m.hidden = true; });
});

// --- experiments (module "lab") --------------------------------------------------------------------------------------------
const EXPERIMENTS = [
  { title: '曝光三角', tab: 'ev', text: 'M 挡下光圈、快门、ISO 各管一份进光量。把镜头上的光圈环开大三档，再把机顶快门转盘拨快三档：控制台上的测光表指针回到原处，亮度不变，但清晰区变薄了。', set: { preset: 'golden', mode: 'M', N: 8, t: 1 / 30, iso: 100, f: 50, D: 52 } },
  { title: '大光圈浅景深', tab: 'dof', needs: ['brain'], text: '85 mm、ƒ/1.8 对焦小屋：清晰区不到 1 厘米，前面的松树、后面的风车和山峰都化开。点“自动演示”，看光圈环一路转到 ƒ/16 时背景怎样回来。', set: { preset: 'golden', mode: 'A', autoISO: true, N: 1.8, f: 85, D: 52 }, sweep: { key: 'N', a: 1.8, b: 16, dur: 7 } },
  { title: '超焦距', tab: 'dof', text: '24 mm、ƒ/22，对焦放在超焦距 H（约 90 cm）：从 H/2 到无穷远都清楚——山峰和天幕同时清晰，近处的花丛却还是糊的。注意衍射：ƒ/22 的艾里斑已和容许弥散圆一样大。', set: { preset: 'sunny', mode: 'M', N: 22, t: 1 / 60, iso: 100, f: 24, D: 90 }, sweep: { key: 'D', a: 25, b: 100, dur: 8 } },
  { title: '冻结与拖影', tab: 'motion', needs: ['brain'], text: 'S 挡，对焦在火车轨道（45 cm）。1/2000 s 连车轮都冻住；慢到 1/25 s，火车拉成残影，溪水变成一道道水线。阴天的光让整个快门范围都能正确曝光——光圈环会自己转。', set: { preset: 'cloudy', mode: 'S', autoISO: false, iso: 100, t: 1 / 2000, f: 50, D: 45, train: 30 }, sweep: { key: 't', a: 1 / 2000, b: 1 / 25, dur: 7 } },
  { title: '夜景与高感', tab: 'iso', text: '夜里只有 EV 3.5。ƒ/2.8、1/125 s 要 ISO 6400 才够亮，暗部冒出彩色颗粒。演示把 ISO 从 800 推到 25600：画面一路变亮，噪点也一路变多。', set: { preset: 'night', mode: 'M', N: 2.8, t: 1 / 125, iso: 6400, f: 50, D: 52, wb: 3000 }, sweep: { key: 'iso', a: 800, b: 25600, dur: 8 } },
  { title: '白平衡与色温', tab: 'wb', text: '小屋窗和路灯约 3000 K，天幕偏蓝。白平衡设 5500 K（日光）时照片一片橙黄；拨到 3000 K，灯下颜色正常了，天空却更蓝——混合光只能照顾一种。', set: { preset: 'night', mode: 'M', N: 2, t: 1 / 25, iso: 800, f: 50, D: 52, wb: 5500 }, sweep: { key: 'wb', a: 2800, b: 8000, dur: 8 } },
  { title: '焦距与视角', tab: 'fov', text: '从 24 mm 推到 135 mm：水平视角从 74° 收到 15°，机身沿导轨往后退——像距跟着焦距变长。小屋从一小点变成塞满画面，景深也随之变浅。', set: { preset: 'cloudy', mode: 'M', N: 4, t: 1 / 250, iso: 100, f: 24, D: 52 }, sweep: { key: 'f', a: 24, b: 135, dur: 8 } },
  { title: '安全快门', tab: 'motion', needs: ['kit'], text: '减震关、135 mm、1/25 s——比安全快门 1/135 慢了两档多，整张照片都被台面的抖动拖糊。把减震开关拨到“防抖”或“开”对比；再把快门拨到 1/250 试试。', set: { preset: 'cloudy', mode: 'M', N: 13, t: 1 / 25, iso: 100, f: 135, D: 52, hold: 'hand' } },
  { title: '拉焦', tab: 'dof', text: 'ƒ/1.4 下把对焦从 25 cm 拉到 100 cm：焦平面扫过整个山谷，依次掠过花丛、松树、火车、小屋、风车和山峰。看对焦环和控制台的滑块一起走。', set: { preset: 'golden', mode: 'M', N: 1.4, t: 1 / 1000, iso: 100, f: 50, D: 25 }, sweep: { key: 'D', a: 25, b: 100, dur: 9 } },
  { title: 'ND 与大光圈', tab: 'ev', needs: ['kit'], text: '晴天想用 ƒ/1.4 拍浅景深：快门已经最快 1/2000，还是过曝 3 档。点控制台上的 ND8，让它拧到镜头前——测光表回到 0。', set: { preset: 'sunny', mode: 'M', N: 1.4, t: 1 / 2000, iso: 100, f: 50, D: 38, nd: 0 } },
  { title: '画幅与等效', tab: 'fov', needs: ['kit'], text: '同样 50 mm，把画幅旋钮拨到 M4/3：传感器上只用中间一块，视角窄得像 100 mm；容许弥散圆只有 0.015 mm，同样 ISO 1600 下噪点也更多。', set: { preset: 'cloudy', mode: 'M', N: 11, t: 1 / 500, iso: 1600, f: 50, D: 52, format: 'm43' } },
];
let sweep = null, curExp = null;
EXPERIMENTS.forEach((x, i) => {
  const b = document.createElement('button');
  b.setAttribute('role', 'menuitem');
  b.innerHTML = `<b>${i + 1}. ${x.title}</b><small>${x.text.slice(0, 44)}…</small>`;
  b.addEventListener('click', () => { showMenu(null, false); startExperiment(x); });
  $('expMenu').appendChild(b);
});
function applySettings(s) {
  if (s.preset) applyPreset(s.preset, true);
  if (s.mode) state.mode = state.modules.brain ? s.mode : 'M';
  state.autoISO = !!s.autoISO && state.modules.brain;
  state.awb = false; state.comp = 0;
  if (state.modules.kit) { state.format = s.format || 'ff'; state.nd = s.nd || 0; state.hold = s.hold || 'tripod'; }
  for (const k of ['N', 't', 'iso', 'f', 'D', 'wb']) if (k in s) state[k] = s[k];
  if ('train' in s) setParam('train', s.train, false);
  state.meterValid = false;
}
function startExperiment(x) {
  stopSweep();
  ensureModules(x.needs || []);
  curExp = x;
  applySettings(x.set);
  $('expCard').hidden = false;
  setText($('expTitle'), '实验 · ' + x.title);
  setText($('expText'), x.text);
  $('expPlay').hidden = !x.sweep;
  setText($('expHint'), x.sweep ? `在 ${PARAMS[x.sweep.key].fmt(x.sweep.a)} 与 ${PARAMS[x.sweep.key].fmt(x.sweep.b)} 之间来回` : '');
  showTab(x.tab);
  touch(x.sweep ? x.sweep.key : undefined);
  stopCinematicByUser();
}
function stopSweep() { sweep = null; setPressed($('expPlay'), false); setText($('expPlay'), '▶ 自动演示'); }
function closeExperiment() { stopSweep(); curExp = null; $('expCard').hidden = true; }
$('expPlay').addEventListener('click', () => {
  if (sweep) { stopSweep(); return; }
  if (!curExp || !curExp.sweep) return;
  sweep = { ...curExp.sweep, t0: performance.now() };
  setPressed($('expPlay'), true); setText($('expPlay'), '■ 停止演示');
});
$('expClose').addEventListener('click', closeExperiment);
function runSweep(now) {
  if (!sweep) return;
  // a user who grabs the swept control takes over
  if (drag && drag.c && drag.c.key === sweep.key) { stopSweep(); return; }
  const k = ((now - sweep.t0) / 1000 / sweep.dur) % 2, u = smooth(k < 1 ? k : 2 - k);
  const v = Math.exp(lerp(Math.log(sweep.a), Math.log(sweep.b), u));
  const P = PARAMS[sweep.key];
  setParam(sweep.key, P.stops ? P.v(P.p(v)) : v, false);
}

function resetAll() {
  stopSweep();
  applySettings({ preset: 'golden', mode: 'M', N: 2, t: 1 / 500, iso: 100, f: 50, D: 38, wb: 5200, train: 16 });
  state.timeScale = 1;
  state.explodeTarget = 1;
  setView('home');
  toast('已复位');
}

// --- shooting (module "shoot") ------------------------------------------------------------------------------------------------
const ROLL = [];
function shoot() {
  if (!state.modules.shoot) return;
  triggerShutter();
  const fl = $('flash');
  fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  const meta = {
    preset: state.preset, mode: state.modules.brain ? state.mode : 'M', autoISO: state.autoISO, N: state.cur.N, t: state.t, iso: state.iso, f: state.cur.f, D: state.cur.D, wb: state.wb,
    format: state.format, hold: state.hold, nd: state.nd, ev: expo.delta, lightK: state.keyLightK,
  };
  snapshot().then((canvas) => {
    ROLL.unshift({ canvas, meta, at: new Date() });
    if (ROLL.length > 9) ROLL.pop();
    renderRoll();
  });
}
const shotLine = (m) => `${fmtN(m.N)} · ${fmtT(m.t)} · ISO ${fmtISO(m.iso)} · ${Math.round(m.f)}mm`;
function renderRoll() {
  const roll = $('roll');
  roll.textContent = '';
  ROLL.forEach((s, i) => {
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
  const s = ROLL[i];
  viewing = s;
  const body = $('snapBody');
  body.textContent = '';
  const img = document.createElement('canvas');
  img.width = SW; img.height = SH; img.className = 'snap-img';
  img.getContext('2d').drawImage(s.canvas, 0, 0);
  const m = s.meta;
  const meta = document.createElement('div');
  meta.className = 'snap-meta';
  meta.innerHTML = [['模式', m.mode + (m.autoISO ? ' · 自动 ISO' : '')], ['光圈', fmtN(m.N)], ['快门', fmtT(m.t) + ' s'], ['ISO', fmtISO(m.iso)], ['焦距', Math.round(m.f) + ' mm'], ['对焦', fmtLen(m.D)], ['白平衡', fmtK(m.wb)], ['曝光', fmtEV(m.ev) + ' EV'], ['光线', PRESETS[m.preset].name], ['画幅', FORMATS[m.format].name], ...(m.nd ? [['ND', `ND${2 ** m.nd}`]] : [])]
    .map(([a, b]) => `<span><i>${a}</i>${b}</span>`).join('');
  body.append(img, meta);
  setText($('snapTitle'), `底片 #${ROLL.length - i} · ${s.at.toLocaleTimeString()}`);
  openModal('snapView');
}
$('snapRestore').addEventListener('click', () => {
  if (!viewing) return;
  const m = viewing.meta;
  ensureModules([...(m.mode !== 'M' || m.autoISO ? ['brain'] : []), ...(m.format !== 'ff' || m.nd || m.hold !== 'tripod' ? ['kit'] : [])]);
  applySettings({ preset: m.preset, mode: m.mode, autoISO: m.autoISO, N: m.N, t: m.t, iso: m.iso, f: m.f, D: m.D, wb: m.wb, format: m.format, hold: m.hold, nd: m.nd });
  $('snapView').hidden = true;
  toast('已恢复这张照片的参数——镜头和转盘都转回去了');
});
$('snapSave').addEventListener('click', () => {
  if (!viewing) return;
  viewing.canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bench-camera-${shotLine(viewing.meta).replace(/[^\w.]+/g, '_')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
});
