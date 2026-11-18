import type { DuoActor } from "../../actors/duo";
import { comicMark } from "../../actors/duo/marks-map";
import type { MarksActor } from "../../fx/comic-marks";

/**
 * Hand the duo's comic cues (hearts, sparks, question marks) to the home's marks. The duo asks in
 * its own words and `comicMark` says which mark each is. It is the same few lines for every
 * section that shows the pair, so voices and music share this one (setting it twice is harmless).
 */
export function bridgeDuoMarks(duo: DuoActor, marks: MarksActor): void {
  duo.setMarkSink((m) => {
    const mark = comicMark(m);
    marks.emit(mark.kind, {
      at: { x: m.x, y: m.y },
      size: mark.size,
      color: mark.color,
      rotation: mark.rotation,
    });
  });
}
