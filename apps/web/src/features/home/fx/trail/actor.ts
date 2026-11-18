import {
  BufferGeometry,
  DynamicDrawUsage,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Uint16BufferAttribute,
} from "three";

import type { Stage } from "../../kernel/stage";
import type { Actor } from "../../kernel/types";
import { StageProjector } from "../comic-marks/anchor";
import { addStepPass, type StepPass } from "../comic-marks/pass";
import { VERTEX_FLOATS } from "./ribbon";
import { FRAGMENT, VERTEX } from "./shader";
import {
  SLOT_PAIRS,
  TRAIL_SLOTS,
  TrailSystem,
  type TrailHandle,
  type TrailOptions,
} from "./system";

/**
 * Where the ribbons are drawn: above the flat field (ortho 10) and the logo (15 is above this), below
 * the drones (20) and the lit cast (30). A trail is always behind what makes it.
 */
const TRAILS_ORDER = 12;

const INDEX_PER_SLOT = (SLOT_PAIRS - 1) * 6;

/**
 * The ribbon trails of the home: the dragon's wing tips and tail tip, the drone's path. One dynamic
 * mesh in the shared `trails` pass (orthographic, order 12), one draw call for every trail, built on
 * the CPU from each trail's remembered points (`ribbon.ts`). Like the marks it is never shown by the
 * kernel: the pass steps its own simulation as the first thing in its draw, and is drawn only while
 * a trail has something to show.
 */
export class TrailsActor implements Actor {
  readonly name = "trails";
  /** Ignored: the pass decides. Kept because every actor has one. */
  visible = false;
  readonly system: TrailSystem;
  private readonly pass: StepPass;
  private readonly removePass: () => void;
  private readonly mesh: Mesh;
  private readonly geometry: BufferGeometry;
  private readonly buffer: InterleavedBuffer;
  private readonly material: ShaderMaterial;
  private disposed = false;

  constructor(stage: Stage) {
    this.system = new TrailSystem(new StageProjector(stage));
    const buffer = new InterleavedBuffer(this.system.data, VERTEX_FLOATS);
    buffer.setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute("aTone", new InterleavedBufferAttribute(buffer, 4, 3));
    const index = new Uint16Array(TRAIL_SLOTS * INDEX_PER_SLOT);
    let w = 0;
    for (let s = 0; s < TRAIL_SLOTS; s++) {
      const base = s * SLOT_PAIRS * 2;
      for (let i = 0; i < SLOT_PAIRS - 1; i++) {
        const a = base + i * 2;
        index[w++] = a;
        index[w++] = a + 1;
        index[w++] = a + 2;
        index[w++] = a + 1;
        index[w++] = a + 3;
        index[w++] = a + 2;
      }
    }
    geometry.setIndex(new Uint16BufferAttribute(index, 1));
    geometry.setDrawRange(0, 0);
    this.geometry = geometry;
    this.buffer = buffer;

    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: NormalBlending,
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = "trails";

    const added = addStepPass(stage, "trails", TRAILS_ORDER, {
      live: () => this.system.active > 0,
      step: (dt) => {
        this.system.step(dt);
        this.upload();
      },
    });
    this.pass = added.pass;
    this.removePass = added.remove;
    this.pass.scene.add(this.mesh);
    // Build the program now, so the first ribbon does not wait for the driver.
    this.mesh.visible = true;
    stage.renderer.compile(this.pass.scene, this.pass.camera);
    this.mesh.visible = false;
  }

  /** Make a trail. Call `track` on the handle every frame it should be followed. */
  create(options?: TrailOptions): TrailHandle {
    return this.system.create(options);
  }

  /** Forget every tail. */
  clear(): void {
    this.system.clear();
    this.upload();
  }

  /**
   * Run the simulation `seconds` forward in steps of a sixtieth, calling `tick` before each step (to
   * keep a trail tracked). For frame sheets and tests: the stage does this itself while it runs.
   */
  advance(seconds: number, tick?: (dt: number) => void): void {
    const dt = 1 / 60;
    let left = seconds;
    while (left > 1e-6) {
      const step = Math.min(dt, left);
      tick?.(step);
      this.system.step(step);
      left -= step;
    }
    this.upload();
  }

  private upload(): void {
    const used = this.system.used;
    this.geometry.setDrawRange(0, used * INDEX_PER_SLOT);
    this.mesh.visible = used > 0;
    if (used === 0) return;
    this.buffer.clearUpdateRanges();
    this.buffer.addUpdateRange(0, used * SLOT_PAIRS * 2 * VERTEX_FLOATS);
    this.buffer.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removePass();
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.system.clear();
  }
}
