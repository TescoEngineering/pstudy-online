# PSTUDY launch backlog

A working document to take PSTUDY from its current pre-launch state to a first usable, marketable version.

Created from a holistic product/UX/market review based on screenshots of the marketing site, login, My decks, deck editor, three practice modes, exam organiser flow, AI generation, mobile views, PstudyCommunity, and MyCommunities.

---

## How to use this document

This is a living document. Keep it in your repo at `docs/PSTUDY-launch-backlog.md` and update it as you ship things.

**Each item has a checkbox.** To mark something done, change `- [ ]` to `- [x]` in the source. In Cursor's preview pane the box will show as ticked.

**Each item has an ID** like `UI-03` or `MKT-01`. We use these so we can refer to specific items in conversation ("did you ship UI-03?").

**Three tiers, in order:**

1. **Tier 0 — Founder decisions.** Things only you can decide. No coding. Do these first — they unblock several Tier 1 items.
2. **Tier 1 — Pre-launch must-fix.** Things that would actively repel a first user or make the product look unfinished. Ship these before you start any acquisition activity.
3. **Tier 2 — First 30 days post-launch.** Things to ship in the first month based on what you learn from real users.
4. **Tier 3 — Strategic / later.** Real value but not pre-launch priorities.

**One item at a time.** Don't try to do this all in one go. Pick the top open item in the highest open tier, paste its Cursor brief, test the result, tick the box, move on. One item per session is fine. Two is great.

**If you don't understand a Cursor response**, paste it back into the Claude chat and ask. That's a perfectly good workflow.

**If an item doesn't make sense or you disagree with it**, skip it or delete it. Nothing is mandatory.

**Stack assumed:** Next.js + React + TypeScript + Tailwind on Vercel, with Supabase for auth/database/storage. If something turns out to be different, tell Cursor "we're using X, not Y" when pasting the brief.

---

## Tier 0 — Founder decisions (no coding)

These are decisions only you can make. Most take 5–30 minutes of thinking. Several Tier 1 items depend on these answers.

### FD-01 — Set a real price ✅ DECIDED

- [x] Pricing structure decided
- [ ] Publish on the marketing site (this is implementation work — see `MKT-02`)

**Final pricing structure:**

| Plan | Price | Seats | AI credits | Sharing | What's included |
|------|-------|-------|------------|---------|-----------------|
| Free | €0 | 1 | 0 | Read PstudyCommunity only | 3 decks, 100 cards total, all practice modes, no AI, no exams |
| Personal | €3.99/month or €35/year | 1 | 500/month | Read + share to PstudyCommunity | Unlimited decks, AI generation, all practice modes, top-ups available |
| Community Starter | €299/year | up to 25 | 500/seat/month, pooled | Read all; only teachers/admins can share externally | Everything + MyCommunities, exams, peer review, admin dashboard, GDPR DPA, central billing |
| Community Standard | €699/year | up to 100 | 500/seat/month, pooled | Same as Starter | Same + priority email support |
| Community Enterprise | Quote | 100+ | Negotiated | Same | Same + onboarding call, SSO discussion, custom DPA |

**Top-ups (Personal and Community):** €3 / 250 credits · €5 / 500 credits · €9 / 1,000 credits. No expiration. Available once the user/org is on a paid plan.

**Currency at launch:** EUR only.

**Architectural note for implementation:** The AI quota system should be built as a generic "credits" system, not hardcoded to "AI cards". Today, 1 AI card = 1 credit. Later features (AI grading of essay answers, AI conversation practice, etc.) can cost different credit amounts (e.g. 3 credits per essay). The user always sees a single combined meter ("you've used 240 of 500 credits this month").

**Sharing rules (PstudyCommunity):**
- Free: read only
- Personal: read + share
- Community students: read only — cannot publish externally
- Community teachers/admins: read + share for decks they own

**Why this structure:**
- Free tier drives word-of-mouth and signup volume.
- Personal at €3.99/€35 is mid-market, generous, easy yes.
- Community uses platform-tier pricing rather than per-seat math — simpler sales conversations, predictable revenue, healthy margins.
- Three Community tiers (not four) keeps the pricing page simple. A "Plus" tier between Standard and Enterprise can be added later if customer demand justifies it.
- Top-ups are priced ~1.5x the bundled rate — fair to users, still profitable for you.

This unlocks `MKT-02` (publish pricing on the marketing site).

---

### FD-02 — What to do about the orange banner ✅ DECIDED (revised)

- [x] Decision: **Replace orange banner with a small, neutral grey strip showing softer wording, visible to logged-out visitors only**

**Final design:**

- **For logged-out visitors:** a small horizontal strip across the top of the page (similar position to today's orange banner) with a neutral grey background and softer wording: *"PSTUDY is in active development — features may change."*
- **For logged-in users:** the strip is hidden entirely. They've already seen and accepted the development state by signing up.
- **No `/changelog` page.** No "What's new" link. No marketing of development progress.

**Visual style:**
- Small, single line across the top
- Light grey background (not orange, not any alert color)
- Small grey text, neutral tone
- No arrow, no link — purely informational
- Smaller and less prominent than today's orange banner, but still noticeable enough to serve as honest disclosure before signup

**Why this revised approach:**

The original Option C (a "What's new" changelog strip celebrating shipped features) was reframed during implementation. The user's reasoning: visitors don't actually want to know what's being worked on — that's an internal-marketing framing, not something they care about. What they DO need to know, before signing up, is that the product is still being developed and may change. Once they've signed up, they've already accepted that — no need to keep showing the notice.

This serves three goals:
- **Honest disclosure** before signup (legal and ethical)
- **Clean experience** for logged-in users (no constant reminder of development state)
- **Avoids the "early-stage / unstable" signalling** that a visible "v0.5 shipped" banner would create for school and corporate buyers

**What changed from the original FD-02 decision:**
- Dropped the "What's new" framing — no version numbers, no shipped-features celebration
- Dropped the `/changelog` page entirely
- Wording softened from "PSTUDY Online is under construction. Features may change." to "PSTUDY is in active development — features may change."
- Visual style softened from orange-alarm to neutral-grey-info

This unlocks `UI-01` (revised scope below).

---

### FD-03 — Pick a positioning sentence ✅ DECIDED

- [x] Final positioning chosen

**Final positioning (two-tier headline):**

- **H1:** *Flashcards, exams, and peer-reviewed shared decks.*
- **Subhead:** *Made in Europe, built for serious teachers and learners.*

**How to use it on the marketing site:**
- The H1 is large and bold, sitting where "Study more effectively" sits today.
- The subhead is smaller, lighter weight, immediately below the H1.
- Together they replace the current generic H1 + the tagline that's currently hidden behind the (i) icon.

**Why this version works:**
- The H1 names the three differentiators (flashcards, exams, peer-reviewed decks) — a combination no competitor offers in one product.
- "Made in Europe" reads as a credential the product carries, not a restriction on who can use it. A non-European visitor reads it without feeling excluded.
- "Serious teachers and learners" filters for quality buyers without naming a specific segment, leaving room for individuals, language schools, secondary schools, and tutors to all see themselves.
- The two-sentence structure gives each idea visual room.

This unlocks `MKT-01` (rebuild the home page).

---

### FD-04 — Trademark / name check ✅ DECIDED & EUTM FILED

- [x] PSTUDY is registered as a Benelux trademark with the BOIP (registration #980089, filed 14/06/2015, valid until 14/06/2035)
- [x] **EUTM filed at EUIPO on 1 May 2026** — application reference: **EEFEM202600002022425**
- [x] Word mark "PSTUDY" filed in classes 41 and 42 (revised from original 9 + 41 plan after eSearch revealed UpStudy conflict in class 9)
- [ ] Track examination progress at EUIPO eSearch plus
- [ ] File subsequent seniority claim post-registration (links EUTM to Benelux registration 980089 for class 42 overlap)
- [ ] *Later, only if entering the US market:* file with USPTO TESS (~$350 per class)

**Filing summary:**

| Item | Value |
|------|-------|
| Mark | PSTUDY (word mark) |
| Owner | Tesco Engineering BV |
| Application reference | EEFEM202600002022425 |
| Filing date | 1 May 2026 |
| Classes | 41 + 42 |
| Goods/services | 8 items, all from EUIPO Harmonised Database (Fast Track eligible) |
| Languages | English (first), French (second) |
| Fee paid | €900 |
| Indicative registration date | ~15 August 2026 |
| Expiry date (renewable) | 1 May 2036 |

**Goods/services filed:**

*Class 41 — educational services:*
1. Language tuition
2. Educational assessment services
3. Education services
4. Online educational examination services
5. Online educational testing

*Class 42 — software/technology services:*
6. Software as a service [SaaS]
7. Electronic data storage
8. Providing temporary use of on-line non-downloadable software

**Class strategy explanation (recorded for future reference):**

Originally we planned to file in classes 9 + 41. During EUIPO eSearch we found "UpStudy" (BEFUN AI TECH PTE LTD) registered in class 9 with an extremely broad specification covering all educational software. After comparing with STUDY ME's successful registration (classes 41 + 42 with no opposition), we switched strategy to file in classes 41 + 42. This:
- Avoids overlap with UpStudy's class 9 specification (low opposition risk)
- Matches PSTUDY's actual product (a web-based SaaS, not a downloadable app)
- Follows a working precedent (STUDY ME)
- Trades broader class 9 protection for a cleaner registration path

If UpStudy's mark ever lapses or is narrowed, we can add class 9 protection later via a separate application.

**Coverage today:**
- **Benelux** (NL, BE, LU): full word mark protection through 2035 via BOIP registration 980089
- **EU-wide** (24 additional countries): word mark protection through 2036 via EUTM (pending registration)
- **Outside EU**: no protection yet (would require separate filings, e.g. USPTO for USA, UK IPO for UK)

**Trademark scam warning (EUIPO flagged this on the receipt):**

Within days of filing, expect to receive misleading invoices from companies pretending to be official trademark registries (names like "European Trade Mark Office," "Trademark Registration Service," etc.) demanding €1,000–€2,500 for fake "registration" or "publication" services. **All of these are scams.** EUIPO does not send invoices for additional fees. Ignore them entirely.

**Subsequent seniority claim (small post-registration task):**

Once the EUTM is registered (~August 2026), file a subsequent seniority claim linking it to your Benelux registration 980089. This preserves the 2015 priority date for the class 42 portion of your specification (where Benelux already covers software services). The claim is free and filed via the EUIPO portal. Adds protection in any priority dispute later.

---

### FD-05 — GDPR posture for school AND company sales ✅ DECIDED

- [x] Audience confirmed: **schools, language schools, training organisations, AND companies (corporate L&D)**
- [x] Approach decided: **Wave 1 done before private beta launch; Wave 2 done over the first month of private beta, before any school/company outreach**
- [ ] Wave 1 work — see `LEG-01`
- [ ] Wave 2 work — see `LEG-02`

**Audience note:** Originally scoped for schools only. Expanded to include companies (corporate L&D, internal training, compliance training). This broadens revenue potential significantly but raises the GDPR bar — companies have HR scrutiny, sector-specific compliance (banking, healthcare, pharma), audit requirements, and procurement processes that schools don't.

**Two-wave plan:**

**Wave 1 (do before private beta launch — minimum legal operating requirements):**
- Privacy policy (public-facing on the website)
- Terms of Service / User Terms (for Free and Personal users)
- Cookie policy
- Confirm Supabase is configured for an EU region (Frankfurt / Dublin / Paris)
- Designate a data protection contact (e.g. privacy@pstudy.be)

**Wave 2 (do during first month of private beta, before approaching schools or companies):**
- Data Processing Agreement (DPA) template — for Community customers to sign
- Sub-processor list (public page listing OpenAI, Vercel, Supabase, email provider, with their roles and locations)
- Data retention policy
- Data export functionality (let users download their data — GDPR Art. 20)
- Data deletion functionality (let users request deletion of their account and data — GDPR Art. 17)
- Audit log (who accessed what data when — for corporate buyers' security questions)
- Breach notification process (internal procedure for the GDPR 72-hour rule)

**What you do NOT need for launch:**
- A formally designated Data Protection Officer (DPO) — PSTUDY's processing scale doesn't trigger the requirement
- ISO 27001 or SOC 2 certification — overkill for early stage; you can pursue these later if a large customer requires them
- A privacy lawyer on retainer — templates plus occasional consultation (€100–€300 per hour, when needed) is enough

**Why this is right for PSTUDY:**
- Wave 1 covers the minimum required by EU law to operate publicly with users — non-negotiable.
- Wave 2 is the credibility layer that lets you reach corporate and school buyers without scrambling.
- Splitting reduces upfront work without compromising sales readiness.
- Most documents can be templated (Termly, GetTerms, iubenda, or open templates from companies you respect) and refined later if a customer pushes back.

This unlocks `LEG-01` (Wave 1 in Tier 1) and `LEG-02` (Wave 2 in Tier 2).

---

### FD-06 — Mobile vs desktop usage ✅ DECIDED (deliberately held open + design principle)

- [x] Decision: **do not commit to a usage assumption yet** — wait for real analytics from private beta before prioritising mobile-vs-desktop work
- [x] Design principle: **the product must support Option B (desktop for editing + mobile for practice)** regardless of which usage pattern emerges
- [ ] Once private beta has ~20–50 active users, review actual mobile vs desktop usage in analytics and revisit this decision

**The reasoning:**

You correctly recognised that without real users, guessing at usage patterns is unreliable. Rather than commit to a wrong assumption, we hold the priority question open and instead lock in a *capability* requirement: the product must work well for the most demanding pattern (desktop creation + mobile practice). If we build for that, we automatically support every other pattern.

**Concrete consequences for the backlog:**

- **Mobile practice flows must remain robust.** Based on the May 2026 screenshots, they already are — the practice screen and flashcard mode work well on mobile. Don't degrade this.
- **The mobile editor must remain at least *functional*** — users editing decks on a phone shouldn't be blocked, even if the experience isn't polished.
- **Polish prioritisation stays flexible.** Specific items like a hamburger menu (`UI-04`), dropdown clipping fix (`UI-06`), and Listening pill overlap (`UI-05`) remain in Tier 1 because they're cheap and improve mobile *quality*. Larger mobile rebuilds (e.g. a one-card-at-a-time mobile editor) stay deferred until analytics justify them.
- **No need to invest in a native mobile app pre-launch.** The PWA path (`STR-03`) remains a Tier 3 item, to be re-evaluated once real usage data comes in.

**Once you have analytics (~30 days into private beta):**

Open this item again and answer:
- What % of *practice* sessions happen on mobile?
- What % of *deck creation/editing* happens on mobile?
- Are there segments (e.g. corporate L&D users, school students) with different patterns?

The answers will determine whether mobile editor work needs to move up in priority.

---

### FD-07 — Choose a payment provider ✅ DECIDED

- [x] Provider chosen: **Paddle**
- [ ] Apply for Paddle merchant account (allow 2–4 weeks for approval — do this during private beta, not on launch day)

**Decision: Paddle**, as a merchant of record (MoR). This means:
- Paddle handles EU VAT collection and remittance across all 27 EU countries — you do not register for VAT in each country as your user base grows.
- Paddle is the legal seller; you receive net payments after their fees.
- Fees are higher than Stripe (~5% vs ~1.5% + €0.25) but the operational simplicity is worth it for a single-founder operation.

**Why Paddle over Stripe:** VAT compliance across the EU is genuinely complex. Each country has thresholds, registration requirements, and reporting obligations. For a Belgian-based founder selling to EU customers, the VAT mental load alone justifies the higher fee. Stripe makes you handle VAT yourself (or pay for Stripe Tax at +0.5%); Paddle makes it disappear.

**Why not Mollie:** Mollie is excellent for one-time payments and Belgian/Dutch market focus, but is weaker on EU-wide subscription management and does not act as merchant of record.

**Important note:** Paddle has merchant approval requirements — they want a real product, privacy policy, terms of service, and evidence of legitimacy. Apply during the private beta period (FD-08), not on launch day.

This decision unblocks `BIZ-01` (Paddle integration), which is in Tier 2.

---

### FD-08 — Launch model ✅ DECIDED (finalized)

- [x] Decision: **Private beta first, payments added later**
- [x] Beta cap: **50 users**, with a public waitlist after that
- [x] Beta duration: **paid plans expected in Q3 2026 (July–September)**, with **minimum 30 days notice** before any change
- [x] Early-adopter benefit: **6 months free** after paid plans launch, then **price locked at €3.99/month or €35/year** for as long as the subscription stays active

**Decision: Launch as a free private beta**, then activate Paddle payments in Q3 2026 based on user feedback.

**Final beta terms:**

| Decision | Value |
|----------|-------|
| Cap | 50 users; waitlist after that |
| Cost during beta | Free for everyone |
| Paid plans launch | Q3 2026 (July–September) |
| Notice before any change | At least 30 days |
| Early-adopter benefit | 6 months free + locked-in price (€3.99/month or €35/year) for life of the subscription |
| Data portability | Decks always exportable as PSTUDY .txt (see UI-24) |

**Why these specific values:**

- **50-user cap** — chosen by the founder as a realistic limit on how many people one person can actually talk to and support during a learning beta. Better to genuinely help 50 than spread thin across 200. A waitlist beyond 50 also becomes a launch asset.
- **Q3 2026 (a quarter, not a date)** — software ships when it ships. Committing to a quarter gives a useful expectation without breaking trust on slippage. The 30-days-notice promise costs nothing and converts user anxiety into trust.
- **6 months free + locked-in price** — gives early users a tangible, immediate benefit (6 months free is meaningful), then transitions them to paying customers at the exact price they signed up expecting. The locked-in price is a forever-perk that costs you nothing today and only matters when you eventually raise prices, at which point loyal early users get a small deserved win. Generous without being lossy.

**What this means in practice:**
- All users sign up and use everything for free during the beta.
- The pricing page shows real future prices (FD-01) but CTAs go to "Join the private beta" rather than to Paddle Checkout.
- The /signup form enforces the 50-user cap and routes overflow to a waitlist.
- During beta, you collect email signups, observe usage, fix bugs, and refine the product.
- Apply for Paddle approval during this period.
- When ready, flip the `PAYMENTS_LIVE` config flag — the same CTAs now route to Paddle Checkout. Existing beta users are honored with the 6-months-free + locked-price benefit recorded in their account.

**Why this works well with Paddle:**
- You don't pay any Paddle fees during the free period.
- Paddle approval takes 2–4 weeks anyway; private beta gives you that window naturally.
- When payments go live, you have real users with real intent — Paddle approval and your launch align cleanly.

**Why this is the right launch strategy for PSTUDY:**
- You have zero user feedback today. The most important thing in the next months is *learning what's actually broken* — not earning revenue.
- Free signups will be 5–10x higher than paid signups, giving you a real testing population.
- "I was a beta user" is a status some users genuinely value — turn it into a marketing asset.
- Reduces pre-launch engineering work — you don't need payment integration before launch.

**Beta communication template (use this exact wording on the /pricing banner, /signup page, signup confirmation, and outreach):**

> "PSTUDY is in private beta — free for everyone, capped at 50 users. We expect to launch paid plans in Q3 2026 (July–September). When we do, beta users get 6 months free, then a locked-in price of €3.99/month (or €35/year) for as long as your subscription stays active. You'll receive at least 30 days notice before any change, and your decks are always exportable at any time."

**Implementation dependency:** the "decks are always exportable at any time" promise is currently not true — see new Tier 1 item `UI-24` (deck export), which must ship before any beta outreach using this wording.

---

## Tier 1 — Pre-launch must-fix

These are the items that would actively repel a first user, look unfinished to a buyer, or block your acquisition strategy. Ship these before any marketing push.

### LEG-01 — Wave 1 GDPR & legal documents (minimum legal operating requirements) ✅ SHIPPED

- [x] Privacy policy published at `/privacy`
- [x] Terms of Service published at `/terms`
- [x] Cookie policy published at `/cookies`
- [x] Confirm Supabase is configured for an EU region — confirmed `eu-west-3` (Paris)
- [x] Set up `privacy@pstudy.be` email address as the data protection contact (alias to `contact@pstudy.be` — see OPS-02)
- [x] Add links to Privacy, Terms, Cookies in the website footer (global footer via `SiteFooter` component, renders on public AND authenticated pages)
- [x] No cookie consent banner needed — PSTUDY uses only essential first-party cookies (Supabase auth session)
- [x] Signup consent checkbox links to Terms and Privacy Policy (target=_blank)

**Implementation notes:**
- Documents are in English only; NL/FR translations deferred until a school customer requires them
- `SiteFooter` is a single global component rendered from `ClientProviders` so legal links appear on every route
- AI generation logging policy: PSTUDY does NOT retain a server-side log of AI inputs (verified by Cursor codebase grep). Privacy policy reflects this honestly. OpenAI's 30-day API retention for abuse monitoring is disclosed in the sub-processor section.
- Vercel infrastructure cookies (DDoS protection, edge routing) disclosed in `/cookies`
- Deployed via commit `c8b36b8` on main

**Depends on:** FD-05 ✅

**What this is:** The minimum legal documentation and configuration required to operate publicly with users in the EU. Without these, you can't legally start private beta.

**Cursor brief:**

> "Implement Wave 1 GDPR/legal requirements for PSTUDY.
>
> **1. Privacy policy.** Create a page at /privacy with a comprehensive privacy policy covering: what data is collected (email, name, deck content, practice activity, AI generation inputs), why (account creation, providing the service, AI generation), legal basis (consent, contractual necessity), retention periods, sub-processors (OpenAI, Vercel, Supabase, email provider — list each with their role and location), data subject rights (access, rectification, erasure, portability, objection), how to contact us about privacy (privacy@pstudy.be), and the right to lodge a complaint with the Belgian Data Protection Authority (Gegevensbeschermingsautoriteit / Autorité de protection des données). Use a known template (e.g. Termly, GetTerms, iubenda, or adapt openly available policies from companies whose practices you respect — Linear, Notion, Cal.com all have well-written privacy policies). Match PSTUDY's existing site styling.
>
> **2. Terms of Service.** Create a page at /terms covering: who PSTUDY is (Tesco Engineering BV, address, VAT number, contact email), what the service is, user obligations, acceptable use (no illegal content, no harassment, no misuse of AI generation), account termination, intellectual property (PSTUDY trademark, user retains ownership of their deck content), liability limitations, governing law (Belgian), dispute resolution. Again use a template adapted to PSTUDY's specifics.
>
> **3. Cookie policy.** Either a dedicated page at /cookies or merged into the privacy policy. List each cookie set by PSTUDY, its purpose (essential vs analytics vs marketing), duration, and whether it's first or third party. If PSTUDY only uses essential cookies (auth, session), this is short.
>
> **4. Cookie consent banner.** If PSTUDY uses any non-essential cookies (analytics, marketing pixels, etc.), add a cookie consent banner that lets users accept/reject non-essential cookies before they're set. Use a library like CookieYes, Cookiebot, or a self-built minimal version. If only essential cookies are used, a simpler 'we use essential cookies' notice without a consent gate is enough.
>
> **5. Footer links.** Add Privacy, Terms, Cookies links to the marketing site footer (already in MKT-01's brief but confirm here).
>
> **6. Verify Supabase region.** Open the Supabase project settings and confirm the database is in an EU region (Frankfurt eu-central-1, Dublin eu-west-1, or Paris eu-west-3). If it's currently US-based, plan a migration — this is non-negotiable for school and corporate sales. Note: migration may require a maintenance window.
>
> **7. Set up privacy@pstudy.be email.** Either a real mailbox or an alias forwarding to the founder's main inbox. Reference it in the privacy policy.
>
> All documents should be available in at least English; ideally also in NL and FR matching the site's existing language switcher."

**How to test it worked:**
- /privacy, /terms, /cookies are accessible and reasonable in content ✓
- Footer links to all three ✓
- Cookie consent banner (if applicable) shows for new visitors ✓
- Supabase is confirmed EU region ✓
- privacy@pstudy.be receives mail ✓

---

### MKT-01 — Rebuild the home page ✅ SHIPPED

- [x] Replace generic H1 with the chosen positioning sentence (see FD-03)
- [x] Add at least one product screenshot or 30-second demo video *(placeholders in place at `/public/screenshots/practice.png`, `/public/screenshots/flashcard.png`, `/public/screenshots/multiple-choice.png` — real PNGs to follow)*
- [x] Surface the tagline (currently hidden behind the (i) icon)
- [x] Rewrite feature bullets as benefits, not features
- [x] Add a footer with real links (Pricing, For Schools, Privacy, Contact)
- [x] Add a header link to a Pricing page
- [x] Primary CTA reads "Join the private beta" and routes via the `getPrimaryCtaUrl()` helper
- [x] EU trust strip ("🇪🇺 Made in Europe · GDPR-native · Hosted in the EU") rendered below CTAs

**Depends on:** FD-03 ✅

**What this fixes:** The home page is currently the bottleneck. Visitors get a generic promise, hidden value proposition, no proof, no price, and no path to learn more. For a product with no users yet, the home page is the entire acquisition funnel.

**Cursor brief (copy-paste this into Cursor):**

> "Rebuild the marketing home page at the root route.
>
> **1. Headline.** Replace the current H1 'Study more effectively' with a two-tier headline:
> - H1 (large, bold): `Flashcards, exams, and peer-reviewed shared decks.`
> - Subhead (smaller, lighter weight, immediately below H1): `Made in Europe, built for serious teachers and learners.`
>
> Remove the small (i) info icon below the H1 — its content is now baked into the subhead. The current hidden tagline (the one explaining 'Build exercises for languages, vocabulary, or any subject...') can move to a small paragraph further down the page if useful, or be deleted.
>
> **2. CTAs.** Replace the current 'Start free trial' button text with **'Join the private beta'** as the primary CTA. Keep **'Log in'** as the secondary CTA. The primary CTA URL must be wired through the routing helper described in MKT-02 section 4 (the `PAYMENTS_LIVE` config flag) — during beta it routes to `/signup`, after the cutover it routes to Paddle Checkout. Do NOT hardcode `/signup`.
>
> **3. EU trust strip.** Below the CTAs, add a small horizontal strip with three trust signals separated by middots: `🇪🇺 Made in Europe · GDPR-native · Hosted in the EU`. Use small grey text. This carries the European credential without restricting the audience.
>
> **4. Product screenshots.** Below the trust strip, add a section with 3 screenshot placeholders in a row. The image files don't exist yet — render a neutral placeholder div for each (with the filename written inside as a label) so I can drop real PNGs in later without code changes:
> - `/public/screenshots/practice.png` — caption: 'Practice with straight-answer mode'
> - `/public/screenshots/flashcard.png` — caption: 'Flip flashcards on any device'
> - `/public/screenshots/multiple-choice.png` — caption: 'Multiple choice with images and maps'
>
> **5. Benefit-led features list.** Rewrite the existing Features list as benefits in the user's voice. Each line should describe what the user can *do*, not what the system *has*. Examples:
> - 'Straight answer, flashcards, and multiple choice' → 'Practice the way that fits your subject — type, flip, or pick'
> - 'Speech recognition: speak answers in practice' → 'Speak your answers out loud — ideal for languages'
> - 'Random order and repeat-mistakes mode' → 'Drill the cards you got wrong, in random order'
> - 'Timed examinations' → 'Run real timed exams with shareable invite links'
> - 'Import existing PSTUDY .txt decks' → 'Bring your old decks across in one click'
> - 'Works on any device in the browser' → 'No installation — works on your laptop, tablet, or phone'
>
> Keep the green checkmarks.
>
> **6. Footer.** Add a footer with these links: Pricing, For Schools, Privacy, GDPR, Contact, Help, Blog. For now they can all link to `#` or to placeholder pages — we'll fill them in next.
>
> **7. Top-nav.** Add 'Pricing' and 'For Schools' to the top header navigation, between the logo area and Help.
>
> Don't change the language switcher or the login button styling. Keep the existing teal/green color scheme."

**How to test it worked:**
- The home page H1 is `Flashcards, exams, and peer-reviewed shared decks.` ✓
- The subhead `Made in Europe, built for serious teachers and learners.` is visible immediately below ✓
- The (i) info icon is gone ✓
- Primary CTA reads `Join the private beta` (not `Start free trial`) ✓
- Secondary CTA reads `Log in` ✓
- The EU trust strip is visible below the CTAs ✓
- Three screenshot placeholders render at `/public/screenshots/practice.png`, `/public/screenshots/flashcard.png`, `/public/screenshots/multiple-choice.png` ✓
- The features list reads as benefits, not features ✓
- Footer is present with the listed links ✓
- 'Pricing' and 'For Schools' appear in the top nav ✓
- The language switcher (EN/DE/ES/FR/IT) still works ✓

---

### MKT-02 — Real pricing on the home page + build /pricing page + minimal /signup flow + `PAYMENTS_LIVE` config ✅ SHIPPED

- [x] Replace the placeholder text on the home page with real pricing
- [x] Build a Pricing page at `/pricing` with the full beta-terms banner, three-tier table, Community sub-tiers, top-ups, and an FAQ
- [x] Build a minimal `/signup` page that captures name + email, creates a Supabase auth user, enforces the 50-user cap, and routes overflow to a waitlist
- [x] All paid-plan CTAs across the site route via a `PAYMENTS_LIVE` config helper (during beta → `/signup`; after cutover → Paddle Checkout)
- [x] `BETA_SIGNUP_CAP` env var made server-side configurable (defaults to 50; set in Vercel env vars)
- [x] Cap enforcement and waitlist fallback verified end-to-end (signup → DB write → confirmation screen)
- [x] SQL migration run in Supabase — `beta_signups` and `waitlist` tables exist with RLS policies

**Depends on:** FD-01 ✅, FD-08 ✅ (finalized — 50-user cap, Q3 2026 paid launch, 6 months free + locked-in price)

**What this fixes:** The home page currently says "€x/month" as a placeholder, which kills conversion. We need real pricing visible. Because we're launching as a private beta (FD-08), CTAs route to a beta signup form (with a 50-user cap and waitlist fallback), not to live payment yet. The `PAYMENTS_LIVE` helper makes the eventual cutover to Paddle a one-flag flip.

**Cursor brief (consolidated — covers /pricing, /signup, and the routing config; pair with the MKT-01 brief for the home-page work):**

> "Three deliverables: a /pricing page, a minimal /signup page with cap+waitlist enforcement, and a `PAYMENTS_LIVE` config helper used by all paid-plan CTAs across the site.
>
> ### A. Home page pricing summary
>
> On the home page, find the line containing '€x/month' and replace with this exact text:
>
> 'Free to start. €3.99/month for unlimited decks and AI generation. From €299/year for schools and language schools.'
>
> Below that line, add a link 'See full pricing →' routing to `/pricing`.
>
> ### B. /pricing page
>
> Create a new page at `/pricing`. Match existing site styling.
>
> **Beta banner at the top of the page** — visible to everyone, regardless of auth state. Use this exact wording:
>
> > 'PSTUDY is in private beta — free for everyone, capped at 50 users. We expect to launch paid plans in Q3 2026 (July–September). When we do, beta users get 6 months free, then a locked-in price of €3.99/month (or €35/year) for as long as your subscription stays active. You'll receive at least 30 days notice before any change, and your decks are always exportable at any time.'
>
> Style it as a soft info card (light blue or light teal background, NOT alarm colors), full-width across the top of the page below the header.
>
> **Three-column comparison table** below the banner:
>
> - **Free** — €0 — 3 decks, 100 cards total, all practice modes, no AI, no exams. CTA: 'Join the private beta' (routes via the `PAYMENTS_LIVE` helper).
> - **Personal** — €3.99/month or €35/year (with annual toggle showing 'save €13/year') — Unlimited decks, AI generation (500 credits/month), all practice modes, share to PstudyCommunity, top-ups available. CTA: 'Join the private beta' (routes via the `PAYMENTS_LIVE` helper).
> - **Community** — From €299/year — For schools, language schools, training orgs. MyCommunities, exams, peer review, admin dashboard, GDPR DPA, 500 AI credits per seat per month (pooled). CTA: 'Contact us for schools' → routes to `mailto:hello@pstudy.be` (or `/contact` if that page exists). NOT routed via the `PAYMENTS_LIVE` helper.
>
> **Community sub-tiers section** — below the main table, in a smaller layout (three cards or a compact table):
> - Starter — up to 25 seats — €299/year
> - Standard — up to 100 seats — €699/year
> - Enterprise — 100+ seats — Quote
>
> **Top-ups section** — below that, titled 'Top-ups':
> 'Run out of AI credits? Add more anytime: €3 / 250 credits, €5 / 500 credits, €9 / 1,000 credits. No expiration. Available on Personal and Community plans.'
>
> **FAQ section (recommended)** — a small accordion at the bottom answering: 'What's an AI credit?', 'What happens when paid plans launch?', 'Can I cancel anytime?', 'Do you have a refund policy?', 'Are my decks really exportable?'. Keep answers short — one or two sentences each.
>
> Add `/pricing` to the top-nav (also covered in MKT-01).
>
> ### C. /signup page (private beta intake with 50-user cap)
>
> Create a new page at `/signup`. This is the destination of the `PAYMENTS_LIVE`=false branch — i.e. every 'Join the private beta' CTA during the beta period.
>
> **Layout:**
> - Heading: 'Join the PSTUDY private beta'
> - Sub-heading: 'Free during beta. 50 spots, then a waitlist.'
> - Body paragraph repeating the beta terms — use the exact same wording as the /pricing banner above (6 months free + locked-in price + 30 days notice + decks exportable).
> - Form fields: Name (required), Email (required), Optional: 'What will you use PSTUDY for?' (free text, helps me learn who's signing up).
> - Checkbox: 'I understand PSTUDY is in private beta and the product may change.' (required, unchecked by default)
> - Submit button: 'Join the beta'
>
> **Submission behavior:**
>
> 1. Before creating the user, count the rows in the beta signups table (or `users` table if extended). If the count is less than 50, accept the signup.
> 2. **If accepted:** create a Supabase auth user via the standard helpers, send Supabase's standard magic-link / email-confirmation flow. Store name and the optional 'what will you use it for' answer in the user's profile row. Show a confirmation screen: 'Welcome — check your email to confirm your account. Once confirmed you can log in and start using PSTUDY.'
> 3. **If the cap is full (>= 50):** do NOT create the user. Instead, store email + name + use_case_note in a `waitlist` table and show a confirmation screen: 'Beta is full — you're on the waitlist. We'll email you when a spot opens or when paid plans launch.'
>
> **Database changes** (decide which approach is cleaner and document your choice):
> - Either extend the existing `users` table (or auth.users metadata) with: `name`, `signup_source` ('beta' / 'waitlist'), `use_case_note`.
> - Or create a separate `beta_signups` table for richer beta-only metadata.
> - Either way, create a `waitlist` table: id, email, name, use_case_note, created_at.
>
> Use Supabase's standard auth helpers — don't roll your own.
>
> ### D. `PAYMENTS_LIVE` config helper
>
> Wrap all paid-plan CTA URLs across the site (home page primary CTA, /pricing 'Join the private beta' buttons on Free and Personal columns) in a small utility.
>
> Suggested implementation: create `lib/cta-routing.ts` exporting a function `getPrimaryCtaUrl()` that reads `process.env.NEXT_PUBLIC_PAYMENTS_LIVE`. When the flag is `false` or unset, the function returns `/signup`. When `true`, it returns the future Paddle Checkout URL (leave as a `TODO` placeholder for now — we'll wire it up in BIZ-01).
>
> Use this helper everywhere paid CTAs are rendered, so flipping the flag in Vercel later switches all CTAs at once.
>
> Add `NEXT_PUBLIC_PAYMENTS_LIVE=false` to `.env.example` with a comment explaining its purpose.
>
> The 'Contact us for schools' CTA on the Community column is NOT routed through this flag — it always goes to mailto/contact.
>
> ### E. Reporting back
>
> When done, tell me:
> - Every file you created or modified, with paths
> - Whether you extended the `users` table or created a `beta_signups` table, and the exact schema you used
> - The exact `waitlist` table schema you created
> - Which footer links you left as `#` placeholders so I know what's still to build
> - Anything you had to change about the existing layout to accommodate the new top-nav items
> - The exact env var name(s) you added"

**How to test it worked:**
- Home page no longer says '€x/month' — replaced with the real pricing summary line ✓
- 'See full pricing →' link routes to /pricing ✓
- /pricing exists with: top beta banner (full FD-08 wording), three-tier table, Community sub-tiers, top-ups, FAQ ✓
- All Free / Personal CTAs route via `getPrimaryCtaUrl()` ✓
- 'Contact us for schools' opens mailto or /contact (NOT through the helper) ✓
- /signup form exists and creates a Supabase user when under the 50-cap ✓
- Setting the cap to 1 temporarily and signing up a second time correctly routes to the waitlist screen and writes to the `waitlist` table ✓
- 'Pricing' in top-nav links to /pricing ✓
- Annual/monthly toggle on Personal works ✓
- `NEXT_PUBLIC_PAYMENTS_LIVE` exists in `.env.example` and the helper reads it ✓
- Beta banner wording matches the FD-08 communication template exactly ✓

---

### UI-01 — Replace the orange banner with a small neutral strip (logged-out only)

- [x] Remove the existing orange "under construction" banner
- [x] Add a small neutral grey strip in its place, visible only to logged-out visitors
- [x] Strip wording: "PSTUDY is in active development — features may change."
- [x] Hide the strip entirely for logged-in users

**Depends on:** FD-02 ✅

**What this fixes:** The current orange banner reads "PSTUDY Online is under construction. Features may change." and appears on every page. The orange color signals alarm; the wording sounds like a disclaimer; and showing it to logged-in users (who already accepted the development state by signing up) is unnecessary. Per FD-02, we soften it to a neutral grey strip with friendlier wording, and hide it once a user is authenticated.

**Cursor brief (copy-paste this into Cursor):**

> "Two changes:
>
> **1. Soften the banner.** Find the existing component that renders the orange 'PSTUDY Online is under construction. Features may change.' banner at the top of every page. Replace it with a small, neutral horizontal strip:
> - Background: a light neutral grey (e.g. Tailwind `bg-gray-100` or similar — NOT orange, NOT any alert color)
> - Text: 'PSTUDY is in active development — features may change.'
> - Text style: small (e.g. `text-sm`), grey (e.g. `text-gray-600`), centered, no arrow, no link — purely informational
> - Position: same as today's banner (top of the page, above the header)
> - Single line, much less visually prominent than the current orange version
>
> The language switcher (EN/DE/ES/FR/IT) should remain visible in roughly its current position alongside the strip.
>
> **2. Conditional display — logged-in users do not see the strip.** Make the strip render ONLY when the user is NOT authenticated. We use Supabase for auth — check the user's session via the standard helpers (likely `createServerComponentClient` for server components, or `useUser()` / `useSession()` for client components). When a logged-in user is on any authenticated page (My decks, deck editor, practice, exams, MyCommunities, etc.), the strip is hidden entirely.
>
> Do NOT create a changelog page. Do NOT add 'What's new' links. The strip is purely an informational notice for first-time visitors — nothing more.
>
> Tell me which file paths you modified at the end."

**How to test it worked:**
- Log out → orange banner is gone, replaced by a small neutral grey strip ✓
- Strip text reads exactly: "PSTUDY is in active development — features may change." ✓
- Strip background is neutral grey, not orange or any alert color ✓
- Strip is much less visually prominent than the previous orange banner ✓
- Log in → strip is gone entirely on My decks and other authenticated pages ✓
- Language switcher (EN/DE/ES/FR/IT) still works in both states ✓
- No 'PSTUDY Online is under construction' text visible anywhere ✓
- No /changelog page was created ✓

---

### UI-02 — Fix the broken "exam.items" string in the exam list ✅ SHIPPED

- [x] Replace placeholder template variable with real value (shipped 2 May 2026)

**What this fixes:** On the "Created by me" exam list, each exam shows something like "Invites: 3 · exam.items". The text `exam.items` is a template variable that wasn't replaced — it should be the number of questions. To a teacher evaluating PSTUDY for school use, this reads as "this product isn't finished".

**Cursor brief:**

> "On the Exams page in the 'Created by me' tab, each exam card shows a line like 'Invites: 3 · exam.items'. The string 'exam.items' is a missing template interpolation — it should display the number of questions in the exam. Find the exam card component, look at the data being passed in, and render the actual count. The display should be something like 'Invites: 3 · 9 questions' or '9 items'. Verify it reads correctly for exams of different sizes."

**How to test it worked:**
- The exam card no longer shows the literal text 'exam.items' ✓
- It shows the actual question count ✓

---

### UI-03 — Default the practice "Exercise setup" panel to collapsed ⚠️ SUPERSEDED BY UI-25

**Note:** This item is now superseded by `UI-25` (Practice session structure and controls). UI-25 takes the opposite approach — keep the setup panel **open** by default with an explicit "Start practice" button at the bottom of the panel. The session formally begins on click. This is a better solution to the same underlying problem (auto-starting practice before the user has dialed settings).

If UI-25 ships, UI-03 is no longer needed and should be skipped. Keeping it documented here so the reasoning chain is clear.

- [ ] ~~Setup panel collapsed by default~~ — replaced by UI-25's explicit Start button
- [ ] ~~Summary line shows current settings when collapsed~~ — replaced by UI-25's Start button + collapsing-after-start behavior

**What this fixes:** When a user starts practicing a deck, the Exercise setup panel is expanded by default and takes up about half the screen. The actual question becomes secondary. Users come here to practice, not to configure. On mobile this is even worse — the question can be pushed off-screen entirely.

**Cursor brief:**

> "On the practice screen, the 'Exercise setup' panel currently defaults to expanded. Change the default to collapsed. When collapsed, show a single summary line that displays the current settings, like: '▶ Exercise setup (Explanation · Straight answer · Normal order · Speak on)'. Clicking the summary line expands the panel. The user's choice (expanded vs collapsed) should persist for that deck across sessions — store it in localStorage keyed by deck ID, or in a user preference if we have a preferences table.
>
> Apply the same default-collapsed behavior on flashcard practice and multiple-choice practice. Confirm the panel still works correctly when expanded — Speech language picker, keyword cloze checkbox, listen/speak toggles all functional."

**How to test it worked:**
- Open practice on a deck → setup is collapsed, summary line visible ✓
- Click the summary → panel expands ✓
- Settings still work when expanded ✓
- Reload the page → preference is remembered ✓

---

### UI-04 — Mobile header: collapse to hamburger menu

- [ ] Top nav becomes a hamburger menu below ~768px width

**What this fixes:** On mobile, the header navigation wraps over two lines (sometimes more on the deck editor). It eats vertical space and looks messy. Standard mobile pattern is a hamburger icon that opens a drawer.

**Cursor brief:**

> "On mobile (viewport width below 768px), replace the horizontal top navigation with a hamburger menu (three lines icon, top-right). The PSTUDY logo stays top-left. When tapped, the hamburger opens a slide-out drawer or full-screen overlay containing all the nav links currently in the header (My decks, Import .txt, Exams, MyCommunities, PstudyCommunity, Help, Account, Sign out). On viewports above 768px, the existing horizontal nav remains.
>
> Use a Tailwind responsive breakpoint (`md:hidden` for the hamburger, `hidden md:flex` for the existing nav). The drawer can be a simple absolute-positioned div with a backdrop. Keep the language switcher accessible — either in the drawer or still visible in the top bar."

**How to test it worked:**
- Resize browser to under 768px → hamburger appears, horizontal nav hidden ✓
- Tap hamburger → drawer opens with all links ✓
- Tap a link → navigation works, drawer closes ✓
- Resize back wider → horizontal nav returns ✓

---

### UI-05 — Move the "Listening" indicator off the answer input

- [ ] Listening pill no longer overlaps the typed text on mobile

**What this fixes:** On mobile, when speech recognition is active, the "● Listening" pill sits on top of the answer input field, covering the last few characters of the typed text. On a phone with a thumb-typed answer, this is genuinely confusing.

**Cursor brief:**

> "On the practice screen, when 'Speak' is enabled the 'Listening' pill currently appears beside the answer input. On mobile this overlaps the input text. Move the Listening indicator to a position that does not overlap the input on any screen size — either above the input (right-aligned, small) or below it (left-aligned, small). Keep the green dot and the word 'Listening'. Should be visible but unobtrusive."

**How to test it worked:**
- Enable Speak on practice → Listening pill is visible ✓
- Type a long answer on mobile → text is not covered ✓
- Listening state still indicates clearly when mic is active ✓

---

### UI-06 — Fix the dropdown clipping on mobile (deck editor)

- [ ] Field of interest, Topic, Deck language dropdowns stack on mobile

**What this fixes:** On mobile, the deck setup section shows three dropdowns side-by-side (Field of interest, Topic, Deck language) and the leftmost one is too narrow — "Languages" gets clipped to "Langua" inside the dropdown. The fix is to stack them vertically below ~640px width.

**Cursor brief:**

> "In the deck editor, the Deck setup section has three dropdowns in a row: Field of interest, Topic, Deck language. On mobile (below 640px), these don't fit and clip the values. Change the layout to stack them vertically on mobile — each dropdown full width, one per row. Above 640px, keep the current 3-column layout. Use Tailwind's grid: `grid grid-cols-1 sm:grid-cols-3 gap-4`."

**How to test it worked:**
- Mobile (under 640px): three dropdowns stacked vertically, full width, no clipping ✓
- Tablet/desktop (640px+): three dropdowns side by side ✓

---

### UI-07 — Examinee assigned-exams: show critical metadata

- [ ] Card shows question count, deadline, assigner name, language

**What this fixes:** When a student opens 'Assigned to me' to take an exam, the card currently shows '30 min · Multiple choice · Not started'. Missing: how many questions, when the exam is due, who assigned it, what language. A student about to start a 30-minute timed exam needs all four.

**Cursor brief:**

> "On the 'Assigned to me' exams page, each exam card needs more information. Currently it shows '[Title]' and '[type] · [duration] · [status]'. Add: number of questions, deadline (if set, otherwise 'No deadline'), and who assigned it (organiser email or name). Also add the deck/exam language if available.
>
> Layout: title on the first line, then a metadata row showing 'X questions · Y min · Due [date] · Assigned by [name]'. Use small grey text for metadata. Keep the Start exam and Delete buttons on the right.
>
> If the exam has a deadline that has passed, the Start exam button should be disabled and show 'Exam closed'."

**How to test it worked:**
- An assigned exam shows question count, duration, deadline, assigner ✓
- Past-deadline exams are disabled with clear messaging ✓

---

### UI-08 — Exam organiser: add a "Confirm before start" step

- [ ] Starting an exam requires explicit confirmation

**What this fixes:** The Start exam button is the same green pill as every other primary button. Clicking it starts a timer that can't be paused. A misclick costs a student real time.

**Cursor brief:**

> "When a student clicks 'Start exam' on the assigned-exams page, instead of immediately starting the timer, show a confirmation modal. The modal should say: 'Start [exam title]? You'll have [X] minutes from when you confirm. The timer cannot be paused. Submit when finished or the timer ends.' Two buttons: 'Cancel' (secondary style) and 'Start now' (primary, the action that actually starts the timer). Cancel returns to the assigned-exams page; Start now begins the exam."

**How to test it worked:**
- Click Start exam → confirmation modal appears ✓
- Cancel → no timer started, back on the list ✓
- Start now → timer starts, exam screen loads ✓

---

### UI-09 — Exam list: visual status differentiation

- [ ] Different colours for Not started / In progress / Submitted

**What this fixes:** On the exam detail page, the per-examinee list shows 'Status: Not started' three times in identical grey. When statuses differ, the page should make it instantly scannable which students need a nudge.

**Cursor brief:**

> "On the exam detail page (organiser view), the per-examinee list and the Results section show student status. Currently all statuses render as identical grey text. Apply colour: 'Not started' = grey, 'In progress' = amber, 'Submitted' = green, 'Submitted' with score should also show the score in green. Use small coloured pills/badges, not plain coloured text. Match the badge style used elsewhere (Draft, Shared, etc.)."

**How to test it worked:**
- Mixed-status exam shows three different visual states clearly ✓
- An organiser scanning a class of 30 can find unfinished students at a glance ✓

---

### UI-10 — AI generation: preview before save

- [ ] Generated cards appear in a preview screen before being saved as a deck

**What this fixes:** Currently, clicking 'Generate deck' produces a deck and saves it. Bad cards have to be deleted afterward in the editor. A preview-and-pick model is dramatically better UX and builds trust in the AI feature.

**Cursor brief:**

> "On the AI generate page, change the flow so that after generation, results appear in a preview screen rather than being immediately saved. The preview screen shows each generated card (question + answer + any MC distractors) with a checkbox next to it, all checked by default. The user can untick cards they don't want. At the bottom, two buttons: 'Save deck with selected cards' (primary) and 'Discard and try again' (secondary). Saving creates the deck with only the ticked cards. Discarding returns to the generate form with the source text preserved.
>
> While generating, show a progress indicator with an estimate ('Generating ~22 cards. This usually takes 15–45 seconds.'). After preview, also show a small note: 'AI output isn't always perfect — review before sharing.'"

**How to test it worked:**
- Generate a deck → preview screen appears ✓
- Untick some cards, click Save → deck contains only the ticked cards ✓
- Discard → no deck saved, source text still in the form ✓

---

### UI-11 — Show character count on AI generation source field

- [ ] Live counter against the 40k limit
- [ ] Warn when approaching limit

**What this fixes:** The Help page mentions a 40,000 character limit on AI source text. The form does not show this. Users paste a whole textbook chapter, get a truncated result, and don't know why.

**Cursor brief:**

> "On the AI generate page, below the source text input, add a live character counter. Display as 'X / 40,000 characters'. Below 30,000 characters: grey text. Between 30,000 and 40,000: amber. Above 40,000: red, with a warning 'Only the first 40,000 characters will be used. Consider splitting your source into sections.' Counter updates in real time as the user types or pastes."

**How to test it worked:**
- Paste 5,000 characters → counter shows '5,000 / 40,000' in grey ✓
- Paste 35,000 → amber ✓
- Paste 50,000 → red, warning shown ✓

---

### UI-12 — Make the AI generate vs Import zones visually distinct

- [ ] Different colour, icon, or label so users can tell them apart

**What this fixes:** The Import .txt page has two near-identical drop zones doing different things. A user dropping the wrong file in the wrong zone either fails silently or burns AI tokens on structured data.

**Cursor brief:**

> "On the Import .txt page, the 'Import PSTUDY .txt file' zone and the 'Generate deck from text (AI)' zone look almost identical. Make them visually distinct:
>
> - Import zone: keep the current style, add a small download/import icon, header in dark grey.
> - AI generate zone: add a sparkle or magic-wand icon, header with a subtle accent colour (maybe the existing teal), and a one-line subhead 'Turn raw text — notes, a chapter, a webpage — into a starter deck using AI.'
>
> Also rewrite the help text to reduce overlap. Import: 'Drop a PSTUDY .txt file here to load an existing deck.' AI: 'Drop a .txt file or paste raw text — we'll generate flashcards or multiple-choice questions.'"

**How to test it worked:**
- The two zones are clearly distinguishable at a glance ✓
- The icons and colours match the existing visual language ✓
- The help text makes it obvious which is which ✓

---

### UI-13 — Empty states for new users

- [ ] My decks empty state with sample decks or guidance
- [ ] Deck editor empty state when a deck has 0 items

**What this fixes:** A new user lands on My decks with zero decks. We don't know what they see today, but if it's just an empty list with 'New deck' and 'Merge decks' buttons, that's a missed onboarding moment. Same for opening a freshly-created empty deck.

**Cursor brief:**

> "Two empty states to add:
>
> 1. **My decks empty state** — when the logged-in user has zero decks, replace the deck list with a welcoming block. Include three CTAs: 'Create your first deck' (links to new deck flow), 'Generate a deck from text with AI' (links to /import), and 'Browse the community library' (links to PstudyCommunity). Above these, two or three sample/featured decks the user can practice with one click — for now, hardcode two: 'European capitals' and a basic vocabulary deck. (We'll seed a real sample-deck system later.)
>
> 2. **Deck editor empty state** — when a deck has zero items, instead of an empty table, show a centered block: 'This deck is empty. Add your first card →' with the Add item button highlighted. Include a small secondary link: 'Or import from a .txt file' linking to /import.
>
> Match the existing visual language. Keep it warm and short."

**How to test it worked:**
- New account with no decks → empty state shows, sample decks practicable ✓
- Open a brand-new empty deck → friendly empty state, not a blank table ✓

---

### UI-14 — Standardise header navigation across pages

- [ ] Same nav links in the same order on every page

**What this fixes:** The top navigation order changes between pages — My decks shows one order, the deck editor shows another. Users have to relearn the navigation per page.

**Cursor brief:**

> "Audit the top navigation across all logged-in pages: My decks, deck editor, practice, exams, exam detail, Import .txt, MyCommunities library, Manage MyCommunities, PstudyCommunity, Account. Make sure all of them use the same header component with the same links in the same order. The recommended order is: My decks, MyCommunities, PstudyCommunity, Import .txt, Exams, Help, Account, Sign out. Sign out should be last and visually slightly less prominent than the rest. If different pages today use different layouts, consolidate to a single shared layout component."

**How to test it worked:**
- Click through every authenticated page → header is identical ✓
- Same links, same order, same styling ✓

---

### UI-15 — Auto-collapse empty MC columns in the deck editor

- [ ] If a deck has no multiple-choice values, hide the MC columns by default

**What this fixes:** The deck editor shows MC1, MC2, MC3, MC4 columns by default. For a deck of language vocabulary pairs, these are empty and waste horizontal space — about 40% of the visible table.

**Cursor brief:**

> "In the deck editor table, look at whether any item in the deck has any MC field filled in. If none of them do, default the column-visibility toggle to hide the four MC columns (MC 1–4). The user can still show them via the existing 'MC, keywords, instruction' dropdown. If at least one item has any MC value, show the columns by default as today.
>
> This is a default-state change; don't remove the user's ability to manually show/hide columns."

**How to test it worked:**
- Open a language deck (no MC) → MC columns hidden by default ✓
- Open a deck with MC values → MC columns visible ✓
- The toggle still works to show/hide manually ✓

---

### UI-16 — Rename developer-facing labels in the practice screen

- [ ] "Show what was heard (debug)" → "Show what I said"
- [ ] "FRONT" label removed or renamed
- [ ] "Custom speech → answer mappings" relabeled

**What this fixes:** A few labels in the UI leak engineering language to users.

**Cursor brief:**

> "Three small label changes:
>
> 1. In practice mode (straight answer), there's a checkbox labeled 'Show what was heard (debug)'. Rename to 'Show what I said' and remove the '(debug)' suffix.
>
> 2. On the flashcard practice screen, the question side has a label 'FRONT' inside the card. Either remove this label entirely (the card itself is enough) or rename to 'Question'.
>
> 3. The 'Custom speech → answer mappings (this deck)' section has a technical-sounding name. Rename to 'Speech recognition tweaks for this deck' and add a one-line subhead: 'Tell PSTUDY when a spoken word should match a written answer (e.g. \"den helder\" should match \"Den Helder\").'"

**How to test it worked:**
- The three labels are renamed as specified ✓
- The functionality behind each is unchanged ✓

---

### UI-24 — Deck export (so the "decks are always exportable" promise is real)

- [ ] Logged-in users can export any deck they own as a PSTUDY .txt file
- [ ] "Export" action available from the My decks page (per-deck) and from inside the deck editor
- [ ] Round-trip verified: exported .txt re-imports identically
- [ ] Optional: bulk "Export all my decks" as a ZIP from the Account page

**Depends on:** none (can ship independently)

**What this fixes:** The private beta communication (FD-08) promises "your decks are always exportable at any time." Today, decks cannot be exported — only imported. We need to ship export before any user-facing beta communication that includes this promise. This is also a GDPR Art. 20 (data portability) building block that LEG-02 will rely on.

**Cursor brief:**

> "Add deck export functionality.
>
> **1. Per-deck export.** On the My decks page, each deck card has an action menu (or three-dot menu). Add an 'Export as .txt' option. Clicking it generates a PSTUDY-format .txt file containing all items in the deck, in the same format that the existing Import .txt feature accepts (so import-export is a round trip). The browser downloads the file with a filename like `[deck-name].txt`. Sanitize the deck name for the filename (replace spaces with hyphens, strip special characters).
>
> **2. Export from deck editor.** Inside the deck editor, add an 'Export' button near the existing actions (Save, etc.). Same behavior as the per-deck export.
>
> **3. Round-trip verification.** Make sure that exporting a deck and then re-importing the resulting .txt file produces an identical deck (same items, same fields, same order). If the current Import .txt format doesn't preserve all the fields the deck editor supports (MC distractors, keywords, instruction notes), extend the format to include them and document the format in a comment at the top of the exported file. Existing import behavior must remain backward-compatible.
>
> **4. Bulk export (optional, ship if straightforward).** On the /account page, add a 'Download all my decks' button that generates a ZIP file containing one .txt per owned deck. If implementing this requires significant work, defer it — the per-deck export is the must-have.
>
> Tell me which file paths you modified and confirm the round-trip test works."

**How to test it worked:**
- Open My decks → each deck has an "Export as .txt" action ✓
- Export a deck → .txt file downloads with sensible filename ✓
- Import the same .txt file → deck reappears identically (same items, same order, same fields) ✓
- Export from inside the deck editor → same behavior ✓
- (If implemented) Account page "Download all my decks" produces a working ZIP ✓

---

### UI-25 — Practice session structure and controls

- [ ] Explicit "Start practice" button — practice does not auto-begin on entry to the page
- [ ] Pause / Resume control during a session
- [ ] Transition screen between first-pass and mistake-drill phase
- [ ] Existing top-right progress indicator updated during drill phase to read "Drilling mistakes — N left" (instead of "Card 7 of 20")
- [ ] End-of-session summary screen with replay options
- [ ] Apply consistently across Straight Answer, Flashcard, and Multiple Choice modes

**Depends on:** none

**What this fixes:** The practice flow has no visible session structure. Practice begins immediately when the user opens it (before they've seen or adjusted settings), there's no way to pause if life interrupts, the transition from first-pass to mistake-drill is silent (so users feel confused when cards reappear), and at session end the user must navigate back to the deck to repeat — friction at exactly the moment when motivation is highest. Founder noticed all of this as a daily user; strangers will too.

**About the first-pass + mistake-drill behavior** (worth understanding before implementing): PSTUDY's practice flow has two phases. Phase 1 — every item appears once. Phase 2 — only the items the user got wrong are repeated, in a loop, until each has been answered correctly once. This is pedagogically sound (drill-until-mastery) and is one of PSTUDY's distinctive features. But today the transition between phases is invisible to the user. The fix is to make the transition explicit, not to remove it.

**Cursor brief:**

> "Add session structure to the practice flow.
>
> **1. Explicit start.** When the user opens practice for a deck, the Exercise setup panel is open by default and a prominent 'Start practice' button is at the bottom of the panel. The practice card area below is empty (or shows a 'Ready when you are' placeholder) until the user clicks Start. After clicking Start, the practice card appears and the session formally begins. The setup panel can still be expanded mid-session and changes still apply live (preserving the existing useful behavior of seeing settings take effect immediately), but the session has a clear 'I am practicing' state vs 'I am setting up'.
>
> **2. Pause / Resume.** Add a pause button (icon button, top-right of the practice card area) and bind it to the Esc key. Pausing freezes the current card, stops any timers/listeners (speech recognition off, listen autoplay off, no input captured), and shows a 'Paused — click Resume or press Esc to continue' overlay. Resume returns to the same card with state intact.
>
> **3. First-pass → mistake-drill transition screen.** When the first pass through the deck is complete, show a transition screen between Phase 1 and Phase 2. The screen should display:
>
> - Heading: 'First pass complete'
> - Score line: 'You got X of Y correct'
> - If the user has missed cards: 'You missed [N] cards. These will now repeat in random order until you've got each one right.' (random order in drill phase is a deliberate choice — it prevents position memorization. Make sure this is what the existing drill-phase code does. If it's not, change it.)
> - If the user got 100% first pass: 'You got everything right — nothing to drill. Practice again or end the session.'
> - Two buttons: 'Start drilling' (primary, large) and 'End session' (secondary, smaller). If 100% first pass, the buttons are 'Practice again' and 'End session'.
>
> **4. Drill-phase progress indicator.** During the drill phase, the existing top-right indicator (which currently shows 'Card 7 of 20' or similar) should change wording to 'Drilling mistakes — N left'. This makes the mode shift visible at all times, not just at the transition screen.
>
> **5. End-of-session summary screen.** When the drill phase completes (all mistakes answered correctly) OR the user clicks End session, show a summary screen with:
>
> - Score (already shown today, keep that wording)
> - Most-missed cards: top 3-5 cards the user got wrong most often, with question + answer for review (this helps the user see what to focus on)
> - Three action buttons:
> - 'Practice all again' — restarts the full session from scratch with the same settings
> - 'Practice my mistakes only' — runs only the cards the user got wrong in this session, skipping the first pass
> - 'Done' — returns to the deck overview
>
> **6. Apply across all three practice modes.** Straight Answer, Flashcard, and Multiple Choice all use the same session-structure pattern. Don't reimplement three times — extract the session-control UI into a shared component.
>
> **7. Don't break existing behavior.** Keyword cloze, free-recall + keyword grading, speech recognition, listen autoplay, custom speech mappings, language settings — all of these must continue working unchanged inside the new session structure.
>
> Tell me which files you modified and confirm that all three practice modes have the new flow."

**How to test it worked:**
- Open practice for a deck → setup panel visible, no card showing until 'Start practice' is clicked ✓
- Start a session → first card appears, top-right shows 'Card 1 of N' ✓
- Click pause / press Esc → session freezes with overlay, no input captured ✓
- Click resume → session continues from same card ✓
- Complete first pass with some mistakes → transition screen appears with score, missed-cards count, and Start drilling / End session buttons ✓
- During drill phase → top-right shows 'Drilling mistakes — N left' ✓
- Drill-phase order is random (verified by drilling a deck multiple times — order differs) ✓
- Drill phase complete → end-of-session summary with 3 replay buttons ✓
- Click 'Practice all again' → full session restarts ✓
- Click 'Practice my mistakes only' → only previously-missed cards run, skipping first pass ✓
- All three practice modes (Straight Answer, Flashcard, Multiple Choice) have the new flow ✓
- Keyword cloze, free-recall, speech, listen autoplay still work inside the new flow ✓

---

### UI-26 — Deck preview (read-only browse before practice)

- [ ] Read-only scrollable view of all cards in a deck
- [ ] Available from My decks (per-deck action) and from inside the deck editor
- [ ] "Start practice" button at top and bottom of the preview
- [ ] Optional: "Listen" button to auto-read each card aloud during preview

**Depends on:** none (independent of UI-25, but pairs naturally with it)

**What this fixes:** Today there's no way to browse a deck's contents before practicing it. A user opening someone else's PstudyCommunity deck has to start practice to see what's in it. A user returning to a deck they haven't touched in weeks wants to refresh themselves before being tested. A teacher reviewing a student's deck shouldn't have to drill it. PSTUDY had a preview function in an earlier version (founder's recollection); it should come back.

**Cursor brief:**

> "Add a deck preview view that lets users browse a deck's content read-only before practicing.
>
> **1. Entry points.** Two ways to reach preview:
> - From My decks: each deck card has a 'Preview' action (could go in the existing ⋯ menu next to 'Export as .txt', or as a small icon button on the card)
> - From inside the deck editor: a 'Preview' button next to the existing 'Practice' button
>
> **2. Preview page layout.** When the user clicks Preview, they land on a /deck/[id]/preview route (or similar). The page shows:
> - Deck title at the top, with metadata (author, language, item count)
> - A 'Start practice' button at the top-right (prominent)
> - A scrollable list of all cards in the deck. For each card, show:
> - The question (front of the card)
> - The answer (back of the card)
> - Any keywords highlighted (if the card has keywords)
> - Any MC distractors listed (if the card has them) — small/secondary
> - A 'Start practice' button at the bottom (so the user doesn't have to scroll back up)
>
> The view is read-only — no inputs, no scoring, no card-flipping animation. It's a browse view.
>
> **3. Optional Listen mode.** A small 'Listen to deck' button at the top that auto-reads each card aloud (question, then answer) using the same TTS PSTUDY uses elsewhere. Useful for language decks. Skip this if it adds significant complexity — Tier 1 ships without it.
>
> **4. Permissions.** The owner of the deck and any user with view access (e.g. via a shared MyCommunity, or a publicly-shared PstudyCommunity deck) can preview. Anyone without view access gets a 404.
>
> Tell me which files you modified."

**How to test it worked:**
- From My decks: ⋯ menu on a deck → Preview action → preview page loads ✓
- From deck editor: Preview button → preview page loads ✓
- Preview shows all cards, read-only ✓
- 'Start practice' at top and bottom both navigate to the practice page ✓
- A deck I don't have access to → 404 ✓
- (If implemented) Listen mode reads cards aloud ✓

---

### OPS-01 — Operational follow-ups from MKT-01 + MKT-02

- [ ] Replace the `Contact` footer link (currently `#`) with `mailto:hello@pstudy.be`
- [ ] Set up the `hello@pstudy.be` mailbox (or alias forwarding to founder's main inbox) — used by Community CTA on /pricing and the Contact footer link
- [ ] Decide what to do about the `/for-schools` placeholder page — either turn it into a real interest-capture page or hide the link from nav/footer until LEG-01 + a real schools page exist
- [ ] Configure custom SMTP for Supabase Auth emails (Resend / Postmark / SendGrid / SES) — the built-in Supabase sender is rate-limited (~3–4/hour) and unreliable for real launch
- [ ] Drop real screenshot PNGs into `/public/screenshots/practice.png`, `/public/screenshots/flashcard.png`, `/public/screenshots/multiple-choice.png` to replace the placeholder tiles on the home page
- [ ] Clean up test rows in Supabase `beta_signups` and `waitlist` tables created during cap-enforcement testing

**Depends on:** MKT-01 ✅, MKT-02 ✅

**What this is:** A grouped follow-up for the small operational items that surfaced while implementing the marketing site rebuild. Each one is small (5–30 minutes) but real — leaving them unfixed means dead-end clicks, missed sales leads, or unreliable email delivery on launch day.

**Why each item matters:**

- **`Contact` mailto fix** — the footer link currently goes nowhere. A first visitor wanting to ask a question can't. One-line code change.
- **`hello@pstudy.be` mailbox** — referenced from the Community CTA on /pricing. If a school principal clicks "Contact us for schools" and the email bounces, that's a lost sale. Test by sending yourself an email from a different account.
- **`/for-schools` placeholder** — currently shows "Coming soon." Linked from top nav and footer. A school principal clicking through and hitting a coming-soon wall is a wasted lead. Either build a quick interest-capture page (15 min of Cursor work — name + email + write to a `school_interest` table), or remove the nav/footer link until the real page exists.
- **Custom SMTP for Supabase Auth** — your /signup flow sends invitation emails through Supabase. The default Supabase sender works for tests but has aggressive rate limits and lower deliverability (Gmail will send some to spam). For real launch you want a proper email service. Resend is the easiest setup if you don't have a preference.
- **Real screenshots** — placeholders look like… placeholders. Replacing them with real product screenshots is the single biggest visual upgrade you can make to the home page. Just three PNGs in the right folder.
- **Clean up test rows** — the cap-enforcement testing wrote real rows to `beta_signups` and `waitlist` (the test emails). They count toward the real 50 cap and pollute future analytics. Delete them in Supabase Table Editor.

**Cursor brief (only needed for items 1, 3, and 5 — the rest are manual):**

> "Three small fixes:
>
> **1. Footer Contact link.** On the home page footer, find the 'Contact' link currently set to `#` and change it to `mailto:hello@pstudy.be`.
>
> **2. /for-schools page.** Currently shows 'Coming soon.' Replace with a one-page interest-capture form: heading 'PSTUDY for schools and training organisations', a paragraph explaining we're building a Community plan, and a small form (school name, contact name, email, optional message) that POSTs to a new `/api/school-interest` route. The route writes to a new `school_interest` table in Supabase (id, school_name, contact_name, email, message, created_at — same RLS pattern as `beta_signups`, server-side insert via service role). Show a confirmation: 'Thanks — we'll be in touch as we get closer to launching the schools plan.'
>
> **3. Screenshot integration.** No code change needed — I'll drop the three PNG files into `/public/screenshots/` myself. Verify the home page placeholders are wired to read from those exact paths so the swap is automatic.
>
> Tell me the file paths you modified and the exact `school_interest` schema you used."

**How to test it worked:**
- Click Contact in footer → opens mail client with hello@pstudy.be ✓
- Send a test email to hello@pstudy.be → arrives in your inbox ✓
- Visit /for-schools → see real interest-capture form, not "Coming soon" ✓
- Submit a test entry on /for-schools → row appears in `school_interest` table ✓
- Custom SMTP configured in Supabase Auth → test signup email arrives within 30 seconds, not in spam ✓ *(handled in OPS-02)*
- Real screenshots dropped in `/public/screenshots/` → home page shows actual product images, not placeholder tiles ✓
- `beta_signups` and `waitlist` tables in Supabase contain only real signups, no test rows ✓

---

### OPS-02 — Email infrastructure (custom SMTP + branded sender domain) ✅ SHIPPED

- [x] Created `privacy@pstudy.be` (alias of `contact@pstudy.be`) in Plesk
- [x] Created `hello@pstudy.be` (alias of `contact@pstudy.be`) in Plesk
- [x] Created `noreply@pstudy.be` (real mailbox) in Plesk for SMTP authentication
- [x] Configured Supabase Auth custom SMTP via `noreply@pstudy.be`
- [x] Customized Supabase email templates so they read like PSTUDY (not generic Supabase)
- [x] End-to-end verified: signup confirmation email arrives from `noreply@pstudy.be`, references `https://pstudy.be`, lands in inbox

**Implementation notes (real-world detective story for future reference):**
- **Cloud86 SMTP on `pstudy.be`:`465` and `587` was unreachable from Supabase's servers** (port-checker confirmed both ports closed externally). Cause: Cloud86 doesn't accept external SMTP connections to that hostname.
- Initial troubleshooting cycle: configured custom SMTP → got `context deadline exceeded` errors in Supabase Auth logs → tried port 587 instead of 465 → still timed out → discovered both ports closed externally via yougetsignal.com.
- **Resolution:** Cursor switched to a different SMTP route that does work from Supabase to Cloud86 (specifics noted in commit history).
- Also verified during this work: ALTER TABLE added unique constraints on `beta_signups.email` and `waitlist.email` (was missing — a separate bug uncovered during the SMTP debugging that was preventing signups even when SMTP would have worked).
- Site URL updated in Supabase Auth settings from `https://pstudy-web.vercel.app` to `https://pstudy.be` so signup emails reference the canonical user-facing URL.

---

## Tier 2 — First 30 days post-launch

These are the items to ship in the first month after launch, prioritised by what real users will likely complain about first.

### LEG-02 — Wave 2 GDPR & sales-readiness documents (before approaching schools or companies)

- [ ] Data Processing Agreement (DPA) template ready for Community customers to sign
- [ ] Public sub-processor list page (e.g. `/legal/subprocessors`)
- [ ] Data retention policy (either standalone page or section in privacy policy)
- [ ] Data export functionality — users can download their decks and account data (GDPR Art. 20)
- [ ] Data deletion functionality — users can request account and data deletion (GDPR Art. 17)
- [ ] Audit log — record who accessed what data when, retainable for security questions
- [ ] Internal breach notification process documented (GDPR Art. 33: 72-hour notification rule)
- [ ] Optional: a "Trust" or "Security" page on the marketing site summarising the above for buyers

**Depends on:** FD-05 ✅, LEG-01

**When to ship this:** During the first month of private beta, before any outreach to schools or companies.

**What this delivers:** The credibility layer that lets you reach school and corporate buyers without scrambling. Schools and companies will ask for a DPA before signing. Companies will ask security questions that map directly to the audit log and breach process. Without these, your first school conversation stalls; with them, you can move quickly.

**Cursor brief (high-level — break into smaller tasks when the time comes):**

> "Implement Wave 2 GDPR/legal capabilities for PSTUDY.
>
> **1. DPA template.** Create a Data Processing Agreement template (separate document from the privacy policy and terms). The DPA is what Community customers sign when they bring teachers/students onto PSTUDY. Cover: scope of processing, types of personal data, data subject categories, processor obligations under GDPR Art. 28, sub-processor rules, security measures, audit rights, breach notification commitments, data return/deletion at end of contract, governing law. Use the EU's standard contractual clauses or a known template (Vanta, Termly, or adapt Supabase's own DPA). Save as a PDF on the website at /legal/dpa, downloadable so customers can sign and return.
>
> **2. Sub-processor list.** Create a public page at /legal/subprocessors listing every third party that processes personal data on PSTUDY's behalf:
> - Vercel (hosting infrastructure, USA — note the US-EU Data Privacy Framework basis)
> - Supabase (database and auth, EU region)
> - OpenAI (AI generation, USA — DPF basis)
> - Email provider (Postmark, Resend, or whichever — note location)
> - Paddle (payment processing, when activated)
> - Any analytics tool used
>
> For each, list: name, role/purpose, data categories processed, location, link to their DPA. Keep the page updated when sub-processors change. Add a 'last updated' date.
>
> **3. Data retention policy.** Either a standalone /legal/retention page or a section in /privacy. State how long each data category is kept: account data (until deletion request or 3 years inactive), deck content (until deletion or account deletion), practice activity (12 months rolling), AI generation logs (90 days), exam results (controlled by Community admin's chosen retention).
>
> **4. Data export functionality.** In /account, add a 'Download my data' button. When clicked, generate a ZIP file containing: user profile (JSON), all owned decks (PSTUDY .txt format and JSON), practice history (CSV), exam history (CSV). Email a download link or stream directly. Implement async if it takes more than a few seconds.
>
> **5. Data deletion functionality.** In /account, add a 'Delete my account' button with a confirmation flow ('type DELETE to confirm'). On confirmation: anonymise or delete user data, soft-delete user-owned decks, hard-delete after 30-day grace period (during which user can cancel deletion). Email confirmation when complete. For Community accounts, the org admin should also be notified.
>
> **6. Audit log.** Add a `audit_log` table in Supabase: id, user_id, action_type, target_type, target_id, ip_address, user_agent, timestamp. Log: login, password change, deck created/deleted/shared, exam created, AI generation used, account changes, data export, data deletion. Retain for 12 months minimum. For Community admins, expose a filtered view of their org's audit log in the admin panel.
>
> **7. Breach notification process.** Document an internal procedure (in /docs/breach-response.md in the repo) covering: detection criteria, internal escalation, scope assessment within 24 hours, notification to Belgian DPA within 72 hours if required, notification to affected data subjects if high risk, post-incident review. This is for the founder's own reference — it's a process document, not a public document.
>
> **8. Trust page (optional but recommended).** A /trust or /security page on the marketing site summarising security posture, GDPR compliance, certifications (none yet), sub-processor list, DPA availability, contact for security questions. This becomes a sales asset — buyers find this and self-qualify."

**How to test it worked:**
- DPA template downloadable from /legal/dpa ✓
- Sub-processor list public and accurate ✓
- Data retention policy clear and accessible ✓
- A test user can export and download their data ✓
- A test user can request account deletion and the flow completes ✓
- Audit log records relevant actions ✓
- Breach response document exists in repo ✓

---

### BIZ-01 — Integrate Paddle for subscriptions and one-time top-ups

- [ ] Apply for and obtain Paddle merchant approval (do this during private beta)
- [ ] Set up Paddle products: Personal monthly, Personal annual, top-up packs
- [ ] Implement Paddle Checkout for Personal subscriptions
- [ ] Implement Paddle webhook handler in Next.js API routes
- [ ] Sync subscription state to Supabase (plan, renewal date, status)
- [ ] Implement plan-based feature gating across the app (deck count, AI credits, exam access, sharing rights)
- [ ] Implement AI credit metering and top-up purchase flow
- [ ] Build a "Manage subscription" page in Account
- [ ] Flip the `PAYMENTS_LIVE` config flag to route CTAs from beta-signup to Paddle Checkout
- [ ] Honor early-adopter benefits for existing beta users (per FD-08)
- [ ] Set up manual invoicing process for Community plans (Paddle invoices or accounting tool)

**Depends on:** FD-07 ✅, FD-08 ✅, MKT-02

**When to ship this:** After 60–90 days of private beta, when you have user signal that the product is worth charging for and you've fixed the most painful issues from real-user feedback.

**What this delivers:** The full payment system. Users on Personal can subscribe and pay through Paddle; the system enforces plan-based limits; AI credits are metered per user/org with top-up purchase; Community customers are invoiced manually.

**Cursor brief (high-level — break this into smaller tasks when the time comes):**

> "Implement Paddle integration for PSTUDY subscriptions. We use Paddle as merchant of record (no need to handle VAT ourselves).
>
> **Setup:**
> 1. Confirm Paddle merchant account is approved.
> 2. In the Paddle dashboard, create products: 'Personal Monthly' (€3.99/mo), 'Personal Annual' (€35/yr), and three top-up products: 'Top-up 250 credits' (€3), 'Top-up 500 credits' (€5), 'Top-up 1000 credits' (€9).
> 3. Get the Paddle public client token and webhook signing secret. Add them to Vercel environment variables (PADDLE_CLIENT_TOKEN, PADDLE_WEBHOOK_SECRET, PADDLE_ENVIRONMENT).
>
> **Database changes (Supabase):**
> 4. Add columns to the `users` table: `plan` (enum: 'free', 'personal_monthly', 'personal_annual', 'community_starter', 'community_standard', 'community_enterprise'), `paddle_customer_id`, `paddle_subscription_id`, `subscription_status`, `current_period_end`, `early_adopter_benefit` (text/json for tracking the FD-08 lifetime benefit).
> 5. Add a `credits_balance` column tracking remaining AI credits.
> 6. Add a `credit_transactions` table logging every credit grant, use, top-up, and monthly reset.
>
> **Frontend:**
> 7. On /pricing, when `PAYMENTS_LIVE=true`, route Personal CTAs to Paddle Checkout using the Paddle.js SDK with the appropriate product ID. Pass the user's email and id as custom data.
> 8. Build a /account/subscription page where logged-in users can see their current plan, renewal date, billing history, change plan, cancel, or update payment details (use Paddle's customer portal where available).
> 9. Build a /account/credits page showing the AI credit balance, monthly reset date, and top-up purchase options. Top-ups also use Paddle Checkout.
> 10. When a user runs out of credits during AI generation, show an inline 'Top up' CTA that opens the credit purchase flow without leaving the page.
>
> **Backend:**
> 11. Create an API route /api/paddle/webhook that receives Paddle webhooks. Verify the signature against PADDLE_WEBHOOK_SECRET. Handle these events: subscription.created, subscription.updated, subscription.canceled, transaction.completed (for top-ups).
> 12. On subscription.created, update the user's plan, paddle_subscription_id, current_period_end, and grant the monthly credit allowance (500 for Personal).
> 13. On subscription.updated (renewal), reset the monthly credit allowance to 500 (carry-forward applies only to top-ups, not bundled credits).
> 14. On transaction.completed for a top-up, add the purchased credits to credits_balance.
> 15. On subscription.canceled, downgrade the user to 'free' at the end of their current period.
>
> **Feature gating:**
> 16. Build a server-side helper `getUserLimits(userId)` that returns the user's allowed deck count, AI credit balance, exam access, and sharing rights based on their plan.
> 17. Apply gates: Free users limited to 3 decks; AI generation requires non-zero credits and a non-Free plan; exam creation requires Personal+ or Community teacher/admin; share-to-PstudyCommunity requires Personal or Community-teacher.
> 18. When a Free user hits a gate, show 'Upgrade to Personal' CTA that opens Paddle Checkout.
>
> **Early-adopter handling (FD-08):**
> 19. For users created before the PAYMENTS_LIVE cutover date, mark `early_adopter_benefit` in their record. When they subscribe, apply the benefit (e.g. 50% off forever as a Paddle discount code, or 6 months free as a manual override). Specific benefit per FD-08 decision.
>
> **Community plans (manual at launch):**
> 20. For Community signups, the form on /pricing routes to a contact form, not Paddle. The admin (you) generates a Paddle invoice manually for the agreed amount, then manually flags the org's plan in Supabase once paid.
>
> Test thoroughly in Paddle's sandbox mode before going live. Document the test card numbers and the cutover process in /docs/payments.md."

**How to test it worked:**
- Sandbox subscription flow works end-to-end (signup → checkout → webhook → plan update) ✓
- Plan-based gates enforce correctly (Free user can't create 4th deck, Free user can't use AI, etc.) ✓
- Top-up purchase adds credits and they don't expire ✓
- Monthly credit reset works on renewal ✓
- Subscription cancellation downgrades to Free at period end ✓
- Existing beta users keep their early-adopter benefit ✓
- VAT is correctly handled by Paddle (verify on a test invoice) ✓
- Manage subscription page works ✓

---

### UI-17 — Public deck preview without login

- [ ] PstudyCommunity decks have a shareable preview URL
- [ ] First card practiceable without an account

**What this fixes:** Today, a visitor cannot try anything without signing up. This is the single biggest growth lever — letting visitors experience the product before committing typically moves trial conversion 2–5x.

**Cursor brief:**

> "Each PstudyCommunity deck should have a public URL (e.g. /community/[deckId]) that's accessible without authentication. The page shows the deck metadata (title, author, language, item count, Checked badge) and lets the visitor practice the first 3 cards in straight-answer mode. After 3 cards, show a soft paywall: 'Sign up to keep practicing this deck and 1,000+ others.' with a Sign up CTA. The 'Copy to my decks' button should also be present but require login.
>
> Authenticated users on the same URL get the full experience (all cards practiceable, no signup prompt). Make the URL shareable on social — add a 'Share' button that copies the link."

---

### UI-18 — Cloud-sync the "Known" flag on flashcards

- [ ] Move from localStorage to Supabase per-user

**What this fixes:** Today the 'known' flag on flashcards is stored only in the browser's localStorage. A user who studies on their laptop and phone starts fresh on each device. Surprising and frustrating.

**Cursor brief:**

> "The flashcard practice mode marks cards as 'known' or 'unknown', currently stored in localStorage keyed by card/deck. Migrate this to a per-user table in Supabase: a `card_status` table with columns user_id, item_id, status, updated_at. When the user marks a card known, write to both localStorage (for fast reads) and Supabase (for persistence). On flashcard load, prefer Supabase data and update localStorage. Add a one-time migration on next login: if Supabase has no records but localStorage does, push the localStorage data up.
>
> The user should not lose any existing 'known' marks — preserve them through the migration."

---

### UI-19 — File-type expansion for AI generation

- [ ] Accept PDF, DOCX, PPTX as source files

**What this fixes:** Every modern alternative (Knowt, MintDeck, okti) leads with 'upload a PDF / lecture notes'. PSTUDY accepts only .txt today, which reads as primitive. This is the single highest-ROI feature you could ship in Tier 2.

**Cursor brief:**

> "Extend the AI generate file uploader to accept PDF, DOCX, and PPTX in addition to TXT. On the server (Vercel function or API route), use a library to extract plain text:
> - PDF: `pdf-parse` or `pdfjs-dist`
> - DOCX: `mammoth`
> - PPTX: `node-pptx` or extract via `unzipper` and parse the XML
>
> After extraction, the existing AI pipeline runs unchanged on the resulting text. Show the user a confirmation: 'Extracted X characters from your PDF. Generating now...'. If extraction fails, show a clear error: 'Could not read this file. Try copying the text manually.'
>
> Update the dropzone help text to list the new supported types."

---

### UI-20 — Per-card analytics shown on the deck card

- [ ] My decks shows last-practiced date and accuracy

**What this fixes:** After a few weeks a user will have many decks and no visual cue for which is fresh, which is overdue, or which is going badly. Surfacing simple stats per deck improves retention.

**Cursor brief:**

> "On the My decks page, each deck card currently shows item count, language, and badges. Add two metadata lines: 'Last practiced: [relative time]' (e.g. '3 days ago' or 'Never') and 'Accuracy: [%]' based on the user's last 5 practice sessions on that deck. Both small grey text. If a deck has never been practiced, show only 'Last practiced: Never' and skip the accuracy line.
>
> If practice session data isn't currently being stored at the deck level, add a `practice_sessions` table in Supabase: id, user_id, deck_id, started_at, ended_at, total_items, correct_items. Write to it at the end of each session."

---

### UI-21 — Per-question stats on completed exams

- [ ] After an exam closes, organiser sees which questions tripped students up

**What this fixes:** A teacher's most valuable post-exam insight is 'which question did the class struggle with?'. You have the data; surface it.

**Cursor brief:**

> "On the exam detail page (organiser view), in the Results section, when at least one student has submitted the exam, show a 'Question performance' subsection. List each question with: question text (truncated to 80 chars), correct rate (% of submitters who got it right), and a small bar chart. Sort by lowest correct rate first (the questions that tripped students up). Click a question to expand and see which specific students got it wrong."

---

### UI-22 — Bulk invite by paste-list in MyCommunities admin

- [ ] Paste many emails at once, similar to exam invitations

**What this fixes:** Inviting 30 students one at a time is unworkable. The exam flow already solves this with a paste-many textarea — apply the same pattern to MyCommunities.

**Cursor brief:**

> "On the Manage MyCommunities page, the current 'Add people' section accepts one email at a time. Add a second tab or expandable section labeled 'Add many people at once'. It should contain: a textarea where users paste one email per line, a single Role dropdown that applies to all of them, and a 'Send invitations' button. Validate emails as the user types (highlight invalid lines in red). On submit, send invitations to all valid addresses and show a summary: 'Invited X people. Y emails were invalid: [list]'."

---

### UI-23 — Sort PstudyCommunity by quality

- [ ] Checked decks first, Drafts in a separate section

**What this fixes:** Currently every deck on the community page shows 'Draft', signalling that nothing here is verified. The peer-review system should be the trust mechanism — but only if Checked decks are surfaced.

**Cursor brief:**

> "On the PstudyCommunity page, change the default sort and grouping. Show a 'Checked' section first with all peer-reviewed decks, sorted by most recently checked. Below it, a 'Newly added' section with Draft decks, sorted by most recent. Add filter checkboxes: 'Checked only' (default off), 'Include drafts' (default on). The current filter row (Search, Field, Topic, Language) stays at the top.
>
> If a deck has 0 Checked decks total, hide the 'Checked' header and show only 'All decks'."

---

## Tier 3 — Strategic / later

These have real value but are not pre-launch or first-month priorities. Listed here so they're not forgotten.

- [ ] **STR-01** — Add FSRS spaced repetition as a fourth practice mode (after the basic launch is stable)
- [ ] **STR-02** — Native Quizlet and Anki import (.apkg parsing) to capture migrating users
- [ ] **STR-03** — Mobile PWA with offline practice (home screen install, service worker cache)
- [ ] **STR-04** — Per-class analytics dashboard for school admins
- [ ] **STR-05** — Image occlusion cards (anatomy, geography, diagrams)
- [ ] **STR-07** — Matching game practice mode (Quizlet's most-loved free mode)
- [ ] **STR-08** — Streaks, daily goal, calendar heatmap (optional, toggleable)
- [ ] **STR-09** — Print to PDF (flashcards or exam paper with answer key)
- [ ] **STR-10** — Public REST API + Zapier connector for school IT integrations
- [ ] **STR-11** — White-label / school branding (logo on login, subdomain, colour)
- [ ] **STR-12** — AI feedback on free-text answers (conceptual grading, not exact-match)
- [ ] **STR-13** — Curriculum-aligned starter library (Belgian secondary curricula)
- [ ] **STR-14** — Better TTS voices (ElevenLabs) for Listen mode in NL/FR
- [ ] **STR-15** — SSO with Google Workspace for Education and Microsoft 365
- [ ] **STR-16** — Comparison pages for SEO (/quizlet-alternative, /anki-alternative)
- [ ] **STR-17** — One-line summary per deck (last practiced, accuracy, due cards) on dashboard
- [ ] **STR-18** — In-app onboarding tour for first-time users
- [ ] **STR-19** — Anti-cheat options on exams (randomise question/option order, lockdown message)
- [ ] **STR-20** — Reopen / extend an exam attempt (for a student who lost connection)
- [ ] **UI-24a** — Preserve tabs/newlines inside card fields on deck export round-trip (currently normalized to spaces — fine for 99% of decks but may matter for programming/code decks with multi-line answers). Options: extend the .txt format to escape `\t` and `\n`, or offer a JSON export alongside the .txt format. Only worth doing if real users complain.

---

### STR-21 — Teacher-assigned exercises (lighter than exams)

**Status:** Tier 3 — to be re-evaluated for Tier 2 if real teacher feedback during private beta validates demand.

**The idea:** Today PSTUDY has two ways for teachers and students to interact: **shared decks** (passive — student practices when/if they want) and **exams** (formal, timed, scored, deadline-bound, results visible to organiser). Missing in the middle: a teacher-assigned **exercise** — an assignment that is not a formal exam.

| | Exam (today) | Exercise (proposed) |
|---|---|---|
| Purpose | Assessment | Learning |
| Time pressure | Timed (no pause) | Untimed |
| Repeats allowed? | No | Yes (drill-until-mastery) |
| Stakes | Graded, results to organiser | Practice — completion tracked, score optional |
| Tone | Formal | Lower-pressure |

**Why this matters strategically:**

1. **Lower friction for teachers.** A teacher can assign exercises every week without it being a formal event. Exams might be quarterly; exercises can be weekly. Higher engagement.
2. **More frequent value to teachers.** Their PSTUDY usage shifts from "set up an exam each term" to "assign exercises constantly." Stickier product.
3. **Better outcomes for students.** Practice produces learning; exams just measure it. If PSTUDY mostly enables practice (via teacher-assigned exercises), it's positioned as a learning tool, not a testing tool. Stronger pitch for institutional buyers.
4. **Uses infrastructure that already exists.** Decks exist, practice modes exist, assignments-to-students exist (the exam invitation flow). An exercise is essentially "an exam assignment, but using practice mode instead of exam mode, with no time limit and unlimited attempts." Most plumbing already in place.
5. **Distinguishes PSTUDY from Quizlet.** Quizlet doesn't have a teacher-assigned-exercise primitive with completion tracking. This is a real, named feature competitors don't have.

**Concrete shape (sketch only — actual design after teacher validation):**
- Teacher picks a deck (their own or shared)
- Assigns it to one or more students/groups
- Optional soft deadline (you can practice past it)
- Optional minimum threshold ("must achieve 80% accuracy at least once")
- Teacher dashboard: who did it, when, how many times, accuracy

**Why this is in Tier 3 (not Tier 2):**
- Substantial feature — assignment flow, student dashboard, teacher dashboard, completion tracking, deadlines. Probably 2-3 weeks of focused work.
- It's a Community-tier feature (only teachers/admins use it), so it doesn't help individual beta users.
- Building it now would be based on the founder's theory of what teachers want, not based on talking to actual teachers.

**Better path:** open beta with what exists today → invite teachers among the first beta users → watch how they use exams (or don't), ask what's missing → if multiple teachers say "I don't really want exams, I want lighter exercises," **then** the demand is validated and STR-21 moves up.

---

### MKT-03 — Surface free-recall + keyword-grading as a named marketing feature

**Status:** Tier 3 — small marketing/positioning improvement, ship after the first wave of beta feedback confirms users notice and value the feature.

**What this is:** PSTUDY has a sophisticated free-recall + keyword-grading practice mode that today is hidden behind generic settings ("Speak (continuous until Enter)" + a keyword cloze toggle). To a new visitor it looks like normal flashcard practice. It isn't.

**What the feature actually does:**
1. The student speaks freely about the topic in their own words (not filling pre-defined slots)
2. PSTUDY transcribes the speech as a continuous answer
3. On reveal, PSTUDY compares the student's free-form answer against the deck's model answer by detecting which keywords the student actually used
4. Color-coded feedback: green = used correctly, pink = missed or incorrect

**Why this matters:** This is functionally an AI-graded short-answer exam, done in real time, by voice, with keyword-level feedback. Quizlet doesn't do this. Anki doesn't do this. Memrise doesn't do this. Most "AI-powered study tool" startups making noise right now don't do this either. It's one of PSTUDY's strongest genuine differentiators — and it's currently invisible in marketing.

**What to do (concrete):**
1. Give the feature a clear name in the product UI (e.g. "Free-recall practice" or "Speak & explain")
2. Add a section to the home page (`MKT-01`) calling it out as a named feature, ideally with a screenshot or 30-second video showing the keyword highlighting in action
3. Add a paragraph to `/for-schools` explaining that PSTUDY can run free-recall short-answer assessment by voice — relevant for language teachers and trainers
4. Mention it explicitly in the `/pricing` page Personal-tier description (currently just lists "all practice modes")

**Why Tier 3, not Tier 1:** the feature already works. This is a marketing/surfacing improvement, not a product gap. Worth doing — but not urgent enough to delay opening the beta. Better to learn from real users which framing of this feature resonates before committing it to the marketing site permanently.

---

---

## Known unknowns — what this backlog does not cover

Areas of the product that were not visible in the screenshots and may need their own future review:

- **Peer review reviewer flow** — invitation email, the reviewer's edit screen, the 'mark complete' step
- **Examinee mid-exam UI** — what a student sees during a timed exam, how the timer is displayed, the submit confirmation
- **Account / Settings page** — profile, password change, language preferences, notification settings, billing
- **Email templates** — invitation emails for exams and MyCommunities, password reset, welcome
- **Admin / superuser views** — anything you-the-founder use to manage the product itself
- **Onboarding email sequence** — what happens after signup
- **Error states** — what users see when AI generation fails, when an exam link is invalid, when network is lost during practice

When any of these become priorities, take screenshots and reopen the conversation.

---

## Changelog

Add a line each time you ship something significant.

- *2026-05-01* — Backlog created from holistic review.
- *2026-05-02* — FD-01 (pricing) decided. FD-07 (Paddle as payment provider) decided. FD-08 (private beta launch model) decided. MKT-02 updated with final pricing and beta-CTA routing. New BIZ-01 added to Tier 2 for Paddle integration.
- *2026-05-02* — FD-03 (positioning) decided: H1 = "Flashcards, exams, and peer-reviewed shared decks." / Subhead = "Made in Europe, built for serious teachers and learners." MKT-01 brief updated with final wording, EU trust strip, and benefit-led features list.
- *2026-05-02* — FD-02 (banner) decided: Option C — replace with a "What's new" changelog strip. UI-01 expanded to cover the new strip, conditional display, and creation of a /changelog page.
- *2026-05-02* — FD-04 (trademark) decided: PSTUDY is a registered Benelux trademark (BOIP). Added STR-21 to track optional EU and US extensions for later.
- *2026-05-02* — FD-04 expanded: decision to file EUTM (EU-wide trademark) now via EUIPO in classes 9 + 41. STR-21 retired and folded into FD-04.
- *2026-05-02* — **EUTM filed.** Application reference: **EEFEM202600002022425**. Filing date: 1 May 2026. Word mark "PSTUDY", classes 41 + 42 (revised from 9 + 41 after eSearch found UpStudy in class 9 — switched to STUDY ME's class 41 + 42 strategy). 8 HDB-approved goods/services. Owner: Tesco Engineering BV. Second language: French. Fast Track examination expected. Indicative registration date: ~15 August 2026. Seniority claim from Benelux registration 980089 to be filed as a subsequent claim post-registration.
- *2026-05-02* — FD-05 (GDPR posture) decided: schools AND companies confirmed as launch audiences. Two-wave plan adopted — Wave 1 before private beta (`LEG-01`), Wave 2 during first month of private beta before school/company outreach (`LEG-02`). Both items added with full Cursor briefs.
- *2026-05-02* — FD-06 (mobile vs desktop) deliberately held open until analytics arrive; locked in design principle that product must support desktop creation + mobile practice (Option B). All 8 founder decisions (FD-01 through FD-08) now resolved.
- *2026-05-02* — **UI-02 shipped.** `exam.items` template variable replaced with actual question count on the exam list. First Tier 1 item complete.
- *2026-05-02* — FD-02 (banner) revised on reflection: dropped the "What's new" / changelog framing in favor of a simple neutral grey strip with softer wording ("PSTUDY is in active development — features may change."), visible only to logged-out visitors. UI-01 scope simplified accordingly — no /changelog page, no version messaging.
- *2026-05-02* — UI-01 shipped: orange banner replaced with small neutral grey strip ("PSTUDY is in active development — features may change."), hidden for logged-in users.
- *2026-05-02* — **FD-08 finalized.** Beta cap set at **50 users** (founder's realistic limit on conversations they can support); paid plans expected in **Q3 2026 (July–September)** with a **30-day notice** commitment before any change; early-adopter benefit set as **6 months free + locked-in price (€3.99/month or €35/year)** for life of the subscription. Final beta communication template recorded in FD-08.
- *2026-05-02* — **UI-24 added to Tier 1** — deck export (per-deck and from the deck editor; round-trip with Import .txt). Required before any beta outreach because the FD-08 communication promises "decks are always exportable at any time" and that promise is currently false.
- *2026-05-02* — **MKT-01 brief updated** to use 'Join the private beta' as the primary CTA (replacing 'Start free trial'), and to reference screenshot placeholder paths at `/public/screenshots/practice.png`, `/public/screenshots/flashcard.png`, `/public/screenshots/multiple-choice.png` (real PNGs to follow).
- *2026-05-02* — **MKT-02 expanded into a consolidated brief** covering: (a) home-page pricing summary, (b) /pricing page with full FD-08 beta-terms banner, three-tier table, Community sub-tiers, top-ups, and FAQ, (c) minimal /signup page that creates Supabase auth users with 50-user cap enforcement and waitlist fallback, (d) `lib/cta-routing.ts` helper reading `NEXT_PUBLIC_PAYMENTS_LIVE` so the eventual Paddle cutover is a single env-flag flip. MKT-01 + MKT-02 now intended to ship together.
- *2026-05-02* — **MKT-01 shipped.** Home page rebuilt with two-tier headline ("Flashcards, exams, and peer-reviewed shared decks." / "Made in Europe, built for serious teachers and learners."), "Join the private beta" primary CTA, EU trust strip, three screenshot placeholders, benefit-led features list, full footer, and Pricing + For Schools added to top-nav. Files modified/added: `src/app/page.tsx`, `src/lib/cta-routing.ts`, `.env.example`, plus placeholder pages at `/signup`, `/pricing`, `/for-schools`. Local `npm run build` succeeds.
- *2026-05-02* — **MKT-02 shipped.** /pricing page built with full FD-08 beta-terms banner, three-tier table (Free / Personal / Community), annual toggle on Personal, Community sub-tiers, top-ups, and 5-question FAQ. /signup form built with name + email + use-case + consent checkbox, posting to `/api/beta-signup`. `getPrimaryCtaUrl()` helper reads `NEXT_PUBLIC_PAYMENTS_LIVE`. Database: separate `beta_signups` and `waitlist` tables created with RLS policies denying anon/auth direct access (all inserts via server route using service role). User metadata stored in Supabase Auth via `inviteUserByEmail`. Beta cap refactored to read from server-side env var `BETA_SIGNUP_CAP` (defaults to 50 if unset/invalid) so the cap can be adjusted from Vercel without redeploying. Cap enforcement and waitlist fallback verified end-to-end on production.
- *2026-05-02* — **OPS-01 added to Tier 1** — operational follow-ups from MKT-01/02: replace footer Contact `#` with mailto, set up `hello@pstudy.be` mailbox, decide what to do with the `/for-schools` "Coming soon" placeholder (recommended: turn into a small interest-capture page writing to a `school_interest` table), configure custom SMTP for Supabase Auth emails (Resend/Postmark/SES) to escape the built-in Supabase rate limit, drop real product PNGs into `/public/screenshots/`, and clean up test rows in `beta_signups`/`waitlist` tables created during cap-enforcement testing.

- *2026-05-02* — **OPS-02 shipped.** Email infrastructure complete. Created `privacy@`, `hello@`, `noreply@` mailboxes/aliases at Cloud86. Supabase Auth now uses custom SMTP via `noreply@pstudy.be`. Confirmation emails arrive from `noreply@pstudy.be` (not Supabase), reference `https://pstudy.be` (canonical URL), and land in inbox. Detective trail along the way: discovered (a) both Cloud86 SMTP ports 465/587 were closed externally, requiring a different routing approach, (b) missing unique constraints on `beta_signups.email` and `waitlist.email` were also breaking signups — fixed via ALTER TABLE, (c) Supabase Site URL needed updating from the Vercel default to the custom domain. End-to-end signup tested and verified on production.
- *2026-05-02* — **LEG-01 shipped.** Privacy policy at `/privacy`, Terms of Service at `/terms`, Cookies notice at `/cookies` — all in English, plain prose, proportionate to a Belgian SaaS in private beta. Global `SiteFooter` component renders legal links on every page (public AND authenticated). Signup consent checkbox now requires Terms+Privacy acceptance with clickable links. Notable choice: AI generation logging — Cursor codebase grep confirmed PSTUDY does NOT log AI inputs server-side, so the privacy policy reflects this honestly (stronger user guarantee than the original 90-day-retention draft). OpenAI's 30-day API retention for abuse monitoring is disclosed transparently in the sub-processor section. Vercel infrastructure cookies (DDoS, edge routing) disclosed. Belgian DPA referenced for complaint route. PSTUDY is now legally ready to open private beta. Deployed via commit `c8b36b8` on main.

- *2026-05-04* — **Backlog refinements after founder dogfooding session.** Added two new Tier 1 items based on the founder noticing real friction while using PSTUDY personally: `UI-25` (practice session structure and controls — explicit start, pause/resume, transition screen between first-pass and mistake-drill, end-of-session summary with replay options) and `UI-26` (deck preview — read-only browse before practicing). **Removed STR-06** ("Cloze deletion as a card type") — investigation revealed PSTUDY already has a more sophisticated equivalent: free-recall practice with keyword-grading, where the student speaks freely about the topic and PSTUDY highlights which keywords from the model answer were used correctly (green) vs missed (pink). This is functionally AI-graded short-answer assessment by voice — a genuine differentiator vs Quizlet/Anki/Memrise. Anki-style mechanical cloze would be a step down, not up. **Added STR-21** (teacher-assigned exercises — lighter than exams) to Tier 3 with full strategic rationale; to be re-evaluated for Tier 2 if real teacher feedback during beta validates demand. **Added MKT-03** (surface free-recall + keyword-grading as a named marketing feature) to Tier 3 — the feature works but is invisible in current marketing. **Confirmed sequencing principle going forward:** ship UI-25 and UI-26 (real UX gaps the founder noticed) before opening beta; everything else (manuals, videos, big new features) waits for real-user feedback to inform.
