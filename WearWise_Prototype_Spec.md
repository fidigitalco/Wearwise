# WearWise — HTML prototip (son versiya) sənədi

**Fayl:** `wearwise-prototype.html` (tək fayl, CSS və JS içindədir)
**Canlı link:** https://claude.ai/artifact/9w4ie3QZuaY7HbppHndpSN
**Məqsəd:** investor və komanda demosu, həmçinin developerə məhsul məntiqini göstərmək.
**Status:** klikabel prototipdir. Backend, real AI modeli və real affiliate tracking yoxdur. Bütün məntiq brauzerdə işləyir.

---

## 1. Ümumi baxış

Mobil app görünüşü 430px enindədir. Desktopda telefon çərçivəsində, mobildə tam ekranda açılır. Light və dark rejim avtomatik dəyişir.

| Tab | Funksiya |
|---|---|
| **Today** | Hava, temperatur və gün planı əsasında 3 kombin təklifi, avatarda göstərilmə, sıralama |
| **Wardrobe** | Gardırob: paltar siyahısı, şəkil və ya video ilə yeni paltar əlavə etmək |
| **Me** | Avatar parametrləri: üz şəkli, dəri tonu, boy, çəki, stil zövqü |
| **Shop** | Gardırobdakı boşluqlar, "gardırobuma uyğundurmu?" yoxlaması, Trendyol affiliate yönləndirməsi |

**Dizayn:** navy (#1E2440) əsas, plum (#6E3A5E) aksent, açıq boz fon. Şriftlər Bricolage Grotesque (başlıqlar) və Figtree (mətn).

---

## 2. Ekranlar ətraflı

### 2.1 Today

**Kontekst paneli:**
- Temperatur slider-i: −10°C ilə +35°C arası.
- Hava seçimi: Sunny, Cloudy, Rain, Snow, Windy.
- **Gün planı** (sərbəst mətn), məsələn "Client meeting downtown, dinner after". Sistem açar sözlərdən formallıq səviyyəsini oxuyur: "WearWise read your plan as formal".
- Formallığı əl ilə dəyişmək mümkündür: Casual, Smart, Formal.

**Fitting room (əsas element):**
- Solda 2D avatar seçilmiş kombini geyinir.
- Sağda kombinin izahı göstərilir, məsələn:
  - "Camel + Light blue: a neutral grounds the colour"
  - "Camel coat adds the right warmth for 8°C"
  - "Right dress level: formal"

**3 kombin kartı:**
- Hər kartda geyimlərin kiçik şəkilləri, uyğunluq faizi (52–98%) və parça sayı var.
- Karta basanda kombin avatara geyindirilir.
- Hər kartda 1/2/3 sıralama düymələri var. Üçü də sıralanandan sonra "Save ranking" aktiv olur və sistem öyrənir.

### 2.2 Wardrobe

- Paltarlar kateqoriya sırası ilə düzülür: üst qat, üst, don, alt, ayaqqabı.
- Hər kartda geyimin real görünüşlü SVG çəkilişi (və ya yüklənmiş foto), adı, növü və materialı var.
- "×" düyməsi ilə paltar silinir.
- Başlıqda neçə paltar və neçə mümkün kombin olduğu yazılır.

**"Add piece" axını:**
1. Foto və ya **video** yüklənir.
2. Video olsa, 20%, 50% və 80% nöqtələrindən 3 kadr çıxarılır və istifadəçi ən aydınını seçir.
3. **Rəng avtomatik tapılır:** şəklin mərkəzi analiz edilir, ağ fon atılır, dominant rəng götürülür. Ekranda "AI: beige · tap to fix" yazılır.
4. Növ seçilir (20 növ). Növü seçəndə izah çıxır, məsələn: "Cardigan opens at the front with buttons or a zip… Sweater pulls over your head".
5. Material seçilir: Cotton, Wool, Knit, Denim, Linen, Leather, Synthetic.
6. Ad yazmaq könüllüdür. Yazılmasa, avtomatik ad verilir, məsələn "Navy cardigan".

### 2.3 Me

- **Üz şəkli** yüklənəndə dairəyə kəsilib avatarın başına qoyulur. Standart halda şəkil yoxdur.
- **Dəri tonu** şəkil olmayanda avatar üçün istifadə olunur.
- **Boy və çəki** silueti dəyişir: BMI-yə görə en 0.84–1.28x, boya görə hündürlük 0.9–1.1x.
- **Stil seçimi:** Minimal, Classic, Street, Old money, Sporty, Romantic. "Minimal" seçilsə, tam neytral kombinlərə bonus verilir.

### 2.4 Shop

**"What your wardrobe is missing"** bölməsində ən çox 3 boşluq göstərilir:

| Yoxdursa | Təklif |
|---|---|
| Su keçirməyən üst qat | Raincoat |
| Boots | Boots |
| Blazer | Blazer |
| Trousers | Trousers |
| Shirt | Shirt |
| Coat | Coat |

Hər təklifdə **ən uyğun rəng** seçilir: 20 rəngdən hansı ən çox yeni kombin açırsa, o götürülür. Kartda bu rəqəm də yazılır, məsələn "Unlocks 29 new outfits".

**"Will this fit my wardrobe?" yoxlaması:**
- İstifadəçi növü və rəngi seçir.
- Cavab üç qərardan biridir: **Great buy** (8+ kombin), **Works** (3–7) və ya **Skip it** (<3).
- Cavabda neçə paltarla uyğun gəldiyi, neçə yeni kombin açdığı və daha yaxşı rəng alternativi yazılır.

**Affiliate yönləndirmə:**
- "Find on Trendyol" düyməsi əvvəlcə ara ekran açır: istifadəçinin kliki → tracking link → Trendyol.
- Sorğu türkcə qurulur, məsələn `lacivert yağmurluk`.
- Ara ekranda AliExpress və Amazon variantları da var.
- "Affiliate link" etiketi göstərilir. Bu, App Store və FTC tələbidir.

---

## 3. Kombin mühərriki (məntiq)

### 3.1 Geyim kataloqu

| Növ | Kateqoriya | İstilik (w) | Formallıq (f) | Xüsusi | Trendyol sorğusu |
|---|---|---|---|---|---|
| T-shirt | top | 1 | 1 | qısa qol | tişört |
| Shirt | top | 1 | 3 | | gömlek |
| Blouse | top | 1 | 2 | | bluz |
| Sweater | top | 2 | 2 | | kazak |
| Hoodie | top | 2 | 1 | | kapüşonlu sweatshirt |
| Cardigan | outer | 1 | 2 | | hırka |
| Blazer | outer | 1 | 3 | | blazer ceket |
| Jacket | outer | 2 | 2 | | ceket |
| Raincoat | outer | 2 | 1 | yağışa davamlı | yağmurluk |
| Coat | outer | 3 | 3 | | kaban |
| Puffer | outer | 3 | 1 | yağışa davamlı | şişme mont |
| Jeans | bottom | 1 | 1 | | jean |
| Trousers | bottom | 1 | 3 | | kumaş pantolon |
| Shorts | bottom | 0 | 1 | | şort |
| Skirt | bottom | 0 | 2 | | etek |
| Dress | onepiece | 1 | 2 | | elbise |
| Sneakers | shoes | 1 | 1 | | sneaker |
| Boots | shoes | 2 | 2 | yağışa davamlı | bot |
| Loafers | shoes | 1 | 3 | | loafer ayakkabı |
| Heels | shoes | 0 | 3 | | topuklu ayakkabı |

Material təsiri: Wool və Knit üçün w +0.5, Linen üçün w −0.3.

### 3.2 Kombinlərin qurulması

Kombin iki formada olur: `top + bottom + [outer] + shoes` və ya `dress + [outer] + shoes`. Bütün mümkün variantlar yaradılır, hər biri bal alır və ən yaxşı 3 seçilir. Seçilən 3 kombin bir-birindən ən azı 2 parça ilə fərqlənməlidir.

### 3.3 Bal formulu

```
score = istilik + hava + formallıq + rəng×1.6 + stil + öyrənilmiş zövq
```

**İstilik.** Lazım olan bal temperatura görə müəyyən olunur:

| Temperatur | Lazım olan bal |
|---|---|
| ≥25°C | 2 |
| 19–24°C | 3 |
| 13–18°C | 4 |
| 6–12°C | 5 |
| <6°C | 6 |

Qarda +1, küləkdə +0.5 əlavə olunur. Kombinin istiliyi top + bottom + outer×1.1 kimi hesablanır. Çatışmayan hər bal −1.7, artıq hər bal −0.7 verir. Temperatur 20°C-dən aşağı olanda şort −3 alır.

**Hava.** Yağış və ya qarda:
- Su keçirməyən üst qat +1.6 alır. Üst qat heç yoxdursa −2.
- Bot +1.2, heels və ya loafers −0.8.
- Qarda sneakers −1.
- Küləkdə istənilən üst qat +0.6.

**Formallıq.** Parçaların orta formallığı hesablanır (ayaqqabı yarım çəki ilə). Hədəf səviyyədən hər fərq −1.5 verir.

**Rəng.** Cüt-cüt yoxlanılır:

| Hal | Bal |
|---|---|
| Neytral + rəngli | +1.2 |
| İki neytral | +0.7 / +1.1 (açıq-tünd kontrast varsa) |
| Analoq (<30°) | +1.3 |
| Komplementar (≥150°) | +1.0 |
| Triada (105–135°) | +0.4 |
| Toqquşma | −1.4 |

Neytral sayılan rənglər: aşağı doyğunluq, çox tünd və ya çox açıq tonlar, bej/camel/qəhvəyi diapazonu, lacivert diapazonu.

**Öyrənmə.** "Save ranking" basılanda kombinin parçaları bal qazanır: 1-ci yer +1, 2-ci +0.3, 3-cü −0.6. Bu ballar sonrakı təkliflərdə ×0.25 bonus kimi əlavə olunur və `localStorage`-da saxlanılır.

**Uyğunluq faizi** baldan hesablanır: `78 + score×3`, 52–98% aralığında saxlanılır.

### 3.4 "Unlocks N outfits" hesabı

Yeni paltar gardıroba hipotetik olaraq əlavə edilir və onu ehtiva edən kombinlər sayılır. Kombin yalnız iki şərt ödənəndə "yaxşı" sayılır: parçaların formallıq fərqi ≤1 və heç bir rəng cütü toqquşmur.

### 3.5 Gün planından formallıq (açar sözlər)

| Səviyyə | Açar sözlər |
|---|---|
| 3 – Formal | wedding, gala, interview, ceremony, toy, müsahibə, meeting, client, office, work, presentation, görüş, iş, ofis |
| 2 – Smart | dinner, date, theatre, party, restaurant, şam, restoran |
| 1 – Casual | gym, run, hike, park, beach, walk, idman, gəzinti |

Heç bir açar söz tapılmasa, səviyyə Smart (2) qəbul olunur.

---

## 4. Vizual hissə

**Geyim çəkilişləri.** `garment()` funksiyası hər növ üçün detallı SVG yaradır:
- Detallar: kardiganda ribli bantlar və düymələr, köynəkdə yaxalıq, cib və manjet, jeansda qızılı tikiş və kəmər ilgəkləri, blazerdə lapellər, puffer-də kapitone seqmentlər.
- Materialın fakturası: knit və wool üçün şaquli toxuma, denim üçün diaqonal, linen üçün tor.
- İşıq-kölgə qradiyenti və yumşaq kölgə.
- Fotosu yüklənmiş paltarda SVG yerinə real foto göstərilir.

**Avatar.** `avatar()` funksiyası 2D figur çəkir:
- Alt geyimin forması dəyişir: şalvar, şort və ya ətək. Don ayrıca çəkilir.
- Üst geyim qısa və ya uzun qollu olur. Köynəkdə yaxalıq, sviterdə rib xətti var.
- Üst qatın uzunluğu növə görə dəyişir. Önü açıq çəkilir; palto, kardigan və blazerdə düymələr, puffer-də kapitone görünür.
- Ayaqqabı növünə görə forma dəyişir (bot daha hündürdür).
- Baş: üz şəkli varsa dairəvi kəsilmiş foto, yoxdursa dəri tonu və saç forması.

---

## 5. Affiliate link formatı (demo)

```
https://www.trendyol.com/sr?q={türkcə rəng + növ}
  &utm_source=wearwise
  &utm_medium=affiliate
  &sub_id=ww_demo_{növ}_{rəng}
```

Nümunə: `https://www.trendyol.com/sr?q=lacivert%20yağmurluk&utm_source=wearwise&utm_medium=affiliate&sub_id=ww_demo_raincoat_navy`

Əlavə variantlar:
- AliExpress: `https://www.aliexpress.com/w/wholesale-{sorğu}.html`
- Amazon: `https://www.amazon.com/s?k={sorğu}`

> Bu linklər **real komissiya qazandırmır**. Real tracking üçün Trendyol ilə B2B razılaşma və ya affiliate network lazımdır (Skimlinks, Admitad və s.). Ətraflı məlumat `WearWise_AI_resources_and_affiliates.xlsx` faylının "Affiliate Proqramları" vərəqindədir.

---

## 6. Data modeli (prototipdə)

```js
item = {
  id: 12,
  name: "Burgundy knit",
  type: "Sweater",          // TYPES kataloqundan
  color: "#6E2433",
  mat: "Knit",
  img: "data:image/jpeg…"   // könüllü, yüklənmiş foto
}

profile = {
  face: null,               // üz şəkli (data URL) və ya null
  skin: "#D9A88A",
  h: 172, w: 68,
  styles: ["Minimal", "Classic"]
}

prefs = { [itemId]: bal }   // sıralamadan öyrənilən zövq
```

Başlanğıc gardırobda 12 paltar var: white tee, light blue shirt, navy sweater, beige cardigan, camel coat, dark jeans, black trousers, grey pleated skirt, black dress, white sneakers, black loafers, burgundy knit.

---

## 7. Prototip vs real məhsul

| Funksiya | Prototipdə | Real app-də |
|---|---|---|
| Geyim tanıma | İstifadəçi növü seçir, rəng piksel analizi ilə tapılır | FashionCLIP / Gemini ilə avtomatik tag, istifadəçi təsdiqləyir |
| Video emalı | 3 kadr çıxarılır | SAM 2 seqmentasiya + rembg fon silmə |
| Hava | Əl ilə seçilir | Open-Meteo API + istifadəçinin lokasiyası |
| Gün planı | Açar sözlər | Təqvim inteqrasiyası + LLM ilə anlama |
| Kombin məntiqi | Qaydalar | Qaydalar + ranking modeli (öz data ilə) |
| Avatar | 2D SVG + üz şəkli | 3D avatar (selfie video) + try-on API (FASHN) |
| Öyrənmə | localStorage-da sadə ballar | Server-side ranking model, istifadəçi profili |
| Affiliate | Demo URL | Skimlinks / Admitad / Trendyol B2B + real tracking |
| Data saxlama | Brauzer yaddaşı | Backend + bulud saxlama, privacy razılığı |

---

## 8. Developer üçün növbəti addımlar

1. Qaydalar mühərrikini (bölmə 3) backend servisə köçürün. Məntiq hazırdır və test olunub.
2. Tagging pipeline qurun: foto/video → SAM 2 → rembg → FashionCLIP → istifadəçi təsdiqi.
3. Open-Meteo-nu qoşun və gün planını təqvimlə əvəz edin.
4. Ranking feedback-i server cədvəlinə yazın (bax: `WearWise_AI_Train_Resurslari.md`, bölmə 8).
5. Skimlinks Link API ilə real affiliate linkləri qoşun və Trendyol üçün BD danışığına başlayın.
6. FASHN try-on API-ni test edin.

---

*Əlaqəli fayllar: `WearWise_AI_Train_Resurslari.md` (train resursları və plan), `WearWise_AI_resources_and_affiliates.xlsx` (resurslar, affiliate proqramları, inteqrasiya axını, gəlir modeli).*
