// What build.cjs calls in the page.
import { convert } from "./convert.js";
import { loadGlb, pivotTests, setTone, sheet, shot, RECIPE } from "./stage.js";

window.gramophoneBuild = { convert, loadGlb, pivotTests, setTone, sheet, shot, RECIPE };
window.__ready = true;
