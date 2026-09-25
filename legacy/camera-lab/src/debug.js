
// debug hook (local builds only): hold the loop, step frames by hand, poke state
window.__lab = {
  state, expo, histo, QUALITY, SUBJECTS, EXPERIMENTS, PRESETS, bikeState,
  tick, applyPreset, setParam, setMode, setView, swapViews, setOverlay, startExperiment, shoot, calibrate, showTab, updateReadouts,
  nanDebug(on = true) { packP.u.uNanDebug.value = on ? 1 : 0; return on; },
  lightScale: () => lightScale, dof: () => dof, tau: () => tau,
  x(code) { return eval(code); },
  hold(on = true) { window.__labHold = on; return on; },
  run(n = 1, dt = 1 / 60) { window.__labHold = true; for (let i = 0; i < n; i++) tick(performance.now()); return 'ok'; },
};
