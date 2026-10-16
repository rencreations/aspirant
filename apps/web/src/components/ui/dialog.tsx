"use client";

import type { ComponentProps } from "react";

import {
  DialogContent as BaseContent,
  DialogDescription as BaseDescription,
  DialogTitle as BaseTitle,
} from "@aspirant/ui/components/dialog";
import { cn } from "@aspirant/ui/lib/utils";

import styles from "./dialog.module.css";

export { Dialog, DialogClose, DialogTrigger } from "@aspirant/ui/components/dialog";

/**
 * Dialog panel with terminal styling (chamfered hairline border, panel fill). Focus trap,
 * Esc and focus return come from Radix.
 *
 * <Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogTitle>Notes</DialogTitle>...</DialogContent></Dialog>
 */
export function DialogContent({ className, ...props }: ComponentProps<typeof BaseContent>) {
  return <BaseContent className={cn(styles.content, className)} {...props} />;
}

/** Dialog heading: mono, upper case, tracked. */
export function DialogTitle({ className, ...props }: ComponentProps<typeof BaseTitle>) {
  return <BaseTitle className={cn(styles.title, className)} {...props} />;
}

/** Dialog description in the dimmed body colour. */
export function DialogDescription({ className, ...props }: ComponentProps<typeof BaseDescription>) {
  return <BaseDescription className={cn(styles.description, className)} {...props} />;
}
