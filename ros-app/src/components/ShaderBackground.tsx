"use client";

import { useEffect, useRef } from "react";

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function syncSize() {
      const w = canvas!.clientWidth || 1280;
      const h = canvas!.clientHeight || 720;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
    }
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncSize) : null;
    resizeObserver?.observe(canvas);
    syncSize();

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    if (!gl) {
      resizeObserver?.disconnect();
      return;
    }
    const vs = `attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }`;
    const fs = `precision highp float;
  varying vec2 v_texCoord;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  
  // Warm Coffee/Amber palette
  const vec3 colorBg = vec3(0.07, 0.05, 0.04); // Deep roasted brown
  const vec3 colorMid = vec3(0.35, 0.22, 0.15); // Caramel/Roasted coffee
  const vec3 colorHighlight = vec3(0.83, 0.64, 0.45); // Warm Amber
  
  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }
  
  float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  #define OCTAVES 6
  float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 0.0;
      for (int i = 0; i < OCTAVES; i++) {
          value += amplitude * noise(st);
          st *= 2.0;
          amplitude *= 0.5;
      }
      return value;
  }
  
  void main() {
      vec2 uv = v_texCoord;
      vec2 mouse = u_mouse / u_resolution;
      
      // Slow, organic movement - like rising steam
      vec2 q = vec2(0.);
      q.x = fbm(uv + 0.05 * u_time);
      q.y = fbm(uv + vec2(1.0));
  
      vec2 r = vec2(0.);
      r.x = fbm(uv + 1.0 * q + vec2(1.7, 9.2) + 0.08 * u_time);
      r.y = fbm(uv + 1.0 * q + vec2(8.3, 2.8) + 0.06 * u_time);
  
      float f = fbm(uv + r);
  
      // Subtle color blending
      vec3 color = mix(colorBg, colorMid, clamp((f*f)*3.0, 0.0, 1.0));
      color = mix(color, colorHighlight, clamp(length(q), 0.0, 1.0) * 0.3);
      
      // Smooth glow based on noise intensity
      float glow = pow(f, 3.0) * 0.5;
      color += colorHighlight * glow;
  
      // Interactive mouse shadow/glow
      float dist = length(uv - mouse);
      float mGlow = smoothstep(0.5, 0.0, dist);
      color += colorHighlight * mGlow * 0.1;
  
      // Soft vignette
      float vignette = 1.0 - smoothstep(0.4, 1.4, length(uv - 0.5));
      color *= vignette;
  
      gl_FragColor = vec4(color, 1.0);
  }`;
    function cs(type: number, src: string) {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("[ShaderBackground]", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }
    const vertexShader = cs(gl.VERTEX_SHADER, vs);
    const fragmentShader = cs(gl.FRAGMENT_SHADER, fs);
    const prog = gl.createProgram();
    if (!vertexShader || !fragmentShader || !prog) {
      resizeObserver?.disconnect();
      return;
    }
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[ShaderBackground]", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      resizeObserver?.disconnect();
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_position');
    if (pos < 0) {
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      resizeObserver?.disconnect();
      return;
    }
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mouse.x = nx * canvas.width;
        mouse.y = ny * canvas.height;
      }
    };
    window.addEventListener('mousemove', onMouseMove);

    let animationFrameId: number;
    let isVisible = !document.hidden;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    function render(t: number) {
      if (typeof ResizeObserver === 'undefined') syncSize();
      if (isVisible) {
        gl.viewport(0, 0, canvas!.width, canvas!.height);
        if (uTime) gl.uniform1f(uTime, reducedMotion ? 0 : t * 0.001);
        if (uRes) gl.uniform2f(uRes, canvas!.width, canvas!.height);
        if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (!reducedMotion) animationFrameId = requestAnimationFrame(render);
    }
    render(0);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
