/**
 * The server markup of every section, by id. Kept apart from the registry (`kernel/sections.ts`)
 * so the scene code, which is client only, never pulls the views and the views never pull the scene.
 */
import { view as archive } from "./sections/archive/view";
import { view as aspirants } from "./sections/aspirants/view";
import { view as bend } from "./sections/bend/view";
import { view as chase } from "./sections/chase/view";
import { view as descent } from "./sections/descent/view";
import { view as footer } from "./sections/footer/view";
import { view as funny } from "./sections/funny/view";
import { view as hero } from "./sections/hero/view";
import { view as list } from "./sections/list/view";
import { view as music } from "./sections/music/view";
import { view as rows } from "./sections/rows/view";
import { view as selena } from "./sections/selena/view";
import { view as strip } from "./sections/strip/view";
import { view as voices } from "./sections/voices/view";
import type { SectionId, SectionMarkup } from "./kernel/types";

export const VIEWS: Readonly<Record<SectionId, () => SectionMarkup>> = {
  hero,
  aspirants,
  rows,
  strip,
  descent,
  list,
  selena,
  voices,
  music,
  funny,
  chase,
  bend,
  archive,
  footer,
};
