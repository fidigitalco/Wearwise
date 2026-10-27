# WearWise AI Resources and Training Plan v0.1

Datasets, models and GitHub repositories for building the WearWise fashion AI, with licensing notes and a recommended low-cost training strategy.

> **Licensing rule:** verify every licence on the official source before commercial use. Lines marked **verify** were not confirmed against an official page when this file was written. This file is not legal advice.

---

## 1. Datasets

| Dataset | What it has | Outfits? | Licence / access | Commercial use | Best use in WearWise |
|---|---|---|---|---|---|
| **Fashionpedia** ([site](https://fashionpedia.github.io/home/index.html), [repo](https://github.com/cvdfoundation/fashionpedia)) | Expert ontology: 27 apparel categories, 19 apparel parts, 294 fine-grained attributes; segmentation masks with per-mask attributes | No | CC BY 4.0 (dataset card) | Likely yes with attribution. **Verify** the licences of the underlying images. | Attribute taxonomy; training garment detection and attribute models |
| **Clothing dataset (Alexey Grigorev)** ([full](https://github.com/alexeygrigorev/clothing-dataset), [small](https://github.com/alexeygrigorev/clothing-dataset-small)) | ~5,000 real, user-shot photos; small version has 10 classes | No | README says freely usable for any purpose. **Verify** the exact licence file. | Likely yes | Realistic "phone photo" test set; prototype images |
| **DeepFashion** ([site](https://mmlab.ie.cuhk.edu.hk/projects/DeepFashion.html)) | 800k+ images, 50 categories, 1,000 attributes, landmarks | No | Signed agreement; non-commercial research only | **No** | Internal benchmarking only, not in product models |
| **DeepFashion-MultiModal** (same site) | Parsing labels, keypoints, fine-grained labels, text | No | Same agreement as DeepFashion | **No** | Research only |
| **DeepFashion2** | Detection, segmentation, landmarks, consumer-to-shop pairs | No | **Verify**: believed non-commercial | Assume no | Research only |
| **Polyvore Outfits** (Vasileva et al.) ([code + data link](https://github.com/mvasil/fashion-compatibility)) | User-made outfits with type-aware splits; compatibility and fill-in-the-blank tasks (~6 GB) | **Yes** | Images scraped from the defunct Polyvore site; no clear commercial licence | Treat as research-only | Benchmark the compatibility model; learn methods, not ship weights |
| **Polyvore (Han et al.)** ([repo](https://github.com/xthan/polyvore-dataset)) | 21,889 outfits (17,316 / 1,497 / 3,076 split); ~7k compatibility labels | **Yes** | Research use; **verify** | Treat as research-only | Benchmark |
| **iMaterialist Fashion** ([repo](https://github.com/visipedia/imat_fashion_comp)) | ~1M images with attribute labels (competition) | No | Competition terms; **verify** | Unclear | Attribute research |
| **IQON3000** | Japanese outfit dataset with user data | **Yes** | **Verify** access and licence | Unknown | Only if permission is granted |
| **Fashion-MNIST** ([repo](https://github.com/zalandoresearch/fashion-mnist)) | 70k tiny 28×28 grayscale product images | No | MIT (**verify**) | Yes | Teaching and tests only; too low-resolution for the product |

**Takeaway:** almost all outfit-compatibility datasets are research-only. The commercially safe path is to:

- use permissively licensed attribute data (Fashionpedia, CC0 photos),
- add your own stylist-labelled outfits,
- and build up user feedback over time.

---

## 2. Pretrained models

| Model | Task | Licence | Notes |
|---|---|---|---|
| **FashionCLIP / FashionCLIP 2.0** ([repo](https://github.com/patrickjohncyh/fashion-clip), HF `patrickjohncyh/fashion-clip`) | Fashion image-text embeddings, zero-shot attributes | MIT on Hugging Face | Trained on Farfetch product images, so biased to centred white-background shots. Real closet photos need background removal first. |
| **SegFormer B2 clothes** (HF `mattmdjaga/segformer_b2_clothes`) | Clothing and human parsing, 18 labels (upper clothes, pants, skirt, dress, belt, shoes, bag, scarf…) | Card says MIT, but points to NVIDIA's SegFormer licence | **Verify.** The NVIDIA licence may restrict commercial use. Fine for prototyping. |
| **SAM 2 (Meta)** | Promptable segmentation of images and video | Apache-2.0 (**verify**) | Good for video closet scan: track a garment across frames |
| **Grounding DINO** | Open-vocabulary detection ("jacket", "shoe") | Apache-2.0 (**verify**) | Pair with SAM for detect-then-segment |
| **rembg / U²-Net** ([repo](https://github.com/danielgatis/rembg)) | Background removal | rembg MIT; U²-Net Apache-2.0 (**verify**) | Used in the current prototype; quality is good on flat-lays |
| **OpenCLIP / SigLIP family** | General image embeddings | Mostly Apache / MIT (**verify per checkpoint**) | Fallback or baseline vs. FashionCLIP |
| **Vision LLM (Claude, GPT-4o class)** | Attribute extraction, explanation, occasion classification | Commercial API terms | Fastest MVP route for tagging and explanations; cost per image matters |

---

## 3. GitHub repositories worth studying

| Repo | Why |
|---|---|
| [mvasil/fashion-compatibility](https://github.com/mvasil/fashion-compatibility) | Type-aware embeddings; their pretrained model reports compatibility AUC 0.88 and fill-in-the-blank 57.6 |
| [xthan/polyvore-dataset](https://github.com/xthan/polyvore-dataset) | Bi-LSTM outfit compatibility baseline and dataset |
| [iLearn-Lab/MM21-OCMCF](https://github.com/iLearn-Lab/MM21-OCMCF) | Outfit compatibility via complementary factorization; MIT; checkpoints on Hugging Face |
| [AlenUbuntu/Fashion-AI](https://github.com/AlenUbuntu/Fashion-AI) | PyTorch codebase: compatibility prediction, personalized recommendation, DeepFashion2 tasks; context-aware model reaches very high FITB in their table |
| [patrickjohncyh/fashion-clip](https://github.com/patrickjohncyh/fashion-clip) | Embeddings and zero-shot tagging |
| [cvdfoundation/fashionpedia](https://github.com/cvdfoundation/fashionpedia) | Ontology and API |
| [mattmdjaga/segformer_b2_clothes](https://github.com/mattmdjaga/segformer_b2_clothes) | Clothes segmentation training code |
| [danielgatis/rembg](https://github.com/danielgatis/rembg) | Background removal |
| [alexeygrigorev/clothing-dataset](https://github.com/alexeygrigorev/clothing-dataset) | Real user-shot clothing photos |
| [open-mmlab/mmfashion](https://github.com/open-mmlab/mmfashion) | Older toolbox (attribute prediction, compatibility); archived, useful for reference |

**Curated lists:**

- [ayushidalmia/awesome-fashion-ai](https://github.com/ayushidalmia/awesome-fashion-ai)
- [zhanhuijing/Cool-Fashion-Papers](https://github.com/zhanhuijing/Cool-Fashion-Papers)
- [Twizwei/awesome-visual-fashion-ai](https://github.com/Twizwei/awesome-visual-fashion-ai)

Key papers to read: Type-Aware Embeddings (ECCV 2018), Bi-LSTM Compatibility (ACM MM 2017), POG (Alibaba, KDD 2019), Fashion++ (minimal outfit edits), Creating Capsule Wardrobes from Fashion Images.

---

## 4. Recommended AI architecture (early stage)

**Do not train a large model from scratch.** Combine pretrained perception, a rule layer, a small learned ranker and an LLM for language.

| Stage | Approach | Model / method | Output | Confidence handling |
|---|---|---|---|---|
| 1. Input | Video frames (~2 fps), photos, links, receipts | Blur and duplicate filtering | Clean frames | Drop frames below sharpness threshold |
| 2. Garment detection | Pretrained | Grounding DINO or SegFormer clothes | Boxes and labels | Under 0.5: discard; 0.5–0.75: flag "Check this" |
| 3. Segmentation | Pretrained | SAM 2 (track across video) + rembg cleanup | Cutout per garment | Manual crop fallback |
| 4. Deduplication | Embedding similarity | FashionCLIP cosine > ~0.9 + colour match | One record per garment | Ask the user when uncertain |
| 5. Attributes | Vision LLM + FashionCLIP zero-shot | Type, pattern, sleeve, neckline, sheen | Attribute JSON | Each attribute has its own confidence; under 0.75 shows edit prompt |
| 6. Colour | Deterministic | k-means in CIELAB on cutout pixels, mapped to 22 named colours | Dominant and secondary colours | Warn in poor light (low L\* variance) |
| 7. Material | Estimate + verify | Vision LLM estimate; care-label OCR; user input | Material + source + confidence | Never state composition as fact without label or user |
| 8. Wardrobe DB | Postgres + pgvector | — | Garments with embeddings | — |
| 9. Candidates | Rule-based | Slot templates filtered by hard constraints (KB section 6.1) | 200–2,000 candidate outfits | Never empty; relax optional slots |
| 10. Scoring | Rules + learned | Knowledge-base priors + pairwise compatibility on embeddings | Score per dimension | — |
| 11. Personal ranking | Learned per user | Pairwise preference model (Bradley–Terry or logistic on feature differences); later a global LightGBM ranker | Personal score | Cold start uses onboarding boards |
| 12. Diversity | Re-ranking | MMR over outfit embeddings | Top 3 distinct outfits | — |
| 13. Explanation | LLM | Grounded on top factors only | One sentence | Template fallback if the LLM fails |
| 14. Feedback | Logging | Ranks, swaps, "wore it", edits | Training signals | — |

### What is trained vs. retrieved vs. rule-based

- **Rule-based:** weather and occasion constraints, colour and material priors, variety rules.
- **Retrieved (RAG):** knowledge-base snippets passed to the LLM for explanations and "Will it work?" reasoning.
- **Pretrained, not trained:** detection, segmentation, embeddings.
- **Trained by you:**
  - a small compatibility head on FashionCLIP embeddings, using your licensed and stylist data;
  - per-user preference weights;
  - later, a global ranker from aggregated feedback.

---

## 5. Building the training data

### 5.1 Data provenance labels

Every record must carry `label_source` with one of: `expert`, `sourced` (with licence), `synthetic`, `user_feedback`, `illustrative`. Never mix illustrative or synthetic labels into evaluation sets.

### 5.2 Seed dataset plan

| Set | Size to start | How |
|---|---|---|
| Expert positive outfits | 500 | 2–3 freelance stylists build outfits from a licensed garment pool, across menswear, womenswear and neutral styles, many occasions and seasons |
| Negatives | 500 | Random swaps, rated by stylists |
| Hard negatives | 300 | One rule broken on purpose (formality, weather, near-white clash, pattern scale) |
| Colour-pair judgments | 231 pairs × 3 raters | Rate the matrix in `wearwise-color-matrix.json`; replace heuristic scores with the mean |
| Material pairs | ~150 | Rate texture combinations from KB section 2.3 |

**Label quality:**

- At least 2 raters per item.
- Measure agreement (Krippendorff's α). Re-brief raters when α < 0.6.
- Keep disagreements as a "conditional" label rather than forcing a verdict.

**Expansion:**

1. After launch, user rankings provide thousands of pairwise preferences per week.
2. Retrain the global ranker monthly.
3. Re-label only where offline metrics and user satisfaction disagree.

### 5.3 Schemas

**Garment record:**

```json
{
  "garment_id": "g_01J9...",
  "user_id": "u_123",
  "category": "outerwear",
  "subcategory": "rain_jacket",
  "colors": [{"name": "yellow", "rgb": [217,169,51], "lab": [72.1, 8.4, 61.0], "share": 0.86}],
  "pattern": "solid",
  "material": {"value": "nylon", "source": "visual_estimate", "confidence": 0.55},
  "surface": "smooth", "sheen": "low",
  "fit": "regular", "length": "hip",
  "season": ["spring", "autumn"], "warmth": 2, "rain_ok": true,
  "formality": 2, "occasion_tags": ["casual", "travel"], "style_tags": ["outdoor"],
  "embedding_model": "fashion-clip-2.0", "embedding_ref": "vec_789",
  "attribute_confidence": {"category": 0.97, "color": 0.91, "material": 0.55},
  "times_worn": 7, "last_worn_at": "2026-10-18", "status": "available"
}
```

**Outfit record:**

```json
{
  "outfit_id": "o_456",
  "garment_ids": ["g_1", "g_2", "g_3", "g_4"],
  "palette": ["navy", "beige", "brown", "yellow"],
  "materials": ["merino", "cotton_twill", "suede", "nylon"],
  "context": {"occasion": "client_meeting", "season": "autumn", "temp_c": 11, "precip_prob": 0.7},
  "style_direction": "smart_casual",
  "scores": {"color": 86, "silhouette": 78, "material": 81, "occasion": 90, "weather": 95, "accessories": 80, "taste": 72, "rotation": 60, "total": 82.4},
  "expert_rating": null,
  "explanation": "Navy over beige is a classic low-contrast pairing; the rain jacket covers the 70% rain chance.",
  "label_source": "user_feedback",
  "provenance": {"dataset": null, "license": null}
}
```

**Feedback record:**

```json
{
  "feedback_id": "f_789",
  "user_id": "u_123",
  "outfit_set_id": "set_2026-10-28_pitch",
  "outfit_id": "o_456",
  "rank": 1,
  "liked": true,
  "removed_garment_ids": [],
  "replaced": [{"from": "g_3", "to": "g_9"}],
  "rejection_reason": null,
  "worn": true,
  "context": {"occasion": "client_meeting", "temp_c": 11},
  "created_at": "2026-10-27T21:04:00Z"
}
```

**Database:**

- Postgres tables: `garments`, `outfits`, `outfit_items`, `rankings`, `wear_log`, `taste_profiles`, `color_pairs`, `material_pairs`, `labels`.
- `pgvector` for embeddings.
- Object storage for images.
- Store event titles from the calendar only as classified occasions.

### 5.4 Illustrative examples

`wearwise-seed-examples.json` contains 30 illustrative examples showing positive, negative, hard-negative and conditional labels. They are marked `"validated": false` and must be confirmed by stylists before training.

---

## 6. Evaluation

| Area | Metric | MVP target |
|---|---|---|
| Garment detection (video) | Recall of visible garments | ≥ 80% |
| Duplicates | Duplicate rate after dedup | < 10% |
| Type / colour tagging | Top-1 accuracy | ≥ 85% / ≥ 80% |
| Material estimate | Accuracy vs. label (when shown) | Track only; never claimed as fact |
| Compatibility model | AUC on held-out expert labels | ≥ 0.80 |
| Ranking | NDCG@3 against user ranks; rank-1 agreement | Beat rules-only baseline by +10% |
| Diversity | Mean pairwise outfit distance of top 3 | Above threshold; no shared key piece in ≥ 2 of 3 |
| Reliability | Hard-constraint violations | 0 |
| Satisfaction | % of days with a rank-1 outfit actually worn | Rising week over week |
| Rotation | % of closet worn in 30 days | Up vs. user baseline |

Run every change as an offline replay against logged rankings first, then as an A/B test.
