import type { ArtName } from "../../media";

/**
 * The Ender half of Vexana's story, as seven entries of a log. It runs from the black gate to the
 * black hole, and it stops where the novel stops. Sources: chapters 45, 48, 50, 55 to 57 of the
 * novel. The outcome of the Matrix invasion and the place of the Core are left open, as in canon.
 */

/** Who speaks a line. `log` is the page's own narration. */
export type Voice = "log" | "vexana" | "will" | "guinevere" | "obsidia" | "selena";

export interface Line {
  voice: Voice;
  text: string;
}

/** How loud the Emblem of Hope is in this entry. It is the one light the page has. */
type Light = "dim" | "flicker" | "steady" | "blaze";

export interface Log {
  id: string;
  /** "01" to "07". */
  no: string;
  title: string;
  /** A time and a place, written like a stamp on a record. */
  stamp: string;
  /** What the readout in the corner says. */
  signal: string;
  light: Light;
  lines: readonly Line[];
  art?: { name: ArtName; alt: string };
}

export const LOGS: readonly Log[] = [
  {
    id: "fall",
    no: "01",
    title: "The fall",
    stamp: "T+00:00:00. The Will's own dark.",
    signal: "No link",
    light: "flicker",
    lines: [
      {
        voice: "log",
        text: "Vexana fell for a very long time. Above her, the last crack of light closed like an eye.",
      },
      { voice: "vexana", text: "She's safe. I pushed her away. She's alive." },
      {
        voice: "log",
        text: "She did not cry. She was almost glad. This is what my father did, she thought. Now I understand.",
      },
      {
        voice: "log",
        text: "The Emblem began to glow. It was the only light in the dark. Pictures floated around her like open windows: a rooftop, a tree, a bench at the fireworks.",
      },
      {
        voice: "log",
        text: "Then a long grey hand reached through one of them. More hands came, and turned her memories over like pages.",
      },
      { voice: "vexana", text: "It's reading me." },
    ],
  },
  {
    id: "balance",
    no: "02",
    title: "Balance",
    stamp: "T+00:00:41. Audience.",
    signal: "One-way",
    light: "dim",
    lines: [
      {
        voice: "log",
        text: "It had no face. It was a vast vortex the colour of twilight, with a thousand dim stars in its heart.",
      },
      { voice: "will", text: "I am the Will of the Planet." },
      { voice: "vexana", text: "It was you. You killed my father." },
      {
        voice: "will",
        text: "I did not know him. I know only the web. He was a thread in it, and it was cut.",
      },
      {
        voice: "log",
        text: "It showed her a web of silver light, with a world at every knot. Dawnbreak had grown too heavy, it said, and the web was tilting. So it cut the knot down. Balance.",
      },
      {
        voice: "log",
        text: "It showed her the roof of the east wing, grey with ash. Her friends lay in a ring. Guinevere lay at the end of it, as if asleep. The gold star in her fist went dark, cracked, and crumbled to dust.",
      },
      {
        voice: "will",
        text: "This is no judgement. Merely the universe's predetermined execution.",
      },
    ],
  },
  {
    id: "lie",
    no: "03",
    title: "The lie",
    stamp: "T+00:07:19. A condition.",
    signal: "Hidden",
    light: "steady",
    lines: [
      {
        voice: "will",
        text: "When a world falls, I may spare a few embers. I could spare Guinevere, if I were given a reason. I have many hands but no mouth. Be my voice.",
      },
      {
        voice: "log",
        text: "She looked at the dust in her palm. It is not the only way, she thought. There is the Core. She remembered Chang'e's lesson.",
      },
      {
        voice: "log",
        text: "Far off, at the heart of the dark, she saw it. It was no bigger than a fist, white and violet and clear as glass. It hung in a ring of pale threads and pulsed, slow and cold. She looked away at once.",
      },
      { voice: "vexana", text: "I think I would like to say yes. Because I love her." },
      {
        voice: "log",
        text: "It was true. The Will went through every room in her head, and found love and grief and fear. It did not find the plan. She had hidden it in the middle of her love.",
      },
      {
        voice: "log",
        text: "She came apart and was made again. Her hair was silver at the front, then blue-lavender, then magenta at the tips. Small dark horns edged with gold. Pink eyes, calm and sad.",
      },
      { voice: "vexana", text: "It's still me. It's only that I've been dressed." },
    ],
    art: {
      name: "vexana-splash-art",
      alt: "Vexana in her Ender form, in the official splash art.",
    },
  },
  {
    id: "citadel",
    no: "04",
    title: "Think to the side",
    stamp: "T+13 days. The Storm Citadel.",
    signal: "Watched",
    light: "steady",
    lines: [
      { voice: "obsidia", text: "You are lying to him." },
      {
        voice: "log",
        text: "Her heart went cold. But the Imperatrix only said it quietly, and did not tell.",
      },
      {
        voice: "obsidia",
        text: "The Will is always listening. Learn to think a little to the side of what you mean. And you will be asked to hurt the one you love. I would like you to remember that it can be survived.",
      },
      {
        voice: "log",
        text: "The Citadel grew her a new staff, with a great black orb at its head. At a thought, a giant rose in violet smoke, in black and gold armour, and knelt to lay a sword at her feet. He leaned his mask into her palm. Nobody had leaned on her in a very long time.",
      },
      {
        voice: "log",
        text: "At the top of the tallest tower, a small crooked tree grew in the storm. Vexana told the Imperatrix about a broom cupboard and a doughnut. Obsidia put a hand over her mouth.",
      },
      { voice: "obsidia", text: "A doughnut. It is a very effective weapon." },
    ],
  },
  {
    id: "eleven",
    no: "05",
    title: "Eleven o'clock",
    stamp: "Every night. A roof above a round window.",
    signal: "Faint",
    light: "blaze",
    lines: [
      {
        voice: "log",
        text: "The Will ordered her to go and see the world she was to save, and not be seen. She stood on a roof in the rain. Below her was a small round window at Selrick Academy.",
      },
      {
        voice: "log",
        text: "A scarred hand touched the glass. She had only to call. She bit her cheek until it bled.",
      },
      {
        voice: "guinevere",
        text: "Hello, Vexana. It's the fourth of May. Angela says you sound sad. You needn't be. I'm eating. I wish you'd say something.",
      },
      {
        voice: "log",
        text: "Vexana fell to her knees on the roof. She did not use her voice. She thought it with her whole heart.",
      },
      { voice: "vexana", text: "I'm here. I'm here." },
      {
        voice: "log",
        text: "The Emblem blazed. Guinevere flung open the window. But the roof was empty. Far away, on the floor of a black hall, Vexana lay curled up with a giant's head on her shoulder, and sobbed.",
      },
    ],
  },
  {
    id: "underhill",
    no: "06",
    title: "Underhill",
    stamp: "T+95 days. A cellar market, before dawn.",
    signal: "Borrowed",
    light: "steady",
    lines: [
      {
        voice: "log",
        text: "She needed a blade, because the Core was made of Ender-stuff and no ordinary steel could mark it. In the old cellars under Terrinia, a hooded girl sat at a small table, with a white dragon asleep beneath her chair.",
      },
      {
        voice: "selena",
        text: "You've a plan. It shines on you like a bad lie. You're another pawn, like me.",
      },
      {
        voice: "log",
        text: "From a black box she took a thin needle of dark crystal, as long as a hand. A sliver of a Warden's heart, tuned to the Core. The orb on Vexana's staff began to answer.",
      },
      {
        voice: "selena",
        text: "It's not for sale. It's a loan. But I want a story in return. When it's all over, tell me how it ended. I'd like to know there's a way out.",
      },
      { voice: "vexana", text: "I promise." },
      {
        voice: "log",
        text: "At dawn she walked home in the rain with the box under her cloak. Every night a voice still reached her from very far away. Hello, Vexana. I'm still here.",
      },
    ],
  },
  {
    id: "execute",
    no: "07",
    title: "Execute",
    stamp: "Graduation day. Under a red rift.",
    signal: "Order received",
    light: "blaze",
    lines: [
      { voice: "will", text: "Vexana. Execute purge protocol." },
      {
        voice: "log",
        text: "She had known it would come. Her eyes went empty. Below her, on a broken road, Guinevere got up again.",
      },
      { voice: "guinevere", text: "You would never betray us!" },
      { voice: "vexana", text: "You haven't changed at all." },
      {
        voice: "log",
        text: "Every orb she threw landed a hand's breadth wide. Then the star at Guinevere's collar blazed, and the one at Vexana's throat answered. Two beams of gold knotted in the air, and every Ender stopped.",
      },
      {
        voice: "vexana",
        text: "In my staff there is a star. I made it myself, ya know. Now it takes things in. I will look as if I am about to do something terrible. Guinevere, do you trust me?",
      },
      {
        voice: "guinevere",
        text: "You were always there to pick me up. I don't care why. I trust you, Sana!",
      },
      {
        voice: "log",
        text: "A pillar of white fire fell, wide as a street. A small black bead rose to meet it, and opened.",
      },
    ],
    art: { name: "fighting-moment", alt: "Vexana and Guinevere, face to face in the fight." },
  },
  {
    id: "twin",
    no: "08",
    title: "Twin streams of light",
    stamp: "Inside the black hole. No time.",
    signal: "Link restored",
    light: "blaze",
    lines: [
      {
        voice: "log",
        text: "She had made a place with no one in it, because there was nowhere in the world to put the Purge without killing someone. She had forgotten to count the people she would take with her.",
      },
      { voice: "vexana", text: "It was you who brought colour to my world." },
      {
        voice: "guinevere",
        text: "What's with all this doom and gloom? I can hear everything, you know!",
      },
      {
        voice: "vexana",
        text: "If I could go back, I would still choose the same path. To betray you, to protect you.",
      },
      {
        voice: "guinevere",
        text: "Once, twice, three times. I'd never give up on you. Come back with me, Vexana.",
      },
      {
        voice: "log",
        text: "A clear note rose, sung by two voices. Vexana put out her hand, and it met another. Two ribbons of light, one gold and one rose, twisted round each other and climbed through the net.",
      },
      {
        voice: "log",
        text: "On the cracked road lay two girls. The horns, the cloak and the armour were gone. Her hair was long and dark again, with a sheen of violet. At her collar burned a small gold star. She opened her eyes. They were violet.",
      },
      { voice: "vexana", text: "It isn't over. The Matrix is still there." },
    ],
  },
];
