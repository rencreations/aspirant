/**
 * The narrator's key lines: the short paragraphs where the story turns, set very large and
 * revealed word by word as they reach the reading line. Each entry names a whole paragraph of
 * the story JSON by id, with optional words to set in the accent colour.
 *
 * Also the held beats: one line per Part, shown on a full-viewport pause card at the end of
 * that Part. Each is quoted from the story (`from` names the paragraph) or is our own closing
 * line "The lamp is on." (`from: null`).
 *
 * Every line here is the story's own text. The unit tests check that each id exists, that each
 * emphasis occurs in its paragraph, and that each held beat is quoted exactly.
 */
export interface KeyLine {
  /** Paragraph id, for example `c01-p018`. */
  readonly id: string;
  /** Exact substrings of the paragraph to set in the accent colour. */
  readonly emphasis?: readonly string[];
}

export interface HeldBeat {
  /** Part number, 1 to 12. */
  readonly part: number;
  /** The line shown on the pause card. */
  readonly text: string;
  /** Paragraph id the line is quoted from, or null for our own closing line. */
  readonly from: string | null;
}

/** In book order. */
export const KEY_LINES: readonly KeyLine[] = [
  // c01 The Student Who Was Always First
  { id: "c01-p018", emphasis: ["All the little lights"] },
  { id: "c01-p041", emphasis: ["plan a war"] },
  // c02 The Transfer Student
  { id: "c02-p004", emphasis: ["freely"] },
  { id: "c02-p028", emphasis: ["She's alone"] },
  { id: "c02-p049", emphasis: ["my rival"] },
  // c03 Two Stars, One Sky
  { id: "c03-p014", emphasis: ["She's the same."] },
  { id: "c03-p042", emphasis: ["That's my friend."] },
  { id: "c03-p055", emphasis: ["It would be fun"] },
  // i-far-above-1 Far Above
  { id: "i-far-above-1-p004", emphasis: ["How loud they are"] },
  // c04 The Daughter of Gold
  { id: "c04-p002", emphasis: ["a position"] },
  { id: "c04-p017", emphasis: ["Somebody who doesn't have to."] },
  { id: "c04-p029" },
  // c05 The Girl Who Hid
  { id: "c05-p018", emphasis: ["I've got you."] },
  { id: "c05-p039", emphasis: ["allowed to break"] },
  { id: "c05-p053", emphasis: ["I'll only watch"] },
  // c06 You Are Strong
  { id: "c06-p017", emphasis: ["You are strong"] },
  { id: "c06-p022", emphasis: ["Me."] },
  { id: "c06-p058" },
  // c07 The Chapel
  { id: "c07-p012" },
  { id: "c07-p031", emphasis: ["I'm happy"] },
  { id: "c07-p042", emphasis: ["With you."] },
  // c08 Best Partners
  { id: "c08-p009", emphasis: ["Good morning."] },
  { id: "c08-p032", emphasis: ["She's laughing."] },
  // c09 Like Fireworks
  { id: "c09-p016", emphasis: ["eleven times"] },
  { id: "c09-p024", emphasis: ["For as long as we've got."] },
  // c10 The Emblem of Hope
  { id: "c10-p011", emphasis: ["you don't stop"] },
  { id: "c10-p046", emphasis: ["I'm here."] },
  { id: "c10-p057", emphasis: ["enough"] },
  // c11 A Peaceful World
  { id: "c11-p008" },
  { id: "c11-p035", emphasis: ["978"] },
  // c12 Year 978
  { id: "c12-p014", emphasis: ["That is enough recalibration"] },
  { id: "c12-p039", emphasis: ["a very long road"] },
  // c13 The Name of the Monsters
  { id: "c13-p004", emphasis: ["a warning"] },
  { id: "c13-p010", emphasis: ["taken back from the dark"] },
  // c14 The Girl Who Learned to Aim
  { id: "c14-p009", emphasis: ["since the ninth"] },
  { id: "c14-p023", emphasis: ["Deadeye."] },
  // c15 The Child of the Laboratory
  { id: "c15-p017", emphasis: ["my moon"] },
  { id: "c15-p023", emphasis: ["like a lantern"] },
  // c16 Sis
  { id: "c16-p001" },
  { id: "c16-p018", emphasis: ["I don't mind."] },
  // c17 The Smallest Party in the World
  { id: "c17-p006", emphasis: ["You build it."] },
  { id: "c17-p032", emphasis: ["They will not look for long."] },
  // c18 Silence
  { id: "c18-p033" },
  { id: "c18-p040", emphasis: ["That is enough recalibration"] },
  // c19 Go Away
  { id: "c19-p008" },
  { id: "c19-p027", emphasis: ["It was not true."] },
  // c20 The Years of Ash
  { id: "c20-p015", emphasis: ["Aspirant power"] },
  { id: "c20-p024", emphasis: ["the only true thing"] },
  // c21 The Return
  { id: "c21-p027", emphasis: ["I've got you"] },
  { id: "c21-p037", emphasis: ["lit"] },
  { id: "c21-p048", emphasis: ["like a song"] },
  // c22 On the Ruins
  { id: "c22-p006", emphasis: ["With a friend"] },
  { id: "c22-p015" },
  // c23 Silverbolt
  { id: "c23-p015", emphasis: ["did not have to pretend"] },
  { id: "c23-p048", emphasis: ["the wrong way"] },
  { id: "c23-p055", emphasis: ["I trust you."] },
  // c24 The Orb
  { id: "c24-p011", emphasis: ["the Cycle"] },
  { id: "c24-p020" },
  // c25 The First Awakening
  { id: "c25-p002", emphasis: ["Obsidia saw the windows."] },
  { id: "c25-p034", emphasis: ["when you break"] },
  // c26 Likeness
  { id: "c26-p018", emphasis: ["before I asked"] },
  { id: "c26-p038", emphasis: ["in the rain"] },
  // c27 The Seed in the Rain
  { id: "c27-p011", emphasis: ["She opened her arms."] },
  { id: "c27-p034" },
  { id: "c27-p047", emphasis: ["I choose."] },
  // c28 The Quiet Mission
  { id: "c28-p018", emphasis: ["tired of being left"] },
  { id: "c28-p033", emphasis: ["nineteen hours"] },
  // c29 Inside the Institute
  { id: "c29-p033", emphasis: ["She cut."] },
  { id: "c29-p044", emphasis: ["Home."] },
  // c30 Team B3
  { id: "c30-p008" },
  { id: "c30-p023", emphasis: ["I'm sorry."] },
  // c31 Alert
  { id: "c31-p016", emphasis: ["our time to shine"] },
  { id: "c31-p034", emphasis: ["It is not."] },
  // c32 Cover Me
  { id: "c32-p017", emphasis: ["two-person plan"] },
  { id: "c32-p031", emphasis: ["We synergise"] },
  // c33 The Planet of Gold
  { id: "c33-p001", emphasis: ["ordered to"] },
  { id: "c33-p008", emphasis: ["friends"] },
  // c34 The Veil of Counsel
  { id: "c34-p005", emphasis: ["both eyes open"] },
  // c35 A Friend Under the Sun
  { id: "c35-p010", emphasis: ["Does it hurt?"] },
  { id: "c35-p041", emphasis: ["it does not pretend"] },
  // c36 The Cleansing of Oro
  { id: "c36-p009", emphasis: ["holds you"] },
  { id: "c36-p017" },
  // c37 The Leash
  { id: "c37-p013", emphasis: ["where I cannot follow"] },
  { id: "c37-p023", emphasis: ["Does it hurt?"] },
  // c38 The Trojan
  { id: "c38-p026", emphasis: ["Does it hurt?"] },
  { id: "c38-p031", emphasis: ["take turns"] },
  // c39 Beginning!
  { id: "c39-p022", emphasis: ["I choose."] },
  { id: "c39-p043", emphasis: ["a report"] },
  // c40 The Weak Spot
  { id: "c40-p006", emphasis: ["She's asking"] },
  { id: "c40-p027", emphasis: ["since the very beginning"] },
  // c41 The Harbour Front
  { id: "c41-p008", emphasis: ["I've got a partner!"] },
  { id: "c41-p014", emphasis: ["Stay with me"] },
  // c42 What Hurt Means
  { id: "c42-p014", emphasis: ["Does it hurt?"] },
  { id: "c42-p023", emphasis: ["That is enough recalibration."] },
  { id: "c42-p027", emphasis: ["Always"] },
  // i-far-above-2 Far Above
  { id: "i-far-above-2-p009", emphasis: ["A single tear"] },
  // c43 Newcomers
  { id: "c43-p006", emphasis: ["She's a girl!"] },
  { id: "c43-p029", emphasis: ["Stop saying sorry!"] },
  // c44 Badges of Honour
  { id: "c44-p019", emphasis: ["somebody saw"] },
  { id: "c44-p040", emphasis: ["It would not last."] },
  // c45 The Horizon
  { id: "c45-p027", emphasis: ["That's all anyone can do."] },
  { id: "c45-p029", emphasis: ["a sky like it"] },
  // c46 Names
  { id: "c46-p001", emphasis: ["we stayed"] },
  // c47 The Corridor
  { id: "c47-p028", emphasis: ["Not her."] },
  { id: "c47-p041", emphasis: ["Be brave."] },
  // c48 The Edge of the Void
  { id: "c48-p007", emphasis: ["it was enough"] },
  { id: "c48-p018", emphasis: ["And it's wrong."] },
  { id: "c48-p040", emphasis: ["I will lie."] },
  // c49 Where Vexana Was Not
  { id: "c49-p040", emphasis: ["I'm here too"] },
  { id: "c49-p042", emphasis: ["She's lit."] },
  // c50 Twilight Star
  { id: "c50-p008" },
  { id: "c50-p018", emphasis: ["green"] },
  { id: "c50-p039", emphasis: ["another pawn"] },
  // c51 A Different Ending
  { id: "c51-p034" },
  { id: "c51-p055", emphasis: ["a flaw"] },
  { id: "c51-p058", emphasis: ["a different one"] },
  // c52 Graduation Season
  { id: "c52-p028", emphasis: ["always mine"] },
  { id: "c52-p036", emphasis: ["the only one"] },
  { id: "c52-p053", emphasis: ["I pulled your blanket up once."] },
  // c53 The Matrix Transmits
  { id: "c53-p002", emphasis: ["weighed"] },
  { id: "c53-p055", emphasis: ["I'm going to stop you."] },
  { id: "c53-p075", emphasis: ["stubborn fool"] },
  // c54 Terrinia Stands
  { id: "c54-p012", emphasis: ["proud"] },
  { id: "c54-p041", emphasis: ["I'm flying"] },
  // c55 The Emblem Flashes
  { id: "c55-p013" },
  { id: "c55-p016", emphasis: ["got up again"] },
  // c56 Why, Vexana?
  { id: "c56-p022", emphasis: ["alone"] },
  { id: "c56-p026", emphasis: ["to live"] },
  // c57 Twin Streams of Light
  { id: "c57-p010", emphasis: ["colour"] },
  { id: "c57-p029" },
  // c58 The Bell Tower
  { id: "c58-p033", emphasis: ["It's you."] },
  { id: "c58-p038", emphasis: ["the scenic route"] },
  // c59 Even on the Path to Destruction
  { id: "c59-p004", emphasis: ["the real me"] },
  { id: "c59-p022", emphasis: ["It's red."] },
  { id: "c59-p046" },
  // c60 Dawn
  { id: "c60-p005" },
  { id: "c60-p024", emphasis: ["I'M HERE!"] },
  { id: "c60-p053", emphasis: ["It's everything."] },
];

export const HELD_BEATS: readonly HeldBeat[] = [
  { part: 1, text: "She had almost smiled.", from: "i-far-above-1-p005" },
  { part: 2, text: "It was the last time for a while.", from: "c10-p060" },
  { part: 3, text: "She stays.", from: "c17-p029" },
  { part: 4, text: "It tasted of hope.", from: "c22-p040" },
  { part: 5, text: "Someone's always waiting.", from: "c23-p047" },
  { part: 6, text: "Nothing came out of it. That was the worst part.", from: "c32-p034" },
  { part: 7, text: "She felt like a bird in the wind.", from: "c38-p032" },
  { part: 8, text: "It was only the first morning of the longest day.", from: "c42-p064" },
  {
    part: 9,
    text: "Five girls sat shoulder to shoulder on the iron, and watched the dawn.",
    from: "c46-p014",
  },
  { part: 10, text: "Hello, Vexana. I'm still here.", from: "c50-p052" },
  { part: 11, text: "Not yet, thought Selena. I want to see how it ends.", from: "c53-p082" },
  { part: 12, text: "The lamp is on.", from: null },
];
