// Looking at the source mesh: which triangles a selection holds, painted over the base picture.
// Used to choose and to prove the face triangles (curation/face-tris.json). Not part of the file.
import * as THREE from "three";

let renderer;
let scene;
let camera;
let shown = null;

function ensure(width, height) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#8d96a1");
    camera = new THREE.PerspectiveCamera(14, 1, 1, 2000);
  }
  renderer.setSize(width, height, false);
}

/** Replaces the source mesh's material with the base picture and a per-triangle tint. */
export async function openSelection(source, baseUrl = null) {
  ensure(600, 600);
  if (shown) scene.remove(shown.root);
  const { root, mesh } = source;
  const geometry = mesh.geometry;
  const triangles = geometry.attributes.position.count / 3;
  const sel = new Float32Array(geometry.attributes.position.count);
  geometry.setAttribute("aSel", new THREE.BufferAttribute(sel, 1));
  const base = baseUrl
    ? await new THREE.TextureLoader().loadAsync(baseUrl)
    : (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).map;
  for (let i = 0; i < 200 && !(base.image && (base.image.complete || base.image.width)); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  base.colorSpace = THREE.SRGBColorSpace;
  base.needsUpdate = true;
  const uniforms = { uTint: { value: new THREE.Color(1, 0, 0.8) }, uMix: { value: 0.6 } };
  const material = new THREE.MeshBasicMaterial({ map: base, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSel;\nvarying float vSel;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSel = aSel;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vSel;\nuniform vec3 uTint;\nuniform float uMix;",
      )
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\nvec3 tint = mix(uTint, vec3(0.0, 1.0, 0.2), step(1.5, vSel));\ndiffuseColor.rgb = mix(diffuseColor.rgb, tint, uMix * step(0.5, vSel));",
      );
  };
  mesh.material = material;
  scene.add(root);
  shown = { root, mesh, geometry, triangles, sel };
  return { triangles };
}

/** `indices`: the selected triangles; `extra`: a second set, drawn in another colour (optional). */
export function setSelection(indices, second = []) {
  shown.sel.fill(0);
  for (const t of indices) shown.sel.fill(1, t * 3, t * 3 + 3);
  for (const t of second) shown.sel.fill(2, t * 3, t * 3 + 3);
  shown.geometry.attributes.aSel.needsUpdate = true;
}

/**
 * Pictures of the head: `yaws` in degrees (0 is the front), at `size` pixels each, in one sheet.
 * The doll's own centre line is at x about 3.7 and the face about y 85, in the file's centimetres.
 */
export function headSheet(yaws, { size = 520, across = 95, tint = true, y = 86, x = 4 } = {}) {
  ensure(size, size);
  const cols = yaws.length;
  const out = document.createElement("canvas");
  out.width = size * cols;
  out.height = size;
  const g = out.getContext("2d");
  shown.root.updateMatrixWorld(true);
  const distance = across / 2 / Math.tan((7 * Math.PI) / 180);
  const centre = new THREE.Vector3(x, y, 25);
  yaws.forEach((yaw, i) => {
    const a = (yaw * Math.PI) / 180;
    camera.position.set(
      centre.x + Math.sin(a) * distance,
      centre.y,
      centre.z + Math.cos(a) * distance,
    );
    camera.lookAt(centre);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    g.drawImage(renderer.domElement, i * size, 0);
    g.fillStyle = "#000";
    g.font = "bold 14px sans-serif";
    g.fillText(`yaw ${yaw}`, i * size + 8, 18);
  });
  return out.toDataURL("image/png");
}

/** Triangle facts the Python helpers need that are cheap here: the index of each triangle's skin bone. */
export function triangleCount() {
  return shown.triangles;
}
