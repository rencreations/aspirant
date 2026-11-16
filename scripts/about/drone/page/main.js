// What build.cjs calls in the page.
import { convert } from "./convert.js";
import {
  describeFbx,
  FACE_CELLS,
  loadGlb,
  onGrounds,
  picture,
  pictureError,
  sheet,
  still,
} from "./stage.js";

window.droneBuild = {
  convert,
  describeFbx,
  FACE_CELLS,
  loadGlb,
  onGrounds,
  picture,
  pictureError,
  sheet,
  still,
};
window.__ready = true;
