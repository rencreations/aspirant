import type { ShortName } from "../../stage/timeline";

/** One of the three buttons on the left: it plays one of the three shorts. */
export interface Action {
  id: string;
  short: ShortName;
  /** What the button says. */
  label: string;
  /** What it does, for the screen reader. */
  action: string;
  /** Public path of the medallion on the plate (`scripts/vexana/room-assets.py`). */
  icon: string;
}

/**
 * The three actions, in the order of the buttons: Action 1 is the face (`short-1`), Action 2 her
 * left hand (`short-2`) and Action 3 the Guardian at her back (`short-3`). The wording is plain on
 * purpose: a button says what it does.
 */
export const ACTIONS: readonly Action[] = [
  {
    id: "action-1",
    short: "short-1",
    label: "Action 1",
    action: "Play the face animation",
    icon: "/img/vexana/room/btn-action-1.webp",
  },
  {
    id: "action-2",
    short: "short-2",
    label: "Action 2",
    action: "Play the left hand animation",
    icon: "/img/vexana/room/btn-action-2.webp",
  },
  {
    id: "action-3",
    short: "short-3",
    label: "Action 3",
    action: "Play the Guardian animation",
    icon: "/img/vexana/room/btn-action-3.webp",
  },
];
