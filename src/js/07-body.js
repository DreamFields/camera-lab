
// ---------------------------------------------------------------------------
// The camera body: a 2.5x mirrorless shell sliding on the rail. Body-local x
// is measured from the sensor plane; the group only ever translates in x —
// every child is built at its real world y / z. Top dials are turned by the
// controls module (rotation.y = p*span); this file only builds them.
// ---------------------------------------------------------------------------
const camBody = new THREE.Group();
scene.add(camBody);

const bodyDials = {};
const bodyButtons = {};
const bodyLcd = new THREE.Mesh(new THREE.PlaneGeometry(18.75, 12.5), new THREE.MeshBasicMaterial({ color: 0x05070a }));
const bodySensor = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ color: 0x11151c }));
const bodyCutPlanes = [];

let triggerShutter, shutterBusy, bodyAnchor, updateBody;

{
  // ---- shared geometry / material constants ------------------------------
  const DIAL_Y = 26;                    // shell top plate, where every dial sits
  const PHI_MARK = -Math.PI / 2 - 0.3;  // index-mark / psi0 angle for every top dial
  const OW = 9.6, OH = 6.6;             // shutter opening
  const SHUT_X = 1.3;

  const shellMat = cuttable(std(0x15171b, { roughness: 0.55, metalness: 0.35 }), bodyCutPlanes);
  const grip = std(0x0d0e10, { roughness: 0.92 });
  const darkMetal = std(0x1b1d22, { roughness: 0.5, metalness: 0.6 });
  const dialTopMat = std(0x0e0f13, { roughness: 0.5, metalness: 0.4 });
  const goldMat = std(0xc9a24a, { metalness: 0.9, roughness: 0.35 });
  const pcbMat = std(0x18321f, { roughness: 0.7, metalness: 0.1 });
  const bladeMat = std(0x0a0b0d, { roughness: 0.6, metalness: 0.5 });

  // a flat glyph laid on the top plate, facing +y (readable from above)
  function topGlyph(text, x, z, h, o = {}) {
    const m = labelPlane(text, h, { color: '#eef2f8', ...o });
    m.rotateX(-Math.PI / 2);
    m.position.set(x, DIAL_Y + 0.1, z);
    camBody.add(m);
    return m;
  }

  // =========================================================================
  // shell, EVF hump, mount ring, model name
  // =========================================================================
  const shell = new THREE.Mesh(new RoundedBoxGeometry(19, 22.5, 32, 3, 1.3), shellMat);
  shell.position.set(-5, 14.75, 0.5);
  const hump = new THREE.Mesh(new RoundedBoxGeometry(16, 5, 13, 3, 1.0), shellMat);
  hump.position.set(-6.5, 28.5, 0);
  const eyecup = new THREE.Mesh(alongX(new THREE.CylinderGeometry(1.5, 1.3, 1.0, 20)), std(0x0b0c0f, { roughness: 0.95 }));
  eyecup.position.set(-15.3, 30, 0);
  camBody.add(shell, hump, eyecup);
  // panel lines
  for (const z of [-11, 11]) {
    const ln = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.12, 0.05), std(0x0a0b0d, { roughness: 0.6 }));
    ln.position.set(-5, 22.5, z);
    camBody.add(ln);
  }
  {
    const nameM = labelPlane('BENCH I', 1.1, { color: '#c7cedb', weight: 700 });
    nameM.rotation.y = Math.PI / 2;
    nameM.position.set(4.52, 21.5, -6.5);
    camBody.add(nameM);
  }
  const mount = tube(4.2, 4.7, 6.6, 5.4, chromeMat);
  mount.position.y = AXIS_Y;
  camBody.add(mount);

  // =========================================================================
  // grip
  // =========================================================================
  const gripMesh = new THREE.Mesh(new RoundedBoxGeometry(5.5, 20, 6.5, 3, 1.0), grip);
  gripMesh.position.set(7.25, 14.5, 16.25);
  camBody.add(gripMesh);

  // =========================================================================
  // top dials
  // =========================================================================
  function knurl(h, r, teeth, depth, mat) {
    const g = gear(0, h, r, teeth, depth, mat);
    g.geometry.rotateZ(Math.PI / 2);           // gear()'s extrude axis (x) -> y, so it spins about local y
    return g;
  }
  function topDial(key, x, z, r, entries, span, h = 1.8) {
    const rot = new THREE.Group();
    rot.position.set(x, DIAL_Y, z);
    camBody.add(rot);
    const rim = knurl(h, r, Math.round(r * 9), 0.22, darkMetal);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.15, r - 0.15, 0.3, 40), dialTopMat);
    cap.position.y = h;
    const sc = arcLabels(entries, { r: r - 0.35, psi0: PHI_MARK, span, radial: 'in', h: entries[0].h || 0.85 });
    sc.rotateX(-Math.PI / 2);
    sc.position.y = h + 0.15;
    rot.add(rim, cap, sc);
    shadows(rot);
    // fixed white index mark, just outside the rim, on the static top plate
    const ix = x + Math.cos(PHI_MARK) * (r + 0.35), iz = z - Math.sin(PHI_MARK) * (r + 0.35);
    topGlyph('▮', ix, iz, 0.55, { color: '#ffffff', gain: 2.0 });
    bodyDials[key] = { rot, pick: [rim, cap], r };
    return rot;
  }

  const T_ENT = FULL_T.map((v) => ({ p: stopIndex(v, T_STOPS) / 19, text: String(v) }));
  topDial('shutter', -4.5, 10.5, 3.4, T_ENT, 4.4);
  topGlyph('SHUTTER', -4.5 - 3.4 - 1.4, 10.5, 0.6);

  const ISO_ENT = FULL_ISO.map((v) => ({ p: stopIndex(v, ISO_STOPS) / 24, text: String(v), h: v >= 10000 ? 0.68 : 0.85 }));
  topDial('iso', -4.5, -10.5, 3.4, ISO_ENT, 4.4);
  topGlyph('ISO', -4.5 - 3.4 - 1.4, -10.5, 0.6);

  const WB_ENT = [3000, 4000, 5000, 6000, 7000, 8000].map((k) => ({ p: (k - 2800) / 5200, text: Math.round(k / 1000) + 'k', color: '#' + kelvinColor(k).getHexString() }));
  topDial('wb', -10.5, -13.8, 2.6, WB_ENT, 3.6);
  topGlyph('WB', -10.5 - 2.6 - 1.3, -13.8, 0.6);

  const COMP_ENT = [-3, -2, -1, 0, 1, 2, 3].map((c) => ({ p: (c + 3) / 6, text: c === 0 ? '0' : (c > 0 ? '+' : '−') + Math.abs(c), color: c === 0 ? '#ffffff' : '#9aa3b4' }));
  topDial('comp', -10.5, 14.8, 2.6, COMP_ENT, 3.2);
  topGlyph('±EV', -10.5 - 2.6 - 1.3, 14.8, 0.6);

  const MODE_ENT = [{ p: 0, text: 'M' }, { p: 0.5, text: 'A' }, { p: 1, text: 'S' }].map((e) => ({ ...e, h: 1.05 }));
  topDial('mode', -10.5, 9.0, 2.2, MODE_ENT, 1.6);
  topGlyph('MODE', -10.5 - 2.2 - 1.3, 9.0, 0.6);

  // =========================================================================
  // shutter release button
  // =========================================================================
  {
    const g = new THREE.Group();
    g.position.set(6.5, 24.9, 16.2);
    camBody.add(g);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.35, 32), chromeMat);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.5, 32), std(0xb0342a, { roughness: 0.4, metalness: 0.2 }));
    cap.position.y = 0.15;
    g.add(ring, cap);
    shadows(g);
    bodyButtons.shutter = { g, pick: [cap, ring] };
  }

  // =========================================================================
  // rear LCD + sensor (+ sensor package) + focal-plane shutter
  // =========================================================================
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(19.9, 13.6), std(0x08090b, { roughness: 0.3 }));
  bezel.rotation.y = -Math.PI / 2;
  bezel.position.set(-14.68, 14.5, -2);
  camBody.add(bezel);
  bodyLcd.rotation.y = -Math.PI / 2;
  bodyLcd.position.set(-14.6, 14.5, -2);
  camBody.add(bodyLcd);

  bodySensor.rotation.y = Math.PI / 2;
  bodySensor.position.set(0.02, AXIS_Y, 0);
  const sensorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.2, 10.2), goldMat);
  sensorFrame.position.set(-0.3, AXIS_Y, 0);
  const sensorPcb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.4, 11.4), pcbMat);
  sensorPcb.position.set(-0.85, AXIS_Y, 0);
  camBody.add(bodySensor, sensorFrame, sensorPcb);
  shadows(sensorFrame); shadows(sensorPcb);

  // -- focal-plane shutter: a frame and two 4-blade curtains --------------
  const shutterGroup = new THREE.Group();
  camBody.add(shutterGroup);
  {
    const bar = (w, h, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), darkMetal); m.position.set(x, y, z); shutterGroup.add(m); };
    bar(OW + 1.0, 0.5, SHUT_X, AXIS_Y + OH / 2 + 0.25, 0);
    bar(OW + 1.0, 0.5, SHUT_X, AXIS_Y - OH / 2 - 0.25, 0);
    bar(0.5, OH + 1.0, SHUT_X, AXIS_Y, OW / 2 + 0.25);
    bar(0.5, OH + 1.0, SHUT_X, AXIS_Y, -OW / 2 - 0.25);
  }
  const bladeH = OH / 4;
  const c1Blades = [], c2Blades = [];
  const HOME1 = [], TILE1 = [], HOME2 = [], TILE2 = [];
  for (let k = 0; k < 4; k++) {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, bladeH * 1.02, OW), bladeMat);
    b1.position.set(SHUT_X - 0.12, 0, 0);
    shutterGroup.add(b1); c1Blades.push(b1);
    HOME1.push(AXIS_Y - OH / 2 - 0.2 - 0.09 * k);
    TILE1.push(AXIS_Y - OH / 2 + (k + 0.5) * bladeH);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, bladeH * 1.02, OW), bladeMat);
    b2.position.set(SHUT_X + 0.12, 0, 0);
    shutterGroup.add(b2); c2Blades.push(b2);
    HOME2.push(AXIS_Y + OH / 2 + 0.2 + 0.09 * k);
    TILE2.push(AXIS_Y + OH / 2 - (k + 0.5) * bladeH);
  }
  shadows(shutterGroup, false, true);
  function poseShutter(c1, c2) {
    for (let k = 0; k < 4; k++) {
      c1Blades[k].position.y = lerp(HOME1[k], TILE1[k], smooth(clamp(c1 * 4 - k, 0, 1)));
      c2Blades[k].position.y = lerp(HOME2[k], TILE2[k], smooth(clamp(c2 * 4 - k, 0, 1)));
    }
  }
  poseShutter(0, 0);

  const SP = [0.12, 0.18, 0.18, 0.10, 0.25];
  const ST = [SP[0], SP[0] + SP[1], SP[0] + SP[1] + SP[2], SP[0] + SP[1] + SP[2] + SP[3], SP[0] + SP[1] + SP[2] + SP[3] + SP[4]];
  const SHUTTER_TOTAL = ST[4];
  function shutterTimeline(e) {
    if (e < ST[0]) return [e / SP[0], 0];
    if (e < ST[1]) return [1 - (e - ST[0]) / SP[1], 0];
    if (e < ST[2]) return [0, (e - ST[1]) / SP[2]];
    if (e < ST[3]) return [0, 1];
    if (e < ST[4]) return [0, 1 - (e - ST[3]) / SP[4]];
    return [0, 0];
  }
  let shutterT = Infinity;
  triggerShutter = function () { shutterT = 0; };
  shutterBusy = function () { return shutterT < SHUTTER_TOTAL; };

  // =========================================================================
  // rail carriage
  // =========================================================================
  const carriage = new THREE.Mesh(new RoundedBoxGeometry(15, 3.5, 8.4, 2, 0.4), alu);
  carriage.position.set(-4.5, 1.75, 0);
  const clampKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.1, 16).rotateX(Math.PI / 2), darkSteel);
  clampKnob.position.set(-4.5, 1.75, 4.75);
  camBody.add(carriage, clampKnob);
  shadows(carriage); shadows(clampKnob);

  shadows(camBody, true, true);
  bodySensor.castShadow = bodyLcd.castShadow = false;

  // =========================================================================
  // updateBody / bodyAnchor
  // =========================================================================
  const bcY1 = new THREE.Plane(new THREE.Vector3(0, -1, 0), 5);      // clips y > 5
  const bcY2 = new THREE.Plane(new THREE.Vector3(0, 1, 0), -23);     // clips y < 23
  const bcX1 = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);      // clips x > world(sensor - 9)
  const bcX2 = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);       // clips x < world(mount)
  bodyCutPlanes.push(cutPlane, bcY1, bcY2, bcX1, bcX2);

  updateBody = function (dt) {
    camBody.position.x = sensorX(state.cur.f) - 5 * smooth(state.explode);
    bcX1.constant = camBody.position.x + (0.02 - 9);
    bcX2.constant = -(camBody.position.x + 4.5);

    if (shutterT < SHUTTER_TOTAL) {
      shutterT = Math.min(shutterT + dt, SHUTTER_TOTAL);
      const [c1, c2] = shutterTimeline(shutterT);
      poseShutter(c1, c2);
    }
  };

  bodyAnchor = function (name) {
    const bx = camBody.position.x;
    const p = {
      sensor: [bx + 0.02, AXIS_Y, 0], shutter: [bx + SHUT_X, AXIS_Y, 0],
      lcd: [bx - 14.6, 14.5, -2], mount: [bx + 4.5, AXIS_Y, 0],
      shutterDial: [bx - 4.5, DIAL_Y, 10.5], isoDial: [bx - 4.5, DIAL_Y, -10.5],
      wbDial: [bx - 10.5, DIAL_Y, -13.8], compDial: [bx - 10.5, DIAL_Y, 14.8],
      modeDial: [bx - 10.5, DIAL_Y, 9.0], shutterBtn: [bx + 6.5, 24.9, 16.2],
      top: [bx - 5, 26, 0],
    }[name] || [bx, AXIS_Y, 0];
    return new THREE.Vector3(p[0], p[1], p[2]);
  };

  updateBody(0);
}
