/**
 * The two comics the section offers, as pictures for the cards beside Tetra (plain images in the
 * markup). Her book has no pictures: it is made of shapes (`actors/tetra/props/book-mesh.ts`).
 */
export const CARD_PICTURES = {
  left: "/img/home/comic-aspirants.webp",
  right: "/img/home/comic-vexana-guinevere.webp",
} as const;

export type CoverSide = keyof typeof CARD_PICTURES;
