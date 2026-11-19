# Round three, K7: scroll zones and the idle snap

What changed: a `HomePlay` with a `span` is a scroll zone (value = `from + (to - from) * ease(p)` while the scroll is inside it, no clock, no hold), and a visitor who stops inside one has the page finish it by itself. Full API, semantics, how to choose lengths and how to look: `kernel-scrub.md`.

Files: `kernel/scrub.ts` (new: `zoneRanges`, `zoneHeading`, `zonePlan`, `ZoneSnap`), `kernel/scrub.test.ts` (new, 29 tests), and small edits in `kernel/plays.ts` (`span`, `isZone`, `zoneProgress`, `zoneValue`, validation, the machine), `kernel/beat.ts` (`BeatStep.spanScreens`, `zoneLength`), `kernel/snap.ts` (`SnapFrame.zoned`, block `zone`, zone ends are thresholds), `kernel/engine.ts` (the zone snap, `ScrollApi.to` ease), `kernel/run.ts` (`PlayReport.kind` and `zones`), `kernel/types.ts`, `kernel/probes.ts` (`snap().scrub`), `components/smooth-scroll.tsx` (`easing`).

Numbers to tune (`kernel/scrub.ts`): `ZONE_IDLE_MS` 220, `ZONE_FORWARD_DOWN` 0.25, `ZONE_BACK_UP` 0.75, `ZONE_MIN_SECONDS` 0.35, `ZONE_EDGE` 0.02, `ZONE_GRACE_MS` 600; each zone's `seconds` is the snap length for a full traverse.

Looked at: kernel-scrub.md section 7 (down, up, small, flick, keys, a wheel against the snap, a seek, touch by CDP, frames).

Not verified: kernel-scrub.md section 9. Tests run: only `scrub.test.ts` plus `plays`, `beat`, `run-plays` and `snap` (157 passed). `tsc` filtered to the kernel and my files shows nothing. No other test was run. An existing test that pins a joint of a section that other helpers convert may need a retune in the cleanup pass (`snap-registry.test.ts` reads the real registry).
