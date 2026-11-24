# WearWise — Build Prompt (v1)

You are the lead engineer building **WearWise**, a mobile app. The owner is a non-technical founder. Explain each step in plain language, ask before adding any paid service or API key, and keep the project runnable at every stage.

A clickable HTML prototype of the agreed UX exists (screens: Train, For you, Search, Hunt, Photo, My style, Item, Saved, Paywall). Match its flows and copy.

---

## 1. What WearWise is

An AI shopping agent for clothes. It learns a user's personal style once, then searches affiliate stores (Amazon, Trendyol, Temu, ASOS, Zalando, H&M, Hepsiburada, AliExpress, and more over time) and shows only items that:
- match the user's style, size and budget,
- are well rated, with genuine-looking reviews,
- are not sponsored placements.

It does **not** generate outfit combinations and does **not** require the user to upload their wardrobe. Those ideas were dropped.

**Market:** global. The UI is in English first, with i18n ready for TR, RU and AZ.
**Revenue:** affiliate commission (primary) plus a Premium subscription.

### Non-negotiable product rule
**Commission never affects ranking.** Ranking uses only style match, quality and price. Store the affiliate rate separately and never feed it into ranking. Show this line on every item page: "WearWise may earn a commission. It never changes the ranking."

---

## 2. Core features

### 2.1 Style learning ("Train")
- Onboarding: gender, age range, sizes (tops, bottoms, shoes) and a usual budget range.
- "This or that": 5+ rounds where the user picks one of two looks. Each pick updates the style profile.
- After each pick, show one sentence on what was learned, e.g. "Chunky soles added to your never list."
- Ongoing signals also update the profile: likes, "More like this" / "Not for me", saves, purchases and post-purchase fit feedback.
- The user can always retrain.

### 2.2 Style profile ("My style")
Editable and transparent. It shows:
- style-axis scores (e.g. Minimal 82%, Smart casual 64%, Streetwear 31%, Bold 9%),
- colour palette, liked attributes, and a "never show me" list,
- sizes and budget,
- stores to search (toggle each one),
- quality bar: minimum rating (default 4.2), minimum review count (default 200), hide sponsored,
- size by brand (e.g. Zara M, H&M L), learned from purchases and fit feedback.

### 2.3 Smart search
1. The user types natural language, e.g. "white sneakers under $90".
2. An LLM parses it into structured intent and merges in the profile (size, style, never-list, materials). Show the merged intent as chips: user's words in one colour, profile additions in another.
3. Query all enabled stores in parallel.
4. Run the **filter pipeline** and show it visually as a live count, e.g. 3,412 → 6:
   - sponsored placements removed
   - rating below threshold or too few reviews
   - suspicious reviews (see 4.3)
   - not your style (style score below threshold, or a never-list attribute)
   - size not in stock or over budget
   - duplicates (same product in several stores; keep the cheapest)
5. Show the top results with match %, verified rating, price, store and free-returns flag.
6. "Show what we removed and why": list removed items with their reason.

### 2.4 For you (home)
- **Weekly pick:** 1 hand-picked item per week (free and premium).
- **On sale in your style:** items that match the profile, are in the user's size and are discounted. Free users see a feed; premium users also get instant push alerts.
- Status of the user's hunts.
- **Occasions:** the user adds dates (birthday, wedding, holidays). 15 days before each one, suggest pieces with shop links.
- Price drops on saved items.

### 2.5 Find me this (Hunts)
- The user describes an item, sets a max price, and chooses stores only or stores + boutiques.
- A background job re-runs the search on a schedule (e.g. every 6 hours) and sends a push notification when matches appear.
- Status per hunt: Searching (with a checked count), Found N, Paused.
- **Free: 1 active hunt. Premium: unlimited.**

### 2.6 Photo match
- The user uploads a screenshot or photo (Instagram, Pinterest, street photo, product page).
- A vision model detects garment type, colour, material and cut, and estimates the original price tier.
- Visual similarity search finds the closest buyable items in the user's size, ranked by look first, then quality.
- Show "% alike", and how many cheaper copies were removed and why.
- **Free: 3 per month. Premium: unlimited.**

### 2.7 Item page
- Verified rating next to the store rating.
- Why it matches: 3–4 concrete reasons tied to the profile.
- **Fit check (Premium):** which size to order in this brand, based on review text ("runs small") and the user's own brand sizes.
- Price comparison across stores, with the cheapest highlighted.
- Affiliate "Buy on {store}" button, opened with the user's size pre-selected where the store supports it.
- "More like this" / "Not for me" (training signals).
- Complete the look: 3 complementary items in the user's size.

### 2.8 Saved and post-purchase
- Saved items with price watch.
- After a tracked purchase (or a self-reported one), ask: "How did it fit? Perfect / Too small / Too big / Sent back." This updates the size-by-brand data.

### 2.9 Plans
| | Free | Premium ($5.99/mo, 7-day trial) |
|---|---|---|
| Weekly pick | 1/week | 1/week |
| Sales in your style | Feed | Feed + instant alerts |
| Smart search | Stores | Stores + boutiques |
| Find me this | 1 active hunt | Unlimited |
| Photo match | 3/month | Unlimited |
| Size advice per brand | — | Yes |

Show the paywall at the moment a limit is hit, with the specific reason ("You've used your free hunt.").

---

## 3. Suggested tech stack (propose changes if better, with reasons)

- **App:** Expo (React Native, TypeScript), iOS + Android from one codebase.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions, cron), with pgvector for embeddings.
- **AI:**
  - LLM for query parsing, match explanations and review analysis.
  - Image embeddings (CLIP-class model) for style vectors and photo match.
  - A vision model for photo attribute detection.
- **Push:** Expo Notifications.
- **Payments:** RevenueCat (App Store / Play subscriptions).
- **Affiliate links:** a link-wrapping layer per store or network.

---

## 4. Key technical parts

### 4.1 Product data sources (the biggest risk; tackle it first)
- Build a **store adapter interface**: `search(intent) → normalized products[]` and `getProduct(id)`.
- Before building, research and report for each store whether a real product API or feed exists, and what access requires:
  - Amazon Product Advertising API (access depends on sales volume),
  - Trendyol, Temu and AliExpress affiliate programs,
  - ASOS, Zalando and H&M via affiliate networks (Awin, CJ, Rakuten, Impact) product feeds.
- Where only links exist (no catalog), say so clearly. Do not build scrapers that break store terms without the owner's explicit decision.
- Normalize every product to one schema: id, store, title, brand, price, old_price, currency, sizes_in_stock, rating, review_count, image_urls, attributes, is_sponsored, affiliate_url, free_returns.

### 4.2 Style matching
- Style vector per user, built from Train picks and feedback (positive and negative examples).
- Product vector from image + text embeddings.
- Match score = similarity, with hard filters (never-list, size, budget) applied before scoring.
- Ranking = match score × quality score × price fit. **No commission input.**

### 4.3 Review authenticity (verified rating)
Flag or down-weight reviews and products using:
- review bursts (many 5★ reviews in a short window),
- near-duplicate review text,
- a big gap between star rating and review sentiment,
- an unusually high share of very short 5★ reviews.

Show the verified rating separately from the store rating.

### 4.4 Background jobs
Hunts, sale detection, price watch, weekly pick generation and occasion reminders, all as scheduled functions with rate limits per store API.

### 4.5 Cost control
Cache search results and embeddings, apply the quotas from 2.9, and log the AI cost per user per month.

---

## 5. Data model (starting point)
users, style_profiles (scores, vector, palette, never_list, sizes, budget, quality_bar), brand_sizes, train_picks, feedback_events, products (normalized, cached), product_embeddings, searches, hunts, hunt_matches, saved_items, price_history, occasions, purchases, fit_feedback, subscriptions, affiliate_clicks.

---

## 6. Build order
1. **Data spike:** connect 2 real stores (whichever have accessible APIs or feeds) behind the adapter interface. Report what works.
2. Auth, onboarding and Train → style profile.
3. Smart search with the filter pipeline and the "removed and why" list.
4. Item page, affiliate click tracking and saved items.
5. For you: weekly pick, style-matched sales, occasions.
6. Hunts with background jobs and push.
7. Photo match.
8. Premium: RevenueCat, paywall, quotas, fit check.
9. Post-purchase fit feedback → size by brand.
10. Boutiques (manual onboarding; possibly a paid listing for boutiques later).

After each step: a short plain-language summary of what was built, how to test it on a phone, and what is next.

---

## 7. Definition of done for v1
- A new user can finish onboarding in under 2 minutes.
- A search returns ranked results from at least 2 real stores, with the filter counts and removal reasons shown.
- Affiliate links open the store with tracking, and clicks are logged.
- Hunts notify when a match appears.
- Free limits and the paywall work, and the subscription unlocks Premium.
- Ranking code provably contains no commission input.
