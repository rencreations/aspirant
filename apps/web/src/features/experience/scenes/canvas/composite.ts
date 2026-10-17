import { ShaderMaterial, Vector2, Vector4, type Texture } from "three";

import { NOISE } from "../world/glsl";

export const MAX_ZONES = 6;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA;
uniform sampler2D tB;
uniform float uMix, uPushA, uPushB, uTime, uAspect, uExposure;
uniform vec2 uRes;
// Text zones: y0, y1 (uv, bottom up), mode (0 none, 1 storm cap, 2 daybreak floor), unused.
uniform vec4 uZones[${MAX_ZONES}];
uniform float uBandHalf; // in uv x
uniform float uCap, uFloor;
${NOISE}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 zoomed(sampler2D t, vec2 uv, float push) {
  return texture2D(t, (uv - 0.5) / (1.0 + push) + 0.5).rgb;
}

void main() {
  vec3 a = zoomed(tA, vUv, uPushA);
  vec3 col = a;
  if (uMix > 0.0) {
    vec3 b = zoomed(tB, vUv, uPushB);
    vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
    // Noise dissolve that sweeps up from the bottom like light rising.
    float n = fbm(q * 2.6 + vec2(0.0, uTime * 0.05)) * 0.75 + (1.0 - vUv.y) * 0.25;
    float edge = uMix * 1.25 - 0.12;
    float w = smoothstep(n - 0.06, n + 0.06, edge);
    float rim = smoothstep(0.07, 0.0, abs(n - edge)) * (1.0 - uMix) * uMix * 4.0;
    col = mix(a, b, w) + vec3(1.0, 0.92, 0.8) * rim * 0.35;
  }
  col = aces(col * uExposure);

  // Keep the backdrop inside the luminance budget under the text column, zone by zone.
  float bx = abs(vUv.x - 0.5);
  float inBand = 1.0 - smoothstep(uBandHalf, uBandHalf + 0.06, bx);
  float mode = 0.0;
  for (int i = 0; i < ${MAX_ZONES}; i++) {
    vec4 z = uZones[i];
    if (vUv.y >= z.x && vUv.y <= z.y) mode = z.z;
  }
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  if (mode > 0.5 && mode < 1.5 && L > uCap) {
    col *= mix(1.0, uCap / L, inBand);
  } else if (mode > 1.5 && L < uFloor) {
    float k = (uFloor - L) / max(0.0001, 1.0 - L);
    col = mix(col, mix(col, vec3(1.0), k), inBand);
  }

  // Vignette, then sRGB and a little dither against banding.
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.55;
  col = toSRGB(col);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createComposite(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      tA: { value: null as Texture | null },
      tB: { value: null as Texture | null },
      uMix: { value: 0 },
      uPushA: { value: 0 },
      uPushB: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uExposure: { value: 1 },
      uRes: { value: new Vector2(1, 1) },
      uZones: { value: Array.from({ length: MAX_ZONES }, () => new Vector4(0, 0, 0, 0)) },
      uBandHalf: { value: 0.3 },
      uCap: { value: 0.1 },
      uFloor: { value: 0.5 },
    },
  });
}
