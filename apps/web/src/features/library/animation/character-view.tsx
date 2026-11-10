import { CHARACTER_NAMES, type CharacterSlug } from "@/lib/slugs";

/**
 * The page of `/collection/animation/<character>`. The full screen view is drawn by the room's
 * layout (`AnimationShell`), the same panel that stood on the ring, so the move between the two
 * never cuts the picture. The page holds its heading and one plain sentence.
 */
export function CharacterView({ character }: { character: CharacterSlug }) {
  const name = CHARACTER_NAMES[character];
  return (
    <>
      <h1 className="sr-only">{name}, animation</h1>
      <p className="sr-only">
        The in-game animation of {name}, full screen. The buttons on the right play her other
        animations.
      </p>
    </>
  );
}
