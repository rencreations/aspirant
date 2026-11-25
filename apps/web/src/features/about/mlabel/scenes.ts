/**
 * The choreography of TheMLabel's content: for each part (`data-scene` in the markup), the poses
 * of its moving elements (`data-k`) along its pass, in screens (see `scrub.ts`). Every part comes
 * in its own way and goes out its own way as it leaves:
 *
 *   system    held on the screen. Lines rise out of their masks, a rule draws across, the three
 *             things each series carries rise one after the other. They lift away, top first.
 *   collect   held on the screen. The scroll counts the skins of a series up to ten on an
 *             odometer, ten ticks fill with it, and at ten the reward line is wiped in.
 *   rewards   a list that scrolls. Each row draws its rule, its name slides in from the left
 *             through its mask and its line rises; leaving, the name runs on out to the right.
 *   hall      held on the screen. A frame comes in from the four corners of the screen and the
 *             four words of the title fly in from the sides (as the letters of the logo did).
 *             Leaving, the frame closes in on the words and they lift away.
 *   story     the heading is held beside a list that scrolls under a spotlight: the item at the
 *             middle of the screen is lit and marked, the others are dim.
 *
 * The times are chosen so that a part that is still on the screen is always whole, and an exit
 * starts only when the part is leaving: a held part goes out as it scrolls away, while the next
 * one comes up under it.
 */
import { drawKeys, EASE, type Key, riseKeys, rollKeys } from "./scrub";

/** What a part's choreography is given. */
interface SceneContext {
  /** The part's box (the tall one, for a part that is held on the screen). */
  readonly root: Element;
  /** Its pass, in screens. */
  readonly span: number;
  /** Its height, in screens. A held part stays on the screen from 1 to this. */
  readonly len: number;
  /** A narrow screen: a phone held upright. */
  readonly narrow: boolean;
}

/** One moving element and its poses. */
export interface Track {
  readonly el: Element;
  readonly keys: readonly Key[];
}

type Scene = (ctx: SceneContext) => Track[];

const all = (root: Element, k: string) => Array.from(root.querySelectorAll(`[data-k="${k}"]`));
const one = (root: Element, k: string) => root.querySelector(`[data-k="${k}"]`);

/**
 * The dim of a list item that is not under the spotlight. Still 3 to 1 against the black for the
 * large type of the list, so a dim item can be read.
 */
export const DIM = 0.42;

/** The kicker of a part: its number and name rise, the rule after them draws across. */
function kicker(root: Element, inAt: number, outAt: number): Track[] {
  const tracks: Track[] = all(root, "kick").map((el, i) => ({
    el,
    keys: riseKeys(inAt + i * 0.05, outAt + i * 0.03, 0.36, 0.3),
  }));
  const rule = one(root, "kick-rule");
  if (rule) tracks.push({ el: rule, keys: drawKeys(inAt + 0.1, outAt + 0.04, 0.5, 0.4) });
  return tracks;
}

/** Lines that rise one after the other and leave in the same order. */
function lines(els: Element[], inAt: number, outAt: number, gap = 0.07): Track[] {
  return els.map((el, i) => ({
    el,
    keys: riseKeys(inAt + i * gap, outAt + i * 0.04, 0.5, 0.34),
  }));
}

/**
 * Where the exits of a held part start: as it lets go of the screen. They run while it scrolls
 * away, so the screen is never left empty while the next part comes up under it.
 */
const outOf = (len: number) => len - 0.06;

const system: Scene = ({ root, len }) => {
  // Everything stands from about 1.75 screens until the part lets go of the screen.
  const out = outOf(len);
  const tracks = [...kicker(root, 0.12, out), ...lines(all(root, "line"), 0.26, out + 0.03)];
  const rule = one(root, "rule");
  if (rule) tracks.push({ el: rule, keys: drawKeys(0.82, out + 0.12, 0.6, 0.45) });
  const carry = one(root, "carry");
  if (carry) tracks.push({ el: carry, keys: riseKeys(0.95, out + 0.16, 0.45, 0.34) });
  const nos = all(root, "own-no");
  all(root, "own").forEach((el, i) => {
    const at = 1.02 + i * 0.13;
    tracks.push({ el, keys: riseKeys(at, out + 0.2 + i * 0.05, 0.48, 0.34) });
    const no = nos[i];
    if (no) tracks.push({ el: no, keys: riseKeys(at + 0.04, out + 0.18 + i * 0.05, 0.36, 0.3) });
  });
  return tracks;
};

/** Where the count runs on the collect part's pass: from none to ten skins. */
const COUNT = { from: 1, to: 2 } as const;

const collect: Scene = ({ root, len }) => {
  const out = outOf(len);
  const tracks = [...kicker(root, 0.12, out), ...lines(all(root, "line"), 0.26, out)];
  const label = one(root, "meter-label");
  if (label) tracks.push({ el: label, keys: riseKeys(0.5, out + 0.06, 0.4, 0.3) });
  const count = one(root, "count");
  if (count) tracks.push({ el: count, keys: riseKeys(0.56, out + 0.1, 0.5, 0.36) });
  const ones = one(root, "ones");
  if (ones) tracks.push({ el: ones, keys: rollKeys(COUNT.from, COUNT.to, 11) });
  const tens = one(root, "tens");
  const step = (COUNT.to - COUNT.from) / 10;
  if (tens) tracks.push({ el: tens, keys: rollKeys(COUNT.to - step, COUNT.to, 2) });
  // A tick fills while its digit rolls in (the last 55% of its step), then leaves to the right.
  all(root, "tick").forEach((el, i) => {
    const at = COUNT.from + step * (i + 0.45);
    tracks.push({
      el,
      keys: [
        [at, { x: -101 }, EASE.out],
        [at + step * 0.55, { x: 0 }],
        [out + 0.12 + i * 0.012, { x: 0 }, EASE.inOut],
        [out + 0.42 + i * 0.012, { x: 101 }],
      ],
    });
  });
  // The reward line is wiped in at ten: its mask comes in from the left while the words inside
  // it go the other way, so the words stand still and the edge sweeps over them.
  const wipe = one(root, "wipe");
  const inner = one(root, "wipe-in");
  const w0 = COUNT.to + 0.02;
  if (wipe) {
    tracks.push({
      el: wipe,
      keys: [
        [w0, { x: -101 }, EASE.inOut],
        [w0 + 0.4, { x: 0 }],
        [out + 0.1, { x: 0 }, EASE.inOut],
        [out + 0.46, { x: 101 }],
      ],
    });
  }
  if (inner) {
    tracks.push({
      el: inner,
      keys: [
        [w0, { x: 101 }, EASE.inOut],
        [w0 + 0.4, { x: 0 }],
        [out + 0.1, { x: 0 }, EASE.inOut],
        [out + 0.46, { x: -101 }],
      ],
    });
  }
  const done = one(root, "done");
  if (done) tracks.push({ el: done, keys: riseKeys(COUNT.to + 0.08, out + 0.08, 0.36, 0.3) });
  return tracks;
};

const rewardsHead: Scene = ({ root, span }) => [
  ...kicker(root, 0.1, span - 0.5),
  ...lines(all(root, "line"), 0.18, span - 0.44),
];

/** A row of the rewards: whole by the time its middle reaches the middle of the screen. */
const reward: Scene = ({ root, span }) => {
  const tracks: Track[] = [];
  const rule = one(root, "rule");
  if (rule) tracks.push({ el: rule, keys: drawKeys(0.08, span - 0.3, 0.42, 0.28) });
  const no = one(root, "no");
  if (no) tracks.push({ el: no, keys: riseKeys(0.14, span - 0.28, 0.3, 0.24) });
  const name = one(root, "name");
  if (name) {
    tracks.push({
      el: name,
      keys: [
        [0.14, { x: -102 }, EASE.out],
        [0.5, { x: 0 }],
        [span - 0.3, { x: 0 }, EASE.in],
        [span - 0.04, { x: 102 }],
      ],
    });
  }
  const say = one(root, "say");
  if (say) tracks.push({ el: say, keys: riseKeys(0.2, span - 0.32, 0.32, 0.26) });
  return tracks;
};

/** The closing rule under the list of rewards. */
const rule: Scene = ({ root, span }) => {
  const el = one(root, "rule");
  return el ? [{ el, keys: drawKeys(0.08, span - 0.3, 0.42, 0.28) }] : [];
};

/** Which way each corner of the hall's frame lies from the middle. */
const CORNERS: Record<string, readonly [number, number]> = {
  tl: [-1, -1],
  tr: [1, -1],
  br: [1, 1],
  bl: [-1, 1],
};

const hall: Scene = ({ root, len, narrow }) => {
  const out = outOf(len);
  const tracks = [...kicker(root, 0.42, out)];
  for (const el of all(root, "corner")) {
    const [dx, dy] = CORNERS[(el as HTMLElement).dataset.corner ?? ""] ?? [0, 0];
    tracks.push({
      el,
      keys: [
        [0.4, { vw: dx * 16, vh: dy * 18, o: 0 }, EASE.out],
        [1.12, { o: 1 }],
        [out, { o: 1 }, EASE.inOut],
        [out + 0.5, { vw: -dx * 5, vh: -dy * 7, o: 0 }],
      ],
    });
  }
  // The words fly in from the sides, the outer ones from further, turned toward the middle.
  const words = all(root, "word");
  const mid = (words.length - 1) / 2;
  words.forEach((el, i) => {
    const side = i < mid ? -1 : 1;
    const far = Math.abs(i - mid) + 0.5;
    const at = 0.58 + Math.abs(i - mid) * 0.05;
    tracks.push({
      el,
      keys: [
        [at, { vw: side * far * (narrow ? 18 : 16), ry: side * -64, s: 1.35, o: 0 }, EASE.out],
        [at + 0.6, { ry: 0, o: 1 }],
        [out + i * 0.03, { ry: 0, o: 1 }, EASE.in],
        [out + 0.36 + i * 0.03, { y: -60, ry: 0, o: 0 }],
      ],
    });
  });
  // The lines under the title leave with it, the lower ones a little earlier, so none is left
  // alone on the screen.
  const own = one(root, "own");
  if (own) tracks.push({ el: own, keys: riseKeys(1.05, out + 0.08, 0.42, 0.3) });
  all(root, "say").forEach((el, i) => {
    tracks.push({ el, keys: riseKeys(1.2 + i * 0.09, out + 0.04 - i * 0.02, 0.42, 0.28) });
  });
  return tracks;
};

/**
 * The story's heading. On a wide screen it is held at the side from about 0.75 of its pass (its
 * sticky top is at a quarter of the screen), so it has all arrived by 0.7.
 */
const storyHead: Scene = ({ root, span }) => [
  ...kicker(root, 0.06, span - 0.5),
  ...lines(all(root, "line"), 0.12, span - 0.46),
  ...all(root, "say").map((el) => ({ el, keys: riseKeys(0.3, span - 0.38, 0.4, 0.3) })),
];

/**
 * An item of the story's list, under the spotlight: lit while its middle is within `LIT` of the
 * middle of the screen, dim further off, and gone as it leaves the top.
 */
const LIT = { hold: 0.035, ramp: 0.1 } as const;

/** How far the lit item steps aside, to make room for its mark. */
const STEP_ASIDE = 30;

const spot: Scene = ({ root, span }) => {
  const mid = span / 2;
  const a = mid - LIT.hold - LIT.ramp;
  const b = mid - LIT.hold;
  const c = mid + LIT.hold;
  const d = mid + LIT.hold + LIT.ramp;
  const tracks: Track[] = [];
  const name = one(root, "spot-name");
  if (name) {
    tracks.push({
      el: name,
      keys: [
        [0.02, { vw: 5, o: 0 }, EASE.out],
        [0.3, { o: DIM }],
        [a, { o: DIM }, EASE.inOut],
        [b, { px: STEP_ASIDE, o: 1 }],
        [c, { px: STEP_ASIDE, o: 1 }, EASE.inOut],
        [d, { o: DIM }],
        [span - 0.24, { o: DIM }, EASE.in],
        [span - 0.04, { y: -40, o: 0 }],
      ],
    });
  }
  // The number stays lit (small type, which must keep its contrast): it only comes and goes.
  const no = one(root, "spot-no");
  if (no) {
    tracks.push({
      el: no,
      keys: [
        [0.04, { y: 60, o: 0 }, EASE.out],
        [0.3, { o: 1 }],
        [span - 0.24, { o: 1 }, EASE.in],
        [span - 0.06, { y: -60, o: 0 }],
      ],
    });
  }
  const mark = one(root, "spot-mark");
  if (mark) {
    tracks.push({
      el: mark,
      keys: [
        [a, { r: 45, s: 0, o: 0 }, EASE.out],
        [b, { r: 45, s: 1, o: 1 }],
        [c, { r: 45, s: 1, o: 1 }, EASE.in],
        [d, { r: 45, s: 0, o: 0 }],
      ],
    });
  }
  return tracks;
};

/** Every part, by its `data-scene`. */
export const SCENES = {
  system,
  collect,
  "rewards-head": rewardsHead,
  reward,
  rule,
  hall,
  "story-head": storyHead,
  spot,
} satisfies Record<string, Scene>;

type SceneName = keyof typeof SCENES;

export const isScene = (name: string | undefined): name is SceneName =>
  name !== undefined && Object.hasOwn(SCENES, name);
