// What build.cjs calls in the page.
import { convert } from "./convert.js";
import { legTips, loadFbx, loadGlb, sheet } from "./stage.js";

window.tetraBuild = { convert, legTips, loadFbx, loadGlb, sheet };
window.__ready = true;
