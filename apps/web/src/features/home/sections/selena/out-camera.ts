/**
 * The camera of the out clip (round seven). `cameras-out.json` (made by `scripts/home/models/
 * cameras-out.mjs` from the game's `cam_city_intercation02`) holds its path in her own space; this
 * puts it in the world beside her placement, the way `SelenaActor.cameraFor` does for the older
 * cameras, and closes in on the hand for the pull (`zoomRect` in `out.ts`). The clip starts and ends
 * on the game's idle camera, so it begins on the picture the room shows.
 */
import { PerspectiveCamera } from "three";

import { asset } from "@/lib/asset";
import { cachedFetch } from "@/lib/media-store";

import { ANCHOR } from "../../actors/selena/constants";
import { frameCamera, sampleBakedCamera, type CameraData } from "../../actors/selena/camera";
import { qmul, qrotate } from "../../actors/selena/quat";
import type { SelenaActor } from "../../actors/selena";
import { type ViewRect } from "./out";

export const OUT_CAMERAS = "/models/home/cameras-out.json";
export const OUT_CAMERAS_BYTES = 9_830;
export const OUT_CLIP = "city_intercation02";
/** The widest vertical field of view the camera may take on a phone, in degrees. */
const PORTRAIT_FOV = 112;

export async function loadOutCameras(): Promise<CameraData> {
  const response = await cachedFetch(asset(OUT_CAMERAS));
  return (await response.json()) as CameraData;
}

const key = new Float32Array(7);
const tmp = new Float32Array(8);
const quat = new Float32Array(4);

/**
 * Write the out camera for the clip time `t` into `cam`, in the world of her placement. The whole
 * frame is the game's 16:9 picture, of which the screen is the bottom 80 percent (the recording's
 * band), as for the other baked cameras.
 */
export function outCameraFor(
  sl: SelenaActor,
  data: CameraData,
  t: number,
  viewport: { w: number; h: number },
  portrait: boolean,
  cam: PerspectiveCamera,
): PerspectiveCamera {
  if (sl.hasFittedCameras()) {
    // Round seven: the camera fitted to the recording. Its first key is the fitted idle camera, the
    // picture the room shows, and the game's own path is kept from there.
    const src = sl.cameraFor(OUT_CLIP, t, viewport, { portrait: portrait ? 1 : 0, draw: false });
    copyLens(src, cam);
    const v = src.view;
    if (v) cam.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    return cam;
  }
  const o = sl.object;
  o.updateMatrixWorld(true);
  const s = o.scale.x;
  const g = o.quaternion;
  const gq = tmp;
  gq[0] = g.x;
  gq[1] = g.y;
  gq[2] = g.z;
  gq[3] = g.w;
  sampleBakedCamera(data, OUT_CLIP, t, key);
  qrotate(gq, 0, key[0]! - ANCHOR[0], key[1]! - ANCHOR[1], key[2]! - ANCHOR[2], tmp, 4);
  cam.position.set(
    o.position.x + tmp[4]! * s,
    o.position.y + tmp[5]! * s,
    o.position.z + tmp[6]! * s,
  );
  // The camera's quaternion composed with her own turn.
  qmul(gq, 0, key, 3, quat, 0);
  cam.quaternion.set(quat[0]!, quat[1]!, quat[2]!, quat[3]!);
  const f = frameCamera(viewport.w, viewport.h, {
    fit: portrait ? "width" : "height",
    maxFov: PORTRAIT_FOV,
  });
  cam.fov = f.fov;
  cam.aspect = f.aspect;
  cam.near = 0.04 * s;
  cam.far = 120 * s;
  cam.setViewOffset(
    f.view.fullWidth,
    f.view.fullHeight,
    f.view.x,
    f.view.y,
    f.view.width,
    f.view.height,
  );
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

/** Copy the pose and the lens of one camera onto another (the view window is set apart). */
export function copyLens(from: PerspectiveCamera, to: PerspectiveCamera): void {
  to.position.copy(from.position);
  to.quaternion.copy(from.quaternion);
  to.fov = from.fov;
  to.aspect = from.aspect;
  to.near = from.near;
  to.far = from.far;
}

/** Put a window onto a camera's whole frame (`zoomRect` writes one). */
export function setWindow(cam: PerspectiveCamera, r: ViewRect): void {
  cam.setViewOffset(r.fullWidth, r.fullHeight, r.offsetX, r.offsetY, r.width, r.height);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

/** The window a camera has now (its view must be set). */
export function windowOf(cam: PerspectiveCamera, out: ViewRect): ViewRect {
  const v = cam.view;
  out.fullWidth = v?.fullWidth ?? 1;
  out.fullHeight = v?.fullHeight ?? 1;
  out.offsetX = v?.offsetX ?? 0;
  out.offsetY = v?.offsetY ?? 0;
  out.width = v?.width ?? 1;
  out.height = v?.height ?? 1;
  return out;
}
