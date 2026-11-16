// What build.cjs calls in the page.
import { convert } from "./convert.js";
import { loadFbx, loadGlb, sheet } from "./stage.js";

window.companionBuild = { convert, loadFbx, loadGlb, sheet };
window.__ready = true;
