import * as lib from "./lib.js";
import { renderRow, drawObject, addGrid } from "./render.js";
import { RECIPES } from "./recipes.js";

const { THREE } = lib;
const fmt = (v) =>
  v
    .toArray()
    .map((x) => +x.toFixed(3))
    .join(", ");

/**
 * The candidate parts of a static source: every island of every object and material, drawn alone
 * and in red on the whole model, with its triangle count, size and middle. For deciding how to cut.
 */
async function explore(file, opts = {}) {
  const { root } = await lib.loadModel(file);
  const all = lib.pieces(root);
  const only = opts.only ? new RegExp(opts.only, "i") : null;
  const whole = new THREE.Group();
  const cands = [];
  for (const p of all) {
    const tag = `${p.object} | ${p.material}`;
    const full = new THREE.Mesh(p.geometry, p.mat);
    whole.add(full);
    if (only && !only.test(tag)) continue;
    const isl = opts.islands === false ? [null] : lib.islands(p.geometry);
    isl.forEach((tris, i) => {
      if (tris && tris.length < (opts.minTris ?? 1)) return;
      const geo = tris ? lib.pick(p.geometry, tris) : p.geometry;
      if (opts.within) {
        const c = lib.boxOf(geo).getCenter(new THREE.Vector3());
        const [x0, y0, z0, x1, y1, z1] = opts.within;
        if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1 || c.z < z0 || c.z > z1) return;
      }
      cands.push({
        tag: `${tag} #${i}`,
        geo,
        mat: p.mat,
        tris: tris ? tris.length : p.geometry.attributes.position.count / 3,
      });
    });
  }
  const cells = [];
  for (const c of cands.slice(0, opts.max ?? 80)) {
    const alone = new THREE.Mesh(c.geo, c.mat);
    const a = drawObject(alone, { views: opts.views ?? ["front", "side"], w: 200, h: 220 });
    const red = new THREE.Mesh(c.geo, c.mat);
    whole.add(red);
    const b = drawObject(whole, { views: ["front"], w: 160, h: 220, highlight: new Set([red]) });
    whole.remove(red);
    const box = lib.boxOf(c.geo);
    const caption = `${c.tag}\n${c.tris} tris, size ${fmt(box.getSize(new THREE.Vector3()))}\ncentre ${fmt(box.getCenter(new THREE.Vector3()))}`;
    cells.push({ urls: [...a.urls, ...b.urls], caption });
    console.log(caption.replace(/\n/g, " / "));
  }
  addGrid(
    opts.title ?? file,
    cells.map((c) => ({ ...c, caption: c.caption })),
  );
  return cands.length;
}

/** Every island of a static source with its size and middle (no pictures). */
async function listIslands(file) {
  const { root } = await lib.loadModel(file);
  const out = [];
  for (const p of lib.pieces(root)) {
    lib.islands(p.geometry).forEach((tris, i) => {
      const box = lib.boxOf(lib.pick(p.geometry, tris));
      out.push({
        object: p.object,
        material: p.material,
        i,
        tris: tris.length,
        center: box.getCenter(new THREE.Vector3()).toArray(),
        size: box.getSize(new THREE.Vector3()).toArray(),
      });
    });
  }
  return out;
}

window.objects = {};

/** Builds one view in the page and returns its GLB (base64) and a short report. */
async function build(id) {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error(`no recipe for ${id}`);
  const { object, report, extras } = await recipe();
  window.objects[id] = object;
  // The original bytes of every picture that came out of an FBX (they have no file on disk).
  const blobs = {};
  const uvRange = [Infinity, Infinity, -Infinity, -Infinity];
  object.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      const src = m.userData.src;
      if (src?.startsWith("blob:")) blobs[src] = null;
    }
    const uv = o.geometry.attributes.uv?.array ?? [];
    for (let i = 0; i < uv.length; i += 2) {
      uvRange[0] = Math.min(uvRange[0], uv[i]);
      uvRange[1] = Math.min(uvRange[1], uv[i + 1]);
      uvRange[2] = Math.max(uvRange[2], uv[i]);
      uvRange[3] = Math.max(uvRange[3], uv[i + 1]);
    }
  });
  for (const src of Object.keys(blobs)) {
    const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    blobs[src] = btoa(s);
  }
  const glb = await lib.exportGlb(object, { extras });
  return { glb, blobs, report: { ...report, uv: uvRange.map((x) => +x.toFixed(3)) } };
}

Object.assign(window, { THREE, lib, renderRow, explore, build, drawObject, listIslands });
window.__ready = true;
