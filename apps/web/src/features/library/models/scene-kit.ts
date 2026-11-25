import {
  Box3,
  CanvasTexture,
  DoubleSide,
  MeshLambertMaterial,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from "three";

import type { Bounds } from "./camera-math";

/** The part of the canvas that is not under a panel, in CSS pixels from each edge. */
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A soft round shadow under a standing figure. Drawn once into a canvas. */
export function shadowTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(40,48,66,0.2)");
    grad.addColorStop(0.5, "rgba(40,48,66,0.07)");
    grad.addColorStop(1, "rgba(40,48,66,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function disposeTree(root: Object3D): void {
  const textures = new Set<Texture>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      for (const value of Object.values(m)) {
        if (value && (value as Texture).isTexture) textures.add(value as Texture);
      }
      m.dispose();
    }
  });
  textures.forEach((t) => {
    t.dispose();
  });
}

/**
 * The room's look: the base colour of every part under a soft light, both faces of a thin part
 * drawn. Unlit parts of a file (a face shader, an effect) keep their own material.
 */
export function lightMaterials(root: Object3D, anisotropy: number): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    if ((mesh as SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
    const swap = (m: Material): Material => {
      const s = m as MeshStandardMaterial;
      if (!s.isMeshStandardMaterial) return m;
      if (s.map) s.map.anisotropy = anisotropy;
      const lit = new MeshLambertMaterial({
        name: s.name,
        color: s.color,
        map: s.map,
        emissive: s.emissive,
        emissiveMap: s.emissiveMap,
        emissiveIntensity: s.emissiveIntensity,
        alphaMap: s.alphaMap,
        transparent: s.transparent,
        opacity: s.opacity,
        alphaTest: s.alphaTest,
        depthWrite: s.depthWrite,
        side: DoubleSide,
      });
      s.dispose();
      return lit;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}

/** The box of a model in the pose it shows now (skinned parts measured posed). */
export function boundsOf(root: Object3D): Bounds {
  root.updateMatrixWorld(true);
  const box = new Box3();
  root.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (!mesh.isMesh || !mesh.visible) return;
    if (mesh.isSkinnedMesh) mesh.computeBoundingBox();
    else if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const local = mesh.isSkinnedMesh ? mesh.boundingBox : mesh.geometry.boundingBox;
    if (!local) return;
    const b = local.clone();
    // A skinned box is already in the mesh's bind space; the world matrix places it.
    b.applyMatrix4(mesh.matrixWorld);
    box.union(b);
  });
  if (box.isEmpty()) box.set(new Vector3(-0.5, 0, -0.5), new Vector3(0.5, 1, 0.5));
  const c = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  return {
    cx: c.x,
    cy: c.y,
    cz: c.z,
    radius: Math.max(0.02, size.length() / 2),
    minY: box.min.y,
    maxY: box.max.y,
  };
}
