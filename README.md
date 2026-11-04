# WearWise

Your closet, styled for the day: three outfits that fit the weather, the occasion and your taste.

| Part | Folder | Stack |
|---|---|---|
| Mobile app (iOS + Android) | `frontend/` | React Native, Expo SDK 58, TypeScript, Expo Router |
| Web app | `web-app/` | React + Vite, TypeScript *(not started)* |
| Admin panel | `admin/` | Next.js, TypeScript *(not started; Django admin at `/admin/` meanwhile)* |
| Backend API | `backend/` | Python, Django 5.2 + Django REST Framework |

The AI plan behind the engine is in [Wearwise.md](Wearwise.md).

## Run locally

**Backend** (http://localhost:8000):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser   # optional, for /admin/
.venv/bin/python manage.py runserver 0.0.0.0:8000
.venv/bin/python manage.py test api          # tests
```

SQLite is used unless `DATABASE_URL` is set (Postgres in production).
Background removal (rembg, in requirements) runs in the background after an upload, so saving a photo never waits for it;
the first run downloads the `isnet-general-use` model (~170 MB; `REMBG_MODEL` picks another).
`python manage.py make_cutouts` gives existing pieces a cutout. Demo pieces ship with theirs in `api/sample_images/cutouts`.

**Mobile app:**

Needs Node 22.13+ (SDK 58). `frontend/.nvmrc` pins it for nvm.

```bash
cd frontend
nvm use
npm install
npx expo start --lan
```

Open it in Expo Go (the store version supports SDK 58) on a phone on the same Wi-Fi; the app finds the backend on the Mac's LAN IP at :8000.
If the phone cannot reach it, allow incoming connections for Python and node in the macOS firewall.
For tunnel mode or a remote server, set `EXPO_PUBLIC_API_BASE_URL` (see `.env.example`).

**Admin panel** (http://localhost:3002, Next.js, same design as the SaveDo admin):

```bash
cd admin
npm install
npm run dev
```

Sign in with a staff account (`is_staff`, e.g. one made by `createsuperuser`). It talks to `NEXT_PUBLIC_API_URL`
(default `http://localhost:8000`) through the staff-only `/api/admin/…` endpoints: dashboard, analytics, users
(plan, block, delete) and premium. Admins see counts and anonymous totals only, never a user's closet, photos, outfits or wear history.

## API

All endpoints are under `/api/` and use `Authorization: Token <token>`.

| Endpoint | What it does |
|---|---|
| `POST auth/register/`, `auth/login/`, `auth/logout/` | Email + password auth, returns a token |
| `GET/PATCH/DELETE auth/me/` | Profile, location, preferences (styles, favourite colours, sizes, occasions, units, notifications), account deletion |
| `GET meta/` | Categories, 22 named colours, occasions and other enums |
| `garments/` | Closet CRUD; photo upload extracts colours (k-means in CIELAB); `?favorite=true` filter |
| `POST/DELETE garments/sample/` | Load (409 `already_loaded` if present) or remove the 16-piece sample wardrobe |
| `POST garments/{id}/detect-colors/` | Re-run colour extraction |
| `POST recommendations/` | Three diverse outfits for an occasion + weather, each with a title and reasons; asking again skips looks already shown that day |
| `GET recommendations/latest/?occasion=` | Today's most recent suggestion set (404 if none) |
| `POST check-outfit/` | "Will it work?" score and explanation for a user-built outfit |
| `outfits/`, `POST outfits/{id}/save/`, `POST outfits/{id}/wear/` | Saved looks, history, wear log |
| `POST assistant/` | Stylist chat: `{message}` → `{reply, outfits, suggestions}` (rule-based, English and Azerbaijani) |
| `POST feedback/` | Like / dislike / rank / swap signals; updates the taste profile |
| `GET weather/?lat=&lon=` | Day forecast (Open-Meteo): temperature, rain chance, wind, snow |
| `POST plan/read/` | The day's plan in words → occasion and formality (`{text}` → `{occasion, level}`) |
| `GET shopping/` | What the closet is missing, each with the colour that unlocks the most outfits and how many |
| `POST shopping/check/` | "Will this fit my wardrobe?": `{subcategory, color}` → Great buy / Works / Skip it, with a better colour |
| `POST shopping/click/` | Logs a store tap (affiliate reporting; admins see totals only) |
| `POST app-feedback/` | Settings → Send feedback; staff read it in the admin panel |
| `GET stats/` | Closet size, 30-day rotation, never-worn count, wear activity, favourites, recently added |

## How suggestions work (Wearwise.md §4, stages 9–13)

1. **Candidates**: slot templates (top + bottom or dress, shoes, optional outerwear and accessory) filtered by hard constraints: formality band for the occasion, a required layer when cold or wet, no heavy coat in the heat.
2. **Scoring**: colour harmony (heuristic priors, overridden by rated `ColorPair` rows), occasion, weather warmth and rain, silhouette, material, accessories, rotation, and personal taste.
3. **Taste**: feedback and "wore it" update per-user affinities for garments, colours, colour pairs and patterns.
4. **Diversity**: MMR re-ranking so the three looks do not share a key piece.
5. **Explanation**: one template sentence grounded on the top-scoring factors.

## Mobile app structure (`frontend/src`)

| Folder | What lives there |
|---|---|
| `app/` | Expo Router screens: tabs (Home, Wardrobe, Outfits, Profile), welcome, auth, onboarding, garment add/review, outfit details, "Will it work?", AI stylist, search, saved, preferences |
| `components/` | Reusable UI: buttons, chips, search field, section header, empty/error/loading states, bottom sheet, confirmation dialog, toast, garment card and image, outfit card, hero card and composition, compatibility score, weather summary, preference selectors, icons |
| `services/` | `api.ts` (every backend call, one place) |
| `lib/` | auth, i18n (`strings/en.ts`, `strings/az.ts`), taxonomy labels, small on-device lists |
| `theme/` | colours, typography, spacing, radii, elevation |
| `types/` | shared TypeScript models matching the API |

Photos in `assets/images/` are from Unsplash (free licence); sources in `assets/images/CREDITS.md`.

## What is real, what is a stand-in, what comes later

Real today (backend + app):
- Email sign-up and sign-in, onboarding preferences, profile and settings.
- Wardrobe with photo, multi-photo and video adding; AI tagging of each piece (needs `ANTHROPIC_API_KEY`; without it the type is picked by hand).
- Five languages: Azerbaijani, English, Russian, Turkish, Spanish. The app's strings are in
  `frontend/src/lib/strings/<lang>.ts`; server-written text (stylist replies, outfit titles, reasons) uses
  `say(lang, en, az)` in `backend/api/locale.py`, with the other languages in `backend/api/locales/<lang>.json`.
  After adding a sentence, run `python manage.py locale_catalog` and translate the new lines; until then it shows in English.
- Voice questions to the stylist in any of the five languages: the language is heard from the recording, not
  taken from the app (Azerbaijani and Turkish are too close to tell apart, so the app's language decides between them). Whisper runs in the cloud with `GROQ_API_KEY` or `OPENAI_API_KEY` (a second or two), else locally
  (`small` picks the language, `large-v3-turbo` writes it; both load when the server starts). Replies come in the
  app's language.
- Rule-based outfit engine with weather, occasion, style, colour harmony, rotation and taste learning; titles and "why it works" reasons.
- Swapping a piece, likes, saves, marking as worn, search, saved items, stats.
- Shop (WearWise_Prototype_Spec.md §2.4): gaps with "unlocks N outfits", "Will this fit my wardrobe?", store links
  (Trendyol searched in Turkish, AliExpress, Amazon) behind an "Affiliate link" sheet, each link with an anonymous sub-id.
  The links do not earn commission yet: that needs Skimlinks/Admitad or a Trendyol agreement (see the affiliates sheet).
- Today's plan in free text → occasion and formality (§3.5); wind, snow and fabric warmth in the weather score (§3.3).
- Avatar (§2.3): a 2D figure from height, weight, skin tone and an optional face photo, wearing the outfit on the outfit
  screen. Kept on the phone only, never uploaded.

Stand-ins, behind service interfaces so they can be replaced:
- **AI stylist** (`POST /api/assistant/`, `backend/api/assistant.py`): rule-based intent matching over the user's own wardrobe. An LLM can replace `answer()` without changing the app.
- **Sample wardrobe** (`POST /api/garments/sample/`): 16 photo-less pieces for trying the app; removable from the Wardrobe screen.
- **Apple sign-in**: shown disabled ("coming soon").
- **Subscription**: shown disabled ("coming soon").

Later (see Wearwise.md):
- Garment segmentation (SAM 2) for clean cutouts from video, FashionCLIP embeddings and duplicate detection.
- The learned compatibility head and global ranker.
- Production background worker (Celery) for video scans instead of a thread.
