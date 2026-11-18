/**
 * The record crate: an open wooden box with a low front, built in code (rounded boards with a wood
 * grain drawn on a canvas, and a brass plate), and the places a drone's glove can take it by.
 * Metres, X along the crate, Y up from the ground, Z toward the viewer.
 */
import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { crateDims, type CrateDims } from "./layout";

/** A small seeded generator, so the grain is the same every time. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A plank's grain: warm brown with long wavy dark lines and a few knots. */
function woodTexture(): CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (g) {
    const rand = mulberry32(7);
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "#8a5d3a");
    base.addColorStop(0.5, "#7b5232");
    base.addColorStop(1, "#8f6340");
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const y = rand() * h;
      const amp = 1 + rand() * 3;
      const phase = rand() * 6.28;
      const freq = 0.004 + rand() * 0.01;
      g.strokeStyle = `rgba(${40 + rand() * 30},${22 + rand() * 18},${10},${0.08 + rand() * 0.18})`;
      g.lineWidth = 0.6 + rand() * 1.6;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const yy = y + Math.sin(x * freq + phase) * amp;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = rand() * w;
      const y = rand() * h;
      for (let r = 14; r > 2; r -= 3) {
        g.strokeStyle = `rgba(45,25,12,${0.1 + (14 - r) * 0.02})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(x, y, r * 2.2, r, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export type CrateSocket = "carryL" | "carryR" | "front";

export interface Crate {
  readonly group: Group;
  readonly dims: CrateDims;
  readonly sockets: Readonly<Record<CrateSocket, Object3D>>;
  dispose(): void;
}

/** Build the crate for `n` sleeves. `env` is the cast's environment. */
export function createCrate(n: number, env: Texture): Crate {
  const dims = crateDims(n);
  const group = new Group();
  group.name = "crate";
  const geometries: BufferGeometry[] = [];
  const grain = woodTexture();
  const wood = new MeshStandardMaterial({
    map: grain,
    roughness: 0.62,
    metalness: 0,
    envMap: env,
    envMapIntensity: 0.55,
  });
  wood.color = new Color(0xd9c3ad);
  const brass = new MeshStandardMaterial({
    color: 0xd8a23c,
    roughness: 0.3,
    metalness: 0.9,
    envMap: env,
    envMapIntensity: 0.9,
  });

  const board = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: MeshStandardMaterial = wood,
    radius = 0.006,
  ): Mesh => {
    const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2));
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  const { width: W, depth: D, floor, frontHeight, backHeight, wall } = dims;
  board(W, floor, D, 0, floor / 2, 0);
  board(W, frontHeight, wall, 0, frontHeight / 2, D / 2 - wall / 2);
  board(W, backHeight, wall, 0, backHeight / 2, -D / 2 + wall / 2);
  const sideHeight = (frontHeight + backHeight) / 2 + 0.02;
  board(wall, sideHeight, D, -W / 2 + wall / 2, sideHeight / 2, 0);
  board(wall, sideHeight, D, W / 2 - wall / 2, sideHeight / 2, 0);
  // A strip along the top of the back board, and a brass plate on the front.
  board(W + 0.01, 0.014, wall + 0.012, 0, backHeight + 0.004, -D / 2 + wall / 2, wood, 0.005);
  board(0.13, 0.036, 0.004, 0, frontHeight * 0.5, D / 2 + 0.0015, brass, 0.002);

  const sockets: Record<CrateSocket, Object3D> = {
    carryL: new Object3D(),
    carryR: new Object3D(),
    front: new Object3D(),
  };
  sockets.carryL.position.set(-W / 2, 0.09, 0);
  sockets.carryR.position.set(W / 2, 0.09, 0);
  sockets.front.position.set(0, 0.05, D / 2);
  for (const [name, node] of Object.entries(sockets)) {
    node.name = `socket_${name}`;
    group.add(node);
  }

  return {
    group,
    dims,
    sockets,
    dispose() {
      for (const g of geometries) g.dispose();
      wood.dispose();
      brass.dispose();
      grain.dispose();
      group.removeFromParent();
    },
  };
}
