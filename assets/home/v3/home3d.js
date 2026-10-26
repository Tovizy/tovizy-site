/* Tovizy home: the live 3D model in the hero. Tovizy, October 2026.
   The floor plan draws itself, the house is built by a rising scan plane, then the camera
   flies to every rendered view. At each view the camera matches the render camera exactly,
   so the photograph lands on the model through a lattice of 7/12 roof-pitch triangles. */
(() => {
  'use strict';
  const D = document;
  const sec = D.querySelector('.hero3d');
  if (!sec) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM || typeof THREE === 'undefined' || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') { sec.classList.add('h3d-static'); return; }
  const A = '/assets/home/';
  const q = (s, r = D) => r.querySelector(s);
  const qa = (s, r = D) => [...r.querySelectorAll(s)];
  const cv = q('canvas.h3d-cv', sec);

  let R;
  try {
    R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { sec.classList.add('h3d-static'); return; }
  sec.classList.add('h3d-gl');
  THREE.ColorManagement.legacyMode = false;
  const SMALL = Math.min(innerWidth, innerHeight) < 700;
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, SMALL ? 2 : 1.75));
  R.outputEncoding = THREE.sRGBEncoding;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.08;
  R.shadowMap.enabled = true;
  R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.localClippingEnabled = true;
  R.autoClear = false;

  /* ---------------- world ---------------- */
  const FT = 0.3048;
  const BG = new THREE.Color('#13201B');
  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 70, 190);
  const C = new THREE.Vector3(10.9, 0, -4.0);           // middle of the lot, three.js axes (x, up, -y)
  const P2 = (xf, yf, h = 0) => new THREE.Vector3(xf * FT, h, -yf * FT);  // plan feet -> world

  scene.add(new THREE.HemisphereLight(0xe9eef0, 0x6a6052, 0.62));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.35);
  sun.position.set(C.x - 26, 30, C.z + 24);
  sun.target.position.copy(C);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SMALL ? 1024 : 2048, SMALL ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 110 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xbcd0e0, 0.35); fill.position.set(C.x + 30, 18, C.z - 20); scene.add(fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ color: '#1B2B24', roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(C.x, -0.002, C.z); ground.receiveShadow = true;
  scene.add(ground);
  const grid = (size, div, op) => {
    const g = new THREE.GridHelper(size, div, 0xeae5d8, 0xeae5d8);
    g.material.transparent = true; g.material.opacity = op; g.material.depthWrite = false; g.material.fog = true;
    g.position.set(C.x, 0.003, C.z); scene.add(g); return g;
  };
  const gridMinor = grid(120, 120, 0.05), gridMajor = grid(120, 24, 0.11);

  /* scan plane: everything below it is built; lines run a little ahead of the solids */
  const solidPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -0.2);
  const linePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -0.2);
  const solidMats = [], lineMats = [];
  const solid = (color, o = {}) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.82, metalness: 0, clippingPlanes: [solidPlane], clipShadows: true, side: THREE.DoubleSide }, o));
    solidMats.push(m); return m;
  };
  const lineMat = () => {
    const m = new THREE.LineBasicMaterial({ color: 0xeae5d8, transparent: true, opacity: 0.9, clippingPlanes: [linePlane], depthWrite: false });
    lineMats.push(m); return m;
  };
  const addEdges = (geo, angle = 28) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle), lineMat()); scene.add(l); return l; };

  const COL = {
    siding_bb: '#EBE7DE', batten: '#E4E0D6', trim_white: '#F1EEE7', stone_skirt: '#8D8578', cedar: '#9C6A40', metal_roof: '#3A332C',
    shingle: '#2F3236', glass: '#1C2733', window_frame: '#1B1B1B', garage_door: '#232323', front_door: '#7A4A2A', concrete: '#B9B4AA',
    flagstone: '#8E877C', soffit: '#C9A77E', lantern: '#151515', mulch: '#3A2A20', door_panel: '#6B3F23', bronze: '#5B4632', gd_groove: '#141414',
  };
  const site = [];

  /* interior: floor, walls, kitchen and fireplace, from the floor plan (feet) */
  const W = 15.24, DD = 10.36, FL = 0.75;
  const boxAt = (x0, x1, y0, y1, z0, z1, mat, edges = true) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0) * FT, z1 - z0, Math.abs(y1 - y0) * FT);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2 * FT, (z0 + z1) / 2, -(y0 + y1) / 2 * FT);
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
    if (edges) { const l = addEdges(g, 20); l.position.copy(m.position); }
    return m;
  };
  const floorMat = solid('#D8C7A8', { roughness: 0.7 });
  boxAt(0, 50, 0, 34, FL - 0.08, FL - 0.01, floorMat, false);
  boxAt(50, 72.3, 6, 34, 0.0, 0.08, solid('#AFA99F'), false);
  const iwMat = solid('#EFECE5');
  const IW = [[14, 0, 14, 34], [0, 12, 14, 12], [0, 19, 14, 19], [8, 12, 8, 19], [0, 23.3, 5.5, 23.3], [5.5, 19, 5.5, 23.3],
    [36, 0, 36, 34], [36, 13, 50, 13], [36, 21, 50, 21], [44, 13, 44, 21]];
  const DOORS = [[10.5, 12, 'h', 2.6], [10.5, 19, 'h', 2.6], [14, 14.2, 'v', 2.6], [36, 8, 'v', 2.6], [39, 13, 'h', 2.6], [46.5, 21, 'h', 2.6], [5.7, 19, 'h', 2.2], [1.6, 23.3, 'h', 2.2]];
  const OPEN = [[14, 'v', 19.5, 31], [36, 'v', 23, 31]];   // wide openings from the great room to dining and kitchen
  const cut = (a0, a1, holes) => {
    let segs = [[a0, a1]];
    holes.forEach(([h0, h1]) => { segs = segs.flatMap(([s0, s1]) => (h1 <= s0 || h0 >= s1) ? [[s0, s1]] : [[s0, h0], [h1, s1]].filter(([u, v]) => v - u > 0.3)); });
    return segs;
  };
  const T_IW = 0.4;   // 4.8 in walls
  IW.forEach(([x0, y0, x1, y1]) => {
    const vert = x0 === x1;
    const holes = DOORS.filter((d) => (vert ? d[2] === 'v' && d[0] === x0 : d[2] === 'h' && d[1] === y0)).map((d) => (vert ? [d[1], d[1] + d[3]] : [d[0], d[0] + d[3]]))
      .concat(OPEN.filter((o) => vert && o[0] === x0).map((o) => [o[2], o[3]]));
    cut(vert ? Math.min(y0, y1) : Math.min(x0, x1), vert ? Math.max(y0, y1) : Math.max(x0, x1), holes).forEach(([a, b]) => {
      if (vert) boxAt(x0 - T_IW / 2, x0 + T_IW / 2, a, b, FL, FL + 2.74, iwMat); else boxAt(a, b, y0 - T_IW / 2, y0 + T_IW / 2, FL, FL + 2.74, iwMat);
    });
  });
  boxAt(25.5, 33.5, 22, 25.5, FL, FL + 0.92, solid('#5E6F63'));                       // island
  boxAt(29, 34, 32, 34, FL, FL + 0.92, solid('#5E6F63')); boxAt(34, 36, 22.5, 34, FL, FL + 0.92, solid('#5E6F63'));
  boxAt(14.2, 16, 5, 10, FL, FL + 1.55, solid('#8D8578', { roughness: 0.95 }));         // fireplace

  /* the model itself */
  let ready = null;
  const load = () => ready || (ready = (async () => {
    const [meta, buf] = await Promise.all([fetch(`${A}model.json`).then((r) => r.json()), fetch(`${A}model.bin`).then((r) => r.arrayBuffer())]);
    const pos = new Float32Array(buf);
    meta.groups.forEach((g) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(g.start * 3, (g.start + g.count) * 3), 3));
      geo.computeVertexNormals();
      const isSite = g.stage === 'site';
      const o = {};
      if (g.mat === 'glass') Object.assign(o, { roughness: 0.12, metalness: 0.3 });
      if (g.mat === 'metal_roof') Object.assign(o, { roughness: 0.42, metalness: 0.35 });
      if (g.mat === 'lantern') Object.assign(o, { emissive: new THREE.Color('#FFC27A'), emissiveIntensity: 0.5 });
      const m = isSite ? new THREE.MeshStandardMaterial(Object.assign({ color: COL[g.mat] || '#CCCCCC', roughness: 0.9, transparent: true, opacity: 0 }, o))
        : solid(COL[g.mat] || '#CCCCCC', o);
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = !isSite; mesh.receiveShadow = true;
      scene.add(mesh);
      if (isSite) site.push(m); else addEdges(geo, 28);
    });
    return meta;
  })());

  /* ---------------- the floor plan, drawn on the ground ---------------- */
  const planMat = new THREE.MeshBasicMaterial({ color: 0xeae5d8, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const brassMat = new THREE.MeshBasicMaterial({ color: 0xb89a63, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const strips = [];
  const strip = (x0, y0, x1, y1, t, mat = planMat, h = 0.012) => {
    const a = P2(x0, y0, h), b = P2(x1, y1, h);
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(1, 0.004, t); g.translate(0.5, 0, 0);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(a); m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    m.scale.set(0.0001, 1, 1); m.userData.len = len + t * 0.5;
    m.renderOrder = 2; scene.add(m); strips.push(m); return m;
  };
  const EXT = [[0, 0, 50, 0], [50, 0, 50, 34], [50, 34, 0, 34], [0, 34, 0, 0], [50, 6, 72.3, 6], [72.3, 6, 72.3, 34], [72.3, 34, 50, 34]];
  const extStrips = EXT.map(([a, b, c, d]) => strip(a, b, c, d, 0.2));
  const intStrips = IW.map(([a, b, c, d]) => strip(a, b, c, d, 0.1));
  const PORCH = [[0, -8, 50, -8], [0, 0, 0, -8], [50, 0, 50, -8], [14.4, 34, 14.4, 44], [14.4, 44, 37.4, 44], [37.4, 44, 37.4, 34]];
  const porchStrips = PORCH.map(([a, b, c, d]) => strip(a, b, c, d, 0.05));
  const dimStrips = [strip(0, -11, 50, -11, 0.035, brassMat), strip(-3.4, 0, -3.4, 34, 0.035, brassMat)];
  const posts = [0.8, 13.3, 21.5, 28.5, 36.7, 49.2].map((x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.28), planMat);
    m.position.copy(P2(x, -8 + 0.5, 0.014)); m.scale.setScalar(0.0001); m.renderOrder = 2; scene.add(m); return m;
  });
  const planAll = [...strips, ...posts];

  /* scan frame (brass) */
  const fr = new THREE.Group();
  const frPts = [[-0.9, 3.3], [23.0, 3.3], [23.0, -14.3], [-0.9, -14.3]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const frLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(frPts), new THREE.LineBasicMaterial({ color: 0xd2b57c, transparent: true, opacity: 0 }));
  const frPlane = new THREE.Mesh(new THREE.PlaneGeometry(23.9, 17.6), new THREE.MeshBasicMaterial({ color: 0xb89a63, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  frPlane.rotation.x = -Math.PI / 2; frPlane.position.set(11.05, 0, -5.5);
  fr.add(frLine, frPlane); scene.add(fr);

  /* labels over the model */
  const labelBox = q('.h3d-labels', sec);
  const LABELS = [['Great room', 25, 12], ['Kitchen', 30, 27.5], ['Primary', 7, 27], ['Bedroom 2', 7, 6], ['Bedroom 3', 43, 6.5], ['Garage', 61.2, 20], ['Porch', 25, -4.2], ['50′', 25, -13.5, 1], ['34′', -5.2, 17, 1]]
    .map(([t, x, y, dim]) => { const el = D.createElement('span'); el.textContent = t; if (dim) el.className = 'dim'; labelBox.appendChild(el); return { el, p: P2(x, y, FL + 0.05) }; });

  /* ---------------- views ---------------- */
  const VIEWS = qa('.h3d-views button', sec).map((b) => ({ key: b.dataset.k, name: b.dataset.name, o: (b.dataset.o || '0.5,0.5').split(',').map(Number) }));
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 600);
  const vp = { w: 1, h: 1 };
  const projFor = (cam, fitOverride) => {
    // render projection from Blender, re-cut so the photograph and the model cover the screen the same way
    const [iw, ih] = cam.res; const rc = vp.w / vp.h, ri = iw / ih;
    const portraitImg = ih > iw;
    const fit = fitOverride ?? (rc < 0.9 ? (portraitImg ? 0.15 : 0.62) : (portraitImg ? 0.82 : 0));
    const kc = rc > ri ? [1, ri / rc] : [rc / ri, 1], kn = rc > ri ? [rc / ri, 1] : [1, ri / rc];
    const k = [kc[0] + (kn[0] - kc[0]) * fit, kc[1] + (kn[1] - kc[1]) * fit];
    const f = [0.5, 0.5];
    const P = new THREE.Matrix4().set(...cam.proj);
    const e = P.elements;   // column-major: e[col*4+row]
    const ox = (1 - k[0]) * (2 * f[0] - 1), oy = (1 - k[1]) * (1 - 2 * f[1]);
    for (let c = 0; c < 4; c++) {
      const r3 = e[c * 4 + 3];
      e[c * 4 + 0] = (e[c * 4 + 0] - ox * r3) / k[0];
      e[c * 4 + 1] = (e[c * 4 + 1] - oy * r3) / k[1];
    }
    return { P, k, f };
  };
  const quatLook = (pos, dir, up) => {
    const m = new THREE.Matrix4().lookAt(pos, pos.clone().add(dir), up);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  };
  let POSES = null;   // filled when the model loads
  function makePoses(meta) {
    const top = (() => {
      const half = Math.tan(THREE.MathUtils.degToRad(16));
      const asp = vp.w / vp.h, wide = asp > 1.15;
      const needH = Math.max(wide ? 24 : 21, (wide ? 40 : 27) / asp);
      const h = needH / 2 / half;
      // on wide screens the plan sits right of centre, clear of the heading
      const pos = new THREE.Vector3(C.x + 0.4 - (wide ? needH * asp * 0.14 : 0), h, -5.4 + needH * (wide ? 0.1 : 0.16));
      camera.aspect = vp.w / vp.h; camera.fov = 32; camera.updateProjectionMatrix();
      return { pos, q: quatLook(pos, new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)), P: camera.projectionMatrix.clone() };
    })();
    const st = VIEWS.map((v) => {
      const cm = meta.cams[v.key.toUpperCase()];
      const pos = new THREE.Vector3(...cm.pos), dir = new THREE.Vector3(...cm.fwd).normalize();
      const pr = projFor(cm);
      return { key: v.key, pos, q: quatLook(pos, dir, new THREE.Vector3(0, 1, 0)), P: pr.P, k: pr.k, f: pr.f, res: cm.res, o: v.o };
    });
    // a high three-quarter view used while the house is built
    const aer = (() => {
      const fz = vp.w / vp.h < 0.9 ? 1.75 : 1;
      const pos = new THREE.Vector3(C.x - 22 * fz, 21 * fz, C.z + 23 * fz);
      const dir = C.clone().add(new THREE.Vector3(0, 2.2, 0)).sub(pos).normalize();
      camera.fov = 30; camera.updateProjectionMatrix();
      return { pos, q: quatLook(pos, dir, new THREE.Vector3(0, 1, 0)), P: camera.projectionMatrix.clone() };
    })();
    return { top, aer, st };
  }

  /* cylinder path around the house, so the camera never flies through it */
  const cyl = (p) => { const dx = p.x - C.x, dz = p.z - C.z; return { a: Math.atan2(dz, dx), r: Math.hypot(dx, dz), y: p.y }; };
  const lerpPos = (A0, B0, t) => {
    const a = cyl(A0), b = cyl(B0);
    let da = b.a - a.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const ang = a.a + da * t, r = a.r + (b.r - a.r) * t;
    const low = Math.max(A0.y, B0.y) < 3 && Math.min(a.r, b.r) < 16;
    const lift = low ? 0 : Math.sin(Math.PI * t) * Math.min(6, Math.abs(da) * 4);   // rise a little on long arcs
    return new THREE.Vector3(C.x + Math.cos(ang) * r, a.y + (b.y - a.y) * t + lift, C.z + Math.sin(ang) * r);
  };
  const lerpP = (P, Q, t) => { const m = new THREE.Matrix4(); for (let i = 0; i < 16; i++) m.elements[i] = P.elements[i] + (Q.elements[i] - P.elements[i]) * t; return m; };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const seg = (T, a, b) => clamp01((T - a) / (b - a));

  /* ---------------- photograph overlay ---------------- */
  const ovScene = new THREE.Scene(), ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const ovMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTex: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uK: { value: new THREE.Vector2(1, 1) }, uF: { value: new THREE.Vector2(0.5, 0.5) },
      uP: { value: 0 }, uO: { value: new THREE.Vector2(0.5, 0.5) }, uCell: { value: 60 }, uFrame: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;uniform vec2 uRes,uK,uF,uO;uniform float uP,uCell,uFrame;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 uv=vec2(vUv.x,1.-vUv.y);
  vec2 px=uv*uRes;
  float ch=uCell,cw=ch*12./7.;
  vec2 g=px/vec2(cw,ch);
  vec2 id=floor(g),f=fract(g);
  float m=mod(id.x+id.y,2.);
  float fx=m>.5?1.-f.x:f.x;
  float up=step(1.,fx+f.y);
  float mn=up>.5?min(min(fx+f.y-1.,1.-f.y),1.-fx):min(min(1.-fx-f.y,fx),f.y);
  vec2 cn=up>.5?vec2(2./3.):vec2(1./3.);
  if(m>.5)cn.x=1.-cn.x;
  vec2 cp=(id+cn)*vec2(cw,ch);
  vec2 o=uO*uRes;
  float md=length(max(o,uRes-o));
  float d=length(cp-o)/md;
  float sp=.7;
  float k=clamp((uP*(1.+sp)-d*sp-h(id+up*3.7)*.1)/.42,0.,1.);
  k=k*k*(3.-2.*k);
  float th=1.-3.*mn;
  float e=4./ch;
  float kk=k*(1.+2.*e)-e;
  float rv=smoothstep(th-e,th+e,kk);
  float eg=(1.-smoothstep(0.,e*1.5,abs(kk-th)))*step(.003,k)*(1.-step(.997,k));
  vec2 iu=uv*uK+(1.-uK)*uF;
  float ins=step(0.,iu.x)*step(0.,iu.y)*step(iu.x,1.)*step(iu.y,1.);
  vec3 c=texture2D(uTex,vec2(iu.x,1.-iu.y)).rgb;
  vec3 br=vec3(.722,.604,.388);
  c=mix(c,br,eg*.9*sin(3.14159*clamp(uP,0.,1.)));
  float a=max(rv,eg*.9)*ins;
  float dpx=min(min(iu.x,1.-iu.x)*uRes.x/uK.x,min(iu.y,1.-iu.y)*uRes.y/uK.y);
  float frm=uFrame*ins*(1.-smoothstep(1.,2.6,dpx));
  gl_FragColor=vec4(mix(c,br,frm),max(a,frm*.9));
}`,
  });
  ovScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ovMat));
  const TEX = new Map();
  const texLoader = new THREE.TextureLoader();
  const pickW = () => { const w = Math.max(innerWidth, innerHeight * 1.5) * Math.min(window.devicePixelRatio || 1, 2); return w > 1700 ? 2400 : 1600; };
  const HI6 = new Set(["c1", "c3", "c6", "c7"]); /*HI6*/
  const tex = (key) => {
    if (!TEX.has(key)) {
      TEX.set(key, new Promise((res) => texLoader.load(`${A}${key}-${HI6.has(key) && Math.max(innerWidth, innerHeight * 1.5) * Math.min(window.devicePixelRatio || 1, 2) > 2600 ? 3200 : pickW()}.webp${HI6.has(key) ? '?v=6k' : ''}`, (t) => {
        t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; res(t); dirty = true;
      }, undefined, () => res(null))));
    }
    return TEX.get(key);
  };
  const texNow = new Map();

  /* ---------------- story: the house builds itself, then scrolling walks around it ---------------- */
  const T_PLAN = 0.9, T_ARRIVE = 3.25;
  const n = VIEWS.length;
  const capEl = q('.h3d-cap', sec), listBtns = qa('.h3d-views button', sec);
  const progEls = listBtns.map((b) => q('i', b));
  let curCap = -2;
  const S = { T: 0, a: 0, b: 0, tf: 0, pv: 0, built: false };
  let dirty = true, poses = null, meta = null, lastW = 0, lastH = 0;
  const frameEl = q('.h3d-frame', sec);
  function size() {
    const w = Math.max(2, Math.round(frameEl.offsetWidth || innerWidth)), h = Math.max(2, Math.round(frameEl.offsetHeight || innerHeight));
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h; vp.w = w; vp.h = h;
    R.setSize(w, h, false);
    ovMat.uniforms.uRes.value.set(w * R.getPixelRatio(), h * R.getPixelRatio());
    ovMat.uniforms.uCell.value = Math.max(22, Math.round(h * R.getPixelRatio() / 9.5));
    if (meta) poses = makePoses(meta);
    dirty = true;
  }
  const idx = (key) => VIEWS.findIndex((v) => v.key === key);

  function apply() {
    if (!poses) return;
    const st = poses.st, T = S.T;
    /* plan */
    const tp = seg(T, 0.05, T_PLAN);
    const draw = (arr, a, b) => arr.forEach((m, i) => { const s = clamp01((tp - a - (i / arr.length) * (b - a) * 0.6) / ((b - a) * 0.4)); m.scale.x = Math.max(0.0001, ease(s) * m.userData.len); });
    draw(extStrips, 0, 0.55); draw(intStrips, 0.25, 0.85); draw(porchStrips, 0.15, 0.7); draw(dimStrips, 0.5, 1.0);
    posts.forEach((m, i) => { const s = clamp01((tp - 0.4 - i * 0.04) / 0.2); m.scale.setScalar(Math.max(0.0001, ease(s))); });
    const planFade = 1 - seg(T, 1.35, 2.2);
    planMat.opacity = planFade; brassMat.opacity = planFade;
    planAll.forEach((m) => { m.visible = planFade > 0.001; });
    /* scan */
    const ts = seg(T, 1.05, 2.85);
    const H = -0.2 + ease(ts) * 7.6;
    solidPlane.constant = H;
    linePlane.constant = H + 1.25 * seg(T, 1.05, 1.35);
    const scanning = ts > 0 && ts < 1;
    fr.position.y = H; frLine.material.opacity = scanning ? 0.95 * Math.sin(Math.PI * ts) ** 0.3 : 0; frPlane.material.opacity = scanning ? 0.07 : 0;
    const siteK = seg(T, 2.6, 3.1);
    site.forEach((m) => { m.opacity = siteK; m.transparent = siteK < 1; m.depthWrite = siteK > 0.5; });
    gridMinor.material.opacity = 0.05 * (1 - 0.6 * siteK); gridMajor.material.opacity = 0.11 * (1 - 0.5 * siteK);
    /* camera */
    let pos, quat, P, ph = null, fly = 0;
    if (!S.built) {
      const t1 = ease(seg(T, 0.75, 2.55)), t2 = ease(seg(T, 2.45, T_ARRIVE));
      const pA = poses.top.pos.clone().lerp(poses.aer.pos, t1);
      const orbit = (1 - t2) * t1 * 0.35 * Math.sin(seg(T, 0.75, 2.55) * Math.PI);
      const pA2 = pA.clone().sub(C).applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit).add(C);
      const qA = quatLook(pA2, C.clone().add(new THREE.Vector3(0, 2.2, 0)).sub(pA2).normalize(), new THREE.Vector3(0, 1, 0));
      pos = pA2.clone().lerp(st[0].pos, t2);
      quat = poses.top.q.clone().slerp(qA, t1).slerp(st[0].q, t2);
      P = lerpP(lerpP(poses.top.P, poses.aer.P, t1), st[0].P, t2);
      fly = 1;
    } else {
      const a = st[S.a], b = st[S.b], tf = S.tf;
      if (tf <= 0) { pos = a.pos.clone(); quat = a.q.clone(); P = a.P.clone(); ph = a; }
      else if (tf >= 1) { pos = b.pos.clone(); quat = b.q.clone(); P = b.P.clone(); ph = b; }
      else { pos = lerpPos(a.pos, b.pos, tf); quat = a.q.clone().slerp(b.q, tf); P = lerpP(a.P, b.P, tf); fly = Math.sin(Math.PI * tf); }
    }
    camera.position.copy(pos); camera.quaternion.copy(quat);
    camera.updateMatrixWorld(true);
    camera.projectionMatrix.copy(P); camera.projectionMatrixInverse.copy(P).invert();
    const lineOp = !S.built ? 0.9 * (1 - 0.65 * seg(T, 2.7, T_ARRIVE)) : 0.14 + 0.5 * Math.max(fly, 1 - S.pv);
    lineMats.forEach((m) => { m.opacity = lineOp; });
    /* photograph */
    if (ph) {
      const t = texNow.get(ph.key);
      if (!t) tex(ph.key).then((x) => { if (x) texNow.set(ph.key, x); dirty = true; });
      ovMat.uniforms.uTex.value = t || null;
      ovMat.uniforms.uK.value.set(ph.k[0], ph.k[1]);
      ovMat.uniforms.uF.value.set(ph.f[0], ph.f[1]);
      ovMat.uniforms.uO.value.set(ph.o[0], ph.o[1]);
      ovMat.uniforms.uP.value = t ? S.pv : 0;
      ovMat.uniforms.uFrame.value = (ph.k[0] > 1.001 || ph.k[1] > 1.001) ? S.pv : 0;
    } else { ovMat.uniforms.uP.value = 0; ovMat.uniforms.uFrame.value = 0; }
    showCap(ph && S.pv > 0.4 ? idx(ph.key) : -1);
    sec.classList.toggle('h3d-built', S.built);
    /* labels on the plan */
    const lk = seg(T, 0.55, 0.9) * (1 - seg(T, 2.0, 2.5));
    labelBox.style.opacity = lk;
    if (lk > 0) {
      const v = new THREE.Vector3();
      LABELS.forEach((L) => {
        v.copy(L.p).project(camera);
        L.el.style.transform = `translate(${((v.x + 1) / 2 * vp.w).toFixed(1)}px, ${((1 - v.y) / 2 * vp.h).toFixed(1)}px) translate(-50%, -50%)`;
      });
    }
  }
  function showCap(i) {
    if (i === curCap) return; curCap = i;
    listBtns.forEach((b, j) => { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    if (i < 0) { gsap.to(capEl, { opacity: 0, y: 8, duration: 0.35, ease: 'power1.out', overwrite: true }); return; }
    capEl.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</span>${VIEWS[i].name}`;
    gsap.fromTo(capEl, { opacity: 0.2, y: 12 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', overwrite: true });
  }
  function frame() {
    size();
    if (!dirty) return;
    dirty = false;
    apply();
    R.clear();
    R.render(scene, camera);
    if (ovMat.uniforms.uP.value > 0.0001 || ovMat.uniforms.uFrame.value > 0) R.render(ovScene, ovCam);
  }

  /* ---------------- scroll position -> where the camera is ----------------
     U runs 0..n-1. Whole numbers are the photographs. Between them the photograph
     dissolves into the model, the camera flies to the next view, and the next
     photograph settles over the model in triangles. */
  const RMh = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PH_HOLD = 0.1, PH_OUT = 0.3, PH_ARR = 0.78;
  const sm = (t) => t * t * (3 - 2 * t);
  let Ut = 0, Ud = 0;
  const preload = (i) => { const v = VIEWS[i]; if (v) tex(v.key).then((x) => { if (x) texNow.set(v.key, x); dirty = true; }); };
  function fromU(u) {
    u = Math.max(0, Math.min(n - 1, u));
    let a = Math.floor(u), f = u - a;
    if (a >= n - 1) { a = n - 1; f = 0; }
    if (f < PH_HOLD) { S.a = a; S.b = a; S.tf = 0; S.pv = 1; }
    else if (f < PH_OUT) { S.a = a; S.b = a + 1; S.tf = 0; S.pv = 1 - sm((f - PH_HOLD) / (PH_OUT - PH_HOLD)); }
    else if (f < PH_ARR) { S.a = a; S.b = a + 1; S.tf = ease((f - PH_OUT) / (PH_ARR - PH_OUT)); S.pv = 0; }
    else { S.a = a + 1; S.b = a + 1; S.tf = 0; S.pv = sm((f - PH_ARR) / (1 - PH_ARR)); }
    progEls.forEach((p, j) => { if (p) p.style.transform = `scaleX(${j === 0 ? 1 : clamp01(u - (j - 1)).toFixed(3)})`; });
    const near = Math.round(u);
    preload(Math.min(n - 1, near + 1)); preload(Math.min(n - 1, near + 2));
    dirty = true;
  }
  let intro = null, started = false, visible = true, landing = false;
  function setU(u) {
    Ut = Math.max(0, Math.min(n - 1, u));
    if (!S.built && intro && Ut > 0.02) intro.timeScale(4.5);   // they want to move: finish the build quickly
  }
  gsap.ticker.add(() => {
    if (!started) return;
    if (S.built && !landing) {
      const d = Ut - Ud;
      if (Math.abs(d) > 0.0004) { Ud += RMh ? d : d * (1 - Math.pow(0.86, Math.min(30, gsap.ticker.deltaRatio(60)))); fromU(Ud); }   // same pace at any frame rate
    }
    if (visible) frame();
  });
  listBtns.forEach((b, i) => b.addEventListener('click', () => sec.dispatchEvent(new CustomEvent('h3d:pick', { detail: i }))));
  function runIntro() {
    preload(0); preload(1);
    intro = gsap.timeline({ onUpdate: () => { dirty = true; }, delay: 0.3, onComplete: () => {
      S.built = true; Ud = 0; fromU(0);
      if (Ut < 0.05) {
        landing = true; S.pv = 0;
        gsap.to(S, { pv: 1, duration: 1.4, ease: 'power2.inOut', onUpdate: () => { dirty = true; if (Ut >= 0.05) { landing = false; } }, onComplete: () => { landing = false; } });
      }
      sec.dispatchEvent(new CustomEvent('h3d:landed'));
    } });
    intro.to(S, { T: T_PLAN, duration: 2.1, ease: 'power1.inOut' })
      .to(S, { T: T_ARRIVE, duration: 4.2, ease: 'power2.inOut' });
  }
  async function start() {
    if (started) return;
    meta = await load();
    lastW = 0; size(); poses = makePoses(meta);
    started = true; dirty = true; sec.classList.add('h3d-ready');
    frame();
    if (RMh) { S.T = T_ARRIVE; S.built = true; fromU(0); sec.dispatchEvent(new CustomEvent('h3d:landed')); }
    else runIntro();
  }
  new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; dirty = true; if (intro && !S.built) { if (visible) intro.resume(); else intro.pause(); } }), { threshold: 0.01 }).observe(sec);
  window.addEventListener('resize', () => { lastW = 0; dirty = true; });
  window.__home3d = { S, n, setU, fromU, frame: () => { dirty = true; frame(); }, finish: () => { if (intro) intro.progress(1); } };
  start();
})();
