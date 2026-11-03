import s from "./reader.module.css";

/** The line under an insert: the caption in the book's voice, and where the picture is from. */
export function Credit({ caption, credit }: { caption?: string | undefined; credit?: string }) {
  if (!caption && !credit) return null;
  return (
    <figcaption className={s.credit}>
      {caption && <span className={s.creditCaption}>{caption}</span>}
      {credit && <span className={s.creditSource}>{credit}</span>}
    </figcaption>
  );
}
