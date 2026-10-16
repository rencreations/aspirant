/**
 * The glossary behind every hover card: names, places and terms from the story.
 *
 * Each `short` line is our own wording, grounded only in the sources (the novel text,
 * CANON-NOTES and the character bible). No lore is added.
 *
 * `aliases` are matched case-sensitively and as whole words by
 * `scripts/content/build-story.mjs`, longest first, so list every spelling the text uses.
 * `firstChapter` is the first chapter, in reading order, where the build annotates the entity;
 * the content tests check it against the story JSON.
 *
 * This file is imported by the Node build script, so it must stay plain erasable TypeScript:
 * type-only imports, no enums, no value imports.
 */
import type { ChapterId, Slug } from "./types";

export type EntityKind = "character" | "person" | "place" | "term" | "org" | "object";

export interface Entity {
  readonly id: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly kind: EntityKind;
  /** One line, at most 160 characters. */
  readonly short: string;
  readonly characterSlug?: Slug;
  /** For the Aspirants: their partner. */
  readonly partnerOf?: Slug;
  readonly firstChapter?: ChapterId;
}

export const entities: readonly Entity[] = [
  // The ten Aspirants
  {
    id: "fanny",
    label: "Fanny",
    aliases: ["Fanny", "Blade of Kibou"],
    kind: "character",
    short:
      "Blade of Kibou. A warm, careful transfer student from the Cadet Corps who flies on a steel cable. Layla's partner.",
    characterSlug: "fanny",
    partnerOf: "layla",
    firstChapter: "c02",
  },
  {
    id: "layla",
    label: "Layla",
    aliases: ["Layla", "Miss Hikari"],
    kind: "character",
    short:
      "Miss Hikari. A small, proud top student from Tanner's Row with a cannon as tall as she is. Fanny's partner.",
    characterSlug: "layla",
    partnerOf: "fanny",
    firstChapter: "c01",
  },
  {
    id: "ruby",
    label: "Ruby",
    aliases: ["Ruby", "Mecha Maiden"],
    kind: "character",
    short:
      "Mecha Maiden. The heir of a Decision Maker on Oro. She built Angela and fights with a great scythe.",
    characterSlug: "ruby",
    partnerOf: "angela",
    firstChapter: "c29",
  },
  {
    id: "angela",
    label: "Angela",
    aliases: ["Angela", "Cyber Cherubin"],
    kind: "character",
    short:
      "Cyber Cherubin. The android Ruby built on Oro. Gentle and brave, she shields others with Tetra at her side.",
    characterSlug: "angela",
    partnerOf: "ruby",
    firstChapter: "c29",
  },
  {
    id: "lesley",
    label: "Lesley",
    aliases: ["Lesley", "Deadeye Spectre"],
    kind: "character",
    short:
      "Deadeye Spectre. A quiet, steady sniper with a cover over one eye. She leads the Academy's combat training.",
    characterSlug: "lesley",
    partnerOf: "change",
    firstChapter: "c02",
  },
  {
    id: "change",
    label: "Chang'e",
    aliases: ["Chang'e", "Tech Tensai"],
    kind: "character",
    short:
      "Tech Tensai. The Academy's Chief Scientist: very small, very clever and very proud. Her robot friend is Mr. Bunny.",
    characterSlug: "change",
    partnerOf: "lesley",
    firstChapter: "c01",
  },
  {
    id: "guinevere",
    label: "Guinevere",
    aliases: ["Guinevere", "Guin", "Daybreak Halo"],
    kind: "character",
    short:
      "Daybreak Halo. A rich girl who left her grand house to fight on her own merits. She calls herself the Queen.",
    characterSlug: "guinevere",
    partnerOf: "vexana",
    firstChapter: "c04",
  },
  {
    id: "vexana",
    label: "Vexana",
    aliases: ["Vexana", "Sana", "Twilight Star"],
    kind: "character",
    short:
      "Twilight Star. A quiet girl who hides in a cupboard and can hear the Enders hum. Guinevere's partner.",
    characterSlug: "vexana",
    partnerOf: "guinevere",
    firstChapter: "c05",
  },
  {
    id: "obsidia",
    label: "Obsidia",
    aliases: ["Obsidia", "Imperatrix Arashi"],
    kind: "character",
    short:
      "Imperatrix Arashi. The first Ender to wake and ask why. She commands the Enders from the Storm Citadel.",
    characterSlug: "obsidia",
    firstChapter: "c12",
  },
  {
    id: "selena",
    label: "Selena",
    aliases: ["Selena", "Silverbolt Raiko"],
    kind: "character",
    short:
      "Silverbolt Raiko. The Academy's best young mechanic, with red eyes, a lazy smile and a friend for everyone.",
    characterSlug: "selena",
    firstChapter: "c08",
  },

  // People
  {
    id: "karina-voss",
    label: "Karina Voss",
    aliases: ["Karina Voss", "Karina"],
    kind: "person",
    short:
      "A rescue worker who lives above a bakery in Terrinia. Finding people is what she does, and she stays with them.",
    firstChapter: "c11",
  },
  {
    id: "harlan",
    label: "Harlan",
    aliases: ["Harlan"],
    kind: "person",
    short:
      "Guinevere's old bodyguard, huge and quiet. Sacked for a kindness, he became the Academy's night porter at the north gate.",
    firstChapter: "c04",
  },
  {
    id: "tigreal",
    label: "Tigreal",
    aliases: ["Tigreal"],
    kind: "person",
    short:
      "Fanny's elder brother: a broad, quiet front-line fighter of the Shield. They were orphaned together in the shelters.",
    firstChapter: "c02",
  },
  {
    id: "roger",
    label: "Roger",
    aliases: ["Roger"],
    kind: "person",
    short: "A gentle trainee medic and the third member of Team B3, with Layla and Fanny.",
    firstChapter: "c01",
  },
  {
    id: "mr-bunny",
    label: "Mr. Bunny",
    aliases: ["Mr. Bunny"],
    kind: "person",
    short:
      "Chang'e's robot friend. He began as a tin wind-up rabbit, and he can unfold into a giant the size of a house.",
    firstChapter: "c02",
  },
  {
    id: "tetra",
    label: "Tetra",
    aliases: ["Tetra"],
    kind: "person",
    short:
      "A doll-sized floating twin of Angela, made by Ruby to keep her company. Named Tetra because it was the fourth.",
    firstChapter: "c35",
  },
  {
    id: "pip",
    label: "Pip",
    aliases: ["Pip"],
    kind: "person",
    short:
      "A small maintenance android from Oro with one red lens. One of Angela's friends in the barracks.",
    firstChapter: "c37",
  },
  {
    id: "corvin",
    label: "Corvin",
    aliases: ["Corvin"],
    kind: "person",
    short:
      "An old android captain from Oro in a tattered green cloak. One of Angela's friends in the barracks.",
    firstChapter: "c37",
  },
  {
    id: "daisy",
    label: "Daisy",
    aliases: ["Daisy"],
    kind: "person",
    short:
      "A white medic android from Oro with a red cross on her chest. One of Angela's friends in the barracks. She wanted to see the sun.",
    firstChapter: "c37",
  },
  {
    id: "brandt",
    label: "Sergeant Brandt",
    aliases: ["Brandt"],
    kind: "person",
    short:
      "A lean grey sergeant of the Cadet Corps. He taught Lesley to shoot, and years later he trained Fanny.",
    firstChapter: "c02",
  },
  {
    id: "ostrander",
    label: "Ostrander",
    aliases: ["Ostrander"],
    kind: "person",
    short:
      "An old armourer and foreman who smokes a pipe by the forge. He gives little advice and a great deal of quiet help.",
    firstChapter: "c10",
  },
  {
    id: "pia",
    label: "Pia",
    aliases: ["Pia"],
    kind: "person",
    short: "Layla's roommate at the Academy. She keeps Layla's green cushion warm.",
    firstChapter: "c03",
  },
  {
    id: "odile",
    label: "Odile",
    aliases: ["Odile"],
    kind: "person",
    short: "The woman who makes the stew in the Academy dining hall.",
    firstChapter: "c02",
  },
  {
    id: "dolly",
    label: "Dolly",
    aliases: ["Dolly"],
    kind: "person",
    short: "The girl in the apron at the Girls' House. She stitches small charm dolls from scraps.",
    firstChapter: "c09",
  },
  {
    id: "odalys",
    label: "Odalys",
    aliases: ["Odalys"],
    kind: "person",
    short:
      "The Academy's tall, calm champion. In the final of the Combat Trials she tied her own arm to make it fair.",
    firstChapter: "c06",
  },
  {
    id: "the-chairman",
    label: "The Chairman",
    aliases: ["Chairman"],
    kind: "person",
    short:
      "Guinevere's father, whose name is carved over banks, ships and shops. He never asked his daughter what she wanted.",
    firstChapter: "c04",
  },
  {
    id: "maren-quill",
    label: "Maren Quill",
    aliases: ["Maren Quill", "Quill"],
    kind: "person",
    short:
      "Director of Oro's Institute. She found how the Enders were commanded and learned how the Core works.",
    firstChapter: "c36",
  },
  {
    id: "mr-pomfrey",
    label: "Mr Pomfrey",
    aliases: ["Mr Pomfrey", "Mr. Pomfrey"],
    kind: "object",
    short: "Guinevere's large stuffed bear in a sailor suit, a present from her nurse.",
    firstChapter: "c08",
  },
  {
    id: "tomas",
    label: "Tomas",
    aliases: ["Tomas"],
    kind: "person",
    short: "Lesley's father, who repaired machines in Valemont and let her wear his old cap.",
    firstChapter: "c11",
  },
  {
    id: "marta",
    label: "Marta",
    aliases: ["Marta"],
    kind: "person",
    short: "Lesley's mother, who taught at the school in Valemont and hummed all day.",
    firstChapter: "c11",
  },
  {
    id: "pim",
    label: "Pim",
    aliases: ["Pim"],
    kind: "person",
    short: "Lesley's little brother. He was three at the festival of First Light in 978.",
    firstChapter: "c11",
  },
  {
    id: "dov",
    label: "Dov",
    aliases: ["Dov"],
    kind: "person",
    short: "Karina's partner in the rescue wagon on the stormy night at Hollin Reach.",
    firstChapter: "c27",
  },
  {
    id: "hale",
    label: "Hale",
    aliases: ["Hale"],
    kind: "person",
    short: "A grey-haired woman, the first commander of the Shield of Dawnbreak.",
    firstChapter: "c13",
  },
  {
    id: "orla",
    label: "Orla",
    aliases: ["Orla"],
    kind: "person",
    short:
      "A clerk who found the old skipping rhyme in a book of folk tales. It gave the Enders their name.",
    firstChapter: "c13",
  },
  {
    id: "piet",
    label: "Piet",
    aliases: ["Piet"],
    kind: "person",
    short:
      "A scholar who copied the carvings of an old temple in the far north. He read them as a sign that the Enders weigh worlds.",
    firstChapter: "c18",
  },
  {
    id: "the-marshal",
    label: "The Marshal",
    aliases: ["Marshal"],
    kind: "person",
    short:
      "A tall old lord of the Beaumont with a silver baton. He commanded Oro's ship on the Day of the Breach.",
    firstChapter: "c39",
  },
  {
    id: "ottoline",
    label: "Ottoline",
    aliases: ["Ottoline"],
    kind: "person",
    short: "A freckled student who sewed the banner for the Selena-senpai Appreciation Society.",
    firstChapter: "c52",
  },

  // Places
  {
    id: "dawnbreak",
    label: "Dawnbreak",
    aliases: ["Dawnbreak"],
    kind: "place",
    short: "A young, green planet with a blue lake and a wide sea. The home of the Aspirants.",
    firstChapter: "c02",
  },
  {
    id: "terrinia",
    label: "Terrinia",
    aliases: ["Terrinia"],
    kind: "place",
    short:
      "The last great city of Dawnbreak, built around a lake that opens into the sea. The Defence Sphere covers it.",
    firstChapter: "c01",
  },
  {
    id: "selrick-academy",
    label: "Selrick Academy",
    aliases: ["Selrick Academy", "Academy"],
    kind: "place",
    short:
      "The school for aspirant power in Terrinia. Lesley and Chang'e built it on the ruins of Selrick Base.",
    firstChapter: "c01",
  },
  {
    id: "selrick-base",
    label: "Selrick Base",
    aliases: ["Selrick Base"],
    kind: "place",
    short:
      "The Shield's research post by the harbour, in an old weather observatory. A dormant Ender lay there under glass.",
    firstChapter: "c05",
  },
  {
    id: "gantry",
    label: "The gantry",
    aliases: ["gantry", "secret base"],
    kind: "place",
    short:
      "Layla's secret base: a narrow steel walkway seventy metres up the Academy's central tower, with a view of the sea.",
    firstChapter: "c01",
  },
  {
    id: "tanners-row",
    label: "Tanner's Row",
    aliases: ["Tanner's Row"],
    kind: "place",
    short:
      "A poor street in the lower terraces of Terrinia. Layla's mother keeps a stall of cloth, buttons and thread there.",
    firstChapter: "c01",
  },
  {
    id: "crown-heights",
    label: "Crown Heights",
    aliases: ["Crown Heights"],
    kind: "place",
    short:
      "A green hill above Terrinia. Guinevere grew up there, in a house with two hundred and forty windows.",
    firstChapter: "c04",
  },
  {
    id: "harbour-front",
    label: "Harbour Front",
    aliases: ["Harbour Front", "harbour front"],
    kind: "place",
    short:
      "Terrinia's quays and sea-wall, with an old wooden roller-coaster called the Star Chaser.",
    firstChapter: "c09",
  },
  {
    id: "valemont",
    label: "Valemont",
    aliases: ["Valemont"],
    kind: "place",
    short: "A small town in the green hills of Dawnbreak, where Lesley grew up.",
    firstChapter: "c11",
  },
  {
    id: "hollin-reach",
    label: "Hollin Reach",
    aliases: ["Hollin Reach"],
    kind: "place",
    short:
      "A small river town. Some years before 978, a strange storm scorched its north end into black glass.",
    firstChapter: "c27",
  },
  {
    id: "underhill",
    label: "Underhill",
    aliases: ["Underhill"],
    kind: "place",
    short: "A black market in old, forgotten cellars under the lower terraces of Terrinia.",
    firstChapter: "c50",
  },
  {
    id: "oro",
    label: "Oro",
    aliases: ["Oro"],
    kind: "place",
    short:
      "An old golden planet, very far from Dawnbreak. Its seas and forests were burned in a long war, and its people live under domes.",
    firstChapter: "c24",
  },
  {
    id: "dorado",
    label: "Dorado",
    aliases: ["Dorado"],
    kind: "place",
    short:
      "Oro's capital, under a huge glass dome. Every morning at six, amber lamps make a false sunrise.",
    firstChapter: "c33",
  },
  {
    id: "the-dome",
    label: "The Dome",
    aliases: ["Dome"],
    kind: "place",
    short:
      "The glass dome over Dorado. Nine million people live under it, and almost none have seen the real sun.",
    firstChapter: "c33",
  },
  {
    id: "tinkers-row",
    label: "Tinker's Row",
    aliases: ["Tinker's Row"],
    kind: "place",
    short:
      "A ruined lane in Terrinia with a dry fountain. Ruby and Angela rebuilt it during their sentence.",
    firstChapter: "c43",
  },
  {
    id: "bell-tower",
    label: "The bell tower",
    aliases: ["bell tower"],
    kind: "place",
    short:
      "An old sandstone tower at the east end of the Academy quad. Its one bell rings once a year, on the first day of winter.",
    firstChapter: "c31",
  },
  {
    id: "gantry-square",
    label: "Gantry Square",
    aliases: ["Gantry Square"],
    kind: "place",
    short:
      "The place where Lesley and Chang'e first fought the Enders together. The histories call it the Engagement at Gantry Square.",
    firstChapter: "c21",
  },
  {
    id: "girls-house",
    label: "The Girls' House",
    aliases: ["Girls' House", "girls' house"],
    kind: "place",
    short: "A café and shop in the lower terraces, full of ribbons, glass animals and cats.",
    firstChapter: "c09",
  },
  {
    id: "chapel",
    label: "The chapel",
    aliases: ["chapel"],
    kind: "place",
    short:
      "The Academy room where new pairs say their promise aloud. Small blue four-pointed stars hang from the beams.",
    firstChapter: "c06",
  },
  {
    id: "armoury",
    label: "The Armoury",
    aliases: ["Armoury"],
    kind: "place",
    short:
      "The Academy's weapon workshop in the basement. It built Layla's cannon and the first mecha.",
    firstChapter: "c01",
  },
  {
    id: "storm-citadel",
    label: "The Storm Citadel",
    aliases: ["Storm Citadel", "Citadel"],
    kind: "place",
    short:
      "Obsidia's flying fortress: tall and spired, with red light in its seams. Other motherships carry a storm. The Citadel is one.",
    firstChapter: "c12",
  },
  {
    id: "star-chaser",
    label: "The Star Chaser",
    aliases: ["Star Chaser"],
    kind: "place",
    short:
      "An old wooden roller-coaster on the harbour front. Guinevere and Vexana rode it eleven times.",
    firstChapter: "c09",
  },
  {
    id: "virtual-battlefield",
    label: "The Virtual Battlefield",
    aliases: ["Virtual Battlefield"],
    kind: "place",
    short:
      "A huge Academy hall where ten thousand tiny lights make a ruined city. Trainees fight copies of Enders there.",
    firstChapter: "c30",
  },
  {
    id: "hall-of-the-sleepers",
    label: "The Hall of the Sleepers",
    aliases: ["Hall of the Sleepers"],
    kind: "place",
    short:
      "A vast dark hall inside the Storm Citadel, where Obsidia's fleet sleeps in tall glass cells.",
    firstChapter: "c51",
  },
  {
    id: "chamber-of-likenesses",
    label: "The Chamber of Likenesses",
    aliases: ["Chamber of Likenesses"],
    kind: "place",
    short: "The place where Obsidia grew humanoid Enders in vats.",
    firstChapter: "c26",
  },

  // Groups
  {
    id: "shield-of-dawnbreak",
    label: "The Shield of Dawnbreak",
    aliases: ["Shield of Dawnbreak", "the Shield"],
    kind: "org",
    short:
      "Dawnbreak's army, founded after 978 by the desperate: police, rescue workers, old soldiers, hunters and engineers.",
    firstChapter: "c02",
  },
  {
    id: "cadet-corps",
    label: "The Cadet Corps",
    aliases: ["Cadet Corps", "Corps"],
    kind: "org",
    short:
      "The army's school on the cliffs across the harbour. It trains children who lost their parents as soldiers of the Shield.",
    firstChapter: "c01",
  },
  {
    id: "legion",
    label: "The Legion",
    aliases: ["Legion", "Legions"],
    kind: "org",
    short:
      "Oro's android soldiers, made to look like slender girls with cat-ear horns. Their eyes light pink when an order comes.",
    firstChapter: "c28",
  },
  {
    id: "institute",
    label: "The Institute",
    aliases: ["Institute"],
    kind: "org",
    short: "Oro's Institute of Technology. It builds the machines, the weapons and the Domes.",
    firstChapter: "c29",
  },
  {
    id: "beaumont",
    label: "The Beaumont",
    aliases: ["Beaumont"],
    kind: "org",
    short: "The oldest and richest families of Oro. They own its land and its treasure.",
    firstChapter: "c33",
  },
  {
    id: "decision-makers",
    label: "The Decision Makers",
    aliases: ["Decision Makers", "Decision Maker"],
    kind: "org",
    short:
      "Nine rulers of Oro whose office passes from parent to child. When the others cannot agree, a Decision Maker decides.",
    firstChapter: "c33",
  },
  {
    id: "high-council",
    label: "The High Council",
    aliases: ["High Council"],
    kind: "org",
    short: "Oro's government of three seats: the Institute, the Beaumont and the Decision Makers.",
    firstChapter: "c33",
  },
  {
    id: "team-b3",
    label: "Team B3",
    aliases: ["Team B3"],
    kind: "org",
    short: "The training team of Layla, Fanny and Roger in the Virtual Battlefield.",
    firstChapter: "c03",
  },
  {
    id: "appreciation-society",
    label: "The Selena-senpai Appreciation Society",
    aliases: ["SELENA-SENPAI APPRECIATION SOCIETY"],
    kind: "org",
    short:
      "A club of Academy students devoted to Selena. Its banner has a small stitched dragon in the middle.",
    firstChapter: "c52",
  },

  // Terms
  {
    id: "aspirant-power",
    label: "Aspirant power",
    aliases: ["aspirant power", "Aspirant power", "ASPIRANT POWER", "Aspirant energy"],
    kind: "term",
    short:
      "The power of a heart that is whole and holds on to one thing. Two partners together make it stronger.",
    firstChapter: "c01",
  },
  {
    id: "aspirants",
    label: "Aspirants",
    aliases: ["Aspirants", "Aspirant"],
    kind: "term",
    short: "Young women of Selrick Academy who have aspirant power. They train and fight in pairs.",
    firstChapter: "c01",
  },
  {
    id: "enders",
    label: "Enders",
    aliases: ["Enders", "Ender"],
    kind: "term",
    short:
      "Living weapons made by the Will of the Planet, with dark armour and violet fire in their veins. They feel no hate.",
    firstChapter: "c02",
  },
  {
    id: "ultra-enders",
    label: "Ultra Enders",
    aliases: ["Ultra Enders", "Ultra Ender", "Ultra"],
    kind: "term",
    short:
      "The biggest Enders, taller than houses. At the neck the plates cannot overlap, so each one has a seam.",
    firstChapter: "c21",
  },
  {
    id: "wardens",
    label: "Wardens",
    aliases: ["Wardens", "Warden"],
    kind: "term",
    short: "Special Enders that carry a device in the chest and pass down orders from far away.",
    firstChapter: "c36",
  },
  {
    id: "hunters",
    label: "Hunters",
    aliases: ["Hunters", "hunters", "hunter"],
    kind: "term",
    short:
      "Enders shaped like long black darts, with one amber eye. They hang in the sky and fire.",
    firstChapter: "c55",
  },
  {
    id: "guardian",
    label: "The Guardian",
    aliases: ["Guardian"],
    kind: "term",
    short:
      "A giant gold-and-black Ender made by the Will long ago. While his golden halo burns, he obeys the voice that holds him.",
    firstChapter: "c50",
  },
  {
    id: "defence-sphere",
    label: "The Defence Sphere",
    aliases: ["Defence Sphere", "Sphere"],
    kind: "term",
    short:
      "A lattice of glowing hexagons over Terrinia, like a roof of glass. It keeps out the Enders.",
    firstChapter: "c01",
  },
  {
    id: "coupling",
    label: "Coupling",
    aliases: ["coupling", "Coupling"],
    kind: "term",
    short:
      "How strongly two partners' power links. In a good pair the output is not doubled. It is squared.",
    firstChapter: "c03",
  },
  {
    id: "emblem-of-hope",
    label: "The Emblem of Hope",
    aliases: ["Emblem of Hope", "Emblems of Hope", "Emblem", "Emblems"],
    kind: "object",
    short:
      "A small gold star with four points and a singing crystal inside, made by Guinevere. It glows when partners are in sync.",
    firstChapter: "c10",
  },
  {
    id: "resonance-trial",
    label: "The Resonance Trial",
    aliases: ["Resonance Trial"],
    kind: "term",
    short:
      "The test for aspirant power. A candidate puts a hand on a crystal core and holds the thing she most wants to protect.",
    firstChapter: "c01",
  },
  {
    id: "pair-system",
    label: "The pair system",
    aliases: ["PAIR SYSTEM", "pair system"],
    kind: "term",
    short:
      "The Academy rule that each Aspirant chooses a partner to train, study and fight with. A partnership must be chosen.",
    firstChapter: "c03",
  },
  {
    id: "the-cycle",
    label: "The Cycle",
    aliases: ["Cycle"],
    kind: "term",
    short:
      "The Will's law. A world grows too advanced, a catastrophe comes, a few embers are spared, and the survivors rebuild.",
    firstChapter: "c18",
  },
  {
    id: "embers",
    label: "Embers",
    aliases: ["embers", "Embers"],
    kind: "term",
    short: "The few lives the Cycle spares on purpose, so that a broken world can grow again.",
    firstChapter: "c18",
  },
  {
    id: "will-of-the-planet",
    label: "The Will of the Planet",
    aliases: ["Will of the Planet", "the Will"],
    kind: "term",
    short:
      "The mind behind the Enders, born from the energy of the Twilight Orb. It does not hate anyone. It wants balance.",
    firstChapter: "c17",
  },
  {
    id: "mother-matrix",
    label: "The Mother Matrix",
    aliases: ["Mother Matrix", "Matrix"],
    kind: "term",
    short:
      "The Will's body: a vast, cold web hidden in the void. It grows the Enders and turns the Will's thoughts into orders.",
    firstChapter: "c24",
  },
  {
    id: "twilight-orb",
    label: "The Twilight Orb",
    aliases: ["Twilight Orb", "Orb"],
    kind: "object",
    short:
      "A powerful object in another universe. When it broke, some of its energy poured into this one and woke as the Will.",
    firstChapter: "c24",
  },
  {
    id: "imperatrix",
    label: "Imperatrix",
    aliases: ["Imperatrix"],
    kind: "term",
    short:
      "An old word from a dead language: a woman who commands armies. The Will gave the title to Obsidia.",
    firstChapter: "c12",
  },
  {
    id: "ender-control-core",
    label: "The Ender Control Core",
    aliases: ["Ender Control Core", "Ender's Control Core", "Control Core", "Core"],
    kind: "object",
    short:
      "A device, not a being. It turns orders into the Enders' own language. It can command ordinary Enders, but not Obsidia.",
    firstChapter: "c28",
  },
  {
    id: "aperture",
    label: "The Aperture",
    aliases: ["Aperture"],
    kind: "object",
    short:
      "A gate Chang'e built from the portal organ of a dead Ender. It can follow the Core's song and send one person through.",
    firstChapter: "c28",
  },
  {
    id: "the-spine",
    label: "The Spine",
    aliases: ["Spine"],
    kind: "object",
    short:
      "A great cable rising from the vault under Oro's Institute. Through it, the Core gave its orders.",
    firstChapter: "c29",
  },
  {
    id: "veil-of-counsel",
    label: "The Veil of Counsel",
    aliases: ["Veil of Counsel"],
    kind: "object",
    short:
      "The white and gold visor every heir of Oro wears over the right eye. It sent everything Ruby saw to the Institute.",
    firstChapter: "c34",
  },
  {
    id: "field-cradle",
    label: "The Field Cradle",
    aliases: ["Field Cradle"],
    kind: "object",
    short:
      "A black chair wired to a ring of crystal. It copied the Core's orders across the sky and needed a mind to hold it steady.",
    firstChapter: "c38",
  },
  {
    id: "trojan",
    label: "The Trojan",
    aliases: ["Trojan"],
    kind: "object",
    short:
      "A hidden program Ruby built into Angela's core, meant to wake on one word and set the Legion free.",
    firstChapter: "c39",
  },
  {
    id: "purge-probe",
    label: "The Purge Probe",
    aliases: ["Purge Probe", "Probe"],
    kind: "object",
    short:
      "A spear of white fire made of the Matrix's own body. Whatever it strikes dies. It needs a hand to hold it.",
    firstChapter: "c51",
  },
  {
    id: "horizon",
    label: "The Horizon",
    aliases: ["Horizon"],
    kind: "term",
    short:
      "Chang'e's name for the barrier around the Will's void. Beyond it the pull is so strong that nothing can cross.",
    firstChapter: "c45",
  },
  {
    id: "silverbolt",
    label: "Silverbolt",
    aliases: ["Silverbolt"],
    kind: "object",
    short:
      "Selena's mecha. Unworn, it stands as a dragon of white-silver metal with blue gem eyes. Nobody else can make it move.",
    firstChapter: "c23",
  },
  {
    id: "crescent-moon",
    label: "The Crescent Moon",
    aliases: ["Crescent Moon"],
    kind: "object",
    short:
      "Chang'e's flying board, shaped like a crescent. She built it as a child above Selrick Base.",
    firstChapter: "c15",
  },
  {
    id: "left-and-right",
    label: "Left and Right",
    aliases: ["Left and Right"],
    kind: "object",
    short:
      "Two old security drones that Harlan kept for Guinevere. Selena and Vexana rebuilt them with cat ears and teal light.",
    firstChapter: "c08",
  },
  {
    id: "aspirant-field",
    label: "The Aspirant Field",
    aliases: ["Aspirant Field"],
    kind: "term",
    short: "A dome made from the power of many Aspirants joined together.",
    firstChapter: "c54",
  },
  {
    id: "hour-of-voices",
    label: "The Hour of Voices",
    aliases: ["Hour of Voices"],
    kind: "term",
    short:
      "An hour in which an Aspirant talks to the whole city on camera, as herself rather than as a weapon. Chang'e began it.",
    firstChapter: "c60",
  },
  {
    id: "first-light",
    label: "First Light",
    aliases: ["First Light"],
    kind: "term",
    short:
      "A festival of Dawnbreak. At dusk, people set paper lanterns on the water and make a wish.",
    firstChapter: "c11",
  },
  {
    id: "combat-trials",
    label: "The Combat Trials",
    aliases: ["Combat Trials"],
    kind: "term",
    short:
      "The Academy's fighting contest, held in the first week of spring in the great glass hall.",
    firstChapter: "c06",
  },
  {
    id: "the-breach",
    label: "The Day of the Breach",
    aliases: ["Day of the Breach", "Breach"],
    kind: "term",
    short: "The day Oro's army came to Terrinia through a breach in the Defence Sphere.",
    firstChapter: "i-far-above-2",
  },
  {
    id: "teru-teru-bozu",
    label: "Teru-teru-bozu",
    aliases: ["teru-teru-bozu"],
    kind: "object",
    short:
      "A little white cloth doll you hang in a window to bring fine weather. It says that you hope.",
    firstChapter: "c09",
  },
];

/** Every glossary entry by id. */
export const entityById: ReadonlyMap<string, Entity> = new Map(
  entities.map((entity) => [entity.id, entity]),
);

/** Look up a glossary entry by id (the `id` of an entity segment). */
export function getEntity(id: string): Entity | undefined {
  return entityById.get(id);
}

export function entitiesOfKind(kind: EntityKind): readonly Entity[] {
  return entities.filter((entity) => entity.kind === kind);
}

/** The glossary entry for one of the ten Aspirants. */
export function entityForSlug(slug: Slug): Entity | undefined {
  return entities.find((entity) => entity.characterSlug === slug);
}
