/* Tovizy home, October 2026. Transitions are drawn by a small WebGL shader: 7/12 roof-pitch triangles,
   boards, roof-pitch slats and a house-shaped window. Same language as our client presentations. */
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
  }else if(uMode>2.5){
    /* a house-shaped window opens from uO: walls and a 7/12 roof */
    vec2 o=uO*uRes;
    float S=uP*length(uRes)*.62;
    vec2 d=px-o;
    float wall=max(abs(d.x)-S,d.y-.55*S);
    float roof=(-d.y-.25*S)-(S-abs(d.x))*7./12.;
    float sd=max(wall,roof);
    float e=2.;
    rv=1.-smoothstep(-e,e,sd);
    eg=(1.-smoothstep(0.,3.,abs(sd)))*step(.003,uP)*(1.-step(.997,uP));
  }else if(uMode>1.5){
    /* boards: vertical boards fall into place one after another, like siding going up */
    float bw=uCell*.62;
    float j=floor(px.x/bw);
    float xo=(j*bw)/uRes.x;
    float sp=.55;
    float t=clamp((uP*(1.+sp)-xo*sp*.7-h(vec2(j,3.1))*sp*.3),0.,1.);
    t=t*t*(3.-2.*t);
    float y=uv.y;
    float e=1.5/uRes.y;
    rv=1.-smoothstep(t-e,t+e,y);
    float fx=fract(px.x/bw);
    float bat=1.-smoothstep(0.,2./bw,min(fx,1.-fx));
    eg=max((1.-smoothstep(0.,4./uRes.y,abs(y-t)))*step(.003,t)*(1.-step(.997,t)),bat*.35*step(.003,uP)*(1.-step(.997,uP))*rv);
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

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const sm = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

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

  /* ---------------- hero: the house is the story; scrolling walks around it ---------------- */
  const hero = q('.hero3d');
  if (hero) {
    const main = q('.h3d-main', hero), side = q('.h3d-side', hero), hint = q('.h3d-hint', hero);
    if (RM) gsap.set(['.h3d-copy .lede', '.h3d-copy .actions', '.h3d-side', '.h3d-hint'], { opacity: 1 });
    else {
      gsap.timeline({ delay: 0.2 })
        .from('.hdr', { autoAlpha: 0, y: -14, duration: 1, ease: 'power2.out' }, 0)
        .from('.h3d-copy h1 .ln > span', { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: 0.1 }, 0.35)
        .to('.h3d-copy .lede', { opacity: 1, duration: 1, ease: 'power1.out' }, 1.0)
        .to('.h3d-copy .actions', { opacity: 1, duration: 1, ease: 'power1.out' }, 1.2);
      const showSide = () => { gsap.to(side, { opacity: 1, duration: 1.1, ease: 'power1.out' }); gsap.to(hint, { opacity: 1, duration: 1, delay: 0.8 }); };
      hero.addEventListener('h3d:landed', showSide, { once: true });
      if (hero.classList.contains('h3d-static')) showSide();
      setTimeout(showSide, 12000);

      const n = qa('.h3d-views button', hero).length, steps = n - 1;
      const STEP = () => innerHeight * (COARSE ? 0.8 : 0.95);
      const TAIL = () => innerHeight * 0.8;
      const frame = q('.h3d-frame', hero), ol = q('.h3d-outline', hero), outline = q('polyline', ol);
      const rise = () => Math.min(62, (0.5 * innerWidth * 7 / 12) / innerHeight * 100);
      const shrink = gsap.timeline({ paused: true });
      shrink.fromTo(frame, { clipPath: 'polygon(0% 0%, 50% 0%, 100% 0%, 100% 100%, 0% 100%)' },
        { clipPath: () => `polygon(0% ${rise()}%, 50% 0%, 100% ${rise()}%, 100% 100%, 0% 100%)`, ease: 'power2.inOut', duration: 1 }, 0)
        .fromTo(outline, { opacity: 0 }, { opacity: 1, ease: 'power1.inOut', duration: 0.6 }, 0.35)
        .to([frame, ol], { scale: 0.5, yPercent: 8, ease: 'power2.in', duration: 1 }, 0.55)
        .to(side, { opacity: 0, duration: 0.4 }, 0);
      const upd = () => outline.setAttribute('points', `0,${rise()} 50,0 100,${rise()} 100,100 0,100 0,${rise()}`);
      upd();
      let lastPs = -1;
      const trig = ScrollTrigger.create({
        trigger: hero, start: 'top top', end: () => `+=${STEP() * steps + TAIL()}`, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        onRefresh: () => { upd(); shrink.invalidate(); },
        onUpdate: (self) => {
          const total = STEP() * steps + TAIL(), tf = TAIL() / total;
          const ps = Math.min(1, self.progress / (1 - tf)), pt = Math.max(0, (self.progress - (1 - tf)) / tf);
          if (window.__home3d) window.__home3d.setU(ps * steps);
          if (ps !== lastPs) {
            lastPs = ps;
            const k = sm(ps * steps / 0.55);
            gsap.set(main, { opacity: 1 - k, y: -60 * k });
            gsap.set(hint, { opacity: hint.dataset.on ? 1 - sm(ps * steps / 0.25) : 0 });
            hero.classList.toggle('h3d-walking', ps > 0.02);
          }
          shrink.progress(pt);
        },
      });
      hint.dataset.on = '';
      hero.addEventListener('h3d:landed', () => { hint.dataset.on = '1'; }, { once: true });
      hero.addEventListener('h3d:pick', (e) => scrollToY(trig.start + STEP() * steps * (e.detail / steps) + 2));
    }
  }

  /* ---------------- presentations: a sales site, played by scrolling ----------------
     Day to night switches light by light (the brightest windows first), shots change in
     roof-pitch triangles, the house changes through a house-shaped window. Depth maps
     move near things more than far ones, so every photograph has a little room in it. */
  const presEl = q('.pres');
  if (presEl) {
    const F = JSON.parse(q('.pres-data', presEl).textContent);
    const HOUSES = JSON.parse(q('.pres-houses', presEl).textContent);
    const stage = q('.pres-stage', presEl), cv = q('canvas', stage), fb = q('.pres-fb', stage);
    const nameEl = q('.pres-name h3', presEl), subEl = q('.pres-name p', presEl), pnEl = q('.pres-name .pn', presEl);
    const urlEl = q('.pres-bar b', presEl), goEl = q('.pres-go', presEl), chEls = qa('.pres-ch li', presEl);
    const clockEl = q('.pres-clock', presEl), tEl = q('.t', clockEl), lEl = q('.l', clockEl);
    const PVS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
    const PFS = `precision highp float;
varying vec2 v;
uniform sampler2D uA,uB,uDA,uDB;
uniform vec2 uRes,uSA,uSB,uO,uPar;
uniform float uP,uMode,uCell,uZ;
uniform vec3 uEdge;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 cover(vec2 uv,vec2 s){float rc=uRes.x/uRes.y,ri=s.x/s.y;vec2 k=rc>ri?vec2(1.,ri/rc):vec2(rc/ri,1.);return (uv-.5)*k+.5;}
vec2 room(vec2 uv,sampler2D d,float amt){vec2 c=(uv-.5)/(1.+uZ)+.5;float z=texture2D(d,c).r;return c+uPar*(z-.4)*.028*amt;}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){
  vec2 uv=vec2(v.x,1.-v.y);
  vec2 px=uv*uRes;
  vec2 ua=room(cover(uv,uSA),uDA,1.),ub=room(cover(uv,uSB),uDB,1.);
  vec3 A=texture2D(uA,ua).rgb,B=texture2D(uB,ub).rgb;
  float rv=0.,eg=0.;
  if(uMode<.5){
    float ch=uCell,cw=ch*12./7.;
    vec2 g=px/vec2(cw,ch);vec2 id=floor(g),f=fract(g);
    float m=mod(id.x+id.y,2.);float fx=m>.5?1.-f.x:f.x;float up=step(1.,fx+f.y);
    float mn=up>.5?min(min(fx+f.y-1.,1.-f.y),1.-fx):min(min(1.-fx-f.y,fx),f.y);
    vec2 cn=up>.5?vec2(2./3.):vec2(1./3.);if(m>.5)cn.x=1.-cn.x;
    vec2 cp=(id+cn)*vec2(cw,ch);vec2 o=uO*uRes;float md=length(max(o,uRes-o));float d=length(cp-o)/md;
    float sp=.7;float k=clamp((uP*(1.+sp)-d*sp-h(id+up*3.7)*.1)/.42,0.,1.);k=k*k*(3.-2.*k);
    float th=1.-3.*mn;float e=4./ch;float kk=k*(1.+2.*e)-e;
    rv=smoothstep(th-e,th+e,kk);
    eg=(1.-smoothstep(0.,e*1.5,abs(kk-th)))*step(.003,k)*(1.-step(.997,k));
  }else if(uMode<1.5){
    /* lights: the brightest parts of the later hour arrive first */
    vec2 t=vec2(6.)/uRes;
    float L=(lum(texture2D(uB,ub+vec2(t.x,0.)).rgb)+lum(texture2D(uB,ub-vec2(t.x,0.)).rgb)+lum(texture2D(uB,ub+vec2(0.,t.y)).rgb)+lum(texture2D(uB,ub-vec2(0.,t.y)).rgb)+lum(B))/5.;
    float La=lum(A);
    float order=clamp(1.-max(L-La*.35,0.)*1.6,0.,1.);
    order=mix(order,uv.y,.25);
    float t0=order*.72;
    rv=smoothstep(t0,t0+.28,uP);
    vec3 glow=B*1.35;
    B=mix(B,glow,(1.-smoothstep(0.,.22,abs(uP-t0-.1)))*step(.55,L)*.6);
  }else{
    vec2 o=uO*uRes;float S=uP*length(uRes)*.62;vec2 d=px-o;
    float wall=max(abs(d.x)-S,d.y-.55*S);float roof=(-d.y-.25*S)-(S-abs(d.x))*7./12.;
    float sd=max(wall,roof);
    rv=1.-smoothstep(-2.,2.,sd);
    eg=(1.-smoothstep(0.,3.,abs(sd)))*step(.003,uP)*(1.-step(.997,uP));
  }
  vec3 c=mix(A,B,rv);
  c=mix(c,uEdge,eg*.9*sin(3.14159*clamp(uP,0.,1.)));
  gl_FragColor=vec4(c,1.);
}`;
    let g = null; const PU = {};
    try {
      g = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
      const sh = (t, s) => { const o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o)); return o; };
      const pr = g.createProgram(); g.attachShader(pr, sh(g.VERTEX_SHADER, PVS)); g.attachShader(pr, sh(g.FRAGMENT_SHADER, PFS)); g.linkProgram(pr);
      if (!g.getProgramParameter(pr, g.LINK_STATUS)) throw new Error('link');
      g.useProgram(pr);
      const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      const loc = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
      ['uA', 'uB', 'uDA', 'uDB', 'uRes', 'uSA', 'uSB', 'uO', 'uPar', 'uP', 'uMode', 'uCell', 'uZ', 'uEdge'].forEach((k) => { PU[k] = g.getUniformLocation(pr, k); });
      g.uniform1i(PU.uA, 0); g.uniform1i(PU.uB, 1); g.uniform1i(PU.uDA, 2); g.uniform1i(PU.uDB, 3);
      g.uniform3f(PU.uEdge, 0.722, 0.604, 0.388);
      stage.classList.add('gl');
    } catch (e) { g = null; }
    const TX = new Map();
    const mk = (im) => {
      const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, im);
      [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER].forEach((p) => g.texParameteri(g.TEXTURE_2D, p, g.LINEAR));
      [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T].forEach((p) => g.texParameteri(g.TEXTURE_2D, p, g.CLAMP_TO_EDGE));
      return { t, w: im.naturalWidth || 1, h: im.naturalHeight || 1 };
    };
    let flat = null;
    if (g) { flat = { t: g.createTexture(), w: 1, h: 1 }; g.bindTexture(g.TEXTURE_2D, flat.t); g.texImage2D(g.TEXTURE_2D, 0, g.RGB, 1, 1, 0, g.RGB, g.UNSIGNED_BYTE, new Uint8Array([102, 102, 102])); }
    const W = (f) => (f.hi && pickW() > 2600 ? 3200 : pickW() > 1900 ? 2400 : 1600);
    const srcOf = (f) => `${f.src}-${W(f)}.webp${f.v ? '?v=' + f.v : ''}`;
    const getTex = (u) => {
      if (!u) return Promise.resolve(flat);
      if (!TX.has(u)) TX.set(u, img(u).then((im) => (g ? mk(im) : im)).catch(() => flat));
      return TX.get(u);
    };
    const ps = { a: null, b: null, da: flat, db: flat, p: 0, mode: 0, o: [0.5, 0.55], par: [0, 0] };
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let curHouse = -1, curCh = -1, curClock = '';
    const size = () => {
      if (!g) return;
      const r = cv.getBoundingClientRect(); let d = Math.min(devicePixelRatio || 1, 2);
      if (r.width * r.height * d * d > 4.2e6) d = Math.sqrt(4.2e6 / (r.width * r.height));
      const w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      g.viewport(0, 0, w, h);
    };
    const draw = () => {
      if (!g || !ps.a || !ps.b) return;
      const bind = (unit, o) => { g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, o.t); };
      bind(0, ps.a); bind(1, ps.b); bind(2, ps.da || flat); bind(3, ps.db || flat);
      g.uniform2f(PU.uRes, cv.width, cv.height); g.uniform2f(PU.uSA, ps.a.w, ps.a.h); g.uniform2f(PU.uSB, ps.b.w, ps.b.h);
      g.uniform2f(PU.uO, ps.o[0], ps.o[1]); g.uniform2f(PU.uPar, ps.par[0], ps.par[1]);
      g.uniform1f(PU.uP, ps.p); g.uniform1f(PU.uMode, ps.mode); g.uniform1f(PU.uCell, Math.max(22, Math.round(cv.height / 9))); g.uniform1f(PU.uZ, 0.06);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    };
    /* the camera never stops: a slow sway, plus the pointer on a computer */
    let visible = false, raf = 0;
    const t0 = performance.now();
    function loop(now) {
      raf = 0;
      if (!visible) return;
      mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;
      const t = (now - t0) / 1000;
      ps.par[0] = (RM ? 0 : Math.sin(t * 0.33) * 0.85) + mouse.x * 0.9;
      ps.par[1] = (RM ? 0 : Math.cos(t * 0.27) * 0.25) + mouse.y * 0.6;
      draw();
      raf = requestAnimationFrame(loop);
    }
    const startLoop = () => { if (g && !raf) raf = requestAnimationFrame(loop); };
    const tabs = qa('.pres-bar [data-h]', presEl), prog = q('.pres-prog i', presEl);
    const hud = (i) => {
      const f = F[i], H = HOUSES[f.house];
      if (f.house !== curHouse) {
        curHouse = f.house;
        nameEl.textContent = H.name; subEl.textContent = H.sub; pnEl.textContent = `${String(f.house + 1).padStart(2, '0')} / ${String(HOUSES.length).padStart(2, '0')}`;
        urlEl.textContent = H.slug; goEl.href = H.href;
        tabs.forEach((b) => b.setAttribute('aria-current', +b.dataset.h === f.house ? 'true' : 'false'));
        if (!RM) gsap.fromTo([nameEl, subEl], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, overwrite: true });
      }
      if (f.ch !== curCh) { curCh = f.ch; chEls.forEach((li, j) => li.classList.toggle('on', j === f.ch)); }
      const c = f.clock || '';
      if (c !== curClock) {
        curClock = c; clockEl.classList.toggle('on', !!c);
        if (c) { tEl.textContent = c; lEl.textContent = f.hour || ''; if (!RM) gsap.fromTo(tEl, { opacity: 0.2, y: 10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', overwrite: true }); }
      }
    };
    /* it plays by itself: hold, change, hold. Clicks jump anywhere. */
    const HOLD = (f) => (f.ch === 0 ? 2.1 : 2.8);
    const DUR = [1.7, 2.6, 2.0];
    const load = (f) => Promise.all([getTex(srcOf(f)), getTex(f.depth)]);
    let cur = 0, busy = false, want = -1, timer = null, started = false;
    function schedule() {
      clearTimeout(timer);
      if (!visible || RM) return;
      const h = HOLD(F[cur]);
      if (prog) gsap.fromTo(prog, { scaleX: 0 }, { scaleX: 1, duration: h, ease: 'none', overwrite: true });
      timer = setTimeout(() => go((cur + 1) % F.length), h * 1000);
    }
    async function go(j) {
      if (busy) { want = j; return; }
      if (j === cur) { schedule(); return; }
      busy = true; clearTimeout(timer);
      const A = F[cur], B = F[j];
      const [[ta, da], [tb, db]] = await Promise.all([load(A), load(B)]);
      ps.a = ta; ps.da = da; ps.b = tb; ps.db = db;
      const mode = A.house !== B.house ? 2 : (j === cur + 1 ? B.mode : 0);
      ps.mode = mode; ps.o = mode === 2 ? [0.5, 0.68] : (B.o || [0.5, 0.55]); ps.p = 0;
      load(F[(j + 1) % F.length]);
      if (!g) fb.src = srcOf(B);
      if (prog) gsap.to(prog, { scaleX: 0, duration: 0.4, overwrite: true });
      let flipped = false;
      gsap.to(ps, { p: 1, duration: RM ? 0.01 : DUR[mode], ease: mode === 1 ? 'sine.inOut' : 'power2.inOut',
        onUpdate: () => { if (!flipped && ps.p > 0.45) { flipped = true; hud(j); } },
        onComplete: () => {
          cur = j; ps.a = ps.b; ps.da = ps.db; ps.p = 0; busy = false;
          if (want >= 0 && want !== cur) { const w = want; want = -1; go(w); } else { want = -1; schedule(); }
        } });
    }
    if (g) { new ResizeObserver(() => size()).observe(stage); size(); }
    if (!COARSE) stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2; });
    const screen = q('.pres-screen', presEl), hudEl = q('.pres-hud', presEl);
    new IntersectionObserver((es) => es.forEach(async (e) => {
      visible = e.isIntersecting;
      if (visible) {
        startLoop();
        if (!started) {
          started = true;
          const [t, d] = await load(F[0]); ps.a = ps.b = t; ps.da = ps.db = d; ps.p = 0; hud(0); load(F[1]);
          if (!RM) {
            gsap.fromTo(screen, { '--inset': 1 }, { '--inset': 0.42, duration: 1.8, ease: 'expo.inOut' });
            gsap.fromTo(hudEl, { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.7 });
          } else gsap.set(hudEl, { opacity: 1 });
        }
        if (!busy) schedule();
      } else { clearTimeout(timer); if (prog) gsap.killTweensOf(prog); }
    }), { threshold: 0.3 }).observe(stage);
    chEls.forEach((li, j) => li.addEventListener('click', () => {
      const k = F.findIndex((f) => f.house === Math.max(0, curHouse) && f.ch === j); if (k >= 0) go(k);
    }));
    tabs.forEach((b) => b.addEventListener('click', () => { const k = F.findIndex((f) => f.house === +b.dataset.h); if (k >= 0 && F[cur].house !== +b.dataset.h) go(k); }));
  }

  /* ---------------- selected work: one stage that changes by itself ---------------- */
  const workEl = q('.work');
  if (workEl) {
    const P = JSON.parse(q('.work-data', workEl).textContent);
    const btns = qa('.work-list button', workEl);
    const st = new Stage(q('.stage', workEl), { mode: 0, k: 0.05, cellDiv: 10, fit: 0 });
    const MODES = [0, 2, 1, 3];
    const ORIG = [[0.5, 0.56], [0.5, 0.5], [0.5, 0.5], [0.5, 0.64]];
    const big = (p) => (pickW() > 1700 && p.big ? p.big : p.src);
    const info = q('.work-info', workEl), nEl = q('.n', info), tEl = q('.work-title a', info), mEl = q('.work-meta', info), goEl = q('.work-go', info);
    const prog = q('.work-prog i', workEl);
    const split = (el, text) => {
      el.textContent = '';
      text.split(' ').forEach((w, wi, arr) => {
        const s = D.createElement('span'); s.className = 'wd';
        [...w].forEach((ch) => { const c = D.createElement('span'); c.className = 'ch'; c.textContent = ch; s.appendChild(c); });
        el.appendChild(s); if (wi < arr.length - 1) el.appendChild(D.createTextNode(' '));
      });
      return qa('.ch', el);
    };
    const show = (i, dir) => {
      btns.forEach((b, j) => b.classList.toggle('on', j === i));
      nEl.textContent = `${String(i + 1).padStart(2, '0')} / ${String(P.length).padStart(2, '0')}`;
      tEl.href = P[i].href; goEl.href = P[i].href;
      const chars = split(tEl, P[i].name);
      mEl.textContent = `${P[i].meta} ${P[i].count ? '· ' + P[i].count : ''}`;
      if (!RM) {
        gsap.fromTo(chars, { yPercent: dir < 0 ? -105 : 105, rotate: dir < 0 ? -6 : 6 }, { yPercent: 0, rotate: 0, duration: 0.9, ease: 'expo.out', stagger: 0.016, overwrite: true });
        gsap.fromTo(mEl, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', delay: 0.15, overwrite: true });
      }
    };
    const HOLD = 4.2;
    let cur = 0, busy = false, want = -1, timer = null, visible = false, k = 0, started = false;
    function schedule() {
      clearTimeout(timer);
      if (!visible || RM) return;
      if (prog) gsap.fromTo(prog, { scaleX: 0 }, { scaleX: 1, duration: HOLD, ease: 'none', overwrite: true });
      timer = setTimeout(() => go((cur + 1) % P.length), HOLD * 1000);
    }
    async function go(j) {
      if (busy) { want = j; return; }
      if (j === cur) { schedule(); return; }
      busy = true; clearTimeout(timer);
      st.s.mode = MODES[k % MODES.length]; st.s.o = ORIG[k % ORIG.length]; k++;
      await st.set(big(P[cur]), big(P[j])); st.s.p = 0; st.render();
      img(big(P[(j + 1) % P.length]));
      if (prog) gsap.to(prog, { scaleX: 0, duration: 0.4, overwrite: true });
      const dir = j > cur ? 1 : -1; let flipped = false;
      gsap.to(st.s, { p: 1, duration: RM ? 0.01 : 1.7, ease: 'power2.inOut',
        onUpdate: () => { st.render(); if (!flipped && st.s.p > 0.35) { flipped = true; show(j, dir); } },
        onComplete: () => { cur = j; busy = false; if (want >= 0 && want !== cur) { const w = want; want = -1; go(w); } else { want = -1; schedule(); } } });
    }
    new IntersectionObserver((es) => es.forEach(async (e) => {
      visible = e.isIntersecting;
      if (visible) {
        if (!started) { started = true; await st.set(big(P[0]), big(P[0])); st.s.p = 0; st.render(); img(big(P[1])); }
        if (!busy) schedule();
      } else { clearTimeout(timer); if (prog) gsap.killTweensOf(prog); }
    }), { threshold: 0.35 }).observe(workEl);
    btns.forEach((b, i) => b.addEventListener('click', () => go(i)));
    if (!RM) gsap.fromTo(q('.stage', workEl), { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: workEl, start: 'top bottom', end: 'top top', scrub: true } });
    show(0, 1);
  }

  /* ---------------- estates: a small configurator ---------------- */
  const estEl = q('.est');
  if (estEl) {
    const E = JSON.parse(q('.est-data', estEl).textContent);
    const s = new Stage(q('.est-house .stage', estEl), { mode: 0, k: 0.04, cellDiv: 8 });
    const fBtns = qa('[data-f]', estEl), tBtns = qa('[data-t]', estEl), tag = q('.est-tag', estEl);
    const lotLabel = q('.est-lot', estEl);
    let cf = 'limestone', ct = 'day', busy = false, queued = null, user = false, timer = null;
    const url = (f, t) => `${E.base}house-${f}-${t}-${pickW() > 1500 ? 2560 : 1280}.webp`;
    const label = () => { tag.textContent = `${E.facades[cf]} · ${E.times[ct]}`; };
    const go = async (f, t, mode) => {
      if (busy) { queued = [f, t, mode]; return; }
      if (f === cf && t === ct) return;
      busy = true;
      fBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === f ? 'true' : 'false'));
      tBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false'));
      const ok = await s.set(url(cf, ct), url(f, t));
      cf = f; ct = t; label();
      s.s.mode = mode; s.s.o = mode === 3 ? [0.5, 0.7] : [0.5, 0.55]; s.s.p = 0;
      if (!ok) { busy = false; return; }
      gsap.to(s.s, { p: 1, duration: RM ? 0.01 : 1.5, ease: 'power2.inOut', onUpdate: () => s.render(), onComplete: () => {
        busy = false; if (queued) { const qd = queued; queued = null; go(...qd); }
      } });
    };
    fBtns.forEach((b) => b.addEventListener('click', () => { user = true; clearTimeout(timer); go(b.dataset.f, ct, 3); }));
    tBtns.forEach((b) => b.addEventListener('click', () => { user = true; clearTimeout(timer); go(cf, b.dataset.t, 1); }));
    qa('.est-pin', estEl).forEach((p) => {
      const say = () => { lotLabel.textContent = p.getAttribute('aria-label'); qa('.est-pin', estEl).forEach((x) => x.classList.toggle('on', x === p)); };
      p.addEventListener('click', () => { user = true; say(); });
      p.addEventListener('pointerenter', say);
    });
    const DEMO = [['limestone', 'dusk', 1], ['limestone', 'night', 1], ['ivory', 'night', 3], ['charcoal', 'night', 3], ['charcoal', 'day', 1], ['limestone', 'day', 3]];
    let k = 0;
    const demo = () => { clearTimeout(timer); if (user || RM) return; timer = setTimeout(async () => { const [f, t, m] = DEMO[k++ % DEMO.length]; await go(f, t, m); demo(); }, 2800); };
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { Object.keys(E.facades).forEach((f) => Object.keys(E.times).forEach((t) => img(url(f, t)))); demo(); } else clearTimeout(timer); }), { threshold: 0.35 }).observe(estEl);
    s.set(url(cf, ct), url(cf, ct)).then(() => { s.s.p = 0; s.render(); label(); });
    if (!RM) {
      gsap.fromTo(q('.est-house', estEl), { clipPath: 'polygon(50% 30%, 70% 45%, 70% 75%, 30% 75%, 30% 45%)' }, { clipPath: 'polygon(50% -40%, 140% 45%, 140% 140%, -40% 140%, -40% 45%)', duration: 1.8, ease: 'expo.inOut', clearProps: 'clipPath', scrollTrigger: { trigger: estEl, start: 'top 70%', once: true } });
      gsap.fromTo(qa('.est-pin', estEl), { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(2)', stagger: 0.05, clearProps: 'transform,scale,translate,rotate', scrollTrigger: { trigger: q('.est-map', estEl), start: 'top 92%', once: true } });
    }
  }

  /* ---------------- services ---------------- */
  const svc = q('.svc');
  if (svc && !RM) {
    gsap.set('.card', { clipPath: 'polygon(50% 38%, 62% 50%, 62% 62%, 38% 62%, 38% 50%)' });
    ScrollTrigger.batch('.card', { start: 'top 86%', once: true, onEnter: (b) => {
      gsap.to(b, { clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%)', duration: 1.5, ease: 'expo.inOut', stagger: 0.12 });
      gsap.fromTo(b.map((c) => q('.media', c)), { scale: 1.22 }, { scale: 1, duration: 1.9, ease: 'expo.out', stagger: 0.12, clearProps: 'transform' });
    } });
    gsap.from(qa('.fees li', svc), { opacity: 0, y: 24, duration: 0.9, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: q('.fees', svc), start: 'top 85%', once: true } });
  }
  /* the render card: a house-shaped lens shows the drawing */
  qa('.lens-host').forEach((t) => {
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
    gsap.utils.toArray('.sec .h2, .pres-head .h2, .est .h2').forEach((h) => gsap.from(h, { scrollTrigger: { trigger: h, start: 'top 88%', once: true }, y: 50, opacity: 0, duration: 1.2, ease: 'expo.out' }));
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

  ScrollTrigger.sort();
  addEventListener('load', () => ScrollTrigger.refresh());
})();
