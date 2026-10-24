/** What the stream studio says around the video. All of it is written for this page. */

export interface ChatLine {
  /** Second of the stream at which the line arrives. */
  t: number;
  user: string;
  /** Hue of the name, 0 to 360. */
  hue: number;
  text: string;
}

/** The chat is a mock: lines are tied to the video's clock, so they arrive as the stream plays. */
export const CHAT: readonly ChatLine[] = [
  { t: 0, user: "lampkeeper", hue: 292, text: "Good evening, everyone." },
  { t: 0, user: "plum_jar", hue: 330, text: "Right on time." },
  { t: 0, user: "quietdesk", hue: 262, text: "Hello from the back row!" },
  { t: 14, user: "nightowl", hue: 210, text: "That is a nice room." },
  { t: 45, user: "doughnut.day", hue: 24, text: "Sending a doughnut to the desk." },
  { t: 90, user: "starfolds", hue: 48, text: "Is that a dartboard behind her?" },
  { t: 150, user: "lampkeeper", hue: 292, text: "What is she reading today?" },
  { t: 230, user: "kettle_song", hue: 160, text: "Her voice is so calm." },
  { t: 340, user: "plum_jar", hue: 330, text: "Round two is about to start." },
  { t: 470, user: "nightowl", hue: 210, text: "The scoreboard is close." },
  { t: 620, user: "quietdesk", hue: 262, text: "I could watch this for hours." },
  { t: 790, user: "doughnut.day", hue: 24, text: "Say hi to Guinevere for us." },
  { t: 940, user: "starfolds", hue: 48, text: "Great shot!" },
  { t: 1100, user: "kettle_song", hue: 160, text: "Thank you for the company." },
  { t: 1250, user: "lampkeeper", hue: 292, text: "Almost the end. That went fast." },
  { t: 1340, user: "plum_jar", hue: 330, text: "Same time next week?" },
];

export interface StreamAlert {
  t: number;
  kicker: string;
  text: string;
}

/** Alerts pop up over the picture for a few seconds, the way a stream would show them. */
export const ALERTS: readonly StreamAlert[] = [
  { t: 8, kicker: "Gift", text: "Guinevere sent a doughnut" },
  { t: 210, kicker: "Follow", text: "Selena is now following" },
  { t: 520, kicker: "Raid", text: "Chang'e arrived with the whole class" },
  { t: 880, kicker: "Gift", text: "A small plant, from a friend" },
  { t: 1180, kicker: "Milestone", text: "Twenty minutes together" },
];

/** How long an alert stays up, in seconds. */
export const ALERT_SECONDS = 4.5;

export interface Scene {
  id: string;
  label: string;
  /** Zoom of the picture and the point it grows from, in percent. */
  scale: number;
  x: number;
  y: number;
}

/** The scene buttons move the camera: the same picture, framed three ways. */
export const SCENES: readonly Scene[] = [
  { id: "full", label: "Full", scale: 1, x: 50, y: 50 },
  { id: "close", label: "Close", scale: 1.5, x: 50, y: 18 },
  { id: "detail", label: "Detail", scale: 1.9, x: 50, y: 70 },
];

export const TAGS = ["late stream", "reading", "darts", "chat"] as const;
