import {
  BufferGeometry,
  CatmullRomCurve3,
  DataTexture,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  WireframeGeometry,
  type Texture,
} from "three";

import { clamp, damp } from "@/lib/math";

import { BACKGROUND_FRAGMENT } from "./backgrounds/background";
import { BG_VERT, FIGURE_FRAG, FIGURE_VERT } from "./figure-shaders";
import { createIdleDirector } from "./reveal";

/** The cut-outs are 1672 x 941. */
const AR = 1672 / 941;
const FOV = 30;
/** The depth map is this many texels across and down (the shader reads the same numbers). */
const DEPTH_W = 192;
const DEPTH_H = 108;
/**
 * The picture is laid out larger than the screen and lower, so that none of its cut edges (the
 * bottom of the body is cut by the picture, and the top of the hair nearly is) can come into view
 * however far the head turns or slides. This much of its height hangs below the screen.
 */
const HANG = 0.075;
/** Where the head turns from, the neck, as a fraction of the picture's height from the middle. */
const PIVOT = -0.13;
/**
 * How strong the 3D is. The relief (how far the face stands out of the plane), the turn of the
 * neck and the slide were each about three times these values at first, and bent the face. The
 * turn is in radians at the edge of the screen, the slide is in fractions of the picture.
 */
const DEPTH_SCALE = 0.04;
const TURN_Y = 0.085;
const TURN_X = 0.055;
const ROLL = 0.004;
const SLIDE_X = 0.016;
const SLIDE_Y = 0.011;

export interface FigureGLOptions {
  normalUrl: string;
  enderUrl: string;
  /** `full` renders at up to 1.5 times the pixels and with the full noise; `balanced` less. */
  quality: "full" | "balanced";
}

export interface FigureGL {
  /** 0 daybreak to 1 ink. */
  setTone: (tone: number) => void;
  /** Render or not. The loop stops when it is off, so a hidden hero costs nothing. */
  setActive: (on: boolean) => void;
  /** Called when the Ender form starts or stops showing (a few times a minute, not per frame). */
  onForm: (cb: (ender: boolean) => void) => void;
  dispose: () => void;
}

function loadTexture(loader: TextureLoader, url: string, anisotropy: number): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (t) => {
        // Premultiplied, so the edges of the cut-out blend without a fringe.
        t.premultiplyAlpha = true;
        t.anisotropy = anisotropy;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

/**
 * Where the figure is solid, as a coarse grid read once from the two pictures. The cursor only
 * wakes the Ender form while it is over her, not over the empty corners of the picture.
 */
function bodyMask(images: readonly TexImageSource[]): (u: number, v: number) => boolean {
  const W = 160;
  const H = 90;
  const alpha = new Uint8Array(W * H);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return () => true;
  for (const img of images) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img as CanvasImageSource, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) alpha[i] = Math.max(alpha[i] ?? 0, data[i * 4 + 3] ?? 0);
  }
  return (u, v) => {
    // v is up; the grid is read from the top.
    const x = Math.floor(clamp(u, 0, 0.9999) * W);
    const y = Math.floor(clamp(1 - v, 0, 0.9999) * H);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if ((alpha[yy * W + xx] ?? 0) > 60) return true;
      }
    }
    return false;
  };
}

/**
 * A relief for the picture, made from its silhouette: the shape of the figure blurred wide gives a
 * soft body, and a bump around the face stands out of it, so the face is the nearest part, then
 * the hair and the chest, then the edges. Both forms share it (their outlines are the same).
 * Values are 0 to 1, one texel per `DEPTH_W` x `DEPTH_H`.
 */
function depthTexture(images: readonly TexImageSource[]): DataTexture {
  const W = DEPTH_W;
  const H = DEPTH_H;
  const alpha = new Float32Array(W * H);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) {
    for (const img of images) {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img as CanvasImageSource, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      for (let i = 0; i < W * H; i++) {
        alpha[i] = Math.max(alpha[i] ?? 0, (data[i * 4 + 3] ?? 0) / 255);
      }
    }
  }
  // Blur wide: a few box passes on each axis come close to a gaussian.
  const tmp = new Float32Array(W * H);
  const box = (src: Float32Array, dst: Float32Array, r: number, horizontal: boolean) => {
    const n = horizontal ? W : H;
    const lines = horizontal ? H : W;
    for (let l = 0; l < lines; l++) {
      let sum = 0;
      const at = (k: number) => {
        const c = Math.min(n - 1, Math.max(0, k));
        return src[horizontal ? l * W + c : c * W + l] ?? 0;
      };
      for (let k = -r; k <= r; k++) sum += at(k);
      for (let k = 0; k < n; k++) {
        dst[horizontal ? l * W + k : k * W + l] = sum / (2 * r + 1);
        sum += at(k + r + 1) - at(k - r);
      }
    }
  };
  for (let pass = 0; pass < 3; pass++) {
    box(alpha, tmp, 7, true);
    box(tmp, alpha, 7, false);
  }
  const out = new Uint8Array(W * H * 4);
  let max = 0;
  const raw = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const v = y / (H - 1); // from the top
      // The face: a bump above the middle of the picture, taller than wide.
      const dx = (u - 0.5) / 0.1;
      const dy = (v - 0.43) / 0.22;
      const face = Math.exp(-(dx * dx + dy * dy) * 0.9);
      const d = 0.4 * Math.min(1, (alpha[y * W + x] ?? 0) * 1.6) + 0.75 * face;
      raw[y * W + x] = d;
      max = Math.max(max, d);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The texture's first row is the bottom of the picture.
      const o = ((H - 1 - y) * W + x) * 4;
      const v = Math.round(((raw[y * W + x] ?? 0) / (max || 1)) * 255);
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  const tex = new DataTexture(out, W, H, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * One horn of the Ender crown as a wire drawing: the two edges of a tapering blade along a
 * curve, with a rib across every other step. Units: widths of the figure.
 */
function hornGeometry(side: 1 | -1): BufferGeometry {
  const y = (f: number) => f / AR;
  const curve = new CatmullRomCurve3([
    new Vector3(side * 0.108, y(0.2), 0),
    new Vector3(side * 0.112, y(0.33), 0),
    new Vector3(side * 0.092, y(0.43), 0),
    new Vector3(side * 0.056, y(0.495), 0),
  ]);
  const steps = 22;
  const pts: number[] = [];
  const edge = (a: Vector3, b: Vector3) => pts.push(a.x, a.y, 0, b.x, b.y, 0);
  let prevL: Vector3 | null = null;
  let prevR: Vector3 | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const half = 0.0165 * Math.pow(1 - t, 0.85) + 0.0015;
    const l = new Vector3(c.x - tan.y * half, c.y + tan.x * half, 0);
    const r = new Vector3(c.x + tan.y * half, c.y - tan.x * half, 0);
    if (prevL && prevR) {
      edge(prevL, l);
      edge(prevR, r);
    }
    if (i % 2 === 0) edge(l, r);
    prevL = l;
    prevR = r;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
  return geo;
}

export async function createFigureGL(
  canvas: HTMLCanvasElement,
  options: FigureGLOptions,
): Promise<FigureGL> {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x140e26, 1);
  const loader = new TextureLoader();
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  let texNormal: Texture;
  let texEnder: Texture;
  try {
    [texNormal, texEnder] = await Promise.all([
      loadTexture(loader, options.normalUrl, aniso),
      loadTexture(loader, options.enderUrl, aniso),
    ]);
  } catch (e) {
    renderer.dispose();
    throw e;
  }

  const depth = depthTexture([texNormal.image as TexImageSource, texEnder.image as TexImageSource]);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 10, 6000);
  // `figure` is where she stands on the screen. `pivot` is her neck: it is what turns.
  const figure = new Group();
  const pivot = new Group();
  figure.add(pivot);
  scene.add(figure);

  // The figure: a unit plane scaled to the size of the picture.
  const figureMat = new ShaderMaterial({
    vertexShader: FIGURE_VERT,
    fragmentShader: FIGURE_FRAG,
    uniforms: {
      uA: { value: texNormal },
      uB: { value: texEnder },
      uDepth: { value: depth },
      uDepthScale: { value: 1 },
      uTilt: { value: [0, 0] },
      uCur: { value: [0.5, 0.4, 0] },
      uCurR: { value: 0.19 },
      uIdle: { value: [0, 0, 0.5, 1] },
      uTime: { value: 0 },
      uAspect: { value: AR },
      uShine: { value: -1 },
      uFade: { value: 0 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  // Many small quads, so the relief in the vertex shader has something to bend.
  const plane = new Mesh(new PlaneGeometry(1, 1, 96, 54), figureMat);
  plane.renderOrder = 1;
  plane.frustumCulled = false;
  pivot.add(plane);

  // A faint wire cage around the head, and the two horns: the Ender crown, drawn in lines.
  const halo = new Group();
  const cageMat = new LineBasicMaterial({
    color: 0xb89cff,
    transparent: true,
    opacity: 0.12,
    depthTest: false,
    depthWrite: false,
  });
  const hornMat = new LineBasicMaterial({
    color: 0xff6ac8,
    transparent: true,
    opacity: 0.1,
    depthTest: false,
    depthWrite: false,
  });
  const cageGeo = new WireframeGeometry(new IcosahedronGeometry(0.205, 2));
  const cage = new LineSegments(cageGeo, cageMat);
  cage.position.set(0, 0.17 / AR, 0);
  const hornGeos = [hornGeometry(1), hornGeometry(-1)];
  const horns = hornGeos.map((g) => new LineSegments(g, hornMat));
  halo.add(cage, ...horns);
  for (const o of [cage, ...horns]) {
    o.renderOrder = 2;
    o.frustumCulled = false;
  }
  pivot.add(halo);

  // The background: one full-screen quad.
  const bgGeo = new PlaneGeometry(2, 2);
  const octaves = { value: options.quality === "full" ? 4 : 2 };
  const shared = {
    uTime: { value: 0 },
    uRes: { value: [1, 1] },
    uMouse: { value: [0.5, 0.5] },
    uTone: { value: 0 },
    uOct: octaves,
    uGlow: { value: [0.5, 0.6, 0] },
    uPan: { value: [0, 0] },
  };
  const bgMat = new ShaderMaterial({
    vertexShader: BG_VERT,
    fragmentShader: BACKGROUND_FRAGMENT,
    uniforms: { ...shared, uMix: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const bg = new Mesh(bgGeo, bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -2;
  scene.add(bg);

  // Layout -----------------------------------------------------------------------------------
  let w = 1;
  let h = 1;
  let figW = 1;
  let figH = 1;
  let baseY = 0;
  let pr = Math.min(window.devicePixelRatio || 1, options.quality === "full" ? 1.5 : 1);

  const layout = () => {
    const portrait = w / h < 0.85;
    figH = portrait ? Math.min(h * 0.62, (w * 2.4) / AR) : h;
    figW = figH * AR;
    // Her bottom edge hangs below the screen by `HANG` of her height.
    baseY = -h / 2 - figH * HANG + figH / 2;
    plane.scale.set(figW, figH, 1);
    plane.position.set(0, -PIVOT * figH, 0);
    pivot.position.set(0, PIVOT * figH, 0);
    halo.scale.setScalar(figW);
    halo.position.set(0, -PIVOT * figH, figW * 0.05);
    figureMat.uniforms.uDepthScale!.value = figW * DEPTH_SCALE;
    figure.position.set(0, baseY, 0);
  };
  const resize = () => {
    w = Math.max(1, canvas.clientWidth);
    h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = h / 2 / Math.tan((FOV / 2) * (Math.PI / 180));
    camera.updateProjectionMatrix();
    shared.uRes.value = [w, h];
    layout();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // Pointer ----------------------------------------------------------------------------------
  const onBody = bodyMask([texNormal.image as TexImageSource, texEnder.image as TexImageSource]);
  let tiltTx = 0;
  let tiltTy = 0;
  let tiltX = 0;
  let tiltY = 0;
  let curTx = 0.5;
  let curTy = 0.4;
  let curX = 0.5;
  let curY = 0.4;
  let curS = 0;
  let curTarget = 0;
  let speed = 0;
  let mouseX = 0.5;
  let mouseY = 0.5;

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2) return;
    const rx = (e.clientX - r.left) / r.width;
    const ry = (e.clientY - r.top) / r.height;
    tiltTx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
    tiltTy = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
    mouseX = clamp(rx, 0, 1);
    mouseY = clamp(1 - ry, 0, 1);
    const left = w / 2 - figW / 2 + figure.position.x;
    const top = h / 2 - figure.position.y - figH / 2;
    const ux = (rx * w - left) / figW;
    const uy = 1 - (ry * h - top) / figH;
    const inside =
      rx >= 0 &&
      rx <= 1 &&
      ry >= 0 &&
      ry <= 1 &&
      ux >= 0 &&
      ux <= 1 &&
      uy >= 0 &&
      uy <= 1 &&
      onBody(ux, uy);
    if (inside) {
      speed = Math.min(2, speed + Math.hypot(ux - curTx, uy - curTy) * 6);
      curTx = ux;
      curTy = uy;
    }
    curTarget = inside ? 1 : 0;
  };
  const onLeave = () => {
    curTarget = 0;
    tiltTx = 0;
    tiltTy = 0;
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") onLeave();
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);

  // Loop -------------------------------------------------------------------------------------
  const idle = createIdleDirector();
  let active = true;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let fade = 0;
  let showing = false;
  let formCb: ((ender: boolean) => void) | null = null;
  let slowFor = 0;
  let slowEma = 1 / 60;

  const u = figureMat.uniforms;

  // On a device that already runs at the middle level, half the frames are enough while nothing
  // moves but the slow background and the sway.
  let calm = false;
  const canRest = options.quality !== "full";

  const frame = (now: number) => {
    raf = 0;
    if (disposed || !active || document.hidden) return;
    if (canRest && calm && now - last < 30) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    // Cursor and tilt.
    curS = damp(curS, curTarget, curTarget > 0.5 ? 8 : 3.5, dt);
    curX = damp(curX, curTx, 9, dt);
    curY = damp(curY, curTy, 9, dt);
    speed = damp(speed, 0, 3, dt);
    tiltX = damp(tiltX, tiltTx, 4, dt);
    tiltY = damp(tiltY, tiltTy, 4, dt);

    const f = idle.step(dt, curS > 0.08);
    const reveal = Math.max(curS, f.env);
    calm =
      reveal < 0.01 &&
      curTarget === 0 &&
      Math.abs(tiltX - tiltTx) < 0.003 &&
      Math.abs(tiltY - tiltTy) < 0.003 &&
      fade >= 1;
    if (!showing && reveal > 0.4) {
      showing = true;
      formCb?.(true);
    } else if (showing && reveal < 0.15) {
      showing = false;
      formCb?.(false);
    }

    // With the pointer at rest she still drifts a little, as if she were breathing and looking
    // around. The pointer takes over as soon as it moves.
    const away = Math.min(1, Math.hypot(tiltX, tiltY) * 1.6);
    const driveX =
      tiltX +
      (Math.sin(time * 0.55) * 0.17 + Math.sin(time * 0.31 + 1.3) * 0.09) * (1 - away * 0.85);
    const driveY = tiltY + Math.cos(time * 0.43) * 0.08 * (1 - away * 0.85);

    // The whole of her moves like a body seen in depth: the neck turns toward the cursor, she
    // slides toward it, and the page behind her slides the other way. Her face, which is nearest,
    // moves most (the relief in the shader), so the turn reads as a real head and not a card.
    pivot.rotation.y = driveX * TURN_Y;
    pivot.rotation.x = driveY * TURN_X;
    pivot.rotation.z = -driveX * ROLL + Math.sin(time * 0.7) * 0.0015;
    figure.position.x = driveX * figW * SLIDE_X;
    figure.position.y = baseY - driveY * figH * SLIDE_Y + Math.sin(time * 0.9) * figH * 0.002;
    shared.uPan.value = [driveX * 0.03, -driveY * 0.02];
    halo.rotation.y += dt * 0.12;
    cageMat.opacity = 0.1 + 0.2 * reveal;
    hornMat.opacity = 0.08 + 0.62 * reveal;

    fade = Math.min(1, fade + dt / 0.9);
    u.uTilt!.value = [driveX, driveY];
    u.uCur!.value = [curX, curY, curS];
    u.uCurR!.value = 0.19 * (1 + Math.min(1, speed * 0.3));
    u.uIdle!.value = [f.shape, f.env, f.seed, f.amp];
    u.uTime!.value = time;
    u.uShine!.value = ((time * 0.5) % 3.2) - 0.9;
    u.uFade!.value = fade * fade * (3 - 2 * fade);

    shared.uTime.value = time;
    shared.uMouse.value = [
      damp(shared.uMouse.value[0]!, mouseX, 3, dt),
      damp(shared.uMouse.value[1]!, mouseY, 3, dt),
    ];
    shared.uGlow.value = [
      0.5 + figure.position.x / w,
      0.5 + (figure.position.y + 0.12 * figH) / h,
      reveal,
    ];

    renderer.render(scene, camera);

    // A device that cannot keep up gives up pixels first, then noise.
    slowEma = slowEma * 0.94 + dt * 0.06;
    if (time > 2 && slowEma > 1 / 38) {
      slowFor += dt;
      if (slowFor > 1.5) {
        slowFor = 0;
        if (pr > 1) {
          pr = 1;
          resize();
        } else if (octaves.value > 2) {
          octaves.value = 2;
        }
      }
    } else slowFor = 0;

    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (raf || disposed || !active || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", start);
  start();

  return {
    setTone(tone) {
      shared.uTone.value = tone;
    },
    setActive(on) {
      active = on;
      if (on) start();
    },
    onForm(cb) {
      formCb = cb;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", start);
      for (const g of [bgGeo, cageGeo, ...hornGeos, plane.geometry]) g.dispose();
      depth.dispose();
      for (const m of [figureMat, cageMat, hornMat, bgMat]) {
        (m as { dispose?: () => void } | undefined)?.dispose?.();
      }
      texNormal.dispose();
      texEnder.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
