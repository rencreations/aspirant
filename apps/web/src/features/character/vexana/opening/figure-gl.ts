import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  WireframeGeometry,
  type Texture,
} from "three";

import { clamp, damp } from "@/lib/math";

import { fragmentOf, type BackgroundId } from "./backgrounds/registry";
import { BG_VERT, FIGURE_FRAG, FIGURE_VERT } from "./figure-shaders";
import { createIdleDirector } from "./reveal";

/** The cut-outs are 1672 x 941. */
const AR = 1672 / 941;
const FOV = 30;

export interface FigureGLOptions {
  normalUrl: string;
  enderUrl: string;
  background: BackgroundId;
  /** `full` renders at up to 1.5 times the pixels and with the full noise; `balanced` less. */
  quality: "full" | "balanced";
}

export interface FigureGL {
  setBackground: (id: BackgroundId) => void;
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

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 10, 6000);
  const figure = new Group();
  scene.add(figure);

  // The figure: a unit plane scaled to the size of the picture.
  const figureMat = new ShaderMaterial({
    vertexShader: FIGURE_VERT,
    fragmentShader: FIGURE_FRAG,
    uniforms: {
      uA: { value: texNormal },
      uB: { value: texEnder },
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
  const plane = new Mesh(new PlaneGeometry(1, 1), figureMat);
  plane.renderOrder = 1;
  plane.frustumCulled = false;
  figure.add(plane);

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
  figure.add(halo);

  // Backgrounds: one full-screen quad each. A new one fades in over the old one.
  const bgGeo = new PlaneGeometry(2, 2);
  const octaves = { value: options.quality === "full" ? 4 : 2 };
  const shared = {
    uTime: { value: 0 },
    uRes: { value: [1, 1] },
    uMouse: { value: [0.5, 0.5] },
    uTone: { value: 0 },
    uOct: octaves,
    uGlow: { value: [0.5, 0.6, 0] },
  };
  const makeBg = (id: BackgroundId, mix: number) => {
    const mat = new ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: fragmentOf(id),
      uniforms: { ...shared, uMix: { value: mix } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(bgGeo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -2;
    scene.add(mesh);
    return mesh;
  };
  let bgNow = makeBg(options.background, 1);
  let bgNext: ReturnType<typeof makeBg> | null = null;
  let bgFade = 0;

  // Layout -----------------------------------------------------------------------------------
  let w = 1;
  let h = 1;
  let figW = 1;
  let figH = 1;
  let baseY = 0;
  let pr = Math.min(window.devicePixelRatio || 1, options.quality === "full" ? 1.5 : 1);

  const layout = () => {
    const portrait = w / h < 0.85;
    figH = portrait ? Math.min(h * 0.62, (w * 2.4) / AR) : h * 0.93;
    figW = figH * AR;
    baseY = portrait ? -h / 2 + figH / 2 - figH * 0.01 : h / 2 - h * 0.075 - figH / 2;
    plane.scale.set(figW, figH, 1);
    halo.scale.setScalar(figW);
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
    const left = w / 2 - figW / 2;
    const top = h / 2 - baseY - figH / 2;
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

  // While nothing is moving but the slow background, half the frames are enough.
  let calm = false;

  const frame = (now: number) => {
    raf = 0;
    if (disposed || !active || document.hidden) return;
    if (calm && now - last < 30) {
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
      bgNext === null &&
      fade >= 1;
    if (!showing && reveal > 0.4) {
      showing = true;
      formCb?.(true);
    } else if (showing && reveal < 0.15) {
      showing = false;
      formCb?.(false);
    }

    // The head turns toward the cursor. It slides against it a little, for depth.
    figure.rotation.y = tiltX * 0.15;
    figure.rotation.x = tiltY * 0.1;
    figure.position.x = -tiltX * figW * 0.012;
    halo.rotation.y += dt * 0.12;
    cageMat.opacity = 0.1 + 0.2 * reveal;
    hornMat.opacity = 0.08 + 0.62 * reveal;

    fade = Math.min(1, fade + dt / 0.9);
    u.uTilt!.value = [tiltX, tiltY];
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
    shared.uGlow.value = [0.5 + figure.position.x / w, 0.5 + (baseY + 0.17 * figH) / h, reveal];

    if (bgNext) {
      bgFade = Math.min(1, bgFade + dt / 0.7);
      bgNext.material.uniforms.uMix!.value = bgFade;
      if (bgFade >= 1) {
        scene.remove(bgNow);
        bgNow.material.dispose();
        bgNow = bgNext;
        bgNext = null;
        bgNow.renderOrder = -2;
      }
    }

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
    setBackground(id) {
      if (disposed) return;
      if (bgNext) {
        scene.remove(bgNext);
        bgNext.material.dispose();
      }
      bgNext = makeBg(id, 0);
      bgNext.renderOrder = -1;
      bgFade = 0;
      start();
    },
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
      for (const m of [figureMat, cageMat, hornMat, bgNow.material, bgNext?.material]) {
        (m as { dispose?: () => void } | undefined)?.dispose?.();
      }
      texNormal.dispose();
      texEnder.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
