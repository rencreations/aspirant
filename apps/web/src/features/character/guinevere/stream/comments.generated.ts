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
  { t: 99.55, speed: 0.24, lane: 0.0963, text: "Guinevere, you're so cute!" },
  { t: 102.34, speed: 0.2102, lane: 0.1611, text: "Love at first sight" },
  { t: 102.88, speed: 0.1806, lane: 0.0574, text: "Adorable" },
  { t: 104.27, speed: 0.214, lane: 0.1963, text: "My only fave" },
  { t: 107.24, speed: 0.2036, lane: 0.1389, text: "Marry me!" },
  { t: 430.97, speed: 0.2507, lane: 0.1333, text: "Check out the photo! 😍😍" },
  { t: 467.17, speed: 0.2561, lane: 0.0991, text: "Take a peek at the wardrobe!" },
  { t: 470.05, speed: 0.2556, lane: 0.1593, text: "Let's see something new! 🧐" },
  { t: 471.31, speed: 0.2508, lane: 0.0481, text: "Time to explore the wardrobe!" },
  { t: 499.16, speed: 0.1933, lane: 0.1, text: "I don't want to study." },
  { t: 502.31, speed: 0.2086, lane: 0.1593, text: "No. 😪" },
  { t: 503.67, speed: 0.2178, lane: 0.2157, text: "NO, NO, NO" },
  { t: 562.61, speed: 0.2758, lane: 0.137, text: "I definitely don't want to study!" },
  { t: 563.26, speed: 0.2678, lane: 0.0472, text: "I'm too tired to study." },
  { t: 564.19, speed: 0.2696, lane: 0.1889, text: "Too lazy to move. 😩😩" },
  { t: 578.98, speed: 0.284, lane: 0.0981, text: "Guinevere only knows how to fight and kill." },
  { t: 579.78, speed: 0.2291, lane: 0.188, text: "😂 Not cute at all!" },
  { t: 581.14, speed: 0.2586, lane: 0.0472, text: "Guinevere is always fighting." },
  { t: 582.69, speed: 0.2414, lane: 0.1463, text: "Not cute anymore." },
  { t: 752.31, speed: 0.2692, lane: 0.0981, text: "I get nervous whenever I talk to cute girls!" },
  { t: 754.04, speed: 0.2487, lane: 0.0426, text: "Guinevere, what should I do? 😂" },
  { t: 755.02, speed: 0.2554, lane: 0.188, text: "Me too, I'm so shy." },
  { t: 778.88, speed: 0.2215, lane: 0.1009, text: "I always lose ranked matches." },
  { t: 779.28, speed: 0.2224, lane: 0.162, text: "Keep losing nonstop" },
  { t: 781.15, speed: 0.2714, lane: 0.2167, text: "Me too... Lose every time I play ranked." },
  { t: 813.43, speed: 0.2265, lane: 0.0963, text: "What to do with bad teammates?" },
  {
    t: 814.27,
    speed: 0.2697,
    lane: 0.1907,
    text: "Always bad teammates, that's why I lose.... 😂",
  },
  { t: 815.17, speed: 0.251, lane: 0.1444, text: "Teammates are too bad, I lose." },
  { t: 832.41, speed: 0.2492, lane: 0.0611, text: "Could be I'm too bad myself, I lose." },
  { t: 833.4, speed: 0.272, lane: 0.2019, text: "What to do if I suck?" },
  { t: 834.39, speed: 0.2765, lane: 0.1556, text: "7 straight losses here." },
  { t: 873.78, speed: 0.2235, lane: 0.0991, text: "Friends suck sometimes." },
  { t: 875.57, speed: 0.2632, lane: 0.1611, text: "Sucks so much... 🙄" },
  { t: 876.96, speed: 0.2895, lane: 0.2176, text: "True, hate to say it... 😂😂" },
  { t: 917.19, speed: 0.2405, lane: 0.0602, text: "Teammates ignore calls... 🙄" },
  { t: 917.44, speed: 0.2882, lane: 0.2019, text: "Can't talk at all..." },
  { t: 919.13, speed: 0.3355, lane: 0.1537, text: "Plus bad calls~~" },
  { t: 956.44, speed: 0.2508, lane: 0.0611, text: "How to play games with my crush?" },
  { t: 957.9, speed: 0.2403, lane: 0.1287, text: "Wanna ask my crush to join the game" },
  { t: 989.71, speed: 0.2278, lane: 0.1009, text: "Last time lost streak, argued with my friend" },
  { t: 992.24, speed: 0.2523, lane: 0.2176, text: "Losing streak kills the mood... 😂😂" },
];
