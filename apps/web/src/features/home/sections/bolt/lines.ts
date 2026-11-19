/**
 * The four wavy lines of the tib section ("flexible lines"): thin strokes that cross the screen on a
 * slant, undulate as the page scrolls, draw on from the right, hold, and erase. Reproduced from the
 * reference's numbers (digest `ref-psychoactive-tib.md` section 2.3), in two blues, in the
 * stage's ortho pass under the cast (so the dragon passes in front of them). Each line is a strip of
 * triangles whose sides are pushed out by the vertex shader, so the stroke is a true 1.4 CSS px wide at
 * any pixel ratio. Nothing is allocated per frame: `update` writes uniforms.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  type Object3D,
} from "three";

import type { Actor } from "../../kernel/types";
import type { Stage } from "../../kernel/stage";

/** One line of the table: its place across the screen, its slant, its start, its wave and its colour. */
interface LineSpec {
  /** Offset along the line's normal, in half screen heights. */
  y: number;
  angle: number;
  delay: number;
  /** Wave height in half screen heights. */
  amp: number;
  freq: number;
  phase: number;
  colour: number;
  opacity: number;
}

// Round four: the lines are blue (the white that rises from the bottom would hide white ones). Round
// five (light mode only): a fine blue on the light ground, a sky blue and a deeper royal blue.
const WHITE = 0x59a6ff;
const MINT = 0x2458e0;

/** The table of the reference, with its white and green changed for two blues (the names are the old ones). */
export const LINES: readonly LineSpec[] = [
  { y: 0.6, angle: 0.05, delay: 0.03, amp: 0.3, freq: 1.6, phase: 0, colour: WHITE, opacity: 0.7 },
  {
    y: 0.2,
    angle: 0.05,
    delay: 0.09,
    amp: 0.39,
    freq: 1.3,
    phase: 3.1,
    colour: MINT,
    opacity: 0.8,
  },
  {
    y: -0.2,
    angle: -0.06,
    delay: 0.07,
    amp: 0.27,
    freq: 2.6,
    phase: 4.6,
    colour: MINT,
    opacity: 0.8,
  },
  {
    y: -0.6,
    angle: 0.04,
    delay: 0.16,
    amp: 0.33,
    freq: 2.1,
    phase: 1.7,
    colour: WHITE,
    opacity: 0.7,
  },
];

/** The stroke is this long behind its head, in lengths of the line (it covers the whole line). */
const TRAIL = 4;
const SAMPLES = 141;
const HALF_WIDTH = 0.8;

const smooth = (v: number): number => {
  const x = Math.min(1, Math.max(0, v));
  return x * x * (3 - 2 * x);
};

/**
 * Where a line is at progress `w` (0 to 1 over the section): the head of its travelling stroke (it
 * draws on from the right in the first fifth, holds, then erases from the right in the last fifth)
 * and how far its wave has turned.
 */
export function lineAt(
  w: number,
  spec: Pick<LineSpec, "delay" | "phase">,
  out: { head: number; phase: number },
): { head: number; phase: number } {
  const i = Math.min(1, Math.max(0, (w - spec.delay) / (1 - spec.delay)));
  const o = smooth(i);
  out.head = o * (1 + TRAIL);
  out.phase = spec.phase + o * Math.PI * 2;
  return out;
}

const VERTEX = /* glsl */ `
uniform float uLen;
uniform float uOff;
uniform float uRot;
uniform float uAmp;
uniform float uFreq;
uniform float uPhase;
uniform float uHalf;
varying float vU;
varying float vSide;
void main() {
  float ax = position.x;
  float x = ax * uLen * 0.5;
  float arg = ax * 3.14159265 * uFreq + uPhase;
  float y = sin(arg) * uAmp;
  float dydx = cos(arg) * uAmp * 3.14159265 * uFreq / (uLen * 0.5);
  vec2 n = normalize(vec2(-dydx, 1.0));
  vec2 p = vec2(x, y) + n * position.y * uHalf;
  float c = cos(uRot);
  float s = sin(uRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + vec2(-s, c) * uOff;
  vU = 1.0 - (ax * 0.5 + 0.5);
  vSide = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uHead;
uniform float uTrail;
varying float vU;
varying float vSide;
void main() {
  float feather = 0.06;
  float draw = smoothstep(uHead - uTrail - feather, uHead - uTrail, vU) * (1.0 - smoothstep(uHead - feather, uHead, vU));
  float end = smoothstep(0.0, 0.04, vU) * (1.0 - smoothstep(0.96, 1.0, vU));
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  float a = uOpacity * draw * end * edge;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

function stripGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  // x is the place along the line (-1 to 1), y the side of the stroke (-1 or 1). The shader reads both.
  const position = new Float32Array(SAMPLES * 2 * 3);
  const index = new Uint16Array((SAMPLES - 1) * 6);
  for (let i = 0; i < SAMPLES; i += 1) {
    const x = (i / (SAMPLES - 1)) * 2 - 1;
    position.set([x, -1, 0, x, 1, 0], i * 6);
    if (i < SAMPLES - 1) {
      const a = i * 2;
      index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
  }
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

/** The lines as an actor: the kernel hides it unless a section shows it. */
export class WaveLines implements Actor {
  readonly name = "bolt-lines";
  visible = false;
  readonly object: Object3D;
  private readonly group = new Group();
  private readonly meshes: Mesh[] = [];
  private readonly geometry = stripGeometry();
  private readonly materials: ShaderMaterial[] = [];
  private readonly scratch = { head: 0, phase: 0 };
  private readonly removePass: () => void;

  constructor(stage: Stage) {
    const pass = stage.scenePass("bolt-lines", "ortho", 24);
    for (const spec of LINES) {
      const material = new ShaderMaterial({
        uniforms: {
          uLen: { value: 1 },
          uOff: { value: 0 },
          uRot: { value: 0 },
          uAmp: { value: 0 },
          uFreq: { value: spec.freq },
          uPhase: { value: spec.phase },
          uHalf: { value: HALF_WIDTH },
          uColor: { value: new Color(spec.colour) },
          uOpacity: { value: spec.opacity },
          uHead: { value: 0 },
          uTrail: { value: TRAIL },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        side: DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.frustumCulled = false;
      this.materials.push(material);
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    this.group.visible = false;
    pass.scene.add(this.group);
    this.object = this.group;
    this.removePass = () => {
      pass.scene.remove(this.group);
    };
  }

  /** Set every line for progress `w` (0 to 1 over the section) on a screen of `width` by `height` px. */
  set(w: number, width: number, height: number): void {
    const length = 1.5 * Math.hypot(width, height);
    for (let i = 0; i < LINES.length; i += 1) {
      const spec = LINES[i]!;
      const u = this.materials[i]!.uniforms;
      lineAt(w, spec, this.scratch);
      u.uLen!.value = length;
      u.uOff!.value = spec.y * height * 0.5;
      u.uRot!.value = -0.5 + spec.angle;
      u.uAmp!.value = spec.amp * height * 0.5;
      u.uPhase!.value = this.scratch.phase;
      u.uHead!.value = this.scratch.head;
    }
  }

  dispose(): void {
    this.removePass();
    this.geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
