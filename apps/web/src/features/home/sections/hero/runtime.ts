import { Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

import { StubRuntime } from "../../kernel/stub";
import type { Actor, FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The walking skeleton's hero: the copy fades out at its end, and one flat pink card, drawn by the
 * stage in the pixel orthographic pass, slides across the upper part of the screen with the scroll.
 * It stands in for the picture field and proves the single canvas: it is hidden outside the section
 * (the kernel hides every actor before each frame), and its place is a pure function of `local`.
 * The section's owner replaces this file.
 */
class HeroRuntime implements SectionRuntime {
  private readonly stub: StubRuntime;
  private readonly mesh: Mesh;
  private readonly actor: Actor;

  constructor(ctx: SectionCtx) {
    this.stub = new StubRuntime(ctx, { fadeIn: false, fadeOut: true });
    const pass = ctx.stage.scenePass("ortho", "ortho", 10);
    this.mesh = new Mesh(
      new PlaneGeometry(220, 124),
      new MeshBasicMaterial({ color: 0xff2e90, toneMapped: false }),
    );
    this.mesh.visible = false;
    pass.scene.add(this.mesh);
    this.actor = ctx.actors.register({
      name: "test-ortho",
      visible: false,
      object: this.mesh,
      dispose: () => {
        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        (this.mesh.material as MeshBasicMaterial).dispose();
      },
    });
  }

  update(local: number, frame: FrameInfo): void {
    this.stub.update(local);
    const t = Math.min(1, Math.max(0, local));
    this.actor.visible = local >= 0 && local <= 1;
    const { w, h } = frame.viewport;
    this.mesh.position.set(mix(-0.38 * w, 0.38 * w, t), 0.3 * h, 0);
    this.mesh.rotation.z = (1 - t) * 0.5;
  }

  dispose(): void {
    this.stub.dispose();
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  return new HeroRuntime(ctx);
}
