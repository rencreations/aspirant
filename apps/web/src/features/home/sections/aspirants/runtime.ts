import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";

import { StubRuntime } from "../../kernel/stub";
import type { Actor, FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The walking skeleton's aspirants section: the copy fades in and out, and one blue box, drawn by
 * the stage in the pixel perspective pass, turns over on the left of the screen as the scroll goes
 * through the section. It proves the perspective camera (a unit is a pixel at z = 0, things nearer
 * grow) and that two sections share the one canvas. The section's owner replaces this file.
 */
class AspirantsRuntime implements SectionRuntime {
  private readonly stub: StubRuntime;
  private readonly mesh: Mesh;
  private readonly actor: Actor;

  constructor(ctx: SectionCtx) {
    this.stub = new StubRuntime(ctx);
    const pass = ctx.stage.scenePass("perspective", "perspective", 20);
    this.mesh = new Mesh(
      new BoxGeometry(200, 200, 60),
      new MeshBasicMaterial({ color: 0x2a5bff, toneMapped: false, wireframe: true }),
    );
    this.mesh.visible = false;
    pass.scene.add(this.mesh);
    this.actor = ctx.actors.register({
      name: "test-perspective",
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
    this.mesh.position.set(
      -0.22 * w,
      mix(0.18 * h, -0.18 * h, t),
      mix(0, 260, Math.sin(t * Math.PI)),
    );
    this.mesh.rotation.set(t * Math.PI * 1.5, t * Math.PI * 2, 0);
  }

  dispose(): void {
    this.stub.dispose();
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  return new AspirantsRuntime(ctx);
}
