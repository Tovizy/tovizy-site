/* Tovizy Showcase — 360 tour viewer (equirectangular, WebGL1).
   new TovizyTour(el, {points:[{id,name,src,x,y,yaw0}], start, plan:{el, toPct:(x,y)=>[px,py]}, eye:5.33})
   Point coordinates are in plan feet (x east, y north). yaw0 = world bearing (radians) of the panorama's centre column,
   measured like the plan: 0 = +Y (north/rear), +pi/2 = +X (east). */
(function () {
  const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv=p*.5+.5; gl_Position=vec4(p,0.,1.); }`;
  const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, tB;
uniform float yaw, pitch, fov, aspect, mixAB, offA, offB, blur;
const float PI = 3.14159265;
vec3 ray(vec2 uv){
  vec2 q = (uv*2.-1.); q.x *= aspect;
  float f = 1./tan(fov*.5);
  vec3 d = normalize(vec3(q.x, q.y, f));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y*cp + d.z*sp, -d.y*sp + d.z*cp);
  float cy = cos(yaw), sy = sin(yaw);
  return vec3(d.x*cy + d.z*sy, d.y, -d.x*sy + d.z*cy);
}
vec2 eq(vec3 d, float off){
  float lon = atan(d.x, d.z) - off;          // bearing, 0 = north
  float lat = asin(clamp(d.y, -1., 1.));
  return vec2(fract(lon/(2.*PI) + .5), lat/PI + .5);
}
void main(){
  vec3 d = ray(vUv);
  vec3 a = texture2D(tA, eq(d, offA)).rgb;
  vec3 c = a;
  if (mixAB > 0.001) { vec3 b = texture2D(tB, eq(d, offB)).rgb; c = mix(a, b, mixAB); }
  vec2 v = vUv-.5; c *= 1. - dot(v,v)*.35;
  gl_FragColor = vec4(c, 1.);
}`;
  class Tour {
    constructor(el, o) {
      this.el = el; this.o = o; this.pts = Object.fromEntries(o.points.map(p => [p.id, p]));
      const c = document.createElement('canvas'); el.prepend(c); this.c = c;
      const gl = c.getContext('webgl', { antialias: false, preserveDrawingBuffer: !!window.__CAPTURE }); this.gl = gl;
      const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
      this.u = {}; ['tA', 'tB', 'yaw', 'pitch', 'fov', 'aspect', 'mixAB', 'offA', 'offB'].forEach(n => this.u[n] = gl.getUniformLocation(pr, n));
      gl.uniform1i(this.u.tA, 0); gl.uniform1i(this.u.tB, 1);
      this.v = { yaw: 0, pitch: -0.05, fov: 1.55, mix: 0 }; this.tgt = { yaw: 0, pitch: -0.05, fov: 1.55 };
      this.tex = new Map(); this.cur = null; this.next = null; this.busy = false; this.idle = 0;
      this.hot = document.createElement('div'); this.hot.className = 'tour-hots'; el.appendChild(this.hot);
      this.resize(); addEventListener('resize', () => this.resize());
      this.bind();
    }
    resize() { const d = Math.min(devicePixelRatio || 1, window.__CAPTURE ? 3 : 2); this.c.width = this.c.clientWidth * d; this.c.height = this.c.clientHeight * d; this.gl.viewport(0, 0, this.c.width, this.c.height); }
    prune(keep) {        // free GPU memory: keep only the current point, the next one and their neighbours
      for (const [src, pr] of this.tex) { if (keep.has(src)) continue; pr.then(t => { if (t !== this.tA && t !== this.tB) this.gl.deleteTexture(t); }).catch(() => {}); this.tex.delete(src); }
    }
    preload(p) { const keep = new Set([p.src, ...(p.links || []).map(id => this.pts[id].src)]); if (this.cur) keep.add(this.cur.src); this.prune(keep); keep.forEach(s => this.load(s).catch(() => {})); }
    load(src) {
      if (this.tex.has(src)) return this.tex.get(src);
      const gl = this.gl;
      const p = new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = src; }).then(im => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t; });
      this.tex.set(src, p); return p;
    }
    bind() {
      const el = this.el; let drag = null;
      el.addEventListener('pointerdown', e => { if (e.target.closest('.tour-hot, .tour-ui')) return; drag = { x: e.clientX, y: e.clientY, yaw: this.tgt.yaw, pitch: this.tgt.pitch }; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
      el.addEventListener('pointermove', e => { if (!drag) return; const k = this.v.fov / el.clientHeight;
        this.tgt.yaw = drag.yaw - (e.clientX - drag.x) * k; this.tgt.pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * k)); this.idle = 0; });
      const up = () => { drag = null; el.classList.remove('drag'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      el.addEventListener('wheel', e => { if (!el.matches(':hover')) return; e.preventDefault(); this.tgt.fov = Math.max(.7, Math.min(1.9, this.tgt.fov * (1 + e.deltaY * .0012))); this.idle = 0; }, { passive: false });
    }
    bearing(a, b) { return Math.atan2(b.x - a.x, b.y - a.y); }           // 0 = +Y
    async go(id, opts = {}) {
      if (this.busy || (this.cur && this.cur.id === id)) return;
      const p = this.pts[id]; this.busy = true;
      const t = await this.load(p.src);
      if (!this.cur) { this.cur = p; this.tA = t; this.v.yaw = this.tgt.yaw = opts.yaw ?? (p.look ?? 0); this.busy = false; this.hots(); this.o.onChange && this.o.onChange(p); setTimeout(() => this.preload(p), 600); return; }
      // look toward the target, fly in, cross-fade
      const from = this.cur, dir = this.bearing(from, p);
      let dy = dir - this.v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.hot.style.opacity = 0;
      await gsap.to(this.tgt, { yaw: this.v.yaw + dy, pitch: -0.08, duration: Math.abs(dy) > .2 ? .7 : .3, ease: 'power2.inOut' });
      this.tB = t; this.next = p;
      await gsap.timeline()
        .to(this.tgt, { fov: Math.max(.7, this.v.fov * .62), duration: .9, ease: 'power2.in' }, 0)
        .to(this.v, { mix: 1, duration: .7, ease: 'power1.inOut' }, .3);
      this.tA = t; this.cur = p; this.next = null; this.v.mix = 0;
      this.v.fov = this.tgt.fov = 1.55; this.busy = false; this.hots(); this.hot.style.opacity = 1;
      this.o.onChange && this.o.onChange(p);
      setTimeout(() => this.preload(p), 600);
    }
    hots() {
      this.hot.innerHTML = '';
      (this.cur.links || []).forEach(id => {
        const q = this.pts[id]; const b = document.createElement('button'); b.type = 'button'; b.className = 'tour-hot';
        b.innerHTML = `<i></i><span>${q.name}</span>`; b.addEventListener('click', () => this.go(id)); b.dataset.id = id;
        const d = Math.hypot(q.x - this.cur.x, q.y - this.cur.y);
        b._yaw = this.bearing(this.cur, q); const dz = (q.z ?? 7.33) - (this.cur.z ?? 7.33);
        b._pitch = Math.abs(dz) > 10 ? Math.atan2(dz, Math.max(3, d)) : -Math.atan2(this.o.eye || 5.33, Math.max(3, d)) * .9;
        this.hot.appendChild(b);
      });
    }
    project(yaw, pitch) {   // world dir -> screen px (or null)
      const dyaw = Math.atan2(Math.sin(yaw - this.v.yaw), Math.cos(yaw - this.v.yaw));
      // direction in camera space
      const x = Math.sin(dyaw) * Math.cos(pitch), y = Math.sin(pitch), z = Math.cos(dyaw) * Math.cos(pitch);
      const cp = Math.cos(-this.v.pitch), sp = Math.sin(-this.v.pitch);
      const y2 = y * cp + z * sp, z2 = -y * sp + z * cp;
      if (z2 <= 0.05) return null;
      const f = 1 / Math.tan(this.v.fov / 2), asp = this.c.clientWidth / this.c.clientHeight;
      return [(x / z2 * f / asp * .5 + .5) * this.c.clientWidth, (-y2 / z2 * f * .5 + .5) * this.c.clientHeight];
    }
    frame(dt, auto) {
      if (!this.tA) return;
      this.idle += dt;
      if (auto && this.idle > 4 && !this.busy) this.tgt.yaw += dt * .05;
      const k = 1 - Math.pow(.0015, dt);
      this.v.yaw += (this.tgt.yaw - this.v.yaw) * k; this.v.pitch += (this.tgt.pitch - this.v.pitch) * k; this.v.fov += (this.tgt.fov - this.v.fov) * k;
      const gl = this.gl, u = this.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tA);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tB || this.tA);
      gl.uniform1f(u.yaw, this.v.yaw); gl.uniform1f(u.pitch, this.v.pitch); gl.uniform1f(u.fov, this.v.fov);
      gl.uniform1f(u.aspect, this.c.width / this.c.height); gl.uniform1f(u.mixAB, this.v.mix);
      gl.uniform1f(u.offA, this.cur ? this.cur.yaw0 || 0 : 0); gl.uniform1f(u.offB, this.next ? this.next.yaw0 || 0 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      Array.from(this.hot.children).forEach(b => { const s = this.project(b._yaw, b._pitch); if (!s) { b.style.visibility = 'hidden'; return; } b.style.visibility = 'visible'; b.style.transform = `translate(${s[0]}px, ${s[1]}px)`; });
      this.o.onView && this.o.onView(this.v.yaw);
    }
  }
  window.TovizyTour = Tour;
})();
