// The size pass: gltf-transform functions composed by hand. `optimize` is not used, because its
// defaults rewrite things this build depends on (simplify edits the cuff and the gem islands,
// palette folds an untextured gem material away, join and flatten move skinned nodes).
import { dedup, prune, quantize, reorder, resample, meshopt } from "@gltf-transform/functions";
import { EXTTextureWebP, KHRMeshQuantization } from "@gltf-transform/extensions";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { fail } from "./env.mjs";

/** A reader and writer that know every extension and can read and write meshopt streams. */
export function makeIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
}

/** Takes `KHR_materials_specular` (and any other material extension) off the materials. With it
 * present GLTFLoader builds MeshPhysicalMaterial; the actors want the plain Standard material. */
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
 * Re-encodes one picture as WebP at a size. `spec`: { size, quality, lossless, alpha }.
 * Returns bytes before and after. A picture that is already smaller is not enlarged.
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
  const out = await image
    .webp({
      quality: spec.quality ?? 85,
      alphaQuality: 100,
      lossless: spec.lossless ?? false,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();
  texture.setImage(new Uint8Array(out)).setMimeType("image/webp");
  return { before, after: out.byteLength };
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
    const size = texture.getSize();
    const result = await compressTexture(texture, rule[1]);
    report.push({ name, from: size, ...result, spec: rule[1] });
  }
  return report;
}

/** Quantised geometry, meshopt streams, redundant keys dropped. Order matters: reorder, then quantize. */
export async function compressGeometry(
  doc,
  { tolerance = 1e-4, level = "high", quantizeOptions = {}, beforeMeshopt = [] } = {},
) {
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
    ...beforeMeshopt,
    meshopt({ encoder: MeshoptEncoder, level }),
  );
}

/** Morph target positions as sparse accessors: only the vertices that move are stored. */
export function sparseTargets(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const target of prim.listTargets()) {
        for (const semantic of target.listSemantics())
          target.getAttribute(semantic).setSparse(true);
      }
    }
  }
}
