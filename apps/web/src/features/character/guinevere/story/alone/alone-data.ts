import type { ArtName } from "../../media";

/**
 * The first half of Guinevere's story, as seven ledger entries. It runs from the house on Crown
 * Heights to the stair where a stranger called her strong. Sources: chapters 35 and 37 of the
 * novel and her file in the character data.
 */
export type Doodle = "window" | "coat" | "gloves" | "suitcase" | "score" | "star" | "stair";

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
    id: "windows",
    no: "01",
    title: "Two hundred and forty windows",
    stamp: "Crown Heights, above Terrinia. Every season.",
    doodle: "window",
    text: [
      "The house on Crown Heights had two hundred and forty windows. Guinevere had counted every one by the time she was seven. It was less a home than a position, with white walls, gilded gates that opened for nobody and a library of eleven thousand books that nobody read.",
      "Her father was the Chairman. He was not cruel. He gave her the best tutors, a pony with a silver bridle and a string of pearls. He never once asked what she wanted. A daughter was part of the House, and the House had needs.",
    ],
    exchange: ["You will attend the dinner on Thursday.", "Yes, Father."],
  },
  {
    id: "coat",
    no: "02",
    title: "It is not my place, miss",
    stamp: "A bench by the lake. Dawn.",
    doodle: "coat",
    text: [
      "Six grey men followed her everywhere and said only yes, miss. When she was seven she asked the oldest, a huge quiet man named Harlan, what he liked to eat. He said he could not say. When she was ten she climbed out of a window at night, and at dawn they found her on a bench by the lake with a stolen bun and her feet in the water.",
      "Harlan said nothing. He took off his coat and laid it over her shoulders. It's cold, miss. You'll want this. It was the most that anybody had ever said to her.",
    ],
    exchange: ["Are you going to tell Father?", "It is not my place, miss."],
  },
  {
    id: "bolster",
    no: "03",
    title: "The bolster",
    stamp: "The long gallery, at night.",
    doodle: "gloves",
    text: [
      "At nine a cousin tripped her. She hit him once, straight from the shoulder, and she had never felt so clean. Three days later a plain parcel lay on her windowsill. It held a pair of boxing gloves. She suspected Harlan.",
      "She taught herself from an old book she found in the library, and from a punching bag she made out of a bolster. When her father at last hired a master, the old man watched her for ten minutes. Your stance is wrong, he said. Your guard drops on the left. But you do not stop. Why?",
    ],
    exchange: ["Because I can't.", "Because if I stop, I'll be what they think I am."],
  },
  {
    id: "name",
    no: "04",
    title: "Without your name",
    stamp: "The morning room. The front step.",
    doodle: "suitcase",
    text: [
      "The Academy accepted her. Her father said, You will not go. It is a school for the children of the poor. She said she was going tomorrow, without his money and without his name, and that one day he would see.",
      "Harlan was on the step with a small battered suitcase: a coat, a flask, some biscuits. It's not my place, miss. But I think you are right. He was dismissed within the hour. He asked only that his replacement be careful about the biscuits.",
      "At the registry desk she gave no surname. I'm here on my own merits, she said. The clerk wrote one word in the grey column: GUINEVERE.",
    ],
    exchange: ["I'll show him.", "I should like to see that."],
  },
  {
    id: "score",
    no: "05",
    title: "Nine hundred and eleven",
    stamp: "The forty-first floor. Nine hours on a gilt chair.",
    doodle: "score",
    text: [
      "Nobody sat at her table in the refectory. They whispered princess, and daddy's girl, and I give her a month. She said nothing. Every night she hit a wooden post on the training field until her knuckles bled.",
      "In the winter examinations she scored 911 out of 1,000, the highest the Academy had ever seen. She walked to her father's tower and waited nine hours on a small gilt chair. When he came, she held out the result in both hands, like a child holding a flower.",
      "He read it and folded it into four. Very creditable. Then he asked her to give notice to the Academy. Stop being so stubborn, he said, and focus more on the family business.",
    ],
    exchange: ["I came first.", "Very creditable."],
  },
  {
    id: "bright",
    no: "06",
    title: "So bright they have to look",
    stamp: "The sea wall, after eight. Wind.",
    doodle: "star",
    text: [
      "She walked for an hour and sat on the iron bench at the end of the sea wall. It did not mean anything, she thought. She had done everything a person could do so that he would say well done. He never would. I'm not a person, she thought. I'm a position.",
      "Then she stood up. Let them say I'm a spoiled little princess. I couldn't care less. A few small stars were coming out in the east.",
    ],
    exchange: ["I'll train even harder.", "I'm going to be so bright that you'll have to look."],
  },
  {
    id: "stair",
    no: "07",
    title: "Four words on a stair",
    stamp: "The Combat Trials. The foot of an iron stair.",
    doodle: "stair",
    text: [
      "In spring she won the Combat Trials with her left hand tied behind her back. It was the best bout anyone had seen. Nobody came to her. At the foot of an iron stair she shut her eyes, shaking, with a bleeding lip.",
      "A tiny voice came from above, like paper. You are strong, Guinevere. Footsteps ran away. Nobody had ever said it as a plain, true fact, the way you offer a cup of water. She did not yet know whose voice it was. She would spend four days finding out.",
    ],
    exchange: ["You are strong, Guinevere."],
    art: {
      name: "guinevere-splash-art",
      alt: "Guinevere in red and gold, in mid air above the city with her two drones.",
    },
  },
];
