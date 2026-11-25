// selena-phone.glb: Selena's phone alone, a still model, centred on the origin, upright, with the
// back (the purple case and its art) toward +Z.
//
// The phone is `accessory_01` of the entrance file: 88 vertices, its picture is
// selena_skin11_high_fx02_d (the case back with the chibi art and "ASPIRANTS", the screen at
// 14:55 and the edge strips). `accessory_02` beside it is the stack of four message cards
// (fx03_d), not the phone. In the file the phone is bound to `neutral_bone` only and lies flat at
// x = -4 m; the game moves it with `Bone259` under `D_daoju`, which the export did not keep.
import fs from "node:fs";
import path from "node:path";
import { Document } from "@gltf-transform/core";
import { ENTRANCE_GLB, OUT, fail, makeIO, workDir, writeWhole } from "./lib/env.mjs";
import { boxOf, mul } from "./lib/rig.mjs";
import { compressGeometry, compressTextures } from "./lib/optimize.mjs";

const MESH = "selena_silverbolt_raiko_entrance_accessory_01";
const PICTURE = /fx02_d/;
/** The part of the picture that is the case back (u below this). */
const BACK_U = 0.46;

/** Eigenvectors of a symmetric 3x3 matrix (Jacobi), sorted by eigenvalue, largest first. */
function eigen(m) {
  const a = m.map((r) => [...r]);
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p];
        const akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k];
        const aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p];
        const vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return [0, 1, 2]
    .map((i) => ({ value: a[i][i], vector: [v[0][i], v[1][i], v[2][i]] }))
    .sort((x, y) => y.value - x.value);
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a, s) => a.map((x) => x * s);

export async function buildPhone({ out = OUT } = {}) {
  const io = makeIO();
  const src = await io.read(ENTRANCE_GLB);
  const mesh = src
    .getRoot()
    .listMeshes()
    .find((m) => m.getName() === MESH);
  if (!mesh) fail(`no ${MESH}`);
  const node = src
    .getRoot()
    .listNodes()
    .find((n) => n.getMesh() === mesh);
  const skin = node.getSkin();
  const prims = mesh.listPrimitives();
  if (prims.length !== 1) fail("the phone has more than one primitive");
  const prim = prims[0];
  const picture = prim.getMaterial().getBaseColorTexture();
  if (!PICTURE.test(picture.getName())) fail(`the phone's picture is ${picture.getName()}`);

  // Positions and normals where three draws them at rest (skinned by their joints).
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const mats = joints.map((j, i) => mul(j.getWorldMatrix(), ibm.getElement(i, [])));
  const P = prim.getAttribute("POSITION");
  const N = prim.getAttribute("NORMAL");
  const UV = prim.getAttribute("TEXCOORD_0");
  const J = prim.getAttribute("JOINTS_0");
  const W = prim.getAttribute("WEIGHTS_0");
  const count = P.getCount();
  const pos = [];
  const nor = [];
  const uv = [];
  for (let i = 0; i < count; i++) {
    const p = P.getElement(i, []);
    const n = N.getElement(i, []);
    const j = J.getElement(i, []);
    const w = W.getElement(i, []);
    const sp = [0, 0, 0];
    const sn = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      if (!w[k]) continue;
      const m = mats[j[k]];
      for (let r = 0; r < 3; r++) {
        sp[r] += w[k] * (m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
        sn[r] += w[k] * (m[r] * n[0] + m[4 + r] * n[1] + m[8 + r] * n[2]);
      }
    }
    pos.push(sp);
    nor.push(scale(sn, 1 / Math.hypot(...sn)));
    uv.push(UV.getElement(i, []));
  }

  // Its own axes: the longest is up, the next across, the shortest through the phone.
  const box = boxOf(pos);
  const c = box.centre;
  const cov = [0, 1, 2].map((r) =>
    [0, 1, 2].map((s) => pos.reduce((acc, p) => acc + (p[r] - c[r]) * (p[s] - c[s]), 0) / count),
  );
  const [long, mid, thin] = eigen(cov).map((e) => e.vector);
  // Signs from the picture: the case back is u < BACK_U, its top is small v (the lens is in the
  // top left corner of the art) and u grows to the right as the art is seen.
  const back = pos.map((p, i) => [p, uv[i]]).filter(([, t]) => t[0] < BACK_U);
  const mean = (f) => back.reduce((acc, x) => acc + f(x), 0) / back.length;
  const along =
    (axis) =>
    ([p]) =>
      dot(
        p.map((x, k) => x - c[k]),
        axis,
      );
  const out_ = mean(along(thin)) > 0 ? thin : scale(thin, -1);
  // Covariance of v with the long axis: v grows downwards, so up is where v falls.
  const vMean = mean(([, t]) => t[1]);
  const covV = mean((x) => (x[1][1] - vMean) * along(long)(x));
  const up = covV < 0 ? long : scale(long, -1);
  const uMean = mean(([, t]) => t[0]);
  const covU = mean((x) => (x[1][0] - uMean) * along(mid)(x));
  const right = covU > 0 ? mid : scale(mid, -1);
  const handed = dot(cross(right, up), out_);
  // A right handed frame with the art not mirrored has right x up = out.
  const X = handed > 0 ? right : cross(up, out_);
  const R = [X, up, out_];
  const report = {
    mesh: MESH,
    picture: picture.getName(),
    sourceBox: { min: box.min.map((x) => +x.toFixed(4)), max: box.max.map((x) => +x.toFixed(4)) },
    axes: {
      right: X.map((x) => +x.toFixed(3)),
      up: up.map((x) => +x.toFixed(3)),
      out: out_.map((x) => +x.toFixed(3)),
    },
    artMirrored: handed < 0,
  };

  // A new file: one node, one plain (unskinned) mesh.
  const doc = new Document();
  const buffer = doc.createBuffer();
  const newPos = new Float32Array(count * 3);
  const newNor = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const d = pos[i].map((x, k) => x - c[k]);
    for (let r = 0; r < 3; r++) {
      newPos[i * 3 + r] = dot(R[r], d);
      newNor[i * 3 + r] = dot(R[r], nor[i]);
    }
  }
  const newBox = boxOf(
    Array.from({ length: count }, (_, i) => [newPos[i * 3], newPos[i * 3 + 1], newPos[i * 3 + 2]]),
  );
  for (let i = 0; i < count; i++) for (let r = 0; r < 3; r++) newPos[i * 3 + r] -= newBox.centre[r];
  report.size = newBox.size.map((x) => +x.toFixed(4));
  const accessor = (type, array) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const texture = doc
    .createTexture(picture.getName().replace(/\.png$/, ""))
    .setImage(picture.getImage())
    .setMimeType(picture.getMimeType());
  const material = doc
    .createMaterial("selena_phone")
    .setBaseColorTexture(texture)
    .setDoubleSided(prim.getMaterial().getDoubleSided())
    .setMetallicFactor(0)
    .setRoughnessFactor(1);
  const p = doc
    .createPrimitive()
    .setAttribute("POSITION", accessor("VEC3", newPos))
    .setAttribute("NORMAL", accessor("VEC3", newNor))
    .setAttribute("TEXCOORD_0", accessor("VEC2", new Float32Array(uv.flat())))
    .setIndices(accessor("SCALAR", new Uint16Array(prim.getIndices().getArray())))
    .setMaterial(material);
  const m = doc.createMesh("selena-phone").addPrimitive(p);
  const n = doc.createNode("selena-phone").setMesh(m);
  doc.createScene("selena-phone").addChild(n);
  doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);

  report.textures = await compressTextures(doc, [
    [/fx02_d/, { size: 1024, quality: 92, alpha: false }],
  ]);
  await compressGeometry(doc);
  const file = path.join(out, "selena-phone.glb");
  const bytes = await io.writeBinary(doc);
  writeWhole(file, bytes);
  report.file = file;
  report.bytes = bytes.byteLength;
  fs.writeFileSync(
    path.join(workDir(), "selena-phone.report.json"),
    JSON.stringify(report, null, 1),
  );
  console.log(
    JSON.stringify({ size: report.size, axes: report.axes, artMirrored: report.artMirrored }),
  );
  return report;
}
