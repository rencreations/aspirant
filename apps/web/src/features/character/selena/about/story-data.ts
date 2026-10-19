import type { ChapterId } from "@/content/types";

/**
 * Selena's whole story, in plain English, from the storm she was left in to the day she rode the
 * lightning. Everything here comes from the novel text (chapter ids are given for each section)
 * and the official trailers. Nothing is added. How her duel with Obsidia ends is left open, as the
 * story leaves it.
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
    id: "storm",
    title: "The storm at Hollin Reach",
    when: "Some years before 978",
    chapters: ["c27"],
    blocks: [
      {
        type: "p",
        text: "Selena's life starts in a storm. A strange superstorm struck {{hollin-reach|Hollin Reach}}, a small river town. At the north end it burned the ground into black glass. The news called it weather. It was not.",
      },
      {
        type: "p",
        text: "{{karina-voss|Karina Voss}} was a rescue worker. She reached the edge of the black glass and saw a child. The girl was about two years old. She was barefoot in the rain, in a nightgown far too big for her. Her hair was so pale it looked silver. Her eyes were a clear, bright red.",
      },
      {
        type: "p",
        text: "The girl did not cry. She looked at Karina as if she were measuring her. Karina opened her arms. The girl crossed the glass and held on to her neck. It was the grip of a child who had never been held.",
      },
      {
        type: "p",
        text: "Selena is an {{enders|Ender}}. She is a full Ender, born in human form. {{obsidia|Obsidia}} made her and set her down in the rain. Obsidia watched from the {{storm-citadel|Storm Citadel}}, through an eye she had opened inside the storm. She had expected the humans to ignore the child, or to fear her. She had not expected open arms.",
      },
      {
        type: "p",
        text: "That day Obsidia sat at a small table where a game of war was laid out. She set one white pawn a little ahead of the others. She said it was pure curiosity. A pawn that crosses the whole board becomes a queen. Remember the pawn. It comes back.",
      },
      { type: "voice", n: 18, why: "A pawn that crosses the board becomes a queen." },
    ],
  },
  {
    id: "home",
    title: "Learning to be a girl",
    when: "Some years before 978",
    chapters: ["c27"],
    blocks: [
      {
        type: "p",
        text: "The registry could not find any family for her. Karina was stubborn and tired, and the clerks wrote down one line: to Karina Voss, on request. Karina took her home to a narrow flat above a bakery in {{terrinia|Terrinia}}. She had never planned to be anyone's mother. She bought a small bed, picture books and little boots.",
      },
      {
        type: "p",
        text: 'The girl said nothing for months. She watched Karina\'s face as if it were a book. On the sixty-first day she smiled. It was a flat, copied smile with no joy in it. Karina knew what it was to wear a smile over nothing. "You don\'t have to do that," she said. "You can just be." The smile stayed anyway, like a mask the girl could not take off. She had decided that smiling was how you were kept.',
      },
      {
        type: "p",
        text: "Deep in her blood a low voice hummed one word: destroy. But something else lived there too. It made her lean on Karina's side while the rain fell. It made her lift her arms to be picked up. Why are they so warm? she wondered. Why does it make me want to hold on?",
      },
      {
        type: "p",
        text: "When she was about three and a half, she chose her own name. Karina had an old picture book. In it, a girl in red boots walked home through a great storm with a lantern. The wind kept blowing the lantern out, and she kept lighting it again. In the last picture she came over a hill and saw a lit window with a woman standing in it. The girl in the book was called Selena.",
      },
      {
        type: "p",
        text: 'The child put a finger on the name. She had not said one word in all those months. "Me," she said. "Yes. I choose."',
      },
      {
        type: "p",
        text: "Obsidia kept watching over the years. She saw Selena learn a real smile at last, crooked, with small sharp teeth. She understood that she was jealous. But she did not pull the string. Not yet, she told herself. Let her grow.",
      },
    ],
  },
  {
    id: "honey-cake",
    title: "Honey-cake by the lake",
    when: "The year 978",
    chapters: ["c11", "c12"],
    blocks: [
      {
        type: "p",
        text: 'One bright day, Selena sat on a low wall by the lake. A girl her own age came by in her father\'s cap. It was {{lesley|Lesley}}. "You\'ve got two eyes," said Selena. "Both of them. They match." Lesley thought it was a strange thing to say.',
      },
      {
        type: "p",
        text: 'Selena sat very still, as if she were listening. "There\'s a hum," she said. "Very far up. I think it\'s the same one that was in the rain." Lesley could hear nothing. Lesley gave her half a honey-cake. Selena looked at it for a long time, then took a small bite. "It\'s sweet," she said. "I like it. You\'re warm."',
      },
      {
        type: "p",
        text: "Soon after, on the night of 9 September, the first great catastrophe struck. Lesley was nine, and it was her birthday. Karina found her that night, hurt, with her face bandaged. Lesley asked where her mama and papa were, and Karina did not answer. Later, in a rescue wagon, a small girl in a grey coat sat on the floor next to her. She drew the blanket up over Lesley's shoulder. \"You're warm,\" she said again.",
      },
      {
        type: "p",
        text: 'Lesley looked at her bandages. "You\'re Selena," she said. "You said I had two eyes." Selena looked hurt, like a child shown a broken toy. "They don\'t match any more," she said. Many years would pass before Lesley remembered whose eyes had been red.',
      },
    ],
  },
  {
    id: "ash",
    title: "The plate that hummed",
    when: "The years of ash after 978",
    chapters: ["c20"],
    blocks: [
      {
        type: "p",
        text: "After 978 the world was broken for years. Dawnbreak built an army, the {{shield-of-dawnbreak|Shield}}, from police, rescue workers, hunters and engineers. They kept wrecked Enders in a salvage yard.",
      },
      {
        type: "p",
        text: "Selena was a young intern there. One day she lifted a curved plate from a dead Ender. Through her glove, she felt it hum. She went very still, like a traveller who hears her own language in a foreign city. Hello, said the plate, without words.",
      },
      {
        type: "image",
        name: "plates",
        alt: "Selena holding a glowing blue plate of Ender armour in a dark workshop, with more plates in glass frames behind her",
        caption:
          "Official trailer. Plates of Ender armour were her first friends in the Shield's yard.",
      },
      {
        type: "p",
        text: "Selena glanced around the yard. Then she smiled slowly and slipped the plate into her apron pocket.",
      },
    ],
  },
  {
    id: "research-post",
    title: "A research post at Selrick",
    when: "The Academy's first days",
    chapters: ["c22"],
    blocks: [
      {
        type: "p",
        text: 'A new school, {{selrick-academy|Selrick Academy}}, rose on the ruins of the old base. On the third day, a girl in a plain brown coat walked into the registry office. She had pale gold hair, a bright smile and deep red eyes. "I\'ve come about the research post," she said. "I seem to have a gift for Ender tissue. I can almost hear it."',
      },
      {
        type: "p",
        text: "They sent her to a lab. A small girl in a white coat sat soldering. A tall young woman with a dark plate over one eye leaned beside her. Selena stopped in the doorway. She had known they would be there. She had not known it would hurt. She remembered a rescue wagon and a small hand on a blanket.",
      },
      {
        type: "p",
        text: 'Lesley saw the gold hair and the red eyes. A cold finger touched her mind. Honey. The sea. "Have we met?" she asked. "I don\'t think so," said Selena lightly.',
      },
      {
        type: "p",
        text: '"What do you hear when you hold the tissue?" asked the small girl. This was {{change|Chang\'e}}, the Chief Scientist. "Humming," said Selena. "Like when a person is thinking something and doesn\'t say it." Chang\'e had felt it but never heard it. "I would like to learn how," she said, and held out a small, sticky hand.',
      },
      {
        type: "p",
        text: "Selena had come to see what these people had built out of her own people's bones. She had planned it as a game. She had not expected a child with soldering flux on her nose saying, I would like to learn. She took the hand. \"Welcome to Selrick,\" said Chang'e.",
      },
      {
        type: "image",
        name: "smile",
        alt: "Selena in a white school uniform, standing in a glass pane with a gentle smile and one hand at her cheek",
        caption: "Official trailer. The polite smile she learned to wear.",
      },
      {
        type: "p",
        text: 'Karina had taught Selena to wear a smile like a coat. Now it was no longer a coat at all. It was a small, crooked, helpless smile, with a flash of sharp teeth. "Thank you," said Selena. "I\'d like that very much."',
      },
    ],
  },
  {
    id: "silverbolt",
    title: "Silverbolt",
    when: "The Academy's first year",
    chapters: ["c23"],
    blocks: [
      {
        type: "p",
        text: 'Everyone at the Academy agreed that Selena was a genius. She could wake any machine with one tap of her spanner. "It\'s the third coil," she would say. "It\'s sulking." When they asked how she did it, she said, "I just ask nicely." She had practised that smile all her life. But it was no longer only a mask. She had come to the Academy as a spy, as a game. Somewhere along the way she had become happy. It was a very alarming discovery.',
      },
      {
        type: "p",
        text: 'In the middle of the lab stood a mecha, a machine made to be worn like armour. The {{armoury|Armoury}} had built it, but it had never worked. Eleven people had tried. Chang\'e had used plates from a wrecked Ender, from the salvage yard. "It\'s as if it were deaf," she said. "Would you like to try? I wondered if it might hear you."',
      },
      { type: "voice", n: 8, why: "Her first thought at the sight of a mecha." },
      {
        type: "p",
        text: "Selena knew this was the moment to decide whether to be seen. She took off her jacket and climbed in. The suit woke at once. Blue lights lit its face. The white limbs closed around her like petals. Hello, said the suit, without words. I know you. You are one of us. It was the first place where she did not have to pretend.",
      },
      {
        type: "image",
        name: "blueprint",
        alt: "A hand drawing the blueprint of a tall winged suit of white armour on grid paper",
        caption: "Official trailer. A mecha drawn from the bones of her own kind.",
      },
      {
        type: "p",
        text: 'The suit rose and took a step. "It\'s perfect!" cried Chang\'e. "How did you do that?" "I don\'t know," said Selena. "I just wanted it to." "It\'s more like a tuning," said Chang\'e. She paused. "I wonder what you are." It went through Selena like a knife. "A natural," she said lightly. Chang\'e looked at her, shrewd and a little sad. "I suppose you are," she said, and wrote something in her notebook. She knows, thought Selena. She is not going to say. And behind the cold drop in her stomach came, to her surprise, gratitude.',
      },
      {
        type: "p",
        text: 'Soon the mecha raced the length of the training hall and leapt over a wall. A young Armoury sergeant said it was like a bolt of lightning. "A silver one," said somebody. "{{silverbolt|Silverbolt}}." The name stuck.',
      },
      {
        type: "p",
        text: 'Under Selena\'s hands it grew wing-blades, a tail and a long neck. Unworn, it stood as a dragon of white-silver metal with blue gem eyes. It could fold into two crescent claws that circled her like moons. She called it her baby. She had made it from the bones of her own kind. Nobody else could make it move. "It\'s loyal," said Selena. "It knows who its friend is."',
      },
      { type: "voice", n: 11, why: "Test day, and it works." },
    ],
  },
  {
    id: "storm-nights",
    title: "Storm nights",
    when: "The Academy's first summer",
    chapters: ["c23"],
    blocks: [
      {
        type: "p",
        text: "One summer evening a storm came in off the sea. Selena felt the thunder calling in her blood, and she went up on the roof. She had been a good girl for a very long time. She was tired of it. Nobody's looking, she thought.",
      },
      {
        type: "p",
        text: 'She took off her uniform and let go. Her Ender side rose like a tide. Her arms darkened with a violet shine. Her nails grew into blades. Purple living armour crept over her skin. Lightning struck beside her, and she caught it in her palm and grinned. Silverbolt rose on blue flame and curled around her shoulders. "Let\'s go for a run," said Selena.',
      },
      {
        type: "image",
        name: "roof-storm",
        alt: "Selena sitting on the edge of a rooftop under storm clouds, with a white dragon of metal and blue fire beside her",
        caption: "Official trailer. The roof, the storm and Silverbolt.",
        wide: true,
      },
      { type: "voice", n: 9, why: "Her mood on a night like this." },
      {
        type: "p",
        text: "She crossed the city by the rooftops. In {{tanners-row|Tanner's Row}}, she stopped. High in a brick block, a yellow lamp burned. A stout woman with a tape measure round her neck was bent over a piece of cloth. Selena did not know her. But she watched until the light went out. Someone's always waiting, she thought.",
      },
      {
        type: "p",
        text: "She ran on to a black cliff above the sea and shouted for joy. Free, she thought. She did not know that Obsidia was watching from the Citadel with a white pawn in her hand. Oh, my dear, thought Obsidia. Oh, look at you.",
      },
      { type: "voice", n: 1, why: "What the night run was for." },
      { type: "voice", n: 3, why: "How she describes the same nights." },
    ],
  },
  {
    id: "orders",
    title: "Obsidia's orders",
    when: "The Academy's first year",
    chapters: ["c23"],
    blocks: [
      {
        type: "p",
        text: 'The orders came on a wet afternoon in the salvage yard. Selena held a curved plate, and a voice rose out of the dead tissue, low and cool. "Selena. You are my daughter. Not in the human way. But I made you. I set you down in the rain."',
      },
      {
        type: "image",
        name: "obsidia-watching",
        alt: "A dark figure with glowing blue eyes behind red chains, with white butterflies in the air",
        caption: "Official trailer. Obsidia's voice, heard through Ender plates.",
      },
      {
        type: "p",
        text: 'I don\'t want a task, thought Selena. "The {{aspirants|Aspirants}} have learned to make the light that burns us," said the voice. "I need you to be my eyes. Tell the plates what you see, and I will hear. And if you do not, I should be sorry." It was gentler than a threat. It was far worse.',
      },
      { type: "voice", n: 26, why: "Her answer to every leash." },
      {
        type: "p",
        text: "Selena said she would look. She told herself it was a game. Every evening she told the plate what she had seen. She told it only things that were true and a month old. To her annoyance, she rather enjoyed it.",
      },
      {
        type: "p",
        text: "Then came a harder order. In the cellars, a coolant valve fed the {{defence-sphere|Defence Sphere}}'s northern emitter. If she turned it a few degrees, the Sphere would slowly wear thin. One day, when Enders were at the gate, it would fail. At three in the morning she stood at the valve with a spanner. She thought of a small girl with her hands pressed to her mouth. She thought of a woman in a lit window. She took the wheel in both hands and turned it the wrong way.",
      },
      { type: "voice", n: 21, why: "A leash pulled too tight will snap." },
      {
        type: "p",
        text: 'In the morning, the engineers found the northern line running better than ever. "A marvellous fluke," said somebody. That afternoon Chang\'e came into the lab with a folder. "The valve was set fourteen degrees off the standard. It works better now. I wondered who had done it." "I haven\'t the faintest idea," said Selena. Chang\'e looked at her a long time. There was no anger in it, only a small, sad, understanding smile. "Whatever it was, thank you," she said. "And I wanted to say, I trust you."',
      },
      {
        type: "p",
        text: 'She turned scarlet and marched out. She knows, thought Selena. And she trusts me anyway. It was the most terrible thing anyone had ever said to her. She put her head on her arms, and the dragon crept up and laid its silver head on her knee. "Don\'t look at me," she told it. "We have a spanner to hide."',
      },
      {
        type: "p",
        text: 'High on a cold deck, Obsidia had seen it all through the plates. She waited for anger, and it did not come. "Good," she said, to the empty hall. She moved the white pawn one square forward. Show me, she thought. Show me what you will do.',
      },
    ],
  },
  {
    id: "academy",
    title: "What she gave the Academy",
    when: "The seasons that followed",
    chapters: ["c08", "c10", "c32"],
    blocks: [
      {
        type: "p",
        text: 'Selena was soon the Academy\'s best young mechanic. When {{guinevere|Guinevere}} and {{vexana|Vexana}} set out to repair some old drones, she turned up with a toolbox and a lazy smile. "They\'ve got character," she said. "Somebody oiled these for years. It\'s nice to be looked after." It took six weeks. Selena did the circuits, Vexana did the sums, and Guinevere gave them cat ears cut from cardboard. Selena sprayed the spheres black and made proper metal ears. She saw how Vexana looked at Guinevere. She is so in love, she thought, and bent over her toolbox and said nothing.',
      },
      {
        type: "p",
        text: 'When Guinevere was shouting at a stubborn crystal for the {{emblem-of-hope|Emblem of Hope}}, Selena leaned in the doorway with her dragon at her feet. "You\'re gripping it like a rope," she said. "A crystal doesn\'t want to be gripped. It wants to be listened to." She fished it out of the crack, and the crystal began to hum.',
      },
      {
        type: "p",
        text: "She taught the cadets too. In a fight with a giant {{ultra-enders|Ultra Ender}}, {{fanny|Fanny}} remembered Selena's lecture: every Ultra has a weak spot at the neck, where the plates cannot overlap. And {{layla|Layla}}, alone at the mouth of an alley, heard Selena's voice in her ear. \"Is this a bad time? You slept through my lecture. Here is the short version. An Ultra needs a second and a half to put a foot down, and it can't turn while it does. Hit the knee of its planted leg with a full charge. It will fall for about four seconds. That is long enough for a quick person on a cable to reach its neck.\"",
      },
      { type: "voice", n: 12, why: "Her opinion of Ultras." },
    ],
  },
  {
    id: "core",
    title: "The Core and the alert",
    when: "Later in the Academy years",
    chapters: ["c28", "c31"],
    blocks: [
      {
        type: "p",
        text: 'A small scout from {{oro|Oro}}, a world very far away, crashed into a barley field. Inside it lay a locked memory crystal. Chang\'e could not open it, and the fourth lock answered to a signal. "It is calling," she said. "I do not know who to."',
      },
      {
        type: "p",
        text: '"I could listen," said Selena lightly. She held her hand over the casket with her eyes half closed. "It is a copy of something far away. It is the {{ender-control-core|Control Core}}. The thing that tells the Enders what to do." Chang\'e gave her a long, level look. She had seen something, and she chose to keep quiet. "Selena," she said briskly, "would you be so kind as to hum?" Selena hummed one low, long note, and the casket clicked open.',
      },
      {
        type: "p",
        text: "Something in Selena's blood answered, like a far bell. It was the voice of her own kind. She remembered Obsidia saying that humans had taken a thing of the Enders, and that it was a most interesting experiment. Now she understood. She said nothing.",
      },
      { type: "voice", n: 45, why: "How it felt." },
      {
        type: "p",
        text: "Later, an alert sounded and Enders came through a breach in the sky. In the lab Selena stood still beside Silverbolt. The hum in her blood had split in two, and the second song was close and wrong. It's a copy of the Core, she thought. Someone is holding their leashes. She felt angry.",
      },
      {
        type: "p",
        text: 'Obsidia\'s voice spoke in her mind. "Selena. Do not interfere. You will observe." "They\'re burning a city!" "They always do." "That\'s not an answer." There was a long silence. "No," said the voice, almost with regret. "It is not." Selena went to the command room and smiled at the little scientist. "All right, Chief. What do you need?"',
      },
    ],
  },
  {
    id: "underhill",
    title: "A stall at Underhill",
    when: "June, before graduation",
    chapters: ["c50"],
    blocks: [
      {
        type: "p",
        text: "{{underhill|Underhill}} was a black market in forgotten cellars under the lower terraces of Terrinia. Selena kept a small table there, with her white dragon asleep under the chair. She sold pieces of Ender wreckage. In June a thin girl with silver hair came to buy. It was Vexana, and she needed a blade that could mark the Control Core.",
      },
      {
        type: "p",
        text: "\"Well,\" said Selena. \"Look who's come to market. Sit down. I don't want money. It's so dull.\" Vexana's eyes filled with tears, and Selena said she was sorry. \"I'm a beast. I'm an Ender, made in a vat. I've a mother, of a kind, who is very old and tired. I'm trying not to be what she wants me to be.\" \"I know,\" said Vexana, and threw back her hood.",
      },
      { type: "voice", n: 17, why: "She shows Vexana who she is." },
      {
        type: "p",
        text: 'Selena saw exhaustion and knew it from the inside. "You\'ve a plan," she said gently. "It shines on you like a bad lie. You\'re another pawn, like me." She took a small black box from under the table. In it lay a thin needle of dark crystal, as long as a hand. It was a sliver of a {{wardens|Warden}}\'s heart, the only bit of Ender in the world tuned to the Core. "It would go to the Core like a needle to a magnet," she said. "It\'s the one thing that could break it."',
      },
      {
        type: "p",
        text: '"Why give it to me?" "I hear the Core in my sleep. It\'s like a hand on the back of my neck. I\'d like it to stop." She pushed the box across the cloth. "It\'s not for sale. It\'s a loan. But I want a story in return. When it\'s all over, tell me how it ended. I\'d like to know there\'s a way out." "I promise," said Vexana.',
      },
      {
        type: "p",
        text: 'They sat a while longer. "The {{imperatrix|Imperatrix}} is cold and clever," said Selena, "and she plays chess with a pawn. She made me. I\'m awfully fond of her. It\'s the most inconvenient thing." "She laughed when I put the rook in the wrong place," said Vexana. "She doesn\'t laugh!" Selena grinned. They both began to laugh, half sob and half giggle. Vexana left before dawn with the box inside her cloak. Selena raised one hand from the table. Go on, it said. I\'ll be here.',
      },
    ],
  },
  {
    id: "society",
    title: "The Appreciation Society",
    when: "The weeks before graduation",
    chapters: ["c52"],
    blocks: [
      {
        type: "p",
        text: "In the weeks before graduation, a club appeared at the Academy. Nobody had founded it. A freckled girl called {{ottoline|Ottoline}} had sewn a banner that read {{appreciation-society|SELENA-SENPAI APPRECIATION SOCIETY}}. A senpai is an older student you look up to. A small stitched dragon sat in the middle.",
      },
      {
        type: "p",
        text: 'On the Society\'s first anniversary, they gave Selena a cake, flowers and a speech. For once, Selena went pink. "It looks like a lizard," she said, of the dragon. "It\'s Silverbolt!" said Ottoline. "It\'s majestic!" "It\'s rather a good lizard," said Selena. "I\'m touched." She was. Her throat felt tight. They like me, she thought. They don\'t know. They think I\'m one of them. It hurt more than she had expected.',
      },
      {
        type: "image",
        name: "graduation",
        alt: "Selena asleep on a desk among paper, with a thought bubble holding a cupcake",
        caption: "Official trailer. A graduation, a cupcake, and a nap she did not want to end.",
      },
      {
        type: "p",
        text: 'Over the cake, Selena joked, "If the world ended right now, what would happen to my graduation ceremony?" Everyone laughed. Selena laughed too, a beat late. She had not found it funny. She wanted, quite badly, to stand on a stage in a white gown and be given a piece of paper. It was the realest thing she had.',
      },
      { type: "voice", n: 14, why: "The joke, in her own voice." },
    ],
  },
  {
    id: "return",
    title: "RETURN",
    when: "August",
    chapters: ["c52"],
    blocks: [
      {
        type: "p",
        text: "All that time, Obsidia's string pulled tighter. Then, one night in August, Selena could not ignore it any longer. She was alone in the third-floor lab, sorting her messages. At the bottom of the list was one she had never seen. It had no sender and no date. It was one word, in thin grey letters. RETURN.",
      },
      {
        type: "image",
        name: "recall",
        alt: "A figure on red chains in a shattered pane of glass, facing a blue figure with long hair",
        caption: "Official trailer. Obsidia's call reaches across the dark.",
      },
      {
        type: "p",
        text: "It was Obsidia's call. It had crossed the whole dark to find her. It was not an order. It was something worse. It was a question: would you like to come back? She put her head in her hands. No, she thought. No. No. No. Then she took a sheet of paper and wrote one word across the whole page. NO. She folded it in four and put it in the fire. At the back of her mind, the line gave a small, astonished twitch. It felt almost like a laugh.",
      },
      { type: "voice", n: 46, why: "What she wanted, that night." },
    ],
  },
  {
    id: "supper",
    title: "Supper with Karina",
    when: "The last Sunday of August",
    chapters: ["c52"],
    blocks: [
      {
        type: "p",
        text: 'On the last Sunday of the month, Selena went to supper at Karina\'s flat above the bakery. It was the one place where she never had to pretend. "Mama," she said. It was not a word she used. She had said it a few times as a tiny child, and then stopped. Karina went white, then pink. "Don\'t you dare," she whispered, "take it back."',
      },
      {
        type: "p",
        text: '"I think I\'m going to be very bad for a while," said Selena. "I might not come back." "I know," said Karina. "I\'ve known since you were small. I never asked. I thought, when she\'s ready, she\'ll tell me. And if she can\'t, I\'ll love her just the same. I picked you up in the rain. You didn\'t cry. You wouldn\'t let go. I never believed I did the finding. I think you chose me." "I did," said Selena. "I looked at you and thought, that one. I think I was frightened." "Of what?" "Of being nobody\'s." "Oh, my love," said Karina. "You were always mine."',
      },
      {
        type: "p",
        text: "After supper, Karina took a small old book from the shelf. Its blue cover had faded to grey. On the front, a girl in red boots held up a lantern against a stormy sky. \"It's yours. It always was. It's a graduation present.\" On the last page, far across a dark field, was a small lit window with a woman standing in it. \"She always gets home,\" said Karina. \"That's the whole point. She might take the long road. She might sit in a ditch and think she can't. But the light is on. There's a window. And there's somebody in it.\"",
      },
      {
        type: "p",
        text: 'I\'m going to take the long way, thought Selena. And I\'m going to come back. "Thank you for the light," she said. "It\'s only a lamp," said Karina. "It\'s the only one," said Selena.',
      },
    ],
  },
  {
    id: "lamp",
    title: "The lamp on the third floor",
    when: "The night before graduation",
    chapters: ["c52"],
    blocks: [
      {
        type: "p",
        text: 'On the night before the ceremony, Selena went into the lab at a quarter to one. Chang\'e sat at the long bench, a very small figure in a large white coat, with {{mr-bunny|Mr. Bunny}} beside her and a cup of cold cocoa. "I thought you\'d want to say goodbye," she said. "I\'m not going anywhere," said Selena lightly. "I\'m graduating." "You needn\'t pretend," said Chang\'e. "I\'ve known since the mecha."',
      },
      {
        type: "p",
        text: "\"The readings were not human. They matched the Enders. I wrote it down. I didn't tell.\" Her eyes were wet behind her glasses. \"I thought, she's an Ender. She's what killed my parents. And then I thought, no. She's the one who hummed. You sang the memory crystal open. And in the cellars, somebody was told to break a valve, and fixed it instead. I said that I trusted you. It isn't what you are. It's what you do.\"",
      },
      {
        type: "p",
        text: '"Yes," whispered Selena. She was crying and had not noticed. "I know something is pulling you," said Chang\'e. "I know you can\'t stay. There\'s a window on the third floor. It has a lamp. I\'ve left it on every night. It\'s only an ordinary lamp. I just wanted you to know." She put on her glasses, picked up Mr. Bunny and walked to the door with great dignity. "Good night, Selena. You\'ll look very well in a gown."',
      },
    ],
  },
  {
    id: "graduation",
    title: "Graduation day",
    when: "The first week of September",
    chapters: ["c52"],
    blocks: [
      {
        type: "p",
        text: "The morning of the ceremony was bright. Selena stood before a mirror in her white gown and smiled her best smile. Behind it, in her red eyes, was a vast, quiet, dreadful calm. Not yet, she thought. Let me have this one thing. And then I'll go.",
      },
      {
        type: "p",
        text: 'On the lawn, Lieutenant Lesley stood at the lectern and read out a name. "Selena." A freckled girl in the third row leapt up with her banner. "SELENA-SENPAI!" The crowd laughed warmly. Selena climbed the steps with her cap over one ear and looked up into Lesley\'s grave, scarred face. She doesn\'t know, she thought. She asked me once if we had met, and I said no.',
      },
      {
        type: "p",
        text: '"Lieutenant," said Selena. "I pulled your blanket up once." It was out before she had thought. It was small and quiet, in a voice like a child\'s. Deep in Lesley\'s eye, something stirred. A rescue wagon. A long, jolting dark. A small cold hand on a blanket. "What did you say?" "Nothing." Selena smiled her best smile. "It\'s the excitement. Thank you for everything." She bowed to the cheering crowd. I love you all, she thought. I\'m so sorry. I\'m going to ruin it.',
      },
      {
        type: "p",
        text: 'At that moment the light went out of the sky, as if a soft hand had covered the sun. It turned crimson and violet. From the north came a deep, cold hum. In the back of Selena\'s skull, a voice spoke very gently. "Selena. It is time. I am here. Will you come home?" Obsidia was asking again. Not yet, thought Selena. Let me have the day.',
      },
      {
        type: "p",
        text: 'Far away over the northern sea, the sky split in a shape with four long points, like a star drawn with a ruler. Its edges glowed red like molten metal. Through the tear came a huge black ship with a tall spire. It was the Storm Citadel. Chang\'e stood on her box, pale as paper. "Aspirants," she said. "To your stations."',
      },
    ],
  },
  {
    id: "roof",
    title: "The roof",
    when: "Graduation day",
    chapters: ["c53"],
    blocks: [
      {
        type: "p",
        text: "The {{mother-matrix|Matrix}} unrolled over Terrinia in a great silver net. Every thread was a gate. Out at sea, the first thread struck the water, and Enders began to rise from the whirlpool in a long black file. Chang'e's voice crackled from the receiver on Selena's collar. \"Selena, where are you? I need the Science Division at the gates!\"",
      },
      { type: "voice", n: 2, why: "Her answer, more or less." },
      {
        type: "p",
        text: '"I\'ll be there. In a minute," said Selena lightly. There was a pause. Then Chang\'e spoke again, steady and warm, with no anger at all. "All right. Take your moment. I\'ll be here when you\'re done. The lamp\'s on. Don\'t be too long." The receiver clicked. "Oh, you awful, wonderful child," said Selena, to nobody. "Right. Moment taken."',
      },
      {
        type: "p",
        text: 'She took off her gown. Underneath were her ordinary school clothes. She did not hide what she was any more. The wind blew back her hair and showed two small red horns, pointed ears and sharp teeth. She climbed to the highest grey roof of the Academy and sat on the edge. Silverbolt uncoiled from a vent and hung at her shoulder. She unwrapped a red candy on a stick and looked up at the wound in the sky. "Finally," she said, with great contentment. "The fun part begins."',
      },
      {
        type: "image",
        name: "rift-roof",
        alt: "A girl and a white dragon on a high rooftop, looking out over a city under a huge red four-pointed rift in the sky",
        caption: "Official trailer. The sky tears open over Terrinia.",
        wide: true,
      },
      { type: "voice", n: 19, why: "How big her ambitions are." },
      {
        type: "p",
        text: "At noon the Imperatrix spoke to the whole city. She said it was the end, and that she was sorry. Selena watched it all with the candy between her teeth. She saw Guinevere shoot north on her boosters. She saw Vexana, far off, with a gold star at her throat. There they go, she thought. The little Queen and her shadow. They'll find a way. They always do.",
      },
      { type: "voice", n: 6, why: "Her plan for the first act." },
      { type: "voice", n: 22, why: "Her view of a world that is ending." },
      {
        type: "p",
        text: "Silverbolt pressed its head against her ear. High above, in the thunder of a great ship, a voice she had known all her life was waiting. Selena did not answer it. Not yet, she thought. I want to see how it ends.",
      },
    ],
  },
  {
    id: "recall",
    title: "The recall",
    when: "Graduation day",
    chapters: ["c58"],
    blocks: [
      {
        type: "p",
        text: "Karina was in the medical tent on the south lawn, but she was watching one roof. Some part of her always kept count of one person, like a mother on a beach. Selena sat on the edge of the highest roof, with a stick of candy, Silverbolt at her shoulder and a pink heart-shaped clip pinned to one horn. She was smiling a new smile, soft and lopsided, not her usual neat, copied one. Then the smile was gone.",
      },
      {
        type: "p",
        text: 'A {{hunters|hunter}} came down out of the cloud: a long black dart the size of a river barge, with one amber eye. A voice came out of it, low, dry and very old. Obsidia was far away in her ship. This was only her voice. "It has been a while, my little doll."',
      },
      { type: "voice", n: 32, why: "How the interruption felt." },
      {
        type: "p",
        text: "The thing in the sky could see through glass, so Selena crossed the quad to the old {{bell-tower|bell tower}}. It was sandstone, older than the Academy, with two hundred and fourteen steps. At the top hung one huge bell, rung once a year. She loved it because it was old and plain. It had no circuits. Up there, nothing could call her name. It's a good place, she thought, to tell somebody no.",
      },
      { type: "voice", n: 39, why: "Her greeting." },
      {
        type: "p",
        text: '"Hello, Mother," she said, with her old polite smile. "It\'s been a while, my dear creator." "I have watched you teach them to fight us. You gave away our secrets, one by one, with a smile. It was most diverting. I was proud." "That\'s nice," said Selena. "It is time to come home. There is a great place for you, at my right hand, as my successor." "Oh," said Selena. It was the first thing she had said that was not rehearsed.',
      },
      {
        type: "image",
        name: "bell-tower",
        alt: "Close view of Selena's face with a glowing red diamond-shaped pupil and a half smile",
        caption: 'Official trailer. "It\'s been a while, my dear creator."',
      },
      {
        type: "p",
        text: "Karina was climbing the stair, counting the steps. She had known since a wet night on the Hollin road that the child was not what she seemed. She had thought, whatever she is, she is mine. She came out through the trapdoor at the top. Selena was standing in the wind, laughing.",
      },
      {
        type: "p",
        text: '"That\'s the best offer I\'ve ever had! I\'d have the Citadel, the fleet, the Matrix. Except for one thing. I\'d have to do what you like." "We are one," said Obsidia. "You and I." "I know. That\'s what\'s wrong. We\'re fated to destroy each other. Why were we made so alike?" "I did not make you to destroy me. I added one more pawn to the board. It was a whim. I did not expect to love it."',
      },
      { type: "voice", n: 16, why: "The question she asks her creator." },
      {
        type: "p",
        text: '"Well," said Selena lightly. "This so-called destiny. It doesn\'t sound cool at all." "You are an Ender. You are mine." "It\'s what I was born as. It isn\'t what I am. Don\'t you think it\'d be more fun to smash fate to smithereens?" "Free will is a flaw that must be corrected." "That\'s funny. I was about to say the same about yours." She smiled, wide and sharp, with something like pity in it. "Sorry. I still prefer life at the Academy."',
      },
      { type: "voice", n: 13, why: "Her answer to fate." },
      { type: "voice", n: 44, why: "Her answer to the offer." },
      {
        type: "p",
        text: 'She held out her hand, and Silverbolt pushed its head under her palm like a cat. "Overload," she said softly. Lightning ran over her. Silverbolt folded into two white crescent blades that spun up around her. Her school clothes turned into her combat suit, black and glossy, with a short violet cape. The little tin clip fell from her horn and rolled away.',
      },
      {
        type: "p",
        text: '"Hey," she said to Karina. "Sweetheart. Don\'t look at all this. It\'s a mess." "It\'s beautiful," said Karina, crying. "It\'s you." Selena went still for a heartbeat. "I got your picture book," she said. "It\'s the best one I\'ve got. I\'ll bring it back. I\'ll come back, Mum. I\'ll be about an hour. I\'ve been rather rude to somebody for a very long time. I thought I\'d better go and say so. In person."',
      },
      {
        type: "p",
        text: 'For months a thin grey thread had run from her to the Storm Citadel. She had never followed it. Now she did. There you are, she thought. Got you. "Right. Here comes the lightning."',
      },
      { type: "voice", n: 34, why: "The launch." },
      {
        type: "image",
        name: "lightning-leap",
        alt: "Selena in her Ender form flying through a night sky towards a red rift, with a long trail of pale hair",
        caption: "Official skin showcase. A road of lightning up to the rift.",
      },
      {
        type: "p",
        text: 'Lightning split the clouds and left a long white road up to the red rift and the Storm Citadel. "Even on the path to destruction," cried Selena, laughing, "I\'m taking the scenic route!" She leaped. She shot up the road of lightning like an arrow, and the cloud closed behind her like a door.',
      },
      { type: "voice", n: 43, why: "The line she leaves with." },
      { type: "voice", n: 5, why: "Her goodbye." },
      {
        type: "p",
        text: 'The top of the tower was quiet. Karina picked up the pink clip. It was a cheap bit of tin that had cost four coins at a fair. A very small girl had once put it in her hair and said, carefully, like reading a line, "Thank you, Karina. It is very nice." "Go on, then," Karina whispered. "Show her." On the lawn below, students in teal sashes held up a banner. One kept whispering, "She\'s an Ender." A plump boy, who had written Selena a letter every week and never had a reply, answered steadily. "Yes. And she\'s ours."',
      },
    ],
  },
  {
    id: "citadel",
    title: "The Storm Citadel",
    when: "Graduation day",
    chapters: ["c59"],
    blocks: [
      {
        type: "p",
        text: "There was no sound in the high dark. Selena rose through the rift and looked back once. She saw the Academy, and the Matrix's net across the sea. Still there, she thought. Well. It's not my department. She turned her back on it. Hello, Storm Citadel.",
      },
      {
        type: "p",
        text: "The Citadel was larger than she had imagined. Ranks of Enders stood before its gate. Not one lifted a blade. She walked down the middle of them with her chin up.",
      },
      {
        type: "image",
        name: "citadel-walk",
        alt: "Selena in dark armour walking between rows of tall, thin Enders on a ruined plain under a red sky",
        caption: "Official trailer. The ranks open and do not touch her.",
        wide: true,
      },
      {
        type: "p",
        text: 'Beyond the gate was a vast dark hall. At the bottom rose a column like a spine, ringed with red lights like eyes. Before it stood Obsidia, as she had always been. Her hair was pink and gold. One eye was violet-blue, with a star in it. The other was pink-red. A silver beast\'s head lay at her feet, on a long chain. "Destruction is mine to command," she said, "yet my finest creation has gone off-script."',
      },
      {
        type: "image",
        name: "obsidia-hall",
        alt: "Selena seen from behind with long golden hair, facing a small figure at the far end of a dark hall with a spined pillar",
        caption: "Official trailer. The hall, and the one who waits in it.",
        wide: true,
      },
      {
        type: "p",
        text: '"Take a good look," said Selena. "This is the real me." It was the only line she had left. She had planned a whole speech. But she looked at Obsidia and thought: she has been alone for a very long time. "The chair is waiting," said Obsidia. "At my right hand." "Ah, so what should I destroy next?" said Selena sweetly. "A pawn with no surprises left, of course."',
      },
      { type: "voice", n: 42, why: "What she would rather destroy." },
      {
        type: "p",
        text: "The floor ticked. Black chains rose from the steps, coiled round Selena and lifted her into the air before the column. The red eyes turned to watch. She was not afraid. A pull is a handle, she thought. A leash has two ends. A small scientist had once agreed with her. She felt along the chain. It was strong, but it was not quite tight. It had been laid on gently, like a hand on a bird. Then I'll pull exactly as tight as she thinks I will.",
      },
      { type: "voice", n: 20, why: "Who holds the strings." },
      {
        type: "p",
        text: 'She went slack. She let the whole cold pull of the Citadel run through her and gathered it where her lightning lived. "I\'ll never be your puppet again!" she shouted. The lightning burst out of her. The chains flew apart like beads off a string. "Good," said Obsidia, hardly above a breath. "You\'ve grown, Selena."',
      },
      { type: "voice", n: 29, why: "The shout." },
      {
        type: "image",
        name: "chains-break",
        alt: "Selena in white and blue armour wrapped in blue lightning, with broken chains around her, in a dark hall",
        caption: "Official trailer. The chains fly apart.",
        wide: true,
      },
      {
        type: "p",
        text: "Silver plate flowed over Selena's black suit. A helm came down over her face. Pink blades sprang from her forearms. Four black-and-gold blade-wings wheeled round her. This was her Ender form, her true shape. She had hidden it all her life. \"Did I surprise you?\" said the helm. She struck at the pink shield before Obsidia's face, and it cracked.",
      },
      {
        type: "image",
        name: "ender-form",
        alt: "Selena in her Ender form, white and silver armour with blue light and wide blade-wings, with a spear of pink lightning",
        caption: "Official skin showcase. Her Ender form.",
      },
      { type: "voice", n: 40, why: "Her warning to her creator." },
    ],
  },
  {
    id: "duel",
    title: "The duel",
    when: "Graduation day",
    chapters: ["c59"],
    blocks: [
      {
        type: "p",
        text: "It was less a fight than a storm. For the first time, Selena held nothing back. She found, with wild joy, that the cold, hungry thing in her blood was magnificent. She slid under Obsidia's whip to the foot of the column and cut a hard X in its armour. Red cracks ran up the whole spine, and the column came apart in a slow fall of red light.",
      },
      { type: "voice", n: 25, why: "Where she shines." },
      {
        type: "p",
        text: 'Obsidia stood in the flames. A splinter had cut her cheek. A single bead of blood ran down her pale skin. It was red. She\'s bleeding, thought Selena. It\'s red. The same as mine. The same as Karina\'s. "It has been a long time since that happened," said Obsidia, astonished. "How very interesting. I did not predict the leash. Where did you learn it?" "From a friend. I\'ve got an appreciation society." Something closed in Obsidia\'s face, gently, like a door.',
      },
      { type: "voice", n: 37, why: "The mood of the exchange." },
      {
        type: "p",
        text: "The fight went into a huge round shaft. Obsidia's beast-head opened its jaws, and in its throat glowed a small golden sun. Selena felt it pull on her bones, like a tide going out. \"Sleep,\" said Obsidia, in the cradle of the void. Selena's arms went slack. She thought of a small kitchen and a woman singing out of tune at the stove. She thought of a picture book with a girl in red boots. And she thought, with sudden childish anger, I haven't even had my diploma!",
      },
      {
        type: "p",
        text: '"Hey," she said, in a thin rasp. "If the world ended right now, what would happen to my graduation ceremony? Someone will have to explain to the Dean why I left in the middle of the Latin." "Silence!" It was Obsidia\'s first outburst. The golden core in the beast\'s throat wavered. It was enough. Selena kicked free and shot up the shaft, out through the burning side of the Citadel and into open space.',
      },
      { type: "voice", n: 14, why: "The same joke, at the worst moment." },
      {
        type: "p",
        text: 'Stars lay all around her. Behind her the Citadel burned, but it did not fall. Obsidia came streaking after her, and a voice came along the thin grey cord between them. "You do not understand the true power of destruction. Destruction and faith share the same origin. Both are a way of saying that the present is not enough." "That\'s rather good, actually," said Selena. "You cannot save humanity. They have walked this road many times. They have never once turned aside." "Maybe they\'re just slow." "Perhaps."',
      },
      {
        type: "image",
        name: "two-faces",
        alt: "Close view of Obsidia with pink hair and a gold halo, and Selena with golden hair, face to face in the dark",
        caption: "Official trailer. Two faces, made alike.",
        wide: true,
      },
      {
        type: "p",
        text: "White-gold fire swallowed Obsidia. When it cleared, Selena saw a form she had never seen. It was Obsidia's own Ender form, her true shape. The gown and the gentle face had been only a cloak over something older and less kind. She was tall, silver and violet, like a lily made of knives. From her back spread huge butterfly wings, and in the middle of each wing a black disc turned. Each was a tiny black hole.",
      },
      {
        type: "p",
        text: '"Come back, my puppet." It was said very quietly, with a catch in it, and a faint, dry hope. Scorched and ragged, one arm hanging, Selena raised her blades. "Sorry, ma\'am, but I still prefer life at the Academy!" she said. She charged.',
      },
      { type: "voice", n: 24, why: "Her advice to the overconfident." },
    ],
  },
  {
    id: "after",
    title: "What nobody saw",
    when: "Graduation day, and the dawn after",
    chapters: ["c59", "c60", "c57"],
    blocks: [
      {
        type: "p",
        text: "Nobody on the ground saw how it ended. They saw the Citadel burn. High on its hull a small fire grew into a red-black flower. It burned like a lamp in a window, and it did not fall. They saw a vast white flare at the top of the sky, and a ring of sparks fell like slow, bright rain. Then the net flickered. A hundred thousand people saw it. None of them knew if something had been cut, or had only paused.",
      },
      {
        type: "p",
        text: "They did not see the two figures locked together at the heart of the flare. They did not hear a name spoken very low. They did not see the hands that had been reaching for a throat close instead, slowly, round a wrist. Nobody saw that. There was only the light.",
      },
      {
        type: "p",
        text: "In the small black box at Vexana's hip, the needle Selena had lent her hummed once, thinly, and was still. Vexana did not notice.",
      },
      {
        type: "p",
        text: 'When the light had gone, Karina stood up on the old bell tower, with a pink clip in her hand. She wiped her face with her apron. "Well," she said, to nobody. "She said an hour." She did not go down from the tower. She sat on the roof all night. In the small hours she lit a little tin oil lamp and set it on the ledge of the belfry, where the sky could see it. She thought of the picture book. A girl in red boots carries a lantern through a storm, and on the last page it says: and she always got home. Karina sat beside the lamp and began, out of tune, to sing.',
      },
      {
        type: "p",
        text: "This is where Selena's story stops. The story does not say how her duel with Obsidia ended. It does not say whether the net was cut. It says that a lamp is lit, and that someone is waiting by it.",
      },
      { type: "voice", n: 44, why: "Where her heart is." },
    ],
  },
];
