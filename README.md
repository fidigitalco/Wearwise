# WearWise

Your closet, styled for the day: three outfits that fit the weather, the occasion and your taste.

| Part | Folder | Stack |
|---|---|---|
| Mobile app (iOS + Android) | `frontend/` | React Native, Expo SDK 54, TypeScript, Expo Router |
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
Background removal is optional: `pip install rembg` and uploads get a cutout automatically.

**Mobile app:**

```bash
cd frontend
npm install
npx expo start
```

Open it in Expo Go on a phone on the same Wi-Fi; the app finds the backend on the Mac's LAN IP at :8000.
For tunnel mode or a remote server, set `EXPO_PUBLIC_API_BASE_URL` (see `.env.example`).

## API

All endpoints are under `/api/` and use `Authorization: Token <token>`.

| Endpoint | What it does |
|---|---|
| `POST auth/register/`, `auth/login/`, `auth/logout/` | Email + password auth, returns a token |
| `GET/PATCH/DELETE auth/me/` | Profile, location, account deletion |
| `GET meta/` | Categories, 22 named colours, occasions and other enums |
| `garments/` | Closet CRUD; photo upload extracts colours (k-means in CIELAB) |
| `POST garments/{id}/detect-colors/` | Re-run colour extraction |
| `POST recommendations/` | Three diverse outfits for an occasion + weather |
| `POST check-outfit/` | "Will it work?" score and explanation for a user-built outfit |
| `outfits/`, `POST outfits/{id}/save/`, `POST outfits/{id}/wear/` | Saved looks, history, wear log |
| `POST feedback/` | Like / dislike / rank / swap signals; updates the taste profile |
| `GET weather/?lat=&lon=` | Day forecast (Open-Meteo) |
| `GET stats/` | Closet size, 30-day rotation, never-worn count |

## How suggestions work (Wearwise.md §4, stages 9–13)

1. **Candidates**: slot templates (top + bottom or dress, shoes, optional outerwear and accessory) filtered by hard constraints: formality band for the occasion, a required layer when cold or wet, no heavy coat in the heat.
2. **Scoring**: colour harmony (heuristic priors, overridden by rated `ColorPair` rows), occasion, weather warmth and rain, silhouette, material, accessories, rotation, and personal taste.
3. **Taste**: feedback and "wore it" update per-user affinities for garments, colours, colour pairs and patterns.
4. **Diversity**: MMR re-ranking so the three looks do not share a key piece.
5. **Explanation**: one template sentence grounded on the top-scoring factors.

Not built yet: garment detection/segmentation from video, FashionCLIP embeddings and dedup, vision-LLM attribute tagging, the learned compatibility head and global ranker.
