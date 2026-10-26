/* Tovizy Showcase — page engine. Config: window.SHOW (inline JSON). */
(function () {
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]);
  fontsReady.then(init);
  function init() {
  const C = window.SHOW;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const CAPTURE = /[?&]capture=1/.test(location.search); window.__CAPTURE = CAPTURE;
  const SCRUB = CAPTURE ? true : 1;
  document.documentElement.classList.remove('no-js');
  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const DPR = Math.min(devicePixelRatio || 1, CAPTURE ? 3 : 2);
  const SZ = innerWidth * DPR > 1700 ? 2400 : innerWidth * DPR > 1000 ? 1600 : 900;
  const GSZ = innerWidth * DPR > 1100 ? 2400 : 1600;           // texture size for WebGL
  const img = (n, s) => `${C.base}/${n}-${s || SZ}.webp`;
  const dep = n => `${C.base}/${n}-depth.webp`;
  const flip = f => [f[0], 1 - f[1]];

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && !CAPTURE && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  window.__lenis = lenis;
  const lock = on => { if (lenis) on ? lenis.stop() : lenis.start(); document.documentElement.style.overflow = on ? 'hidden' : ''; };
  lock(true);

  /* ---------- WebGL stages ---------- */
  const stages = [];
  function makeStage(el, opts) {
    if (!window.TovizyStage) return null;
    try {
      const c = document.createElement('canvas');
      el.insertBefore(c, el.firstChild);
      const s = new TovizyStage(c, Object.assign({ preserve: CAPTURE }, opts));
      s.el = el; s.visible = true; stages.push(s);
      new IntersectionObserver(e => { s.visible = e[0].isIntersecting; }, { rootMargin: '120px' }).observe(el);
      el.classList.add('has-gl');
      return s;
    } catch (e) { console.warn('[showcase] WebGL off:', e.message); return null; }
  }
  addEventListener('pointermove', e => {
    const x = e.clientX / innerWidth * 2 - 1, y = -(e.clientY / innerHeight * 2 - 1);
    stages.forEach(s => { s.mouse[0] = x; s.mouse[1] = y; });
  }, { passive: true });
  const T0 = performance.now();
  gsap.ticker.add(() => {
    const t = (performance.now() - T0) / 1000;
    stages.forEach(s => {
      if (!s.visible) return;
      if (touch || CAPTURE) { s.mouse[0] = Math.sin(t * .23) * .55; s.mouse[1] = Math.cos(t * .19) * .25; }
      s.render(t);
    });
  });
  addEventListener('resize', () => stages.forEach(s => s.resize()));

  /* ---------- cursor ---------- */
  const cur = $('.cur');
  if (cur && !touch) {
    const lab = $('b', cur);
    const qx = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3' }), qy = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3' });
    addEventListener('pointermove', e => { qx(e.clientX); qy(e.clientY); }, { passive: true });
    $$('[data-cur]').forEach(el => {
      el.addEventListener('pointerenter', () => { lab.textContent = el.dataset.cur; cur.classList.add('big'); });
      el.addEventListener('pointerleave', () => cur.classList.remove('big'));
    });
  }

  /* ---------- progress bar ---------- */
  const prog = $('.tb-prog');
  if (prog) gsap.to(prog, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });

  /* ---------- hero + loader ---------- */
  const hero = $('.hero');
  const hs = makeStage(hero, { kPar: .02 });
  const title = $('.hero h1');
  const chars = SplitText.create(title, { type: 'chars', charsClass: 'ch' }).chars;
  gsap.set(chars, { yPercent: 110 });
  const titleMask = document.createElement('span'); // keep descenders
  title.style.overflow = 'hidden'; title.style.paddingBottom = '.08em';

  const ldChars = SplitText.create($('.ld-mark'), { type: 'chars' }).chars;
  gsap.set(ldChars, { yPercent: 100, opacity: 0 });
  gsap.to(ldChars, { yPercent: 0, opacity: 1, stagger: .035, duration: 1, ease: 'expo.out', delay: .1 });
  const bar = $('.ld-bar i'), pct = $('.ld-pct');
  const P = { v: 0 };
  const setP = v => { gsap.to(P, { v, duration: .6, ease: 'power2.out', onUpdate: () => { bar.style.transform = `scaleX(${P.v / 100})`; if (pct) pct.textContent = String(Math.round(P.v)).padStart(3, '0'); } }); };

  const TIMES = C.times || null;           // [{key, label}] day -> evening -> night
  const heroLoads = [];
  let done = 0;
  const track = pr => { pr = pr.catch(() => null); heroLoads.push(pr); pr.then(() => { done++; setP(Math.min(96, done / heroLoads.length * 100)); }); return pr; };
  if (hs) {
    track(hs.set({ tA: `${C.base}/hero-lines-${GSZ}.webp`, tB: img('hero', GSZ), dB: dep('hero'), dA: dep('hero') }));
    track(hs.load(`${C.base}/hero-mask.png`));
    if (TIMES) TIMES.slice(1).forEach(t => track(hs.load(img(t.key, GSZ))));
  } else {
    track(new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = img('hero'); }));
  }
  track(document.fonts ? document.fonts.ready : Promise.resolve());

  let readyResolve; window.__ready = new Promise(r => readyResolve = r);

  Promise.all(heroLoads).catch(() => {}).then(() => {
    setP(100);
    const tl = gsap.timeline({ delay: .5 });
    tl.to(ldChars, { yPercent: -100, opacity: 0, stagger: .02, duration: .7, ease: 'expo.in' })
      .to('.ld-bar, .ld-meta', { opacity: 0, duration: .4 }, '<.1')
      .to('.ld', { opacity: 0, duration: .6, ease: 'power2.inOut' }, '-=.15')
      .set('.ld', { display: 'none' });
    if (hs) {
      hs.s.mode = 3; hs.s.p = 0; hs.s.zB = 1.06; hs.s.oA = hs.s.oB = flip(C.heroPos || [.5, .5]);
      tl.to(hs.s, { p: 1, duration: 3.2, ease: 'power2.inOut' }, '-=.5')
        .to(hs.s, { zB: 1, duration: 4, ease: 'power3.out' }, '<');
    }
    tl.to(chars, { yPercent: 0, duration: 1.4, stagger: .045, ease: 'expo.out' }, hs ? '-=2.1' : '-=.2')
      .from('.hero-sub > *, .hero-clock, .hero-tag, .tb', { opacity: 0, y: 14, stagger: .06, duration: 1, ease: 'power3.out' }, '-=1.1')
      .from('.hero-cue', { opacity: 0, duration: .8 }, '-=.6')
      .add(() => {
        if (hs) {
          hs.use({ tA: img('hero', GSZ), dA: dep('hero'), tB: TIMES ? img(TIMES[1].key, GSZ) : null, tM: `${C.base}/hero-mask.png` });
          hs.s.mode = TIMES ? 1 : 0; hs.s.p = 0; hs.s.maskMode = 0; hs.s.zA = hs.s.zB = 1;
        }
        lock(false); ScrollTrigger.refresh(); readyResolve();
      });
  });

  /* hero scroll: title away, push-in, day -> evening -> night */
  const clockT = $('.hero-clock .t'), clockL = $('.hero-clock .l');
  const sunPath = $('.sun path'), sunDot = $('.sun circle');
  const toMin = s => { const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i); let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return h * 60 + +m[2]; };
  const fmt = m => { m = Math.round(m) % 1440; let h = Math.floor(m / 60), mm = m % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(mm).padStart(2, '0')} ${ap}`; };
  function setTime(v) {           // v 0..1 over the whole sequence
    if (!TIMES || !hs) return;
    const n = TIMES.length - 1, seg = Math.min(n - 1, Math.floor(v * n)), lp = Math.min(1, v * n - seg);
    hs.use({ tA: img(TIMES[seg].key === 'hero' ? 'hero' : TIMES[seg].key, GSZ), tB: img(TIMES[seg + 1].key, GSZ) });
    hs.s.mode = 1; hs.s.p = lp;
    const a = toMin(TIMES[seg].label), b = toMin(TIMES[seg + 1].label);
    if (clockT) clockT.textContent = fmt(a + (b - a) * lp);
    if (clockL) clockL.textContent = lp > .5 ? TIMES[seg + 1].name : TIMES[seg].name;
    if (sunPath && sunDot) {
      const L = sunPath.getTotalLength(), pt = sunPath.getPointAtLength(L * Math.min(1, v * 1.15));
      sunDot.setAttribute('cx', pt.x); sunDot.setAttribute('cy', pt.y);
      sunDot.style.opacity = String(1 - Math.max(0, v - .75) * 4);
    }
  }
  setTime(0);
  if (!reduce) {
    const htl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: TIMES ? '+=170%' : '+=70%', pin: true, scrub: SCRUB } });
    htl.to(title, { yPercent: -30, opacity: 0, ease: 'power1.in', duration: .3 }, 0)
      .to('.hero-sub, .hero-cue, .hero-tag', { opacity: 0, duration: .2 }, 0);
    if (hs) htl.to(hs.s, { zA: 1.07, zB: 1.07, ease: 'none', duration: 1 }, 0);
    if (TIMES) {
      const tv = { v: 0 };
      htl.to(tv, { v: 1, ease: 'none', duration: .78, onUpdate: () => setTime(tv.v) }, .22);
    }
  }

  /* ---------- top bar colour over paper sections ---------- */
  const tb = $('.tb');
  $$('.st').forEach(sec => ScrollTrigger.create({ trigger: sec, start: 'top 40px', end: 'bottom 40px', onToggle: s => tb.classList.toggle('dark', s.isActive) }));
  ScrollTrigger.create({ trigger: '.st', start: 'top 40px', endTrigger: 'html', end: 'bottom bottom', onToggle: s => tb.classList.toggle('solid', s.isActive) });

  /* ---------- statement ---------- */
  const st = $('.st-txt');
  if (st) {
    const words = SplitText.create(st, { type: 'words', wordsClass: 'w' }).words;
    if (reduce) gsap.set(words, { opacity: 1 });
    else gsap.to(words, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: st, start: 'top 82%', end: 'bottom 48%', scrub: true } });
  }
  $$('.facts dd').forEach(dd => {
    const raw = dd.textContent.trim(), m = raw.match(/^([\d,.]+)(.*)$/);
    if (!m || reduce) return;
    const num = parseFloat(m[1].replace(/,/g, '')), dec = (m[1].split('.')[1] || '').length, comma = m[1].includes(',');
    const o = { v: 0 };
    const out = () => { let s = o.v.toFixed(dec); if (comma) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); dd.textContent = s + m[2]; };
    out();
    gsap.to(o, { v: num, duration: 2.2, ease: 'expo.out', onUpdate: out, scrollTrigger: { trigger: dd, start: 'top 92%', once: true } });
  });

  /* ---------- reveal helpers ---------- */
  $$('[data-split]').forEach(el => {
    const lines = SplitText.create(el, { type: 'lines', mask: 'lines' }).lines;
    if (reduce) return;
    gsap.from(lines, { yPercent: 105, duration: 1.3, stagger: .09, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  $$('[data-fade]').forEach(el => {
    if (reduce) return;
    gsap.from(el, { opacity: 0, y: 30, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  /* ---------- approach: fly-through sequence ---------- */
  const ap = $('.ap');
  if (ap && C.approach) {
    const stage = $('.stage', ap);
    const as = makeStage(stage, { kPar: .016 });
    const A = C.approach;
    if (as) as.set({ tA: img(A[0].key, GSZ), dA: dep(A[0].key) }).then(() => { A.forEach(a => { as.load(img(a.key, GSZ)); as.load(dep(a.key)); }); });
    const caps = $$('.ap-cap', ap), bars = $$('.ap-steps b', ap);
    const n = A.length, hold = .16, tr = (1 - hold * n) / (n - 1);
    const clamp = x => Math.max(0, Math.min(1, x));
    const show = ops => {
      caps.forEach((c, j) => { const o = ops[j] || 0; c.style.opacity = o; c.style.transform = `translateY(${(1 - o) * 24}px)`; c.style.visibility = o > 0.01 ? 'visible' : 'hidden'; });
    };
    const apply = v => {
      bars.forEach((b, j) => b.style.transform = `scaleX(${clamp(v * n - j)})`);
      let t = 0;
      for (let i = 0; i < n; i++) {
        const h0 = t, he = t + hold; t = he;
        if (v <= he || i === n - 1) {
          if (as) { as.use({ tA: img(A[i].key, GSZ), dA: dep(A[i].key), tB: null, dB: null }); as.s.mode = 0; as.s.zA = 1 + clamp((v - h0) / hold) * .05; as.s.fA = flip(A[i].focus); as.s.oA = flip(A[i].focus); }
          const ops = []; ops[i] = 1; show(ops); return;
        }
        const ts = t, te = t + tr; t = te;
        if (v < te) {
          const lp = (v - ts) / tr;
          if (as) {
            as.use({ tA: img(A[i].key, GSZ), dA: dep(A[i].key), tB: img(A[i + 1].key, GSZ), dB: dep(A[i + 1].key) });
            as.s.mode = 2; as.s.p = lp; as.s.zA = 1.05; as.s.zB = 1; as.s.fA = flip(A[i].focus); as.s.fB = flip(A[i + 1].focus); as.s.oA = flip(A[i].focus); as.s.oB = flip(A[i + 1].focus);
          }
          const ops = []; ops[i] = 1 - clamp(lp * 2.2); ops[i + 1] = clamp(lp * 2.2 - 1.2); show(ops); return;
        }
      }
    };
    if (!reduce) ScrollTrigger.create({ trigger: ap, start: 'top top', end: `+=${n * 110}%`, pin: true, scrub: SCRUB, onUpdate: s => apply(s.progress) });
    else apply(0);
  }

  /* ---------- materials lens ---------- */
  const lb = $('.lens-box');
  if (lb && C.materials) {
    const lens = $('.lens', lb), hot = $('.hot', lb), items = $$('.mats li');
    const Z = 2.8; let active = 0, inside = false;
    const L = { x: C.materials[0].at[0], y: C.materials[0].at[1] };
    const draw = () => {
      const W = lb.clientWidth, H = lb.clientHeight, lw = lens.clientWidth;
      lens.style.transform = `translate(${L.x * W}px, ${L.y * H}px)`;
      lens.style.backgroundSize = `${W * Z}px ${H * Z}px`;
      lens.style.backgroundPosition = `${-(L.x * W * Z - lw / 2)}px ${-(L.y * H * Z - lw / 2)}px`;
    };
    const go = (x, y, d = .9) => gsap.to(L, { x, y, duration: d, ease: 'expo.out', overwrite: true, onUpdate: draw });
    const pick = i => {
      active = i; items.forEach((li, j) => li.classList.toggle('on', j === i));
      const [x, y] = C.materials[i].at; hot.style.left = x * 100 + '%'; hot.style.top = y * 100 + '%';
      if (!inside) go(x, y, 1.2);
    };
    lb.addEventListener('pointermove', e => { const r = lb.getBoundingClientRect(); inside = true; go((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, .5); hot.style.opacity = 0; });
    lb.addEventListener('pointerleave', () => { inside = false; hot.style.opacity = 1; pick(active); });
    items.forEach((li, i) => { const b = $('button', li); b.addEventListener('pointerenter', () => pick(i)); b.addEventListener('click', () => pick(i)); b.addEventListener('focus', () => pick(i)); });
    addEventListener('resize', draw);
    pick(0); draw();
    let cyc = null;
    ScrollTrigger.create({ trigger: lb, start: 'top 75%', end: 'bottom 20%',
      onToggle: s => { clearInterval(cyc); if (s.isActive && (touch || CAPTURE)) cyc = setInterval(() => pick((active + 1) % items.length), CAPTURE ? 1600 : 2600); } });
  }

  $$('.mt-duo .ph img').forEach(im => { if (!reduce) gsap.fromTo(im, { yPercent: -7, scale: 1.16 }, { yPercent: 7, scale: 1.16, ease: 'none', scrollTrigger: { trigger: im.closest('figure'), start: 'top bottom', end: 'bottom top', scrub: true } }); });

  /* ---------- rooms: horizontal ---------- */
  const hz = $('.hz');
  if (hz && !reduce) {
    const trackEl = $('.hz-track', hz);
    const dist = () => trackEl.scrollWidth - innerWidth;
    const tw = gsap.to(trackEl, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: hz, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: SCRUB, invalidateOnRefresh: true } });
    $$('.hz-card', hz).forEach(card => {
      gsap.fromTo($('img', card), { xPercent: 7 }, { xPercent: -7, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } });
      gsap.from(card, { clipPath: 'inset(0 0 0 100%)', duration: 1, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tw, start: 'left 98%', end: 'left 55%', scrub: true } });
    });
  }

  /* ---------- outdoor cinemagraph ---------- */
  const od = $('.od');
  if (od && C.outdoor) {
    const stage = $('.stage', od);
    const os = makeStage(stage, { kPar: .018, vig: .7 });
    if (os) { os.set({ tA: img(C.outdoor.key, GSZ), dA: dep(C.outdoor.key), tM: `${C.base}/${C.outdoor.key}-mask.png` }); os.s.mode = 0; os.s.maskMode = C.outdoor.effect === 'wind' ? 1 : 0; os.s.fA = flip(C.outdoor.focus || [.5, .5]); os.s.oA = flip(C.outdoor.focus || [.5, .5]); }
    if (os && !reduce) gsap.fromTo(os.s, { zA: 1.18 }, { zA: 1, ease: 'none', scrollTrigger: { trigger: od, start: 'top bottom', end: 'bottom top', scrub: true } });
    const h = $('.od-txt h2', od);
    if (h && !reduce) {
      const ch = SplitText.create(h, { type: 'chars', mask: 'chars' }).chars;
      gsap.from(ch, { yPercent: 110, stagger: .035, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: od, start: 'top 45%' } });
      gsap.from('.od-txt p', { opacity: 0, y: 20, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: od, start: 'top 35%' } });
    }
  }

  /* ---------- site plan ---------- */
  const sp = $('.sp-fig');
  if (sp) {
    const tl = gsap.timeline({ paused: true });
    const mp = $('.bd-mask', sp);
    if (mp) { const L = mp.getTotalLength(); gsap.set(mp, { strokeDasharray: L, strokeDashoffset: L }); tl.to(mp, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut' }, 0); }
    $$('.pin-g', sp).forEach((g, i) => {
      const line = $('line', g), dot = $('circle', g), lab = $$('.sp-lab', sp)[i];
      const len = Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value, line.y2.baseVal.value - line.y1.baseVal.value);
      gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
      tl.from(dot, { scale: 0, transformOrigin: '50% 50%', duration: .6, ease: 'back.out(3)' }, .6 + i * .16)
        .to(line, { strokeDashoffset: 0, duration: .6, ease: 'power2.out' }, '<.1')
        .from(lab, { opacity: 0, x: lab.classList.contains('l') ? 16 : -16, duration: .8, ease: 'expo.out' }, '<.3');
    });
    if ($('.sp-north', sp)) tl.from($('.sp-north', sp), { rotate: -90, opacity: 0, duration: 1.4, ease: 'expo.out' }, .4);
    gsap.from($('img', sp), { scale: 1.08, duration: 2.4, ease: 'expo.out', scrollTrigger: { trigger: sp, start: 'top 75%' } });
    ScrollTrigger.create({ trigger: sp, start: 'top 60%', once: true, onEnter: () => tl.play() });
    if (reduce) tl.progress(1);
  }


  /* ---------- compare slider ---------- */
  $$('.cmp').forEach(el => {
    const set = x => el.style.setProperty('--x', (x * 100).toFixed(2) + '%');
    const at = e => { const r = el.getBoundingClientRect(); set(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); };
    let down = false;
    el.addEventListener('pointerdown', e => { down = true; at(e); el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (down || !touch) at(e); });
    el.addEventListener('pointerup', () => down = false);
    const o = { x: .12 };
    set(o.x);
    if (!reduce) gsap.to(o, { x: .82, ease: 'none', onUpdate: () => set(o.x), scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 30%', scrub: true } });
  });

  /* ---------- 360 tour ---------- */
  const tourEl = $('.tour');
  if (tourEl && C.tour && window.TovizyTour) {
    const T = C.tour, view = $('.tour-view', tourEl), room = $('.tour-room', tourEl);
    const map = $('.tour-map svg', tourEl), list = $$('.tour-list button', tourEl);
    const pts = T.points.map(p => Object.assign({}, p, { src: p.src }));
    let tour = null;
    try { tour = new TovizyTour(view, { points: pts, eye: 5.33, onChange: p => {
        if (room) room.textContent = p.name;
        $$('.pt', map).forEach(c => c.classList.toggle('on', c.dataset.id === p.id));
        list.forEach(b => b.classList.toggle('on', b.dataset.id === p.id));
        const pt = pts.find(q => q.id === p.id); cone.style.display = pt.mx == null ? 'none' : '';
      }, onView: yaw => {
        const p = tour.cur; if (!p || p.mx == null) return;
        cone.setAttribute('transform', `translate(${p.mx} ${p.my}) rotate(${yaw * 180 / Math.PI})`);
      } }); } catch (e) { console.warn('[tour]', e.message); }
    const cone = map ? map.querySelector('.cone') : null;
    if (tour) {
      $$('.pt', map).forEach(c => c.addEventListener('click', () => tour.go(c.dataset.id)));
      list.forEach(b => b.addEventListener('click', () => tour.go(b.dataset.id)));
      let vis = false, started = false, last = performance.now();
      new IntersectionObserver(e => { vis = e[0].isIntersecting; if (vis && !started) { started = true; tour.go(T.start); } }, { rootMargin: '200px' }).observe(tourEl);
      gsap.ticker.add(() => { const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; if (vis) tour.frame(dt, true); });
      window.__tour = tour;
    }
  }

  /* ---------- gallery + lightbox ---------- */
  const figs = $$('.gl-grid figure');
  figs.forEach(f => {
    if (reduce) return;
    gsap.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: f, start: 'top 90%' } });
    gsap.fromTo($('img', f), { scale: 1.3 }, { scale: 1, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: f, start: 'top 90%' } });
  });
  const lbx = $('.lb');
  const shots = $$('[data-full]');
  let li = 0;
  const openLb = i => { li = (i + shots.length) % shots.length; const s = shots[li]; $('img', lbx).src = s.dataset.full; $('.lb-c', lbx).textContent = s.dataset.cap || ''; lbx.classList.add('on'); lock(true);
    gsap.fromTo($('img', lbx), { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .8, ease: 'expo.out' }); };
  const closeLb = () => { lbx.classList.remove('on'); lock(false); };
  shots.forEach((s, i) => s.addEventListener('click', () => openLb(i)));
  if (lbx) {
    $('.lb-x', lbx).addEventListener('click', closeLb);
    $('.lb-p', lbx).addEventListener('click', () => openLb(li - 1));
    $('.lb-n', lbx).addEventListener('click', () => openLb(li + 1));
    addEventListener('keydown', e => { if (!lbx.classList.contains('on')) return; if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') openLb(li - 1); if (e.key === 'ArrowRight') openLb(li + 1); });
  }

  /* ---------- enquire modal ---------- */
  const md = $('.md');
  $$('[data-enquire]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); md.classList.add('on'); gsap.from('.md-in', { y: 40, opacity: 0, duration: .8, ease: 'expo.out' }); }));
  if (md) { md.addEventListener('click', e => { if (e.target === md || e.target.closest('.md-x')) md.classList.remove('on'); }); }

  /* ---------- enquire background drift + next ---------- */
  const eqb = $('.eq-bg img');
  if (eqb && !reduce) gsap.fromTo(eqb, { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.eq', start: 'top bottom', end: 'bottom top', scrub: true } });
  $$('a[data-veil]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey) return; e.preventDefault();
    gsap.to('.veil', { y: '0%', duration: .9, ease: 'expo.inOut', onComplete: () => location.href = a.href });
  }));
  gsap.fromTo('.veil', { y: '0%' }, { y: '-100%', duration: 1, ease: 'expo.inOut', delay: .05 });

  /* ---------- anchors through lenis ---------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = $(a.getAttribute('href')); if (!t) return; e.preventDefault();
    lenis ? lenis.scrollTo(t, { duration: 2.2, easing: x => 1 - Math.pow(1 - x, 4) }) : t.scrollIntoView({ behavior: 'smooth' });
  }));

  window.addEventListener('load', () => ScrollTrigger.refresh());
  }
})();
