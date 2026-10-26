/* The Catawba: presentation page. Tovizy, October 2026.
   Vector lines come from the 3D model (Freestyle export); photographs are revealed
   through a lattice of roof-pitch (7/12) triangles drawn by a small WebGL shader. */
(() => {
  'use strict';
  const D = document, html = D.documentElement;
  const A = '../assets/13-stripes-spec-house/';
  const q = (s, r = D) => r.querySelector(s);
  const qa = (s, r = D) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') { html.classList.remove('js'); html.classList.add('no-js'); return; }
  if (RM) html.classList.add('rm');
  window.__catawba = true;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------- images ---------------- */
  const MAXW = { c1: 3200, c2: 3200, c4: 3200, c5: 3200, c6: 3200, c7: 3200, c3: 2400, c5clay: 2400, c1clay: 2400, g5: 1600, g6: 1600 };
  const pickW = () => {
    const r = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(innerWidth, innerHeight * 1.5) * r;
    return w > 2700 ? 3200 : w > 1700 ? 2400 : 1600;
  };
  const HI6 = new Set(["c1", "c3", "c6", "c7"]); /*HI6*/
  const url = (key) => `${A}${key}-${Math.min(pickW(), HI6.has(key) ? 3200 : (MAXW[key] || 2400))}.webp${HI6.has(key) ? '?v=6k' : ''}`;
  const IMG = new Map();
  const img = (u) => {
    if (!IMG.has(u)) IMG.set(u, new Promise((res, rej) => {
      const i = new Image(); i.decoding = 'async';
      i.onload = () => res(i); i.onerror = rej; i.src = u;
    }));
    return IMG.get(u);
  };

  /* ---------------- WebGL ---------------- */
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;
varying vec2 v;
uniform sampler2D uA,uB;
uniform vec2 uRes,uSA,uSB,uO,uFA,uFB;
uniform float uP,uMode,uCell,uDA,uDB,uFit,uK;
uniform vec3 uBg,uEdge;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 fit(vec2 uv,vec2 s,vec2 f){
  float rc=uRes.x/uRes.y,ri=s.x/s.y;
  vec2 kc=rc>ri?vec2(1.,ri/rc):vec2(rc/ri,1.);
  vec2 kn=rc>ri?vec2(rc/ri,1.):vec2(1.,ri/rc);
  vec2 k=mix(kc,kn,uFit);
  return uv*k+(1.-k)*f;
}
vec3 tx(sampler2D t,vec2 uv,float dk){
  vec3 c=(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)?uBg:texture2D(t,uv).rgb;
  return mix(c,uBg,dk);
}
void main(){
  vec2 uv=vec2(v.x,1.-v.y);
  vec2 px=uv*uRes;
  float rv,eg=0.;
  if(uMode<.5){
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
    rv=smoothstep(th-e,th+e,kk);
    eg=(1.-smoothstep(0.,e*1.5,abs(kk-th)))*step(.003,k)*(1.-step(.997,k));
  }else{
    vec2 dir=normalize(vec2(12.,7.));
    vec2 nr=vec2(-dir.y,dir.x);
    float a0=0.,a1=dot(vec2(uRes.x,0.),dir),a2=dot(vec2(0.,uRes.y),dir),a3=dot(uRes,dir);
    float s0=min(min(a0,a1),min(a2,a3)),s1=max(max(a0,a1),max(a2,a3));
    float x=(dot(px,dir)-s0)/(s1-s0);
    float j=floor(dot(px,nr)/uCell);
    float sp=.32;
    float e=1.6/(s1-s0);
    float ep=(uP*(1.+sp)-h(vec2(j,1.7))*sp)*(1.+4.*e)-2.*e;
    rv=1.-smoothstep(ep-e,ep+e,x);
    eg=(1.-smoothstep(0.,e*2.5,abs(x-ep)))*step(.003,uP)*(1.-step(.997,uP));
  }
  vec2 ua=fit(uv,uSA,uFA);
  vec2 ub=fit(uv,uSB,uFB);
  ub=(ub-.5)*(1.-uK*(1.-uP))+.5;
  vec3 c=mix(tx(uA,ua,uDA),tx(uB,ub,uDB),rv);
  c=mix(c,uEdge,eg*.92*sin(3.14159*clamp(uP,0.,1.)));
  gl_FragColor=vec4(c,1.);
}`;
  const U = ['uA', 'uB', 'uRes', 'uSA', 'uSB', 'uO', 'uFA', 'uFB', 'uP', 'uMode', 'uCell', 'uDA', 'uDB', 'uFit', 'uK', 'uBg', 'uEdge'];

  class GL {
    constructor(cv, bg) {
      const g = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!g) throw new Error('no webgl');
      const sh = (t, s) => { const o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o)); return o; };
      const pr = g.createProgram();
      g.attachShader(pr, sh(g.VERTEX_SHADER, VS)); g.attachShader(pr, sh(g.FRAGMENT_SHADER, FS)); g.linkProgram(pr);
      if (!g.getProgramParameter(pr, g.LINK_STATUS)) throw new Error('link');
      g.useProgram(pr);
      const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      const loc = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
      this.u = {}; U.forEach((n) => { this.u[n] = g.getUniformLocation(pr, n); });
      g.uniform1i(this.u.uA, 0); g.uniform1i(this.u.uB, 1);
      this.g = g; this.cv = cv; this.cache = new Map(); this.order = []; this.max = 5;
      this.bgc = bg.map((x) => x / 255);
      this.solidTex = this.solid(bg);
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
      this.size();
    }
    solid(rgb) {
      const g = this.g, t = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, t);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGB, 1, 1, 0, g.RGB, g.UNSIGNED_BYTE, new Uint8Array(rgb));
      return { t, w: 3, h: 2 };
    }
    size() {
      const r = this.cv.getBoundingClientRect();
      let d = Math.min(window.devicePixelRatio || 1, 2);
      const area = Math.max(1, r.width * r.height);
      if (area * d * d > 5.0e6) d = Math.sqrt(5.0e6 / area);
      const w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
      if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
      this.g.viewport(0, 0, w, h);
    }
    tex(im) {
      if (this.cache.has(im)) { this.order.splice(this.order.indexOf(im), 1); this.order.push(im); return this.cache.get(im); }
      const g = this.g, t = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, t);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, im);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      const o = { t, w: im.naturalWidth, h: im.naturalHeight };
      this.cache.set(im, o); this.order.push(im);
      while (this.order.length > this.max) { const old = this.order.shift(); g.deleteTexture(this.cache.get(old).t); this.cache.delete(old); }
      return o;
    }
    draw(s) {
      if (this.lost) return;
      const g = this.g, u = this.u;
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, s.a.t);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, s.b.t);
      g.uniform2f(u.uRes, this.cv.width, this.cv.height);
      g.uniform2f(u.uSA, s.a.w, s.a.h); g.uniform2f(u.uSB, s.b.w, s.b.h);
      g.uniform2f(u.uO, s.o[0], s.o[1]);
      g.uniform2f(u.uFA, s.fa[0], s.fa[1]); g.uniform2f(u.uFB, s.fb[0], s.fb[1]);
      g.uniform1f(u.uP, s.p); g.uniform1f(u.uMode, s.mode); g.uniform1f(u.uCell, s.cell);
      g.uniform1f(u.uDA, s.da); g.uniform1f(u.uDB, s.db); g.uniform1f(u.uFit, s.fit); g.uniform1f(u.uK, s.k);
      g.uniform3f(u.uBg, this.bgc[0], this.bgc[1], this.bgc[2]);
      g.uniform3f(u.uEdge, 0.722, 0.604, 0.388);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    }
  }

  /* A stage is one picture area: photo (fallback), WebGL canvas and the vector lines on top. */
  class Stage {
    constructor(el, o = {}) {
      this.el = el; this.cv = q('canvas', el); this.svg = q('.stage-lines', el);
      this.ia = q('.stage-img', el); this.ib = q('.stage-img-b', el);
      this.s = { a: null, b: null, p: 0, mode: o.mode || 0, o: [0.5, 0.5], cell: 0, da: 0, db: 0, fit: 0, k: o.k ?? 0.06, fa: [0.5, 0.5], fb: [0.5, 0.5] };
      this.fitOpt = o.fit || 0; this.s.fit = this.fitNow();
      this.cellDiv = o.cellDiv || 8.5; this.tok = 0; this.raf = 0; this.ua = ''; this.ub = '';
      try { this.gl = new GL(this.cv, o.bg || [19, 32, 27]); el.classList.add('gl'); } catch (e) { this.gl = null; }
      const ro = new ResizeObserver(() => { this.s.fit = this.fitNow(); if (this.gl) this.gl.size(); this.fitLines(); this.render(); });
      ro.observe(el);
    }
    async set(ua, ub) {
      const t = ++this.tok;
      const [ia, ib] = await Promise.all([ua === 'bg' ? null : img(ua), ub === 'bg' ? null : img(ub)]);
      if (t !== this.tok) return false;
      this.ua = ua; this.ub = ub;
      if (this.gl) {
        this.s.a = ia ? this.gl.tex(ia) : this.gl.solidTex;
        this.s.b = ib ? this.gl.tex(ib) : this.gl.solidTex;
      } else {
        if (this.ia && ua !== 'bg') this.ia.src = ua;
        if (this.ib && ub !== 'bg') this.ib.src = ub;
      }
      this.render();
      return true;
    }
    render() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        if (this.gl) {
          if (!this.s.a || !this.s.b) return;
          this.s.cell = Math.max(22, Math.round(this.cv.height / this.cellDiv));
          this.gl.draw(this.s);
        } else if (this.ib) {
          this.ib.style.opacity = this.s.p;
          if (this.ia) this.ia.style.opacity = 1 - this.s.da * 0.8;
        }
      });
    }
    fitNow() { return typeof this.fitOpt === 'function' ? this.fitOpt() : this.fitOpt; }
    fitLines() {
      if (!this.svg) return;
      const vb = this.svg.viewBox.baseVal; if (!vb || !vb.width) return;
      const R = this.el.getBoundingClientRect(); if (!R.width) return;
      const rc = R.width / R.height, ri = vb.width / vb.height, f = this.s.fit;
      const kc = rc > ri ? [1, ri / rc] : [rc / ri, 1], kn = rc > ri ? [rc / ri, 1] : [1, ri / rc];
      const kx = kc[0] + (kn[0] - kc[0]) * f, ky = kc[1] + (kn[1] - kc[1]) * f;
      const w = R.width / kx, h = R.height / ky;
      Object.assign(this.svg.style, { left: `${(R.width - w) / 2}px`, top: `${(R.height - h) / 2}px`, width: `${w}px`, height: `${h}px`, right: 'auto', bottom: 'auto' });
      this.svg.setAttribute('preserveAspectRatio', 'none');
      const sc = w / vb.width || 1;
      this.svg.style.setProperty('--sw', (1.15 / sc).toFixed(3));
      const ln = q('.ln', this.svg); if (ln) ln.style.strokeWidth = (1.15 / sc).toFixed(3);
      const an = q('.anno', this.svg); if (an) an.style.strokeWidth = (1.2 / sc).toFixed(3);
    }
  }

  const LINES = new Map();
  async function loadLines(stage, key) {
    if (!LINES.has(key)) LINES.set(key, fetch(`${A}lines-${key}.svg`).then((r) => r.text()));
    const t = await LINES.get(key);
    const doc = new DOMParser().parseFromString(t, 'image/svg+xml');
    const root = doc.documentElement;
    stage.svg.setAttribute('viewBox', root.getAttribute('viewBox'));
    const g = q('.ln', stage.svg);
    g.replaceChildren(...[...root.children].map((n) => D.importNode(n, true)));
    stage.fitLines();
    return qa('path', g);
  }

  /* ---------------- smooth scroll ---------------- */
  let lenis = null;
  if (!RM && !COARSE && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToY = (y) => { if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }); };
  window.__catawbaScrollTo = scrollToY;

  /* ---------------- hero ---------------- */
  const REEL = [
    { key: 'c1', o: [0.574, 0.381] },
    { key: 'c7', o: [0.5, 0.52] },
    { key: 'c6', o: [0.62, 0.5] },
    { key: 'c2', o: [0.317, 0.538] },
    { key: 'c5', o: [0.609, 0.484] },
    { key: 'c4', o: [0.837, 0.399] },
  ];
  const HOLD = 5.5;
  const heroEl = q('.hero');
  const hero = new Stage(q('.hero .stage'), { k: 0.07, cellDiv: 11 });
  const reelBtns = qa('.reel button');
  let cur = 0, busy = false, prog = null, heroOn = true;

  function markReel() { reelBtns.forEach((b, i) => b.setAttribute('aria-current', i === cur ? 'true' : 'false')); }
  function startProgress() {
    if (RM) return;
    if (prog) prog.kill();
    reelBtns.forEach((b, i) => { if (i !== cur) gsap.set(q('i', b), { scaleX: 0 }); });
    prog = gsap.fromTo(q('i', reelBtns[cur]), { scaleX: 0 }, { scaleX: 1, duration: HOLD, ease: 'none', paused: !heroOn, onComplete: () => goReel((cur + 1) % REEL.length) });
  }
  let compact = false;
  function compactTitle() {
    if (compact || RM || !matchMedia('(min-aspect-ratio: 1/1)').matches) return;
    compact = true;
    const t = q('.title'); const fs = parseFloat(getComputedStyle(t).fontSize);
    gsap.to(t, { fontSize: fs * 0.56, duration: 1.4, ease: 'expo.inOut' });
  }
  async function goReel(n) {
    if (busy || n === cur) return;
    busy = true;
    compactTitle();
    if (prog) prog.kill();
    const next = REEL[n], prev = REEL[cur];
    const [paths] = await Promise.all([loadLines(hero, next.key), img(url(next.key))]);
    hero.s.p = 0; hero.s.da = 0; hero.s.o = next.o;
    await hero.set(url(prev.key), url(next.key));
    cur = n; markReel();
    gsap.set(q('.anno', hero.svg), { opacity: 0 });
    gsap.set(paths, { strokeDashoffset: 1 });
    gsap.set(hero.svg, { opacity: 1 });
    const r = () => hero.render();
    const tl = gsap.timeline({ onComplete: () => { busy = false; startProgress(); } });
    tl.to(hero.s, { da: 0.88, duration: 0.8, ease: 'power2.inOut', onUpdate: r }, 0)
      .to(paths, { strokeDashoffset: 0, duration: 1.15, ease: 'power1.inOut', stagger: 0.022 }, 0.2)
      .to(hero.s, { p: 1, duration: 1.7, ease: 'power2.inOut', onUpdate: r }, 1.35)
      .to(hero.svg, { opacity: 0, duration: 1.1, ease: 'power1.in' }, 1.7);
    REEL.forEach((x) => img(url(x.key)));
  }
  reelBtns.forEach((b, i) => b.addEventListener('click', () => goReel(i)));

  function splitTitle() {
    qa('.title .w').forEach((w) => { w.innerHTML = `<span>${w.textContent}</span>`; });
  }
  splitTitle();

  async function intro() {
    const c1 = url('c1');
    const paths = qa('.ln path', hero.svg);
    const anno = q('.anno', hero.svg);
    hero.fitLines();
    hero.s.o = REEL[0].o;
    const fonts = Promise.race([D.fonts ? D.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1400))]);
    if (RM) {
      await hero.set('bg', c1); hero.s.p = 1; hero.render();
      gsap.set(['.title', '.hero .shade', '.hero-copy .sub', '.hero-copy .facts li', '.reel'], { opacity: 1 });
      return;
    }
    await Promise.all([hero.set('bg', c1), fonts]);
    const r = () => hero.render();
    gsap.set(paths, { strokeDashoffset: 1 });
    gsap.set(anno, { opacity: 1 });
    const dat = qa('.datum line', anno), datT = qa('.datum text', anno), dims = qa('.dim path', anno), dimT = qa('.dim text, .pitch', anno);
    gsap.set(dat, { scaleX: 0, transformOrigin: '0% 50%' });
    gsap.set(datT, { opacity: 0, y: 6 });
    gsap.set(dims, { strokeDasharray: '1 1', strokeDashoffset: 1 });
    gsap.set(dimT, { opacity: 0 });
    const tl = gsap.timeline({ delay: 0.15 });
    gsap.set('.title', { opacity: 1 });
    tl.from('.bar', { autoAlpha: 0, y: -12, duration: 0.9, ease: 'power2.out' }, 0)
      .to(paths, { strokeDashoffset: 0, duration: 1.5, ease: 'power1.inOut', stagger: 0.034 }, 0.15)
      .to(dat, { scaleX: 1, duration: 1.3, ease: 'expo.inOut', stagger: 0.12 }, 0.35)
      .to(datT, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 }, 0.95)
      .to(dims, { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut', stagger: 0.15 }, 1.0)
      .to(dimT, { opacity: 1, duration: 0.6, stagger: 0.1 }, 1.5)
      .to(hero.s, { p: 1, duration: 2.5, ease: 'power2.inOut', onUpdate: r }, 2.55)
      .to(hero.svg, { opacity: 0, duration: 1.4, ease: 'power1.in' }, 2.9)
      .to('.hero .shade', { opacity: 1, duration: 1.4 }, 3.2)
      .from('.title .w > span', { yPercent: 108, duration: 1.3, ease: 'expo.out', stagger: 0.09 }, 3.4)
      .to(['.hero-copy .sub', '.hero-copy .facts li'], { opacity: 1, duration: 0.9, stagger: 0.06 }, 3.8)
      .to(['.reel', '.cue'], { opacity: 1, duration: 0.9 }, 4.1)
      .add(() => { startProgress(); REEL.slice(1).forEach((x) => { img(url(x.key)); }); }, 4.2);
  }
  markReel();
  intro();

  /* hero turns into a house-shaped window as you scroll away */
  const mmHero = gsap.matchMedia();
  mmHero.add('(min-aspect-ratio: 1/1) and (prefers-reduced-motion: no-preference)', () => {
    const frame = q('.hero .frame');
    const outline = q('.gable-outline polyline');
    const rise = () => Math.min(62, (0.5 * innerWidth * 7 / 12) / innerHeight * 100);
    const st = gsap.timeline({ scrollTrigger: { trigger: heroEl, start: 'top top', end: '+=90%', scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      onLeave: () => { heroOn = false; if (prog) prog.pause(); },
      onEnterBack: () => { heroOn = true; if (prog) prog.resume(); } } });
    st.fromTo(frame, { clipPath: 'polygon(0% 0%, 50% 0%, 100% 0%, 100% 100%, 0% 100%)' },
      { clipPath: () => `polygon(0% ${rise()}%, 50% 0%, 100% ${rise()}%, 100% 100%, 0% 100%)`, ease: 'power2.inOut', duration: 1 }, 0)
      .fromTo(outline, { opacity: 0 }, { opacity: 1, ease: 'power1.inOut', duration: 0.6 }, 0.35)
      .to(frame, { scale: 0.5, yPercent: 8, ease: 'power2.in', duration: 1 }, 0.55)
      .to('.hero-copy', { yPercent: -40, opacity: 0, ease: 'power1.in', duration: 0.6 }, 0)
      .to('.cue', { opacity: 0, duration: 0.2 }, 0);
    const updOutline = () => { outline.setAttribute('points', `0,${rise()} 50,0 100,${rise()} 100,100 0,100 0,${rise()}`); };
    updOutline(); window.addEventListener('resize', updOutline);
    return () => window.removeEventListener('resize', updOutline);
  });
  ScrollTrigger.create({ trigger: '.views', start: 'top 40%', onEnter: () => { heroOn = false; if (prog) prog.pause(); }, onLeaveBack: () => { heroOn = true; if (prog) prog.resume(); } });
  D.addEventListener('visibilitychange', () => { if (!prog) return; if (D.hidden) prog.pause(); else if (heroOn) prog.resume(); });

  /* ---------------- five views ---------------- */
  if (!RM) {
    gsap.set('.tile', { clipPath: 'polygon(50% 38%, 62% 50%, 62% 62%, 38% 62%, 38% 50%)' });
    ScrollTrigger.batch('.tile', {
      start: 'top 88%', once: true,
      onEnter: (b) => {
        gsap.to(b, { clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%)', duration: 1.5, ease: 'expo.inOut', stagger: 0.13 });
        gsap.fromTo(b.map((t) => q('img', t)), { scale: 1.28 }, { scale: 1, duration: 1.9, ease: 'expo.out', stagger: 0.13, clearProps: 'transform' });
      },
    });
    gsap.from('.views .h2, .views .lede', { scrollTrigger: { trigger: '.views', start: 'top 80%' }, y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 });
  }

  /* ---------------- model: clay, drawing, light ---------------- */
  const modelEl = q('.model');
  if (modelEl) {
    const st = new Stage(q('.stage', modelEl), { k: 0.05, cellDiv: 9, fit: () => (innerWidth / innerHeight < 0.9 ? 0.62 : 0) });
    st.s.o = [0.609, 0.484];
    const steps = qa('.steps li', modelEl);
    const bars = steps.map((s) => q('i', s));
    const setStep = (i) => steps.forEach((s, j) => s.classList.toggle('on', j <= i));
    const r = () => st.render();
    let tl = null;
    if (!RM) {
      tl = gsap.timeline({ scrollTrigger: { trigger: modelEl, start: 'top top', end: '+=240%', scrub: 0.8, pin: true, anticipatePin: 1,
        onUpdate: (self) => setStep(self.progress < 0.3 ? 0 : self.progress < 0.62 ? 1 : 2) } });
      tl.to(bars[0], { scaleX: 1, duration: 1, ease: 'none' }, 0)
        .to(st.s, { da: 0.9, duration: 1.1, ease: 'power1.inOut', onUpdate: r }, 0.6)
        .to(bars[1], { scaleX: 1, duration: 1.4, ease: 'none' }, 1.0)
        .to(st.s, { p: 1, duration: 1.6, ease: 'power1.inOut', onUpdate: r }, 2.6)
        .to(st.svg, { opacity: 0, duration: 0.9 }, 3.1)
        .to(q('.ov-h', modelEl), { opacity: 0, y: -30, duration: 0.8 }, 3.0)
        .to(bars[2], { scaleX: 1, duration: 1.6, ease: 'none' }, 2.6)
        .to({}, { duration: 0.5 }, 4.2);
    }
    let built = false;
    const build = async () => {
      if (built) return; built = true;
      const [paths] = await Promise.all([loadLines(st, 'c5'), st.set(url('c5clay'), url('c5'))]);
      if (RM) { st.s.p = 1; st.render(); setStep(2); gsap.set(bars, { scaleX: 1 }); gsap.set(st.svg, { opacity: 0 }); return; }
      gsap.set(paths, { strokeDashoffset: 1 });
      tl.to(paths, { strokeDashoffset: 0, duration: 1.2, ease: 'none', stagger: 0.035 }, 0.9);
      tl.scrollTrigger.update && tl.scrollTrigger.update();
      r();
    };
    ScrollTrigger.create({ trigger: modelEl, start: 'top 220%', once: true, onEnter: build });
    gsap.from(q('.ov-h h2', modelEl), { scrollTrigger: { trigger: modelEl, start: 'top 70%' }, y: 50, opacity: 0, duration: 1.2, ease: 'expo.out' });
  }

  /* ---------------- twelve moments ---------------- */
  const moEl = q('.moments');
  if (moEl) {
    const KEYS = qa('.mo-list button', moEl).map((b) => b.dataset.k);
    const NAMES = qa('.mo-list button', moEl).map((b) => b.textContent.trim());
    const btns = qa('.mo-list button', moEl);
    const nameEl = q('.mo-name', moEl);
    const st = new Stage(q('.stage', moEl), { mode: 0, k: 0.03, cellDiv: 10, fit: () => (innerWidth / innerHeight < 0.9 ? 0.62 : 0) });
    st.s.o = [0.52, 0.56];
    const mu = (k) => `${A}${k}-${Math.min(pickW(), 2400)}.webp${HI6.has(k) ? '?v=6k' : ''}`;
    let pi = -1, on = -1, trig = null;
    const showName = (i) => {
      if (i === on) return; on = i;
      btns.forEach((b, j) => b.classList.toggle('on', j === i));
      nameEl.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')} / ${KEYS.length}</span>${NAMES[i]}`;
      if (!RM) gsap.fromTo(nameEl, { opacity: 0.2, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', overwrite: true });
    };
    const at = (P) => {
      const n = KEYS.length - 1;
      P = Math.max(0, Math.min(n, P));
      const i = Math.min(n - 1, Math.floor(P));
      if (i !== pi) { pi = i; st.set(mu(KEYS[i]), mu(KEYS[i + 1])); [i + 2, i + 3, i - 1].forEach((j) => { if (KEYS[j]) img(mu(KEYS[j])); }); }
      st.s.p = P - i; st.render();
      showName(Math.round(P));
    };
    const start = async () => {
      await st.set(mu(KEYS[0]), mu(KEYS[1])); pi = 0; at(0);
      KEYS.forEach((k) => img(mu(k)));
    };
    ScrollTrigger.create({ trigger: moEl, start: 'top 200%', once: true, onEnter: start });
    if (!RM) {
      trig = ScrollTrigger.create({ trigger: moEl, start: 'top top', end: () => `+=${(KEYS.length - 1) * 48}%`, pin: true, anticipatePin: 1, scrub: true,
        snap: { snapTo: 1 / (KEYS.length - 1), duration: { min: 0.25, max: 0.7 }, delay: 0.08, ease: 'power2.inOut' },
        onUpdate: (self) => { if (pi >= 0) at(self.progress * (KEYS.length - 1)); } });
    }
    btns.forEach((b, i) => b.addEventListener('click', () => {
      if (trig) scrollToY(trig.start + (trig.end - trig.start) * (i / (KEYS.length - 1)));
      else { const P = i; if (pi >= 0) { st.set(mu(KEYS[Math.max(0, P - 1)]), mu(KEYS[P])).then(() => { st.s.p = 1; st.render(); showName(P); }); } }
    }));
  }

  /* ---------------- plan ---------------- */
  const planEl = q('.plan');
  if (planEl) {
    const svg = q('.plan-svg', planEl);
    const tip = q('.room-tip', planEl);
    const def = tip.innerHTML;
    const lines = qa('line.w, line.iw', svg);
    const wins = qa('line.wn', svg);
    const swings = qa('path.sw', svg);
    const dms = qa('line.dm', svg);
    const prep = (els) => els.forEach((l) => { const L = l.getTotalLength ? l.getTotalLength() : 100; l.style.strokeDasharray = `${L} ${L}`; l.style.strokeDashoffset = RM ? 0 : L; });
    prep(lines); prep(wins); prep(swings); prep(dms);
    if (!RM) {
      gsap.set(qa('.pf, .fx', svg), { opacity: 0 });
      gsap.set(qa('.pp', svg), { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(qa('.lb, .dmt', svg), { opacity: 0, y: 8 });
      gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 72%', once: true } })
        .to(qa('.pf', svg), { opacity: 1, duration: 0.9, stagger: 0.12 }, 0)
        .to(qa('line.w', svg), { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.07 }, 0.1)
        .to(qa('.pp', svg), { scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.04 }, 0.5)
        .to(qa('line.iw', svg), { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut', stagger: 0.05 }, 0.8)
        .to(wins, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out', stagger: 0.015 }, 1.3)
        .to(swings, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', stagger: 0.04 }, 1.5)
        .to(qa('.fx', svg), { opacity: 1, duration: 0.6 }, 1.6)
        .to(qa('.lb', svg), { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.03 }, 1.7)
        .to(dms, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 1.9)
        .to(qa('.dmt', svg), { opacity: 1, y: 0, duration: 0.5 }, 2.3);
    }
    const hits = qa('.hit', svg);
    const show = (h) => { hits.forEach((x) => x.classList.toggle('on', x === h)); tip.innerHTML = h ? `<b>${h.dataset.room}</b>${h.dataset.dims || ''}` : def; };
    hits.forEach((h) => {
      h.setAttribute('tabindex', '0'); h.setAttribute('role', 'button'); h.setAttribute('aria-label', `${h.dataset.room} ${h.dataset.dims || ''}`.trim());
      h.addEventListener('mouseenter', () => show(h)); h.addEventListener('focus', () => show(h));
      h.addEventListener('click', () => show(h));
    });
    svg.addEventListener('mouseleave', () => show(null));
    qa('.nums dd[data-n]', planEl).forEach((dd) => {
      const n = +dd.dataset.n, sm = q('small', dd), smH = sm ? sm.outerHTML : '';
      const fmt = (v) => Math.round(v).toLocaleString('en-US') + smH;
      if (RM) { dd.innerHTML = fmt(n); return; }
      dd.innerHTML = fmt(0);
      const o = { v: 0 };
      gsap.to(o, { v: n, duration: n > 100 ? 2.2 : 1.2, ease: 'power3.out', scrollTrigger: { trigger: dd, start: 'top 88%', once: true }, onUpdate: () => { dd.innerHTML = fmt(o.v); } });
    });
  }

  /* roofline: the light plan section rises with a 7/12 pitched top edge */
  if (planEl && !RM) {
    const rise = () => Math.round(Math.min(innerWidth * 0.5 * 7 / 12, innerHeight * 0.42));
    gsap.fromTo(planEl, { clipPath: () => `polygon(0px ${rise()}px, 50% 0px, 100% ${rise()}px, 100% 100%, 0% 100%)` },
      { clipPath: 'polygon(0px 0px, 50% 0px, 100% 0px, 100% 100%, 0% 100%)', ease: 'none', immediateRender: true,
        scrollTrigger: { trigger: planEl, start: 'top bottom', end: 'top 20%', scrub: true, invalidateOnRefresh: true } });
  }

  /* closing note: the house draws itself once more, in brass */
  const noteArt = q('.note-art');
  if (noteArt) {
    ScrollTrigger.create({ trigger: '.note', start: 'top 75%', once: true, onEnter: async () => {
      if (!LINES.has('c1')) LINES.set('c1', fetch(`${A}lines-c1.svg`).then((r) => r.text()));
      const doc = new DOMParser().parseFromString(await LINES.get('c1'), 'image/svg+xml');
      const g = q('.ln', noteArt);
      g.replaceChildren(...[...doc.documentElement.children].map((n) => D.importNode(n, true)));
      const ps = qa('path', g);
      if (RM) { gsap.set(ps, { strokeDashoffset: 0 }); return; }
      gsap.to(ps, { strokeDashoffset: 0, duration: 2.2, ease: 'power1.inOut', stagger: 0.05 });
    } });
  }

  /* ---------------- finishes ---------------- */
  const finEl = q('.finish');
  if (finEl) {
    const pins = qa('.hs', finEl), items = qa('.fin-list li', finEl);
    let fi = 0, auto = null, user = false;
    const set = (i) => { fi = i; pins.forEach((p, j) => p.classList.toggle('on', j === i)); items.forEach((p, j) => p.classList.toggle('on', j === i)); };
    const take = (i) => { user = true; if (auto) auto.kill(); set(i); };
    pins.forEach((p, i) => { p.addEventListener('click', () => take(i)); p.addEventListener('mouseenter', () => take(i)); });
    items.forEach((p, i) => { const b = q('button', p); b.addEventListener('click', () => take(i)); b.addEventListener('mouseenter', () => take(i)); b.addEventListener('focus', () => take(i)); });
    set(0);
    if (!RM) {
      gsap.fromTo(pins, { scale: 0, opacity: 0 }, { scrollTrigger: { trigger: finEl, start: 'top 65%', once: true }, scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.08 });
      gsap.from(q('.fin-fig', finEl), { scrollTrigger: { trigger: finEl, start: 'top 85%', once: true }, clipPath: 'polygon(50% 40%, 60% 50%, 60% 60%, 40% 60%, 40% 50%)', duration: 1.6, ease: 'expo.inOut' });
      ScrollTrigger.create({ trigger: finEl, start: 'top 60%', end: 'bottom 30%',
        onToggle: (self) => { if (user) return; if (self.isActive) { auto = gsap.to({}, { duration: 2.3, repeat: -1, onRepeat: () => set((fi + 1) % pins.length) }); } else if (auto) auto.kill(); } });
    }
  }

  /* ---------------- films ---------------- */
  qa('video').forEach((v) => {
    if (RM) { v.removeAttribute('autoplay'); v.controls = true; v.pause(); return; }
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }), { threshold: 0.25 }).observe(v);
  });
  if (!RM) {
    gsap.utils.toArray('.film').forEach((f, i) => gsap.from(f, { scrollTrigger: { trigger: f, start: 'top 88%', once: true }, clipPath: 'polygon(0% 100%, 50% 100%, 100% 100%, 100% 100%, 0% 100%)', duration: 1.4, ease: 'expo.inOut', delay: i * 0.12 }));
    gsap.utils.toArray('.sec .h2').forEach((h) => { if (h.closest('.views')) return; gsap.from(h, { scrollTrigger: { trigger: h, start: 'top 85%', once: true }, y: 46, opacity: 0, duration: 1.2, ease: 'expo.out' }); });
  }

  /* ---------------- print rail ---------------- */
  const printEl = q('.print');
  if (printEl && !RM) {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 861px) and (min-height: 561px)', () => {
      const rail = q('.rail', printEl), wrap = q('.rail-wrap', printEl);
      const dist = () => { const c = rail.lastElementChild; return Math.max(0, c ? c.offsetLeft + c.offsetWidth - wrap.clientWidth : 0); };
      gsap.to(rail, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: printEl, start: 'top top', end: () => `+=${dist()}`, scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true } });
    });
  }

  /* ---------------- x-ray lens on the views ---------------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !RM) {
    qa('.tile').forEach((t) => {
      const xr = D.createElement('span'); xr.className = 'xr'; t.insertBefore(xr, q('img.tl', t));
      const NS = 'http://www.w3.org/2000/svg';
      const sv = D.createElementNS(NS, 'svg'); sv.setAttribute('class', 'lensline'); sv.setAttribute('aria-hidden', 'true');
      const pg = D.createElementNS(NS, 'polygon'); sv.appendChild(pg); t.appendChild(sv);
      const L = { r: 0, x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
      let raf = 0, tw = null;
      const draw = () => {
        raf = 0;
        L.x += (L.tx - L.x) * 0.22; L.y += (L.ty - L.y) * 0.22;
        const R = t.getBoundingClientRect(), w = R.width, h = R.height;
        const a = L.r, X = L.x * w, Y = L.y * h;
        const pts = [[X - a, Y + 0.8 * a], [X - a, Y - 0.2 * a], [X, Y - 0.2 * a - a * 7 / 12], [X + a, Y - 0.2 * a], [X + a, Y + 0.8 * a]];
        t.style.setProperty('--lp', `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`);
        sv.setAttribute('viewBox', `0 0 ${w.toFixed(1)} ${h.toFixed(1)}`);
        pg.setAttribute('points', pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
        if (Math.abs(L.tx - L.x) > 0.0005 || Math.abs(L.ty - L.y) > 0.0005) raf = requestAnimationFrame(draw);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
      t.addEventListener('pointerenter', (e) => {
        const R = t.getBoundingClientRect(); L.x = L.tx = (e.clientX - R.left) / R.width; L.y = L.ty = (e.clientY - R.top) / R.height;
        if (tw) tw.kill(); tw = gsap.to(L, { r: Math.min(170, Math.max(90, R.width * 0.17)), duration: 0.7, ease: 'expo.out', onUpdate: kick });
      });
      t.addEventListener('pointermove', (e) => { const R = t.getBoundingClientRect(); L.tx = (e.clientX - R.left) / R.width; L.ty = (e.clientY - R.top) / R.height; kick(); });
      t.addEventListener('pointerleave', () => { if (tw) tw.kill(); tw = gsap.to(L, { r: 0, duration: 0.45, ease: 'power2.in', onUpdate: kick }); });
    });
  }

  /* ---------------- print: the sheets fan out of one stack ---------------- */
  if (printEl && !RM) {
    const cards = qa('.card', printEl);
    gsap.from(cards, {
      scrollTrigger: { trigger: printEl, start: 'top 72%', once: true },
      x: (i) => -(cards[i].getBoundingClientRect().left - cards[0].getBoundingClientRect().left) * 0.92,
      y: (i) => 30 + Math.abs(i - 1.5) * 18,
      rotation: (i) => (i - 1.5) * 5.5,
      transformOrigin: '50% 115%',
      duration: 1.7, ease: 'expo.inOut', stagger: { each: 0.06, from: 'end' },
    });
  }

  /* ---------------- fullscreen viewer ---------------- */
  const vEl = q('.viewer');
  let vw = null, vlist = [], vi = 0, vbusy = false, lastFocus = null;
  const vcap = q('.vcap', vEl);
  const capFor = (i) => `<small>${String(i + 1).padStart(2, '0')} / ${String(vlist.length).padStart(2, '0')}</small>${vlist[i].cap}`;
  async function vopen(list, i, from) {
    vlist = list; vi = i; lastFocus = D.activeElement;
    vEl.classList.add('open'); vEl.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop(); html.style.overflow = 'hidden';
    if (!vw) vw = new Stage(q('.stage', vEl), { fit: 1, k: 0.04, cellDiv: 9, bg: [13, 22, 19] });
    if (vw.gl) vw.gl.size();
    vcap.innerHTML = capFor(i);
    vw.s.p = 0; vw.s.da = 0; vw.s.o = from || [0.5, 0.5];
    await vw.set('bg', url(vlist[i].key));
    q('.vclose', vEl).focus();
    gsap.fromTo(vw.s, { p: 0 }, { p: 1, duration: RM ? 0.01 : 1.2, ease: 'power2.inOut', onUpdate: () => vw.render() });
  }
  async function vgo(d) {
    if (vbusy || vlist.length < 2) return; vbusy = true;
    const n = (vi + d + vlist.length) % vlist.length;
    vw.s.p = 0; vw.s.o = d > 0 ? [1, 0.5] : [0, 0.5];
    const ok = await vw.set(url(vlist[vi].key), url(vlist[n].key));
    vi = n; vcap.innerHTML = capFor(n);
    if (!ok) { vbusy = false; return; }
    gsap.to(vw.s, { p: 1, duration: RM ? 0.01 : 1.1, ease: 'power2.inOut', onUpdate: () => vw.render(), onComplete: () => { vbusy = false; } });
    img(url(vlist[(n + d + vlist.length) % vlist.length].key));
  }
  function vclose() {
    vEl.classList.remove('open'); vEl.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start(); html.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  q('.vclose', vEl).addEventListener('click', vclose);
  q('.vprev', vEl).addEventListener('click', () => vgo(-1));
  q('.vnext', vEl).addEventListener('click', () => vgo(1));
  D.addEventListener('keydown', (e) => {
    if (!vEl.classList.contains('open')) return;
    if (e.key === 'Escape') vclose();
    else if (e.key === 'ArrowRight') vgo(1);
    else if (e.key === 'ArrowLeft') vgo(-1);
  });
  let sx = null;
  vEl.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  vEl.addEventListener('pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) vgo(dx < 0 ? 1 : -1); });

  const VIEWS = qa('.tile').map((t) => ({ key: t.dataset.k, cap: t.dataset.cap }));
  qa('.tile').forEach((t, i) => t.addEventListener('click', (e) => {
    const r = t.getBoundingClientRect();
    vopen(VIEWS, i, [(e.clientX || r.left + r.width / 2) / innerWidth, (e.clientY || r.top + r.height / 2) / innerHeight]);
  }));
  const PRINT = qa('.card button').map((b) => ({ key: b.dataset.k, cap: b.dataset.cap }));
  qa('.card button').forEach((b, i) => b.addEventListener('click', () => vopen(PRINT, i)));

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
