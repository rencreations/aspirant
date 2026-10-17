import type { Mood, PartNumber } from "../contract";
import { useExperience } from "../contract";
import { PARTS, sceneAt, type AmbientKey, type SceneKey } from "./parts";

/**
 * The live position of the reader, mirrored out of `useExperience` into one mutable object that
 * frame loops read without React renders. `ScenesLayer` keeps it in sync (see `syncDriver`).
 */
export interface SceneDriver {
  part: PartNumber | null;
  chapterId: string | null;
  paragraphId: string | null;
  scene: SceneKey;
  mood: Mood;
  ambient: AmbientKey;
  still: string;
  chapterProgress: number;
  storyProgress: number;
  /** Local envelope of the last `beat`: 1 when a key line lands, decays in the frame loop. */
  beat: number;
  /** How many beats have landed (a counter, because the store's `beat` is reset to 0). */
  beats: number;
  /** Seconds since the scene key last changed. */
  sceneSince: number;
}

export const driver: SceneDriver = {
  part: null,
  chapterId: null,
  paragraphId: null,
  scene: PARTS[1].scene,
  mood: PARTS[1].mood,
  ambient: PARTS[1].ambient,
  still: PARTS[1].stills[0] ?? "",
  chapterProgress: 0,
  storyProgress: 0,
  beat: 0,
  beats: 0,
  sceneSince: 0,
};

type Listener = (d: SceneDriver) => void;
const sceneListeners = new Set<Listener>();
const beatListeners = new Set<Listener>();

/** Called when the scene key, mood or still changes (not on progress). Returns unsubscribe. */
export function onSceneChange(listener: Listener): () => void {
  sceneListeners.add(listener);
  return () => sceneListeners.delete(listener);
}

/** Called when a beat lands. Returns unsubscribe. */
export function onBeat(listener: Listener): () => void {
  beatListeners.add(listener);
  return () => beatListeners.delete(listener);
}

/**
 * Mirror the store into the driver and keep it mirrored. `pulse()` in the contract sets `beat`
 * to 1 and never lowers it, so this resets it to 0 after reading it (that is how a second
 * pulse can be seen). Returns unsubscribe.
 */
export function syncDriver(): () => void {
  const apply = (s: ReturnType<typeof useExperience.getState>) => {
    driver.chapterProgress = s.chapterProgress;
    driver.storyProgress = s.storyProgress;
    const placeChanged =
      s.partNumber !== driver.part ||
      s.chapterId !== driver.chapterId ||
      s.paragraphId !== driver.paragraphId;
    if (placeChanged) {
      driver.part = s.partNumber;
      driver.chapterId = s.chapterId;
      driver.paragraphId = s.paragraphId;
      if (s.partNumber !== null) {
        const next = sceneAt(s.chapterId, s.paragraphId, s.partNumber);
        const changed =
          next.scene !== driver.scene ||
          next.mood !== driver.mood ||
          next.still !== driver.still ||
          next.ambient !== driver.ambient;
        if (next.scene !== driver.scene) driver.sceneSince = 0;
        driver.scene = next.scene;
        driver.mood = next.mood;
        driver.still = next.still;
        driver.ambient = next.ambient;
        if (changed) for (const l of sceneListeners) l(driver);
      } else {
        for (const l of sceneListeners) l(driver);
      }
    }
    if (s.beat >= 1) {
      driver.beat = 1;
      driver.beats += 1;
      for (const l of beatListeners) l(driver);
      // Reset so the next pulse() is a change again.
      queueMicrotask(() => useExperience.setState({ beat: 0 }));
    }
  };
  apply(useExperience.getState());
  return useExperience.subscribe(apply);
}
