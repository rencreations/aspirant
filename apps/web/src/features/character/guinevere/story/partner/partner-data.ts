import type { ArtName } from "../../media";

/**
 * The second half of Guinevere's story, as eight entries of a file kept by the Emblem of Hope. It
 * runs from the cupboard where a girl hid to the black hole and back, and it stops where the novel
 * stops. Sources: chapters 37, 39, 41, 43, 49 and 51 of the novel and her file in the character
 * data. The outcome of the Matrix invasion and the place of the Core are left open, as in canon.
 */

/** Who speaks a line. `log` is the page's own narration. */
export type Voice = "log" | "guinevere" | "vexana" | "harlan";

export interface Line {
  voice: Voice;
  text: string;
}

/** How loud the Emblem of Hope is in this entry. It is the one light the page has. */
type Light = "dim" | "flicker" | "steady" | "blaze";

export interface Log {
  id: string;
  /** "01" to "08". */
  no: string;
  title: string;
  /** A time and a place, written like a stamp on a record. */
  stamp: string;
  /** What the readout in the corner says: how in step the two stars are. */
  signal: string;
  light: Light;
  lines: readonly Line[];
  art?: { name: ArtName; alt: string };
}

export const LOGS: readonly Log[] = [
  {
    id: "cupboard",
    no: "01",
    title: "The cupboard",
    stamp: "The east wing. Four days of looking.",
    signal: "Not yet",
    light: "dim",
    lines: [
      {
        voice: "log",
        text: "It took Guinevere four days to find the cupboard. She had been through the library, the refectory, the chapel and the sick bay. At last somebody said a girl had been seen going into a cupboard in the east wing.",
      },
      {
        voice: "log",
        text: "It was behind the last door in a long corridor, and there was a thin line of light under it. She sat down on the floor with her back against the door.",
      },
      {
        voice: "guinevere",
        text: "You said it, on the stair. You are strong, Guinevere. I wanted to say thank you.",
      },
      {
        voice: "log",
        text: "Nobody answered. She left a strawberry-jam doughnut outside the door. Nothing can resist one, she said. Then she asked for a partner in the library, in a rush, and was told no. It was the first time a person had ever refused her. She walked out with her chin up, and on the steps she began to laugh.",
      },
    ],
  },
  {
    id: "mornings",
    no: "02",
    title: "Ten mornings",
    stamp: "A paper bag outside a brown door.",
    signal: "Rising",
    light: "flicker",
    lines: [
      {
        voice: "log",
        text: "Every morning a bag waited outside the cupboard. A doughnut. A cinnamon bun. A currant scone with a note. A twist of chocolate and a pressed flower. A battered book of poems that said, on the flyleaf, I thought of you. I don't know why.",
      },
      {
        voice: "log",
        text: "On the tenth morning there was a green cushion, stolen from the common room, and a note signed G. Something frozen on the other side of the door began to crack.",
      },
      {
        voice: "log",
        text: "Some days later Guinevere lost a pair trial for want of a partner. Across the wet grass came a girl with a staff in her hand.",
      },
      { voice: "vexana", text: "I'd like to be your partner." },
      { voice: "guinevere", text: "You said no." },
      { voice: "vexana", text: "I was lying." },
    ],
  },
  {
    id: "fireworks",
    no: "03",
    title: "Fireworks",
    stamp: "The sea wall. The last night of June.",
    signal: "In step",
    light: "blaze",
    lines: [
      {
        voice: "log",
        text: "Guinevere moved into the attic with a trunk and a stuffed bear. She took Vexana to a shop with a cat, and on a roller-coaster, where Vexana screamed and then found she was laughing.",
      },
      {
        voice: "log",
        text: "On the last night of June they sat on the iron bench at the end of the sea wall. She had made two gold stars by hand. It took nineteen tries to make one that hummed. They glow when two hearts are in step.",
      },
      { voice: "guinevere", text: "Here! I made 'em myself, ya know!" },
      {
        voice: "guinevere",
        text: "We'll be just like fireworks, shining at our absolute brightest!",
      },
      {
        voice: "log",
        text: "She pinned one at Vexana's collar. Vexana hated being looked at, and she smiled.",
      },
    ],
    art: {
      name: "both-splash-art",
      alt: "Guinevere and Vexana together, in the official splash art.",
    },
  },
  {
    id: "corridor",
    no: "04",
    title: "The corridor",
    stamp: "March. Rain. Eleven past midnight.",
    signal: "Cut",
    light: "flicker",
    lines: [
      {
        voice: "log",
        text: "The Academy kept thirty-eight sleeping Enders under the tower. That night they woke. She and Vexana fought back to back in the long white corridor, until the air tore open into a black gate.",
      },
      {
        voice: "log",
        text: "A tall Ender stepped out behind Guinevere, who was looking the other way. Careful, Guinevere! Vexana pushed her, and the blades missed. The Ender took Vexana by the hand. Guinevere caught her other hand.",
      },
      { voice: "guinevere", text: "I won't let go! I promised!" },
      { voice: "vexana", text: "It's all right. I'm not afraid." },
      {
        voice: "log",
        text: "She tore free and laid her palm on Guinevere's chest. A flash threw Guinevere across the corridor. At the edge of the gate, Vexana looked back. You were my first friend. Be brave. Then the gate closed.",
      },
    ],
  },
  {
    id: "eleven",
    no: "05",
    title: "Eleven days",
    stamp: "The attic. A cap in a doorway.",
    signal: "Held",
    light: "dim",
    lines: [
      {
        voice: "log",
        text: "For eleven days Guinevere did not cry. She sat on the attic floor with her hand closed so tightly on the star at her collar that its points left red marks on her fingers. She did not eat. She did not speak.",
      },
      {
        voice: "log",
        text: "On the ninth day Harlan came to the door with a tray of tea and six biscuits. He was the Academy's night porter now, and he had been, he said, a very happy man for eleven months.",
      },
      { voice: "guinevere", text: "I let go." },
      {
        voice: "harlan",
        text: "You did hold on. You held on until she tore herself away. She chose it.",
      },
      {
        voice: "log",
        text: "Something in her chest gave way, like ice on a lake. That night she began to rebuild her two drones, with a screwdriver and a great deal of temper.",
      },
    ],
  },
  {
    id: "window",
    no: "06",
    title: "Hello, Vexana",
    stamp: "Eleven o'clock, every night. A round window.",
    signal: "Faint",
    light: "blaze",
    lines: [
      {
        voice: "log",
        text: "Every night at eleven she opened the round window in the attic and spoke to the dark, to the roofs, to the star at her collar.",
      },
      {
        voice: "guinevere",
        text: "Hello, Vexana. It's the fourth of May. Angela says you sound sad. You needn't be. I'm eating. I wish you'd say something.",
      },
      {
        voice: "log",
        text: "One night the star blazed. She flung the window open as wide as it would go. The roof opposite was empty, and the rain came in.",
      },
      { voice: "guinevere", text: "Hello, Vexana. I'm still here." },
    ],
  },
  {
    id: "execute",
    no: "07",
    title: "Where is she?",
    stamp: "Graduation day. A red rift over the north ward.",
    signal: "Brighter",
    light: "steady",
    lines: [
      {
        voice: "log",
        text: "On graduation day the sky opened in a red rift, and the Enders walked out of the smoke. Guinevere did not wait for the others. She flew in on wings of red-gold fire, with her rebuilt drones at her shoulders, and the star at her collar grew brighter at every turn.",
      },
      { voice: "guinevere", text: "Where is she? WHERE IS SHE?" },
      {
        voice: "log",
        text: "She found her on a high broken slab: long silver hair, small horns, pink eyes, a gold star at her throat. No, she said. It can't be. She ran at her anyway.",
      },
      { voice: "guinevere", text: "You would never betray us!" },
      { voice: "vexana", text: "You haven't changed at all." },
    ],
    art: { name: "fighting-moment", alt: "Guinevere and Vexana, face to face in the fight." },
  },
  {
    id: "twin",
    no: "08",
    title: "Twin streams of light",
    stamp: "Inside the black hole. No time.",
    signal: "Restored",
    light: "blaze",
    lines: [
      {
        voice: "log",
        text: "Every orb Vexana threw landed a hand's breadth wide. Then the star at Guinevere's collar blazed, and the one at Vexana's throat answered, and two beams of gold knotted in the air. Every Ender stopped.",
      },
      { voice: "vexana", text: "Guinevere, do you trust me?" },
      {
        voice: "guinevere",
        text: "You were always there to pick me up. I don't care why. I trust you, Sana!",
      },
      {
        voice: "log",
        text: "A pillar of white fire fell, and a small black bead rose to meet it, and opened. Inside it there was no one else at all, and no time.",
      },
      { voice: "vexana", text: "It was you who brought colour to my world." },
      {
        voice: "guinevere",
        text: "What's with all this doom and gloom? I can hear everything, you know! Once, twice, three times. I'd never give up on you. Come back with me, Vexana.",
      },
      {
        voice: "log",
        text: "Two ribbons of light, one gold and one rose, twisted round each other and climbed through the net. On a cracked road lay two girls. At one collar burned a small gold star. The other opened her eyes. They were violet.",
      },
      { voice: "vexana", text: "It isn't over. The Matrix is still there." },
    ],
  },
];
