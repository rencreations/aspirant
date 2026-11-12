import { COUNTER_NOTICE_DAYS, OPERATOR, REQUEST_KEEP_YEARS, TAKEDOWN_DAYS } from "@/lib/legal";

import { LegalPage, type LegalSection } from "../legal-page";
import { TakedownComposer } from "./takedown-composer";

const SECTIONS: readonly LegalSection[] = [
  {
    id: "who",
    title: "Who can ask",
    body: (
      <>
        <p>
          The owner of a work shown here. Someone who acts for the owner. A person who appears in a
          picture. Anyone else who thinks something should not be here, in which case we decide
          whether to remove it.
        </p>
        <p>
          We have not been able to confirm permission for every item on this site. If it is yours,
          you do not need to prove anything to start. Tell us what it is and we take it seriously.
        </p>
      </>
    ),
  },
  {
    id: "send",
    title: "What to send",
    body: (
      <>
        <ul>
          <li>Your name, and whether you own the work, act for its owner, or appear in it.</li>
          <li>
            What to remove: its title and the address of the page. The &quot;Copyright or
            takedown&quot; link on an item fills this in.
          </li>
          <li>Why it should not be here. If you own it, a link to your original helps.</li>
          <li>
            For a copyright notice, a statement that you act in good faith and that what you say is
            accurate. The message above includes it.
          </li>
        </ul>
        <p>
          You do not give your email address in the boxes. The email you send carries it, and we
          reply there.
        </p>
      </>
    ),
  },
  {
    id: "next",
    title: "What happens next",
    body: (
      <>
        <p>
          We remove the work within {TAKEDOWN_DAYS} days of a complete notice, and usually sooner.
          If your notice is missing something, we write back and say what. We may remove a work
          first and ask questions afterwards.
        </p>
        <p>
          We do not publish your notice or your details. We may pass the notice to the person who
          made or posted the work, or to Moonton, if that helps settle it. If you do not want your
          contact details passed on, say so in your message. We keep notices for{" "}
          {REQUEST_KEEP_YEARS} years after the matter is closed.
        </p>
      </>
    ),
  },
  {
    id: "counter",
    title: "If you posted a work that was removed",
    body: (
      <>
        <p>
          If you made or posted something we removed and you think we were wrong, write to{" "}
          <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> with a counter-notice. Say which
          item, why you are sure the removal was a mistake or that the use is allowed, and sign it
          with your name.
        </p>
        <p>
          We pass your counter-notice to the person who complained. Unless they tell us within{" "}
          {COUNTER_NOTICE_DAYS} working days that they have started legal action, we may put the
          work back.
        </p>
      </>
    ),
  },
  {
    id: "false",
    title: "Claims you know are false",
    body: (
      <p>
        A notice or a counter-notice that you know is false can expose you to legal liability. Do
        not send one.
      </p>
    ),
  },
];

export function TakedownPage() {
  return (
    <LegalPage
      current="takedown"
      title="Copyright and takedown"
      lead="Something here is yours, or shows you, and you want it gone. This is how."
      sections={SECTIONS}
    >
      <TakedownComposer />
    </LegalPage>
  );
}
