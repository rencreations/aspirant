// A frozen copy of the back matter of the story that the About page was written from (open
// questions, who is who, time order, words to know). The story pages no longer use it: they read
// the new book (`story.ts`). Chapter ids in it are the old story's (see `features/story/legacy-map.json`).
import type { BackMatter } from "./world-source-types";

export const worldSource: { readonly backMatter: BackMatter } = {
  backMatter: {
    openQuestions: {
      title: "What this story leaves open",
      intro: "The story ends with hope, not with an answer. Three questions are still open:",
      items: [
        {
          question: "Has the Matrix's invasion been stopped?",
          answer:
            "Guinevere believes it has. The story does not say so. The silver net still hangs over Terrinia.",
        },
        {
          question: "Where is the Ender Control Core now, and can it be broken?",
          answer: "The Will took it back into its own dark void. Nobody knows where it is.",
        },
        {
          question: "What happened to Selena and Obsidia?",
          answer:
            "Nobody saw how their fight ended. A woman keeps a lamp lit on an old bell tower.",
        },
      ],
    },
    closing: "THE END",
    reference: {
      title: "For reference",
      intro: "Now that you know the whole story, here are three pages to keep beside you.",
    },
    whoIsWho: {
      title: "Now you know: who is who",
      rows: [
        {
          entityId: "lesley",
          name: "Lesley",
          title: "Deadeye Spectre",
          text: "A quiet, steady soldier and sniper. She lost her family and her left eye when she was a child. With Chang'e, she started Selrick Academy.",
        },
        {
          entityId: "change",
          name: "Chang'e",
          title: "Tech Tensai",
          text: 'A tiny, proud genius scientist. She calls Lesley "Big Sis". Her robot friend is Mr. Bunny.',
        },
        {
          entityId: "layla",
          name: "Layla",
          title: "Miss Hikari",
          text: "A proud, ambitious top student with a huge cannon. Sharp on the outside, caring inside.",
        },
        {
          entityId: "fanny",
          name: "Fanny",
          title: "Blade of Kibou",
          text: "A warm, careful, well-organised fighter who flies with wings and cables. Her older brother is Tigreal.",
        },
        {
          entityId: "guinevere",
          name: "Guinevere",
          title: "Daybreak Halo",
          text: 'A bright, brave, rich girl who calls herself "the Queen". She never gives up on a friend.',
        },
        {
          entityId: "vexana",
          name: "Vexana",
          title: "Twilight Star",
          text: "A quiet girl who can hear Enders from far away. She carries a deep guilt.",
        },
        {
          entityId: "ruby",
          name: "Ruby",
          title: "Mecha Maiden",
          text: "The heir of a ruling family on the planet Oro. She builds Angela. She looks cold, but she loves to laugh and sing.",
        },
        {
          entityId: "angela",
          name: "Angela",
          title: "Cyber Cherubin",
          text: "An android with a gentle heart, built by Ruby. She learns what feelings are.",
        },
        {
          entityId: "selena",
          name: "Selena",
          title: "Silverbolt Raiko",
          text: "An Ender who lives as a human. Playful, clever and rebellious. Karina Voss raised her.",
        },
        {
          entityId: "obsidia",
          name: "Obsidia",
          title: "Imperatrix Arashi",
          text: "The first Ender who woke up. She commands the Storm Citadel. Cold, calm and very clever.",
        },
      ],
      also: [
        {
          entityId: "karina-voss",
          name: "Karina Voss",
          text: "the rescue worker who raised Selena.",
        },
        {
          entityId: "harlan",
          name: "Harlan",
          text: "Guinevere's old guard, now the Academy's night porter.",
        },
        {
          entityId: "tigreal",
          name: "Tigreal",
          text: "Fanny's elder brother, a soldier of the Shield.",
        },
        { entityId: "roger", name: "Roger", text: "a trainee medic." },
        { entityId: "tetra", name: "Tetra", text: "Angela's tiny twin." },
        { entityId: "mr-bunny", name: "Mr. Bunny", text: "Chang'e's robot." },
        {
          entityId: "will-of-the-planet",
          name: "The Will of the Planet",
          text: "the huge mind that sends the Enders.",
        },
      ],
    },
    timeOrder: {
      title: "The story in time order",
      rows: [
        {
          when: "Long ago, in another universe",
          what: "The Twilight Orb breaks. Some of its energy leaks into this universe and wakes up as the Will of the Planet.",
          chapters: "24",
          chapterIds: ["c24"],
        },
        {
          when: "Ages later",
          what: 'One Ender wakes up and asks "Why?" The Will makes her its commander, the Imperatrix. She is Obsidia.',
          chapters: "25",
          chapterIds: ["c25"],
        },
        {
          when: "Ages later still",
          what: "Obsidia makes herself a human body. She makes a child who can pass as human, and sets her down in the rain on Dawnbreak.",
          chapters: "26, 27",
          chapterIds: ["c26", "c27"],
        },
        {
          when: "Some years before 978",
          what: "Karina Voss finds the child in the rain. The child chooses the name Selena.",
          chapters: "27",
          chapterIds: ["c27"],
        },
        {
          when: "The year 978",
          what: "The festival of First Light. Selena meets Lesley. The first catastrophe: the Enders come. Lesley loses her family and her left eye.",
          chapters: "11, 12",
          chapterIds: ["c11", "c12"],
        },
        {
          when: "After 978",
          what: "Terrinia becomes the last great city. The Defence Sphere, the Shield and Selrick Base are built. Chang'e is adopted by the Chief Scientists.",
          chapters: "13",
          chapterIds: ["c13"],
        },
        {
          when: "Lesley's cadet years",
          what: "Lesley trains with Sergeant Brandt and joins the Shield.",
          chapters: "14",
          chapterIds: ["c14"],
        },
        {
          when: "Life at Selrick Base",
          what: "Lesley guards Chang'e and her parents. Chang'e calls her \"Sis\". Chang'e builds her an eye and a rifle.",
          chapters: "15 to 17",
          chapterIds: ["c15", "c16", "c17"],
        },
        {
          when: "The day Selrick Base falls",
          what: "The Enders strike the Base at dusk. Chang'e's parents die. Vexana's father dies. Obsidia spares Chang'e.",
          chapters: "18, 19, 5",
          chapterIds: ["c18", "c19", "c05"],
        },
        {
          when: "The years after",
          what: "Chang'e tells Lesley to go away. Lesley watches over her from a distance. Chang'e finds aspirant power.",
          chapters: "19, 20",
          chapterIds: ["c19", "c20"],
        },
        {
          when: "Gantry Square",
          what: "Chang'e and Lesley fight the Enders together for the first time. They make up.",
          chapters: "21",
          chapterIds: ["c21"],
        },
        {
          when: "The Academy is founded",
          what: "Selrick Academy is built on the ruins of the Base. Selena comes to it as a spy.",
          chapters: "22",
          chapterIds: ["c22"],
        },
        {
          when: "The Academy's first year",
          what: "Layla, Fanny, Guinevere and Vexana meet and become partners. Guinevere makes the Emblems of Hope. Selena disobeys her creator.",
          chapters: "1 to 10, 23",
          chapterIds: ["c01", "c02", "c03", "c04", "c05", "c06", "c07", "c08", "c09", "c10", "c23"],
        },
        {
          when: "Oro, before the Breach",
          what: "Ruby grows up in the golden cage of Oro and builds Angela. Enders destroy much of Oro. Oro seizes the Core and plans to take Dawnbreak.",
          chapters: "33 to 38",
          chapterIds: ["c33", "c34", "c35", "c36", "c37", "c38"],
        },
        {
          when: "Late summer",
          what: "A scout from Oro falls in a barley field. Lesley goes through the Aperture to Oro, meets Ruby and cuts the Spine.",
          chapters: "28, 29",
          chapterIds: ["c28", "c29"],
        },
        {
          when: "The Day of the Breach",
          what: "Oro's army attacks Terrinia. Angela and Ruby break free. The Will recalls the Core. The Enders withdraw.",
          chapters: "30 to 32, 39 to 42",
          chapterIds: ["c30", "c31", "c32", "c39", "c40", "c41", "c42"],
        },
        {
          when: "After the Breach",
          what: "Obsidia destroys Oro. The Will plans a reset. Ruby and Angela become Aspirants.",
          chapters: 'Part Nine (the "Far Above" page, then 43 to 46)',
          chapterIds: ["i-far-above-2", "c43", "c44", "c45", "c46"],
        },
        {
          when: "The next spring",
          what: "Enders wake under the Academy. Vexana is taken into the void.",
          chapters: "47, 48",
          chapterIds: ["c47", "c48"],
        },
        {
          when: "The months after",
          what: "Guinevere waits and hopes. Vexana pretends to serve the Will. She gets Selena's needle.",
          chapters: "49, 50",
          chapterIds: ["c49", "c50"],
        },
        {
          when: "Summer",
          what: "The Matrix wakes. Obsidia makes her plan. Selena says goodbye.",
          chapters: "51, 52",
          chapterIds: ["c51", "c52"],
        },
        {
          when: "Graduation day",
          what: "The sky opens. The Matrix transmits. Guinevere and Vexana fight. Selena goes to the Storm Citadel.",
          chapters: "53 to 59",
          chapterIds: ["c53", "c54", "c55", "c56", "c57", "c58", "c59"],
        },
        {
          when: "That night, and after",
          what: "The Enders stop. Nobody knows if it is over.",
          chapters: "60",
          chapterIds: ["c60"],
        },
      ],
    },
    wordsToKnow: {
      title: "Words to know",
      items: [
        {
          term: "Dawnbreak",
          entityId: "dawnbreak",
          text: "the planet of the Aspirants. Its last great city is Terrinia.",
          segments: [
            { t: "text", text: "the planet of the Aspirants. Its last great city is " },
            { t: "text", text: "Terrinia", strong: true },
            { t: "text", text: "." },
          ],
        },
        {
          term: "Selrick Academy",
          entityId: "selrick-academy",
          text: "the school in Terrinia where young women learn to fight the Enders.",
          segments: [
            {
              t: "text",
              text: "the school in Terrinia where young women learn to fight the Enders.",
            },
          ],
        },
        {
          term: "The Defence Sphere",
          entityId: "defence-sphere",
          text: "the web of light that covers Terrinia.",
          segments: [{ t: "text", text: "the web of light that covers Terrinia." }],
        },
        {
          term: "Aspirant",
          entityId: "aspirants",
          text: "a young woman who can use aspirant power. Aspirants fight in pairs.",
          segments: [
            { t: "text", text: "a young woman who can use aspirant power. Aspirants fight in " },
            { t: "text", text: "pairs", strong: true },
            { t: "text", text: "." },
          ],
        },
        {
          term: "Aspirant power",
          entityId: "aspirant-power",
          text: "the power of a heart that is whole and holds on to one thing. Two partners together make it stronger. How strongly two hearts link is called coupling.",
          segments: [
            {
              t: "text",
              text: "the power of a heart that is whole and holds on to one thing. Two partners together make it stronger. How strongly two hearts link is called ",
            },
            { t: "text", text: "coupling", strong: true },
            { t: "text", text: "." },
          ],
        },
        {
          term: "Emblem of Hope",
          entityId: "emblem-of-hope",
          text: "a small gold star that glows when two partners' powers are in sync.",
          segments: [
            {
              t: "text",
              text: "a small gold star that glows when two partners' powers are in sync.",
            },
          ],
        },
        {
          term: "Enders",
          entityId: "enders",
          text: "living weapons. They come to destroy.",
          segments: [{ t: "text", text: "living weapons. They come to destroy." }],
        },
        {
          term: "The Will of the Planet",
          entityId: "will-of-the-planet",
          text: "a huge mind that keeps the worlds in balance. It sends the Enders.",
          segments: [
            {
              t: "text",
              text: "a huge mind that keeps the worlds in balance. It sends the Enders.",
            },
          ],
        },
        {
          term: "The Mother Matrix",
          entityId: "mother-matrix",
          text: "the Will's body. It makes Enders and sends them orders.",
          segments: [
            { t: "text", text: "the Will's body. It makes Enders and sends them orders." },
          ],
        },
        {
          term: "The Cycle",
          entityId: "the-cycle",
          text: "the Will's law. A world grows too advanced. A catastrophe comes. Most is destroyed, and a few people, called embers, are spared. Then the survivors rebuild, and it all starts again.",
          segments: [
            {
              t: "text",
              text: "the Will's law. A world grows too advanced. A catastrophe comes. Most is destroyed, and a few people, called ",
            },
            { t: "text", text: "embers", strong: true },
            {
              t: "text",
              text: ", are spared. Then the survivors rebuild, and it all starts again.",
            },
          ],
        },
        {
          term: "The Storm Citadel",
          entityId: "storm-citadel",
          text: "Obsidia's giant flying fortress.",
          segments: [{ t: "text", text: "Obsidia's giant flying fortress." }],
        },
        {
          term: "Oro",
          entityId: "oro",
          text: "an old golden planet, ruled by cold, clever people.",
          segments: [{ t: "text", text: "an old golden planet, ruled by cold, clever people." }],
        },
        {
          term: "The Legion",
          entityId: "legion",
          text: "the android soldiers of Oro.",
          segments: [{ t: "text", text: "the android soldiers of Oro." }],
        },
        {
          term: "The Ender Control Core",
          entityId: "ender-control-core",
          text: "a device that lets its holder control ordinary Enders.",
          segments: [{ t: "text", text: "a device that lets its holder control ordinary Enders." }],
        },
      ],
    },
  },
};
