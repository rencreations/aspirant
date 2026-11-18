// What build.cjs calls in the page.
import * as analysis from "./analysis.js";
import { convert } from "./convert.js";
import * as source from "./source.js";
import * as stage from "./stage.js";

window.dollBuild = { source, analysis, stage, convert, state: {} };
window.dollBuild.openSource = async (rigUrl, walkUrl) => {
  window.dollBuild.state.rig = await source.loadFbx(rigUrl);
  if (walkUrl) window.dollBuild.state.walk = await source.loadFbx(walkUrl);
  const rig = window.dollBuild.state.rig;
  return {
    tree: source.tree(rig.root),
    bytes: rig.bytes,
    clips: rig.animations.map(source.clipFacts),
  };
};
window.dollBuild.dumpRig = () => source.dump(window.dollBuild.state.rig);
window.dollBuild.showSelection = async (indices, yaws, options, baseUrl = null, second = []) => {
  if (!window.dollBuild.state.shown) {
    await analysis.openSelection(window.dollBuild.state.rig, baseUrl);
    window.dollBuild.state.shown = true;
  }
  analysis.setSelection(indices, second);
  return analysis.headSheet(yaws, options);
};
/** The picture the FBX itself carries as its colour (a brighter one than the separate base file). */
window.dollBuild.exportEmbedded = async () => {
  const rig = window.dollBuild.state.rig;
  const material = Array.isArray(rig.mesh.material) ? rig.mesh.material[0] : rig.mesh.material;
  for (let i = 0; i < 200 && !(material.map.image && material.map.image.width); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const image = material.map.image;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const g = canvas.getContext("2d");
  g.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
};
window.__ready = true;
