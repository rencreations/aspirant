/** The levels of the scene: the video's own moments, with the second each one starts at. */
export interface Level {
  name: string;
  /** Second of the video where the level starts. */
  at: number;
  /** The quest, written as a game would. */
  quest: string;
}

export const LEVELS: readonly Level[] = [
  { name: "Arrival", at: 0, quest: "Step off the road and into Selrick Academy." },
  { name: "Doubt", at: 5, quest: "Wonder if this is how someone becomes an Aspirant." },
  { name: "The aces", at: 9.7, quest: "Learn who the school's ace duo is: Guinevere and Vexana." },
  { name: "Legends", at: 16.3, quest: "See why an unbeaten record makes them legends." },
  { name: "The badge", at: 21.8, quest: "Notice the strange badge in her hand." },
  { name: "Watched", at: 28.5, quest: "Feel that someone is watching, and look up." },
  { name: "Dark star", at: 33.8, quest: "Watch a dark star open over the roof." },
];

/** Points for each second played and for each new level reached. */
export const POINTS_PER_SECOND = 10;
export const POINTS_PER_LEVEL = 250;

export interface Achievement {
  id: string;
  title: string;
  text: string;
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  start: { id: "start", title: "Hello, Aspirant", text: "You pressed start." },
  badge: { id: "badge", title: "Sharp eyes", text: "You spotted the badge." },
  clear: { id: "clear", title: "Rooftop reached", text: "You saw the whole scene." },
};

/** Seconds on the "continue?" countdown after the scene ends. */
export const CONTINUE_SECONDS = 9;
