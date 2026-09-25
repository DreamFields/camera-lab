
// ---------------------------------------------------------------------------
// Interface: readouts, controls, labels pinned to the scene, pointer + keys.
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const appEl = $('app'), canvasEl = renderer.domElement;
const fmtCm = (v) => (v < 10 ? v.toFixed(1) : v.toFixed(v < 100 ? 1 : 0)).replace(/\.0$/, '') + ' cm';
const fmtN = (N) => 'ƒ/' + (N < 10 ? (Math.round(N * 10) / 10).toString() : Math.round(N).toString());

function touchControl() { state.lastControlAt = performance.now(); }
function setFocus(s, user = true) { state.focusTarget = clamp(s, FOCUS_MIN, FOCUS_MAX); if (user) touchControl(); }
function setAperture(N, user = true) { state.NTarget = clamp(N, N_MIN, N_MAX); if (user) touchControl(); }
function setExplode(e, user = true) { state.explodeTarget = e; if (user) touchControl(); }

// slider ticks at the three presets
FOCUS_PRESETS.forEach((d) => {
  const t = document.createElement('span');
  t.style.left = ((d - FOCUS_MIN) / (FOCUS_MAX - FOCUS_MIN) * 100) + '%';
  $('ticks').appendChild(t);
});
document.querySelectorAll('[data-focus]').forEach((b) => b.addEventListener('click', () => setFocus(FOCUS_PRESETS[+b.dataset.focus])));
document.querySelectorAll('[data-ap]').forEach((b) => b.addEventListener('click', () => setAperture(AP_PRESETS[+b.dataset.ap])));
document.querySelectorAll('[data-lens]').forEach((b) => b.addEventListener('click', () => setExplode(+b.dataset.lens)));
$('dist').addEventListener('input', (e) => setFocus(+e.target.value));
$('cineBtn').addEventListener('click', () => startCinematic(!state.cinematic));
const helpEl = $('help');
function showHelp(on) { helpEl.hidden = !on; if (on) $('helpClose').focus(); }
$('helpBtn').addEventListener('click', () => showHelp(true));
$('helpClose').addEventListener('click', () => showHelp(false));
helpEl.addEventListener('click', (e) => { if (e.target === helpEl) showHelp(false); });

// --- readouts ---------------------------------------------------------------------------
let lastText = '';
const _txt = new Map();
function setText(id, v) { if (_txt.get(id) !== v) { _txt.set(id, v); $(id).textContent = v; } }
function setPressed(el, on) { const v = String(on); if (el.getAttribute('aria-pressed') !== v) el.setAttribute('aria-pressed', v); }
function joinNames(list) { return list.map((s) => s.name).join('和'); }
function updateReadouts() {
  const s = state.focus, N = state.N, zone = Math.min(dof.far, 999) - dof.near;
  setText('stFocus', fmtCm(s));
  setText('stAp', fmtN(N));
  setText('stZone', fmtCm(zone));
  setText('distOut', fmtCm(s));
  const sl = $('dist');
  const sv = s.toFixed(1);
  if (document.activeElement !== sl && sl.value !== sv) sl.value = sv;
  const pv = ((s - FOCUS_MIN) / (FOCUS_MAX - FOCUS_MIN) * 100).toFixed(2) + '%';
  if (_txt.get('--p') !== pv) { _txt.set('--p', pv); sl.style.setProperty('--p', pv); }
  const fi = FOCUS_PRESETS.findIndex((p) => Math.abs(p - state.focusTarget) < 0.6);
  document.querySelectorAll('[data-focus]').forEach((b) => setPressed(b, +b.dataset.focus === fi));
  const ai = AP_PRESETS.findIndex((p) => Math.abs(p - state.NTarget) < 0.05);
  document.querySelectorAll('[data-ap]').forEach((b) => setPressed(b, +b.dataset.ap === ai));
  document.querySelectorAll('[data-lens]').forEach((b) => setPressed(b, +b.dataset.lens === state.explodeTarget));
  const sharp = SUBJECTS.filter((_, j) => subjectState[j].sharp);
  const soft = SUBJECTS.filter((_, j) => !subjectState[j].sharp);
  const z = `清晰区：<b>${fmtCm(zone)}</b>。`;
  let html;
  if (!sharp.length) html = `焦平面上没有东西：每一束光落到玻璃上都已摊成<b class="am">光斑</b>，整张照片都是软的。${z}`;
  else if (!soft.length) html = `<b class="cy">${joinNames(sharp)}</b>都在清晰区里：光斑小到看不出来，整张照片都清楚。${z}`;
  else html = `${sharp.length === 1 ? '只有' : ''}<b class="cy">${joinNames(sharp)}</b>落在焦平面上：光线在玻璃上汇成<b>一个点</b>。${joinNames(soft)}落成<b class="am">光斑</b>，所以糊了。${z}`;
  if (html !== lastText) { $('explain').innerHTML = html; lastText = html; }
}

// --- labels pinned into the scene -----------------------------------------------------------
const labelsEl = $('labels');
function makeLabel(text, hint, warm) {
  const el = document.createElement('div');
  el.className = 'lbl' + (warm ? ' warm' : '');
  el.innerHTML = `<span>${text}</span><em>${hint}</em>`;
  labelsEl.appendChild(el);
  return { el, hint: el.querySelector('em') };
}
const LABELS = [
  { ...makeLabel('像平面', '倒像'), at: () => V3(GLASS_X, AXIS_Y + GLASS_H / 2 + 1.6, 0), show: () => true },
  { ...makeLabel('对焦环', '拖动 ⇅'), at: () => V3(parts.ring.g.position.x + 6.9, AXIS_Y + 14.6, 0), show: () => true },
  { ...makeLabel('焦平面', ''), at: () => V3(state.focus, AXIS_Y + state.focus * TAN_V + 0.8, 0), show: () => true, upd: (l) => (l.hint.textContent = fmtCm(state.focus)) },
  { ...makeLabel('清晰区', ''), at: () => V3((dof.near + Math.min(dof.far, 140)) / 2, 0.6, 2 * state.focus * TAN_H / 2 * 0.72), show: () => true, upd: (l) => (l.hint.textContent = fmtCm(Math.min(dof.far, 999) - dof.near)) },
  { ...makeLabel('前组镜片', ''), at: () => lensAnchor('front', 7.6), show: () => state.explode > 0.5 },
  { ...makeLabel('对焦组', ''), at: () => lensAnchor('focus', -7.4), show: () => state.explode > 0.5 },
  { ...makeLabel('光圈', ''), at: () => lensAnchor('iris', 7.4), show: () => state.explode > 0.5, upd: (l) => (l.hint.textContent = fmtN(state.N)) },
  { ...makeLabel('后组镜片', ''), at: () => lensAnchor('rear', -7.6), show: () => state.explode > 0.5 },
];
const _lp = new THREE.Vector3(), _ld = new THREE.Vector3();
const occRay = new THREE.Raycaster();
function hiddenBehindGlass(p) {
  const d = p.distanceTo(camera.position);
  occRay.set(camera.position, _ld.copy(p).sub(camera.position).normalize());
  occRay.far = d - 0.8;
  return occRay.intersectObject(imagePlane, false).length > 0;
}
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  for (const l of LABELS) {
    const p = _lp.copy(l.at());
    const dist = p.distanceTo(camera.position);
    const occluded = l !== LABELS[0] && hiddenBehindGlass(p);
    p.project(camera);
    const on = l.show() && !occluded && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05 && dist < 330;
    l.el.classList.toggle('on', on);
    if (!on) continue;
    l.upd?.(l);
    const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
    l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}

// --- pointer: orbit, pan, pinch, and dragging parts of the scene -------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickTargets = [...pickables, ...focusHandles];
function pickAt(cx, cy) {
  const r = canvasEl.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickTargets, false)[0];
  return hit ? hit.object.userData.pick : null;
}
const consolePlane = new THREE.Plane(V3(0, 0, 1), -(CON.zf + 0.9));
function trackXAt(cx, cy) {
  const r = canvasEl.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = ray.ray.intersectPlane(consolePlane, _lp);
  return p ? p.x : null;
}
const pointers = new Map();
let drag = null, pinchD = 0;
function stopCinematicByUser() { if (state.cinematic) startCinematic(false); }
canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
canvasEl.addEventListener('pointerdown', (e) => {
  canvasEl.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  hideHint();
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); drag = { kind: 'pinch' }; stopCinematicByUser(); return; }
  const pick = e.button === 0 ? pickAt(e.clientX, e.clientY) : null;
  drag = { kind: 'orbit', x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pick, focus0: state.focusTarget, moved: 0 };
  if (e.button === 2 || e.shiftKey) drag.kind = 'pan';
  else if (pick === 'ring' || pick === 'dial') drag.kind = 'focusDrag';
  else if (pick === 'knob' || pick === 'track') { drag.kind = 'slider'; const x = trackXAt(e.clientX, e.clientY); if (x !== null) setFocus(stripXToFocus(x)); }
  else if (pick) drag.kind = 'click';
  if (drag.kind === 'orbit' || drag.kind === 'pan') stopCinematicByUser();
  canvasEl.classList.add('grabbing');
});
canvasEl.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (prev) { prev.x = e.clientX; prev.y = e.clientY; }
  if (!drag) { updateHoverCursor(e); return; }
  if (drag.kind === 'pinch') {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD > 0) dolly(pinchD / d);
    pinchD = d;
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.kind === 'orbit') orbit(-dx * 0.0055, -dy * 0.0045);
  else if (drag.kind === 'pan') pan(dx, dy);
  else if (drag.kind === 'focusDrag') setFocus(drag.focus0 * Math.exp((e.clientY - drag.sy) * 0.006 - (e.clientX - drag.sx) * 0.002));
  else if (drag.kind === 'slider') { const x = trackXAt(e.clientX, e.clientY); if (x !== null) setFocus(stripXToFocus(x)); }
  else if (drag.kind === 'click' && drag.moved > 6) { drag.kind = 'orbit'; stopCinematicByUser(); }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (drag && drag.kind === 'click' && drag.moved <= 6) clickPick(drag.pick);
  if (pointers.size === 0) { drag = null; canvasEl.classList.remove('grabbing'); }
  else if (drag && drag.kind === 'pinch') drag = null;
}
canvasEl.addEventListener('pointerup', endPointer);
canvasEl.addEventListener('pointercancel', endPointer);
canvasEl.addEventListener('wheel', (e) => { e.preventDefault(); stopCinematicByUser(); hideHint(); dolly(Math.exp(e.deltaY * 0.0011)); }, { passive: false });
function clickPick(pick) {
  if (!pick) return;
  const [kind, arg] = pick.split(':');
  if (kind === 'frame') setFocus(stripDist(+arg));
  else if (kind === 'arrow') {
    const cur = state.focusTarget, dir = +arg;
    const list = [...Array(STRIP.n).keys()].map(stripDist);
    const next = dir > 0 ? list.find((d) => d > cur + 0.5) : [...list].reverse().find((d) => d < cur - 0.5);
    if (next !== undefined) setFocus(next);
  } else if (kind === 'ap') setAperture(AP_PRESETS[+arg]);
}
let hoverT = 0;
function updateHoverCursor(e) {
  const now = performance.now();
  if (now - hoverT < 60) return;
  hoverT = now;
  const pick = pickAt(e.clientX, e.clientY);
  canvasEl.classList.toggle('ns', pick === 'ring' || pick === 'dial');
  canvasEl.classList.toggle('ew', pick === 'knob' || pick === 'track');
  canvasEl.classList.toggle('pointer', !!pick && !['ring', 'dial', 'knob', 'track'].includes(pick));
}
let hintHidden = false;
function hideHint() { if (!hintHidden) { hintHidden = true; $('hint').classList.add('gone'); } }

// --- keys ---------------------------------------------------------------------------------------
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.key !== 'Escape') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (!helpEl.hidden) showHelp(false); return; }
  if (!helpEl.hidden) return;
  if (k === '1' || k === '2' || k === '3') setFocus(FOCUS_PRESETS[+k - 1]);
  else if (k === '[') setFocus(state.focusTarget - (e.shiftKey ? 5 : 1));
  else if (k === ']') setFocus(state.focusTarget + (e.shiftKey ? 5 : 1));
  else if (k === 'f') { const i = AP_PRESETS.findIndex((p) => Math.abs(p - state.NTarget) < 0.05); setAperture(AP_PRESETS[(i + 1) % AP_PRESETS.length]); }
  else if (k === 'x') setExplode(state.explodeTarget ? 0 : 1);
  else if (k === 'c') startCinematic(!state.cinematic);
  else if (k === 'r') { startCinematic(false); const h = homePose(); setGoal(h.pos, h.tgt); }
  else if (k === '/') { e.preventDefault(); appEl.classList.toggle('ui-off'); }
  else if ('wasdqe'.includes(k) && k.length === 1) { keys.add(k); stopCinematicByUser(); hideHint(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
function applyKeys(dt) {
  if (!keys.size) return;
  const f = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), st = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  if (f || st) walk(f, st, dt);
  const t = (keys.has('q') ? 1 : 0) - (keys.has('e') ? 1 : 0);
  if (t) turn(t * 1.3 * dt);
}

// --- who else is looking (only where the page can reach a live room) --------------------------------
(async () => {
  try {
    const room = await window.claude?.use?.('room');
    if (!room) return;
    const live = $('live');
    const render = (peers) => {
      const n = peers.filter((p) => p.kind === 'viewer').length;
      if (n > 0) { $('liveN').textContent = String(n); live.hidden = false; }
    };
    room.onPeers((c) => render(c.peers), () => { live.hidden = true; });
  } catch { /* single-viewer page */ }
})();
