"use client";

import { StarButton } from "@/components/ui/star-button";

import { useReader } from "./reader-context";
import { getUnit, unitLabel } from "./story-data";
import o from "./opening.module.css";

/** "Start reading" and, for a returning reader, "Resume where you left off". */
export function OpeningActions() {
  const { jumpTo, resume } = useReader();
  const unit = resume ? getUnit(resume.chapterId) : undefined;
  return (
    <div className={o.actions}>
      <StarButton pulse size="lg" onClick={() => void jumpTo("part-01", { smooth: true })}>
        Start reading
      </StarButton>
      {resume && unit && (
        <StarButton
          variant="ghost"
          arrow
          onClick={() => void jumpTo(resume.paragraphId ?? resume.chapterId)}
          aria-label={`Resume where you left off: ${unitLabel(unit)}, ${unit.title}`}
        >
          Resume where you left off
        </StarButton>
      )}
    </div>
  );
}
