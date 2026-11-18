/**
 * The record crate: an open wooden box with a low front, built in code (rounded boards with a
 * crisp wood grain drawn on a canvas, and a brass plate), and the places a drone's glove can take it
 * by. Metres, X along the crate, Y up from the ground, Z toward the viewer.
 *
 * It is drawn in the anime look of the shared toon system (`../shared/toon.ts`), with the same
 * wood and brass as the gramophone's cabinet and horn (`../gramophone/look.ts`): flat warm brown
 * with a lighter step where the key light reaches, orange brown brass, and an ink line round every
 * board. The grain is a few long dark strokes, not noise.
 */
import {
  CanvasTexture,
  Group,
  Mesh,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { BRASS, WOOD } from "../gramophone/look";
import { addInk, ToonMaterial, type Ink, type InkMaterial } from "../shared/toon";

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

/** A plank's grain: flat warm brown with a few long, gently wavy dark strokes and two knots. */
function woodTexture(): CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (g) {
    const rand = mulberry32(7);
    g.fillStyle = "#9b6b47";
    g.fillRect(0, 0, w, h);
    // A few long strokes, each a clean line: the grain of a drawn plank.
    for (let i = 0; i < 9; i++) {
      const y = (i + 0.5 + (rand() - 0.5) * 0.5) * (h / 9);
      const amp = 1 + rand() * 2.5;
      const phase = rand() * 6.28;
      const freq = 0.005 + rand() * 0.006;
      g.strokeStyle = `rgba(88,50,30,${0.22 + rand() * 0.16})`;
      g.lineWidth = 2.4 + rand() * 2;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const yy = y + Math.sin(x * freq + phase) * amp;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    for (let i = 0; i < 2; i++) {
      const x = 80 + rand() * (w - 160);
      const y = 40 + rand() * (h - 80);
      for (let r = 12; r > 3; r -= 4) {
        g.strokeStyle = "rgba(88,50,30,0.5)";
        g.lineWidth = 1.8;
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

/** Build the crate for `n` sleeves. `ink` is the actor's one hull material (every board wears it). */
export function createCrate(n: number, ink: InkMaterial): Crate {
  const dims = crateDims(n);
  const group = new Group();
  group.name = "crate";
  const geometries: BufferGeometry[] = [];
  const hulls: Ink[] = [];
  const grain = woodTexture();
  const wood = new ToonMaterial({
    map: grain,
    look: "default",
    tune: { ...WOOD, lit: [1.1, 1.04, 0.98], sat: 1.05 },
    name: "crate-wood",
  });
  // A flat plate: no glint (one normal over the whole face would turn all of it white at an angle).
  const brass = new ToonMaterial({
    color: 0xd8a23c,
    look: "metal",
    tune: { ...BRASS, glint: 0 },
    name: "crate-brass",
  });

  const board = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: ToonMaterial = wood,
    radius = 0.006,
  ): Mesh => {
    const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2));
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    hulls.push(addInk(mesh, ink));
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
      for (const hull of hulls) hull.remove();
      for (const g of geometries) g.dispose();
      wood.dispose();
      brass.dispose();
      grain.dispose();
      group.removeFromParent();
    },
  };
}
