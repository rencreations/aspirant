/**
 * The reel of string in her hands: a core wound with string between two flanges, its axis across
 * her body. Unlit and small (it is about a tenth of her height), with the ink line of the rest.
 */
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type BufferGeometry,
  type Material,
} from "three";

const INK = 0x2a3342;
const STRING = 0xf2e9d8;
const FLANGE = 0xff4f9a;
const RADIUS = 0.036;
const WIDTH = 0.05;

export class SpoolMesh {
  readonly root = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  constructor() {
    const part = (radius: number, height: number, color: number, y: number) => {
      const g = new CylinderGeometry(radius, radius, height, 20);
      const m = new MeshBasicMaterial({ color, toneMapped: false });
      this.geometries.push(g);
      this.materials.push(m);
      const mesh = new Mesh(g, m);
      mesh.position.y = y;
      return mesh;
    };
    const wound = part(RADIUS * 0.82, WIDTH * 0.8, STRING, 0);
    const a = part(RADIUS, WIDTH * 0.14, FLANGE, WIDTH * 0.45);
    const b = part(RADIUS, WIDTH * 0.14, FLANGE, -WIDTH * 0.45);
    // A thin ink ring round each flange, so the reel reads on the light page.
    const ringA = part(RADIUS * 1.08, WIDTH * 0.1, INK, WIDTH * 0.53);
    const ringB = part(RADIUS * 1.08, WIDTH * 0.1, INK, -WIDTH * 0.53);
    const group = new Group();
    group.add(ringA, ringB, a, b, wound);
    // The axis runs across her body: turn the cylinder's up onto x.
    group.rotation.z = Math.PI / 2;
    this.root.add(group);
    this.root.visible = false;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.root.clear();
  }
}
