// The contact sheets of the finished files: one per character, drawn in real Chrome with the
// site's three (GLTFLoader and the meshopt decoder), the "must not change" views next to the room's
// own source drawn the same way and the room's old screenshot.
//
//   node sheets.mjs [name ...]
import fs from "node:fs";
import path from "node:path";
import { openPage } from "./chrome.mjs";
import { makeSheet } from "./sheet.mjs";
import { MIRROR, WORK } from "./build.mjs";

const M = (id) => path.join(MIRROR, `${id}.glb`).replace(/\\/g, "/");
// Where a point of a character's source landed in its file (build-report.json has each placement).
const REPORT = JSON.parse(fs.readFileSync(path.join(WORK, "build-report.json"), "utf8"));
const placed = (id, p) => {
  const { factor, offset } = REPORT.find((r) => r.id === id).place;
  return p.map((v, i) => +(v * factor + offset[i]).toFixed(4));
};
// Guinevere's charms in her client file, scaled by 100 as the recipe scales it.
const CHARM_RIGHT = [-0.266, 1.201, 0.212];
const CHARM_LEFT = [0.273, 1.451, 0.029];
const CLIENT = "D:/ren/aspirant-r2/library/v1/others/3d";
const RIGGED = "D:/ren/aspirant/3d";
const BEFORE = (slug) => `D:/ren/aspirant-work/models-room/parts/before-crop/d-${slug}.png`;
const ITEM_VIEWS = ["front", "threeq", "side", "top", "back"];
const POSE = {
  mixamorigSpine1: [0, 25, 10],
  mixamorigRightArm: [30, 0, -40],
  mixamorigRightForeArm: [0, -60, 0],
  mixamorigRightHand: [0, 0, 40],
  mixamorigHead: [20, 0, 0],
  mixamorigLeftUpLeg: [-30, 0, 0],
};

const SHEETS = {
  fanny: [
    { label: "fanny", file: M("fanny"), refs: [BEFORE("fanny")] },
    {
      label: "fanny face",
      file: M("fanny"),
      focus: { center: [0, 1.72, 0.05], size: 0.4 },
      views: ["front", "threeq", "side"],
    },
    { label: "fanny-blade", file: M("fanny-blade"), views: ITEM_VIEWS, axes: 0.3 },
    { label: "fanny-thruster", file: M("fanny-thruster"), views: ITEM_VIEWS, axes: 0.3 },
  ],
  layla: [
    { label: "layla", file: M("layla"), refs: [BEFORE("layla")] },
    {
      label: "layla face",
      file: M("layla"),
      focus: { center: [0, 1.72, 0.05], size: 0.4 },
      views: ["front", "threeq", "side"],
    },
    { label: "layla-gun", file: M("layla-gun"), views: ITEM_VIEWS, axes: 0.3 },
  ],
  ruby: [
    { label: "ruby", file: M("ruby"), refs: [BEFORE("ruby")] },
    {
      label: "ruby, the hand on the scythe",
      file: M("ruby"),
      focus: { center: [-0.26, 1.2, 0.27], size: 0.3 },
      views: ["front", "threeq", "side", "back", "top"],
    },
    {
      label: "source ruby.fbx, test pose",
      file: `${RIGGED}/ruby/ruby.fbx`,
      pose: POSE,
      views: ["front", "threeq", "side"],
    },
    {
      label: "ruby.glb, same test pose",
      file: M("ruby"),
      pose: POSE,
      views: ["front", "threeq", "side"],
    },
    { label: "ruby-scythe", file: M("ruby-scythe"), views: ITEM_VIEWS, axes: 0.3 },
  ],
  angela: [
    { label: "angela", file: M("angela"), refs: [BEFORE("angela")] },
    {
      label: "angela face",
      file: M("angela"),
      focus: { center: [0, 1.7, 0.05], size: 0.42 },
      views: ["front", "threeq", "side", "back"],
    },
    {
      label: "source angela.fbx, test pose",
      file: `${RIGGED}/angela/angela.fbx`,
      pose: POSE,
      views: ["front", "threeq", "side"],
    },
    {
      label: "angela.glb, same test pose",
      file: M("angela"),
      pose: POSE,
      views: ["front", "threeq", "side"],
    },
    {
      label: "the room's old file as the old viewer drew it (one picture per skinned mesh)",
      special: "old-angela-as-drawn",
      views: ["front", "threeq"],
      focus: { center: [0, 1.25, 0], size: 0.9 },
    },
    {
      label: "the same file with every material on its own part",
      special: "old-angela-every-material",
      views: ["front", "threeq"],
      focus: { center: [0, 1.25, 0], size: 0.9 },
    },
  ],
  lesley: [
    {
      label: "room source (lesley.obj)",
      file: `${CLIENT}/lesley/lesley.obj`,
      refs: [BEFORE("lesley")],
    },
    { label: "lesley", file: M("lesley") },
    { label: "lesley-sniper", file: M("lesley-sniper"), views: ITEM_VIEWS, axes: 0.3 },
    { label: "lesley-mecha", file: M("lesley-mecha"), views: ITEM_VIEWS, axes: 0.3 },
  ],
  change: [
    { label: "change", file: M("change"), refs: [BEFORE("change")] },
    { label: "change-moon", file: M("change-moon"), views: ITEM_VIEWS, axes: 0.3 },
  ],
  guinevere: [
    { label: "guinevere", file: M("guinevere"), refs: [BEFORE("guinevere")] },
    {
      label: "source face",
      file: `${CLIENT}/guinevere/guinevere.obj`,
      focus: { match: "high_face_mat", scale: 1.6 },
      views: ["front", "threeq", "side"],
    },
    {
      label: "final face",
      file: M("guinevere"),
      focus: { match: "high_face_mat", scale: 1.6 },
      views: ["front", "threeq", "side"],
    },
    {
      label: "guinevere right hand (charm taken)",
      file: M("guinevere"),
      focus: { center: placed("guinevere", CHARM_RIGHT), size: 0.3 },
      views: ["front", "threeq", "side", "top"],
    },
    {
      label: "guinevere left hand (its twin stays)",
      file: M("guinevere"),
      focus: { center: placed("guinevere", CHARM_LEFT), size: 0.3 },
      views: ["front", "threeq", "side", "top"],
    },
    { label: "guinevere-weapon", file: M("guinevere-weapon"), views: ITEM_VIEWS, axes: 0.02 },
  ],
  vexana: [
    {
      label: "room source (vexana.obj)",
      file: `${CLIENT}/vexana/vexana.obj`,
      hide: ["^Material\\.010$"],
      refs: [BEFORE("vexana")],
    },
    { label: "vexana", file: M("vexana") },
    {
      label: "source eyes",
      file: `${CLIENT}/vexana/vexana.obj`,
      hide: ["^Material\\.010$"],
      focus: { match: "eye_mat", scale: 2.4 },
      views: ["front", "threeq", "side"],
    },
    {
      label: "final eyes",
      file: M("vexana"),
      focus: { match: "eye_mat", scale: 2.4 },
      views: ["front", "threeq", "side"],
    },
    { label: "vexana-staff", file: M("vexana-staff"), views: ITEM_VIEWS, axes: 0.3 },
  ],
  "eternal-guard": [
    {
      label: "room source (vexana-eternal-guard.obj)",
      file: `${CLIENT}/vexana-eternal-guard/vexana-eternal-guard.obj`,
      refs: [BEFORE("vexana-eternal-guard")],
    },
    { label: "eternal-guard", file: M("eternal-guard") },
    { label: "eternal-guard-sword", file: M("eternal-guard-sword"), views: ITEM_VIEWS, axes: 0.3 },
  ],
  drone: [
    {
      label: "aspirant-drone",
      file: M("aspirant-drone"),
      views: ["front", "threeq", "side", "back", "top"],
      axes: 0.3,
    },
    ...[
      "face_angry",
      "face_squint",
      "face_happy",
      "face_dead",
      "face_scan",
      "face_ecg",
      "face_sleepy",
      "face_alert",
    ].map((morph) => ({
      label: `morph ${morph}`,
      file: M("aspirant-drone"),
      morph,
      views: ["front"],
      w: 200,
      h: 200,
    })),
  ],
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHEETS);
const opened = await openPage();
try {
  for (const name of names) {
    const out = path.join(WORK, `sheet-${name}.png`);
    console.log(`== ${name}`);
    await makeSheet(
      {
        out,
        title: `${name}: the finished files (models/v1), axes red X, green Y, blue Z where shown`,
        rows: SHEETS[name],
      },
      opened,
    );
  }
} finally {
  await opened.close();
}
