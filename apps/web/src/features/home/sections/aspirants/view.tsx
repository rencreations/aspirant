import { THEMLABEL_LOGO } from "@/features/about/media";
import { asset } from "@/lib/asset";

import { ASPIRANTS } from "../../content";
import styles from "../../home.module.css";
import { Pill } from "../../ui";
import { PreviewHost, PreviewTrigger } from "../../preview/preview";
import type { SectionMarkup } from "../../kernel/types";

import local from "./aspirants.module.css";

/**
 * What the server draws for the section: the owner's words and the button, from `content.ts`, and
 * the preview window (it draws nothing until a card of the wall has been pressed). The wall itself
 * is on the canvas. Round three (20 Nov 2026): the title, ONE paragraph (the game's mark, the series
 * line, "A part of", TheMLabel's mark, "as the first featured series.", flowing as one text, anchored
 * left, no break of mine) and the button, in one left aligned column. Each of the three is one element
 * (`data-home-line`) the runtime moves, by a trigger (`words.ts`).
 */
export function view(): SectionMarkup {
  return {
    text: (
      <div className={local.box}>
        <h2
          className={`${styles.title} ${local.line} ${local.title}`}
          data-home-line=""
          data-home-wait=""
        >
          {ASPIRANTS.title}
        </h2>
        <p className={`${local.line} ${local.paragraph}`} data-home-line="" data-home-wait="">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
          <img
            src={asset("/img/home/mlbb.webp")}
            alt={ASPIRANTS.game}
            width={555}
            height={167}
            className={local.logoGame}
          />{" "}
          {ASPIRANTS.line} {ASPIRANTS.partOf}{" "}
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
          <img
            src={asset(THEMLABEL_LOGO)}
            alt={ASPIRANTS.label}
            width={720}
            height={184}
            className={local.logoLabel}
          />{" "}
          {ASPIRANTS.partOfEnd}
        </p>
        <div className={`${styles.actions} ${local.line}`} data-home-line="" data-home-wait="">
          <Pill href={ASPIRANTS.button.href} label="About">
            {ASPIRANTS.button.label}
          </Pill>
        </div>
        <PreviewTrigger className={local.viewArt} />
        <PreviewHost />
      </div>
    ),
  };
}
