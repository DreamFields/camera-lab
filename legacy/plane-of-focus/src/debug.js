
// debug hook (local builds only): step frames while the tab is hidden
window.__pof = {
  state, view, parts, startCinematic, setFocus, setAperture, setExplode, setGoal, homePose,
  run(n = 30, dt = 1 / 60) { let t = performance.now(); for (let i = 0; i < n; i++) { t += dt * 1000; tick(t); } return 'ok'; },
};
