# WearWise: real məhsul məlumatını haradan almaq olar

*Tarix: 16 noyabr 2026. Kimin üçün: WearWise-in təsisçisi (texniki olmayan oxucu üçün sadə dildə yazılıb).*

## Bu sənəd nə haqqındadır

WearWise-ə real geyim məhsulları lazımdır: açar sözlə və ya kateqoriyaya görə axtarış, qiymət, stokda olan ölçülər, şəkillər, reytinq (ulduz), rəy sayı və affiliate link (kliklə satış olanda bizə komissiya gətirən link). Mağazaların hər biri bu məlumatı eyni şəkildə vermir. Bəzisinin əsl **API**-si var (bizim server proqramı ondan istədiyi vaxt məhsul soruşa bilir). Bəzisi **feed** verir (bütün kataloqu bir fayl kimi, gündə bir neçə dəfə yenilənərək). Bəzisi isə yalnız **deep link** verir: məhsulun öz linkini düzəldə bilərsən, amma kataloqa (məhsul siyahısına) çıxış yoxdur.

Store terms-i pozan scraping (saytı icazəsiz "oxumaq") burada **tövsiyə olunmur**.

Qısa terminlər:
- **API**: proqramın məhsul soruşa bildiyi "qapı". Ən yaxşı variantdır.
- **Feed**: kataloqun fayl şəklində verilməsi. Bunu öz bazamıza yükləyirik və axtarışı özümüz edirik. Bu da yaxşıdır.
- **Deep link only**: yalnız link var, kataloq yoxdur. Məhsulu tətbiqdə göstərmək üçün yararsızdır.
- **Affiliate network**: bir çox mağazanı bir yerdə toplayan vasitəçi şirkət (Awin, CJ, Rakuten Advertising, Impact, Partnerize). Əvvəlcə network-ə, sonra hər mağazaya ayrıca müraciət edilir.

---

## Xülasə cədvəli

| Mənbə | Real API/feed? | Nə tələb olunur | Təsdiq müddəti (təxmini) | Qiymət | rating / review_count / sizes | Ölkələr | Mobil app backend-dən? |
|---|---|---|---|---|---|---|---|
| **AliExpress** (Portals + Affiliate API) | **Bəli**: axtarış API-si (`aliexpress.affiliate.product.query`) | Pulsuz affiliate hesabı + Open Platform-da app (App Key) | ~1-3 iş günü (3-cü tərəf mənbələri) | Pulsuz | rating: **qismən** (`evaluate_rate` müsbət rəy faizidir, ulduz deyil). review_count: **yox** (əvəzinə satış sayı, `lastest_volume`). sizes: **qismən** (SKU detail ilə) | Qlobal, Azərbaycan daxil (`ship_to_country`) | **Bəli** (gizli açarlar serverdə qalmalıdır) |
| **Awin** (Zalando Lounge/Privé, bəzi ASOS/H&M regionları, Temu və s.) | **Bəli**: product feeds + Publisher Product API (JSON Lines) | Publisher qeydiyyatı (1 GBP/EUR/USD geri qaytarılan depozit), işləyən sayt/app, hər mağazaya ayrıca müraciət | Network: ~48 saat. Hər mağaza: günlər-həftələr, rədd də ola bilər | Pulsuz | rating/reviews: **sütun var, amma mağaza doldursa** (`average_rating`, `reviews`). sizes: **bəli** (`size`). Ölçüyə görə stok: yalnız mağaza variantları ayrıca versə | Mağazadan asılı (əsasən UK/AB) | **Bəli** (feed serverə yüklənir) |
| **CJ Affiliate** (bəzi H&M/ASOS regionları) | **Bəli**: Product Search API (GraphQL, `ads.api.cj.com`) | Publisher hesabı + mağazaya qoşulmaq (qoşulmasan 403 qaytarır) | Network: günlər. Mağazalar: ayrıca | Pulsuz | Feed-dən asılı. Adətən ölçü var, rəy sayı nadirdir | Mağazadan asılı (əsasən ABŞ/AB) | **Bəli** |
| **Rakuten Advertising** (ASOS, H&M bəzi bazarlar) | **Bəli**: Product Search API (`api.linksynergy.com`, maks. 5000 nəticə) | Publisher hesabı + mağaza təsdiqi | Network + mağaza: günlər-həftələr | Pulsuz | Feed-dən asılı; rəy sayı adətən yoxdur | Mağazadan asılı | **Bəli** |
| **Impact** (Temu daxil bir çox brend) | **Bəli**: Catalogs/ItemSearch API + FTP | Partner hesabı + brend təsdiqi + API girişinin açılması | Günlər-həftələr | Pulsuz | Brend kataloquna bağlıdır | Brenddən asılı | **Bəli** |
| **Amazon** (Creators API, PA-API 5-in yerinə) | **Bəli, amma bağlı**: son 30 gündə **10 satış** olmadan API verilmir | Associates hesabı (180 gündə 3 satış olmasa bağlanır) + 10 satış/30 gün | Satış gəlməyincə çıxış yoxdur | Pulsuz | rating/review_count: **yox** (resources siyahısında yoxdur). sizes: **qismən** (GetVariations) | 20+ Amazon marketplace (ABŞ, UK, DE, TR, AE və s.). Azərbaycan marketplace-i yoxdur | **Bəli** (çıxış açılandan sonra) |
| **Trendyol** | **Yox**: affiliate üçün açıq API/feed tapılmadı. Developer API yalnız satıcılar üçündür | Influencer/affiliate proqramına müraciət (əsasən sosial media hesabı ilə) | ~1 həftə (rəsmi səhifə) | Pulsuz | — | TR + beynəlxalq (Azərbaycana birbaşa çatdırılma qismən) | **Yalnız deep link** |
| **Temu** | **Qismən**: rəsmi açıq API yoxdur. Network-lər (Impact, Awin, FlexOffers) üzərindən feed ola bilər | Network-ə və Temu proqramına müraciət | Günlər-həftələr | Pulsuz | Təsdiqlənmədi | Regiona görə ayrı proqramlar | Feed versələr, bəli |
| **Hepsiburada** | **Yox**: açıq affiliate proqramı/API tapılmadı (LinkGelir fərdi istifadəçilər üçündür) | — | — | — | — | TR | **Yalnız deep link** (o da məhdud) |
| **Skimlinks** (Product Key) | **Bəli, amma əlçatmaz** | Yalnız "Managed" hesablar, yalnız US/UK/AU publisher-lər | — | Pulsuz | qiymət, stok, şəkil var; rəy sayı aydın deyil | Qlobal mağazalar | Bəli, amma bizə verilmir |
| **Sovrn Commerce** (Price Comparison) | **Qismən** | Sovrn Commerce təsdiqi | Günlər-həftələr | Pulsuz | Qiymət müqayisəsi; rəy/ölçü aydın deyil | Əsasən ABŞ/UK | Bəli |
| **ShopStyle Collective API** | **Yox**: ShopStyle/Collective Voice iyul 2026-da bağlandı | — | — | — | — | — | Yox |
| **Lyst** | **Yox**: açıq məhsul API-si yoxdur | — | — | — | — | — | Yox |
| **Klarna** (Agentic Product Protocol) | **Qismən**: yalnız təsdiqlənmiş partnyorlar üçün | E-poçtla giriş istəmək | Aydın deyil | Aydın deyil | Aydın deyil | Klarna/PriceRunner bazarları | Təsdiq olsa, bəli |
| **Google Merchant API** (köhnə Content API) | **Yox** (bizim üçün): yalnız öz məhsullarını idarə etmək üçündür, başqalarının məhsulunu axtarmaq olmur. Content API 18 avqust 2026-da bağlandı | — | — | — | — | — | Yox |
| **SerpApi Google Shopping** (ödənişli ehtiyat variant) | **Bəli**: Google Shopping nəticələrini JSON kimi qaytarır | Qeydiyyat + kart | Dərhal | Pulsuz 250 axtarış/ay; $25/1000; $75/5000; $150/15 000 | rating: **bəli**, reviews: **bəli**, sizes: **yox**. Affiliate link: **yox** | `gl` ilə ölkə seçilir | Bəli. Amma Google-un nəticələrini oxuyur, hüquqi cəhətdən boz zonadır (aşağıya bax) |

---

## Hər mənbə ayrıca

### 1. Amazon: Product Advertising API → Creators API

- **Nə dəyişib:** PA-API 5 artıq bağlanıb. Rəsmi səhifəyə görə PA-API 5-ə gedən sorğular indi **HTTP 403** qaytarır, yerinə **Creators API** gəlib. Creators API-də dörd əməliyyat var: SearchItems (axtarış), GetItems, GetVariations (variantlar: ölçü, rəng), GetBrowseNodes (kateqoriyalar).
- **Giriş şərti:** Hədəf marketplace-də Associates hesabı lazımdır. Bundan əlavə **son 30 gündə ən azı 10 qualifying sale** olmalıdır. 30 gün ərzində heç bir satış olmasa, giriş itir. Qeydiyyatı yalnız hesabın əsas sahibi edə bilər. Associates hesabının özünə dair də qayda var: ilk **180 gündə 3 satış** olmasa, hesab bağlanır.
- **Nəticə:** Satış tarixçəsi olmayan yeni tətbiq **API-ni dərhal ala bilməz**. Əvvəlcə adi linklərlə (deep link) satış gətirmək lazımdır.
- **Rating/review_count:** Creators API-nin rəsmi resources siyahısında (BrowseNodeInfo, Images, ItemInfo, OffersV2, ParentASIN, SearchRefinements, VariationSummary) **CustomerReviews yoxdur**. Yəni ulduz və rəy sayı gəlmir.
- **Sizes:** GetVariations / VariationSummary ilə qismən gəlir.
- **Ölkələr:** ABŞ, UK, DE, FR, JP, CA, IT, ES, IN, BR, MX, AU, AE, SG, NL, SA, SE, PL, BE, IE, TR, EG. Hər marketplace üçün ayrıca Associates hesabı lazımdır. Azərbaycanın öz Amazon-u yoxdur və geyimlərin çoxu Azərbaycana göndərilmir.
- **Ödəniş:** Bank köçürməsi yalnız müəyyən ölkələrin hesablarına edilir. Azərbaycan bankı ilə ödəniş alınıb-alınmadığını yoxlamaq lazımdır (məs., Payoneer).
- Mənbələr: [PA-API deprecation](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation) · [Creators API introduction](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction) · [Resources](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/resources) · [Migration](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi) · [API rates](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/concepts/api-rates)

### 2. Trendyol

- **Affiliate proqramı:** Trendyol-un influencer/affiliate proqramı var. Müraciət pulsuzdur və təxminən bir həftəyə baxılır. Proqram əsasən sosial media hesabı olan şəxslər üçündür. Linklər Trendyol tətbiqində yaradılır, komissiya təxminən 5% göstərilir (3-cü tərəf mənbəsi).
- **API/feed:** Affiliate-lər üçün açıq məhsul API-si və ya feed **tapılmadı**. developers.trendyol.com-dakı API yalnız **satıcılar** (öz mağazasını idarə edənlər) üçündür, başqasının məhsulunu axtarmağa yaramır. Admitad-da Trendyol TR proqramları "closed" görünür.
- **Nəticə:** **Yalnız deep link.** Kataloq yoxdur. Rəsmi partnyorluq (Trendyol-un partnership komandası ilə birbaşa razılaşma) olmasa, tətbiqdə Trendyol məhsullarını siyahı kimi göstərmək olmaz.
- **Azərbaycan:** Trendyol PASHA Holding ilə birgə müəssisə qurub. Bəzi məhsullar indi birbaşa Azərbaycan ünvanına çatdırılır, amma hamısı yox. Gömrük limiti ayda $300-dır.
- Mənbələr: [Trendyol influencer program](https://www.trendyol.com/el/s/trendyol-influencer-program) · [developers.trendyol.com](https://developers.trendyol.com/int/) · [Trend.az: birbaşa çatdırılma](https://www.trend.az/business/3743359.html) · [Meydan TV](https://www.meydan.tv/en/article/trendyols-partnership-with-pasha-holding-worries-local-azerbaijani-transport-companies/) · [PR Newswire: PASHA JV](https://www.prnewswire.com/il/news-releases/trendyol-and-pasha-holding-sign-an-agreement-for-a-joint-venture-in-the-azerbaijan-market-301811854.html) · [affi.io: Trendyol](https://affi.io/m/trendyol)

### 3. Temu

- Temu-nun **rəsmi açıq affiliate API-si tapılmadı**. Temu proqramları Impact, Awin, FlexOffers, Daisycon və başqa network-lərdə var. Daisycon və FlexOffers "product feed possible" yazır. Bu, network-dən feed almağın mümkün olduğunu göstərir, amma təsdiqlənməyib.
- Komissiya mənbələrdə fərqlidir (3% ilə 20% arası).
- **Nəticə:** **Qismən.** Ən real yol Impact və ya Awin vasitəsilə Temu proqramına qoşulub kataloq/feed olub-olmadığını soruşmaqdır.
- Mənbələr: [Affilitizer: Temu](https://www.affilitizer.com/programs/temu.com) · [Daisycon: Temu INT](https://daisycon.com/es/campanas/18371-temu-int) · [FlexOffers: Temu AT](https://www.flexoffers.com/affiliate-programs/temu-at-affiliate-program/) · [Awin: Temu](https://ui.awin.com/merchant-profile/118249)

### 4. AliExpress: Portals + Affiliate API

- **API:** Bəli, real axtarış API-si var. Əsas metodlar:
  - `aliexpress.affiliate.product.query`: açar söz, kateqoriya, qiymət filtri ilə axtarış.
  - `aliexpress.affiliate.productdetail.get`: məhsulun detalları.
  - Link yaratma metodları.
  Sorğular `api-sg.aliexpress.com` ünvanına gedir. Bir səhifədə 50-yə qədər nəticə qayıdır.
- **Qayıdan sahələr:** başlıq, `sale_price` / `original_price`, əsas şəkil, `promotion_link` (affiliate link), `evaluate_rate` (müsbət rəy faizi, ulduz deyil), `lastest_volume` (satış sayı). Ölkəyə görə qiymət və çatdırılma da gəlir (`ship_to_country`, `target_currency`).
- **Çatışmayanlar:** dəqiq ulduz reytinqi və **review_count yoxdur**. Ölçülər əsas axtarışda gəlmir. Onları SKU/detal metodu ilə ayrıca soruşmaq lazımdır. SKU metodunun dəqiq adını rəsmi sənəddə yoxlamaq lazımdır.
- **Giriş:** portals.aliexpress.com-da pulsuz affiliate hesabı açılır, sonra Open Platform-da (openservice.aliexpress.com) "Affiliate" tipli app yaradılır və App Key / App Secret alınır. Tracking ID də lazımdır. Rəsmi müqaviləyə görə developer həm şirkət, həm də fərdi şəxs ola bilər, amma formada şirkət məlumatı soruşula bilər. Təsdiq adətən 1-3 iş günü çəkir (3-cü tərəf mənbələri).
- **Ölkələr:** qlobal, Azərbaycan daxil.
- **Mobil app:** App Secret **yalnız serverdə** saxlanmalıdır. Tətbiq bizim backend-ə, backend isə AliExpress-ə müraciət edir.
- **Diqqət:** AliExpress keyfiyyəti və çatdırılma müddəti dəyişkəndir. "Premium moda" imici üçün tək mənbə kimi zəifdir, amma texniki cəhətdən ən tez qoşula bilən mənbədir.
- Mənbələr: [AliExpress Open Platform (API reference)](https://openservice.aliexpress.com/doc/api.htm) · [Open Platform Agreement](https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress202201220006_10755.html) · [Zuplo: AliExpress API guide](https://zuplo.com/learning-center/aliexpress-api-guide.md) · [RapidDevelopers tutorial (sahə adları)](https://www.rapidevelopers.com/md/bolt-ai-integrations/aliexpress-api)

### 5. ASOS, Zalando, H&M (affiliate network-lər vasitəsilə)

Bu brendlərin heç birinin bütün dünya üçün tək proqramı yoxdur. Proqramlar **regionlara görə ayrıdır** və müxtəlif network-lərdədir:

- **ASOS:** Rakuten Advertising, Awin (məs., İtaliya), FlexOffers (US, UK, AU/NZ, Asia, DE, BE). Komissiya təxminən 0.8-6%.
- **Zalando:** Awin-də açıq olanlar əsasən **Lounge by Zalando** (AT, DK, PL) və **Privé by Zalando** (ES, FR, IT) proqramlarıdır. Əsas zalando.de/nl/be/pl proqramları **closed** görünür.
- **H&M:** regional proqramlar Awin (UK/AB), Rakuten Advertising, CJ, həmçinin Admitad və Sovrn/Skimlinks üzərindən.

**Network-lər məhsul məlumatı verirmi?**
- **Awin:** Bəli. Product feeds (CSV/XML) və **Publisher Product API** var. Retail mağazalar feed-i Google Shopping formatında ("Enhanced Feeds") verir, API onu JSON Lines kimi endirir. Sütunlar: `size`, `in_stock`/`availability`, `average_rating`, `reviews`, şəkillər, `aw_deep_link`. **Amma** rating və reviews yalnız mağaza doldurduqda olur, çoxu doldurmur. Feed-ə adətən mağazaya qoşulduqdan sonra çıxış olur (bəzi mağazalarda "auto-join" var). Qeydiyyat: 1 GBP/EUR/USD geri qaytarılan depozit, işləyən sayt və ya tətbiq, təsdiq təxminən 48 saat.
- **CJ:** Bəli. Product Search API (GraphQL). Personal access token və publisher ID (CID) lazımdır. Hələ heç bir mağazaya qoşulmamısansa, API 403 qaytarır. Bir sorğuda maksimum 1000 nəticə gəlir.
- **Rakuten Advertising:** Bəli. Product Search API var (developers.rakutenadvertising.com, maks. 5000 nəticə). Mağaza təsdiqi lazımdır.
- **Impact:** Bəli. Catalogs və ItemSearch API var (qiymət və stok filtri ilə). API girişi hesabda ayrıca açılmalıdır, kataloqlar gündə bir dəfə sinxronlaşır.
- **Partnerize:** Brendlərin bəziləri burada olur. Feed imkanı brenddən asılıdır, bu araşdırmada təsdiqlənmədi.

**Ümumi tələblər:** işləyən sayt və ya tətbiq (store linki, tətbiqin təsviri), auditoriya təsviri, ödəniş üçün bank hesabı. ABŞ şirkətləri (CJ, Impact, Amazon) üçün adətən **W-8BEN** vergi forması doldurulur. Şirkət qeydiyyatı (VÖEN) hər yerdə şərt deyil, amma böyük brendlər şirkəti olan publisher-ə daha asan "yes" deyir. **Böyük brendlər yeni, trafiki olmayan app-ləri tez-tez rədd edir.** Buna hazır olmaq lazımdır.

- Mənbələr: [Awin product feed (publisher)](https://help.awin.com/developers/docs/product-feed-publisher.md) · [Awin Enhanced Feeds PDF](https://cdn.document360.io/ec9ead62-8ecc-46ef-aac7-9b0a9081b40b/Images/Documentation/Retail_Publisher_EnhancedFeeds.pdf) · [Awin column descriptions](https://help.awin.com/developers/docs/hosting-feeds) · [Awin joining fee](https://www.awin.com/gb/compliance-and-regulations/application-process-and-joining-fee) · [CJ Product Search (apis.io)](https://apis.io/apis/cj-affiliate/cj-affiliate-product-search-legacy-api/) · [Rakuten Advertising tap (product_search)](https://github.com/MeltanoLabs/tap-rakutenadvertising) · [Impact: Search catalog items](https://integrations.impact.com/impact-publisher/reference/search-catalog-items) · [Impact: catalogs for partners](https://help.impact.com/en/support/solutions/articles/48001236914-product-catalogs-partners) · [affi.io: Zalando](https://affi.io/m/zalando) · [FlexOffers: ASOS UK](https://www.flexoffers.com/affiliate-programs/asos-uk-affiliate-program/) · [Affilitizer: H&M](https://www.affilitizer.com/programs/hm.com)

### 6. Hepsiburada

- Açıq affiliate proqramı və ya API **tapılmadı**. "LinkGelir" proqramı adi istifadəçilərin link paylaşması üçündür. FlexOffers-də yalnız iOS app proqramı var, Admitad-dakı proqram isə "closed" görünür.
- developers.hepsiburada.com-dakı API **satıcılar** üçündür.
- **Nəticə:** **Kataloq yoxdur.** v1 üçün tövsiyə edilmir.
- Mənbələr: [FlexOffers: Hepsiburada iOS](https://www.flexoffers.com/affiliate-programs/hepsiburada-tr-ios-incent-affiliate-program) · [affi.io: Hepsiburada](https://affi.io/m/hepsiburada-tr-mobile-cpa) · [Medyascope: LinkGelir](https://medyascope.tv/2024/04/18/hepsiburada-tavsiye-ekonomisini-buyutuyor-tavsiyenin-lideri-link-gelir-ile-hanelere-1-milyar-tl-kazandiracak/)

### 7. Bir neçə mağazanı birdən verən aggregator-lar

- **Skimlinks Product Key:** təxminən 1 milyard təklif, qiymət, stok və şəkillə birlikdə. Amma **yalnız Managed hesablar** üçündür və yalnız US/UK/AU publisher-lərə verilir. Bizim üçün hələlik əlçatmazdır. [Skimlinks: Product Key](https://support.skimlinks.com/hc/en-us/articles/26619916595869-What-is-a-Product-Key-and-do-I-need-one)
- **Sovrn Commerce (Price Comparison):** Sovrn Commerce təsdiqi tələb olunur. 3-cü tərəf mənbəsinə görə məhsulun birbaşa URL-ini qaytarmır. Faydası məhduddur. [Sovrn module docs](https://ce-docs.keywordrush.com/modules/affiliate/viglink)
- **ShopStyle Collective API:** ShopStyle və Collective Voice iyul 2026-da bağlanıb. **İstifadə olunmur.** [Wikipedia: ShopStyle](https://en.wikipedia.org/wiki/ShopStyle)
- **Rakuten product search:** yuxarıda, network bölməsində.
- **Lyst:** açıq məhsul API-si yoxdur. Lyst özü feed qəbul edir, xaricə vermir. [Koongo: Lyst](https://www.koongo.com/channels/lyst/)
- **Klarna Agentic Product Protocol:** təxminən 100 milyon məhsul. Giriş yalnız **təsdiqlənmiş partnyorlara** e-poçt sorğusu ilə verilir. Müraciət etməyə dəyər, amma v1 bundan asılı olmamalıdır. [Klarna docs](https://docs.klarna.com/klarna-search/klarna-agentic-product-protocol/)
- **Google Merchant API / Content API:** Content API 18 avqust 2026-da bağlanıb. Merchant API yalnız **öz** məhsullarını Google-a yükləmək üçündür, başqa mağazaların məhsullarını axtarmağa imkan vermir. [Google: sunset](https://developers.google.com/shopping-content/guides/sunset)
- **SerpApi Google Shopping (ödənişli ehtiyat variant):** Google Shopping nəticələrini qaytarır: qiymət, mağaza adı, şəkil, **rating və reviews**. **Ölçü yoxdur, affiliate link yoxdur.** Qiymət: pulsuz 250 axtarış/ay, $25/1000, $75/5000, $150/15 000. "Legal Shield" yalnız $150 və yuxarı planlarda var. **Diqqət:** SerpApi Google nəticələrini avtomatik oxuyur, Google bunu öz şərtlərində qadağan edir. Ona görə hüquqi cəhətdən boz zonadır. Yalnız müvəqqəti, "reytinqi müqayisə üçün" köməkçi kimi düşünülə bilər, əsas mənbə kimi yox. [SerpApi pricing](https://serpapi.com/pricing) · [SerpApi Google Shopping](https://serpapi.com/google-shopping-api)

---

## Tövsiyə olunan plan

### v1 data spike üçün ilk 2 mağaza

**1. AliExpress (Affiliate API).** Ən tez qoşula bilən real API budur:
- satış tarixçəsi tələb etmir;
- pulsuzdur, təsdiq günlərlə ölçülür;
- açar sözlə və kateqoriya ilə axtarış edir;
- Azərbaycan daxil qlobal çatdırılma və ölkəyə görə qiymət verir;
- affiliate linki birbaşa qaytarır.

Çatışmazlığı: review_count yoxdur, `evaluate_rate` faizdir, ölçülər üçün əlavə sorğu lazımdır.

**2. Awin.** İlk addım olaraq **Lounge by Zalando / Privé by Zalando** və Awin-də açıq olan başqa geyim mağazaları, ASOS/H&M regional proqramları açıq olduqca:
- moda brendləri üçün ən geniş və sənədləşmiş **product feed + API** buradadır;
- `size`, `availability` və şəkillər var, `average_rating`/`reviews` bəzi mağazalarda var;
- qeydiyyat ucuzdur (1 vahid geri qaytarılan depozit).

Bu, "ucuz, geniş seçim" (AliExpress) ilə "tanınmış Avropa moda brendi" (Awin) cütlüyünü verir. Diqqət: Awin-də hər mağaza ayrıca təsdiq verir. Ona görə **eyni anda 5-10 geyim mağazasına müraciət edin** ki, ən azı biri tez təsdiqləsin.

**Niyə Amazon, Trendyol, Temu və Hepsiburada ilk deyil:**
- **Amazon**: API üçün əvvəlcə 30 gündə 10 satış lazımdır, rəy sayı da qaytarılmır.
- **Trendyol** və **Hepsiburada**: affiliate-lər üçün kataloq yoxdur, yalnız deep link var.
- **Temu**: rəsmi API yoxdur, network feed-i hələ təsdiqlənməyib.

**Rating + review_count məsələsi:** Bu iki sahəni bütün mənbələr birlikdə etibarlı vermir. Dizayn bunu nəzərə almalıdır: rəy sayı yoxdursa, onu göstərməmək və ya "satış sayı" (AliExpress) göstərmək olar. Uydurma rəqəm qoyulmamalıdır.

### Təsisçinin müraciət sırası

1. **AliExpress Portals** (portals.aliexpress.com): affiliate hesabı açın, Tracking ID alın. Sonra **AliExpress Open Platform**-da "Affiliate" app yaradın və App Key / App Secret alın. *Lazım olanlar:* AliExpress hesabı, tətbiqin qısa təsviri (boş qoymayın), ödəniş məlumatı. *Müddət:* təxminən 1-3 iş günü.
2. **Awin publisher** (awin.com): qeydiyyatdan keçin, 1 GBP/EUR/USD depozit ödəyin. Tətbiqin store linkini və ya ən azı işləyən landing səhifəni (wearwise sayt) göstərin, auditoriyanı (qlobal, moda, AI stilist) təsvir edin. *Müddət:* təxminən 48 saat. Sonra Awin-də fashion mağazalarına müraciət edin: Lounge by Zalando, Privé by Zalando, ASOS/H&M-in Awin-dəki regional proqramları, Temu. Feed bölməsini yoxlayın.
3. **Vergi və ödəniş hazırlığı** (paralel olaraq): Azərbaycan bankında USD/EUR hesabı və ya Payoneer. ABŞ network-ləri üçün W-8BEN forması. Şirkət (VÖEN) varsa, müraciətlərdə onu istifadə edin. Brendlərin təsdiq şansını artırır.
4. **CJ Affiliate** və **Rakuten Advertising**: ASOS və H&M-in əsas regional proqramları buradadır. Product Search API-ləri mağazaya qoşulduqdan sonra işləyir. *Müddət:* network günlərlə, brendlər həftələrlə.
5. **Impact**: Temu və başqa brendlər üçün. Qoşulduqdan sonra hesabda **API access**-in açılmasını xahiş edin.
6. **Amazon Associates** (məs., amazon.com və amazon.com.tr): indidən qeydiyyatdan keçin və tətbiqdə adi linklərlə satış toplamağa başlayın. Diqqət: 180 gündə 3 satış olmasa, hesab bağlanır. Son 30 gündə 10 satış olandan sonra **Creators API**-yə müraciət edin.
7. **Trendyol**: influencer/affiliate proqramına müraciət edin (deep link üçün). Paralel olaraq Trendyol-un partnership komandasına yazıb kataloq/feed üçün rəsmi əməkdaşlıq soruşun. Azərbaycan bazarı və PASHA JV səbəbilə maraqlı ola bilər.
8. **Klarna Agentic Product Protocol**: e-poçtla giriş istəyin. Uzunmüddətli, bonus variantdır.
9. *(İstəyə görə)* **SerpApi** pulsuz planı: yalnız daxili test və müqayisə üçün. Məhsul kataloqunun əsası olmamalıdır.

---

*Qeyd: Bəzi detallar (AliExpress təsdiq müddəti, Temu feed-i, Trendyol affiliate şərtləri, ASOS/H&M-in hansı network-də olması) 3-cü tərəf mənbələrinə əsaslanır və tez-tez dəyişir. Hər birini müraciət edərkən network panelində yoxlayın.*
