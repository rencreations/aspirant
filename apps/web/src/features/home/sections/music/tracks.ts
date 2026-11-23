import type { MusicItem } from "@/features/library/music/types";

import catalog from "../../../../../public/data/library/music.json";
import { pickTracks } from "../../actors/records/covers";

const items = catalog.items as MusicItem[];
export const tracks = pickTracks(items, 10);
export const releases = new Map(items.map((item) => [item.id, item]));
