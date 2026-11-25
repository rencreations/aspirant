// What build.cjs calls in the page.
import { convert } from "./convert.js";
import {
  bindPlace,
  capture,
  compare,
  composite,
  faceDiff,
  farVertex,
  loadFbx,
  loadGlb,
  setPose,
  sheet,
  skinnedPlace,
  vertexAt,
} from "./stage.js";

window.bunnyBuild = {
  bindPlace,
  capture,
  compare,
  composite,
  convert,
  faceDiff,
  farVertex,
  loadFbx,
  loadGlb,
  setPose,
  sheet,
  skinnedPlace,
  vertexAt,
};
window.__ready = true;
