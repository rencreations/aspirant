import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  type Object3D,
} from "three";

import { easeInQuad, glideEase } from "./field";
import { TRACE, traceSamples, tracePoint } from "./trace";

const VERT = /* glsl */ `
attribute float aU;
attribute float aSide;
attribute float aSwing;
attribute float aSlope;
uniform float uRadius;
uniform float uAmp;
uniform float uWidth;
uniform float uFrom;
uniform float uTo;
varying float vU;
varying float vSide;
void main() {
  float a = 1.5707963 - aU * 6.2831853;
  vec2 dir = vec2(cos(a), sin(a));
  vec2 along = vec2(sin(a), -cos(a));
  float r = uRadius + uAmp * aSwing;
  // The slope of the line, so it keeps its thickness where it swings steeply.
  vec2 t = dir * (uAmp * aSlope) + along * (6.2831853 * r);
  vec2 n = normalize(vec2(-t.y, t.x));
  // The pen is thinner where it starts and where it is now.
  float ends = min(smoothstep(0.0, 0.014, uTo - aU), smoothstep(0.0, 0.014, aU - uFrom));
  float w = uWidth * (0.3 + 0.7 * ends);
  vec2 p = dir * r + n * aSide * w * 0.5;
  vU = aU;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uFrom;
uniform float uTo;
uniform float uPlayed;
uniform float uFaint;
uniform float uOpacity;
uniform vec3 uInk;
uniform vec3 uAccent;
varying float vU;
varying float vSide;
void main() {
  if (vU < uFrom || vU > uTo) discard;
  bool played = vU <= uPlayed;
  vec3 col = played ? uAccent : uInk;
  float a = (played ? 1.0 : uFaint) * uOpacity;
  a *= mix(0.55, 1.0, 1.0 - smoothstep(0.55, 1.0, abs(vSide)));
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

export type TracePhase = "hidden" | "in" | "on" | "out";

/** What a trace should follow this frame, or null to let it go. */
export interface TraceTarget {
  slot: number;
  track: number;
  wave: Float32Array;
  root: Object3D;
}

interface TraceStyle {
  ink: string;
  accent: string;
  /** Opacity of the part that has not played. */
  faint: number;
  /** Seconds to draw the line in and to take it away. */
  inTime: number;
  outTime: number;
  /** A dot at the pen (the play head). */
  head: boolean;
}

/**
 * One drawn line, bound to one disc at a time. It draws itself in (the pen goes once round the
 * disc), stays, and takes itself away from its start (the tail catches the pen) when its disc is
 * no longer the one it should be on. It follows its disc with a short lag, in the disc's plane,
 * and does not turn with the record.
 */
export class TraceMesh {
  readonly group = new Group();
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly head: Mesh | null = null;
  private readonly headMat: MeshBasicMaterial | null = null;
  private readonly style: TraceStyle;
  private phase: TracePhase = "hidden";
  private phaseAt = 0;
  private slot: number | null = null;
  private track: number | null = null;
  private wave: Float32Array | null = null;

  constructor(style: TraceStyle) {
    this.style = style;
    const n = TRACE.points;
    const count = (n + 1) * 2;
    this.geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
    const u = new Float32Array(count);
    const side = new Float32Array(count);
    for (let i = 0; i <= n; i += 1) {
      u[i * 2] = u[i * 2 + 1] = i / n;
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
    }
    this.geometry.setAttribute("aU", new BufferAttribute(u, 1));
    this.geometry.setAttribute("aSide", new BufferAttribute(side, 1));
    this.geometry.setAttribute("aSwing", new BufferAttribute(new Float32Array(count), 1));
    this.geometry.setAttribute("aSlope", new BufferAttribute(new Float32Array(count), 1));
    const index: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(index);

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uRadius: { value: TRACE.radius },
        uAmp: { value: TRACE.amplitude },
        uWidth: { value: TRACE.width },
        uFrom: { value: 0 },
        uTo: { value: 0 },
        uPlayed: { value: -1 },
        uFaint: { value: style.faint },
        uOpacity: { value: 1 },
        uInk: { value: new Color(style.ink) },
        uAccent: { value: new Color(style.accent) },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      // The pen runs clockwise, so the ribbon faces away from the viewer.
      side: DoubleSide,
    });
    const line = new Mesh(this.geometry, this.material);
    line.frustumCulled = false;
    line.renderOrder = 900;
    this.group.add(line);

    if (style.head) {
      this.headMat = new MeshBasicMaterial({
        color: new Color(style.accent),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      this.head = new Mesh(new CircleGeometry(1, 28), this.headMat);
      this.head.renderOrder = 901;
      this.head.frustumCulled = false;
      this.group.add(this.head);
    }
    this.group.visible = false;
  }

  get state(): TracePhase {
    return this.phase;
  }

  /** The slot the line is on, or null. */
  get on(): number | null {
    return this.slot;
  }

  private load(track: number, wave: Float32Array): void {
    if (this.track === track && this.wave === wave) return;
    this.track = track;
    this.wave = wave;
    const { swing, slope } = traceSamples(wave);
    const aSwing = this.geometry.getAttribute("aSwing") as BufferAttribute;
    const aSlope = this.geometry.getAttribute("aSlope") as BufferAttribute;
    for (let i = 0; i < swing.length; i += 1) {
      aSwing.setX(i * 2, swing[i] ?? 0);
      aSwing.setX(i * 2 + 1, swing[i] ?? 0);
      aSlope.setX(i * 2, slope[i] ?? 0);
      aSlope.setX(i * 2 + 1, slope[i] ?? 0);
    }
    aSwing.needsUpdate = true;
    aSlope.needsUpdate = true;
  }

  private follow(root: Object3D, share: number): void {
    const g = this.group;
    if (share >= 1) {
      g.position.copy(root.position);
      g.quaternion.copy(root.quaternion);
      g.scale.copy(root.scale);
      return;
    }
    g.position.lerp(root.position, share);
    g.quaternion.slerp(root.quaternion, share);
    g.scale.lerp(root.scale, share);
  }

  /**
   * Move the line on by one frame. `played` is how much of the track has played (0 to 1), or null
   * when the line is not a play head. Returns true while it still moves (the scene keeps drawing).
   */
  update(
    now: number,
    dt: number,
    target: TraceTarget | null,
    played: number | null,
    level: number,
    snap: boolean,
  ): boolean {
    const u = this.material.uniforms;
    const wantSlot = target?.slot ?? null;

    if (this.phase !== "hidden" && this.slot !== wantSlot && this.phase !== "out") {
      this.phase = "out";
      this.phaseAt = now;
    }
    if (this.phase === "hidden" && target) {
      this.slot = target.slot;
      this.load(target.track, target.wave);
      this.follow(target.root, 1);
      this.phase = "in";
      this.phaseAt = now;
      this.group.visible = true;
    }
    if (this.phase === "hidden") return false;

    if (target?.slot === this.slot && target) {
      this.follow(target.root, snap ? 1 : 1 - Math.exp(-15 * dt));
    }

    let busy = true;
    const t = (now - this.phaseAt) / 1000;
    if (this.phase === "in") {
      const k = Math.min(1, t / this.style.inTime);
      u.uFrom!.value = 0;
      u.uTo!.value = glideEase(k);
      if (k >= 1) this.phase = "on";
    } else if (this.phase === "out") {
      const k = Math.min(1, t / this.style.outTime);
      u.uFrom!.value = easeInQuad(k);
      if (k >= 1) {
        this.phase = "hidden";
        this.slot = null;
        this.group.visible = false;
        u.uFrom!.value = 0;
        u.uTo!.value = 0;
        return true;
      }
    } else {
      u.uFrom!.value = 0;
      u.uTo!.value = 1;
      busy = false;
    }

    const drawn = u.uTo!.value as number;
    u.uPlayed!.value = played === null ? -1 : Math.min(played, drawn);
    if (this.head && this.headMat && this.wave) {
      const at = played === null ? drawn : Math.min(played, drawn);
      const p = tracePoint(this.wave, at);
      this.head.position.set(p.x, p.y, 0.001);
      this.head.scale.setScalar(0.016 * (1 + level * 1.4));
      this.head.visible = played !== null && this.phase !== "out";
    }
    return busy;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.head?.geometry.dispose();
    this.headMat?.dispose();
  }
}
