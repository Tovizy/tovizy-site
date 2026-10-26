/* Tovizy Showcase — WebGL image stage.
   One full-screen quad, one shader with four modes:
   0 still   : depth parallax + animated masks (water ripple, wind, drifting sky)
   1 light   : day -> evening, pixels whose light rises (windows) switch first
   2 through : fly-through cut, zoom into a point of A and land on a point of B
   3 develop : pencil drawing -> photograph, revealed near-to-far with a warm edge
*/
(function () {
  const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
  const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, tB, dA, dB, tM;
uniform float aA, aB, aC, p, time, zA, zB, kPar, hasM, maskMode, grain, vig;
uniform vec2 mouse, fA, fB, res, oA, oB;
uniform int mode;

float hash(vec2 q){ return fract(sin(dot(q, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 q){ vec2 i=floor(q), f=fract(q); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 q){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(q); q*=2.03; a*=.5; } return v; }
vec2 cover(vec2 uv, float ia, vec2 o){ vec2 s = aC > ia ? vec2(1., ia/aC) : vec2(aC/ia, 1.); return (uv-.5)*s + .5 + (o-.5)*(1.-s); }
vec2 zoomAt(vec2 uv, vec2 f, float z){ return f + (uv-f)/z; }
vec2 par(sampler2D d, vec2 uv){
  float dd = texture2D(d, uv).r; vec2 o = mouse*(dd-.42)*kPar;
  dd = texture2D(d, uv+o).r; return uv + mouse*(dd-.42)*kPar;
}
float waterH(vec2 u){
  vec2 q = u*vec2(70.,210.);
  return sin(q.x*.8 + time*1.1 + sin(q.y*.11+time*.4)*1.5)*.5
       + sin(q.y*.55 - time*1.6 + q.x*.25)*.6
       + (fbm(q*.09 + vec2(time*.18, -time*.12)) - .5)*2.2;
}
vec3 still(vec2 u){
  vec3 c;
  if (hasM > .5) {
    vec3 m = texture2D(tM, u).rgb;
    vec2 off = vec2(0.);
    if (maskMode < .5) {            // water in R
      float w = m.r;
      float e = .0009;
      float h0 = waterH(u), hx = waterH(u+vec2(e,0.)), hy = waterH(u+vec2(0.,e));
      vec2 g = vec2(hx-h0, hy-h0)/e;
      off += g*.0000165*w;
      float spec = pow(max(0., dot(normalize(vec3(-g*.004,1.)), normalize(vec3(.2,.6,.8)))), 60.);
      c = texture2D(tA, u+off).rgb;
      c += vec3(1.,.93,.8)*spec*w*.35;
      c = mix(c, c*vec3(.97,1.02,1.03), w*.15*sin(time*.7+u.x*30.));
    } else {                        // wind in R
      float w = m.r;
      float gust = .55+.45*sin(time*.6 + u.x*3.);
      off.x += w*sin(time*1.7 + u.x*55. + fbm(u*9.+time*.35)*5.)*.0016*gust;
      off.y += w*cos(time*1.3 + u.x*40.)*.0005;
      c = texture2D(tA, u+off).rgb;
    }
    float s = m.g * smoothstep(.62, .78, u.y);          // sky drift, top part only
    if (s > .001) {
      vec2 su = u + vec2(time*.0022 + (fbm(u*3.+time*.02)-.5)*.004, 0.);
      c = mix(c, texture2D(tA, su).rgb, s);
    }
  } else c = texture2D(tA, u).rgb;
  return c;
}
void main(){
  vec3 col;
  if (mode == 0) {
    vec2 u = par(dA, zoomAt(cover(vUv,aA,oA), fA, zA));
    col = still(clamp(u, .001, .999));
  } else if (mode == 1) {
    vec2 ua = clamp(par(dA, zoomAt(cover(vUv,aA,oA), fA, zA)), .001, .999);
    vec2 ub = clamp(par(dB, zoomAt(cover(vUv,aB,oB), fB, zB)), .001, .999);
    vec3 ca = texture2D(tA, ua).rgb, cb = texture2D(tB, ub).rgb;
    float la = dot(ca, vec3(.299,.587,.114)), lb = dot(cb, vec3(.299,.587,.114));
    float key = clamp(.5 + (lb-la)*1.8, 0., 1.);
    float th = 1. - key + (fbm(vUv*3.2)-.5)*.35;
    float t = smoothstep(th-.18, th+.18, p*1.55-.2);
    col = mix(ca, cb, mix(t, p, .3));
  } else if (mode == 2) {
    float e = p;
    float z1 = 1. + e*e*2.4, z2 = 1.75 - .75*smoothstep(0.,1.,e);
    vec2 ua = par(dA, zoomAt(cover(vUv,aA,oA), fA, zA*z1));
    vec2 ub = par(dB, zoomAt(cover(vUv,aB,oB), fB, zB*z2));
    float bl = sin(e*3.14159)*.075;
    float jit = hash(vUv*res + fract(time*7.));
    vec3 ca = vec3(0.), cb = vec3(0.);
    for (int i=0;i<20;i++){ float k = (float(i)+jit)/20.;
      ca += texture2D(tA, clamp(zoomAt(ua, fA, 1.+bl*k), .001,.999)).rgb;
      cb += texture2D(tB, clamp(zoomAt(ub, fB, 1.+bl*k), .001,.999)).rgb; }
    ca /= 20.; cb /= 20.;
    float m = smoothstep(.36, .64, e + (fbm(vUv*2.5)-.5)*.12);
    col = mix(ca, cb, m) + vec3(1.,.9,.76)*pow(sin(e*3.14159), 8.)*.22;
  } else {
    vec2 u = clamp(par(dB, zoomAt(cover(vUv,aB,oB), fB, zB)), .001, .999);
    vec3 ln = texture2D(tA, u).rgb, ph = texture2D(tB, u).rgb;
    float d = texture2D(dB, u).r;
    float k = fbm(u*4.5)*.5 + (1.-d)*.5;
    float th = p*1.3 - .12;
    float t = smoothstep(k-.05, k+.05, th);
    float edge = clamp(1. - abs(th-k)/.07, 0., 1.) * (1.-smoothstep(.85, 1., p));
    col = mix(ln, ph, t) + vec3(1.,.72,.42)*edge*.28;
  }
  vec2 v = vUv-.5; col *= 1. - dot(v,v)*vig;
  col += (hash(vUv*res + fract(time)*91.)-.5)*grain;
  gl_FragColor = vec4(col, 1.);
}`;

  const cache = new Map();

  class Stage {
    constructor(canvas, opts = {}) {
      this.c = canvas;
      const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserve });
      if (!gl) throw new Error('no webgl');
      this.gl = gl;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr); gl.useProgram(pr); this.pr = pr;
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      ['tA', 'tB', 'dA', 'dB', 'tM', 'aA', 'aB', 'aC', 'p', 'time', 'zA', 'zB', 'kPar', 'hasM', 'maskMode', 'grain', 'vig', 'mouse', 'fA', 'fB', 'res', 'mode', 'oA', 'oB']
        .forEach(n => this.u[n] = gl.getUniformLocation(pr, n));
      ['tA', 'tB', 'dA', 'dB', 'tM'].forEach((n, i) => gl.uniform1i(this.u[n], i));
      this.tex = {}; this.texs = new Map(); this.ready = new Map();
      this.s = { mode: 0, p: 0, zA: 1, zB: 1, kPar: opts.kPar ?? .022, fA: [.5, .5], fB: [.5, .5], oA: [.5, .5], oB: [.5, .5], hasM: 0, maskMode: 0, grain: opts.grain ?? .022, vig: opts.vig ?? .55, aA: 16 / 9, aB: 16 / 9 };
      this.mouse = [0, 0]; this.mt = [0, 0];
      const blank = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blank);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
      this.blank = blank;
      this.resize();
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, window.__CAPTURE ? 3 : 2);
      const w = this.c.clientWidth, h = this.c.clientHeight;
      if (!w || !h) return;
      this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
      this.gl.viewport(0, 0, this.c.width, this.c.height);
    }
    load(url) {
      if (!url) return Promise.resolve(null);
      if (this.texs.has(url)) return this.texs.get(url);
      const gl = this.gl;
      const pr = (cache.get(url) || (() => { const q = new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = url; }); cache.set(url, q); return q; })())
        .then(im => {
          const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          t.aspect = im.naturalWidth / im.naturalHeight; this.ready.set(url, t); return t;
        });
      this.texs.set(url, pr); return pr;
    }
    use(slots) {        // synchronous: only preloaded urls
      for (const k in slots) { const t = this.ready.get(slots[k]); if (t) this.tex[k] = t; else if (slots[k] === null) this.tex[k] = null; }
      if (this.tex.tA) this.s.aA = this.tex.tA.aspect;
      if (this.tex.tB) this.s.aB = this.tex.tB.aspect;
      this.s.hasM = this.tex.tM ? 1 : 0;
    }
    async set(slots) {   // {tA,tB,dA,dB,tM}: urls
      const keys = Object.keys(slots);
      const ts = await Promise.all(keys.map(k => this.load(slots[k])));
      keys.forEach((k, i) => this.tex[k] = ts[i]);
      if (this.tex.tA) this.s.aA = this.tex.tA.aspect;
      if (this.tex.tB) this.s.aB = this.tex.tB.aspect;
      this.s.hasM = this.tex.tM ? 1 : 0;
    }
    render(t) {
      const gl = this.gl, u = this.u, s = this.s;
      this.mt[0] += (this.mouse[0] - this.mt[0]) * .06; this.mt[1] += (this.mouse[1] - this.mt[1]) * .06;
      ['tA', 'tB', 'dA', 'dB', 'tM'].forEach((n, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.tex[n] || (n === 'tB' ? this.tex.tA : n === 'dB' ? this.tex.dA : null) || this.blank); });
      gl.uniform1i(u.mode, s.mode);
      gl.uniform1f(u.p, s.p); gl.uniform1f(u.time, t); gl.uniform1f(u.zA, s.zA); gl.uniform1f(u.zB, s.zB);
      gl.uniform1f(u.kPar, s.kPar); gl.uniform1f(u.hasM, s.hasM); gl.uniform1f(u.maskMode, s.maskMode);
      gl.uniform1f(u.grain, s.grain); gl.uniform1f(u.vig, s.vig);
      gl.uniform1f(u.aA, s.aA); gl.uniform1f(u.aB, s.aB); gl.uniform1f(u.aC, this.c.width / this.c.height);
      gl.uniform2f(u.mouse, this.mt[0], this.mt[1]); gl.uniform2f(u.fA, s.fA[0], s.fA[1]); gl.uniform2f(u.fB, s.fB[0], s.fB[1]);
      gl.uniform2f(u.res, this.c.width, this.c.height); gl.uniform2f(u.oA, s.oA[0], s.oA[1]); gl.uniform2f(u.oB, s.oB[0], s.oB[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }
  window.TovizyStage = Stage;
})();
