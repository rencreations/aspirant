import {
  LinearFilter,
  Quaternion,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Camera,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { libUrl } from "@/lib/library";
import { loadMedia } from "@/lib/media-store";

import { fitCinematic, sampleTrack, type Bounds } from "./camera-math";
import { breatheBehaviour } from "./breath";
import { ClipPlayer, PICK_FADE } from "./clips";
import {
  changeTimes,
  FADE_TO_FIRST,
  FADE_TO_IDLE,
  FADE_TO_REST,
  legOf,
  otherForm,
  readForms,
  type ChangeTimes,
  type FormsLeg,
} from "./forms-plan";
import { clipsOf } from "./logic";
import { boundsOf, lightMaterials, type Insets } from "./scene-kit";
import { stickerOn, stickerShow, stickerSpring } from "./sticker-math";
import type { ClipRef, ModelView } from "./types";

/** What the panel shows of a view's clips. */
export interface ClipView {
  clips: ClipRef[];
  clip: string;
  playing: boolean;
  duration: number;
  keys: number[];
  forms?: Array<{ id: string; label: string }>;
  form?: string;
  /** A form change is running: the switch and the list wait. */
  changing: boolean;
  /** The view has the game's camera for each clip. */
  cinematic: boolean;
}

/** What a view does on the stage, every frame. */
export interface Behaviour {
  readonly root: Object3D;
  /** The model's box in the pose it opens with. */
  bounds: () => Bounds;
  /** One frame. True when something moved and the frame must be drawn. */
  update: (dt: number, camera: PerspectiveCamera) => boolean;
  /** The clip's time and length, for the timeline, or null. */
  tick?: () => { time: number; duration: number } | null;
  /** True once after the clip on show changed by itself (a form change moved on). */
  changed?: () => boolean;
  clipView?: () => ClipView | null;
  pick?: (id: string) => void;
  setForm?: (form: string) => void;
  setPlaying?: (playing: boolean) => void;
  seek?: (time: number) => void;
  step?: (direction: 1 | -1) => void;
  /** A cinematic view: put the camera where the clip has it. True when it did. */
  lead?: (
    camera: PerspectiveCamera,
    free: { aspect: number; share: number },
    insets: Insets,
    width: number,
    height: number,
  ) => boolean;
  /** The visitor took the camera. */
  release?: (camera: PerspectiveCamera) => void;
  /** The camera goes back to the clip. */
  follow?: () => void;
  /** What the camera turns round once the visitor has it. */
  target?: () => [number, number, number];
  /** The lens stays as the clip left it when the visitor takes the camera. */
  keepsLens?: () => boolean;
  warm?: (renderer: WebGLRenderer, scene: Scene, camera: Camera) => void;
  /** Numbers a probe can read (`window.__models.state().probe`). */
  probe?: () => Record<string, number>;
  dispose: () => void;
}

export interface BehaviourContext {
  anisotropy: number;
  renderer: WebGLRenderer;
}

function warmScene(renderer: WebGLRenderer, scene: Scene, camera: Camera): void {
  void renderer.compileAsync(scene, camera).catch(() => undefined);
}

/** A model that stands still: the visitor turns it. */
function still(gltf: GLTF, ctx: BehaviourContext): Behaviour {
  lightMaterials(gltf.scene, ctx.anisotropy);
  return {
    root: gltf.scene,
    bounds: () => boundsOf(gltf.scene),
    update: () => false,
    warm: warmScene,
    dispose: () => undefined,
  };
}

/** The extras of a file's default scene. */
function extrasOf(gltf: GLTF): Record<string, unknown> {
  return (gltf.scene.userData ?? {}) as Record<string, unknown>;
}

/** A view whose clips the visitor picks (Silverbolt), and the base of the cinematic view. */
function clips(
  view: ModelView,
  gltf: GLTF,
  ctx: BehaviourContext,
): Behaviour & { player: ClipPlayer } {
  lightMaterials(gltf.scene, ctx.anisotropy);
  const player = new ClipPlayer(gltf.scene, gltf.animations);
  const list = clipsOf(view).filter((c) => player.has(c.id));
  const first = view.defaultClip && player.has(view.defaultClip) ? view.defaultClip : list[0]?.id;
  if (first) player.play(first, { fade: 0 });
  const bounds = boundsOf(gltf.scene);
  const facts = () => player.factsOf(player.current);
  return {
    player,
    root: gltf.scene,
    bounds: () => bounds,
    update: (dt) => {
      player.update(dt);
      return true;
    },
    tick: () => ({ time: player.time, duration: player.duration }),
    clipView: () => ({
      clips: list,
      clip: player.current,
      playing: player.playing,
      duration: player.duration,
      keys: facts()?.keys ?? [],
      changing: false,
      cinematic: false,
    }),
    pick: (id) => {
      if (id === player.current) return;
      player.playing = true;
      player.play(id, { fade: PICK_FADE });
    },
    setPlaying: (p) => {
      player.playing = p;
    },
    seek: (t) => {
      player.seek(t);
    },
    step: (d) => {
      player.step(d);
    },
    warm: warmScene,
    dispose: () => {
      player.dispose();
    },
  };
}

interface CameraTrack {
  frames: number;
  keys: number[];
}

interface Cameras {
  fps: number;
  aspect: number;
  clips: Record<string, CameraTrack>;
}

interface StickerData {
  clip: string;
  bone: string;
  offset: [number, number, number];
  normal: [number, number, number];
  radius: number;
}

/** The owner's sticker, in the bucket beside the models. */
const STICKER_KEY = "models/v1/sticker.webp";

/**
 * Selena's Entrance: the clips of the game's entrance scene, each with the game's camera fitted to
 * the recording. The camera follows the clip until the visitor moves it (the clip plays on) and goes
 * back to it on "Default camera". In the idle, a sticker covers her bottom when the camera comes
 * close behind and under her.
 */
function cinematic(view: ModelView, gltf: GLTF, ctx: BehaviourContext): Behaviour {
  const base = clips(view, gltf, ctx);
  const player = base.player;
  const extras = extrasOf(gltf);
  const cams = extras.cameras as Cameras | undefined;
  let following = !!cams;
  /** A blend from where the visitor left the camera back to the clip's, 0 to 1. */
  let back = 1;
  const fromPos = new Vector3();
  const fromQuat = new Quaternion();
  let fromFov = 30;
  const key: number[] = [];
  const pos = new Vector3();
  const quat = new Quaternion();
  const quatB = new Quaternion();
  let slide = 0;
  const lastCam = new Vector3();
  const lastFwd = new Vector3(0, 0, -1);

  // The sticker.
  const sticker = extras.sticker as StickerData | undefined;
  const stickerBone = sticker ? gltf.scene.getObjectByName(sticker.bone) : undefined;
  let sprite: Sprite | null = null;
  let stickerTexture: Texture | null = null;
  const show = { value: 0, speed: 0 };
  const seen = { facing: 0, distance: 0 };
  let stickerIsOn = false;
  const at = new Vector3();
  const normal = new Vector3();
  const boneQ = new Quaternion();
  if (sticker && stickerBone) {
    const material = new SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false });
    sprite = new Sprite(material);
    sprite.renderOrder = 20;
    sprite.visible = false;
    gltf.scene.add(sprite);
    void loadMedia(libUrl(STICKER_KEY), { type: "image/webp" })
      .then((url) => new TextureLoader().loadAsync(url))
      .then((t) => {
        t.colorSpace = SRGBColorSpace;
        t.minFilter = LinearFilter;
        stickerTexture = t;
        material.map = t;
        material.needsUpdate = true;
      })
      .catch(() => undefined);
  }

  /** The middle of the subject: the hips, or the box. */
  const hips =
    gltf.scene.getObjectByName("Bip001_Pelvis") ??
    gltf.scene.getObjectByName("Bip001 Pelvis") ??
    gltf.scene.getObjectByName("Bip001");
  const bounds = base.bounds();
  const subject = (): [number, number, number] => {
    if (hips) {
      hips.getWorldPosition(at);
      return [at.x, at.y, at.z];
    }
    return [bounds.cx, bounds.cy, bounds.cz];
  };

  /** The camera of a clip at a time, into `pos`, `quat` and the returned lens. */
  const sample = (
    id: string,
    time: number,
    outPos: Vector3,
    outQuat: Quaternion,
    out: number[],
  ): number | null => {
    const track = cams?.clips[id];
    if (!cams || !track) return null;
    sampleTrack(track.keys, cams.fps, time, out);
    outPos.set(out[0] ?? 0, out[1] ?? 0, out[2] ?? 0);
    outQuat.set(out[3] ?? 0, out[4] ?? 0, out[5] ?? 0, out[6] ?? 1);
    return out[7] ?? 60;
  };

  return {
    ...base,
    update: (dt, camera) => {
      base.update(dt, camera);
      if (sprite && sticker && stickerBone) {
        stickerBone.updateWorldMatrix(true, false);
        at.set(...sticker.offset);
        stickerBone.localToWorld(at);
        stickerBone.getWorldQuaternion(boneQ);
        normal
          .set(...sticker.normal)
          .applyQuaternion(boneQ)
          .normalize();
        const weight = player.weightOf(sticker.clip);
        const dx = camera.position.x - at.x;
        const dy = camera.position.y - at.y;
        const dz = camera.position.z - at.z;
        seen.distance = Math.hypot(dx, dy, dz);
        seen.facing =
          (dx * normal.x + dy * normal.y + dz * normal.z) / Math.max(1e-6, seen.distance);
        const goal =
          weight *
          stickerShow({
            dx: camera.position.x - at.x,
            dy: camera.position.y - at.y,
            dz: camera.position.z - at.z,
            nx: normal.x,
            ny: normal.y,
            nz: normal.z,
            radius: sticker.radius,
          });
        stickerIsOn = stickerOn(stickerIsOn, goal);
        stickerSpring(show, stickerIsOn ? 1 : 0, dt);
        sprite.visible = show.value > 0.002 && stickerTexture !== null;
        // It stands a little out of the body, toward the camera's side, so nothing cuts it.
        sprite.position.copy(at).addScaledVector(normal, sticker.radius * 0.35);
        const size = sticker.radius * 2.3 * Math.max(0, show.value);
        sprite.scale.set(size, size, 1);
        sprite.material.opacity = Math.min(1, show.value * 1.25);
      }
      return true;
    },
    clipView: () => {
      const v = base.clipView?.() ?? null;
      return v ? { ...v, cinematic: !!cams } : null;
    },
    lead: (camera, free, insets, width, height) => {
      if (!following || !cams) return false;
      const id = player.current;
      const lens = sample(id, player.time, pos, quat, key);
      if (lens === null) return false;
      // The game's wide frame fitted into the screen. On a wide screen the whole canvas holds it (the
      // panels are thin words over it, and a frame squeezed between them needs a lens so wide it
      // bends her); on a tall one, the part above the controls at the foot.
      const wide = width >= height;
      const area = wide ? { aspect: width / height, share: 1 } : free;
      const fit = fitCinematic(lens, cams.aspect, area.aspect);
      const t = Math.tan((fit.vfov * Math.PI) / 360) / Math.max(0.05, area.share);
      let vfov = (2 * Math.atan(t) * 180) / Math.PI;
      if (back < 1) {
        back = Math.min(1, back + 1 / 36);
        const e = 1 - (1 - back) * (1 - back) * (1 - back);
        pos.lerpVectors(fromPos, pos, e);
        quatB.copy(fromQuat).slerp(quat, e);
        quat.copy(quatB);
        vfov = fromFov + (vfov - fromFov) * e;
      }
      camera.position.copy(pos);
      camera.quaternion.copy(quat);
      camera.fov = vfov;
      lastCam.copy(pos);
      lastFwd.set(0, 0, -1).applyQuaternion(quat);
      // On a phone the window slides to keep her in the middle, never past the frame's edge.
      const cx = wide ? width / 2 : insets.left + (width - insets.left - insets.right) / 2;
      const cy = wide ? height / 2 : insets.top + (height - insets.top - insets.bottom) / 2;
      let shift = 0;
      if (fit.spare > 0) {
        camera.updateMatrixWorld();
        const [sx, sy, sz] = subject();
        const local = at.set(sx, sy, sz).applyMatrix4(camera.matrixWorldInverse);
        const tanX = local.z < -1e-4 ? local.x / -local.z : 0;
        const goal = Math.max(-fit.spare, Math.min(fit.spare, tanX));
        slide += (goal - slide) * 0.08;
        const halfTanView = Math.tan((vfov * Math.PI) / 360) * (width / height);
        shift = (slide / Math.max(1e-4, halfTanView)) * (width / 2);
      } else {
        slide = 0;
      }
      camera.aspect = width / height;
      camera.setViewOffset(width, height, width / 2 - cx + shift, height / 2 - cy, width, height);
      camera.updateProjectionMatrix();
      return true;
    },
    release: (camera) => {
      if (!following) return;
      following = false;
      fromPos.copy(camera.position);
      fromQuat.copy(camera.quaternion);
      fromFov = camera.fov;
    },
    follow: () => {
      if (following || !cams) return;
      following = true;
      back = 0;
    },
    // The visitor turns round the point the clip's camera looks at, at the subject's distance, so
    // taking the camera never jumps its aim.
    target: () => {
      const [sx, sy, sz] = subject();
      const d = Math.max(0.2, Math.hypot(lastCam.x - sx, lastCam.y - sy, lastCam.z - sz));
      return [lastCam.x + lastFwd.x * d, lastCam.y + lastFwd.y * d, lastCam.z + lastFwd.z * d];
    },
    keepsLens: () => !!cams,
    probe: () => ({
      sticker: show.value,
      facing: seen.facing,
      distance: seen.distance,
      following: following ? 1 : 0,
    }),
    pick: (id) => {
      base.pick?.(id);
    },
    dispose: () => {
      base.dispose();
      sprite?.material.dispose();
      stickerTexture?.dispose();
    },
  };
}

/**
 * Selena In Game: her two forms in one file, each on its own skeleton. One shows at a time with
 * its clips. The switch runs the owner's sequence (`forms-plan.ts`): blend into the idle, the first
 * transform clip, the swap where the game sends the form under the ground, the second clip on the
 * other form, then its idle.
 */
function forms(view: ModelView, gltf: GLTF, ctx: BehaviourContext): Behaviour {
  lightMaterials(gltf.scene, ctx.anisotropy);
  const data = readForms(extrasOf(gltf).forms);
  const rootName = (f: "normal" | "abyssal") => data?.roots[f] ?? f;
  const roots = {
    normal: gltf.scene.getObjectByName(rootName("normal")) ?? gltf.scene,
    abyssal: gltf.scene.getObjectByName(rootName("abyssal")) ?? null,
  };
  const byForm = (prefix: string) => gltf.animations.filter((c) => c.name.startsWith(`${prefix}/`));
  const players = {
    normal: new ClipPlayer(roots.normal, byForm("normal")),
    abyssal: roots.abyssal ? new ClipPlayer(roots.abyssal, byForm("abyssal")) : null,
  };
  let form: "normal" | "abyssal" = "normal";
  if (roots.abyssal) roots.abyssal.visible = false;
  const idleOf = (f: string) => `${f}/idle`;
  const playerOf = (f: string): ClipPlayer | null =>
    f === "abyssal" ? players.abyssal : players.normal;
  const firstClip =
    view.defaultClip && players.normal.has(view.defaultClip) ? view.defaultClip : idleOf("normal");
  players.normal.play(firstClip, { fade: 0 });
  const bounds = boundsOf(roots.normal);

  // A change in progress.
  let change: {
    leg: FormsLeg;
    from: "normal" | "abyssal";
    to: "normal" | "abyssal";
    clock: number;
    times: ChangeTimes;
    stage: "idle" | "first" | "second" | "rest";
  } | null = null;
  let changedFlag = false;

  const current = () => playerOf(form) ?? players.normal;
  const factsNow = () => current().factsOf(current().current);

  const step = (dt: number) => {
    if (!change || !data) return;
    const c = change;
    c.clock += dt;
    const a = playerOf(c.from);
    const b = playerOf(c.to);
    const rootA = roots[c.from];
    const rootB = roots[c.to];
    if (!a || !b || !rootA || !rootB) {
      change = null;
      return;
    }
    if (c.stage === "idle" && c.clock >= c.times.firstAt) {
      a.play(c.leg.first, { fade: FADE_TO_FIRST, loop: false });
      c.stage = "first";
      changedFlag = true;
    }
    // The hide time may sit a hair past the end of a trimmed clip (it is rounded): the end counts too.
    const hideAt = Math.min(c.leg.hideAt, a.duration) - 1e-3;
    if (c.stage === "first" && a.current === c.leg.first && (a.time >= hideAt || a.finished)) {
      // The game sends the form under the ground here: it is hidden and the other takes over.
      rootA.visible = false;
      rootB.visible = true;
      b.playing = true;
      b.play(c.leg.second, { fade: 0, from: c.leg.secondFrom, loop: false });
      form = c.to;
      c.stage = "second";
      changedFlag = true;
    }
    if (c.stage === "second" && b.current === c.leg.second) {
      const left = b.duration - b.time;
      if (left <= FADE_TO_REST + 1e-3 || b.finished) {
        b.play(idleOf(c.to), { fade: FADE_TO_REST });
        c.stage = "rest";
        c.clock = 0;
        changedFlag = true;
      }
    }
    if (c.stage === "rest" && c.clock >= FADE_TO_REST) {
      change = null;
      changedFlag = true;
    }
  };

  return {
    root: gltf.scene,
    bounds: () => bounds,
    update: (dt) => {
      if (change) {
        // Both mixers run through the change, so the arriving form is posed the frame it shows.
        playerOf(change.from)?.update(dt);
        if (change.stage === "second" || change.stage === "rest") playerOf(change.to)?.update(dt);
        step(dt);
      } else {
        current().update(dt);
      }
      return true;
    },
    tick: () => ({ time: current().time, duration: current().duration }),
    changed: () => {
      const c = changedFlag;
      changedFlag = false;
      return c;
    },
    clipView: () => {
      const p = current();
      const list = clipsOf(view, form).filter((c) => p.has(c.id));
      return {
        clips: list,
        clip: p.current,
        playing: p.playing,
        duration: p.duration,
        keys: factsNow()?.keys ?? [],
        forms: (view.forms ?? []).map((f) => ({ id: f.id, label: f.label })),
        form,
        changing: change !== null,
        cinematic: false,
      };
    },
    pick: (id) => {
      if (change) return;
      const p = current();
      if (!p.has(id) || id === p.current) return;
      p.playing = true;
      p.play(id, { fade: PICK_FADE });
    },
    setForm: (to) => {
      if (change || !data || to === form || !players.abyssal) return;
      const from = form;
      const target = otherForm(from);
      if (target !== to) return;
      const a = current();
      a.playing = true;
      const leg = legOf(data, from);
      const second = playerOf(target)?.factsOf(leg.second);
      const resting = a.current === idleOf(from);
      change = {
        leg,
        from,
        to: target,
        clock: 0,
        times: changeTimes(leg, resting, second?.duration ?? 1),
        stage: "idle",
      };
      if (!resting) a.play(idleOf(from), { fade: FADE_TO_IDLE });
      changedFlag = true;
    },
    setPlaying: (p) => {
      if (change) return;
      current().playing = p;
    },
    seek: (t) => {
      if (change) return;
      current().seek(t);
    },
    step: (d) => {
      if (change) return;
      current().step(d);
    },
    warm: warmScene,
    dispose: () => {
      players.normal.dispose();
      players.abyssal?.dispose();
    },
  };
}

/** The behaviour of a view, built from its file. The companions' shows load their own code. */
export async function makeBehaviour(
  view: ModelView,
  gltf: GLTF,
  ctx: BehaviourContext,
): Promise<Behaviour> {
  switch (view.behaviour) {
    case "breathe":
      return breatheBehaviour(gltf, ctx);
    case "clips":
      return clips(view, gltf, ctx);
    case "cinematic":
      return cinematic(view, gltf, ctx);
    case "forms":
      return forms(view, gltf, ctx);
    case "drone":
    case "pair":
    case "bunny":
    case "tetra": {
      const { companionBehaviour } = await import("./companions");
      return companionBehaviour(view, gltf, ctx);
    }
    default:
      return still(gltf, ctx);
  }
}
