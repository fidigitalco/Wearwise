# WearWise tərəfdaş mağazaları: müraciət cədvəli

Məqsəd: stil məsləhətçisi kombin quranda konkret mağazanın konkret məhsulunu göstərsin, istifadəçi klikləyib alsın, WearWise affiliate komissiyası qazansın.

**Hər mağazadan istəyəcəyimiz eynidir** (məktub şablonu əvvəlki cavabdadır):
1. **Product feed və ya Product API:** məhsul ID, ad, link, şəkil, qiymət və endirimli qiymət, valyuta, brend, rəng, stokdakı ölçülər, kateqoriya, cins; varsa reytinq və rəy sayı. Gündəlik yenilənən link olsun.
2. **Affiliate tracking və deep link formatı:** istənilən məhsul linkini affiliate linkə çevirmək üçün.
3. **Komissiya şərtləri və cookie müddəti.**
4. **Azərbaycana çatdırılma** məlumatı.

Gələn hər şey **Admin → Mağazalar** bölməsinə yazılır (bax: [store-connections.md](store-connections.md)).

## İlk 15 mağaza

Vəziyyət sütununu müraciət etdikcə doldur: *göndərilməyib → göndərilib → cavab gəlib → təsdiqləndi → paneldə qoşuldu*.

| # | Mağaza | Ehtimal olunan yol | Paneldə növ | Vəziyyət | Qeyd |
|---|---|---|---|---|---|
| 1 | **ASOS** | Awin və ya Partnerize (ölkəyə görə) | Awin / Feed | göndərilməyib | Feed-də ölçülər adətən var |
| 2 | **H&M** | Awin (bəzi ölkələr) | Awin / Feed | göndərilməyib | Regional proqramları yoxla |
| 3 | **Mango** | Awin və ya digər şəbəkə | Awin / Feed | göndərilməyib | |
| 4 | **Zara** | Birbaşa Inditex | Feed / Link | göndərilməyib | ⚠️ Mənim bildiyimə görə Inditex-in açıq affiliate proqramı yoxdur. Awin siyahısında olub-olmadığını hesab açanda yoxla. Bershka, Pull&Bear, Stradivarius və Massimo Dutti üçün də eyni şey keçərlidir |
| 5 | **Trendyol** | Birbaşa (partner/influencer proqramı) | Feed, olmasa Link | göndərilməyib | Əvvəlcə feed istə |
| 6 | **LC Waikiki** | Birbaşa və ya Admitad / türk şəbəkələri | Feed / Link | göndərilməyib | Azərbaycanda da mağazaları var |
| 7 | **Koton** | Birbaşa və ya türk şəbəkələri | Feed / Link | göndərilməyib | |
| 8 | **Nike** | Ölkəyə görə Awin, Impact və ya CJ | Awin / Feed | göndərilməyib | |
| 9 | **Adidas** | Awin, CJ və ya Rakuten | Awin / Feed | göndərilməyib | |
| 10 | **New Balance** | Awin, CJ və ya Impact | Awin / Feed | göndərilməyib | |
| 11 | **Puma** | Awin, CJ və ya Impact | Awin / Feed | göndərilməyib | |
| 12 | **Guess** | Awin, CJ və ya Rakuten | Awin / Feed | göndərilməyib | Çanta, saat, eynək də var |
| 13 | **Calvin Klein** | Awin, CJ və ya Rakuten | Awin / Feed | göndərilməyib | |
| 14 | **Farfetch** | Farfetch-in öz affiliate səhifəsi | Feed | göndərilməyib | Feed və 30 günlük cookie verdiklərini yazırlar |
| 15 | **SSENSE** | SSENSE-in öz affiliate proqramı | Feed | göndərilməyib | |

"Ehtimal olunan yol" sütunu yoxlanmalıdır: brendlər şəbəkəni ölkəyə görə dəyişir. Ən dəqiq yol Awin, CJ, Impact və Rakuten-də hesab açıb içəridə brendi axtarmaqdır.

## Sonrakı dalğa

- **Türkiyə:** DeFacto, Boyner, Mavi, FLO, Modanisa, Vakko, Derimod, Hepsiburada.
- **İdman və ayaqqabı:** Converse, Vans, Reebok, Skechers, Foot Locker, ASICS, Dr. Martens.
- **Aksesuar:** Michael Kors, Coach, Tommy Hilfiger, Fossil, Ray-Ban, Oakley, Swarovski, Pandora, Tissot.
- **Lüks:** NET-A-PORTER, MR PORTER, Mytheresa, LuisaViaRoma, END., REVOLVE.
- **Kütləvi:** Reserved, C&A, Uniqlo, COS.
- ⚠️ **Matches (matchesfashion.com):** 2024-cü ildə bağlandığını bilirəm. Siyahıdan çıxar və ya yoxla.

## Şəbəkələr: bir hesabla çoxlu brend

Ən sürətli yol əvvəlcə bu şəbəkələrdə publisher hesabı açmaq, sonra içəridən brendlərə müraciət etməkdir. Brendlərin çoxu birbaşa yox, şəbəkə vasitəsilə cavab verir.

| Şəbəkə | Nə üçün | Paneldə növ |
|---|---|---|
| **Awin** | Avropa high-street və idman brendləri | Awin (hazırdır) |
| **CJ Affiliate** | ABŞ və qlobal brendlər | Feed (CJ feed linki) |
| **Impact** | Nike, Puma, Temu və başqaları (ölkəyə görə) | Feed |
| **Rakuten Advertising** | Lüks və premium | Feed |
| **Admitad** | Türkiyə, MDB, regional mağazalar | Feed |

Hamısı feed linki verir və hamısı paneldə hazır olan **"Məhsul feed faylı"** növü ilə işləyir. Əlavə kod lazım deyil.

## App tərəfində hazır olanlar
- Siyahıdakı bütün mağazalar app-ın mağaza siyahısındadır. İstifadəçi onları "Mənim üslubum"-da seçə bilir, mağaza linkdən avtomatik tanınır.
- Saat, eynək, zinət əşyası, çanta, klassik ayaqqabı və balerina da tanınır, ona görə Swarovski, Pandora, Ray-Ban və Fossil feed-ləri tam idxal olunur.
- Sıralama komissiyaya baxmır, yalnız üsluba, keyfiyyətə və qiymətə baxır. Bunu məktubda da yazırıq.
