
// ---------------------------------------------------------------------------
// Controls you turn with the mouse. Every ring, dial, knob, fader, lever and
// button on the bench is registered here against a parameter. Dragging works
// like grabbing the real thing: the point under the cursor is carried along
// its circle (or its slot), so a ring seen from the side turns when you drag
// up and down, a dial seen from above when you drag across. Values snap to
// the camera's click-stops. Every frame each control is posed from the state,
// so twins (a lens ring and its console knob) always agree, and a dial the
// camera is driving in A or S turns on its own.
// ---------------------------------------------------------------------------
const CONTROLS = [];
const PICK_OCCLUDERS = [];          // groups whose surfaces can hide a control
const ROT_KINDS = new Set(['ring', 'dial', 'knob', 'lever']);
const AXES = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) };
function addControl(c) {
  c.offset = c.offset || 0;
  c.pick = c.pick || [];
  for (const m of c.pick) m.userData.ctl = c;
  CONTROLS.push(c);
  return c;
}
const ctlEnabled = (c) => !c.module || state.modules[c.module];
// the lens rings follow the eased optics, so zooming and focusing glide
const EASED = { N: true, f: true, D: true };
function ctlP(c) {
  if (c.getP) return c.getP();
  const P = PARAMS[c.key];
  return clamp(P.p(EASED[c.key] ? state.cur[c.key] : P.get()), 0, 1);
}
function ctlSetP(c, p) {
  if (c.setP) return c.setP(clamp(p, 0, 1));
  return setParam(c.key, PARAMS[c.key].v(clamp(p, 0, 1)));
}

// --- hardware for the console (all of it faces +z) ------------------------------------------
const panelMat = std(0x10131a, { roughness: 0.5, metalness: 0.4 });
const knobMat = std(0x262a33, { metalness: 0.7, roughness: 0.38 });
const capMat = std(0xb7bec9, { metalness: 0.9, roughness: 0.3 });
const slotMat = std(0x06070a, { roughness: 0.8 });
const whiteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5) });
const caption = (text, h = 1.0, o = {}) => labelPlane(text, h, { font: FONT, weight: 700, color: '#aeb8cc', ...o });
function lamp(parent, x, y, z, r = 0.55) {
  const mat = std(0x1a1c20, { emissive: 0x000000, roughness: 0.3 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), mat);
  m.position.set(x, y, z); m.scale.z = 0.5;
  parent.add(m);
  return mat;
}
const LAMP_COL = { on: new THREE.Color(0x3ddc84).multiplyScalar(2.2), amber: new THREE.Color(0xffb454).multiplyScalar(2.4), off: new THREE.Color(0x000000) };
// a rotary knob: labels sit on the panel around it; its pointer starts at
// psi0 (p = 0) and sweeps clockwise through `span`
function makeKnob(parent, o) {
  const { x, y, z, r = 4.5, span = Math.PI * 1.5, psi0 = Math.PI * 1.25 } = o;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.2, r + 1.4, 0.4, 48).rotateX(Math.PI / 2), panelMat);
  plate.position.z = 0.2;
  g.add(plate);
  if (o.ticks) { const tk = arcTicks(o.ticks, { r: r + 0.55, psi0, span }); tk.position.z = 0.42; g.add(tk); }
  if (o.labels) { const l = arcLabels(o.labels, { r: r + (o.labelR || 2.7), psi0, span, h: o.labelH || 0.8 }); l.position.z = 0.4; g.add(l); }
  const rot = new THREE.Group();
  rot.position.z = 0.4;
  g.add(rot);
  const body = gear(0, 2.0, r - 0.25, Math.round(r * 16), 0.25, knobMat);
  body.geometry.rotateY(-Math.PI / 2);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.55, r - 0.35, 0.5, 48).rotateX(Math.PI / 2), capMat.clone());
  cap.position.z = 2.05;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r - 1.1, 32), knobMat);
  fill.position.z = 1.0;
  const ptr = new THREE.Mesh(new THREE.BoxGeometry(r * 0.62, 0.36, 0.1), whiteMat);
  ptr.position.set(Math.cos(psi0) * r * 0.46, Math.sin(psi0) * r * 0.46, 2.36);
  ptr.rotation.z = psi0;
  rot.add(body, fill, cap, ptr);
  if (o.caption) { const c = caption(o.caption, o.captionH || 1.0); c.position.set(0, -(r + (o.captionGap || 4.2)), 0.4); g.add(c); }
  const lampMat = o.lamp ? lamp(g, r + 1.9, r + 1.9, 0.5, 0.5) : null;
  shadows(g, true, true);
  return addControl({ ...o, kind: 'knob', rot, axis: 'z', span: -span, pick: [body, cap, fill], hl: [cap.material], lampMat, g });
}
// a straight fader; p = 0 at the bottom (vertical) or the left (horizontal)
function makeFader(parent, o) {
  const { x, y, z, len, vertical = true } = o;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const dir = vertical ? V3(0, 1, 0) : V3(1, 0, 0), side = vertical ? V3(1, 0, 0) : V3(0, -1, 0);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 0.9 : len + 2.4, vertical ? len + 2.4 : 0.9, 0.3), slotMat);
  slot.position.z = 0.15;
  g.add(slot);
  if (o.gradient) {
    const t = canvasTex(vertical ? 8 : 256, vertical ? 256 : 8, (c, w, h) => {
      const gr = vertical ? c.createLinearGradient(0, h, 0, 0) : c.createLinearGradient(0, 0, w, 0);
      o.gradient.forEach((col, i) => gr.addColorStop(i / (o.gradient.length - 1), col));
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 0.7 : len, vertical ? len : 0.7), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.2, 1.2, 1.2) }));
    strip.position.copy(side).multiplyScalar(-1.6).setZ(0.32);
    g.add(strip);
  }
  for (const [p, l] of o.ticks || []) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(vertical ? l : 0.14, vertical ? 0.14 : l, 0.05), whiteMat);
    t.position.copy(dir).multiplyScalar((p - 0.5) * len).addScaledVector(side, 1.2 + l / 2).setZ(0.32);
    g.add(t);
  }
  for (const e of o.labels || []) {
    const m = labelPlane(e.text, o.labelH || 0.8, { color: e.color });
    m.position.copy(dir).multiplyScalar((e.p - 0.5) * len).addScaledVector(side, 2.3 + m.userData.w / 2 * (vertical ? 1 : 0)).setZ(0.34);
    if (!vertical) m.position.y -= 0.6;
    g.add(m);
  }
  const rot = new THREE.Group();
  g.add(rot);
  const capM = std(0x2c313a, { metalness: 0.6, roughness: 0.4 });
  const cap = new THREE.Mesh(new RoundedBoxGeometry(vertical ? 3.8 : 2.4, vertical ? 2.4 : 3.8, 1.8, 2, 0.35), capM);
  cap.position.z = 1.0;
  const line = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 3.2 : 0.3, vertical ? 0.3 : 3.2, 0.05), whiteMat);
  line.position.z = 1.93;
  rot.add(cap, line);
  if (o.caption) { const c = caption(o.caption, o.captionH || 1.0); c.position.set(0, vertical ? -(len / 2 + 3.2) : -3.8, 0.4); g.add(c); }
  shadows(g, true, true);
  return addControl({ ...o, kind: 'fader', rot, dirLocal: dir, len, pick: [cap], hl: [capM], g });
}
// a bat lever with a few positions (p = 0 tilted left … p = 1 tilted right)
function makeLever(parent, o) {
  const { x, y, z, span = 1.1 } = o;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.8, 32).rotateX(Math.PI / 2), capMat);
  boss.position.z = 0.4;
  g.add(boss);
  const rot = new THREE.Group();
  rot.position.z = 0.8;
  g.add(rot);
  const batM = std(0xd0d6de, { metalness: 0.9, roughness: 0.25 });
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 4.2, 16).translate(0, 2.1, 0), batM);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), batM);
  tip.position.y = 4.3;
  rot.add(bat, tip);
  for (const e of o.labels || []) {
    const a = Math.PI / 2 + span / 2 - e.p * span;
    const m = labelPlane(e.text, o.labelH || 1.1, { weight: 700, color: e.color });
    m.position.set(Math.cos(a) * 6.3, Math.sin(a) * 6.3, 0.4);
    g.add(m);
  }
  if (o.caption) { const c = caption(o.caption); c.position.set(0, -3.4, 0.4); g.add(c); }
  shadows(g, true, true);
  return addControl({ ...o, kind: 'lever', rot, axis: 'z', span: -span, offset: span / 2, pick: [bat, tip, boss], hl: [batM], g });
}
// a push button; onClick does the work
function makeButton(parent, o) {
  const { x, y, z, r = 1.8, color = 0x3a4250 } = o;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.5, r + 0.6, 0.5, 40).rotateX(Math.PI / 2), capMat);
  ring.position.z = 0.25;
  g.add(ring);
  const rot = new THREE.Group();
  g.add(rot);
  const capM = std(color, { metalness: 0.3, roughness: 0.35, emissive: color, emissiveIntensity: 0.15 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.0, 40).rotateX(Math.PI / 2), capM);
  cap.position.z = 0.8;
  rot.add(cap);
  if (o.face) { const f = o.face; f.position.z = 1.32; rot.add(f); }
  if (o.caption) { const c = caption(o.caption, o.captionH || 0.9); c.position.set(0, -(r + 2.2), 0.4); g.add(c); }
  shadows(g, true, true);
  return addControl({ ...o, kind: 'button', rot, pick: [cap, ...(o.face ? [o.face] : [])], hl: [capM], g });
}
// a toggle switch with a lamp: click flips get() → set(!on)
function makeToggle(parent, o) {
  const { x, y, z } = o;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(3.4, 5.2, 0.5, 2, 0.3), panelMat);
  plate.position.z = 0.25;
  g.add(plate);
  const rot = new THREE.Group();
  rot.position.z = 0.55;
  g.add(rot);
  const batM = std(0xd0d6de, { metalness: 0.9, roughness: 0.25 });
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.6, 16).rotateX(Math.PI / 2).translate(0, 0, 1.3), batM);
  rot.add(bat);
  const lampMat = lamp(g, 0, 3.6, 0.5, 0.55);
  if (o.caption) { const c = caption(o.caption, o.captionH || 0.85); c.position.set(0, -4.2, 0.4); g.add(c); }
  shadows(g, true, true);
  return addControl({ ...o, kind: 'toggle', rot, pick: [bat, plate], hl: [batM], lampMat, g, onClick: () => o.set(!o.get()) });
}

// --- posing every control from the state -------------------------------------------------------
function syncControls(now) {
  for (const c of CONTROLS) {
    const on = ctlEnabled(c);
    if (c.g && c.g.visible !== on) c.g.visible = on;
    if (!on) continue;
    if (ROT_KINDS.has(c.kind)) c.rot.rotation[c.axis] = c.offset + ctlP(c) * c.span;
    else if (c.kind === 'fader') c.rot.position.copy(c.dirLocal).multiplyScalar((ctlP(c) - 0.5) * c.len);
    else if (c.kind === 'toggle') c.rot.rotation.x = c.get() ? -0.55 : 0.55;
    if (c.kind === 'button') {
      if (!c.base) c.base = c.rot.position.clone();
      const k = c.pressAt ? clamp(1 - (now - c.pressAt) / 180, 0, 1) : 0;
      c.rot.position.copy(c.base).addScaledVector(c.pressDir || AXES.z, -(c.pressDepth || 0.45) * Math.sin(k * Math.PI));
    }
    if (c.lampMat) {
      const s = c.lampState ? c.lampState() : c.kind === 'toggle' ? (c.get() ? 'on' : 'off') : c.key && isAuto(c.key) ? 'amber' : 'off';
      c.lampMat.emissive.copy(LAMP_COL[s] || LAMP_COL.off);
    }
    const hl = c === hover.c || (drag && drag.c === c) ? 0.35 : 0;
    if (c.hl && c.hlOn !== hl) { c.hlOn = hl; for (const m of c.hl) { if (!m.userData.e0) m.userData.e0 = { c: m.emissive.clone(), i: m.emissiveIntensity }; m.emissive.copy(hl ? CYAN : m.userData.e0.c); m.emissiveIntensity = hl || m.userData.e0.i; } }
  }
}

// ---------------------------------------------------------------------------
// Pointer: grab a control if one is under the cursor, otherwise orbit (left),
// pan (right / shift), pinch or wheel to zoom, double-click to fly to a spot.
// ---------------------------------------------------------------------------
const canvasEl = renderer.domElement;
const ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
function rayFrom(e) {
  const r = canvasEl.getBoundingClientRect();
  _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(_ndc, worldCam);
  return ray;
}
function visibleDeep(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
function ctlOf(o) { for (let p = o; p; p = p.parent) if (p.userData.ctl) return p.userData.ctl; return null; }
function pickAt(e) {
  rayFrom(e);
  const list = PICK_OCCLUDERS.filter((o) => o.visible);
  for (const c of CONTROLS) if (ctlEnabled(c)) for (const m of c.pick) list.push(m);
  const hits = ray.intersectObjects(list, true);
  for (const h of hits) {
    if (!visibleDeep(h.object)) continue;
    const c = ctlOf(h.object);
    return c && ctlEnabled(c) ? { c, point: h.point.clone() } : null;
  }
  return null;
}
function toScreen(v, out) {
  _v4.copy(v).project(worldCam);
  const r = canvasEl.getBoundingClientRect();
  out.x = (_v4.x * 0.5 + 0.5) * r.width; out.y = (-_v4.y * 0.5 + 0.5) * r.height;
  return out;
}
// screen-space pixels moved per unit of p when the grabbed point rides along.
// null when the motion is seen end-on (a ring viewed down its axis): then the
// caller falls back to "drag up to increase". Small or far controls keep their
// direction but never get more sensitive than a full sweep per MIN_TRAVEL px.
const MIN_TRAVEL = 160;
const _right3 = new THREE.Vector3();
function dragGain(c, point) {
  const s0 = toScreen(point, { x: 0, y: 0 });
  let s1, step, gx, gy;
  c.rot.updateMatrixWorld();
  if (ROT_KINDS.has(c.kind)) {
    const a = _v1.copy(AXES[c.axis]).transformDirection(c.rot.matrixWorld);
    const o = _v2.setFromMatrixPosition(c.rot.matrixWorld);
    const rad = _v3.copy(point).sub(o).projectOnPlane(a);
    if (rad.length() < 0.25) return null;
    const eps = 0.02;                                   // radians
    step = rad.length() * eps;
    const tan = a.cross(rad).multiplyScalar(eps);       // how the point moves for +eps
    s1 = toScreen(_v3.copy(point).add(tan), { x: 0, y: 0 });
    gx = ((s1.x - s0.x) / eps) * c.span; gy = ((s1.y - s0.y) / eps) * c.span;
  } else if (c.kind === 'fader') {
    step = 0.5;
    const d = _v1.copy(c.dirLocal).transformDirection(c.rot.parent.matrixWorld).multiplyScalar(step);
    s1 = toScreen(_v3.copy(point).add(d), { x: 0, y: 0 });
    gx = ((s1.x - s0.x) / step) * c.len; gy = ((s1.y - s0.y) / step) * c.len;
  } else return null;
  // the same step made across the screen, for comparison
  worldCam.matrixWorld.extractBasis(_right3, _v2, _v3);
  const s2 = toScreen(_v4.copy(point).addScaledVector(_right3, step), { x: 0, y: 0 });
  const faceOn = Math.hypot(s2.x - s0.x, s2.y - s0.y), seen = Math.hypot(s1.x - s0.x, s1.y - s0.y);
  if (seen < 0.22 * faceOn) return null;
  const m = Math.hypot(gx, gy);
  if (m < MIN_TRAVEL) { gx *= MIN_TRAVEL / m; gy *= MIN_TRAVEL / m; }
  return { x: gx, y: gy };
}
const tipEl = document.getElementById('tip');
const hover = { c: null, at: 0 };
function showTip(c, e) {
  if (!c) { tipEl.classList.remove('on'); return; }
  const P = PARAMS[c.key];
  const name = c.name || (P && P.name) || '';
  const val = c.tip ? c.tip() : P ? P.fmt(P.get()) : '';
  const how = c.how || (c.kind === 'button' || c.kind === 'toggle' ? '点按' : c.kind === 'fader' ? '拖动推拉' : '拖动转动');
  const auto = c.key && isAuto(c.key) ? `<i class="am">${c.key === 't' ? 'A 挡：相机在定' : c.key === 'N' ? 'S 挡：相机在定' : '自动'}</i>` : '';
  const html = `<b>${name}</b><span>${val}</span>${auto}<em>${how}</em>`;
  if (tipEl.dataset.html !== html) { tipEl.innerHTML = html; tipEl.dataset.html = html; }
  const x = Math.min(e.clientX + 16, innerWidth - tipEl.offsetWidth - 8), y = Math.min(e.clientY + 18, innerHeight - tipEl.offsetHeight - 8);
  tipEl.style.transform = `translate(${x}px, ${y}px)`;
  tipEl.classList.add('on');
}
const pointers = new Map();
let drag = null, pinchD = 0;
canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
canvasEl.addEventListener('pointerdown', (e) => {
  canvasEl.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  hideHint();
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); drag = { kind: 'pinch' }; stopCinematicByUser(); return; }
  const hit = e.button === 0 && !e.shiftKey ? pickAt(e) : null;
  drag = { kind: e.button === 2 || e.shiftKey ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0 };
  if (hit) {
    const c = hit.c;
    drag.c = c;
    if (c.kind === 'button' || c.kind === 'toggle') drag.kind = 'click';
    else {
      drag.kind = 'control';
      drag.p0 = drag.p = ctlP(c);
      drag.gain = dragGain(c, hit.point);
      // looking straight down a ring's axis or grabbing a knob at its centre:
      // fall back to "drag up to increase"
      if (!drag.gain) drag.gain = { x: 0, y: -260 };
      if (c.key) touch(c.key);
    }
  }
  if (drag.kind !== 'click') stopCinematicByUser();
  canvasEl.classList.add('grabbing');
});
canvasEl.addEventListener('pointermove', (e) => {
  const pt = pointers.get(e.pointerId);
  if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
  if (!drag) { hoverAt(e); return; }
  if (drag.kind === 'pinch') {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD > 0) dolly(pinchD / d);
    pinchD = d;
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.kind === 'orbit') orbit(-dx * 0.0055, -dy * 0.0045);
  else if (drag.kind === 'pan') pan(dx, dy);
  else if (drag.kind === 'control') {
    const g = drag.gain, g2 = g.x * g.x + g.y * g.y;
    drag.p = clamp(drag.p + (dx * g.x + dy * g.y) / g2, 0, 1);
    ctlSetP(drag.c, drag.p);
    showTip(drag.c, e);
  } else if (drag.kind === 'click' && drag.moved > 6) { drag.kind = 'orbit'; drag.c = null; stopCinematicByUser(); }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (drag && drag.kind === 'click' && drag.moved <= 6 && drag.c) {
    drag.c.pressAt = performance.now();
    if (drag.c.key) touch(drag.c.key); else touch();
    drag.c.onClick?.();
  }
  if (pointers.size === 0) { drag = null; canvasEl.classList.remove('grabbing'); }
  else if (drag && drag.kind === 'pinch') drag = null;
  if (e.type === 'pointerup') hoverAt(e, true);
}
canvasEl.addEventListener('pointerup', endPointer);
canvasEl.addEventListener('pointercancel', endPointer);
canvasEl.addEventListener('pointerleave', () => { if (!drag) { hover.c = null; showTip(null); } });
canvasEl.addEventListener('wheel', (e) => { e.preventDefault(); stopCinematicByUser(); hideHint(); dolly(Math.exp(e.deltaY * 0.0011)); }, { passive: false });
canvasEl.addEventListener('dblclick', (e) => {
  rayFrom(e);
  const hit = ray.intersectObjects(scene.children, true).find((h) => visibleDeep(h.object) && h.object.isMesh && !h.object.userData.noFly);
  if (!hit) return;
  let o = hit.object;
  while (o && o !== camBody) o = o.parent;
  stopCinematicByUser();
  flyTo(hit.point, !!o);
});
function hoverAt(e, force = false) {
  const now = performance.now();
  if (!force && now - hover.at < 50) { if (hover.c) showTip(hover.c, e); return; }
  hover.at = now;
  const hit = pickAt(e);
  hover.c = hit ? hit.c : null;
  canvasEl.classList.toggle('pointer', !!hover.c && (hover.c.kind === 'button' || hover.c.kind === 'toggle'));
  canvasEl.classList.toggle('turn', !!hover.c && hover.c.kind !== 'button' && hover.c.kind !== 'toggle');
  showTip(hover.c, e);
}
let hintHidden = false;
function hideHint() { if (!hintHidden) { hintHidden = true; document.getElementById('hint').classList.add('gone'); } }
