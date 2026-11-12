import { TLink } from "@/components/transition/t-link";
import {
  GA_ID,
  GA_RETENTION_MONTHS,
  LEGAL_ROUTES,
  OPERATOR,
  PRIVACY_LONGEST_DAYS,
  PRIVACY_REPLY_DAYS,
  REQUEST_KEEP_YEARS,
} from "@/lib/legal";

import styles from "./legal-page.module.css";
import { LegalPage, type LegalSection } from "./legal-page";

/** The cookie Google Analytics names after the property: `_ga_` and the ID without its `G-`. */
const GA_PROPERTY_COOKIE = `_ga_${GA_ID.replace(/^G-/, "")}`;

const SUMMARY = [
  <>We collect measurement data only: which pages are visited and how, not who you are.</>,
  <>
    Cloudflare counts visits without cookies. Google Analytics counts them only if you press Accept
    in the box at the foot of the screen.
  </>,
  <>
    The site has no accounts, no ads and no sale of data. We may share the measurement data we hold
    with third parties, in particular Moonton, when it is needed.
  </>,
  <>
    You can say no at any time (&quot;Cookie settings&quot; in the menu) and ask us about your data
    by writing to {OPERATOR.email}.
  </>,
];

const SECTIONS: readonly LegalSection[] = [
  {
    id: "controller",
    title: "Who is responsible",
    body: (
      <>
        <p>
          {OPERATOR.name} runs this site and decides how measurement data is used. In data
          protection terms, we are the controller. {OPERATOR.name} is also our Data Protection
          Officer.
        </p>
        <p>
          {OPERATOR.addressLines.join(", ")}.<br />
          <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>
          We collect measurement data, and nothing that names you. We do not ask for your name,
          email address or any account. We do not collect payment details, precise location or
          sensitive data. The tools below are the only ways measurement data is collected.
        </p>

        <h3>Google Analytics 4, only if you accept</h3>
        <dl className={styles.facts}>
          <dt>Records</dt>
          <dd>
            The pages you open (their address, which includes picture IDs and the words you type in
            the site search, and their title), the page you came from, how far you scroll, clicks on
            links that leave the site, downloads, video plays, your approximate location (country
            and city, worked out from your IP address), your language, screen size, device type,
            browser and operating system, and a random ID that tells your visits apart. Google says
            Analytics does not log or store IP addresses.
          </dd>
          <dt>Cookies</dt>
          <dd>
            <code>_ga</code> and <code>{GA_PROPERTY_COOKIE}</code>, set on aspirant.cc. Google sets
            them for up to two years, and your browser may shorten that (Chrome stops at 400 days).
          </dd>
          <dt>Kept for</dt>
          <dd>
            {GA_RETENTION_MONTHS} months for event data and for user data, then Google deletes it.
          </dd>
          <dt>Settings</dt>
          <dd>
            Google signals are off and the three advertising signals are denied. We use no
            advertising features and do not link the data to other Google data.
          </dd>
          <dt>Provider</dt>
          <dd>Google (Google LLC and its affiliates, including Google Ireland Limited).</dd>
        </dl>

        <h3>Cloudflare Web Analytics, always on</h3>
        <dl className={styles.facts}>
          <dt>Records</dt>
          <dd>
            Page views, the page address, where you came from, your country, device type, browser,
            operating system and how fast the page loaded.
          </dd>
          <dt>Cookies</dt>
          <dd>
            None. Cloudflare says it uses no cookies or local storage for this and does not use IP
            addresses or fingerprints to follow you across visits. A check of this site in a browser
            found no cookie.
          </dd>
          <dt>Kept for</dt>
          <dd>
            For the time Cloudflare sets for it. We read summary reports only and cannot look up one
            visitor.
          </dd>
          <dt>Provider</dt>
          <dd>Cloudflare, Inc.</dd>
        </dl>

        <h3>Hosting and delivery</h3>
        <p>
          Our hosting provider and Cloudflare, which delivers the pages and stores and serves the
          pictures, videos and 3D models, see your IP address and the technical details of each
          request, as every web server does. They use it to deliver the site and keep it secure. We
          do not use these records to identify visitors.
        </p>

        <h3>On your device</h3>
        <p>
          The site saves a few things in your browser: your sound setting, where you stopped
          reading, your reading place in comics, lore and other rooms, your analytics choice and its
          date, a note that you passed the loading screen in this tab, and big files kept so they do
          not download twice. They stay in your browser and we never receive them. Clear them in
          your browser settings at any time. They are needed to make the site work the way you left
          it, so they need no consent.
        </p>

        <h3>Messages you send us</h3>
        <p>
          If you write to us, for example a takedown notice or a privacy request, we receive what
          you send: your name, your email address and your message. We use it only to deal with the
          matter.
        </p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it, and on what ground",
    body: (
      <>
        <ul>
          <li>
            To count and understand visits, so we can see what people use and keep the site working
            well. For Google Analytics the ground is your consent. For Cloudflare Web Analytics and
            the delivery records it is our legitimate interest in running a secure site, since they
            use no cookies and collect little.
          </li>
          <li>
            To answer notices and requests, and to protect ourselves in a legal or copyright claim.
            The ground is our legitimate interest and our legal duties.
          </li>
        </ul>
        <p>
          We do not use measurement data to profile you, to decide anything about you, or for
          advertising.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who gets it",
    body: (
      <>
        <p>
          The measurement data we hold can be shared with third parties. Those that may receive it:
        </p>
        <ul>
          <li>
            <strong>Google and Cloudflare</strong>, who collect and process it for us under their
            own terms.
          </li>
          <li>
            <strong>Moonton</strong>, the company that makes Mobile Legends: Bang Bang, if it asks
            for it, or if we need to share it to deal with a legal or copyright claim. We would
            share it in summary form where we can.
          </li>
          <li>
            <strong>Authorities and courts</strong>, when the law requires it, and our professional
            advisers.
          </li>
          <li>
            <strong>The maker or poster of a work</strong>, and Moonton, can be sent a takedown
            notice when that helps settle it. Tell us if you do not want your contact details passed
            on.
          </li>
        </ul>
        <p>We never sell data and never share it for advertising.</p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "Data that crosses borders",
    body: (
      <p>
        Google and Cloudflare process data in many countries, including the United States, so your
        data may leave the country where you live. They rely on their own safeguards for this, such
        as standard contractual clauses and, where it applies, the EU-U.S. Data Privacy Framework.
      </p>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Google Analytics: {GA_RETENTION_MONTHS} months.</li>
        <li>Cloudflare Web Analytics: for the time Cloudflare sets. We see summaries only.</li>
        <li>
          Messages and notices: until the matter is closed and {REQUEST_KEEP_YEARS} years after, in
          case a claim follows.
        </li>
        <li>
          Your analytics choice: in your browser for a year, then we ask again. Everything else on
          your device stays until you clear it.
        </li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>
          Wherever you live, you can ask us to tell you what we hold about you, give you a copy,
          correct it, delete it, restrict how it is used, or stop using it for something you object
          to. You can also withdraw your consent at any time and move your data to another service
          where that applies. Withdrawing does not affect what happened before.
        </p>
        <p>
          To withdraw, open the menu and press &quot;Cookie settings&quot;, then Reject. We stop
          Google Analytics and remove its cookies from your browser. To ask for anything else, write
          to <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
        </p>
        <p>
          We answer within {PRIVACY_REPLY_DAYS} days. If a request is complex, we tell you why and
          finish within {PRIVACY_LONGEST_DAYS} days at most. Measurement data is stored under a
          random ID and not under your name, so we may ask you for the ID in your <code>_ga</code>{" "}
          cookie to find it. We cannot find data that is not linked to anything you can show us.
        </p>
        <p>
          If you think we have handled your data wrongly, tell us first. You may also complain to
          the authority in charge of personal data protection in Indonesia, or to the one where you
          live.
        </p>
      </>
    ),
  },
  {
    id: "regions",
    title: "Where you live",
    body: (
      <>
        <p>
          The law that protects you depends on where you are. This includes Indonesia, the European
          Economic Area, the United Kingdom, California, Brazil, the Philippines and Malaysia. We
          give the rights above to everyone, wherever they live.
        </p>
        <p>
          For California: in the last twelve months we collected identifiers (a random online ID),
          internet activity and approximate location, for the purposes above. We do not sell or
          share personal information as California law defines those words, and we do not use
          sensitive personal information to infer anything about you.
        </p>
        <p>
          If your browser sends Global Privacy Control, we treat it as Reject until you choose
          otherwise in &quot;Cookie settings&quot;.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        The site is for people aged 13 and over and we do not knowingly collect data from younger
        children. If you think a child has sent us a message or been counted by mistake, write to us
        and we delete it. See the{" "}
        <TLink href={LEGAL_ROUTES.terms} className="link">
          terms
        </TLink>{" "}
        for the age at which a parent should agree to cookies.
      </p>
    ),
  },
  {
    id: "people",
    title: "People in pictures",
    body: (
      <p>
        Some pictures, mostly cosplay photos and fan art, show real people. They are shown with the
        credit of the photographer or artist when we know it. If you appear in a picture and want it
        removed, use the{" "}
        <TLink href={LEGAL_ROUTES.takedown} className="link">
          takedown page
        </TLink>
        . You do not need to own the picture.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security and breaches",
    body: (
      <p>
        The site is static and holds no database of visitors. Measurement data sits with Google and
        Cloudflare. We keep messages in our own mailbox. If a breach puts your personal data at
        risk, we tell you and the authority as fast as we can and within the time the law sets.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        We may update this policy. The date at the top says when the current text took effect. If a
        change affects what you agreed to, we ask again.
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalPage
      current="privacy"
      title="Privacy policy"
      lead="What we measure, who sees it, and how to say no."
      summary={SUMMARY}
      sections={SECTIONS}
    />
  );
}
