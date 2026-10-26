/* Tovizy home, October 2026. Lattice transitions are drawn by a small WebGL shader:
   7/12 roof-pitch triangles, the same as on our client presentations. */
(() => {
  'use strict';
  const D = document, html = D.documentElement;
  const q = (s, r = D) => r.querySelector(s);
  const qa = (s, r = D) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') { html.classList.remove('js'); html.classList.add('no-js'); return; }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const pickW = () => { const r = Math.min(window.devicePixelRatio || 1, 2); return Math.max(innerWidth, innerHeight * 1.5) * r; };
  const IMG = new Map();
  const img = (u) => {
    if (!IMG.has(u)) IMG.set(u, new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = u; }));
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

  /* ---------------- smooth scroll ---------------- */
  let lenis = null;
  if (!RM && !COARSE && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToY = (y) => { if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }); };

  /* ---------------- header and menu ---------------- */
  const hdr = q('.hdr');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    hdr.classList.toggle('solid', y > innerHeight * 0.6);
    if (!html.classList.contains('menu-open')) hdr.classList.toggle('hide', y > innerHeight && y > lastY + 4);
    if (y < lastY - 4) hdr.classList.remove('hide');
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const menuBtn = q('.menu-btn'), menu = q('#menu');
  if (menuBtn && menu) {
    const setMenu = (open) => {
      html.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); menuBtn.textContent = open ? 'Close' : 'Menu';
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    };
    menuBtn.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    D.addEventListener('keydown', (e) => { if (e.key === 'Escape' && html.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); } });
  }
  qa('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = q(a.getAttribute('href')); if (!t) return;
    e.preventDefault(); scrollToY(t.getBoundingClientRect().top + scrollY);
  }));

  /* ---------------- hero: words, then the window closes into a house as you scroll ---------------- */
  const hero = q('.hero3d');
  if (hero) {
    if (RM) gsap.set(['.h3d-copy .lede', '.h3d-copy .actions', '.h3d-side'], { opacity: 1 });
    else {
      gsap.timeline({ delay: 0.2 })
        .from('.hdr', { autoAlpha: 0, y: -14, duration: 1, ease: 'power2.out' }, 0)
        .from('.h3d-copy h1 .ln > span', { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: 0.1 }, 0.35)
        .to('.h3d-copy .lede', { opacity: 1, duration: 1, ease: 'power1.out' }, 1.0)
        .to('.h3d-copy .actions', { opacity: 1, duration: 1, ease: 'power1.out' }, 1.2);
      const side = () => gsap.to('.h3d-side', { opacity: 1, duration: 1.1, ease: 'power1.out' });
      hero.addEventListener('h3d:landed', side, { once: true });
      if (hero.classList.contains('h3d-static')) side();
      setTimeout(side, 11000);
      const mm = gsap.matchMedia();
      mm.add('(min-aspect-ratio: 1/1) and (prefers-reduced-motion: no-preference)', () => {
        const frame = q('.h3d-frame'), outline = q('.h3d-outline polyline');
        const rise = () => Math.min(62, (0.5 * innerWidth * 7 / 12) / innerHeight * 100);
        const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: '+=85%', scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true } });
        tl.fromTo(frame, { clipPath: 'polygon(0% 0%, 50% 0%, 100% 0%, 100% 100%, 0% 100%)' },
          { clipPath: () => `polygon(0% ${rise()}%, 50% 0%, 100% ${rise()}%, 100% 100%, 0% 100%)`, ease: 'power2.inOut', duration: 1 }, 0)
          .fromTo(outline, { opacity: 0 }, { opacity: 1, ease: 'power1.inOut', duration: 0.6 }, 0.35)
          .to([frame, q('.h3d-outline')], { scale: 0.5, yPercent: 8, ease: 'power2.in', duration: 1 }, 0.55)
          .to('.h3d-copy', { yPercent: -30, opacity: 0, ease: 'power1.in', duration: 0.6 }, 0)
          .to('.cue', { opacity: 0, duration: 0.2 }, 0);
        const upd = () => outline.setAttribute('points', `0,${rise()} 50,0 100,${rise()} 100,100 0,100 0,${rise()}`);
        upd(); addEventListener('resize', upd);
        return () => removeEventListener('resize', upd);
      });
    }
  }

  /* ---------------- selected work: one stage, scroll through the projects ---------------- */
  const workEl = q('.work');
  if (workEl) {
    const P = JSON.parse(q('.work-data', workEl).textContent);
    const btns = qa('.work-list button', workEl);
    const st = new Stage(q('.stage', workEl), { mode: 0, k: 0.03, cellDiv: 10, fit: () => (innerWidth / innerHeight < 0.9 ? 0.0 : 0) });
    st.s.o = [0.5, 0.56];
    const big = (p) => (pickW() > 1700 && p.big ? p.big : p.src);
    const info = q('.work-info', workEl), nEl = q('.n', info), tEl = q('.work-title a', info), mEl = q('.work-meta', info), goEl = q('.work-go', info);
    let pi = -1, on = -1, trig = null;
    const show = (i) => {
      if (i === on) return; on = i;
      btns.forEach((b, j) => b.classList.toggle('on', j === i));
      nEl.textContent = `${String(i + 1).padStart(2, '0')} / ${String(P.length).padStart(2, '0')}`;
      tEl.textContent = P[i].name; tEl.href = P[i].href; goEl.href = P[i].href;
      mEl.textContent = `${P[i].meta} ${P[i].count ? '· ' + P[i].count : ''}`;
      if (!RM) gsap.fromTo([tEl, mEl], { opacity: 0.15, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.05, overwrite: true });
    };
    const at = (X) => {
      const n = P.length - 1;
      X = Math.max(0, Math.min(n, X));
      const i = Math.min(n - 1, Math.floor(X));
      if (i !== pi) { pi = i; st.set(big(P[i]), big(P[i + 1])); [i + 2, i - 1].forEach((j) => { if (P[j]) img(big(P[j])); }); }
      st.s.p = X - i; st.render();
      show(Math.round(X));
    };
    ScrollTrigger.create({ trigger: workEl, start: 'top 250%', once: true, onEnter: async () => { await st.set(big(P[0]), big(P[1])); pi = 0; at(trig ? trig.progress * (P.length - 1) : 0); } });
    if (!RM) {
      trig = ScrollTrigger.create({ trigger: workEl, start: 'top top', end: () => `+=${(P.length - 1) * 55}%`, pin: q('.work-pin', workEl), anticipatePin: 1, scrub: true,
        snap: { snapTo: 1 / (P.length - 1), duration: { min: 0.3, max: 0.8 }, delay: 0.1, ease: 'power2.inOut' },
        onUpdate: (self) => { if (pi >= 0) at(self.progress * (P.length - 1)); } });
    }
    btns.forEach((b, i) => b.addEventListener('click', () => { if (trig) scrollToY(trig.start + (trig.end - trig.start) * (i / (P.length - 1))); }));
    show(0);
  }

  /* ---------------- services ---------------- */
  const svc = q('.svc');
  if (svc && !RM) {
    const rise = () => Math.round(Math.min(innerWidth * 0.5 * 7 / 12, innerHeight * 0.42));
    gsap.fromTo(svc, { clipPath: () => `polygon(0px ${rise()}px, 50% 0px, 100% ${rise()}px, 100% 100%, 0% 100%)` },
      { clipPath: 'polygon(0px 0px, 50% 0px, 100% 0px, 100% 100%, 0% 100%)', ease: 'none', immediateRender: true,
        scrollTrigger: { trigger: svc, start: 'top bottom', end: 'top 15%', scrub: true, invalidateOnRefresh: true } });
    gsap.set('.card', { clipPath: 'polygon(50% 38%, 62% 50%, 62% 62%, 38% 62%, 38% 50%)' });
    ScrollTrigger.batch('.card', { start: 'top 86%', once: true, onEnter: (b) => {
      gsap.to(b, { clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%)', duration: 1.5, ease: 'expo.inOut', stagger: 0.12 });
      gsap.fromTo(b.map((c) => q('.media', c)), { scale: 1.22 }, { scale: 1, duration: 1.9, ease: 'expo.out', stagger: 0.12, clearProps: 'transform' });
    } });
  }
  /* the render card: a house-shaped lens shows the drawing */
  qa('.lens-host').forEach((t) => {
    const over = q('.over', t);
    const NS = 'http://www.w3.org/2000/svg';
    const sv = D.createElementNS(NS, 'svg'); sv.setAttribute('class', 'lensline'); sv.setAttribute('aria-hidden', 'true');
    const pg = D.createElementNS(NS, 'polygon'); sv.appendChild(pg); t.appendChild(sv);
    const L = { r: 0, x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let raf = 0, tw = null;
    const draw = () => {
      raf = 0;
      L.x += (L.tx - L.x) * 0.2; L.y += (L.ty - L.y) * 0.2;
      const w = t.clientWidth, h = t.clientHeight, a = L.r, X = L.x * w, Y = L.y * h;
      const pts = [[X - a, Y + 0.8 * a], [X - a, Y - 0.2 * a], [X, Y - 0.2 * a - a * 7 / 12], [X + a, Y - 0.2 * a], [X + a, Y + 0.8 * a]];
      t.style.setProperty('--lp', `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`);
      sv.setAttribute('viewBox', `0 0 ${w} ${h}`);
      pg.setAttribute('points', pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
      if (Math.abs(L.tx - L.x) > 0.0005 || Math.abs(L.ty - L.y) > 0.0005) raf = requestAnimationFrame(draw);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const R0 = () => Math.min(200, Math.max(70, t.clientWidth * 0.12));
    const at = (e) => { const r = t.getBoundingClientRect(); L.tx = (e.clientX - r.left) / r.width; L.ty = (e.clientY - r.top) / r.height; };
    t.addEventListener('pointerenter', (e) => { at(e); L.x = L.tx; L.y = L.ty; if (tw) tw.kill(); tw = gsap.to(L, { r: R0(), duration: 0.7, ease: 'expo.out', onUpdate: kick }); });
    t.addEventListener('pointermove', (e) => { at(e); kick(); });
    t.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { if (tw) tw.kill(); tw = gsap.to(L, { r: 0, duration: 0.45, ease: 'power2.in', onUpdate: kick }); } });
    // until someone points at it, the lens wanders slowly across the room on its own
    if (!RM) {
      let idle = true;
      t.addEventListener('pointerenter', () => { idle = false; });
      ScrollTrigger.create({ trigger: t, start: 'top 70%', once: true, onEnter: () => {
        if (!idle) return;
        tw = gsap.to(L, { r: R0() * 0.9, duration: 1.2, ease: 'expo.out', onUpdate: kick });
        const path = [[0.32, 0.48], [0.52, 0.42], [0.7, 0.55], [0.45, 0.6]];
        let k = 0;
        const step = () => { if (!idle) return; const [x, y] = path[k++ % path.length]; gsap.to(L, { tx: x, ty: y, duration: 2.6, ease: 'sine.inOut', onUpdate: kick, onComplete: step }); };
        L.x = L.tx = 0.3; L.y = L.ty = 0.5; step();
      } });
    }
  });
  /* the estate card: the same house through the day, in triangles */
  const est = q('.c-estate .stage');
  if (est) {
    const E = JSON.parse(est.dataset.seq);
    const tagEl = q('.c-estate .tag');
    const s = new Stage(est, { mode: 0, k: 0.04, cellDiv: 7 });
    s.s.o = [0.5, 0.6];
    let i = 0, timer = null, inView = false;
    const next = async () => {
      const a = E[i], b = E[(i + 1) % E.length];
      if (!(await s.set(a.src, b.src))) return;
      s.s.p = 0;
      gsap.to(s.s, { p: 1, duration: RM ? 0.01 : 1.6, ease: 'power2.inOut', onUpdate: () => s.render(), onStart: () => { tagEl.textContent = b.tag; } });
      i = (i + 1) % E.length;
    };
    const loop = () => { clearTimeout(timer); if (!inView) return; timer = setTimeout(async () => { await next(); loop(); }, 2600); };
    new IntersectionObserver((es) => es.forEach((e) => { inView = e.isIntersecting; if (inView) { E.forEach((x) => img(x.src)); loop(); } else clearTimeout(timer); }), { threshold: 0.3 }).observe(est);
    s.set(E[0].src, E[1].src).then(() => { s.s.p = 0; s.render(); });
  }
  qa('video[data-src]').forEach((v) => {
    let loaded = false;
    new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { if (!loaded) { loaded = true; v.src = v.dataset.src; } if (!RM) v.play().catch(() => {}); } else v.pause();
    }), { threshold: 0.25 }).observe(v);
  });

  /* ---------------- studio ---------------- */
  qa('.facts dd[data-n]').forEach((dd) => {
    const n = +dd.dataset.n, suf = dd.dataset.suf || '';
    if (RM) return;
    const o = { v: 0 };
    dd.textContent = '0' + suf;
    gsap.to(o, { v: n, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: dd, start: 'top 90%', once: true }, onUpdate: () => { dd.textContent = Math.round(o.v) + suf; } });
  });
  if (!RM) {
    gsap.utils.toArray('.sec .h2').forEach((h) => gsap.from(h, { scrollTrigger: { trigger: h, start: 'top 86%', once: true }, y: 50, opacity: 0, duration: 1.2, ease: 'expo.out' }));
    const fig = q('.studio-fig img');
    if (fig) gsap.fromTo(fig, { clipPath: 'polygon(50% 40%, 60% 50%, 60% 60%, 40% 60%, 40% 50%)' }, { clipPath: 'polygon(50% -40%, 140% 50%, 140% 140%, -40% 140%, -40% 50%)', duration: 1.6, ease: 'expo.inOut', clearProps: 'clipPath', scrollTrigger: { trigger: fig, start: 'top 85%', once: true } });
    gsap.utils.toArray('.built figure').forEach((f, i) => gsap.fromTo(f, { clipPath: 'polygon(0% 100%, 50% 100%, 100% 100%, 100% 100%, 0% 100%)' }, { clipPath: 'polygon(0% 0%, 50% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: 1.3, ease: 'expo.inOut', delay: i * 0.12, clearProps: 'clipPath', scrollTrigger: { trigger: f, start: 'top 90%', once: true } }));
  }

  /* ---------------- contact form ---------------- */
  const form = D.getElementById('project-form');
  if (form) {
    const status = q('.form-status', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const data = {}; new FormData(form).forEach((v, k) => { data[k] = v; });
      if (data._honey) return;
      const btn = q('button[type=submit]', form);
      btn.disabled = true; status.dataset.state = ''; status.textContent = 'Sending…';
      data._subject = 'New project inquiry from ' + (data.name || 'tovizy.com'); data._template = 'table';
      fetch(form.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((res) => { if (!res || String(res.success) !== 'true') throw new Error('not sent'); form.reset(); status.dataset.state = 'ok'; status.textContent = 'Sent. We’ll reply within 24 hours.'; })
        .catch(() => { status.dataset.state = 'error'; status.textContent = `Your message didn’t send. Email us at ${form.dataset.email} instead.`; })
        .finally(() => { btn.disabled = false; });
    });
  }

  addEventListener('load', () => ScrollTrigger.refresh());
})();
