import type { ArtName } from "../../media";

/**
 * The human half of Vexana's story, as seven ledger entries. It runs from the north gate to the
 * black gate. Sources: chapters 5 to 10 and 47 of the novel, and the Guinevere and Vexana comic.
 */
export type Doodle = "gate" | "plum" | "lamp" | "doughnut" | "bag" | "fireworks" | "rift";

export interface Entry {
  id: string;
  /** The page number, "01". */
  no: string;
  title: string;
  /** A place and a time, in the voice of a ledger line. */
  stamp: string;
  doodle: Doodle;
  /** Paragraphs of the entry. */
  text: readonly string[];
  /** A short exchange set apart from the text, one line each. */
  exchange?: readonly string[];
  /** A picture taped to the page. */
  art?: { name: ArtName; alt: string };
}

export const ENTRIES: readonly Entry[] = [
  {
    id: "sana",
    no: "01",
    title: "Sana",
    stamp: "The old quarter, north gate. Rain.",
    doodle: "gate",
    text: [
      "Her father was a soldier of the Shield. He was big, quiet and kind. For years he stood at the north gate in a long grey coat and checked everyone's papers. He called her Sana. It was a baby name, from when she could not say her own.",
      "She was a child who listened. One day soldiers brought a dead Ender through the gate on a truck. Vexana heard it hum, thin and high, like a wet finger on the rim of a glass.",
    ],
    exchange: ["Sana. Be brave.", "I'll try.", "That's all anyone can do."],
  },
  {
    id: "plums",
    no: "02",
    title: "The plums",
    stamp: "Dusk. Selrick Base falls.",
    doodle: "plum",
    text: [
      "At dusk the Enders struck. She had gone down to the terraces for plums, and her father ate one at the gate and shut his eyes. Then she heard them, thousands, humming in the north east. He sent her to the shelter. She ran, and the plums spilled over the cobbles.",
      "Near the door she turned back for the rest. It was a foolish thought, but it felt so clear. He ran to her and wrapped himself around her, with his back to the Enders.",
      "It was a good plum, he said. Be brave.",
    ],
  },
  {
    id: "vow",
    no: "03",
    title: "The well",
    stamp: "Tanner's Row, then Selrick Academy.",
    doodle: "lamp",
    text: [
      "The Shield's report called it an overshoot. It took four lines. On the second night, in the shelter, she made a vow, small and cold, like a door closing. She would love no one. She would not be the reason that somebody died.",
      "At the Academy, Chang'e measured her aspirant power. It was the deepest she had ever seen, and it was dark, like a well. Find someone to tell, Chang'e said. Someone who can hold the other end. Vexana found a broom cupboard instead, with a lamp that had a green shade.",
    ],
    art: {
      name: "vexana-splash-art",
      alt: "Vexana in her Academy uniform, holding her staff.",
    },
  },
  {
    id: "strong",
    no: "04",
    title: "You are strong",
    stamp: "The Combat Trials. The iron gallery.",
    doodle: "doughnut",
    text: [
      "In spring she climbed to the gallery under the roof and watched a small, furious girl beat the best fighters in the school. Nobody called the girl's name when she won. Nobody came to her.",
      "At the foot of the stair Guinevere shut her eyes. A tiny voice came from above, like paper rustling. You are strong, Guinevere. Then footsteps ran away.",
      "It took Guinevere four days to find the cupboard. She sat down against its door, said thank you, and left a doughnut.",
    ],
    art: {
      name: "guinevere-splash-art",
      alt: "Guinevere in red and gold, the girl on the training field.",
    },
  },
  {
    id: "partners",
    no: "05",
    title: "Partners",
    stamp: "A paper bag, ten mornings.",
    doodle: "bag",
    text: [
      "Every morning a paper bag waited outside the brown door. A bun, a scone, a pressed flower, a book of poems. On the tenth day there was a green cushion and a note. Vexana did not cry. But something frozen began to crack, like river ice in spring.",
      "After Guinevere lost a pair trial for want of a partner, Vexana crossed the wet grass with a staff in her hand.",
    ],
    exchange: ["I'd like to be your partner.", "You said no.", "I was lying."],
  },
  {
    id: "fireworks",
    no: "06",
    title: "Fireworks",
    stamp: "The harbour front. Summer.",
    doodle: "fireworks",
    text: [
      "Guinevere moved into the attic with a trunk and a stuffed bear. She took Vexana to a shop with a cat, and onto a roller-coaster, where Vexana screamed and then found she was laughing. On the last night of June they sat on the iron bench at the end of the sea wall.",
      "Guinevere made two gold stars by hand, nineteen tries for the one that hummed. They glow when two hearts are in step. She pinned one at Vexana's collar. Here! I made 'em myself, ya know! Vexana hated being looked at, and she smiled.",
    ],
    exchange: ["We'll be just like fireworks,", "shining at our absolute brightest!"],
    art: {
      name: "both-splash-art",
      alt: "Guinevere and Vexana together, in the official splash art.",
    },
  },
  {
    id: "corridor",
    no: "07",
    title: "The corridor",
    stamp: "March. Rain. Eleven past midnight.",
    doodle: "rift",
    text: [
      "The Academy kept thirty-eight sleeping Enders under the tower. That night they woke. Vexana heard the hum first. In the long white corridor she and Guinevere fought back to back, and then the air tore open into a black gate.",
      "A tall Ender stepped out behind Guinevere, who was looking the other way. Vexana did not think. She saw a long grey coat. Careful, Guinevere! She pushed, and the blades missed. The Ender took Vexana by the hand.",
      "Guinevere caught her other hand. I won't let go! I promised! Vexana smiled a small smile. It's all right. I'm not afraid. She tore free and laid her palm on Guinevere's chest. A flash of violet threw her across the corridor.",
      "At the edge of the gate she looked back, the Emblem blazing at her collar. You were my first friend, she said. Be brave. Then she stepped into the dark, and the gate closed.",
    ],
  },
];
