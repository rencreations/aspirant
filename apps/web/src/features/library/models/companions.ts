import { Group, type Mesh, type Object3D, type Scene } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { createBunny, stepBunny } from "@/features/about/choreo/bunny";
import { createCompanion, stepCompanion } from "@/features/about/choreo/companion";
import type { FriendBit, Gesture, Mood } from "@/features/about/choreo/routines";
import { buildBunny } from "@/features/about/drone/bunny-model";
import { buildCompanions } from "@/features/about/drone/companion-model";

import type { Behaviour, BehaviourContext } from "./behaviours";
import { type Bounds } from "./camera-math";
import { BREATH, breathClip } from "./breath";
import { ClipPlayer } from "./clips";
import { boundsOf, lightMaterials } from "./scene-kit";
import type { ModelView } from "./types";

/**
 * The small shows of the room's companions: the Aspirant Drone, Guinevere's two drones, Mr. Bunny
 * and Tetra. Each rests in an idle and, every few seconds, does something of its own (a dance, a
 * wave, a fist bump between the two drones), always back to the idle. Nothing here waits for the
 * visitor: the show runs while the view is on screen.
 *
 * Guinevere's drones and Mr. Bunny are the About page's own bodies and faces (`features/about/`):
 * only their builders and their pure choreography are used here, driven by this room's show.
 */

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;
/** 0 at the ends, 1 in the middle, smooth. */
const hump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2);

function bit(over: Partial<FriendBit> = {}): FriendBit {
  return {
    w: 0,
    x: 0,
    y: 0,
    lift: 0,
    scale: 1,
    front: false,
    yaw: 0,
    pitch: 0,
    roll: 0,
    spin: 0,
    squash: 1,
    mood: null,
    gesture: null,
    at: 0,
    side: 1,
    ...over,
  };
}

/** The meshes of a file that have morph targets, with their names. */
function morphs(root: Object3D): Array<{ mesh: Mesh; names: Record<string, number> }> {
  const out: Array<{ mesh: Mesh; names: Record<string, number> }> = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
      out.push({ mesh, names: mesh.morphTargetDictionary });
    }
  });
  return out;
}

function setMorph(list: ReturnType<typeof morphs>, name: string, value: number): void {
  for (const m of list) {
    const i = m.names[name];
    if (i !== undefined && m.mesh.morphTargetInfluences) m.mesh.morphTargetInfluences[i] = value;
  }
}

/**
 * The Aspirant Drone: it floats, sways and looks round, and its screen changes face now and then
 * (one face at a time, as the file's targets are meant to be used).
 */
function droneShow(gltf: GLTF, ctx: BehaviourContext): Behaviour {
  lightMaterials(gltf.scene, ctx.anisotropy);
  const root = new Group();
  const body = gltf.scene;
  root.add(body);
  const bounds = boundsOf(root);
  const shapes = morphs(body);
  const faces = Array.from(
    new Set(shapes.flatMap((m) => Object.keys(m.names).filter((n) => n.startsWith("face_")))),
  );
  const restY = body.position.y;
  let time = 0;
  let face = "";
  let faceAt = 0;
  let nextFace = rand(2.5, 4);
  let level = 0;
  let blinkAt = rand(2, 4);
  let playing = true;
  return {
    root,
    bounds: () => bounds,
    update: (dt) => {
      if (!playing) return false;
      time += dt;
      body.position.y = restY + Math.sin(time * 1.6) * bounds.radius * 0.06;
      body.rotation.y = Math.sin(time * 0.45) * 0.35;
      body.rotation.z = Math.sin(time * 1.1) * 0.05;
      body.rotation.x = Math.sin(time * 0.8 + 1) * 0.06;
      if (faces.length > 0) {
        if (time >= nextFace) {
          face = face ? "" : pick(faces);
          faceAt = time;
          nextFace = time + (face ? rand(1.6, 2.6) : rand(2.5, 4.5));
          level = 0;
        }
        level = Math.min(1, (time - faceAt) / 0.18);
        for (const f of faces) setMorph(shapes, f, f === face ? level : 0);
      }
      if (time >= blinkAt) {
        const u = (time - blinkAt) / 0.16;
        setMorph(shapes, "blink", hump(Math.min(1, u)));
        if (u >= 1) blinkAt = time + rand(2.5, 5);
      }
      return true;
    },
    setPlaying: (p) => {
      playing = p;
    },
    dispose: () => undefined,
  };
}

/** Millimetres: the About bodies count in pixels, so here one pixel is a millimetre. */
const UNIT = 1000;
const BALL_PX = 72.25;
const PAIR_GAP = 120;

type PairMove = "bump" | "cheer" | "wave" | "spar" | "orbit" | "dizzy" | "flex" | "bow" | "hide";
const PAIR_MOVES: readonly PairMove[] = [
  "bump",
  "cheer",
  "wave",
  "spar",
  "orbit",
  "dizzy",
  "flex",
  "bow",
  "hide",
];
const MOVE_SECONDS: Record<PairMove, number> = {
  bump: 1.9,
  cheer: 1.6,
  wave: 1.8,
  spar: 2.2,
  orbit: 2.8,
  dizzy: 1.8,
  flex: 1.5,
  bow: 1.4,
  hide: 1.8,
};

/**
 * Guinevere's two drones, side by side in the air: they bob, look at each other and, every few
 * seconds, do something together (a fist bump, a cheer, a lap round each other, a sparring match)
 * or one of them shows off while the other watches.
 */
function pairShow(gltf: GLTF): Behaviour {
  const root = new Group();
  const stage = new Group();
  stage.scale.setScalar(1 / UNIT);
  root.add(stage);
  const companions = buildCompanions(gltf.scene, stage as unknown as Scene);
  for (const a of companions.actors) a.visible = true;
  const bodies = [createCompanion(0), createCompanion(1)] as const;
  let time = 0;
  let move: PairMove | null = null;
  let moveAt = 0;
  let nextMove = rand(2, 3.5);
  let first = true;
  let lead: 0 | 1 = 0;
  let playing = true;
  const place = [
    { x: -PAIR_GAP, y: 0, z: 0 },
    { x: PAIR_GAP, y: 0, z: 0 },
  ];

  const frame = (dt: number) => {
    time += dt;
    if (!move && time >= nextMove) {
      move = pick(PAIR_MOVES);
      lead = Math.random() < 0.5 ? 0 : 1;
      moveAt = time;
    }
    const u = move ? (time - moveAt) / MOVE_SECONDS[move] : 0;
    if (move && u >= 1) {
      move = null;
      nextMove = time + rand(1.6, 3.4);
    }
    const env = hump(Math.min(1, Math.max(0, u)));
    for (const who of [0, 1] as const) {
      const side = who === 0 ? 1 : -1;
      const home = who === 0 ? -PAIR_GAP : PAIR_GAP;
      const bob = Math.sin(time * 1.4 + who * 1.7) * 10;
      const p = place[who];
      if (!p) continue;
      p.x = home;
      p.y = -bob;
      p.z = 0;
      let b: FriendBit | null = null;
      const other = place[who === 0 ? 1 : 0];
      let look: { x: number; y: number } | null = other ? { x: other.x, y: other.y } : null;
      const g = (gesture: Gesture, mood: Mood | null, over: Partial<FriendBit> = {}) =>
        bit({ gesture, mood, at: Math.min(1, Math.max(0, u)), side, ...over });
      switch (move) {
        case "bump":
          // They meet in the middle, knock gloves and part.
          p.x = home * (1 - 0.55 * env);
          b = g("jab", "glad", {
            squash: 1 - 0.06 * hump(Math.min(1, Math.max(0, (u - 0.4) / 0.25))),
          });
          break;
        case "cheer":
          p.y -= 38 * hump(Math.min(1, u * 2)) + 30 * hump(Math.max(0, u * 2 - 1));
          b = g("cheer", "happy");
          break;
        case "wave":
          if (who === lead) {
            b = g("wave", "happy", { yaw: -side * 0.2 * env });
            look = null;
          } else b = g("bounce", "glad");
          break;
        case "spar":
          b = who === lead ? g("punch", "bold") : g("hide", "wide");
          p.x = home * (1 - 0.25 * env);
          break;
        case "orbit":
          if (who === lead) {
            // A lap round the other one, in front and behind.
            const a = Math.min(1, Math.max(0, u)) * Math.PI * 2;
            const cx = place[who === 0 ? 1 : 0]?.x ?? 0;
            p.x = cx + (home - cx) * Math.cos(a);
            p.z = Math.sin(a) * Math.abs(home - cx) * 0.7;
            b = bit({ mood: "love", spin: 0 });
          } else b = bit({ mood: "happy" });
          break;
        case "dizzy":
          if (who === lead)
            b = bit({ mood: "dizzy", spin: Math.min(1, u) * Math.PI * 4, roll: 0.3 * env });
          else b = bit({ mood: "wide" });
          break;
        case "flex":
          b = g("flex", "bold");
          break;
        case "bow":
          b = g("bow", "glad");
          break;
        case "hide":
          b = who === lead ? g("hide", "shy") : g("wave", "glad");
          break;
        default:
          b = null;
      }
      const body = bodies[who];
      const pose = stepCompanion(body, {
        dt,
        x: p.x,
        y: p.y,
        radius: BALL_PX,
        z: p.z,
        bit: b,
        look,
        snap: first,
      });
      companions.place(who, pose, 0);
    }
    first = false;
  };
  frame(0);
  // The two side by side with their gloves out, and the room their show uses.
  const bounds: Bounds = { cx: 0, cy: 0, cz: 0, radius: 0.32, minY: -0.12, maxY: 0.12 };
  return {
    root,
    bounds: () => bounds,
    update: (dt) => {
      if (!playing) return false;
      frame(Math.min(dt, 1 / 20));
      return true;
    },
    setPlaying: (p) => {
      playing = p;
    },
    dispose: () => {
      companions.dispose();
    },
  };
}

type BunnyMove = "wave" | "cheer" | "bounce" | "flex" | "hide" | "bow" | "dizzy" | "look" | "punch";
const BUNNY_MOVES: readonly BunnyMove[] = [
  "wave",
  "cheer",
  "bounce",
  "flex",
  "hide",
  "bow",
  "dizzy",
  "look",
  "punch",
];

/** Mr. Bunny, Chang'e's drone: he hovers, looks round and does one of his things now and then. */
function bunnyShow(gltf: GLTF): Behaviour {
  const root = new Group();
  const stage = new Group();
  stage.scale.setScalar(1 / UNIT);
  root.add(stage);
  const model = buildBunny(gltf.scene, stage as unknown as Scene);
  model.actor.visible = true;
  const body = createBunny();
  const SIZE = 0.52 * UNIT;
  let time = 0;
  let move: BunnyMove | null = null;
  let moveAt = 0;
  let nextMove = rand(1.8, 3);
  let playing = true;
  const frame = (dt: number) => {
    time += dt;
    if (!move && time >= nextMove) {
      move = pick(BUNNY_MOVES);
      moveAt = time;
    }
    const u = move ? (time - moveAt) / 1.8 : 0;
    if (move && u >= 1) {
      move = null;
      nextMove = time + rand(1.5, 3.2);
    }
    const at = Math.min(1, Math.max(0, u));
    const env = hump(at);
    let y = -Math.sin(time * 1.3) * 14;
    let look: { x: number; y: number } | null = null;
    let b: FriendBit | null = null;
    switch (move) {
      case "wave":
        b = bit({ gesture: "wave", mood: "happy", at });
        break;
      case "cheer":
        b = bit({ gesture: "cheer", mood: "glad", at });
        y -= 60 * env;
        break;
      case "bounce":
        b = bit({ gesture: "bounce", mood: "happy", at });
        y -= 40 * hump(Math.min(1, at * 2)) + 40 * hump(Math.max(0, at * 2 - 1));
        break;
      case "flex":
        b = bit({ gesture: "flex", mood: "bold", at });
        break;
      case "hide":
        b = bit({ gesture: "hide", mood: "shy", at });
        break;
      case "bow":
        b = bit({ gesture: "bow", mood: "glad", at });
        break;
      case "dizzy":
        b = bit({ mood: "dizzy", spin: at * Math.PI * 2, roll: 0.25 * env });
        break;
      case "look":
        look = { x: Math.sin(at * Math.PI * 2) * 900, y: -200 * env };
        b = bit({ mood: "wide" });
        break;
      case "punch":
        b = bit({ gesture: "punch", mood: "angry", at, side: Math.random() < 0.5 ? 1 : -1 });
        break;
      default:
        b = null;
    }
    const pose = stepBunny(body, { dt, x: 0, y, size: SIZE, z: 0, bit: b, look });
    model.place(pose, 0);
  };
  frame(0);
  const bounds = boundsOf(root);
  return {
    root,
    bounds: () => bounds,
    update: (dt) => {
      if (!playing) return false;
      frame(Math.min(dt, 1 / 20));
      return true;
    },
    setPlaying: (p) => {
      playing = p;
    },
    dispose: () => {
      model.dispose();
    },
  };
}

type TetraMove = "hiphop" | "rumba" | "walk" | "hop" | "spin";
const TETRA_MOVES: readonly TetraMove[] = ["hiphop", "rumba", "walk", "hop", "spin"];

/**
 * Tetra: she breathes in her idle and, every few seconds, does something: one of her two dances
 * (the About page's hip hop and rumba), a march on the spot, a happy hop or a spin. She blinks and
 * smiles while she dances. Her file is the About page's, unlit as it is.
 */
function tetraShow(gltf: GLTF): Behaviour {
  const root = new Group();
  const body = gltf.scene;
  root.add(body);
  const shapes = morphs(body);
  const idle = breathClip(body, BREATH, 1.6);
  const clips = [...gltf.animations];
  if (idle) clips.push(idle);
  const player = new ClipPlayer(body, clips);
  player.play("idle", { fade: 0 });
  body.traverse((o) => {
    if ((o as Mesh).isMesh) o.frustumCulled = false;
  });
  const bounds = boundsOf(root);
  let time = 0;
  let move: TetraMove | null = null;
  let moveAt = 0;
  let moveEnd = 0;
  let nextMove = rand(2.5, 4);
  let blinkAt = rand(1.5, 3.5);
  let smile = 0;
  let playing = true;
  const start = (m: TetraMove) => {
    move = m;
    moveAt = time;
    if (m === "hiphop" || m === "rumba" || m === "walk") {
      const length = player.factsOf(m)?.duration ?? 2;
      const loops = m === "walk" ? 3 : m === "rumba" ? 2 : 1;
      player.play(m, { fade: 0.45, loop: true });
      moveEnd = time + length * loops - 0.4;
    } else {
      moveEnd = time + (m === "hop" ? 1.1 : 1.3);
    }
  };
  return {
    root,
    bounds: () => bounds,
    update: (dt) => {
      if (!playing) return false;
      time += dt;
      if (!move && time >= nextMove) start(pick(TETRA_MOVES));
      if (move && time >= moveEnd) {
        if (player.current !== "idle") player.play("idle", { fade: 0.45 });
        move = null;
        nextMove = time + rand(2.5, 4.5);
      }
      player.update(dt);
      // The whole doll: a hop or a spin on top of the idle.
      const u = move ? Math.min(1, (time - moveAt) / Math.max(0.01, moveEnd - moveAt)) : 0;
      body.position.y =
        move === "hop"
          ? bounds.radius * 0.35 * (hump(Math.min(1, u * 2)) + 0.7 * hump(Math.max(0, u * 2 - 1)))
          : 0;
      const sq = move === "hop" ? 1 - 0.08 * Math.sin(u * Math.PI * 4) : 1;
      body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      body.rotation.y = move === "spin" ? (1 - Math.cos(u * Math.PI)) * Math.PI : 0;
      // A smile while she moves, a blink now and then.
      const wantSmile = move && move !== "walk" ? 1 : 0;
      smile += (wantSmile - smile) * Math.min(1, dt * 6);
      setMorph(shapes, "smile_mouth", smile);
      if (time >= blinkAt) {
        const b = (time - blinkAt) / 0.18;
        const v = hump(Math.min(1, b));
        setMorph(shapes, "blink_L", v);
        setMorph(shapes, "blink_R", v);
        if (b >= 1) blinkAt = time + rand(2, 4.5);
      }
      return true;
    },
    setPlaying: (p) => {
      playing = p;
      player.playing = p;
    },
    dispose: () => {
      player.dispose();
    },
  };
}

/** The show of a companion view. */
export function companionBehaviour(view: ModelView, gltf: GLTF, ctx: BehaviourContext): Behaviour {
  switch (view.behaviour) {
    case "pair":
      return pairShow(gltf);
    case "bunny":
      return bunnyShow(gltf);
    case "tetra":
      return tetraShow(gltf);
    default:
      return droneShow(gltf, ctx);
  }
}
