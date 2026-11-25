// Prints, for every clip of the two sources, when it really stops moving (several tolerances),
// and how far its pose at that time is from its first pose (a loop that closes shows 0).
import { ABYSSAL_GLB, NORMAL_GLB, makeIO } from "../lib/env.mjs";
import { seam, stillTail } from "../lib/clips.mjs";
for (const file of [NORMAL_GLB, ABYSSAL_GLB]) {
  const doc = await makeIO().read(file);
  for (const a of doc.getRoot().listAnimations()) {
    const r = [1e-5, 1e-3].map((e) => stillTail(a, e));
    const s = seam(a, r[0].end);
    const s1 = seam(a, r[0].end - 1 / 30);
    console.log(
      a.getName().replace("selena_silverbolt_raiko_in_game_", "").padEnd(36),
      "start",
      r[0].start.toFixed(4),
      "last",
      r[0].last.toFixed(4),
      "moves until",
      r[0].end.toFixed(4),
      "(1e-3:",
      r[1].end.toFixed(4) + ")",
      "seam at end: turn",
      s.turn.toFixed(2),
      "move",
      s.move.toFixed(4),
      "| a frame earlier",
      s1.turn.toFixed(2),
      s1.move.toFixed(4),
    );
  }
}
