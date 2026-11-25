// The size pass, as `scripts/home/models/lib/optimize.mjs` does it: gltf-transform functions
// composed by hand (dedup, prune, resample, reorder, quantise, meshopt) and the pictures as WebP.
// `optimize` is not used: its simplify, palette, join and flatten would edit skinned meshes.
import { dedup, prune, quantize, reorder, resample, meshopt } from "@gltf-transform/functions";
import { EXTTextureWebP, KHRMeshQuantization } from "@gltf-transform/extensions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { fail } from "./env.mjs";

/** Takes every material extension off (KHR_materials_specular makes three build a Physical material). */
export function stripMaterialExtensions(doc) {
  for (const material of doc.getRoot().listMaterials()) {
    for (const extension of material.listExtensions())
      material.setExtension(extension.extensionName, null);
  }
  for (const extension of doc.getRoot().listExtensionsUsed()) {
    if (extension.extensionName.startsWith("KHR_materials_")) extension.dispose();
  }
}

/**
 * Re-encodes one picture as WebP. `spec`: { size, quality, lossless, alpha }. `alpha: false`
 * drops the alpha channel (a picture of an opaque material, whose alpha holds a game mask).
 * A picture that is already smaller than `size` is not enlarged.
 */
export async function compressTexture(texture, spec) {
  const before = texture.getImage().byteLength;
  let image = sharp(Buffer.from(texture.getImage()), { failOn: "none" });
  const meta = await image.metadata();
  const longest = Math.max(meta.width, meta.height);
  if (spec.size && longest > spec.size) {
    const scale = spec.size / longest;
    image = image.resize(Math.round(meta.width * scale), Math.round(meta.height * scale), {
      kernel: "lanczos3",
    });
  }
  if (spec.alpha === false) image = image.removeAlpha();
  const out = await image
    .webp({
      quality: spec.quality ?? 90,
      alphaQuality: 100,
      lossless: spec.lossless ?? false,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();
  texture.setImage(new Uint8Array(out)).setMimeType("image/webp");
  const after = await sharp(out).metadata();
  return { before, after: out.byteLength, size: [after.width, after.height] };
}

/**
 * Pictures by name pattern. `rules`: [[RegExp, spec], ...], the first match wins. A picture no
 * rule names stops the build: a surprise is a mistake in the source, not a thing to guess at.
 */
export async function compressTextures(doc, rules) {
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const report = [];
  for (const texture of doc.getRoot().listTextures()) {
    const name = texture.getName() || texture.getURI();
    const rule = rules.find(([pattern]) => pattern.test(name));
    if (!rule) fail(`no texture rule for ${name}`);
    const from = texture.getSize();
    const result = await compressTexture(texture, rule[1]);
    report.push({ name, from, ...result });
  }
  return report;
}

/** Quantised geometry, meshopt streams, redundant keys dropped. Order matters: reorder, then quantize. */
export async function compressGeometry(doc, { tolerance = 1e-4, quantizeOptions = {} } = {}) {
  await MeshoptEncoder.ready;
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  await doc.transform(
    dedup({ keepUniqueNames: true }),
    prune({ keepLeaves: true, keepExtras: true }),
    resample({ tolerance }),
    reorder({ encoder: MeshoptEncoder }),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeColor: 8,
      quantizeWeight: 8,
      quantizeGeneric: 12,
      ...quantizeOptions,
    }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
}

/** Drops vertex attributes the room never reads (game data: COLOR_0/1, TEXCOORD_1). */
export function dropAttributes(doc, semantics) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of semantics) {
        const accessor = prim.getAttribute(semantic);
        if (!accessor) continue;
        prim.setAttribute(semantic, null);
        if (accessor.listParents().length <= 1) accessor.dispose();
      }
    }
  }
}
