import { OPERATOR } from "@/lib/legal";

/**
 * The takedown message. The site has no server, so the page writes the message and the visitor's
 * own email app (or webmail) sends it. Nothing is sent from the page, and the message holds no
 * email address or phone number of the sender: the mail they send from carries the address we
 * reply to.
 */

export type Role = "owner" | "agent" | "person" | "other";

export const ROLES: ReadonlyArray<{ id: Role; label: string }> = [
  { id: "owner", label: "I own the rights" },
  { id: "agent", label: "I act for the owner" },
  { id: "person", label: "I am shown in it" },
  { id: "other", label: "Something else" },
];

export interface TakedownForm {
  name: string;
  role: Role;
  /** What to take down: a title, an ID and the address of the page, one item to a line. */
  items: string;
  /** Why, and how the sender knows. */
  statement: string;
}

/** A long address list or story is cut by some email apps. Past this, the page says to copy the message instead. */
export const MAILTO_SAFE_LENGTH = 1900;

const GOOD_FAITH =
  "I state in good faith that the use described above is not authorised by the rights holder, its agent or the law, and that the information in this notice is accurate.";

/** The sentence that goes with the role. */
function declaration(role: Role): string {
  switch (role) {
    case "owner":
      return `${GOOD_FAITH} I am the owner of the rights, or of an exclusive right that is said to be infringed.`;
    case "agent":
      return `${GOOD_FAITH} I am authorised to act for the owner of the rights.`;
    case "person":
      return "I am the person shown in the item above and I ask for it to be removed.";
    case "other":
      return "I believe the item above should not be shown, for the reason given.";
  }
}

export function subjectFor(form: TakedownForm): string {
  const first = form.items.split("\n")[0]?.trim() ?? "";
  const short = first.length > 70 ? `${first.slice(0, 67)}...` : first;
  return short ? `Takedown request: ${short}` : "Takedown request";
}

/** The message as plain text. `today` is a date like 2026-11-12. */
export function buildBody(form: TakedownForm, today: string): string {
  const name = form.name.trim();
  const role = ROLES.find((r) => r.id === form.role)?.label ?? "";
  return [
    "Takedown request for aspirant.cc",
    "",
    "What to take down:",
    form.items.trim(),
    "",
    `From: ${name}${role ? ` (${role})` : ""}`,
    "",
    "Why:",
    form.statement.trim(),
    "",
    declaration(form.role),
    "",
    `Signed: ${name}`,
    `Date: ${today}`,
  ].join("\n");
}

const enc = encodeURIComponent;

export function mailtoHref(form: TakedownForm, today: string): string {
  return `mailto:${OPERATOR.email}?subject=${enc(subjectFor(form))}&body=${enc(buildBody(form, today))}`;
}

export function gmailHref(form: TakedownForm, today: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(OPERATOR.email)}&su=${enc(subjectFor(form))}&body=${enc(buildBody(form, today))}`;
}

export function outlookHref(form: TakedownForm, today: string): string {
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(OPERATOR.email)}&subject=${enc(subjectFor(form))}&body=${enc(buildBody(form, today))}`;
}

/** What the page needs before a message can be written: a name, an item, and a reason. */
export function missingFields(form: TakedownForm): string[] {
  const out: string[] = [];
  if (form.name.trim() === "") out.push("your name");
  if (form.items.trim() === "") out.push("what to take down");
  if (form.statement.trim() === "") out.push("the reason");
  return out;
}
