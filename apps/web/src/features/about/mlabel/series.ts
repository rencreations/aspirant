export const SERIES = [
  {
    slug: "aspirants",
    name: "The Aspirant",
    characters: "Obsidia, Selena, Guinevere, Vexana, Lesley, Chang’e, Ruby, Angela, Layla, Fanny",
    description:
      "Anime-styled skin series in a mecha world with The Aspirants being the main power of humanity in saving the world from The Enders.",
  },
  {
    slug: "nexus-sea",
    name: "Nexus Sea",
    characters: "Nolan, Layla, Thamuz, Xavier, Melissa, Floryn",
    description:
      "Nexus Sea is an alternate-universe cosmic expanse with Navigators guarding the Lighthouse or universe from being destroyed.",
  },
  {
    slug: "kishin-densetsu",
    name: "Kishin Densetsu",
    characters: "Lunox, Franco, Dyrroth, Karrie, Lancelot, Angela",
    description:
      "Kishin Densetsu is a dark-fantasy Japanese-inspired story centered around shrine guardians, a fallen warlord, and demonic forces from Naraka (hell).",
  },
  {
    slug: "soul-vessels",
    name: "Soul Vessels",
    characters: "Benedetta, Cecilion, Clint, Hanabi, Aamon",
    description:
      "Soul Vessels revolves around a dark symbiosis between mortals and Great Perils, primordial celestial spirits corrupted by darkness.",
  },
] as const;

export const FILM_STRIPS = ["Play the film", "TheMLabel", ...SERIES.map(({ name }) => name)];

// Distances are screens of vertical travel after the ident has assembled.
export const ROW_START = 3.5;
export const PANEL_TRAVEL = 1.25;
export const FILM_AT = ROW_START + SERIES.length * PANEL_TRAVEL;
export const GALLERY_SCREENS = FILM_AT + 2.25;
