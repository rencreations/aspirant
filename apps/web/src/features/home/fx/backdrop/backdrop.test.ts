import { describe, expect, it } from "vitest";

import { ActorRegistry } from "../../kernel/actors";
import type { FrameInfo } from "../../kernel/types";
import type { Stage } from "../../kernel/stage";
import type { ActorCtx } from "../../actors/shared/types";
import { BackdropActor } from "./backdrop";
import { attachBackdrop, backdropHost, bindBackdrop } from "./host";
import { ensureBackdrop } from "./index";
import type { BackdropKind } from "./palettes";

const pointer = {
  state: {
    x: 0,
    y: 0,
    nx: 0,
    ny: 0,
    down: false,
    type: "mouse" as const,
    inside: false,
    speed: 0,
    hit: null,
  },
  add: () => () => undefined,
};

const frame = (dt = 1 / 60): FrameInfo => ({
  time: 0,
  dt,
  S: 0,
  raw: 0,
  velocity: 0,
  viewport: { w: 1440, h: 900, dpr: 1 },
  frame: 0,
  input: { wheel: 0 },
});

describe("BackdropActor without WebGL (no host)", () => {
  it("never throws: set, warm, snap, state, drawFrame and dispose all work as no-ops", async () => {
    const actor = new BackdropActor(null, pointer);
    expect(actor.available).toBe(false);
    expect(() => {
      actor.set("aurora", { theme: "storm", amount: 0.4, colors: ["#fff", "nope"] });
      actor.snap();
      actor.drawFrame(frame(), false);
    }).not.toThrow();
    await expect(actor.warm(["aurora", "beams"])).resolves.toBeUndefined();
    expect(actor.state().drawing).toBe(false);
    expect(actor.state().draws).toBe(0);
    actor.dispose();
    actor.dispose();
  });

  it("ignores a kind it does not know instead of throwing", () => {
    const actor = new BackdropActor(null, pointer);
    expect(() => {
      actor.set("not-a-kind" as unknown as BackdropKind);
    }).not.toThrow();
  });

  it("is made visible by a set, which is the whole of a section's contract", () => {
    const actor = new BackdropActor(null, pointer);
    expect(actor.visible).toBe(false);
    actor.set("beams");
    expect(actor.visible).toBe(true);
  });
});

describe("ensureBackdrop", () => {
  const ctx = (actors: ActorRegistry): ActorCtx =>
    ({
      stage: {} as Stage,
      actors,
      pointer,
      cursor: { set: () => undefined },
    }) as unknown as ActorCtx;

  it("makes one backdrop for every section that asks, registered as an actor", async () => {
    const actors = new ActorRegistry();
    const a = await ensureBackdrop(ctx(actors));
    const b = await ensureBackdrop(ctx(actors));
    expect(a).toBe(b);
    expect(actors.get("backdrop")).toBe(a);
  });

  it("is hidden by the kernel's hide-by-default rule until a section sets it again", async () => {
    const actors = new ActorRegistry();
    const backdrop = await ensureBackdrop(ctx(actors));
    backdrop.set("silk");
    expect(backdrop.visible).toBe(true);
    actors.hideAll();
    expect(backdrop.visible).toBe(false);
    backdrop.set("silk");
    expect(backdrop.visible).toBe(true);
  });

  it("resolves to a working no-op when the engine bound no host", async () => {
    const backdrop = await ensureBackdrop(ctx(new ActorRegistry()));
    expect(backdrop.state().available).toBe(false);
  });
});

describe("the host binding", () => {
  it("hands the host to the backdrop and runs its draw from the engine's frame", () => {
    const stage = {} as Stage;
    const host = document.createElement("div");
    const bound = bindBackdrop(stage, host);
    expect(backdropHost(stage)).toBe(host);
    const seen: boolean[] = [];
    let disposed = 0;
    attachBackdrop(stage, {
      drawFrame: (_f, jumped) => seen.push(jumped),
      dispose: () => {
        disposed += 1;
      },
    });
    bound.draw(frame(), true);
    bound.draw(frame(), false);
    expect(seen).toEqual([true, false]);
    bound.dispose();
    expect(disposed).toBe(1);
    expect(backdropHost(stage)).toBeNull();
    bound.draw(frame(), false);
    expect(seen).toHaveLength(2);
  });

  it("is a no-op for a page without a host, and before any backdrop exists", () => {
    const stage = {} as Stage;
    const bound = bindBackdrop(stage, null);
    expect(backdropHost(stage)).toBeNull();
    expect(() => {
      bound.draw(frame(), false);
      bound.dispose();
    }).not.toThrow();
  });
});
