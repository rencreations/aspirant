import {
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  LinearFilter,
  NeutralToneMapping,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type MeshPhysicalMaterial,
} from "three";

import { buildDiscKit, type DiscKit } from "./disc-materials";
import { DISC } from "./disc-shape";
import {
  FIELD,
  ROW,
  arcPose,
  arrival,
  clamp,
  easeOutCubic,
  followShare,
  frontSlot,
  glideEase,
  glideFor,
  mod,
  nearestSlot,
  rowPose,
  slotsAround,
  type GlideSource,
  type Pose,
} from "./field";
import { isUpright, nearestTurn, planRest, restAt, TURN, type RestPlan } from "./spin";
import { TraceMesh, type TraceTarget } from "./trace-mesh";
import { WheelSteps, wheelDelta } from "./wheel";

/** One track as the scene needs it: its printed face and the shape of its sound. */
interface FieldTrack {
  face: HTMLCanvasElement;
  wave: Float32Array;
}

/** What plays, read every frame. */
export interface Playback {
  /** The track that is loaded in the player, or null. */
  track: number | null;
  playing: boolean;
  /** 0 to 1 of the track. */
  progress: number;
  /** The loudness of the sound right now, 0 to 1. */
  level: number;
}

export interface FieldOptions {
  /** The element the canvas is added to. */
  host: HTMLElement;
  /** The element that receives the pointer and the wheel (the stage, which holds the words too). */
  surface: HTMLElement;
  tracks: FieldTrack[];
  /** The track in front at the start. */
  start: number;
  /** The colour of the page, which far discs fade into. */
  fog: string;
  /** Another track came to the front. */
  onFront: (track: number) => void;
  /** A press on the disc in front. */
  onPress: (track: number) => void;
  /** The pointer is on the disc in front, or left it. */
  onHoverFront?: (on: boolean) => void;
  playback: () => Playback;
}

interface Push {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  vrx: number;
  vry: number;
}

interface Rig {
  slot: number | null;
  /** Its place in the field. */
  root: Group;
  /** Turned by a drag and by a press. */
  turn: Group;
  /** The record's own turn while it plays. */
  spin: Group;
  faceMat: MeshPhysicalMaterial;
  pick: Mesh;
  /** Just given a slot: it takes its place at once (from the side it came in). */
  fresh: boolean;
  enter: number;
  hover: number;
  push: Push;
  tiltX: number;
  tiltY: number;
  /** The turn going back to rest after a drag: from where, to which whole turn, since when. */
  settle: { x: number; y: number; toX: number; toY: number; at: number } | null;
  /** The record's own turn (radians; it falls as the record turns clockwise). */
  angle: number;
  /** How fast it turns, radians a second, clockwise. */
  omega: number;
  /** The way back to an upright picture once its track stops (see `spin.ts`), and since when. */
  rest: (RestPlan & { at: number }) | null;
  /** When it was last pressed (ms), for the small press. */
  pressAt: number;
  visible: boolean;
}

/** Turns per second of a playing record, about 20 a minute. */
const SPIN = (Math.PI * 2 * 20) / 60;
/** Most pixels the canvas draws (the pixel ratio comes down above it). The same for everyone. */
const PIXEL_BUDGET = 12e6;
const MAX_DPR = 2;
const DRAG_START = 5;
const FRICTION = 0.89;
const SNAP_FREQ = 9.5;
const SNAP_DAMP = 12;
const WIPE_MIN = 9;
const PRESS_DEPTH = 0.55;
const PRESS_TILT = 1.5;
const HOVER_TILT = 0.21;
/** How long after a scroll the line stays drawn on the disc in front (ms). */
const SCROLL_TRACE_MS = 1400;

function freshPush(): Push {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, vrx: 0, vry: 0 };
}

/** The small press of a disc: down to 94 percent, a spring past its size, then back. */
function pressScale(ms: number): number {
  if (ms < 0) return 1;
  const s = ms / 1000;
  if (s < 0.12) return 1 - 0.06 * easeOutCubic(s / 0.12);
  if (s < 0.28) return 0.94 + 0.075 * easeOutCubic((s - 0.12) / 0.16);
  if (s < 0.5) return 1.015 - 0.015 * easeOutCubic((s - 0.28) / 0.22);
  return 1;
}

/** A turn past half a circle meets more and more resistance. */
function resist(angle: number, delta: number): number {
  const max = Math.PI;
  const over = Math.max(0, Math.abs(angle) - max * 0.8) / max;
  const k = 1 / (1 + over * over * 14);
  return angle + delta * (Math.sign(delta) === Math.sign(angle) || angle === 0 ? k : 1);
}

/**
 * The field of discs: one WebGL scene, drawn only while something moves. It owns the motion
 * (the glide between discs, the drag with its throw and its spring, the lean while moving, the
 * small pushes of the pointer and of a press, the spin of the playing record and the two drawn
 * lines) and tells the page which track is in front. The page owns the words and the sound.
 */
export class DiscField {
  private readonly o: FieldOptions;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FIELD.fov, 1, 0.1, 100);
  private readonly field = new Group();
  private readonly kit: DiscKit;
  private readonly textures: CanvasTexture[] = [];
  private readonly rigs: Rig[] = [];
  private readonly bySlot = new Map<number, Rig>();
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2(2, 2);
  private readonly inverse = new Quaternion();
  private readonly tmp = new Vector3();
  private readonly frontTrace: TraceMesh;
  private readonly playTrace: TraceMesh;
  private readonly wheel = new WheelSteps();
  private readonly count: number;
  private readonly cleanups: Array<() => void> = [];

  private width = 1;
  private row = false;
  private fieldScale: number = FIELD.scale;
  /** On a row, how many discs a swipe across the whole screen moves. */
  private swipeSpan = 2;

  private pos: number;
  private glide: { from: number; to: number; at: number; dur: number } | null = null;
  private inertia = 0;
  private spring = 0;
  private flow = 0;
  private lastPos: number;
  private front: number;

  private down: {
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    lastAt: number;
    touch: boolean;
    disc: number | null;
    slotUnder: number | null;
    dragging: "field" | "disc" | null;
    v: number;
  } | null = null;
  private clickBlockUntil = 0;
  private pointerMoved = false;
  private pointerIn = false;
  private mouse = false;
  private pointerSpeed = { x: 0, y: 0 };
  private pointerLast = { x: 0, y: 0, at: 0 };
  private hovered: number | null = null;
  private hoverFront = false;
  private focused = false;
  private scrolledAt = -Infinity;
  private cursor = "";

  /** The entrance: null before it starts (everything waits, hidden), then its start time. */
  private entranceAt: number | null = null;
  private entranceDone = false;

  private raf = 0;
  private last = 0;
  private frames = 3;
  private disposed = false;
  private lost = false;

  constructor(opts: FieldOptions) {
    this.o = opts;
    this.count = opts.tracks.length;
    this.pos = opts.start;
    this.lastPos = opts.start;
    this.front = mod(opts.start, this.count);

    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;
    const canvas = renderer.domElement;
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;";
    opts.host.appendChild(canvas);

    this.kit = buildDiscKit(renderer);
    this.scene.environment = this.kit.environment;
    this.scene.fog = new Fog(new Color(opts.fog), 7, 14);
    this.camera.position.set(0, 0, FIELD.cameraZ);
    this.camera.lookAt(0, 0, 0);
    this.field.rotation.set(FIELD.tiltX, FIELD.tiltY, 0);
    this.field.scale.setScalar(FIELD.scale);
    this.scene.add(this.field);

    this.scene.add(new AmbientLight(0xffffff, 0.25));
    const key = new DirectionalLight(0xfff9e8, 0.75);
    key.position.set(3.5, -8, 6);
    const fill = new DirectionalLight(0xffffff, 0.3);
    fill.position.set(-5, -2, 4);
    const rim = new DirectionalLight(0x499ff5, 0.75);
    rim.position.set(0, 3, -6);
    const top = new DirectionalLight(0xffffff, 0.55);
    top.position.set(0, 3.2, 3);
    this.scene.add(key, fill, rim, top);

    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    for (const t of opts.tracks) {
      const tex = new CanvasTexture(t.face);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = anisotropy;
      tex.minFilter = LinearMipmapLinearFilter;
      tex.magFilter = LinearFilter;
      tex.generateMipmaps = true;
      this.textures.push(tex);
      renderer.initTexture(tex);
    }

    // Enough discs for every slot that can be on screen, and two to spare.
    const pool = FIELD.reach * 2 + 3;
    for (let i = 0; i < pool; i += 1) this.rigs.push(this.makeRig());

    this.frontTrace = new TraceMesh({
      ink: "#0b0b0e",
      accent: "#0b0b0e",
      faint: 0.86,
      inTime: 0.9,
      outTime: 0.45,
      head: false,
    });
    this.playTrace = new TraceMesh({
      ink: "#0b0b0e",
      accent: "#7c4dff",
      faint: 0.2,
      inTime: 1.1,
      outTime: 0.5,
      head: true,
    });
    this.field.add(this.frontTrace.group, this.playTrace.group);

    this.bind();
    this.resize();
    this.layout(0, true);
    this.compile();
    this.renderer.render(this.scene, this.camera);
  }

  // Building ----------------------------------------------------------------------------------

  private makeRig(): Rig {
    const k = this.kit;
    const root = new Group();
    const turn = new Group();
    const spin = new Group();
    root.add(turn);
    turn.add(spin);
    const faceMat = k.faceMaterial(this.textures[0] ?? k.faceNormal);
    const half = DISC.thickness / 2;
    const face = new Mesh(k.face, faceMat);
    face.position.z = half + 6e-4;
    const back = new Mesh(k.back, k.backMat);
    back.position.z = -half - 6e-4;
    back.rotation.y = Math.PI;
    const rim = new Mesh(k.rim, k.rimMat);
    const clear = new Mesh(k.clear, k.clearMat);
    const metal = new Mesh(k.metal, k.metalMat);
    const frost = new Mesh(k.frost, k.frostMat);
    spin.add(face, back, rim, clear, metal, frost);
    const pick = new Mesh(k.pick, k.pickMat);
    root.add(pick);
    root.visible = false;
    this.field.add(root);
    return {
      slot: null,
      root,
      turn,
      spin,
      faceMat,
      pick,
      fresh: false,
      enter: 0,
      hover: 0,
      push: freshPush(),
      tiltX: 0,
      tiltY: 0,
      settle: null,
      angle: 0,
      omega: 0,
      rest: null,
      pressAt: -1,
      visible: false,
    };
  }

  /**
   * A disc that leaves its slot forgets its turns. A disc is pooled and shows another track when it
   * comes back, so a turn it kept would show that track turned (or upside down).
   */
  private clearTurns(rig: Rig): void {
    rig.tiltX = rig.tiltY = 0;
    rig.settle = null;
    rig.angle = 0;
    rig.omega = 0;
    rig.rest = null;
    rig.spin.rotation.z = 0;
    rig.turn.rotation.set(0, 0, 0);
  }

  /** Compile every program now, behind the curtain, so the first frames do not stall. */
  private compile(): void {
    const shown = this.rigs.map((r) => r.root.visible);
    this.rigs.forEach((r) => {
      r.root.visible = true;
    });
    this.frontTrace.group.visible = true;
    this.playTrace.group.visible = true;
    this.renderer.compile(this.scene, this.camera);
    this.rigs.forEach((r, i) => {
      r.root.visible = shown[i] ?? false;
    });
    this.frontTrace.group.visible = false;
    this.playTrace.group.visible = false;
  }

  // Public ------------------------------------------------------------------------------------

  /** The field is a row (a narrow screen). */
  get isRow(): boolean {
    return this.row;
  }

  /** Glide to a track, the short way round. */
  goTo(track: number, source: GlideSource = "click"): void {
    const from = this.glide ? this.glide.to : this.pos;
    this.glideTo(nearestSlot(from, mod(track, this.count), this.count), source);
  }

  /** Glide one disc on (1) or back (-1). */
  step(dir: 1 | -1, source: GlideSource = "key"): void {
    const from = this.glide ? this.glide.to : frontSlot(this.pos);
    this.glideTo(from + dir, source);
    if (source === "key") this.scrolledAt = performance.now();
  }

  /** Keyboard focus is on the field: the line is drawn on the disc in front. */
  setFocused(on: boolean): void {
    this.focused = on;
    this.wake();
  }

  /** The press of the disc in front, shown (for a press by key). */
  pressFront(): void {
    const rig = this.bySlot.get(frontSlot(this.pos));
    if (!rig) return;
    rig.pressAt = performance.now();
    rig.push.vz -= PRESS_DEPTH * 0.6;
    this.wake();
  }

  /** The discs arrive: the one in front grows from nothing, the others fan in after it. */
  playEntrance(): void {
    this.entranceAt = performance.now();
    this.wake();
  }

  /** Draw again (the sound started or stopped, the page changed something). */
  wake(frames = 2): void {
    this.frames = Math.max(this.frames, frames);
    if (this.raf || this.disposed || this.lost || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** For looking at the scene while it is tuned (development only). */
  get parts(): { kit: DiscKit; renderer: WebGLRenderer; scene: Scene } {
    return { kit: this.kit, renderer: this.renderer, scene: this.scene };
  }

  /**
   * A read-only look at the discs on screen, for the probes and the specs: which track each shows,
   * whether it is in front, and its turns (radians). `upright` is true when every turn is a whole
   * number of turns and nothing is still moving it back.
   */
  snapshot(): {
    pos: number;
    discs: Array<{
      slot: number;
      track: number;
      front: boolean;
      spin: number;
      tiltX: number;
      tiltY: number;
      settling: boolean;
      upright: boolean;
    }>;
  } {
    const fs = frontSlot(this.pos);
    const whole = (a: number) => isUpright(a, 1e-4);
    const discs = this.rigs
      .filter((r) => r.slot !== null && r.visible)
      .map((r) => {
        const slot = r.slot ?? 0;
        const spin = r.spin.rotation.z;
        const tiltX = r.turn.rotation.x;
        const tiltY = r.turn.rotation.y;
        const settling = r.rest !== null || r.settle !== null || r.omega !== 0;
        return {
          slot,
          track: mod(slot, this.count),
          front: slot === fs,
          spin,
          tiltX,
          tiltY,
          settling,
          upright: !settling && whole(spin) && whole(tiltX) && whole(tiltY),
        };
      })
      .sort((a, b) => a.slot - b.slot);
    return { pos: this.pos, discs };
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanups.forEach((f) => {
      f();
    });
    this.frontTrace.dispose();
    this.playTrace.dispose();
    this.textures.forEach((t) => {
      t.dispose();
    });
    this.kit.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  // Motion ------------------------------------------------------------------------------------

  private glideTo(target: number, source: GlideSource): void {
    const dist = Math.abs(target - this.pos);
    const { duration, kick } = glideFor(source, dist);
    this.inertia = 0;
    this.spring = 0;
    if (kick) {
      const dir = Math.sign(target - this.pos);
      if (dir) this.flow = clamp(this.flow + dir * kick, -12, 12);
    }
    this.glide = { from: this.pos, to: target, at: performance.now(), dur: duration * 1000 };
    this.wake(3);
  }

  private stopMotion(): void {
    this.glide = null;
    this.inertia = 0;
    this.spring = 0;
  }

  /** The disc under the pointer (a slot), and where on the disc it is (-1 to 1). */
  private pickAt(clientX: number, clientY: number): { slot: number; u: number; v: number } | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const picks = this.rigs.filter((g) => g.slot !== null && g.visible).map((g) => g.pick);
    const hit = this.raycaster.intersectObjects(picks, false)[0];
    if (!hit) return null;
    const rig = this.rigs.find((g) => g.pick === hit.object);
    if (rig?.slot == null) return null;
    return { slot: rig.slot, u: (hit.uv?.x ?? 0.5) * 2 - 1, v: (hit.uv?.y ?? 0.5) * 2 - 1 };
  }

  private setCursor(value: string): void {
    if (value === this.cursor) return;
    this.cursor = value;
    this.o.surface.style.cursor = value;
  }

  private isUi(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      !!target.closest("a, button, input, select, textarea, label, [data-ui]")
    );
  }

  private bind(): void {
    const s = this.o.surface;
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | Window | Document,
      type: K | string,
      fn: (e: never) => void,
      opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => {
        el.removeEventListener(type, fn as EventListener, opts);
      });
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || this.isUi(e.target)) return;
      const hit = this.pickAt(e.clientX, e.clientY);
      const now = performance.now();
      const frontish = hit && Math.abs(hit.slot - this.pos) < 0.6 ? hit.slot : null;
      this.down = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        lastAt: now,
        touch: e.pointerType !== "mouse",
        disc: frontish,
        slotUnder: hit?.slot ?? null,
        dragging: null,
        v: 0,
      };
      this.hovered = hit?.slot ?? null;
      window.addEventListener("pointermove", onDrag, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    };

    const onDrag = (e: PointerEvent) => {
      const d = this.down;
      if (d?.id !== e.pointerId) return;
      if (!d.dragging) {
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.hypot(dx, dy) < DRAG_START) return;
        // A finger moving sideways moves the field, even on the disc in front.
        const turnDisc = d.disc !== null && !(d.touch && Math.abs(dx) >= Math.abs(dy));
        d.dragging = turnDisc ? "disc" : "field";
        this.stopMotion();
        this.wheel.reset();
        if (turnDisc) {
          const rig = this.bySlot.get(d.disc ?? NaN);
          if (rig) rig.settle = null;
        }
        this.setCursor("grabbing");
        try {
          s.setPointerCapture(e.pointerId);
        } catch {
          /* the pointer is gone */
        }
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      const dt = Math.max(8, now - d.lastAt);
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.lastAt = now;
      if (d.dragging === "disc") {
        const rig = this.bySlot.get(d.disc ?? NaN);
        if (rig) {
          const k = 0.95 * 0.0045;
          rig.tiltY = resist(rig.tiltY, dx * k);
          rig.tiltX = resist(rig.tiltX, dy * k);
        }
      } else {
        const span = d.touch ? this.swipeSpan : 6 * 0.95;
        const move = -(dx / this.width) * span;
        this.pos += move;
        const v = clamp((16.667 / dt) * move, -0.5, 0.5);
        d.v += (v - d.v) * 0.32;
      }
      this.wake();
    };

    const finish = (cancelled: boolean, e?: PointerEvent) => {
      const d = this.down;
      if (!d) return;
      this.down = null;
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      try {
        if (s.hasPointerCapture(d.id)) s.releasePointerCapture(d.id);
      } catch {
        /* ignore */
      }
      this.setCursor(this.hovered !== null ? "pointer" : "grab");
      if (d.dragging === "disc") {
        const rig = this.bySlot.get(d.disc ?? NaN);
        // Back to the nearest whole turn on each axis, so the face comes back upright.
        if (rig)
          rig.settle = {
            x: rig.tiltX,
            y: rig.tiltY,
            toX: nearestTurn(rig.tiltX),
            toY: nearestTurn(rig.tiltY),
            at: performance.now(),
          };
        this.clickBlockUntil = performance.now() + 140;
        this.wake();
        return;
      }
      if (d.dragging === "field") {
        this.clickBlockUntil = performance.now() + 140;
        if (cancelled) {
          this.glideTo(Math.round(this.pos), "snap");
        } else if (d.touch) {
          const dir = Math.abs(d.v) >= 0.035 ? Math.sign(d.v) : 0;
          const to =
            dir > 0
              ? Math.floor(this.pos) + 1
              : dir < 0
                ? Math.ceil(this.pos) - 1
                : Math.round(this.pos);
          this.glideTo(to, "flick");
        } else {
          this.inertia = d.v;
        }
        this.wake();
        return;
      }
      // A press without a drag.
      if (cancelled || !e || performance.now() < this.clickBlockUntil) return;
      const hit = this.pickAt(e.clientX, e.clientY);
      if (!hit) return;
      const rig = this.bySlot.get(hit.slot);
      if (rig) {
        rig.push.vz -= PRESS_DEPTH;
        rig.push.vry += hit.u * PRESS_TILT;
        rig.push.vrx -= hit.v * PRESS_TILT;
      }
      if (hit.slot === frontSlot(this.pos) && !this.glide) {
        if (rig) rig.pressAt = performance.now();
        this.o.onPress(mod(hit.slot, this.count));
      } else {
        this.glideTo(hit.slot, "click");
      }
      this.wake(3);
    };
    const onUp = (e: PointerEvent) => {
      finish(false, e);
    };
    const onCancel = () => {
      finish(true);
    };

    const onMove = (e: PointerEvent) => {
      this.pointerIn = true;
      this.mouse = e.pointerType === "mouse";
      if (this.down || !this.mouse) return;
      const now = performance.now();
      const gap = now - this.pointerLast.at;
      if (gap < 120) {
        const k = 16.7 / Math.max(8, gap);
        this.pointerSpeed = {
          x: (e.clientX - this.pointerLast.x) * k,
          y: (e.clientY - this.pointerLast.y) * k,
        };
      } else this.pointerSpeed = { x: 0, y: 0 };
      this.pointerLast = { x: e.clientX, y: e.clientY, at: now };
      const r = this.renderer.domElement.getBoundingClientRect();
      this.ndc.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      this.pointerMoved = true;
      this.wake();
    };
    const onLeave = () => {
      this.pointerIn = false;
      if (this.down) return;
      this.pointerMoved = false;
      this.setHovered(null);
      this.wake();
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const step = this.wheel.push(
        wheelDelta(e, { width: window.innerWidth, height: window.innerHeight }),
        performance.now(),
      );
      if (step) {
        this.scrolledAt = performance.now();
        this.step(step, "wheel");
      }
    };

    on(s, "pointerdown", onDown, { capture: true });
    on(s, "pointermove", onMove, { passive: true });
    on(s, "pointerleave", onLeave);
    on(s, "wheel", onWheel, { passive: false, capture: true });
    on(document, "visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else this.wake(3);
    });
    on(window, "blur", () => {
      if (this.down) finish(true);
    });
    const canvas = this.renderer.domElement;
    on(canvas, "webglcontextlost", (e: Event) => {
      e.preventDefault();
      this.lost = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    });
    on(canvas, "webglcontextrestored", () => {
      // The pictures come back by themselves; the light was drawn into the lost context.
      this.lost = false;
      this.scene.environment = this.kit.renewEnvironment();
      this.wake(3);
    });
    const ro = new ResizeObserver(() => {
      this.resize();
      this.wake(3);
    });
    ro.observe(this.o.host);
    this.cleanups.push(() => {
      ro.disconnect();
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    });
    s.setAttribute("data-lenis-prevent", "");
    this.setCursor("grab");
  }

  private setHovered(slot: number | null): void {
    this.hovered = slot;
    const front = slot !== null && slot === frontSlot(this.pos);
    if (front !== this.hoverFront) {
      this.hoverFront = front;
      this.o.onHoverFront?.(front);
    }
    if (!this.down) this.setCursor(slot !== null ? "pointer" : "grab");
  }

  private resize(): void {
    const w = Math.max(1, this.o.host.clientWidth);
    const h = Math.max(1, this.o.host.clientHeight);
    this.width = w;
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (w * h * dpr * dpr > PIXEL_BUDGET) dpr = Math.sqrt(PIXEL_BUDGET / (w * h));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.row = w <= ROW.maxWidth;
    this.inverse.setFromEuler(this.field.rotation).invert();
    this.fit(h);
    // Move the picture (not the field): right and down on a wide screen, down on a row.
    const sx = this.row ? 0 : FIELD.shiftX * w;
    const sy = (this.row ? ROW.shiftY : FIELD.shiftY) * h;
    this.camera.setViewOffset(w, h, -sx, -sy, w, h);
  }

  /** On a row, scale the field so the neighbours peek in at the edges and the front disc fits. */
  private fit(height: number): void {
    if (!this.row) {
      // The discs grow with the height of the screen and the words do not: on a short screen the
      // field is a little smaller, so the row under the front disc stays clear of it.
      this.fieldScale = FIELD.scale * clamp(height / FIELD.fullHeight, FIELD.minFit, 1);
      this.field.scale.setScalar(this.fieldScale);
      this.swipeSpan = 2;
      return;
    }
    const sideX = (scale: number) => {
      const p = rowPose(1, false, 0);
      this.tmp.set(p.x * scale, p.y * scale, p.z * scale).project(this.camera);
      return Math.abs(this.tmp.x);
    };
    let lo = FIELD.scale * 0.3;
    let hi = FIELD.scale * 3;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (sideX(mid) > ROW.peek) hi = mid;
      else lo = mid;
    }
    let scale = (lo + hi) / 2;
    this.tmp.set(0, ROW.frontScale * scale, 0).project(this.camera);
    if (this.tmp.y > ROW.maxHeight) scale *= ROW.maxHeight / this.tmp.y;
    this.fieldScale = scale;
    this.field.scale.setScalar(scale);
    const reach = sideX(scale);
    this.swipeSpan = reach > 0.05 ? clamp(2 / reach, 1, 4) : 2;
  }

  /** Give the slots near `pos` a disc, free the others. */
  private assign(): void {
    const want = slotsAround(this.pos, FIELD.reach);
    const keep = new Set(want);
    for (const [slot, rig] of this.bySlot) {
      if (keep.has(slot)) continue;
      this.bySlot.delete(slot);
      rig.slot = null;
      rig.root.visible = false;
      rig.visible = false;
      rig.hover = 0;
      rig.push = freshPush();
      rig.pressAt = -1;
      this.clearTurns(rig);
    }
    const moving = this.glide !== null || this.inertia !== 0 || this.down?.dragging === "field";
    for (const slot of want) {
      if (this.bySlot.has(slot)) continue;
      const rig = this.rigs.find((r) => r.slot === null);
      if (!rig) break;
      rig.slot = slot;
      this.clearTurns(rig);
      rig.fresh = true;
      rig.enter = moving ? Math.sign(slot - this.pos) || 1 : 0;
      rig.root.visible = true;
      rig.visible = true;
      const tex = this.textures[mod(slot, this.count)];
      if (tex && rig.faceMat.map !== tex) {
        rig.faceMat.map = tex;
        rig.faceMat.needsUpdate = true;
      }
      this.bySlot.set(slot, rig);
    }
  }

  /** The place of one disc this frame, in the field's frame. */
  private poseOf(slot: number, frontSlotNow: number): Pose {
    const m = slot - this.pos;
    const front = slot === frontSlotNow;
    const flow = this.entranceDone ? this.flow : 0;
    if (!this.row) return arcPose(m, front, flow);
    const p = rowPose(m, front, flow);
    this.tmp.set(p.x, p.y, p.z).applyQuaternion(this.inverse);
    return { ...p, x: this.tmp.x, y: this.tmp.y, z: this.tmp.z };
  }

  /** Where the entrance is: the front disc's growth and the others' arrival, 0 to 1. */
  private entrance(now: number): { front: number; others: number } {
    if (this.entranceDone) return { front: 1, others: 1 };
    if (this.entranceAt === null) return { front: 0, others: 0 };
    const t = (now - this.entranceAt) / 1000;
    const front = glideEase(clamp(t / 1.05, 0, 1));
    const others = clamp((t - 0.105) / 0.89, 0, 1);
    if (t >= 1.06) this.entranceDone = true;
    return { front, others };
  }

  /** Move everything by one frame. Returns how much is still moving. */
  private layout(dt: number, snap = false): number {
    const now = performance.now();
    let moving = 0;

    // The field's position: a glide, a throw, or the spring that settles it on a disc.
    if (this.glide) {
      const g = this.glide;
      const k = clamp((now - g.at) / g.dur, 0, 1);
      this.pos = g.from + (g.to - g.from) * glideEase(k);
      if (k >= 1) {
        this.pos = g.to;
        this.glide = null;
      }
    } else if (this.down?.dragging !== "field") {
      const f = dt * 60;
      if (this.inertia !== 0) {
        this.pos += this.inertia * Math.min(3, f);
        this.inertia *= FRICTION ** f;
        if (Math.abs(this.inertia) < 4e-4) this.inertia = 0;
      }
      if (this.inertia === 0) {
        const to = Math.round(this.pos);
        const off = to - this.pos;
        if (off !== 0 || Math.abs(this.spring) > 1e-5) {
          this.spring += off * SNAP_FREQ * SNAP_FREQ * dt;
          this.spring *= Math.exp(-SNAP_DAMP * dt);
          this.pos += this.spring * dt;
          if (Math.abs(to - this.pos) < 8e-4 && Math.abs(this.spring) < 0.004) {
            this.pos = to;
            this.spring = 0;
          }
        }
      }
    }

    // The lean follows the speed: quick to build, slower to let go.
    if (dt > 0) {
      const v = clamp((this.pos - this.lastPos) / Math.max(dt, 0.001), -40, 40);
      const rate = Math.abs(v) > Math.abs(this.flow) ? 14 : 6;
      this.flow += (v - this.flow) * Math.min(1, dt * rate);
      if (Math.abs(this.flow) < 0.01) this.flow = 0;
    }
    this.lastPos = this.pos;
    if (this.glide || this.inertia || this.spring || this.flow) moving += 1;
    if (this.down?.dragging) moving += 1;

    const fs = frontSlot(this.pos);
    const track = mod(fs, this.count);
    if (track !== this.front) {
      this.front = track;
      this.o.onFront(track);
    }
    this.assign();

    // The pointer: which disc it is on (also when the field moves under a still pointer), and a
    // quick swipe over a disc nudges it.
    const pointerMoved = this.pointerMoved;
    this.pointerMoved = false;
    if (pointerMoved || (this.pointerIn && this.mouse && moving > 0 && !this.down)) {
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const picks = this.rigs.filter((g) => g.slot !== null && g.visible).map((g) => g.pick);
      const hit = this.raycaster.intersectObjects(picks, false)[0];
      const rig = hit ? this.rigs.find((g) => g.pick === hit.object) : undefined;
      const slot = rig?.slot ?? null;
      if (slot !== this.hovered && slot !== null && rig && !this.down && pointerMoved) {
        const speed = Math.hypot(this.pointerSpeed.x, this.pointerSpeed.y);
        if (speed >= WIPE_MIN) {
          rig.push.vx += clamp(this.pointerSpeed.x * 0.012, -0.5, 0.5);
          rig.push.vy -= clamp(this.pointerSpeed.y * 0.012, -0.5, 0.5);
          rig.push.vry += clamp(this.pointerSpeed.x * 0.009, -0.4, 0.4);
          rig.push.vrx += clamp(this.pointerSpeed.y * 0.009, -0.4, 0.4);
        }
      }
      this.setHovered(slot);
    } else if ((this.hovered === fs) !== this.hoverFront) {
      this.setHovered(this.hovered);
    }

    const enter = this.entrance(now);
    if (!this.entranceDone && this.entranceAt !== null) moving += 1;
    const play = this.o.playback();
    const tight = this.down?.dragging === "field";

    for (const rig of this.rigs) {
      if (rig.slot === null) continue;
      const slot = rig.slot;
      const isFront = slot === fs;
      const target = this.poseOf(slot, fs);
      const dist = Math.abs(slot - this.pos);
      let scale = target.scale;
      let visible = true;
      if (isFront) {
        scale *= Math.max(0.001, enter.front);
      } else {
        const a = arrival(enter.others, dist);
        visible = a > 0.02;
        scale *= a;
        if (a < 1) target.z -= (1 - a) * 2.2;
      }
      if (rig.visible !== visible) {
        rig.visible = visible;
        rig.root.visible = visible;
      }

      // The pointer tilts the disc it is on towards itself.
      const hoverWant = this.hovered === slot && !this.down ? 1 : 0;
      rig.hover += (hoverWant - rig.hover) * Math.min(1, dt * 10);
      if (rig.hover > 0.001) {
        target.rx += rig.hover * HOVER_TILT * this.ndc.y;
        target.ry += rig.hover * HOVER_TILT * this.ndc.x;
      }

      // Pushes: a velocity that fades and a pull back to rest.
      const p = rig.push;
      const pushSum =
        Math.abs(p.x) +
        Math.abs(p.y) +
        Math.abs(p.z) +
        Math.abs(p.vx) +
        Math.abs(p.vy) +
        Math.abs(p.vz) +
        Math.abs(p.rx) +
        Math.abs(p.ry) +
        Math.abs(p.vrx) +
        Math.abs(p.vry);
      if (pushSum > 8e-4) {
        const damp = Math.exp(-4.5 * dt);
        const back = Math.min(1, dt * 3.4);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.rx += p.vrx * dt;
        p.ry += p.vry * dt;
        p.vx *= damp;
        p.vy *= damp;
        p.vz *= damp;
        p.vrx *= damp;
        p.vry *= damp;
        p.x -= p.x * back;
        p.y -= p.y * back;
        p.z -= p.z * back;
        p.rx -= p.rx * back;
        p.ry -= p.ry * back;
        target.x += p.x;
        target.y += p.y;
        target.z += p.z;
        moving += pushSum;
      } else if (pushSum > 0) rig.push = freshPush();

      const pressK = pressScale(rig.pressAt < 0 ? -1 : now - rig.pressAt);
      if (rig.pressAt >= 0 && now - rig.pressAt > 520) rig.pressAt = -1;
      if (rig.pressAt >= 0) moving += 1;
      scale *= pressK;

      const g = rig.root;
      if (rig.fresh || snap) {
        g.position.set(target.x, target.y, target.z);
        g.rotation.set(target.rx, target.ry, target.rz);
        g.scale.setScalar(scale);
        if (rig.enter && this.entranceDone) {
          g.position.x += rig.enter * 0.9;
          g.position.z -= 0.45;
          g.rotation.y -= rig.enter * 0.3;
          g.scale.multiplyScalar(0.72);
        }
        rig.fresh = false;
        rig.enter = 0;
        moving += 1;
      } else {
        const k = !this.entranceDone ? 1 : followShare(dist, dt, tight);
        const before =
          Math.abs(target.x - g.position.x) +
          Math.abs(target.y - g.position.y) +
          Math.abs(target.z - g.position.z) +
          Math.abs(scale - g.scale.x) +
          Math.abs(target.rx - g.rotation.x) +
          Math.abs(target.ry - g.rotation.y) +
          Math.abs(target.rz - g.rotation.z);
        g.position.x += (target.x - g.position.x) * k;
        g.position.y += (target.y - g.position.y) * k;
        g.position.z += (target.z - g.position.z) * k;
        g.scale.setScalar(g.scale.x + (scale - g.scale.x) * k);
        g.rotation.x += (target.rx - g.rotation.x) * k;
        g.rotation.y += (target.ry - g.rotation.y) * k;
        g.rotation.z += (target.rz - g.rotation.z) * k;
        moving += before + Math.abs(hoverWant - rig.hover);
      }

      // The turn of a drag, and its way back to rest.
      const dragged = this.down?.dragging === "disc" && this.down.disc === slot;
      if (rig.settle && !dragged) {
        const st = rig.settle;
        const k = clamp((now - st.at) / 1200, 0, 1);
        const e = easeOutCubic(k);
        rig.tiltX = st.x + (st.toX - st.x) * e;
        rig.tiltY = st.y + (st.toY - st.y) * e;
        if (k >= 1) {
          rig.settle = null;
          rig.tiltX = rig.tiltY = 0;
        }
        moving += 1;
      }
      rig.turn.rotation.set(rig.tiltX + rig.push.rx, rig.tiltY + rig.push.ry, 0);
      if (dragged) moving += 1;

      // The record turns while its track plays and starts softly. When the track pauses, stops or
      // changes, it slows down onto a whole turn, so its picture comes to rest upright.
      const spinning = play.playing && play.track === mod(slot, this.count);
      if (spinning) {
        rig.rest = null;
        rig.omega += (SPIN - rig.omega) * Math.min(1, dt * (1 / 0.7) * 2.2);
        rig.angle = (rig.angle - rig.omega * dt) % TURN;
        rig.spin.rotation.z = rig.angle;
        moving += 1;
      } else if (rig.rest || rig.omega !== 0 || rig.angle !== 0) {
        rig.rest ??= { ...planRest(rig.angle, -rig.omega), at: now };
        const at = restAt(rig.rest, (now - rig.rest.at) / 1000);
        rig.angle = at.angle;
        rig.omega = -at.velocity;
        if (at.done) {
          rig.angle = 0;
          rig.omega = 0;
          rig.rest = null;
        }
        rig.spin.rotation.z = rig.angle;
        moving += 1;
      }
      g.renderOrder = Math.round(500 + g.position.z * 10 - slot * 0.01);
    }

    // The lines.
    const traceSnap = snap || !this.entranceDone;
    const playSlot =
      play.track !== null && this.entranceDone
        ? nearestSlot(this.pos, play.track, this.count)
        : null;
    const playRig = playSlot !== null ? this.bySlot.get(playSlot) : undefined;
    const waveOf = (slot: number) =>
      this.o.tracks[mod(slot, this.count)]?.wave ?? new Float32Array(2);
    const playTarget: TraceTarget | null =
      playRig?.visible && playSlot !== null
        ? {
            slot: playSlot,
            track: mod(playSlot, this.count),
            wave: waveOf(playSlot),
            root: playRig.root,
          }
        : null;
    const wantsFront =
      this.entranceDone &&
      (this.hoverFront || this.focused || now - this.scrolledAt < SCROLL_TRACE_MS) &&
      fs !== playSlot;
    const frontRig = this.bySlot.get(fs);
    const frontTarget: TraceTarget | null =
      wantsFront && frontRig?.visible
        ? { slot: fs, track: mod(fs, this.count), wave: waveOf(fs), root: frontRig.root }
        : null;
    if (this.frontTrace.update(now, dt, frontTarget, null, 0, traceSnap)) moving += 1;
    if (
      this.playTrace.update(
        now,
        dt,
        playTarget,
        play.progress,
        play.playing ? play.level : 0,
        traceSnap,
      )
    )
      moving += 1;
    if (play.playing && playTarget) moving += 1;
    if (now - this.scrolledAt < SCROLL_TRACE_MS + 60) moving += 1;
    return moving;
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (this.disposed || this.lost || document.hidden) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const moving = this.layout(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.frames > 0) this.frames -= 1;
    if (moving > 0.001 || this.frames > 0) this.raf = requestAnimationFrame(this.tick);
  };
}
