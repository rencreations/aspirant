# Legal and compliance checklist

Written 12 Nov 2026 for the owner. It lists what the site now does, what only the owner can do,
which laws touch the site, and what is still open. The public texts are `/terms`, `/privacy` and
`/takedown` (`apps/web/src/features/legal/`). The facts they share (name, address, email, days,
retention) are in `apps/web/src/lib/legal.ts`. Change a fact there, then update the text that uses
it and `LEGAL_EFFECTIVE`.

This is a working document, not legal advice. The texts were written without a lawyer's review. Read
the section "What is still open" before you rely on them.

## 1. Do these first (only the owner can)

1. **Switch off user-provided data collection in the Tag Manager container `GTM-PZP9Q52J` and in the
   Analytics property `G-7BHES29TV4`.** The container's public script shows it ON (automatic
   detection of email, phone and address) and shows form events. The site has no email or phone
   field, so nothing is meant to be collected, but the privacy policy says "measurement data only"
   and that claim holds only if this is off. In Tag Manager open the Google tag settings, then
   "User-provided data" and turn off automatic collection. In Analytics open Admin, Data
   collection, "User-provided data collection" and turn it off.
2. **Check the retention in Analytics:** Admin, Data collection and modification, Data retention.
   Event data 14 months, user data 14 months. The policy says 14 months. If you ever change it,
   change `GA_RETENTION_MONTHS`.
3. **Check Google signals and advertising are off:** Admin, Data collection, Google signals data
   collection OFF. No link to Google Ads. The container already blocks Google signals in every
   region and the site denies the three advertising consent signals.
4. **Check the data sharing settings** (Admin, Data collection, Data sharing settings). Turn off
   what you do not use (Google products and services, benchmarking, technical support, account
   specialists). Accept the data processing terms in the property settings if you have not.
5. **Watch the mailbox `idham@creations.ren`.** It is the address for every takedown notice and privacy
   request. The texts promise a reply to a privacy request within 3 days (30 at most) and removal
   of a work within 7 days of a complete notice. If you will be away, set an auto reply that gives
   a second person or says when you are back, and change the days in `legal.ts` to what you can keep.
6. **Keep a register** of every notice and request: date, who, what item, what you did, date
   closed. The texts say notices are kept 3 years after the matter closes.
7. **Check Cloudflare Web Analytics** is on for aspirant.cc. It is: the live page carries its
   script and a browser test found no cookie. Look at how long Cloudflare keeps the data and make
   sure the policy ("for the time Cloudflare sets") is still true.

## 2. How to remove an item (the procedure for a takedown)

A removal must reach the visitor, not only the repository.

1. Find the item in the data (`apps/web/public/data/library/*.json`) by its id, which the takedown
   link carries (`?item=`).
2. Never edit a data file by hand. Remove the item in its curation (`scripts/library/<room>/`,
   `curation/*.json` for the Arts rooms) or the source list, then run the room's script and
   `python scripts/library/build_index.py`. The scripts keep the data and the index in step.
3. Run `pnpm check`, commit and push. The deploy takes a few minutes.
4. Delete the file in the R2 bucket (`python scripts/library/r2.py`), and **purge it from
   Cloudflare's cache by URL**. Files under a key are cached for 30 days, so a deleted file stays
   served from the edge until it is purged. Purge `https://s3.aspirant.cc/library/v1/...` for each
   size (`t.webp`, `p.webp`, `f.webp` for a picture).
5. Answer the sender, write the register, and keep the notice.

Target: all of it inside 7 days of a complete notice.

## 3. What the site does now

- `/terms`, `/privacy`, `/takedown`, reachable from the menu (bottom right) and linked from every
  takedown line. In the sitemap.
- Cloudflare Web Analytics runs for everyone (no cookie, nothing stored on the device).
- Google Analytics runs **only after Accept** (`features/legal/consent/`). Before that no request
  goes to Google. Reject, or a browser that sends Global Privacy Control, loads nothing and removes
  any Google Analytics cookie. The choice is kept in this browser for a year (`aspirants:consent`).
  Reject and Accept look the same. "Cookie settings" in the menu asks again.
- Consent Mode: all storage denied, then analytics storage granted on Accept. The three advertising
  signals stay denied.
- The container and Google Analytics load when the browser is idle, after the page has opened. They
  are not in the loading bar.
- A small "Copyright or takedown" text link opens the takedown page with the item named. It is on:
  fan art, cosplay, the 21 fan comics, fan and non-canon videos, art marked "Made for this site", the
  fan art on the character pages, and every 3D model. It is not on official art, the two official
  comics, official films or music.
- The takedown page writes the message and the visitor's own email app (or Gmail, or Outlook on the
  web) sends it. It has no email or phone field and is not an HTML form. What is typed never goes in
  the address or to any server.
- No page of the site names the code host or the source code. `node scripts/qa/scan-text.mjs` fails
  if one does (site text, data and built pages).

## 4. Which laws touch the site

The owner lives in Indonesia, the site is in English, and Mobile Legends players are spread across
Indonesia, the Philippines, Malaysia, Brazil, Europe and the US. The texts cover all of them in
general words and give every visitor the same rights.

| Area                                                                                | What it asks                                                                                                                                          | State                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Indonesia, PDP Law 27/2022                                                          | Notice, lawful ground, consent, rights, breach notice, officer, transfers                                                                             | Notice and rights are in `/privacy`. Breach: tell people and the authority fast, within the time the law sets. Verify below.                  |
| Indonesia, ITE Law                                                                  | Operator duties for electronic systems, content                                                                                                       | Terms and takedown page. Verify below.                                                                                                        |
| Indonesia, PSE registration                                                         | Private electronic system operators serving Indonesian users register (Permenkominfo 5/2020, 10/2021)                                                 | **Open.** Whether a non-commercial fan site is in scope is unclear. Ask Komdigi or a lawyer. Blocking is the sanction.                        |
| Indonesia, Copyright 28/2014                                                        | Moral and economic rights of makers, remedies, takedown of infringing electronic content                                                              | The site shows work of others, some without permission. See "still open".                                                                     |
| Indonesia, language                                                                 | Agreements with Indonesian parties in Indonesian (Perpres 63/2019); standard clauses (Consumer Protection Law 8/1999)                                 | **Open.** The texts are English only. An Indonesian version is advisable.                                                                     |
| EU and UK, GDPR, ePrivacy                                                           | Notice, ground, consent before analytics cookies, rights, transfers, an EU or UK representative                                                       | Notice, consent banner, rights. **Open:** an EU or UK representative may be needed (Art. 27 GDPR), because Analytics measures visitors there. |
| EU, Digital Services Act                                                            | Notice and action for hosted content, contact point, a legal representative for non-EU providers                                                      | The takedown page is a notice and action route. **Open:** the representative and the exact scope. Verify.                                     |
| US, DMCA                                                                            | The safe harbour needs a registered agent and applies to content posted by users                                                                      | **Not claimed.** The operator chooses and uploads everything, so the safe harbour probably does not apply. Notices are handled anyway.        |
| US, CCPA and other states                                                           | Notice, no sale or sharing, opt-out signals                                                                                                           | Said in `/privacy`. Global Privacy Control is honoured.                                                                                       |
| US, COPPA                                                                           | No collecting from children under 13                                                                                                                  | The terms set a minimum age of 13. A game fan site draws children, so keep this under watch.                                                  |
| Brazil LGPD, Philippines DPA, Malaysia PDPA, Singapore PDPA, India DPDP, Japan APPI | Notice, ground, rights, transfers                                                                                                                     | Covered by the general texts and the rights given to everyone.                                                                                |
| Platform terms                                                                      | Google Analytics terms need a privacy policy that names it and no personal data sent; the host and Cloudflare have acceptable use and copyright rules | Policy names both. A host can act on a copyright complaint on its own.                                                                        |
| Moonton marks                                                                       | Use of names and marks                                                                                                                                | Said as a fan site, not affiliated, marks used only to say what the site is about.                                                            |

## 5. What is still open

1. **Rights in the content.** This is the largest exposure. The site shows pictures, video, music,
   models, comics and photos that belong to others, and the owner cannot confirm permission for all
   of it. The terms say so in neutral words and promise removal within 7 days. That reduces the risk
   and does not remove it. An Indonesian lawyer who knows copyright should read the terms. Consider
   asking Moonton for written permission for a fan archive (no public fan content policy was found),
   and consider removing items with no known author or source.
2. **Cosplay photos show real people**, some of whom may be minors, with no consent from them. The
   takedown route covers it. Consider showing fewer such photos.
3. **Indonesian version** of the terms and the privacy policy.
4. **PSE registration**: check with Komdigi whether it applies.
5. **The authority and the dates.** The texts do not name the Indonesian authority for personal data
   protection, because it should be checked first. Indonesia's implementing regulation for the PDP
   Law is reported (law firm notes) to take effect on 16 January 2027. Read it when it does, and
   revisit the officer, breach and request times. Reported times are 72 hours to answer some requests
   and to notify a breach. The texts promise 3 days for a request and the legal time for a breach.
6. **EU or UK representative** and the Digital Services Act scope.
7. **Data shared with Moonton.** The privacy policy says measurement data may be shared with Moonton
   when it asks or a claim needs it. Decide how you would handle such a request before it comes.
8. **The cookie lifetime** of Google Analytics is up to two years, longer than the 14 months of
   stored data. That is how the tool works. The consent is asked again after a year.
9. **Child visitors.** Under-13 visitors may open the site. The cookie box is the only data gate.
10. **Annual review.** Read the three texts every year, and whenever a tool, a provider or a law
    changes. Change `LEGAL_EFFECTIVE` when the text changes.

## 6. Where things live

| Thing                       | Place                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Facts (name, address, days) | `apps/web/src/lib/legal.ts`                                                             |
| Terms, privacy, takedown    | `apps/web/src/features/legal/terms.tsx`, `privacy.tsx`, `takedown/takedown-page.tsx`    |
| Consent and analytics       | `apps/web/src/features/legal/consent/`                                                  |
| The takedown message        | `apps/web/src/features/legal/takedown/` (`message.ts`, `prefill.ts`, `report-link.tsx`) |
| The menu foot               | `apps/web/src/components/nav/site-nav.tsx`                                              |
| Tests                       | `apps/web/e2e/legal.spec.ts`, unit tests beside the code                                |
| Local storage keys          | `aspirants:consent`, `aspirants:prefs`, session key `aspirants:entered`                 |
