/**
 * The sky of Selena's scene (round seven): the owner's equirectangular picture, drawn behind her as
 * a screen sized quad at the far plane, in the cast pass, before her. It is a picture of directions,
 * not a model: each pixel finds its ray from the lens of the camera of the frame, turns it by the
 * camera's own orientation and reads the picture there. So the sky is fixed to the world, not to
 * the camera's small turns: the view turn (`setView`) orbits the camera round her and the sky is
 * read through the camera as it was before the turn, so the sky stays still while she and
 * Silverbolt move against it. The sky is the same through the three cameras of the pose, the
 * transitions and the idle, because the fits agree on one orientation (`cameras-r7.json`, `sky`).
 *
 * Unlit, no tone mapping, sRGB in and out. The cast's scissor cuts it to her frame.
 */
import {
  Matrix3,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type PerspectiveCamera,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  LinearFilter,
} from "three";

import { asset } from "@/lib/asset";
import { cachedFetch } from "@/lib/media-store";

export const SKY_IMAGE = "/img/home/selena-sky.webp";
export const SKY_IMAGE_BYTES = 266_080;

const VERT = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.99999, 1.0);
}
`;

// The ray of a pixel in the camera of the frame, turned to the sky's picture. `uInv` is the inverse
// of the frame's projection (so the view offset and the lens shift are in it), `uTurn` takes the
// camera's space to the picture's space.
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform mat4 uInv;
uniform mat3 uTurn;
varying vec2 vNdc;
const float PI = 3.14159265358979;
void main() {
  vec4 p = uInv * vec4(vNdc, 1.0, 1.0);
  vec3 d = normalize(p.xyz / p.w);
  vec3 s = normalize(uTurn * d);
  float lon = atan(s.x, -s.z);
  float lat = asin(clamp(s.y, -1.0, 1.0));
  vec2 uv = vec2(0.5 + lon / (2.0 * PI), 0.5 + lat / PI);
  vec3 c = texture2D(uMap, uv).rgb;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

export class Sky {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly inv = new Matrix4();
  private readonly turn = new Matrix3();
  private readonly tmp = new Matrix3();

  constructor(
    texture: Texture,
    private readonly fromFilm: Matrix3,
  ) {
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 1;
    texture.needsUpdate = true;
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: texture },
        uInv: { value: this.inv },
        uTurn: { value: this.turn },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), material);
    this.mesh.name = "selena_sky";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.visible = false;
  }

  get visible(): boolean {
    return this.mesh.visible;
  }

  set visible(on: boolean) {
    this.mesh.visible = on;
  }

  /**
   * Point the sky for the next draw. `camera` is the lens of the frame (its projection, with the
   * view offset); `base` is the rotation of the frame's camera before the view turn and
   * `filmWorld` the rotation of her own space (her placement's yaw), both pure rotations.
   */
  point(camera: PerspectiveCamera, base: Matrix4, filmWorld: Matrix4): void {
    this.inv.copy(camera.projectionMatrixInverse);
    // sky = fromFilm * filmWorld^-1 * base * d
    this.turn.setFromMatrix4(base);
    this.tmp.setFromMatrix4(filmWorld).transpose();
    this.turn.premultiply(this.tmp);
    this.turn.premultiply(this.fromFilm);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    const map = this.mesh.material.uniforms.uMap!.value as Texture;
    map.dispose();
  }
}

/** Read the sky's picture through the saved copy the loading list fills. */
export async function loadSkyTexture(): Promise<Texture> {
  const { Texture } = await import("three");
  const response = await cachedFetch(asset(SKY_IMAGE));
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob, { imageOrientation: "flipY" });
  const texture = new Texture(bitmap);
  texture.flipY = false;
  return texture;
}
