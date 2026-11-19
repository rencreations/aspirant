import {
  BackSide,
  BoxGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
  Texture,
  type Plane,
} from "three";
import { describe, expect, it } from "vitest";

import {
  CardInkMaterial,
  INK_COLOR,
  InkMaterial,
  TOON_LOOKS,
  ToonMaterial,
  addCardInk,
  addInk,
  ensureSmoothNormals,
  setToonView,
  toonLight,
  toonify,
  unlitFrom,
} from "./toon";

function scene(...materials: MeshStandardMaterial[]): { root: Scene; meshes: Mesh[] } {
  const root = new Scene();
  const meshes = materials.map((material) => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
    root.add(mesh);
    return mesh;
  });
  return { root, meshes };
}

describe("toonLight", () => {
  it("is a unit vector from the upper left, in front", () => {
    const d = toonLight.dir.value;
    expect(d.length()).toBeCloseTo(1, 6);
    expect(d.x).toBeLessThan(0);
    expect(d.y).toBeGreaterThan(0);
    expect(d.z).toBeGreaterThan(0);
  });

  it("normalises what a section sets", () => {
    const was = toonLight.dir.value.clone();
    toonLight.set(3, 0, 4);
    expect(toonLight.dir.value.x).toBeCloseTo(0.6, 6);
    expect(toonLight.dir.value.z).toBeCloseTo(0.8, 6);
    toonLight.set(was.x, was.y, was.z);
  });

  it("knows the size of the canvas", () => {
    setToonView(1706, 950);
    expect(toonLight.view.value.x).toBe(1706);
    setToonView(0, 0);
    expect(toonLight.view.value.x).toBe(1);
  });
});

describe("ToonMaterial", () => {
  it("is a basic material with no tone mapping and the picture it was given", () => {
    const map = new Texture();
    const m = new ToonMaterial({ map, look: "skin" });
    expect(m).toBeInstanceOf(MeshBasicMaterial);
    expect(m.toneMapped).toBe(false);
    expect(m.map).toBe(map);
    expect(m.defines?.TOON_BANDS).toBe(2);
  });

  it("takes the band count of the look and recompiles once when it changes", () => {
    const m = new ToonMaterial({ look: "metal" });
    expect(m.defines?.TOON_BANDS).toBe(3);
    const version = m.version;
    m.setLook(TOON_LOOKS.metal);
    expect(m.version).toBe(version);
    m.setLook(TOON_LOOKS.skin);
    expect(m.defines?.TOON_BANDS).toBe(2);
    expect(m.version).toBeGreaterThan(version);
  });

  it("is double sided by default and keeps the alpha settings", () => {
    const m = new ToonMaterial({ alphaTest: 0.1, transparent: true, depthWrite: true });
    expect(m.side).toBe(DoubleSide);
    expect(m.alphaTest).toBe(0.1);
    expect(m.transparent).toBe(true);
  });

  it("gives each look its own cache key by band count and glow", () => {
    const a = new ToonMaterial({ look: "skin" });
    const b = new ToonMaterial({ look: "metal" });
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
    const c = new ToonMaterial({ look: "skin" });
    expect(a.customProgramCacheKey()).toBe(c.customProgramCacheKey());
    const glow = new ToonMaterial({ map: new Texture(), emissiveMap: new Texture() });
    expect(glow.customProgramCacheKey()).not.toBe(a.customProgramCacheKey());
    expect(glow.defines?.TOON_EMISSIVE_MAP).toBe(1);
  });

  it("ignores a glow map without a picture", () => {
    const m = new ToonMaterial({ emissiveMap: new Texture() });
    expect(m.defines?.TOON_EMISSIVE_MAP).toBeUndefined();
  });
});

describe("ToonMaterial skin split", () => {
  it("is off by default and on when asked, without a new program", () => {
    const off = new ToonMaterial({ look: "default" });
    const on = new ToonMaterial({ look: "default", skinSplit: true });
    expect(off.customProgramCacheKey()).toBe(on.customProgramCacheKey());
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: "",
      fragmentShader: "",
    };
    off.onBeforeCompile(shader as never, undefined as never);
    expect(shader.uniforms.uSkinSplit?.value).toBe(0);
    const shaderOn = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: "",
      fragmentShader: "",
    };
    on.onBeforeCompile(shaderOn as never, undefined as never);
    expect(shaderOn.uniforms.uSkinSplit?.value).toBe(1);
    expect(shaderOn.uniforms.uWarm).toBeDefined();
  });
});

describe("InkMaterial", () => {
  it("draws inside out and sizes its line from the height", () => {
    const ink = new InkMaterial();
    expect(ink.side).toBe(BackSide);
    ink.setSize(900);
    expect(ink.width).toBeGreaterThan(3);
    ink.setSize(100);
    expect(ink.width).toBe(1.1);
    ink.setWidth(4);
    expect(ink.width).toBe(4);
  });
});

describe("ensureSmoothNormals and addInk", () => {
  it("makes one smooth normal a vertex, once", () => {
    const geometry = new BoxGeometry(1, 1, 1);
    ensureSmoothNormals(geometry);
    const first = geometry.getAttribute("aSmooth");
    expect(first.count).toBe(geometry.getAttribute("position").count);
    // A box corner is shared by three faces: the smooth normal points along the diagonal.
    expect(Math.abs(first.getX(0))).toBeCloseTo(1 / Math.sqrt(3), 4);
    ensureSmoothNormals(geometry);
    expect(geometry.getAttribute("aSmooth")).toBe(first);
  });

  it("puts a sibling hull with the same transform and weights next to the mesh", () => {
    const { root, meshes } = scene(new MeshStandardMaterial());
    const mesh = meshes[0]!;
    mesh.position.set(1, 2, 3);
    mesh.morphTargetInfluences = [0.5];
    const ink = new InkMaterial();
    const hull = addInk(mesh, ink);
    expect(root.children).toContain(hull.mesh);
    expect(hull.mesh.position.toArray()).toEqual([1, 2, 3]);
    expect(hull.mesh.morphTargetInfluences).toBe(mesh.morphTargetInfluences);
    expect(hull.mesh.geometry).toBe(mesh.geometry);
    expect(hull.mesh.material).toBe(ink);
    hull.remove();
    expect(root.children).not.toContain(hull.mesh);
  });
});

describe("toonify", () => {
  it("converts standard materials, keeps the picture and puts ink on the mesh", () => {
    const map = new Texture();
    const { root, meshes } = scene(new MeshStandardMaterial({ map, metalness: 0, roughness: 1 }));
    const set = toonify(root);
    const mesh = meshes[0]!;
    expect(mesh.material).toBeInstanceOf(ToonMaterial);
    expect((mesh.material as ToonMaterial).map).toBe(map);
    expect(set.toons).toHaveLength(1);
    expect(set.inks).toHaveLength(1);
    expect(root.children).toHaveLength(2);
    expect(set.textures.has(map)).toBe(true);
  });

  it("gives a metal material the metal look and shares a converted material between meshes", () => {
    const shared = new MeshStandardMaterial({ metalness: 1 });
    const { root, meshes } = scene(shared, shared);
    const set = toonify(root);
    expect(meshes[0]!.material).toBe(meshes[1]!.material);
    expect(set.toons).toHaveLength(1);
    expect((meshes[0]!.material as ToonMaterial).defines?.TOON_BANDS).toBe(3);
  });

  it("gives no ink to alpha cards and none to unlit parts, and lets a pick decide", () => {
    const card = new MeshStandardMaterial({ transparent: true, alphaTest: 0.1 });
    const eye = new MeshStandardMaterial({ name: "eye" });
    const plain = new MeshStandardMaterial({ name: "plain" });
    const { root, meshes } = scene(card, eye, plain);
    const set = toonify(root, {
      pick: (_mesh, source) => (source.name === "eye" ? { unlit: true } : undefined),
    });
    expect(set.inks).toHaveLength(1);
    expect(meshes[1]!.material).toBeInstanceOf(MeshBasicMaterial);
    expect(meshes[1]!.material).not.toBeInstanceOf(ToonMaterial);
    expect(meshes[0]!.material).toBeInstanceOf(ToonMaterial);
  });

  it("sizes the ink and takes everything away on dispose", () => {
    const { root } = scene(new MeshStandardMaterial());
    const set = toonify(root);
    set.setHeight(900);
    expect(set.ink.width).toBeGreaterThan(2.5);
    set.dispose();
    expect(root.children).toHaveLength(1);
    expect(set.materials).toHaveLength(0);
  });

  it("passes the clipping planes to the skin and the ink", () => {
    const { root, meshes } = scene(new MeshStandardMaterial());
    const planes: Plane[] = [];
    const set = toonify(root, { clippingPlanes: planes });
    expect((meshes[0]!.material as ToonMaterial).clippingPlanes).toBe(planes);
    expect(set.ink.clippingPlanes).toBe(planes);
  });
});

describe("addCardInk", () => {
  it("puts six shifted copies next to an alpha card and takes them away again", () => {
    const { root, meshes } = scene(new MeshStandardMaterial({ transparent: true, alphaTest: 0.1 }));
    const set = toonify(root, { pick: () => ({ ink: "card" }) });
    expect(set.inks).toHaveLength(1);
    expect(root.children).toHaveLength(1 + 6);
    const copy = root.children[1] as Mesh;
    expect(copy.material).toBeInstanceOf(CardInkMaterial);
    expect(copy.geometry).toBe(meshes[0]!.geometry);
    set.dispose();
    expect(root.children).toHaveLength(1);
  });
});

describe("unlitFrom and the ink colour", () => {
  it("keeps the picture and draws it as it is, with no tone mapping", () => {
    const map = new Texture();
    const source = new MeshStandardMaterial({ map, name: "eye" });
    const plain = unlitFrom(source);
    expect(plain.map).toBe(map);
    expect(plain.toneMapped).toBe(false);
    expect(plain.name).toBe("eye");
    expect(plain).not.toBeInstanceOf(ToonMaterial);
  });

  it("makes the ink a deep tinted dark, not black", () => {
    expect(INK_COLOR).not.toBe(0);
    expect(INK_COLOR).toBeLessThan(0x404040);
    expect(INK_COLOR & 0xff).toBeGreaterThan(0x10);
  });

  it("puts card ink on a mesh by hand and takes it away", () => {
    const { root, meshes } = scene(new MeshStandardMaterial());
    const ink = new InkMaterial();
    const card = addCardInk(meshes[0]!, new MeshBasicMaterial(), ink, 4);
    expect(root.children).toHaveLength(1 + 4);
    card.remove();
    expect(root.children).toHaveLength(1);
  });
});

describe("inkWeight", () => {
  it("gives a mesh a finer hull material that follows the figure's size", () => {
    const { root, meshes } = scene(new MeshStandardMaterial(), new MeshStandardMaterial());
    const set = toonify(root, {
      pick: (mesh) => (mesh === meshes[1] ? { inkWeight: 0.5 } : undefined),
    });
    const fine = set.inkFor(0.5);
    expect(fine).not.toBe(set.ink);
    expect(set.inkFor(1)).toBe(set.ink);
    expect(set.inkFor(0.5)).toBe(fine);
    set.setHeight(900);
    expect(fine.width).toBeCloseTo(set.ink.width * 0.5, 6);
    set.dispose();
  });
});
