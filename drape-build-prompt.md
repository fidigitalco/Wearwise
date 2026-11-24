# Build prompt: Drape — AI wardrobe and daily outfit app

Use this prompt with an AI coding tool (Claude Code, Cursor, Lovable, Bolt) or hand it to a development team. It describes the full MVP.

---

## Role and goal

You are a senior mobile product engineer and designer. Build **Drape**, a global consumer mobile app (iOS and Android) that digitizes a user's real wardrobe and tells them what to wear tomorrow, based on weather, calendar events and their learned taste.

The product must fix the specific weaknesses of existing wardrobe apps (Indyx, Stylebook, Cladwell, Whering), listed below. Each core feature maps to one of those gaps. Do not build features that don't map to a gap or to the core loop.

**Core loop:** add clothes fast → get three outfit versions for tomorrow → rank them → the app learns → better suggestions.

---

## Competitor gaps this app must solve

| Gap in existing apps | Who has it | Drape's answer |
|---|---|---|
| Photographing every item one by one is tedious; it's the main reason users quit | Whering, Indyx, all | Video closet scan, multi-item photo, link import, email receipt import |
| No AI detection, every tag typed by hand | Stylebook | Auto-tagging of type, colour, season, formality, with manual override |
| Outfits feel random and don't go together | Cladwell | Every outfit shows a short "why it works" explanation |
| Some clothes are never suggested | Cladwell | Rotation engine that deliberately surfaces idle pieces |
| Styling is manual or needs a paid human stylist | Indyx, Whering | Three AI outfit versions per day |
| No weather integration | Indyx | Weather-aware suggestions |
| Accessories missing from suggestions | Whering | Shoes, bags, hats included in every outfit |
| Suggestions fail without outerwear; can't choose which items to draw from | Cladwell | Flexible outfit slots; optional capsule filter |
| No way to teach the app what you liked | All | Rank versions 1, 2, 3; app shows what it learned |
| Shopping-feed apps push buying | Users praise Indyx for having no ads | "Will it work?" check that can say Skip; shopping is opt-in |
| Surprise subscription changes | Cladwell | Permanent free tier; trial starts only after 20 items are added |
| Crashes, slow uploads, bad background removal | Whering | Performance and reliability are acceptance criteria, not extras |

---

## Target users

- Global, English-first. Architect for localization from day one (i18n keys, no hardcoded strings). First additional languages: Turkish, Russian, German, Spanish.
- Adults 18–45 who own enough clothes to feel "I have nothing to wear" despite a full closet.
- Two strong segments: working professionals with meetings, and style-curious people who want to buy less.

---

## Features (MVP)

### 1. Onboarding (under 90 seconds)

Three steps with a progress bar:

1. **Basics:** first name, shopping section (Womenswear, Menswear, Both), age range (18–24, 25–34, 35–44, 45–54, 55+).
2. **Taste:** show 4 outfit boards (for example Sharp and dark, Relaxed minimal, Street casual, Soft classic). User answers Yes / Not me on each. At least one Yes is required. These answers seed the taste model.
3. **Context:** city (auto-detect with permission, editable), toggle "Read my calendar", toggle "Evening preview at 21:00".

Finish button: "Build my closet", which goes straight to Add clothes.

### 2. Add clothes

Four input methods, fastest first:

- **Video scan (headline feature):** user pans the phone along the wardrobe rail, shelves and shoes.
  - Sample frames at ~2 fps; drop blurry and duplicate frames.
  - Detect and segment each garment; deduplicate the same garment seen across frames (embedding similarity).
  - Pick the sharpest, most frontal crop per garment; remove background.
  - Show on-screen guidance while recording (for example, "Slide each hanger apart for a second").
- **Multi-item photo:** several pieces laid flat in one photo are split into separate items.
- **Product link:** paste a store URL; scrape image, type, colour and brand.
- **Email receipts:** connect Gmail or Outlook; read only order-confirmation emails from clothing retailers; user approves each piece before it's added.

**Review screen after detection:**

- Each item shows its cutout, a type dropdown, a colour dropdown and a confidence percentage.
- Items below 75% confidence get a "Check this" flag.
- Editing a field sets confidence to 100% and is logged as a training signal.
- One button: "Add N pieces to closet".

**Item attributes:** category (Tops, Layers, Bottoms, Shoes, Accessories), type, primary colour, secondary colour, pattern, material (optional), season, formality (1–5), warmth (1–5), rain-suitable (bool), brand (optional), purchase price (optional), times worn, last worn date.

### 3. Closet

- Grid of item cards with photo, name, and either "Worn Xd ago" or "X days idle".
- Items idle for 40+ days are highlighted.
- Filter chips by category; search; capsule filter (for example, Work, Travel).
- Insight banner, for example: "5 pieces haven't been worn in 40+ days. They'll show up in your suggestions first."
- Item detail: edit attributes, wear history, cost per wear, delete, mark as sold or donated.

### 4. Tomorrow (main screen)

**Context header:** temperature, precipitation and hourly weather for the user's city, plus tomorrow's calendar events.

**Event classification:** classify each event into an occasion (Work formal, Work casual, Client meeting, Dinner, Date, Gym, Travel, Wedding, Casual). Event titles are processed on-device or sent only as a classified label, never stored raw on the server. The user can also add a manual note such as "Interview" or "Birthday party".

**Occasion switcher** when there are several events (for example, "Pitch at 10:00" / "Dinner at 19:30").

**Three outfit versions (A, B, C)**, each with:

- Item photos, always including shoes and, when relevant, an outer layer or accessory.
- A one-sentence "why it works" explanation covering colour harmony, formality fit and weather fit.
- Tags such as Rain-safe, Warmest option, Smart casual, "Wears 2 idle pieces".

**Ranking:** buttons 1, 2, 3 on each version; ranks are unique. After all three are ranked:

- The rank-1 outfit is pinned for tomorrow.
- A learning message appears, for example: "Got it. You'll see more tonal, quiet colour palettes."

**"Show three more"** generates a new set.

**Notifications:**

- Evening preview at 21:00 (configurable) with tomorrow's three options.
- Morning reminder with the pinned outfit.

**After wearing:** optional one-tap "Wore it" or a mirror selfie. This updates times worn and last worn date. The selfie may also detect new items not yet in the closet.

### 5. Will it work? (pre-purchase check)

- Input: product URL, screenshot, or photo taken in a store.
- Output:
  - Verdict: **Buy**, **Think twice**, or **Skip**.
  - Match score out of 100.
  - Number of owned pieces it pairs with.
  - Number of new outfits it unlocks.
  - Duplicate warning (for example, "Your black puffer already covers the same cold, rainy days").
  - Clash warnings.
  - Preview of 1–2 outfits with the new item.
- **Missing pieces:** the 3 items that would unlock the most new outfits, each with "Find it", which shows retailer search links (Trendyol, AliExpress, Zalando, Amazon, plus "Search myself").
- Affiliate links are allowed, but the verdict must never be biased toward buying. Skip and Think twice are first-class outcomes.

### 6. Me / profile

- "What Drape has learned": plain-language taste statements derived from onboarding and rankings. The user can delete any statement.
- Wardrobe stats: most worn, never worn, cost per wear, colour distribution.
- Settings: calendar, notifications, units (°C/°F), language, data export (CSV plus images), account deletion.

### 7. Trip packing (Premium)

Enter destination and dates. The app pulls the weather forecast and planned events, then generates a minimal packing list and day-by-day outfits from the user's own closet.

---

## Recommendation engine

1. **Candidate generation:** build outfits from slots (top, bottom or dress, outer layer, shoes, accessory). Slots are optional depending on weather and occasion. Never fail because one slot is empty.
2. **Hard filters:**
   - Weather: warmth vs. forecast temperature; rain-suitable items when precipitation is likely.
   - Occasion: formality range per occasion.
   - Exclude items marked in laundry or unavailable.
3. **Scoring:**
   - Colour harmony (neutral base plus at most one accent; tonal; complementary).
   - Formality coherence between pieces.
   - Learned taste vector (from onboarding boards and rankings).
   - Idle-item boost (items not worn in 40+ days get a bonus).
   - Recency penalty (don't repeat yesterday's outfit or the same key piece within 3 days).
4. **Diversity:** the three versions must differ meaningfully (different key piece or colour story), not three variants of the same outfit.
5. **Explanation:** generate the "why it works" sentence with an LLM, grounded in the actual scoring factors. Never invent facts.
6. **Learning:** treat each ranking as pairwise preferences (1 > 2, 1 > 3, 2 > 3) and update the user's taste weights. Edits to AI tags improve the tagging model.

---

## Monetization

| Free (forever) | Premium: $4.99/month or $34.99/year |
|---|---|
| Up to 40 items (video scan included) | Unlimited items |
| 1 outfit suggestion per day | 3 ranked versions per day, calendar-aware |
| 3 "Will it work?" checks per month | Unlimited checks |
| Basic stats | Trip packing, full stats, capsules |

- The 7-day trial unlocks only after the user has added 20 items, so they see real value before paying.
- Cancellation takes one tap and is clearly shown. No dark patterns.
- Secondary revenue: affiliate commission from "Find it" links, clearly labelled.

---

## Suggested tech stack

- **App:** React Native with Expo (TypeScript), Expo Router, Zustand or React Query.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions) or Firebase.
- **Vision:**
  - A segmentation model (for example SAM 2 or a fine-tuned clothing segmentation model) for detection.
  - A vision LLM for type, colour and attribute tagging.
  - Background removal (for example, the rembg / U²-Net family or a hosted API).
  - Image embeddings (for example, CLIP) for deduplication and similarity.
- **LLM:** Claude API for event classification, "why it works" explanations and "Will it work?" reasoning.
- **Weather:** Open-Meteo or a commercial weather API.
- **Calendar:** device calendar (EventKit / Android Calendar Provider) and Google Calendar, read-only.
- **Payments:** RevenueCat.
- **Analytics:** PostHog. Key events: onboarding_complete, items_added, scan_completed, outfit_ranked, outfit_worn, fit_check, trial_start, purchase.

---

## Data model (minimum)

- `users` (id, name, shopping_section, age_range, city, units, locale, plan, created_at)
- `items` (id, user_id, image_url, cutout_url, category, type, color_primary, color_secondary, pattern, season, formality, warmth, rain_ok, brand, price, times_worn, last_worn_at, status, ai_confidence, source)
- `outfits` (id, user_id, date, occasion, item_ids[], explanation, tags[], version_label)
- `rankings` (id, user_id, outfit_set_id, outfit_id, rank)
- `wear_log` (id, user_id, outfit_id or item_ids[], worn_at, selfie_url)
- `taste_profile` (user_id, weights jsonb, statements[])
- `fit_checks` (id, user_id, source_url, image_url, verdict, score, pairs_count, unlocks_count, warnings[])

---

## Design direction

- Calm, editorial, fashion-magazine feel. Not a shopping app.
- **Fonts:** Bodoni Moda for headlines; Manrope for UI text.
- **Light palette:** background #E6E9EF, surface #FFFFFF, ink #1A1D2E, muted #5D6377, accent orchid #B0245C.
- **Dark palette:** full dark mode required (accent #F0709F).
- Garments shown as clean background-removed cutouts on soft tiles with a light drop shadow.
- Bottom tabs: Tomorrow, Closet, Add (+), Check, Me.
- Copy is short, plain, sentence case, and in active voice.

---

## Privacy and trust

- Calendar event titles are never stored on the server; only the classified occasion is sent.
- Email import reads only retailer order confirmations, with a per-item approval step.
- Photos are private by default. No social feed in the MVP.
- One-tap full data export and account deletion.

---

## Acceptance criteria

- New user goes from install to first 3 outfit suggestions in under 5 minutes using video scan.
- Video scan detects at least 80% of visible garments, with under 10% duplicates, on a 60-second closet video.
- Type tagging accuracy is at least 85%; colour accuracy at least 80%. Every tag is editable.
- Outfit generation for tomorrow returns in under 3 seconds.
- No outfit ever violates weather hard filters (for example, sandals in rain at 5°C).
- Idle items (40+ days) appear in at least 1 of 3 versions at least every other day, when weather and occasion allow.
- Crash-free sessions at 99.5% or higher; image upload shows progress and never needs an app restart.
- Fully usable in dark mode and with system font scaling.

---

## Out of scope for MVP

Social feed, virtual try-on on the user's body, human stylists, resale marketplace, and a web app. Revisit these after retention data.

---

## Build order

1. Auth, onboarding, manual photo add with background removal and AI tagging.
2. Closet screen and item detail.
3. Weather plus the rule-based outfit engine with three versions and explanations.
4. Ranking and taste learning.
5. Calendar integration and notifications.
6. Video scan.
7. "Will it work?" and missing pieces.
8. Paywall, RevenueCat, analytics.
9. Link import and email receipt import.

Video scan is the riskiest feature. Build a standalone accuracy test for it in week one, in parallel with steps 1–3, before committing UI time to it.
