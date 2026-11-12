import { TLink } from "@/components/transition/t-link";
import { LEGAL_ROUTES, OPERATOR, TAKEDOWN_DAYS } from "@/lib/legal";

import { LegalPage, type LegalSection } from "./legal-page";

const SUMMARY = [
  <>This is a fan-made, non-commercial archive. Moonton did not make it, check it or approve it.</>,
  <>
    We own only the website&apos;s code and technical work. We own none of the pictures, videos,
    music, 3D models, comics, photos or text shown here.
  </>,
  <>
    We have not been able to confirm permission for every item. If something here is yours and you
    want it gone, we remove it within {TAKEDOWN_DAYS} days.
  </>,
  <>Use the site for yourself, and respect the people who made what you see.</>,
];

const SECTIONS: readonly LegalSection[] = [
  {
    id: "who",
    title: "Who runs this site",
    body: (
      <>
        <p>
          The Aspirants (aspirant.cc) is a fan-made archive for Aspirant, a story series set in an
          alternate universe of Mobile Legends: Bang Bang. The Aspirant story is a fan work. It is
          not part of the game&apos;s official story.
        </p>
        <p>
          The site is run by {OPERATOR.name} in Jakarta, Indonesia (&quot;we&quot;, &quot;us&quot;).
          It is a hobby project. It is strictly non-commercial: it has no ads, sells nothing, takes
          no donations or sponsorship, and nobody is paid for it.
        </p>
        <p>
          By using the site you agree to these terms. If you do not agree, please do not use it.
        </p>
      </>
    ),
  },
  {
    id: "moonton",
    title: "Not affiliated with Moonton",
    body: (
      <>
        <p>
          Mobile Legends: Bang Bang, its heroes, names, logos, art, music, voice lines and game
          files are made by Moonton, the studio behind the game, and belong to Moonton or its
          licensors. Mobile Legends and Moonton are trademarks of their owners. We use these names
          only to say what the site is about.
        </p>
        <p>
          This site is not made, checked, approved or endorsed by Moonton, and nothing on it speaks
          for Moonton.
        </p>
      </>
    ),
  },
  {
    id: "ownership",
    title: "What we own and what we do not",
    body: (
      <>
        <p>
          We own the website&apos;s code and technical work: how it is built, its layout and
          animation engineering, and its design system. We own nothing else on the site.
        </p>
        <p>
          Everything else belongs to its makers or to the people who posted it: every picture,
          video, 3D model, song, voice line, comic, piece of fan art, cosplay photo, name, logo and
          piece of text. It comes from online sources. Where we know who made it, we show their name
          and a link to the original.
        </p>
        <p>
          We have not been able to confirm permission for every item. For some we have it. For some
          we do not, and for some we do not know. We claim no right in any of it. Showing it here
          does not give us or you any right to it, and it does not mean its owner agrees to it being
          here.
        </p>
        <p>
          If something is yours and you do not want it shown, you can have it removed. See{" "}
          <a href="#takedown">Takedown and complaints</a>.
        </p>
      </>
    ),
  },
  {
    id: "labels",
    title: "How we label things",
    body: (
      <>
        <p>
          Official art has no label. Work made by fans carries a &quot;Fan work&quot; label and the
          artist&apos;s credit when we know it. A fan film or parody outside the story is marked as
          non-canon. Pictures marked &quot;Made for this site&quot; are not official art and are
          shown to illustrate the site.
        </p>
        <p>
          Labels are our best effort and can be wrong. If one is wrong, or a credit is missing, tell
          us and we fix it.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How you may use the site",
    body: (
      <>
        <p>You may look at the site and use it for yourself, not for profit. You agree that you:</p>
        <ul>
          <li>
            will not copy, sell or re-post what you find here as your own, or in a way its owner
            would not allow. We cannot give you permission for work that is not ours.
          </li>
          <li>
            will not copy the site in bulk with scripts, overload it, probe it for weaknesses, or
            try to get round how it works.
          </li>
          <li>will not send us false or abusive claims.</li>
        </ul>
        <p>
          The site has no accounts and takes no uploads from visitors. What you take from it is your
          responsibility, and what you do with it must follow the law and the rights of the people
          who made it.
        </p>
      </>
    ),
  },
  {
    id: "takedown",
    title: "Takedown and complaints",
    body: (
      <>
        <p>
          Anyone can ask us to remove something: its owner, someone acting for the owner, or a
          person shown in a picture. Use the{" "}
          <TLink href={LEGAL_ROUTES.takedown} className="link">
            takedown page
          </TLink>{" "}
          or write to <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Fan art, cosplay
          photos, fan comics, fan videos and every 3D model carry a small &quot;Copyright or
          takedown&quot; link that opens the page with the item already named.
        </p>
        <p>
          We remove the work within {TAKEDOWN_DAYS} days of a complete notice, and often sooner. We
          may remove it first and ask questions afterwards. If you posted something we removed and
          think we were wrong, you can send a counter-notice. The takedown page explains how.
        </p>
      </>
    ),
  },
  {
    id: "links",
    title: "Links to other sites",
    body: (
      <p>
        Some pages link to other sites, for example the original post of a fan work or a music
        service. We do not run those sites and are not responsible for what is on them or how they
        treat your data.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "Privacy and analytics",
    body: (
      <p>
        We count visits with Cloudflare, and with Google Analytics only if you accept. The{" "}
        <TLink href={LEGAL_ROUTES.privacy} className="link">
          privacy policy
        </TLink>{" "}
        says what is collected, why, who gets it and what your choices are. It is part of these
        terms.
      </p>
    ),
  },
  {
    id: "age",
    title: "Age",
    body: (
      <p>
        The site is for people aged 13 and over. If you are younger, please do not use it. If your
        country sets a higher age for agreeing to the use of your data online, such as 16 in parts
        of Europe, ask a parent or guardian before you accept analytics cookies. You can use the
        whole site without accepting them.
      </p>
    ),
  },
  {
    id: "warranty",
    title: "No promises about the site",
    body: (
      <>
        <p>
          The site is offered as it is, for free. We do not promise that it is complete, correct,
          always available or free of mistakes, or that anything on it will stay. We may change or
          remove any page or item at any time.
        </p>
        <p>
          To the extent the law allows, we are not liable for any loss that comes from using the
          site, from its content, or from sites it links to. Nothing here limits a right you have
          under a law that cannot be limited by agreement.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms. The date at the top says when the current text took effect. If
        you keep using the site after a change, you accept the new text. We will not change them for
        work you have already asked us to remove.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        The laws of the Republic of Indonesia govern these terms. If we cannot settle a dispute by
        talking, the South Jakarta District Court (Pengadilan Negeri Jakarta Selatan) is the court
        for it. If a law where you live gives you the right to use your own courts, that right
        stays.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        {OPERATOR.name}, {OPERATOR.role}, {OPERATOR.addressLines.join(", ")}.{" "}
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalPage
      current="terms"
      title="Terms of service"
      lead="What this site is, what is ours and what is not, and how to ask for something to be removed."
      summary={SUMMARY}
      sections={SECTIONS}
    />
  );
}
