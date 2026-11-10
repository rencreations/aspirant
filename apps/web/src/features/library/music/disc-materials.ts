import {
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  LatheGeometry,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NoColorSpace,
  PMREMGenerator,
  RingGeometry,
  SRGBColorSpace,
  Vector2,
  type BufferGeometry,
  type Texture,
  type WebGLRenderer,
} from "three";

import { DISC, hubRingProfile, hubRings, rimProfile, type Profile } from "./disc-shape";

/**
 * What every disc shares: the geometry of its parts, the materials that are not its own picture,
 * the small textures that give the print its grain and the rim its shine, and the light it
 * reflects. Built once per scene, all in code (no file to download).
 */
export interface DiscKit {
  face: BufferGeometry;
  back: BufferGeometry;
  rim: BufferGeometry;
  frost: BufferGeometry;
  metal: BufferGeometry;
  clear: BufferGeometry;
  pick: BufferGeometry;
  backMat: MeshPhysicalMaterial;
  rimMat: MeshPhysicalMaterial;
  frostMat: MeshPhysicalMaterial;
  metalMat: MeshPhysicalMaterial;
  clearMat: MeshPhysicalMaterial;
  pickMat: MeshBasicMaterial;
  faceNormal: Texture;
  faceRough: Texture;
  /** A new material for the printed face of one disc. */
  faceMaterial: (map: Texture) => MeshPhysicalMaterial;
  environment: Texture;
  /** Make the light again (after the WebGL context was lost and came back). */
  renewEnvironment: () => Texture;
  dispose: () => void;
}

/** A small, fast random number source, so the grain is the same on every visit. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A grain value for a pixel, 0 to 1, the same every time. */
function grain(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function canvasOf(size: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
} {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext("2d") };
}

/** A normal map from a height field (left minus right, up minus down). */
function normalsOf(height: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(size);
  if (!ctx) return canvas;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const l = height[y * size + Math.max(0, x - 1)] ?? 0;
      const r = height[y * size + Math.min(size - 1, x + 1)] ?? 0;
      const u = height[Math.max(0, y - 1) * size + x] ?? 0;
      const w = height[Math.min(size - 1, y + 1) * size + x] ?? 0;
      let nx = (l - r) * strength;
      let ny = (u - w) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** The printed face: very fine rings of the disc under the ink, the ink's grain, a few scratches and dust. */
function faceHeight(size: number): Float32Array {
  const h = new Float32Array(size * size);
  const c = size / 2;
  const rings = 1.2 * (1024 / size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x - c, y - c);
      h[y * size + x] = Math.sin(r * rings) * 0.02 + (grain(x, y) - 0.5) * 0.1;
    }
  }
  const rand = seeded(24);
  for (let s = 0; s < 12; s += 1) {
    const angle = rand() * Math.PI * 2;
    const length = (20 + rand() * 120) * (size / 512);
    const x0 = rand() * size;
    const y0 = rand() * size;
    const depth = 0.1 + rand() * 0.25;
    for (let step = 0; step < length; step += 1) {
      const px = Math.round(x0 + Math.cos(angle) * step);
      const py = Math.round(y0 + Math.sin(angle) * step);
      if (px < 1 || py < 1 || px >= size - 1 || py >= size - 1) continue;
      h[py * size + px] = (h[py * size + px] ?? 0) - depth;
    }
  }
  for (let s = 0; s < 180; s += 1) {
    const i = Math.floor(rand() * size) * size + Math.floor(rand() * size);
    h[i] = (h[i] ?? 0) + (rand() - 0.5) * 0.4;
  }
  return h;
}

/** Roughness of the face: grainy ink, with glossier rings where the light catches the disc. */
function faceRoughness(size: number): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(size);
  if (!ctx) return canvas;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const c = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x - c, y - c) / c;
      let v = 0.42 + (grain(x * 3, y * 3) - 0.5) * 0.2 + (grain(x >> 1, y >> 1) - 0.5) * 0.1;
      v -= (Math.sin(r * 14) * 0.5 + 0.5) * 0.45;
      v = Math.min(1, Math.max(0.03, v)) * 255;
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** The silver back: data tracks as close rings. */
function backHeight(size: number): Float32Array {
  const h = new Float32Array(size * size);
  const c = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x - c, y - c);
      h[y * size + x] = Math.sin(r * 3.2) * 0.5 + (grain(x, y) - 0.5) * 0.06;
    }
  }
  return h;
}

/**
 * The light the discs reflect: a dark studio with soft bright bands above, so the coated face and
 * the metal rim catch long highlights (the light of a strip lamp, without the cost of one).
 */
function studio(): HTMLCanvasElement {
  const { canvas } = canvasOf(1);
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#2a2d35");
  g.addColorStop(0.5, "#0e0f13");
  g.addColorStop(1, "#020203");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  const bands: Array<[number, number, number]> = [
    [0.14, 0.07, 1],
    [0.26, 0.077, 0.85],
    [0.4, 0.049, 0.6],
    [0.62, 0.035, 0.35],
  ];
  for (const [v, half, strength] of bands) {
    const b = ctx.createLinearGradient(0, 512 * (v - half), 0, 512 * (v + half));
    b.addColorStop(0, "rgba(255,255,255,0)");
    b.addColorStop(0.5, `rgba(255,255,255,${Math.max(0.1, 0.85 * strength)})`);
    b.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = b;
    ctx.fillRect(0, 512 * (v - half), 1024, 512 * half * 2);
  }
  // The strip lamp above the discs: a short, bright bar in front of them.
  const lamp = ctx.createLinearGradient(0, 512 * 0.17, 0, 512 * 0.23);
  lamp.addColorStop(0, "rgba(255,255,255,0)");
  lamp.addColorStop(0.5, "rgba(255,255,255,1)");
  lamp.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = lamp;
  ctx.fillRect(1024 * 0.3, 512 * 0.17, 1024 * 0.4, 512 * 0.06);
  return canvas;
}

/** The metal ring of the hub: brushed light grey with faint rings. */
function metalRing(): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(256);
  if (!ctx) return canvas;
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, "#d9dde4");
  g.addColorStop(0.42, "#f0f2f5");
  g.addColorStop(0.72, "#cfd4dc");
  g.addColorStop(1, "#b8bec8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.lineWidth = 1;
  [0.255, 0.285, 0.315, 0.345].forEach((r, i) => {
    ctx.strokeStyle = `rgba(255,255,255,${0.14 - i * 0.018})`;
    ctx.beginPath();
    ctx.arc(128, 128, 256 * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  return canvas;
}

function lathe(profile: Profile, segments: number): LatheGeometry {
  const geo = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
  geo.computeVertexNormals();
  // The lathe turns around y; the disc faces +z.
  geo.rotateX(Math.PI / 2);
  return geo;
}

/** A flat ring whose texture coordinates are the plane's (so a square picture maps onto it). */
function planarRing(inner: number, outer: number): RingGeometry {
  const geo = new RingGeometry(inner, outer, 220, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (pos && uv) {
    for (let i = 0; i < pos.count; i += 1)
      uv.setXY(i, pos.getX(i) * 0.5 + 0.5, pos.getY(i) * 0.5 + 0.5);
    uv.needsUpdate = true;
  }
  return geo;
}

function texture(canvas: HTMLCanvasElement, renderer: WebGLRenderer, srgb = false): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/** Build everything the discs share. Takes some tens of milliseconds; run it behind the curtain. */
export function buildDiscKit(renderer: WebGLRenderer): DiscKit {
  const size = 512;
  const faceNormal = texture(normalsOf(faceHeight(size), size, 1), renderer);
  const faceRough = texture(faceRoughness(size), renderer);
  const backNormal = texture(normalsOf(backHeight(size), size, 1), renderer);
  const metalMap = texture(metalRing(), renderer, true);

  const light = () => {
    const env = new CanvasTexture(studio());
    env.mapping = EquirectangularReflectionMapping;
    env.colorSpace = SRGBColorSpace;
    const pmrem = new PMREMGenerator(renderer);
    const made = pmrem.fromEquirectangular(env);
    env.dispose();
    pmrem.dispose();
    return made;
  };
  let target = light();

  const rings = hubRings();
  const h = DISC.thickness;
  const face = planarRing(DISC.hub, DISC.faceOut);
  const back = planarRing(DISC.hub, DISC.faceOut);
  const rim = lathe(rimProfile(), 256);
  const clear = lathe(hubRingProfile(rings.clear[0], rings.clear[1], h * 1.02, 0.22), 160);
  const metal = lathe(hubRingProfile(rings.metal[0], rings.metal[1], h * 0.9, 0.12), 128);
  const frost = lathe(hubRingProfile(rings.frost[0], rings.frost[1], h * 0.98, 0.4), 128);
  const pick = new CircleGeometry(1, 32);

  const backMat = new MeshPhysicalMaterial({
    color: new Color("#1a1e2a"),
    roughness: 0.23,
    metalness: 1,
    clearcoat: 0.34,
    clearcoatRoughness: 0.06,
    iridescence: 1,
    iridescenceIOR: 1.86,
    iridescenceThicknessRange: [140, 900],
    normalMap: backNormal,
    normalScale: new Vector2(0.5, 0.5),
    envMapIntensity: 1.5,
  });
  const rimMat = new MeshPhysicalMaterial({
    color: new Color("#ffffff"),
    roughness: 0.18,
    metalness: 0.2,
    clearcoat: 0.7,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.4,
    side: DoubleSide,
  });
  const clearMat = new MeshPhysicalMaterial({
    color: new Color("#ffffff"),
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.3,
    transparent: true,
    opacity: 0.55,
    side: DoubleSide,
    depthWrite: false,
  });
  const metalMat = new MeshPhysicalMaterial({
    color: new Color("#dfe3e9"),
    map: metalMap,
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.45,
    side: DoubleSide,
  });
  const frostMat = new MeshPhysicalMaterial({
    color: new Color("#eef1f5"),
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.9,
    transparent: true,
    opacity: 0.82,
    side: DoubleSide,
    depthWrite: false,
  });
  const pickMat = new MeshBasicMaterial({ visible: false, side: DoubleSide, depthWrite: false });

  const faceMats: MeshPhysicalMaterial[] = [];
  const faceMaterial = (map: Texture) => {
    const m = new MeshPhysicalMaterial({
      map,
      roughness: 0.6,
      metalness: 0.16,
      roughnessMap: faceRough,
      clearcoat: 0.28,
      clearcoatRoughness: 0.04,
      normalMap: faceNormal,
      normalScale: new Vector2(0.2, 0.2),
      envMapIntensity: 0.32,
    });
    faceMats.push(m);
    return m;
  };

  const geometries = [face, back, rim, clear, metal, frost, pick];
  const materials = [backMat, rimMat, clearMat, metalMat, frostMat, pickMat];
  const textures = [faceNormal, faceRough, backNormal, metalMap];

  return {
    face,
    back,
    rim,
    frost,
    metal,
    clear,
    pick,
    backMat,
    rimMat,
    frostMat,
    metalMat,
    clearMat,
    pickMat,
    faceNormal,
    faceRough,
    faceMaterial,
    environment: target.texture,
    renewEnvironment: () => {
      target.dispose();
      target = light();
      return target.texture;
    },
    dispose: () => {
      geometries.forEach((g) => {
        g.dispose();
      });
      materials.forEach((m) => {
        m.dispose();
      });
      faceMats.forEach((m) => {
        m.dispose();
      });
      textures.forEach((t) => {
        t.dispose();
      });
      target.dispose();
    },
  };
}
