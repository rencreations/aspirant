import { DRAMA_NODES, DRAMA_START, type DramaNode } from "./drama-graph";

/**
 * The memory of the game, as pure data and a reducer (no React, no storage). What the player has
 * done is kept in two separate places, so starting a new run never takes anything back:
 *
 *  - `unlocked`, `crossed` and `endings` only ever grow: the episodes reached, the answers given
 *    and the endings seen, over every run. The level select draws them.
 *  - `run` is the run that is being played now (where it is, the way it went). "Continue" reads it.
 *
 * The first episode is always playable (it is where every run starts), so it is unlocked from the
 * first visit on.
 */

export const SAVE_KEY = "aspirants:drama:v1";
const SAVE_VERSION = 1;

interface RouteStep {
  /** The episode where the answer was given. */
  from: string;
  /** The index of the answer in the choices of that episode. */
  choice: number;
}

export interface DramaRun {
  /** The episode being played. */
  node: string;
  /** The second of the last dialogue the player reached: "Continue" starts the film there. */
  at: number;
  /** The answers given in this run, in order. */
  route: readonly RouteStep[];
  /** The run reached an ending: "Continue" is greyed out until a new run starts. */
  finished: boolean;
}

export interface DramaSave {
  version: typeof SAVE_VERSION;
  unlocked: readonly string[];
  /** `edgeKey(from, choice)` of every answer given. */
  crossed: readonly string[];
  /** The endings seen (ids of episodes). */
  endings: readonly string[];
  run: DramaRun | null;
}

export type DramaAction =
  /** "Start New": a run from the first episode. Nothing unlocked is lost. */
  | { type: "new" }
  /** "Continue": nothing changes (the run is already in the save); kept so every menu item is an action. */
  | { type: "continue" }
  /** "Play from here" in the level select: a run from an unlocked episode. */
  | { type: "playFrom"; node: string }
  /** A dialogue was reached: remember where. */
  | { type: "advance"; at: number }
  /** An answer was chosen at the end of the episode. */
  | { type: "choose"; index: number }
  /** The ending film has finished. */
  | { type: "finish" }
  /** The player left the run (to the title, or the level select): remember where. */
  | { type: "quit"; at: number };

export const emptySave = (): DramaSave => ({
  version: SAVE_VERSION,
  unlocked: [],
  crossed: [],
  endings: [],
  run: null,
});

const byId = new Map<string, DramaNode>(DRAMA_NODES.map((n) => [n.id, n]));

const hasNode = (id: string): boolean => byId.has(id);

export const edgeKey = (from: string, choice: number): string => `${from}:${String(choice)}`;

const add = (list: readonly string[], item: string): readonly string[] =>
  list.includes(item) ? list : [...list, item];

export function isUnlocked(save: DramaSave, id: string): boolean {
  return id === DRAMA_START || save.unlocked.includes(id);
}

export function isCrossed(save: DramaSave, from: string, choice: number): boolean {
  return save.crossed.includes(edgeKey(from, choice));
}

export function hasSeenEnding(save: DramaSave, id: string): boolean {
  return save.endings.includes(id);
}

/** "Continue" works only for a run that has started and has not reached an ending. */
export function canContinue(save: DramaSave): boolean {
  const run = save.run;
  return run !== null && !run.finished && hasNode(run.node);
}

/** The tags of the answers given in the run, in order, for the recap of an ending and the log. */
export function routeTags(run: DramaRun): ReadonlyArray<{ chapter: number; tag: string }> {
  const out: Array<{ chapter: number; tag: string }> = [];
  for (const step of run.route) {
    const node = byId.get(step.from);
    const choice = node?.choices[step.choice];
    if (node && choice) out.push({ chapter: node.chapter, tag: choice.tag });
  }
  return out;
}

const freshRun = (node: string): DramaRun => ({ node, at: 0, route: [], finished: false });

export function dramaReducer(save: DramaSave, action: DramaAction): DramaSave {
  switch (action.type) {
    case "new":
      return { ...save, run: freshRun(DRAMA_START) };
    case "continue":
      return save;
    case "playFrom": {
      if (!hasNode(action.node) || !isUnlocked(save, action.node)) return save;
      return {
        ...save,
        unlocked: add(save.unlocked, action.node),
        run: freshRun(action.node),
      };
    }
    case "advance":
    case "quit": {
      const run = save.run;
      if (!run || run.finished || !Number.isFinite(action.at) || action.at < 0) return save;
      if (run.at === action.at) return save;
      return { ...save, run: { ...run, at: action.at } };
    }
    case "choose": {
      const run = save.run;
      if (!run || run.finished) return save;
      const node = byId.get(run.node);
      const choice = node?.choices[action.index];
      if (!node || !choice || !hasNode(choice.to)) return save;
      return {
        ...save,
        unlocked: add(save.unlocked, choice.to),
        crossed: add(save.crossed, edgeKey(node.id, action.index)),
        run: {
          node: choice.to,
          at: 0,
          route: [...run.route, { from: node.id, choice: action.index }],
          finished: false,
        },
      };
    }
    case "finish": {
      const run = save.run;
      if (!run || run.finished) return save;
      const node = byId.get(run.node);
      if (!node || node.choices.length > 0) return save;
      return {
        ...save,
        unlocked: add(save.unlocked, node.id),
        endings: add(save.endings, node.id),
        run: { ...run, finished: true },
      };
    }
  }
}

// ---- storage format ----------------------------------------------------------------------------

export function serializeSave(save: DramaSave): string {
  return JSON.stringify(save);
}

const strings = (value: unknown, keep: (s: string) => boolean): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && keep(item) && !out.includes(item)) out.push(item);
  }
  return out;
};

function validEdge(key: string): boolean {
  const [from, index] = key.split(":");
  if (!from || index === undefined) return false;
  const node = byId.get(from);
  const i = Number(index);
  return Boolean(node && Number.isInteger(i) && i >= 0 && i < node.choices.length);
}

function parseRun(value: unknown): DramaRun | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.node !== "string" || !hasNode(r.node)) return null;
  const at = typeof r.at === "number" && Number.isFinite(r.at) && r.at >= 0 ? r.at : 0;
  const route: RouteStep[] = [];
  if (Array.isArray(r.route)) {
    for (const step of r.route) {
      if (!step || typeof step !== "object") continue;
      const s = step as Record<string, unknown>;
      if (
        typeof s.from === "string" &&
        typeof s.choice === "number" &&
        validEdge(edgeKey(s.from, s.choice))
      ) {
        route.push({ from: s.from, choice: s.choice });
      }
    }
  }
  return { node: r.node, at, route, finished: r.finished === true };
}

/**
 * The save from what the storage held. Anything that is not a save of this version (nothing there,
 * broken JSON, another shape) gives an empty one, and what is wrong inside a good one is dropped.
 */
export function parseSave(raw: string | null): DramaSave {
  if (!raw) return emptySave();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return emptySave();
    const d = data as Record<string, unknown>;
    if (d.version !== SAVE_VERSION) return emptySave();
    return {
      version: SAVE_VERSION,
      unlocked: strings(d.unlocked, hasNode),
      crossed: strings(d.crossed, validEdge),
      endings: strings(d.endings, (id) => (byId.get(id)?.choices.length ?? 1) === 0),
      run: parseRun(d.run),
    };
  } catch {
    return emptySave();
  }
}

// ---- the graph ----------------------------------------------------------------------------------

/** What is wrong with a list of episodes (an empty list means it is sound). Used by the tests. */
export function graphProblems(nodes: readonly DramaNode[], start: string): string[] {
  const problems: string[] = [];
  const ids = new Map(nodes.map((n) => [n.id, n]));
  if (ids.size !== nodes.length) problems.push("duplicate ids");
  if (!ids.has(start)) problems.push("no first episode");
  for (const n of nodes) {
    const ending = n.choices.length === 0;
    if (ending && !n.ending) problems.push(`${n.id}: ends with no ending`);
    if (!ending && n.ending) problems.push(`${n.id}: has choices and an ending`);
    if (!ending && n.choices.length !== 2) problems.push(`${n.id}: needs two choices`);
    for (const c of n.choices) {
      const to = ids.get(c.to);
      if (!to) problems.push(`${n.id}: leads to missing ${c.to}`);
      else if (to.chapter <= n.chapter) problems.push(`${n.id}: leads back to ${c.to}`);
    }
  }
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const c of ids.get(id)?.choices ?? []) queue.push(c.to);
  }
  for (const n of nodes) if (!seen.has(n.id)) problems.push(`${n.id}: not reachable`);
  return problems;
}
