/**
 * The sky of Selena's scene (round seven): the owner's picture (`skybox.png`), drawn behind her as a
 * screen sized quad at the far plane, in the cast pass, before her. It is a picture of directions,
 * not a model: each pixel finds its ray from the lens of the camera of the frame, takes it to the
 * fitted camera's own frame (the recording's) and reads the picture where the recording does. The
 * recording's background is the painting as a flat picture bent by a smooth map, not an
 * equirectangular sky (see `FRAG` below and `docs/design/home/round7-CAM-landscape.md`). So the sky
 * is fixed to the world, not to the camera's small turns: the view turn (`setView`) orbits the
 * camera round her and the sky is read through the camera as it was before the turn, so the sky
 * stays still while she and Silverbolt move against it. The sky is the same through every clip,
 * because the recording's camera is one static camera (`cameras-r7.json`, `sky`).
 *
 * Unlit, no tone mapping, sRGB in and out. The cast's scissor cuts it to her frame.
 */
import {
  Matrix3,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type PerspectiveCamera,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  LinearFilter,
  MirroredRepeatWrapping,
  Vector2,
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

// The ray of a pixel in the camera of the frame, taken to the recording's own frame and then to the
// painting. The recording's background is the painting as a FLAT picture bent by a smooth map (a
// cubic of the recording's 1920 by 864 frame, found by matching the two: `scripts/home/models/
// cameras-r7/`), not an equirectangular sky seen through the lens (that model has no solution). So:
// `uInv` is the inverse of the frame's projection (the view offset and the lens shift are in it),
// `uTurn` takes the camera's space to the rest camera's space (the fitted camera, so a still camera
// reads the recording's frame as it is), the tangents of that ray are the recording's pixel at `uF0`
// pixels of focal length, and the cubic (`uPx`, `uPy`) takes that pixel to the painting's pixel. The
// sky is a direction map: it stays where it is while the model moves against it, and it follows a
// camera that really turns (the out clip).
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform mat4 uInv;
uniform mat3 uTurn;
uniform float uPx[10];
uniform float uPy[10];
uniform float uF0;
uniform vec2 uCentre;
uniform vec2 uPic;
varying vec2 vNdc;
void main() {
  vec4 p = uInv * vec4(vNdc, 1.0, 1.0);
  vec3 s = uTurn * normalize(p.xyz / p.w);
  vec2 t = s.xy / max(-s.z, 0.2);
  vec2 px = vec2(uF0 * t.x, -uF0 * t.y) / uCentre;
  // The cubic is fitted inside the recording's frame: outside it (a camera that turns, the out
  // clip) the map is held at the edge of the fitted region and goes on with its own slope.
  vec2 cl = clamp(px, -1.12, 1.12);
  vec2 d = px - cl;
  float x = cl.x;
  float y = cl.y;
  float x2 = x * x;
  float y2 = y * y;
  float xy = x * y;
  float q[10] = float[10](1.0, x, y, x2, xy, y2, x2 * x, x2 * y, x * y2, y2 * y);
  vec2 pic = vec2(uPx[1] * d.x + uPx[2] * d.y, uPy[1] * d.x + uPy[2] * d.y);
  for (int i = 0; i < 10; i++) {
    pic += vec2(uPx[i], uPy[i]) * q[i];
  }
  vec3 c = texture2D(uMap, vec2(pic.x / uPic.x, 1.0 - pic.y / uPic.y)).rgb;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

/** The share of the camera's turn (from the fitted camera) that the sky follows. */
export const SKY_FOLLOW = 0.35;

/** The frame the sky's map is written in: the recording scaled to 1920 by 864, 60 degrees tall. */
export const SKY_REF = { w: 1920, h: 864, vfovDeg: 60, picW: 1774, picH: 887 } as const;

export class Sky {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly inv = new Matrix4();
  private readonly turn = new Matrix3();
  private readonly tmp = new Matrix3();
  private readonly rot4 = new Matrix4();
  private readonly rotQ = new Quaternion();
  private readonly followQ = new Quaternion();

  constructor(
    texture: Texture,
    private readonly fromFilm: Matrix3,
    /**
     * 20 numbers: the cubic that takes the recording's frame (x = (px - 960) / 960, y = (py - 432)
     * / 432, terms 1 x y x2 xy y2 x3 x2y xy2 y3) to the picture's pixel: 10 for x, then 10 for y.
     */
    poly: ArrayLike<number>,
  ) {
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 1;
    // Past the painting's edge (a camera that turns far) it shows itself mirrored, never a streak.
    texture.wrapS = MirroredRepeatWrapping;
    texture.wrapT = MirroredRepeatWrapping;
    texture.needsUpdate = true;
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: texture },
        uInv: { value: this.inv },
        uTurn: { value: this.turn },
        uPx: { value: Array.from({ length: 10 }, (_, i) => poly[i] ?? 0) },
        uPy: { value: Array.from({ length: 10 }, (_, i) => poly[10 + i] ?? 0) },
        uF0: { value: SKY_REF.h / 2 / Math.tan((SKY_REF.vfovDeg * Math.PI) / 360) },
        uCentre: { value: new Vector2(SKY_REF.w / 2, SKY_REF.h / 2) },
        uPic: { value: new Vector2(SKY_REF.picW, SKY_REF.picH) },
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
    // `turn` is how far the camera has turned from the fitted one: nothing for a still camera. The
    // painting is only a little wider than the recording's frame, so a camera that turns far (the
    // out clip) moves the sky by a share of its turn, as a very far sky would.
    this.rot4.setFromMatrix3(this.turn);
    this.rotQ.setFromRotationMatrix(this.rot4);
    this.followQ.identity().slerp(this.rotQ, SKY_FOLLOW);
    this.rot4.makeRotationFromQuaternion(this.followQ);
    this.turn.setFromMatrix4(this.rot4);
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
