/**
 * The comic book drawn: a hardback made of shapes. Two boards in rounded, bevelled cloth, a raised
 * border and a raised emblem on each cover, gilt corners, a spine with ribs, a block of pages for
 * each board and one page that turns. There is no picture anywhere on it. It lives in Tetra's own
 * scene (her metres, her lens), so she holds it with her own hands; it is not a child of her bones,
 * so a mirrored doll never mirrors a cover. The state is `book.ts`; this lays it on meshes.
 *
 * It is drawn in the home's toon look (`actors/shared/toon.ts`: the same key light and cel bands as
 * the rest of the cast, and the same kind of ink line). What a light does to a real object is
 * made out of shapes, so it holds at any angle: the raised parts cast a flat shadow on their board,
 * which moves with the light (`aim`), and the whole book lays a soft shadow on what is behind it
 * (`shade`), drawn by multiplying, so it darkens only what she has already drawn.
 *
 * Seen from the visitor's side the book shows its outsides: open, the back cover is on the left and
 * the front cover on the right with the spine between them; shut, only the back cover shows.
 */
import {
  DoubleSide,
  ExtrudeGeometry,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MultiplyBlending,
  Path,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";

import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { InkMaterial, ToonMaterial, addInk } from "../../shared/toon";

import { type BookState, boardAngles, pageTurn, popScale } from "./book";
import { BOARD_T, BOOK_H, BOOK_SCALE, BOOK_W, PAGE_T } from "./book-hold";

const CLOTH_BACK = 0x2f4fd0;
const CLOTH_FRONT = 0xd83a78;
const CREAM = 0xf8ecc6;
const PINK = 0xff6f9f;
const SKY = 0x62b3ff;
const GOLD = 0xe8b64a;
const PAPER = 0xfbf3df;
const PANEL_TONES = [0xf2b8c6, 0xbcd0f5, 0xf7e2a8, 0xc9e8d4, 0xe4d0f0] as const;

/** The height of the raised shapes over the cloth, and what a bevel takes off a shape's size. */
const RAISE = 0.00085;
const BEVEL = 0.00025;
/** The page blocks are a little smaller than the boards: the cloth stands out round them. */
const BLOCK_W = BOOK_W - 0.0052;
const BLOCK_H = BOOK_H - 0.0074;
/** The cloth over the spine. */
const SPINE_R = 0.0092;

function roundedRect(w: number, h: number, r: number): Shape {
  const x = -w / 2;
  const y = -h / 2;
  const s = new Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function ring(w: number, h: number, r: number, line: number): Shape {
  const outer = roundedRect(w, h, r);
  const inner = roundedRect(w - 2 * line, h - 2 * line, Math.max(0.0005, r - line));
  outer.holes.push(new Path(inner.getPoints(8)));
  return outer;
}

function star(points: number, outer: number, inner: number): Shape {
  const s = new Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function disc(radius: number): Shape {
  const s = new Shape();
  s.absarc(0, 0, radius, 0, Math.PI * 2, false);
  return s;
}

/** A right triangle in a corner: the legs run `sx` along x and `sy` along y from the corner. */
function corner(sx: number, sy: number): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(sx, 0);
  s.lineTo(0, sy);
  s.closePath();
  return s;
}

/** The flat shadow of all that stands on one board, and the board whose frame the light is read in. */
interface Shade {
  mesh: Mesh;
  board: Object3D;
}

/** How far a shadow reaches from what casts it, in metres, at a light that stands straight over it. */
const SHADOW_LENGTH = 0.0014;

type Side = "left" | "right";

export class BookMesh {
  /** Put this in her scene. It is placed by the actor. */
  readonly root = new Group();
  private readonly spine = new Group();
  private readonly frontPivot = new Group();
  private readonly backPivot = new Group();
  private readonly leafHinge = new Group();
  private readonly back = new Group();
  private readonly front = new Group();
  private readonly leaf = new Group();
  private readonly blocks: Mesh[] = [];
  private readonly shades: Shade[] = [];
  private readonly light = new Vector3();
  private readonly turn = new Quaternion();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly ink = new InkMaterial(0x1d2347, undefined, 0.8, { fine: true });
  private readonly cast: ShaderMaterial;
  private readonly shadow: Mesh;
  private readonly angles = { front: 0, back: 0 };
  private readonly turnNow = { angle: 0, lift: 0, bend: 0 };
  private readonly outline: Mesh[] = [];

  constructor() {
    const geo = <G extends BufferGeometry>(g: G): G => {
      this.geometries.push(g);
      return g;
    };
    const toon = (color: number, look: "default" | "soft" | "metal" = "default") => {
      const m = new ToonMaterial({ color, look, side: FrontSide });
      this.materials.push(m);
      return m;
    };
    const flat = (color: number) => {
      const m = new MeshBasicMaterial({ color, side: FrontSide, toneMapped: false });
      this.materials.push(m);
      return m;
    };
    const clothBack = toon(CLOTH_BACK);
    const clothFront = toon(CLOTH_FRONT);
    const cream = toon(CREAM, "soft");
    const pink = toon(PINK);
    const sky = toon(SKY);
    const gold = toon(GOLD, "metal");
    const paper = toon(PAPER, "soft");
    // The shadows of the raised shapes are the cloth's own colour, deep.
    const deepBack = flat(0x142063);
    const deepFront = flat(0x6d1239);
    this.materials.push(this.ink);
    this.ink.setSize(150);

    const withInk = (mesh: Mesh) => {
      this.outline.push(addInk(mesh, this.ink).mesh);
    };

    const extrude = (shape: Shape, depth: number, bevel = BEVEL) =>
      geo(
        new ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: bevel > 0,
          bevelThickness: bevel,
          bevelSize: bevel,
          bevelSegments: 2,
          curveSegments: 10,
        }),
      );

    // ---- the boards. A board lies about its own middle: outer face +z, pages on the -z side.
    const boardGeo = extrude(
      roundedRect(BOOK_W - 0.0018, BOOK_H - 0.0018, 0.0052),
      BOARD_T - 0.0014,
      0.0007,
    );
    boardGeo.translate(0, 0, -(BOARD_T - 0.0014) / 2);
    const makeBoard = (
      group: Group,
      cloth: ToonMaterial,
      deep: MeshBasicMaterial,
      index: 0 | 1,
    ) => {
      const sign = index === 0 ? -1 : 1;
      const board = new Mesh(boardGeo, cloth);
      board.position.x = (sign * BOOK_W) / 2;
      group.add(board);
      withInk(board);
      // The raised shapes sit on the outer face, in the board's frame (x from its middle). They are
      // collected by material and made into one mesh each, and their shadows into one flat mesh.
      const top = BOARD_T / 2 + 0.0005;
      const parts = new Map<ToonMaterial, BufferGeometry[]>();
      const shades: BufferGeometry[] = [];
      const add = (shape: Shape, material: ToonMaterial, x: number, y: number, lift = 0) => {
        const g = new ExtrudeGeometry(shape, {
          depth: RAISE,
          bevelEnabled: true,
          bevelThickness: BEVEL,
          bevelSize: BEVEL,
          bevelSegments: 2,
          curveSegments: 10,
        });
        g.translate(x, y, top + lift);
        parts.set(material, [...(parts.get(material) ?? []), g]);
        // Its shadow: the same outline, flat on the cloth, a little to the side the light is not.
        const shade = new ShapeGeometry(shape, 10);
        shade.translate(x, y, top - 0.0004);
        shades.push(shade);
      };
      // A raised border all round, set in from the edge.
      add(ring(BOOK_W - 0.0145, BOOK_H - 0.0145, 0.0042, 0.0014), cream, 0, 0);
      // Gilt corners on the two outer corners.
      const gl = 0.0125;
      const outerX = sign * (BOOK_W / 2 - 0.0035);
      const oh = BOOK_H / 2 - 0.0035;
      add(corner(-sign * gl, -gl), gold, outerX, oh, 0.0001);
      add(corner(-sign * gl, gl), gold, outerX, -oh, 0.0001);
      // The emblem and the bars differ by cover.
      if (index === 0) {
        // The back cover: a ring with a star, and three lines below.
        add(disc(0.0185), pink, 0, 0.012);
        add(disc(0.0132), cream, 0, 0.012, 0.0003);
        add(star(5, 0.0112, 0.0049), sky, 0, 0.0122, 0.0006);
        add(roundedRect(0.044, 0.0042, 0.0018), cream, 0, -0.0215);
        add(roundedRect(0.032, 0.0042, 0.0018), cream, 0, -0.0305);
        add(roundedRect(0.024, 0.0042, 0.0018), pink, 0, -0.0395);
      } else {
        // The front cover: a wide band at the top, a big star in a disc, a row of small squares.
        add(roundedRect(BOOK_W - 0.0345, 0.0155, 0.0022), pink, 0, BOOK_H / 2 - 0.0225);
        add(roundedRect(BOOK_W - 0.0515, 0.0055, 0.0018), cream, 0, BOOK_H / 2 - 0.0225, 0.0003);
        add(disc(0.0215), sky, 0, -0.004);
        add(star(5, 0.0185, 0.0082), cream, 0, -0.0033, 0.0003);
        add(star(5, 0.0095, 0.0042), pink, 0, -0.0033, 0.0006);
        for (let i = 0; i < 4; i += 1) {
          add(
            roundedRect(0.0062, 0.0062, 0.0011),
            i % 2 === 0 ? cream : pink,
            (i - 1.5) * 0.0108,
            -0.0388,
          );
        }
      }
      for (const [material, geometries] of parts) {
        const merged = mergeGeometries(geometries);
        for (const g of geometries) g.dispose();
        if (merged) board.add(new Mesh(geo(merged), material));
      }
      const flat = mergeGeometries(shades);
      for (const g of shades) g.dispose();
      if (flat) {
        const mesh = new Mesh(geo(flat), deep);
        board.add(mesh);
        this.shades.push({ mesh, board });
      }
    };
    makeBoard(this.back, clothBack, deepBack, 0);
    makeBoard(this.front, clothFront, deepFront, 1);
    this.backPivot.add(this.back);
    this.frontPivot.add(this.front);

    // ---- the page blocks: on the inner side of each board, a little smaller.
    const blockGeo = geo(
      new ExtrudeGeometry(roundedRect(BLOCK_W, BLOCK_H, 0.0012), {
        depth: PAGE_T,
        bevelEnabled: false,
      }),
    );
    blockGeo.translate(0, 0, -PAGE_T);
    const panels = (host: Object3D, variant: number) => {
      const layouts: Array<Array<[number, number, number, number]>> = [
        [
          [-0.0, 0.0256, 0.07, 0.0344],
          [-0.0185, -0.0114, 0.0315, 0.0276],
          [0.0185, -0.0114, 0.0315, 0.0276],
          [0, -0.0426, 0.07, 0.0225],
        ],
        [
          [-0.0185, 0.0205, 0.0315, 0.0438],
          [0.0185, 0.0345, 0.0315, 0.0192],
          [0.0185, 0.0105, 0.0315, 0.0192],
          [0, -0.0265, 0.07, 0.0425],
        ],
        [
          [0, 0.0325, 0.07, 0.0235],
          [-0.0215, 0.0008, 0.0215, 0.0295],
          [0.0165, 0.0008, 0.0375, 0.0295],
          [0, -0.0315, 0.07, 0.0295],
        ],
      ];
      const layout = layouts[variant % layouts.length] ?? [];
      layout.forEach(([x, y, w, h], i) => {
        const tone = PANEL_TONES[(i + variant) % PANEL_TONES.length] ?? PANEL_TONES[0];
        const panel = new Mesh(geo(new PlaneGeometry(w, h)), flat(tone));
        panel.position.set(x, y, 0.0002);
        panel.rotation.y = Math.PI;
        host.add(panel);
        const frame = new Mesh(geo(new PlaneGeometry(w + 0.0018, h + 0.0018)), flat(0x2a3342));
        frame.position.set(x, y, 0.00012);
        frame.rotation.y = Math.PI;
        host.add(frame);
      });
    };
    for (const [group, sign, variant] of [
      [this.back, -1, 0],
      [this.front, 1, 1],
    ] as const) {
      const block = new Mesh(blockGeo, paper);
      block.position.set((sign * BOOK_W) / 2, 0, -BOARD_T / 2 + 0.0004);
      group.add(block);
      this.blocks.push(block);
      // The block's inner face is toward -z: panels go on it, upright for the reader.
      const face = new Group();
      face.position.set(0, 0, -PAGE_T - 0.0001);
      block.add(face);
      panels(face, variant);
    }

    // ---- the cloth round the spine, with its ribs.
    const spineLength = BOOK_H - 0.0018;
    const spineGeo = geo(
      new ExtrudeGeometry(halfDisc(SPINE_R), {
        depth: spineLength,
        bevelEnabled: false,
        curveSegments: 14,
      }),
    );
    // The extrusion runs up the page and the bulge is toward the visitor.
    spineGeo.rotateX(-Math.PI / 2);
    spineGeo.translate(0, -spineLength / 2, 0);
    const spineMesh = new Mesh(spineGeo, clothBack);
    spineMesh.position.set(0, 0, -0.0004);
    this.spine.add(spineMesh);
    withInk(spineMesh);
    const ribGeo = geo(
      new ExtrudeGeometry(halfDisc(SPINE_R + 0.0005), {
        depth: 0.0016,
        bevelEnabled: false,
        curveSegments: 14,
      }),
    );
    ribGeo.rotateX(-Math.PI / 2);
    for (const y of [-0.036, -0.012, 0.012, 0.036]) {
      const rib = new Mesh(ribGeo, gold);
      rib.position.set(0, y - 0.0008, -0.0004);
      this.spine.add(rib);
    }

    // ---- the page that turns, hinged at the spine: a double sided sheet with panels on both faces.
    const leafBase = new Mesh(
      geo(new PlaneGeometry(BLOCK_W, BLOCK_H * 1.04)),
      doubleSided(PAPER, this.materials),
    );
    leafBase.position.set(BLOCK_W / 2, 0, 0);
    this.leaf.add(leafBase);
    for (const [face, turn] of [
      [0, Math.PI],
      [1, 0],
    ] as const) {
      const host = new Group();
      host.position.set(BLOCK_W / 2, 0, face === 0 ? -0.0001 : 0.0001);
      host.rotation.y = turn;
      this.leaf.add(host);
      panels(host, face + 2);
    }
    this.leafHinge.add(this.leaf);
    this.leafHinge.visible = false;

    this.spine.add(this.backPivot, this.frontPivot, this.leafHinge);
    this.spine.scale.setScalar(BOOK_SCALE);
    this.root.add(this.spine);
    this.root.visible = false;

    // ---- the shadow the book lays on what is behind it: it only darkens what is already drawn.
    this.cast = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: MultiplyBlending,
      premultipliedAlpha: true,
      uniforms: { uShade: { value: 0.58 }, uSoft: { value: 0.3 } },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `varying vec2 vUv; uniform float uShade; uniform float uSoft;
        float box(vec2 p, vec2 b, float r){ vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
        void main(){
          vec2 p = (vUv - 0.5) * 2.0;
          float d = box(p, vec2(0.78, 0.8), 0.16);
          float a = 1.0 - smoothstep(-uSoft, uSoft, d);
          gl_FragColor = vec4(vec3(mix(1.0, uShade, a)), 1.0);
        }`,
    });
    this.materials.push(this.cast);
    this.shadow = new Mesh(geo(new PlaneGeometry(BOOK_W * 2.5, BOOK_H * 1.45)), this.cast);
    this.shadow.scale.setScalar(BOOK_SCALE);
    this.shadow.renderOrder = 10;
    this.shadow.visible = false;
    this.root.add(this.shadow);
  }

  /**
   * Lay the state on the boards and the page: how open, the page that turns, and the pop in. The
   * actor places the root. Returns whether the book is drawn at all.
   */
  update(state: BookState, carried = false): boolean {
    const present = state.present.x;
    const scale = carried ? present : popScale(present);
    this.root.visible = scale > 0.001;
    if (!this.root.visible) return false;
    this.root.scale.setScalar(Math.max(0.001, scale));
    const o = Math.min(1, Math.max(0, state.open.x));
    const { front, back } = boardAngles(o, this.angles);
    // Shut, the book is one board wide: its middle is half a board to the left of the spine.
    this.spine.position.x = (BOOK_W / 2) * (1 - o);
    this.backPivot.rotation.y = back;
    this.frontPivot.rotation.y = front;
    // Shut, the front board lies behind the back one: one thickness of boards and pages.
    this.frontPivot.position.z = -(2 * BOARD_T + 2 * PAGE_T) * (1 - Math.min(1, o * 2));
    const showBlocks = o > 0.02;
    for (const block of this.blocks) block.visible = showBlocks;
    // The turning page swings over the spine from the right block to the left, toward her, and
    // rises over the top as it goes, so its edge is seen over the book.
    const turning = state.turning;
    this.leafHinge.visible = turning >= 0 && o > 0.8;
    if (this.leafHinge.visible) {
      const t = pageTurn(turning, this.turnNow);
      this.leafHinge.rotation.y = t.angle;
      this.leafHinge.position.z = -(BOARD_T + PAGE_T);
      this.leaf.position.y = BOOK_H * 0.22 * t.lift;
      this.leaf.rotation.x = 0.35 * t.bend;
    }
    for (const hull of this.outline) hull.visible = true;
    return true;
  }

  /**
   * The light (a unit vector toward it, in the world of her scene): the raised shapes of each board
   * lay their shadow on the cloth away from it, read in that board's own frame (the boards lean).
   * A board that turns its back to the light has no shadow to show.
   */
  aim(world: Vector3): void {
    for (const { mesh, board } of this.shades) {
      board.getWorldQuaternion(this.turn).invert();
      const l = this.light.copy(world).applyQuaternion(this.turn);
      if (l.z < 0.12) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const k = SHADOW_LENGTH / l.z;
      mesh.position.set(-l.x * k, -l.y * k, 0);
    }
  }

  /**
   * The soft shadow of the whole book: a plane just behind it (toward her), slid away from the light
   * by `dx`, `dy` (metres, in the book's frame) and `behind` metres back.
   */
  shade(dx: number, dy: number, behind: number, strength: number): void {
    this.shadow.visible = strength > 0.01;
    if (!this.shadow.visible) return;
    this.shadow.position.set(dx, dy, -behind);
    this.shadow.rotation.set(0, 0, 0);
    this.cast.uniforms.uShade!.value = 1 - 0.42 * strength;
  }

  /** The line's width follows how big the book is on the screen (CSS pixels, its height). */
  size(px: number): void {
    this.ink.setSize(px);
  }

  /**
   * The corners of the outer face of one board, once the caller has projected them into the stage's
   * frame: the four world positions of the face, left side (the back cover) or right (the front).
   */
  corners(side: Side, out: Vector3[]): void {
    const board = side === "left" ? this.back : this.front;
    const sx = BOOK_W / 2;
    const sy = BOOK_H / 2;
    const z = BOARD_T / 2;
    const x0 = side === "left" ? -BOOK_W / 2 : BOOK_W / 2;
    const points = [
      [x0 - sx, -sy],
      [x0 + sx, -sy],
      [x0 + sx, sy],
      [x0 - sx, sy],
    ] as const;
    board.updateWorldMatrix(true, false);
    points.forEach(([x, y], i) => {
      (out[i] ?? (out[i] = new Vector3())).set(x, y, z).applyMatrix4(board.matrixWorld);
    });
  }

  /** The book's own rotation as a quaternion (for the light). */
  worldQuaternion(out: Quaternion): Quaternion {
    return this.root.getWorldQuaternion(out);
  }

  get shown(): boolean {
    return this.root.visible;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.root.clear();
  }
}

/** The half of a disc that bulges toward the visitor once its extrusion is stood up the page. */
function halfDisc(radius: number): Shape {
  const s = new Shape();
  s.absarc(0, 0, radius, Math.PI, Math.PI * 2, false);
  s.closePath();
  return s;
}

function doubleSided(color: number, store: Material[]): Material {
  const m = new MeshBasicMaterial({ color, toneMapped: false, side: DoubleSide });
  store.push(m);
  return m;
}
