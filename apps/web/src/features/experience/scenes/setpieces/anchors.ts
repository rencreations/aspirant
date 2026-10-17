import type { SetPieceAnchor } from "../../contract";

/**
 * Inline set pieces: where each sits in the text (`after` is a real paragraph id) and the
 * lazy module that renders it. The reader renders `setPieceRegistry[anchor.id]` right after
 * the paragraph `anchor.after`. Captions are our copy; labels say how to operate the piece.
 */
export const SET_PIECE_ANCHORS: readonly SetPieceAnchor[] = [
  {
    id: "little-lights",
    chapterId: "c01",
    after: "c01-p018",
    caption: "All the little lights",
    label:
      "Tanner's Row at dusk, a thousand dark windows. Click or tap a window to light its lamp, or drag across them. With the keyboard, arrow keys move between windows and Enter or Space lights one.",
  },
  {
    id: "two-stars",
    chapterId: "c10",
    after: "c10-p038",
    caption: "Two stars, one note",
    label:
      "Two gold stars, each humming its own note. Drag one star toward the other, or use the arrow keys, until they sing in tune. The coupling meter rises as they align.",
  },
  {
    id: "sky-breaks-978",
    chapterId: "c12",
    after: "c12-p015",
    caption: "The sky over Valemont",
    label:
      "Press and hold the panel, or hold Space or Enter, to let the sky break and fall silent. Let go to bring the evening back.",
  },
  {
    id: "base-falls",
    chapterId: "c18",
    after: "c18-p034",
    caption: "The Base falls to white",
    label:
      "The Base by the harbour at dusk. Press and hold the panel, or hold Space or Enter, and the street goes white and silent. Let go and the lamp in the window comes back.",
  },
  {
    id: "gantry-square",
    chapterId: "c21",
    after: "c21-p048",
    caption: "Gantry Square",
    label:
      "Aspirant energy as threads of light between two points. Drag either end, or use the arrow keys, and the other follows. Bring them close to square the coupling.",
  },
  {
    id: "orb-breaks",
    chapterId: "c24",
    after: "c24-p020",
    caption: "Why?",
    label:
      "The Twilight Orb. Click or tap it, or press Enter, and it breaks into the lattice of the Matrix and a field of sleepers. Find the one who does not move.",
  },
  {
    id: "two-suns",
    chapterId: "c33",
    after: "c33-p002",
    caption: "The lamp sun and the real one",
    label:
      "A slider between the amber lamps of the Dome and the real red dawn outside. Drag it, or use the arrow keys.",
  },
  {
    id: "does-it-hurt",
    chapterId: "c38",
    after: "c38-p031",
    caption: "Does it hurt?",
    label:
      "Ruby and Angela's question, asked every day. Press Ask to hear each answer so far. Press Take turns to let the other one ask.",
  },
  {
    id: "corridor",
    chapterId: "c47",
    after: "c47-p025",
    caption: "The long white corridor",
    label:
      "Walk the corridor under the cold blue lamps by dragging across it, with the arrow keys, or with the Walk slider. It ends at the black gate.",
  },
  {
    id: "third-floor-lamp",
    chapterId: "c52",
    after: "c52-p047",
    caption: "The lamp on the third floor",
    label: "The Academy tower at night. Switch the lamp in the third-floor window on or off.",
  },
  {
    id: "twin-streams",
    chapterId: "c57",
    after: "c57-p032",
    caption: "Twin streams of light",
    label:
      "Two ribbons of light, one gold and one rose. Move the pointer or drag over the panel, or use the arrow keys, to steer them; together they rise.",
  },
  {
    id: "lighthouses",
    chapterId: "c60",
    after: "c60-p050",
    caption: "A hundred and seventeen lighthouses",
    label:
      "A row of lighthouses on the far shore. Hover, tap or drag across them to light each lamp and hear its note. Arrow keys move along the row and Enter plays one. Let them sing plays the whole row.",
  },
];
