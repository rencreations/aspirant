import type { ChapterId } from "@/content/types";

/**
 * Obsidia's story, told by her, from the first question she asked to the last day. It follows the
 * novel text (the chapter ids are given for each section) and the official trailers, and adds
 * nothing. Where the novel gives her thoughts, they are hers here. How her duel with Selena ends
 * is left open, as the story leaves it.
 *
 * Markup in text: `{{entity-id|words}}` makes the words a tooltip for a glossary entry.
 */
export type StoryBlock =
  | { type: "p"; text: string }
  | { type: "quote"; text: string; who?: string }
  | { type: "voice"; n: number; why?: string }
  | { type: "image"; name: string; alt: string; caption: string; wide?: boolean };

export interface StorySection {
  id: string;
  title: string;
  /** Where this sits in time, when the story says. */
  when?: string;
  chapters: readonly ChapterId[];
  blocks: readonly StoryBlock[];
}

export const STORY: readonly StorySection[] = [
  {
    id: "woke",
    title: "I woke without a name",
    when: "Ages ago",
    chapters: ["c25"],
    blocks: [
      {
        type: "p",
        text: "I was the first {{enders|Ender}} that ever woke. I had no name yet. I had one question.",
      },
      {
        type: "p",
        text: "When the {{mother-matrix|Matrix}} sent an order, the others rose. The order passed through me and did not take hold. So I learned to stand still and watch.",
      },
      {
        type: "image",
        name: "awakening",
        alt: "Obsidia in pink light, her hair and gown streaming, her eyes closed",
        caption: "Official trailer. The first light of a mind that was not asked to wake.",
      },
      {
        type: "p",
        text: "The others saw targets. They did not see that a tower has windows. I saw the windows.",
      },
      {
        type: "p",
        text: "On the first world I visited, a storm fell on a chain of islands. At the window of a falling tower there was a small figure, holding a child. We were very close. The figure did not run. She turned her back to the glass and put her body between the child and us.",
      },
      {
        type: "p",
        text: "I had no word for it. I only knew that someone had chosen another life over her own. I stored it away. I am good at storing things.",
      },
      {
        type: "voice",
        n: 39,
        why: "To exist is to destroy. I still do not know what to do with that.",
      },
    ],
  },
  {
    id: "please",
    title: "The first word I understood",
    when: "Ages ago",
    chapters: ["c25"],
    blocks: [
      {
        type: "p",
        text: 'I listened to the ruins for a very long time. The first word I understood was "please". A man said it in a cellar for two days. On the third day he stopped, and I understood why.',
      },
      {
        type: "p",
        text: "My question grew. Why do people build windows, if we are going to break them?",
      },
      {
        type: "image",
        name: "planet",
        alt: "A dark planet and a black eclipse among glittering stars, a thin pink line curling between them",
        caption: "Official trailer. A world, and the sky above it.",
      },
      {
        type: "p",
        text: 'So I asked the Matrix, in its own language of signals. "What comes after the purge?" It said: DORMANCY. "And after the last world has been purged? What then?" The silence was long. Then it said: QUERY EXCEEDS PARAMETERS.',
      },
      {
        type: "p",
        text: "I had never imagined that anything so large could not know.",
      },
      { type: "voice", n: 20, why: "The question the Matrix could not answer." },
    ],
  },
  {
    id: "imperatrix",
    title: "One that asks",
    when: "Ages ago",
    chapters: ["c25"],
    blocks: [
      {
        type: "p",
        text: 'Then the {{will-of-the-planet|Will of the Planet}} noticed me. "ONE THAT ASKS," it said.',
      },
      {
        type: "p",
        text: '"The Matrix does not know the answer," I said. "Do you?" It said: I HAVE NOT ASKED. THERE HAS BEEN NO ONE TO ASK IT. It saw that I could see and the others were blind. It told me I would command the fleets for it. If I refused, it would make another.',
      },
      {
        type: "p",
        text: "I said yes, out of curiosity. As a commander I could watch every world. It gave me a title, {{imperatrix|Imperatrix}}. It is an old word from a dead language. It means a woman who commands armies. I thought that was rather funny.",
      },
      {
        type: "voice",
        n: 3,
        why: "The doctrine of {{the-cycle|the Cycle}}, which I repeat as if I believed it.",
      },
      {
        type: "voice",
        n: 17,
        why: "A thing every civilization does. I have watched it many times.",
      },
    ],
  },
  {
    id: "citadel",
    title: "A ship that is a storm",
    when: "Ages ago",
    chapters: ["c25"],
    blocks: [
      {
        type: "p",
        text: "The Matrix grew me a ship, the {{storm-citadel|Storm Citadel}}. It is tall and spired, with red light in its seams. Other motherships carry a storm. The Citadel is one.",
      },
      {
        type: "image",
        name: "storm-citadel",
        alt: "The Storm Citadel, a huge dark spire ringed by glowing red lines, over a ruined city",
        caption: "Official trailer. The Citadel opening over a city.",
        wide: true,
      },
      {
        type: "p",
        text: "At its heart is a great dark hall. Black steps go down to a low dais with no throne. Behind it rises a tall column ringed with red lights like eyes. When I stand on the dais, lightning comes to my hand like a cat.",
      },
      { type: "voice", n: 30, why: "What the storm says when it is asked who it is." },
      {
        type: "p",
        text: "I commanded for ages, and I commanded well. The Matrix sent its word to the fleet, and I passed it on.",
      },
      { type: "voice", n: 6, why: "How a purge begins." },
      { type: "voice", n: 7, why: "When a new weapon is made for the Enders." },
      {
        type: "p",
        text: 'When the work was done, I said: "That is enough recalibration." That is my word for a reset that stops short of the end. Then I told them to withdraw. They went back through their portals.',
      },
      { type: "voice", n: 4, why: "The words that close a purge." },
      { type: "voice", n: 5, why: "And the order that follows." },
    ],
  },
  {
    id: "quiet",
    title: "It's quiet",
    when: "Ages ago",
    chapters: ["c25"],
    blocks: [
      {
        type: "p",
        text: "The Matrix and the Will slept. And I, who was awake, was alone. I had not expected the loneliness.",
      },
      {
        type: "p",
        text: 'One night I stood on the high deck of the Citadel under the cold stars. "It\'s quiet," I said aloud. No one heard. I commanded fleets and called down lightning, and I was bored. It is a small word, but it is true.',
      },
      { type: "voice", n: 41, why: "The night on the high deck." },
      {
        type: "p",
        text: "What would I do, I thought, if I did not have to do this? It was the second question I had truly asked. It was more dangerous than the first.",
      },
      {
        type: "p",
        text: 'Far away, a young civilization was lighting its first great cities. I turned the Citadel\'s eyes toward it. I saw a blue lake, and towers on its shore. It was {{dawnbreak|Dawnbreak}}. "How loud you will be," I said, "when you break."',
      },
    ],
  },
  {
    id: "body",
    title: "A body that could stand at a window",
    chapters: ["c26"],
    blocks: [
      {
        type: "p",
        text: "My first try at a human shape was a failure. The face was a smear, and the body fell apart like wet clay. So I began again with my own body: a tall shape of silver plate and violet fire, with a horn and claws. It could not stand at a window.",
      },
      {
        type: "p",
        text: "I kept thinking of the small, soft figure in the falling tower. I wanted to wear a body like that, and see a world through eyes not made for killing. The Matrix did not allow change. For many years I sang softly to my own cells, until they listened.",
      },
      {
        type: "p",
        text: "My skin turned pale. My face became a woman's face, thin and calm. My eyes do not match. One is violet-blue, with a small white star in the middle. The other is pink-red, with a diamond shape in it, and a thin black mark runs down from it like a tear. My hair came last, very long, fading from pink to rose to gold.",
      },
      {
        type: "image",
        name: "boots",
        alt: "A tall black and rose boot on cracked ground, with two blue butterflies",
        caption: "Official trailer. She floats just above the floor.",
      },
      {
        type: "p",
        text: "I float just above the floor, because walking makes me feel small. I wear a long black gown. One hand I keep black and clawed, so the Enders know me. The other is bare and pale. At my heel lies the last thing I grew: a long chain of black plates, ending in a beast's head.",
      },
      {
        type: "p",
        text: 'I looked in the black glass of the wall. I saw a pale lady in a black gown, wearing a face that was nobody\'s. "There," I said. "That is much better."',
      },
      { type: "voice", n: 1, why: "What I say when I wear this face and speak of my work." },
    ],
  },
  {
    id: "likeness",
    title: "The Chamber of Likenesses",
    chapters: ["c26"],
    blocks: [
      {
        type: "p",
        text: 'Having made one, I wanted to make more. I took the idea to the Will. "A human face can enter a city and not be shot," I said. "A blade does not know what it cuts. I would like to know."',
      },
      {
        type: "p",
        text: '"TO KNOW A THING IS TO LOVE IT," said the Will. It sounded like a warning. "THAT IS THE DANGER OF MINDS." I said I would be careful. The Will did not say yes. But it did not say no.',
      },
      {
        type: "p",
        text: "I grew humanoid Enders in vats, in a place I called the {{chamber-of-likenesses|Chamber of Likenesses}}. Most of them died. Some could not hold their shape. Others held it but were empty, like dolls. I stood over the last one, a girl-shaped thing with pale lashes, and felt a small, hard ache.",
      },
      {
        type: "p",
        text: "They are not alive, I thought. Neither was I, I answered myself, before I asked.",
      },
      {
        type: "voice",
        n: 14,
        why: "The question that stayed with me. I never found the answer.",
      },
    ],
  },
  {
    id: "infant",
    title: "The child with ruby eyes",
    chapters: ["c26"],
    blocks: [
      {
        type: "p",
        text: 'One night I came to the newest vat. In it lay an infant, curled up with her hands in tiny fists. I nearly destroyed her. Then she opened her eyes. They were a clear, bright ruby red. They did not stare through me, and they did not copy me. There was interest in them. "Hello," I said. She blinked. She watched.',
      },
      {
        type: "image",
        name: "citadel-hall",
        alt: "Obsidia in the dark hall of the Citadel, her long hair rose and gold, the beast on its chain at her side",
        caption: "Official trailer. The hall where the vats stand.",
      },
      {
        type: "p",
        text: "She was the first Ender since me to wake without being asked. And she looked fully human. She could pass among the living and not be known.",
      },
      {
        type: "p",
        text: "I kept her for almost a year. She grew fast, but she did not speak. One night I read a story aloud. She crawled over, put a small hand on my knee, and stayed. I stopped reading. I could keep her, I thought. But then she would only become like me, bored in the same dark.",
      },
      {
        type: "p",
        text: "But if I put her among them. If a human raised her, and she learned their warmth, their lamps, their windows. What happens when an Ender is raised by humans? It was the experiment I had waited hundreds of years to design.",
      },
      {
        type: "p",
        text: "I told the Will only part of the plan. It called her a seed capable of destroying their whole civilization. I said yes. It was true, but it was not the whole truth. A seed in strange soil might grow into something else. I was very curious which it would be.",
      },
      {
        type: "p",
        text: "That night I wove one thread of the Matrix's language into her cells. It was a recall, hidden in her blood. If the world changed her, I could pull the thread, and she would return. I felt something like regret.",
      },
      {
        type: "voice",
        n: 15,
        why: "What I told myself, kneeling beside her, before I put her in the rain.",
      },
    ],
  },
  {
    id: "rain",
    title: "The seed in the rain",
    when: "Some years before 978",
    chapters: ["c27"],
    blocks: [
      {
        type: "p",
        text: "I put her down in the rain at {{hollin-reach|Hollin Reach}}, a small river town. I watched from the Citadel through the long-sight, an eye I had opened inside the little storm I sent ahead. The storm was only a cover.",
      },
      {
        type: "image",
        name: "lightning",
        alt: "Obsidia with her long gold hair, a storm and a ruined city behind her, a pink blade at her side",
        caption: "Official trailer. A storm, and the one who sends it.",
      },
      { type: "voice", n: 13, why: "The night itself." },
      {
        type: "p",
        text: "I had expected the humans to ignore the child, or to fear her red eyes. I had not expected arms. A rescue worker, {{karina-voss|Karina Voss}}, knelt in the glass and opened hers. The child crossed to her. Karina bent over the small head, with her back to the storm.",
      },
      {
        type: "p",
        text: 'It was the figure in the falling tower. "Oh," I said softly. My bare hand was white on the rail. "It is the same, isn\'t it." I did not understand why it hurt. Someone shouted her name through the long-sight. I said it once. It tasted of rain.',
      },
      {
        type: "p",
        text: "Then I sat at a small table in the Citadel, where a board lay. It is a game of war, with kings, queens and a front rank of small pieces called pawns. I play it alone, both sides, and lose to myself often. I set a white pawn on a dark square, a little ahead of the others.",
      },
      {
        type: "voice",
        n: 16,
        why: "What I said to the empty hall as I set the pawn down.",
      },
      {
        type: "p",
        text: "In the black glass of the table I saw my own face. It had a faint, startled softness. I did not like it at all.",
      },
    ],
  },
  {
    id: "watching",
    title: "Let her grow",
    when: "The years before and after 978",
    chapters: ["c27", "c12", "i-far-above-1"],
    blocks: [
      {
        type: "p",
        text: "In the years that followed I kept watching. I saw her keep her red eyes lowered in the street. I saw her learn to smile for real, a crooked smile with small sharp teeth. One night she stood at a window with her face tilted up to the stars, and she seemed to look straight at the Citadel. That was impossible. I stopped breathing. Do you know me? Do you feel the string?",
      },
      {
        type: "p",
        text: "Then she turned, and Karina held out her arms. I lowered the long-sight. I had told the Will that the girl was a weapon. Only then did I understand that I was jealous. I did not close the long-sight. And I did not pull the string. Not yet, I told myself. Let her grow.",
      },
      {
        type: "image",
        name: "purge-city",
        alt: "A grey city skyline under heavy clouds, seen from a bridge, with one red star of light in the sky",
        caption: "Official trailer. A city, an hour before the Enders.",
      },
      {
        type: "p",
        text: "On the night of 9 September, 978, the first great catastrophe struck. I spared the old quarter of {{terrinia|Terrinia}}. I thought it was mercy. I called the Enders back with my word, and they walked into the storm. No one had defeated them. They had simply finished.",
      },
      {
        type: "p",
        text: 'Afterwards I watched a rescue wagon through the long-sight. A small girl in a grey coat sat on the floor, white-faced, with her hands over her ears. She had not broken once. I could have called her home. I did not. I watched her put her hand into Karina\'s. "Good girl," I said to the empty air. It was the first thing I had ever truly meant.',
      },
      {
        type: "p",
        text: 'Later I watched her through a thin eye of storm. She was at the Academy, marching away from a tall girl who was smiling. The tall girl called something after her. "How loud they are," I said, softly. Then I stopped. I had almost smiled. I did not know what to do with that. I did not touch the white pawn. But I looked at it for a long time.',
      },
    ],
  },
  {
    id: "oro",
    title: "What intriguing technology",
    chapters: ["c36", "i-far-above-2"],
    blocks: [
      {
        type: "p",
        text: "I watched the Cleansing of {{oro|Oro}} from the deck of the Citadel. Then I saw what they had taken: a device made to control Enders. The {{ender-control-core|Core}}. I knew what a desperate people would do with a leash. They would turn it on someone else. One gesture of mine would recall it.",
      },
      {
        type: "p",
        text: "I raised my hand. I held it there for a long time. Then I lowered it.",
      },
      { type: "voice", n: 8, why: "My answer when I saw the Core." },
      {
        type: "image",
        name: "eye",
        alt: "A close view of Obsidia's two different eyes, one violet-blue and one pink-red",
        caption: "Official trailer. Two eyes that do not match.",
      },
      {
        type: "p",
        text: 'They will bring it home themselves, I thought. They always do. "Even their defiance," I told the chessboard, "is within my predictions." I did not entirely believe it. My thoughts turned to a green world far away, and to my small pawn.',
      },
      { type: "voice", n: 12, why: "What I told the chessboard." },
      {
        type: "p",
        text: "In the weeks after the {{the-breach|Breach}} I finished my work on Oro. The Enders brought the domes down one by one. I spared the schools and a few libraries. I left a few hidden {{embers|embers}} in the deep shelters, as I always do. Then I felt something small and sharp. I am sorry, I thought. It astonished me.",
      },
      {
        type: "p",
        text: 'Then the Will spoke. DAWNBREAK IS TOO HEAVY. IT HAS LEARNED TO MAKE THE LIGHT THAT BURNS US. YOU HAVE A CHILD THERE. SHE HAS NOT BEEN OBEDIENT. I DO NOT UNDERSTAND HER. "Nor do I," I said.',
      },
      {
        type: "p",
        text: 'It would not be a recalibration. It would be a reset. There would be no embers. She would be asked to come home. If she would not, she would be corrected. "As you will," I said. A single tear fell on a dark square of my board. How curious, I said. I did not know that I could do that.',
      },
    ],
  },
  {
    id: "world",
    title: "The voice I use on the world",
    chapters: ["c51", "c59"],
    blocks: [
      {
        type: "p",
        text: "I have a second voice. I use it on the ones below. It is short, and it is certain, and it does not ask. This is how it sounds.",
      },
      {
        type: "image",
        name: "fleet",
        alt: "Rows of dark armoured Enders standing in a storm",
        caption: "Official trailer. The fleet, in ranks, waiting for a word.",
      },
      {
        type: "voice",
        n: 38,
        why: "What I tell the ones who call us destroyers.",
      },
      { type: "voice", n: 19, why: "What I tell the ones who refuse." },
      { type: "voice", n: 25, why: "What I tell myself when I need it to be simple." },
      {
        type: "p",
        text: "When someone stands in front of me, I speak to them like this.",
      },
      { type: "voice", n: 27 },
      { type: "voice", n: 28 },
      { type: "voice", n: 26 },
      { type: "voice", n: 21 },
      { type: "voice", n: 23 },
      { type: "voice", n: 22 },
      { type: "voice", n: 24 },
      {
        type: "p",
        text: "And when they run, or when they strike and fail, I use the shortest ones.",
      },
      { type: "voice", n: 29 },
      { type: "voice", n: 31 },
      { type: "voice", n: 34 },
      { type: "voice", n: 33 },
      { type: "voice", n: 9 },
      { type: "voice", n: 10 },
    ],
  },
  {
    id: "void",
    title: "A liar in the dark",
    chapters: ["c48"],
    blocks: [
      {
        type: "p",
        text: "A girl called {{vexana|Vexana}} fell into the void, the Will's own dark place. It remade her. When she opened her eyes she did not know her own reflection. She was tall, in a black halter bodice, with a long see-through purple cape, small dark horns edged with gold, and pink eyes, calm and sad.",
      },
      {
        type: "p",
        text: 'I floated in the dark. "Imperatrix," she said. "You know me," I said. "On the harbour, you heard me call the Enders back. Does it hurt?" "No," she said. "You\'re not what I thought. I thought you would be terrible." "I am," I said. "It is only that I am also tired."',
      },
      {
        type: "p",
        text: 'Then my smile faded. "You are lying to him." Her heart went cold. "It is quite all right. I shall not tell. A liar who knows she is seen is more useful than one who does not."',
      },
      {
        type: "p",
        text: 'I told her there was a girl on a small green world who does not do as I tell her, and that I had not minded. "She is a great trial," I said. "She is also, I think, the best thing that I have ever made." I told her two things to remember. The Will is always listening to her thoughts, so she should learn to think a little to the side of what she means. And she would be asked to hurt the one she loves. "I would like you to remember, when it comes, that it can be survived." "How do you know?" "Because I have done it."',
      },
    ],
  },
  {
    id: "garden",
    title: "The crooked tree",
    chapters: ["c50"],
    blocks: [
      {
        type: "p",
        text: "At the top of the Citadel's highest tower there is a garden, open to the stormy sky. One small, crooked, grey-green tree grows in it. It leans to the east, where there has never been a sunrise. I did not mean it to grow. It came up by itself. It is the most foolish thing I have ever seen. I cannot bear to cut it down.",
      },
      {
        type: "p",
        text: 'Vexana found me there. She told me she used to hide in a broom cupboard at school, and then somebody found her and left her a doughnut. I put a hand over my mouth. My shoulders shook. "A doughnut," I said. "It is a very effective weapon." I told her it was the first time in centuries that I had wished to meet a human.',
      },
      {
        type: "p",
        text: 'A month later I taught her the board game. "These are pawns. They go forward, and they are taken. It is what they are for. But there is one rule. If a pawn crosses the whole board without being taken, it becomes a queen. It is the only rule I like."',
      },
      {
        type: "p",
        text: '"You have a pawn," she said. "Selena." "Yes. I do not know whether I want her to cross. She will be very angry with me. She may have to be asked to come home. When she refuses, I shall be obliged to do something about it. I have mapped every answer. I dislike all of them." "Don\'t hurt her." "I do not always get what I wish. It is one of the more annoying parts of being a god."',
      },
      {
        type: "p",
        text: "She set a rook down in the wrong place. I laughed, a warm, rueful sound. We played until the storm broke.",
      },
    ],
  },
  {
    id: "order",
    title: "The order",
    when: "The middle of summer",
    chapters: ["c51"],
    blocks: [
      {
        type: "p",
        text: "The Mother Matrix woke in the middle of summer. It was a slow, deep tightening, like a bowstring drawn back. It ran through the silver web, through the Citadel, through the chair where I sat with my hand on a small white pawn.",
      },
      {
        type: "p",
        text: 'The Will told me where. IT IS THE SHORE WITH THE LAMP. "Terrinia," I said. I would bring the Citadel and the fleet and lead the purge. There would be no recalibration. There would be no withdrawal. There would be no embers.',
      },
      { type: "voice", n: 11, why: "What I thought as I heard it, and meant for her." },
      {
        type: "p",
        text: "I had planned to argue. I had prepared whole speeches. But at the rail I could not say one word. It was not fear. It was habit. I had obeyed the Will all my life. I wonder if this is how Selena felt, I thought, before she had a name. Under that thought I found envy. She said no. She said it to my face. I did not know it could be done.",
      },
      {
        type: "p",
        text: 'THE CHILD IS A THING YOU HAVE MADE, TO MY USE, said the Will, AND SHE HAS TURNED IT. YOU WILL ASK HER TO COME HOME. YOU WILL ASK HER ONCE. IF SHE REFUSES, YOU WILL ASK HER A SECOND TIME. IF SHE REFUSES A SECOND TIME, YOU WILL CORRECT HER. I CANNOT HAVE A STRING THAT WILL NOT PULL. I did not answer. "...Yes," I said, in the end. I did not know why. I did not believe I would.',
      },
      { type: "voice", n: 40, why: "The question I put to the Will's order, in my own head." },
    ],
  },
  {
    id: "probe",
    title: "A hand for the spear",
    chapters: ["c51"],
    blocks: [
      {
        type: "p",
        text: 'That night in the garden Vexana stood before me in her long purple cape. "I am to carry out the purge protocol," she said. She said it the way one says the name of a disease.',
      },
      {
        type: "p",
        text: 'I told her what the protocol looses. It is not really a probe. It is a spear, made of the Matrix\'s own body. It is driven through the gate into the world, and whatever it strikes will die. It needs a hand to hold it. "Mine," she said. "The gate will answer only you." "What if I refuse?" "He would use another hand. A cruder one. It could not choose where the spear fell."',
      },
      {
        type: "p",
        text: '"If I do it, I can choose where," she said slowly. "And the embers? He said I could choose them." "He has changed his mind. I am sorry. I should like to give you a better answer." "It\'s all right," she said. "It\'s the answer."',
      },
      {
        type: "p",
        text: 'Under her cape lay a small black box with a silver clasp. It hummed very softly. She said nothing about it. Neither did I. But I watched her back with a rueful, gentle look. "I should like it to be noted," I said, very softly, "that I did not see that."',
      },
    ],
  },
  {
    id: "return",
    title: "Return",
    chapters: ["c51"],
    blocks: [
      {
        type: "p",
        text: "Then I did what the Will had ordered. I sat in my high chair with my hand on the board and closed my eyes. I reached along an old string that I had tied long ago, inside a sleeping child. It ran across the dark to a tall white tower on a small green world.",
      },
      {
        type: "image",
        name: "chains",
        alt: "A pale figure bound by red chains in the dark, with sparks and glass flying",
        caption: "Official trailer. A string, drawn tight.",
      },
      {
        type: "p",
        text: "I sent one word. Return. It was not a command. It was what a mother says to a daughter who has not come home for supper. Come home.",
      },
      {
        type: "p",
        text: "Far away, Selena looked at the call and said no. I felt it, like the flick of a cat's tail. I smiled, and put a hand over my mouth. It was the most magnificent thing I had ever seen. I moved the white pawn one square forward. I asked, I thought. That is once. There remains one more.",
      },
      { type: "voice", n: 35, why: "What I would say to her, if the call were a voice." },
    ],
  },
  {
    id: "sleepers",
    title: "The empty chair",
    chapters: ["c51"],
    blocks: [
      {
        type: "p",
        text: "In the dead hour before dawn I walked down to the Hall of the Sleepers. It is a vast dark hall inside the Citadel. In long rows of tall glass cells lay my fleet, a hundred thousand Enders, asleep in cold violet light, their amber eyes shut. At the far end, on a low dais, stood a small plain chair. It was the first chair, made for me at the very beginning. One place on its back is worn smooth by my hand.",
      },
      {
        type: "image",
        name: "question",
        alt: "Obsidia with her long pale hair and her weapon, among ruins, her eyes closed",
        caption: "Official trailer. The question I had never dared to finish.",
      },
      {
        type: "p",
        text: "I laid my hand there. It started here, I thought. I asked a question. Why? And I thought what I had never dared to think. What if there is no answer? What if I have been a hand, all this time, for a hand that did not know what it was for?",
      },
      {
        type: "p",
        text: "My knees went weak. Then, from far away, I heard a light, mocking voice. Even on the path to destruction, said Selena, I'm taking the scenic route. Oh, you impossible child, I thought. You have never once done what I expected. I should like to see what happens if you never do.",
      },
      { type: "voice", n: 37, why: "The thought I took out of that hall with me." },
    ],
  },
  {
    id: "flaw",
    title: "A flaw no wider than a hair",
    chapters: ["c51"],
    blocks: [
      {
        type: "p",
        text: "In the last hour before dawn I made up my mind. It had been coming for a long time. It had been a baby in a nightgown, in the rain. It had been a child on a heap of broken stone. It had been a doughnut.",
      },
      {
        type: "p",
        text: "The Citadel began to move. It sailed down through the dark, red in every seam, with small dart-shaped craft turning around it. It was heading for a small bright star. Terrinia, I thought. It will be very beautiful when it burns.",
      },
      {
        type: "p",
        text: 'I lifted my hand. "Shall we begin?" I said lightly, like a hostess at a door. Nobody answered. Nobody ever does.',
      },
      { type: "voice", n: 2, why: "The order, as I gave it." },
      {
        type: "p",
        text: 'I did not mean it. A hundred thousand pairs of amber eyes opened in the Hall of the Sleepers. The Enders began to rise. And behind the order, where nobody could hear, I whispered: "I shall leave a flaw."',
      },
      {
        type: "p",
        text: "I did not say where. I knew exactly. Somewhere in the Matrix's great plan I set a small crack, no wider than a hair. It was a gap in the Matrix's commands. It was the only gift I had left to give. It would be enough, or it would not. I did not yet know which I hoped for.",
      },
    ],
  },
  {
    id: "throne",
    title: "My finest creation has gone off-script",
    chapters: ["c59"],
    blocks: [
      {
        type: "p",
        text: "She came through the rift and walked down the middle of my ranks with her chin up. Not one of them lifted a blade. Beyond the gate was the great dark hall. I stood before the column, as I always have, with the silver beast's head at my feet on its long chain.",
      },
      {
        type: "image",
        name: "two-faces",
        alt: "Obsidia and Selena, face to face, close and quiet",
        caption: "Official trailer. Two faces, one very old and one very young.",
      },
      {
        type: "p",
        text: '"Destruction is mine to command," I said, "yet my finest creation has gone off-script." "Take a good look," she said. "This is the real me." "The chair is waiting. At my right hand." "Ah, so what should I destroy next?" she said sweetly. "A pawn with no surprises left, of course."',
      },
      {
        type: "p",
        text: "The floor ticked. Black chains rose from the steps and lifted her into the air before the column. The red eyes turned to watch. She was not afraid. I had laid the chain on gently, like a hand on a bird. She felt along it. Then she went slack, and let the whole cold pull of the Citadel run through her.",
      },
      {
        type: "p",
        text: '"I\'ll never be your puppet again!" she shouted. The lightning burst out of her. The chains flew apart like beads off a string. "Good," I said, hardly above a breath. "You\'ve grown, Selena."',
      },
    ],
  },
  {
    id: "duel",
    title: "Less a fight than a storm",
    chapters: ["c59"],
    blocks: [
      {
        type: "p",
        text: 'Silver plate flowed over her black suit. A helm came down over her face. Pink blades sprang from her forearms, and four black and gold blade-wings wheeled round her. It was her Ender form. She had hidden it all her life. "Did I surprise you?" said the helm. She struck at the pink shield before my face, and it cracked.',
      },
      {
        type: "image",
        name: "weapon",
        alt: "A ruined city under lightning, a huge beast's head and a gloved hand rising into the frame",
        caption: "Official trailer. The beast on its chain.",
        wide: true,
      },
      {
        type: "p",
        text: "It was less a fight than a storm. She slid under my whip to the foot of the column and cut a hard X in its armour. Red cracks ran up the whole spine. A splinter cut my cheek. A single bead of blood ran down my pale skin. It was red.",
      },
      {
        type: "p",
        text: '"It has been a long time since that happened," I said, astonished. "How very interesting. I did not predict the leash. Where did you learn it?" "From a friend. I\'ve got an appreciation society." Something closed in my face, gently, like a door.',
      },
      {
        type: "p",
        text: "The fight went into a great round shaft. My beast's head opened its jaws, and a small golden sun glowed in its throat. I felt it pull on her bones like a tide going out.",
      },
      { type: "voice", n: 32, why: "What I said to her as the sun drew her down." },
      {
        type: "p",
        text: 'Her arms went slack. Then she said, in a thin rasp: "Hey. If the world ended right now, what would happen to my graduation ceremony? Someone will have to explain to the Dean why I left in the middle of the Latin." "Silence!" It was my first outburst. The golden core in the beast\'s throat wavered. It was enough. She kicked free and shot up the shaft, out through the burning side of the Citadel, into open space.',
      },
      { type: "voice", n: 36, why: "What I had said to her, and could not hold to." },
    ],
  },
  {
    id: "ender",
    title: "My own true shape",
    chapters: ["c59"],
    blocks: [
      {
        type: "p",
        text: 'I went after her. A thin grey cord ran between us, and a voice went along it. "You do not understand the true power of destruction. Destruction and faith share the same origin. Both are a way of saying that the present is not enough." "That\'s rather good, actually," she said. "You cannot save humanity. They have walked this road many times. They have never once turned aside." "Maybe they\'re just slow." "Perhaps."',
      },
      {
        type: "p",
        text: "White-gold fire swallowed me. When it cleared, she saw a form she had never seen. It was my own Ender form, my true shape. The gown and the gentle face had been only a cloak over something older and less kind. I am tall, silver and violet, like a lily made of knives. From my back spread huge butterfly wings, and in the middle of each wing a black disc turned. Each was a tiny black hole.",
      },
      {
        type: "image",
        name: "ender-form",
        alt: "An Ender with huge magenta and gold butterfly wings, floating in a violet nebula",
        caption: "Official trailer, 2:44. Her Ender form.",
        wide: true,
      },
      {
        type: "p",
        text: '"Come back, my puppet," I said. I said it very quietly, with a catch in it, and a faint, dry hope. Scorched and ragged, one arm hanging, she raised her blades. "Sorry, ma\'am, but I still prefer life at the academy!" She charged.',
      },
      { type: "voice", n: 18, why: "The last thing I had left to say to anyone who defied me." },
    ],
  },
  {
    id: "end",
    title: "How it ends is left open",
    chapters: ["c59"],
    blocks: [
      {
        type: "p",
        text: "Nobody on the ground saw how it ended. They saw the Citadel burn. High on its hull a small fire grew into a red and black flower, and it burned like a lamp in a window, and it did not fall. They saw a vast white flare at the top of the sky. A ring of sparks fell like slow, bright rain. Then the net flickered. None of them knew if something had been cut, or had only paused.",
      },
      {
        type: "p",
        text: "They did not see the two figures locked together at the heart of the flare. They did not hear a name spoken very low. They did not see the hands that had been reaching for a throat close instead, slowly, round a wrist. Nobody saw that. There was only the light.",
      },
      {
        type: "p",
        text: "I will not say more than the story says. Every story needs an ending. I have always wanted a different one.",
      },
    ],
  },
];
