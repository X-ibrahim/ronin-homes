// Ported near-verbatim from the original store/index.html's inline WebGL
// fluid-distortion effect (Navier-Stokes style: advection, curl + vorticity
// confinement for the swirl, pressure projection, splat-on-pointer-move) that
// drives a velocity field used as a UV displacement map over a texture of the
// hero heading, so the fluid motion tears/smudges the letters apart on hover.
// The real <h1> stays in the DOM (transparent) for SEO/accessibility/layout;
// the canvas draws and distorts a copy of it.
//
// Kept as plain JS (not TS) since it's a near-1:1 port of the original vanilla
// script — see hero-fluid.tsx for the typed React wrapper that calls this.
//
// Returns a destroy() cleanup function, or undefined if the effect never set
// up (reduced-motion preference, WebGL unavailable, etc).
export function initHeroFluid(heroEl) {

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    var canvas = document.createElement('canvas');
    canvas.className = 'hero-fluid';
    heroEl.appendChild(canvas);

    var isSmall = window.matchMedia('(max-width:700px)').matches;
    var config = {
      SIM_RESOLUTION: isSmall ? 96 : 128,
      DYE_RESOLUTION: isSmall ? 384 : 640,
      DENSITY_DISSIPATION: 2.6,
      VELOCITY_DISSIPATION: 3.4,
      PRESSURE: 0.8,
      PRESSURE_ITERATIONS: 16,
      CURL: 16,
      SPLAT_RADIUS: 0.0022,
      SPLAT_FORCE: 6500,
      DISTORTION: 0.0014,
      COLOR: [10/255, 51/255, 10/255]
    };

    var gl, ext;
    (function getContext(){
      var params = {alpha:true, depth:false, stencil:false, antialias:false, preserveDrawingBuffer:false};
      gl = canvas.getContext('webgl2', params);
      var isWebGL2 = !!gl;
      if (!isWebGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
      if (!gl) return;
      var halfFloat, supportLinearFiltering;
      if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float');
        supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
      } else {
        halfFloat = gl.getExtension('OES_texture_half_float');
        supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
      }
      gl.clearColor(0,0,0,0);
      var halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);
      var formatRGBA, formatRG, formatR;
      if (isWebGL2) {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
      } else {
        formatRGBA = {internalFormat: gl.RGBA, format: gl.RGBA};
        formatRG = {internalFormat: gl.RGBA, format: gl.RGBA};
        formatR = {internalFormat: gl.RGBA, format: gl.RGBA};
      }
      ext = {formatRGBA:formatRGBA, formatRG:formatRG, formatR:formatR, halfFloatTexType:halfFloatTexType, supportLinearFiltering: !!supportLinearFiltering};
    })();
    if (!gl || !ext || !ext.formatRGBA) { canvas.remove(); return undefined; }

    function supportRenderTextureFormat(gl, internalFormat, format, type){
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      return status === gl.FRAMEBUFFER_COMPLETE;
    }
    function getSupportedFormat(gl, internalFormat, format, type){
      if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        if (internalFormat === gl.R16F) return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
        if (internalFormat === gl.RG16F) return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
        return null;
      }
      return {internalFormat:internalFormat, format:format};
    }

    var baseVertexSource =
      'precision highp float;\nattribute vec2 aPosition;\nvarying vec2 vUv;\nvarying vec2 vL;\nvarying vec2 vR;\nvarying vec2 vT;\nvarying vec2 vB;\nuniform vec2 texelSize;\nvoid main () {\n  vUv = aPosition * 0.5 + 0.5;\n  vL = vUv - vec2(texelSize.x, 0.0);\n  vR = vUv + vec2(texelSize.x, 0.0);\n  vT = vUv + vec2(0.0, texelSize.y);\n  vB = vUv - vec2(0.0, texelSize.y);\n  gl_Position = vec4(aPosition, 0.0, 1.0);\n}';

    var clearShaderSource =
      'precision mediump float;\nprecision mediump sampler2D;\nvarying highp vec2 vUv;\nuniform sampler2D uTexture;\nuniform float value;\nvoid main () {\n  gl_FragColor = value * texture2D(uTexture, vUv);\n}';

    var displayShaderSource =
      'precision highp float;\nprecision highp sampler2D;\nvarying vec2 vUv;\nuniform sampler2D uDye;\nuniform sampler2D uText;\nuniform sampler2D uVelocity;\nuniform float distortion;\nvoid main () {\n  vec2 vel = texture2D(uVelocity, vUv).xy;\n  vec2 duv = vUv - vel * distortion;\n  vec4 dye = texture2D(uDye, vUv);\n  vec4 txt = texture2D(uText, duv);\n  float dyeAlpha = clamp(max(max(dye.r, dye.g), dye.b) * 1.4, 0.0, 1.0);\n  vec3 color = mix(dye.rgb, txt.rgb, txt.a);\n  float a = max(dyeAlpha * 0.55, txt.a);\n  gl_FragColor = vec4(color, a);\n}';

    var splatShaderSource =
      'precision highp float;\nvarying vec2 vUv;\nuniform sampler2D uTarget;\nuniform float aspectRatio;\nuniform vec3 color;\nuniform vec2 point;\nuniform float radius;\nvoid main () {\n  vec2 p = vUv - point.xy;\n  p.x *= aspectRatio;\n  vec3 splat = exp(-dot(p, p) / radius) * color;\n  vec3 base = texture2D(uTarget, vUv).xyz;\n  gl_FragColor = vec4(base + splat, 1.0);\n}';

    var advectionShaderSource =
      'precision highp float;\nprecision highp sampler2D;\nvarying vec2 vUv;\nuniform sampler2D uVelocity;\nuniform sampler2D uSource;\nuniform vec2 texelSize;\nuniform vec2 dyeTexelSize;\nuniform float dt;\nuniform float dissipation;\nvec4 bilerp (sampler2D tex, vec2 uv, vec2 tsize) {\n  vec2 st = uv / tsize - 0.5;\n  vec2 iuv = floor(st);\n  vec2 fuv = fract(st);\n  vec4 a = texture2D(tex, (iuv + vec2(0.5, 0.5)) * tsize);\n  vec4 b = texture2D(tex, (iuv + vec2(1.5, 0.5)) * tsize);\n  vec4 c = texture2D(tex, (iuv + vec2(0.5, 1.5)) * tsize);\n  vec4 d = texture2D(tex, (iuv + vec2(1.5, 1.5)) * tsize);\n  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);\n}\nvoid main () {\n  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;\n  vec4 result = bilerp(uSource, coord, dyeTexelSize);\n  float decay = 1.0 + dissipation * dt;\n  gl_FragColor = result / decay;\n}';

    var divergenceShaderSource =
      'precision mediump float;\nprecision mediump sampler2D;\nvarying highp vec2 vUv;\nvarying highp vec2 vL;\nvarying highp vec2 vR;\nvarying highp vec2 vT;\nvarying highp vec2 vB;\nuniform sampler2D uVelocity;\nvoid main () {\n  float L = texture2D(uVelocity, vL).x;\n  float R = texture2D(uVelocity, vR).x;\n  float T = texture2D(uVelocity, vT).y;\n  float B = texture2D(uVelocity, vB).y;\n  vec2 C = texture2D(uVelocity, vUv).xy;\n  if (vL.x < 0.0) { L = -C.x; }\n  if (vR.x > 1.0) { R = -C.x; }\n  if (vT.y > 1.0) { T = -C.y; }\n  if (vB.y < 0.0) { B = -C.y; }\n  float div = 0.5 * (R - L + T - B);\n  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);\n}';

    var curlShaderSource =
      'precision mediump float;\nprecision mediump sampler2D;\nvarying highp vec2 vUv;\nvarying highp vec2 vL;\nvarying highp vec2 vR;\nvarying highp vec2 vT;\nvarying highp vec2 vB;\nuniform sampler2D uVelocity;\nvoid main () {\n  float L = texture2D(uVelocity, vL).y;\n  float R = texture2D(uVelocity, vR).y;\n  float T = texture2D(uVelocity, vT).x;\n  float B = texture2D(uVelocity, vB).x;\n  float vorticity = R - L - T + B;\n  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);\n}';

    var vorticityShaderSource =
      'precision highp float;\nprecision highp sampler2D;\nvarying vec2 vUv;\nvarying vec2 vL;\nvarying vec2 vR;\nvarying vec2 vT;\nvarying vec2 vB;\nuniform sampler2D uVelocity;\nuniform sampler2D uCurl;\nuniform float curl;\nuniform float dt;\nvoid main () {\n  float L = texture2D(uCurl, vL).x;\n  float R = texture2D(uCurl, vR).x;\n  float T = texture2D(uCurl, vT).x;\n  float B = texture2D(uCurl, vB).x;\n  float C = texture2D(uCurl, vUv).x;\n  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));\n  force /= length(force) + 0.0001;\n  force *= curl * C;\n  force.y *= -1.0;\n  vec2 vel = texture2D(uVelocity, vUv).xy;\n  gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);\n}';

    var pressureShaderSource =
      'precision mediump float;\nprecision mediump sampler2D;\nvarying highp vec2 vUv;\nvarying highp vec2 vL;\nvarying highp vec2 vR;\nvarying highp vec2 vT;\nvarying highp vec2 vB;\nuniform sampler2D uPressure;\nuniform sampler2D uDivergence;\nvoid main () {\n  float L = texture2D(uPressure, vL).x;\n  float R = texture2D(uPressure, vR).x;\n  float T = texture2D(uPressure, vT).x;\n  float B = texture2D(uPressure, vB).x;\n  float divergence = texture2D(uDivergence, vUv).x;\n  float pressure = (L + R + B + T - divergence) * 0.25;\n  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);\n}';

    var gradientSubtractShaderSource =
      'precision mediump float;\nprecision mediump sampler2D;\nvarying highp vec2 vUv;\nvarying highp vec2 vL;\nvarying highp vec2 vR;\nvarying highp vec2 vT;\nvarying highp vec2 vB;\nuniform sampler2D uPressure;\nuniform sampler2D uVelocity;\nvoid main () {\n  float L = texture2D(uPressure, vL).x;\n  float R = texture2D(uPressure, vR).x;\n  float T = texture2D(uPressure, vT).x;\n  float B = texture2D(uPressure, vB).x;\n  vec2 velocity = texture2D(uVelocity, vUv).xy;\n  velocity -= vec2(R - L, T - B);\n  gl_FragColor = vec4(velocity, 0.0, 1.0);\n}';

    function compileShader(type, source){
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
      return shader;
    }
    function createProgram(vertexSource, fragmentSource){
      var program = gl.createProgram();
      gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(program));
      var uniforms = {};
      var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (var i=0;i<count;i++){
        var name = gl.getActiveUniform(program, i).name;
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      return {program:program, uniforms:uniforms};
    }

    var clearProgram = createProgram(baseVertexSource, clearShaderSource);
    var displayProgram = createProgram(baseVertexSource, displayShaderSource);
    var splatProgram = createProgram(baseVertexSource, splatShaderSource);
    var advectionProgram = createProgram(baseVertexSource, advectionShaderSource);
    var divergenceProgram = createProgram(baseVertexSource, divergenceShaderSource);
    var curlProgram = createProgram(baseVertexSource, curlShaderSource);
    var vorticityProgram = createProgram(baseVertexSource, vorticityShaderSource);
    var pressureProgram = createProgram(baseVertexSource, pressureShaderSource);
    var gradientSubtractProgram = createProgram(baseVertexSource, gradientSubtractShaderSource);

    var quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,-1]), gl.STATIC_DRAW);
    var elemBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    // --- text-as-texture: the real <h1> is drawn onto an offscreen 2D canvas
    // (so its glyphs can be resampled/distorted by the fluid velocity field
    // in the display shader) and hidden in place. Layout, sizing, responsive
    // breakpoints and accessibility all still come from the real DOM node —
    // only its paint is swapped for the WebGL-distorted copy.
    var heroTextEl = heroEl.querySelector('h1');
    var textTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    var textCanvas = document.createElement('canvas');
    var textCanvasSize = {w:0, h:0};
    function buildTextTexture(){
      if (!heroTextEl) return;
      var heroRect = heroEl.getBoundingClientRect();
      var textRect = heroTextEl.getBoundingClientRect();
      if (!heroRect.width || !heroRect.height) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.round(heroRect.width * dpr));
      var h = Math.max(1, Math.round(heroRect.height * dpr));
      textCanvas.width = w;
      textCanvas.height = h;
      textCanvasSize.w = w;
      textCanvasSize.h = h;
      var tctx = textCanvas.getContext('2d');
      tctx.clearRect(0, 0, w, h);
      var cs = getComputedStyle(heroTextEl);
      var fontSize = parseFloat(cs.fontSize) * dpr;
      var lineHeight = parseFloat(cs.lineHeight);
      if (!lineHeight || isNaN(lineHeight)) lineHeight = fontSize * 0.9;
      else lineHeight *= dpr;
      tctx.font = (cs.fontWeight || '900') + ' ' + fontSize + 'px ' + cs.fontFamily;
      tctx.fillStyle = heroTextColor;
      tctx.textAlign = 'center';
      tctx.textBaseline = 'middle';
      if ('letterSpacing' in tctx) { try { tctx.letterSpacing = cs.letterSpacing; } catch(e){} }
      var upper = cs.textTransform === 'uppercase';
      var lines = (heroTextEl.innerText || heroTextEl.textContent || '').split('\n');
      var originX = (textRect.left - heroRect.left + textRect.width / 2) * dpr;
      var startY = (textRect.top - heroRect.top) * dpr + lineHeight / 2;
      for (var i=0;i<lines.length;i++){
        var line = upper ? lines[i].toUpperCase() : lines[i];
        tctx.fillText(line, originX, startY + lineHeight * i);
      }
      gl.bindTexture(gl.TEXTURE_2D, textTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    }

    var heroTextColor = '#ffee00';
    if (heroTextEl) {
      var computedColor = getComputedStyle(heroTextEl).color;
      if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') heroTextColor = computedColor;
      heroTextEl.style.color = 'transparent';
    }

    function blit(target){
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function createFBO(w, h, internalFormat, format, type, param){
      gl.activeTexture(gl.TEXTURE0);
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        texture:texture, fbo:fbo, width:w, height:h,
        texelSizeX: 1/w, texelSizeY: 1/h,
        attach: function(id){ gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; }
      };
    }
    function createDoubleFBO(w, h, internalFormat, format, type, param){
      var fbo1 = createFBO(w, h, internalFormat, format, type, param);
      var fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width:w, height:h, texelSizeX:fbo1.texelSizeX, texelSizeY:fbo1.texelSizeY,
        get read(){ return fbo1; }, set read(v){ fbo1 = v; },
        get write(){ return fbo2; }, set write(v){ fbo2 = v; },
        swap: function(){ var t = fbo1; fbo1 = fbo2; fbo2 = t; }
      };
    }
    function getResolution(resolution){
      var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1 / aspectRatio;
      var min = Math.round(resolution);
      var max = Math.round(resolution * aspectRatio);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight) return {width:max, height:min};
      return {width:min, height:max};
    }

    var dye, velocity, divergence, curl, pressure;
    function initFramebuffers(){
      var simRes = getResolution(config.SIM_RESOLUTION);
      var dyeRes = getResolution(config.DYE_RESOLUTION);
      var texType = ext.halfFloatTexType;
      var rgba = ext.formatRGBA, rg = ext.formatRG, r = ext.formatR;
      var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);
      dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
      velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
      divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    }

    function resizeCanvas(){
      var rect = heroEl.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.round(rect.width * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
      return false;
    }

    var pointer = {x:0.5, y:0.5, dx:0, dy:0, moved:false};
    function updatePointer(clientX, clientY){
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = (clientX - rect.left) / rect.width;
      var y = 1 - (clientY - rect.top) / rect.height;
      pointer.dx = (x - pointer.x) * 6;
      pointer.dy = (y - pointer.y) * 6;
      pointer.x = x;
      pointer.y = y;
      pointer.moved = Math.abs(pointer.dx) > 0.0001 || Math.abs(pointer.dy) > 0.0001;
    }
    heroEl.addEventListener('pointermove', function(e){ updatePointer(e.clientX, e.clientY); }, {passive:true});
    heroEl.addEventListener('pointerdown', function(e){ updatePointer(e.clientX, e.clientY); pointer.moved = true; }, {passive:true});

    function splat(x, y, dx, dy, color){
      gl.useProgram(splatProgram.program);
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
      gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS);
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color[0], color[1], color[2]);
      blit(dye.write);
      dye.swap();
    }
    function splatFromPointer(p){
      splat(p.x, p.y, p.dx * config.SPLAT_FORCE, p.dy * config.SPLAT_FORCE, config.COLOR);
    }

    function step(dt){
      gl.disable(gl.BLEND);

      gl.useProgram(curlProgram.program);
      gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl);

      gl.useProgram(vorticityProgram.program);
      gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      gl.useProgram(divergenceProgram.program);
      gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence);

      gl.useProgram(clearProgram.program);
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
      blit(pressure.write);
      pressure.swap();

      gl.useProgram(pressureProgram.program);
      gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (var i=0;i<config.PRESSURE_ITERATIONS;i++){
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }

      gl.useProgram(gradientSubtractProgram.program);
      gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      gl.useProgram(advectionProgram.program);
      gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read.attach(0));
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
      blit(dye.write);
      dye.swap();
    }

    function renderToScreen(){
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(displayProgram.program);
      gl.uniform1i(displayProgram.uniforms.uDye, dye.read.attach(0));
      gl.uniform1i(displayProgram.uniforms.uText, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textTexture);
      gl.uniform1i(displayProgram.uniforms.uVelocity, velocity.read.attach(2));
      gl.uniform1f(displayProgram.uniforms.distortion, config.DISTORTION);
      blit(null);
    }

    var lastTime = Date.now();
    var animationFrame = null;
    function updateFrame(){
      var now = Date.now();
      var dt = Math.min((now - lastTime) / 1000, 0.02);
      lastTime = now;
      if (resizeCanvas()) { initFramebuffers(); buildTextTexture(); }
      if (pointer.moved) { splatFromPointer(pointer); pointer.moved = false; }
      step(dt);
      renderToScreen();
      animationFrame = requestAnimationFrame(updateFrame);
    }
    function start(){ if (animationFrame) return; lastTime = Date.now(); animationFrame = requestAnimationFrame(updateFrame); }
    function stop(){ if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; }

    resizeCanvas();
    initFramebuffers();
    buildTextTexture();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildTextTexture);

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){ if (entry.isIntersecting) start(); else stop(); });
      }, {threshold:0.05});
      io.observe(heroEl);
    } else {
      start();
    }
    function visHandler(){ if (document.hidden) stop(); else start(); }
    document.addEventListener('visibilitychange', visHandler);

    return function destroy(){
      stop();
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', visHandler);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (heroTextEl) heroTextEl.style.color = '';
    };
  
}
