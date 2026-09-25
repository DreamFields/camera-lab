
// debug hook (local builds only): hold the loop, step frames by hand, poke state
window.__lab = {
  state, expo, histo, QUALITY, SUBJECTS, SUB, EXPERIMENTS, PRESETS, CONTROLS, PARAMS, MODULES, view, sim,
  tick, setParam, setModule, applyPreset, setView, openBigView, setOverlay, startExperiment, shoot, calibrate, showTab, updateReadouts, startCinematic,
  lightScale: () => lightScale, dof: () => dof,
  x(code) { return eval(code); },
  hold(on = true) { window.__labHold = on; return on; },
  run(n = 1, dt = 1 / 60) { window.__labHold = true; let t = performance.now(); for (let i = 0; i < n; i++) { t += dt * 1000; tick(t); } return 'ok'; },
  // a point on screen (CSS px) where the mouse would really grab this control:
  // sample its surface, keep points the normal picking lands on
  ctlScreen(name) {
    const c = CONTROLS.find((k) => k.name === name);
    if (!c) return null;
    const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), pts = [];
    for (const m of c.pick) {
      m.updateMatrixWorld();
      const g = m.geometry, pos = g.attributes.position, idx = g.index;
      const tris = (idx ? idx.count : pos.count) / 3, step = Math.max(1, Math.floor(tris / 300));
      for (let t = 0; t < tris; t += step) {
        const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        // triangle centroids sit inside the surface, not on its silhouette
        v.fromBufferAttribute(pos, i0).add(a.fromBufferAttribute(pos, i1)).add(b.fromBufferAttribute(pos, i2)).divideScalar(3);
        v.applyMatrix4(m.matrixWorld).project(worldCam);
        if (v.z < 1 && Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98) pts.push({ x: Math.round((v.x * 0.5 + 0.5) * innerWidth), y: Math.round((-v.y * 0.5 + 0.5) * innerHeight) });
      }
    }
    if (!pts.length) return { onScreen: false };
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    pts.sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
    for (const p of pts) {
      // the point and its neighbours must all land on the control, and nothing may cover it
      const ok = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dy]) => {
        if (document.elementFromPoint(p.x + dx, p.y + dy) !== canvasEl) return false;
        const hit = pickAt({ clientX: p.x + dx, clientY: p.y + dy });
        return hit && hit.c === c;
      });
      if (ok) return { x: p.x, y: p.y, onScreen: true };
    }
    return { onScreen: false, reason: 'covered' };
  },
  controls: () => CONTROLS.map((c) => c.name),
};
