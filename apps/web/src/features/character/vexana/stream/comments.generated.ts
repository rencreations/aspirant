// Made by scripts/vexana/comments.py (emit). Do not edit by hand.
// The viewer comments that fly across the top of the picture of the livestream replay.

export interface StreamComment {
  /** Second of the video when its first letter enters at the right edge of the picture. */
  t: number;
  /** Speed across the picture, in picture widths per second. */
  speed: number;
  /** Height of its lane, as a fraction of the picture height (the middle of the text). */
  lane: number;
  text: string;
}

export const STREAM_COMMENTS: readonly StreamComment[] = [
  { t: 158.9, speed: 0.2347, lane: 0.1602, text: "What?" },
  { t: 159.85, speed: 0.251, lane: 0.0556, text: "Don't get it. 🤔🤔🤔" },
  { t: 161.09, speed: 0.2618, lane: 0.1167, text: "Why not talk about daily life instead?" },
  { t: 447.63, speed: 0.2796, lane: 0.1685, text: "Task done." },
  { t: 448.83, speed: 0.2724, lane: 0.2204, text: "Nailed it!" },
  { t: 449.73, speed: 0.2911, lane: 0.0676, text: "Super easy, done!" },
  { t: 450.97, speed: 0.2493, lane: 0.1306, text: "Easy!" },
  { t: 523.27, speed: 0.2418, lane: 0.2194, text: "Brutal!" },
  { t: 524.5, speed: 0.2668, lane: 0.1259, text: "Master, stop chanting!" },
  { t: 526.25, speed: 0.2706, lane: 0.1981, text: "Is this modern torture?" },
  { t: 529.53, speed: 0.2862, lane: 0.1426, text: "Please stop nagging! 😂😂" },
  { t: 530.67, speed: 0.2564, lane: 0.0731, text: "OMG!" },
  { t: 578.89, speed: 0.2796, lane: 0.0815, text: "Finished." },
  { t: 580.53, speed: 0.2564, lane: 0.125, text: "OK!" },
  { t: 581.96, speed: 0.2898, lane: 0.0602, text: "Savage" },
  { t: 583.36, speed: 0.2753, lane: 0.2, text: "Easy peasy." },
  { t: 623.93, speed: 0.2658, lane: 0.0824, text: "No." },
  { t: 625.21, speed: 0.2444, lane: 0.125, text: "All Skills!" },
  { t: 627.04, speed: 0.2564, lane: 0.2, text: "Got lucky." },
  { t: 748.96, speed: 0.2873, lane: 0.1926, text: "Done" },
  { t: 749.82, speed: 0.2906, lane: 0.0676, text: "Got it finished." },
  { t: 751.06, speed: 0.2679, lane: 0.1296, text: "Easy" },
  {
    t: 830.21,
    speed: 0.1699,
    lane: 0.1593,
    text: "Vexana, you'd better watch out after your stream.",
  },
  { t: 867.39, speed: 0.2408, lane: 0.1889, text: "Just imitation 🙄" },
  { t: 868.88, speed: 0.2567, lane: 0.1139, text: "it can't be real！！" },
  { t: 929.7, speed: 0.2549, lane: 0.25, text: "Task done." },
  { t: 930.43, speed: 0.2628, lane: 0.125, text: "All set with the task!!" },
  { t: 931.24, speed: 0.2643, lane: 0.1981, text: "Super easy!" },
  { t: 1013.86, speed: 0.2064, lane: 0.1056, text: "This isn't enough! 😂" },
  { t: 1016.08, speed: 0.2178, lane: 0.1907, text: "Sway more as you walk 😍😍" },
  { t: 1017.98, speed: 0.2059, lane: 0.1509, text: "then turn and give a wink！！" },
  { t: 1111.03, speed: 0.2656, lane: 0.1019, text: "Uh.." },
  { t: 1113.5, speed: 0.265, lane: 0.1861, text: "Um um.. 😂😂" },
  { t: 1115.75, speed: 0.2882, lane: 0.1472, text: "So embarrassing.. I can’t do it..." },
  { t: 1179.33, speed: 0.2826, lane: 0.1704, text: "Make your confession in a cutesy voice" },
  { t: 1180.63, speed: 0.2831, lane: 0.0694, text: "Show us your cute moves!" },
  { t: 1181.09, speed: 0.3021, lane: 0.1259, text: "Haha, love to see cute moves! 😍😍" },
  { t: 1228.13, speed: 0.297, lane: 0.2139, text: "So cute! 😍😍" },
  { t: 1229.29, speed: 0.2934, lane: 0.0741, text: "Adorable!" },
  { t: 1230.16, speed: 0.2956, lane: 0.1861, text: "Super adorable! 🩷" },
  { t: 1232.42, speed: 0.3227, lane: 0.1472, text: "But not enough cutesy behavior! 🙄🙄" },
];
