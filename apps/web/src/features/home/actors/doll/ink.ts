/**
 * The line round the doll. Her hair is made of open sheets, which have no inside, so the inverted
 * hull of the toon system (a copy pushed out along the normals) cannot outline her. This is the
 * other way: the mesh is drawn again `COPIES` times in ink colour, each copy shifted on the screen
 * by the line's width in another direction round a circle and sent back in depth, so a ring of ink
 * shows round every edge that has nothing nearer behind it.
 *
 * It differs from the toon system's card ink (`addCardInk`) in one thing that matters here: the
 * depth push moves only the depth, not the picture. The toon system pushes the copy back in view
 * space, which also shrinks it toward the middle of the screen: harmless for a push of a pixel, but
 * the doll needs a push of many pixels (a hair sheet seen edge on has a steep slope, and a small push
 * lets the shifted copy of the sheet next to it paint over it), and that shrink ate the line.
 *
 * The text of the patch is here, so a test can check its anchor in the installed three.
 */
import {
  MeshBasicMaterial,
  SkinnedMesh,
  Vector2,
  type IUniform,
  type Side,
  type WebGLProgramParametersWithUniforms,
} from "three";

import { INK_COLOR, toonLight, type Ink, type InkMaterial } from "../shared/toon";

export const COPIES = 8;

const PROJECT_CHUNK = "#include <project_vertex>";

/**
 * The vertex shader of one copy: the position as the stock shader finds it, shifted by `uInkShift`
 * (a unit vector) times the line's width, its depth taken from the same point pushed back by
 * `uInkPush` view units.
 */
export function patchDollInkVertex(source: string): string {
  const at = source.indexOf(PROJECT_CHUNK);
  if (at < 0) {
    console.warn(`[doll ink] shader anchor not found: ${PROJECT_CHUNK}`);
    return source;
  }
  const patched = `${PROJECT_CHUNK}
	{
		vec4 pushedView = mvPosition;
		pushedView.z -= uInkPush;
		vec4 pushedClip = projectionMatrix * pushedView;
		vec4 inkClip = gl_Position;
		inkClip.xy += uInkShift * ( 2.0 * uInkPx ) / uToonView * inkClip.w;
		inkClip.z = pushedClip.z / pushedClip.w * inkClip.w;
		gl_Position = inkClip;
	}`;
  return `uniform float uInkPx;\nuniform float uInkPush;\nuniform vec2 uToonView;\nuniform vec2 uInkShift;\n${source.slice(0, at)}${patched}${source.slice(at + PROJECT_CHUNK.length)}`;
}

/** The unit vector of copy `i` of `count`, round the circle. */
export function shiftOf(i: number, count: number = COPIES): [number, number] {
  const a = (i / count) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)];
}

/** One copy's material: plain ink colour, no picture, its own shift, the width and push of `ink`. */
class DollInkMaterial extends MeshBasicMaterial {
  constructor(ink: InkMaterial, shiftX: number, shiftY: number, side: Side) {
    super({ color: INK_COLOR, side, toneMapped: false, fog: false });
    const shift: IUniform<Vector2> = { value: new Vector2(shiftX, shiftY) };
    this.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, {
        uInkPx: ink.px,
        uInkPush: ink.push,
        uToonView: toonLight.view,
        uInkShift: shift,
      });
      shader.vertexShader = patchDollInkVertex(shader.vertexShader);
    };
    this.customProgramCacheKey = () => "home-doll-ink-v1";
  }
}

/** Put the ink copies of a skinned mesh beside it: same skeleton, same pose, one material each. */
export function addInkCopies(source: SkinnedMesh, ink: InkMaterial, side: Side): Ink {
  const copies: SkinnedMesh[] = [];
  for (let i = 0; i < COPIES; i += 1) {
    const [dx, dy] = shiftOf(i);
    const copy = new SkinnedMesh(source.geometry, new DollInkMaterial(ink, dx, dy, side));
    copy.name = `${source.name}_ink_${i}`;
    copy.position.copy(source.position);
    copy.quaternion.copy(source.quaternion);
    copy.scale.copy(source.scale);
    copy.updateMatrix();
    copy.bind(source.skeleton, source.bindMatrix);
    copy.frustumCulled = false;
    source.parent?.add(copy);
    copies.push(copy);
  }
  return {
    mesh: copies[0] ?? source,
    remove: () => {
      for (const copy of copies) {
        copy.removeFromParent();
        (copy.material as MeshBasicMaterial).dispose();
      }
    },
  };
}
