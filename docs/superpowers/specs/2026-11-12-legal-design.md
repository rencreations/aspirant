# Legal pages, consent and takedown: request and design (12 Nov 2026)

## The request (owner, 12 Nov 2026, summarised)

1. Complete terms of service and privacy policy pages, and a compliance listing of everything legal
   that has to be addressed for this static site. No placeholders anywhere: every fact is asked for
   first (one round of questions, then the answers below).
2. Google Analytics 4 through the Tag Manager container `GTM-PZP9Q52J` (tag `G-7BHES29TV4`).
3. The texts say the owner owns nothing but the website's code and technical work. Pictures, video,
   3D models and the rest are taken from online sources, with or without permission. Owners can ask
   for removal by email to the Data Protection Officer.
4. A small, text-only, unobtrusive "copyright or takedown" shortcut on the detail view of every item
   that is not Moonton's own: fan art, cosplay, the fan comics (not the two official ones), anything
   a user owns. Added later the same day: the 3D models too.
5. Data collection: measurement data only, with Cloudflare Web Analytics and Google Analytics. It may
   be shared with third parties, in particular Moonton, when needed.
6. Terms and privacy links in the menu page, small, bottom right. In the same menu the old foot line
   becomes "Made by MLBB Community".
7. No mention of the code host or of source code anywhere on the site, checked on every page.
8. A takedown page with no backend: find a way for a visitor to send the message.

## The owner's answers

- Operator: Muhammad Idham Ma'arif, Data Protection Officer, office in Jakarta (address in
  `lib/legal.ts`), email `idham@creations.ren`. The earlier pen name and mailbox are not used.
- Strictly non-commercial. Cover all players. Minimum age 13 (parent's permission where local law
  sets 16).
- Analytics: one Accept or Reject question in the site's own design, simple, visible, not in the
  way. Cloudflare Web Analytics is already on. GA4 retention: event data 14 months, user data 14
  months.
- Sharing with Moonton: when it asks, or a claim needs it, in summary form where possible; never
  sold. Copyright wording: the neutral one. Takedown within 7 days, with a counter-notice route. The
  shortcut covers all non-official items including the 13 pictures marked "Made for this site", and
  those keep that label.

## Calls made without asking (change on request)

- Pages: `/terms`, `/privacy`, `/takedown`, plus the owner's checklist `docs/legal/COMPLIANCE.md`.
- Governing law Indonesia, court South Jakarta District Court. Notices and privacy requests kept 3
  years after closing. Privacy requests answered in 3 days, 30 at most. Counter-notice wait 10
  working days.
- Global Privacy Control counts as Reject. A saved choice is asked again after a year. Cookies
  removed on Reject.
- The takedown page writes the message and the visitor's own email app, Gmail or Outlook on the web
  sends it, or they copy it. No email or phone field and no HTML `form`, because the container
  watches form events and user-provided data.
- The hosting provider is named only as "our hosting provider". Cloudflare and Google are named.
- No claim of fair use or of a legal safe harbour.

## Design

- **Facts in one module** (`lib/legal.ts`): operator, address, effective date, container and
  property ids, retention, consent key and age, takedown and privacy days.
- **Consent** (`features/legal/consent/`): `consent.ts` (pure: parse, read, save, Global Privacy
  Control), `analytics.ts` (load the container after Accept, Consent Mode, stop and remove cookies),
  `use-consent.ts` (store), `consent-banner.tsx` (the plate; also runs the analytics from the
  choice). Mounted in the root layout after the loading gate. Not in the loading bar.
- **Takedown** (`features/legal/takedown/`): `message.ts` (the message, mailto, Gmail, Outlook),
  `prefill.ts` (the link from an item and its reading back, with a strict page filter),
  `report-link.tsx` (the small link), `takedown-composer.tsx` and `takedown-page.tsx`.
- **Shortcut placement:** inside the caption plate of the Arts viewer (`ZoomPicture.report`), the
  info card of the character viewer (`ViewerImage.report`), under the credit in the fan video
  viewer, under the title in the fan comic reader, under the facts of every model.
- **Pages** share `legal-page.tsx`: title, short version, numbered sections with a still list at the
  side on wide screens, a foot with the other pages and the contact. Nothing moves.
- **Scan:** `scripts/qa/scan-text.mjs` fails on the code host, the repository name and "source
  code" in the site's text, data and built pages.
