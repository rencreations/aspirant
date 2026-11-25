// The command: builds the three files of this pipeline into the mirror (or `MODELS_OUT`).
//   node scripts/library/models/selena-in-game/build.mjs                 all three
//   node scripts/library/models/selena-in-game/build.mjs in-game phone   some of them
//   --carry=toAbyssal,toNormal   a trial of the carry on those changes (see config.mjs)
// Then run verify.mjs (checks and frame sheets). README.md says what each step does.
import { OUT } from "./lib/env.mjs";
import { FORMS } from "./config.mjs";

const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const forms = structuredClone(FORMS);
if (flag("carry") !== undefined) {
  const on = flag("carry").split(",");
  for (const key of ["toAbyssal", "toNormal"]) forms[key].carry = on.includes(key);
}

const steps = {
  "in-game": async () => (await import("./in-game.mjs")).buildInGame({ forms }),
  phone: async () => (await import("./phone.mjs")).buildPhone(),
  silverbolt: async () => (await import("./silverbolt.mjs")).buildSilverbolt(),
};
const asked = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const run = asked.length ? asked : Object.keys(steps);
for (const name of run) {
  if (!steps[name])
    throw new Error(`unknown step ${name}; known: ${Object.keys(steps).join(", ")}`);
  const report = await steps[name]();
  console.log(`${name}: ${report.file} ${report.bytes.toLocaleString("en")} bytes`);
  if (report.clips)
    for (const c of report.clips)
      console.log(
        c.dropped
          ? `  dropped ${c.source}`
          : `  ${c.id.padEnd(22)} ${c.before.toFixed(4)} s -> ${c.after.toFixed(4)} s  (end to start ${c.endToStart.turn} deg, ${c.endToStart.move} m) ${c.why}`,
      );
  if (report.forms) console.log(JSON.stringify(report.forms));
  if (report.orbs) console.log("orbs", JSON.stringify(report.orbs));
}
console.log(`out: ${OUT}`);
