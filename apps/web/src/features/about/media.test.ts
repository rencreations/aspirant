import { describe, expect, it } from "vitest";

import {
  DOLL_MODEL_BYTES as HOME_DOLL_BYTES,
  DOLL_MODEL_PATH,
} from "@/features/home/actors/doll/preload";

import { DOLL_MODEL, DOLL_MODEL_BYTES } from "./media";

describe("the About page's files", () => {
  it("names the home's doll as the home does", () => {
    expect(DOLL_MODEL).toBe(DOLL_MODEL_PATH);
    expect(DOLL_MODEL_BYTES).toBe(HOME_DOLL_BYTES);
  });
});
