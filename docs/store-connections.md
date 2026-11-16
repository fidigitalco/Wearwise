# Mağazaları qoşmaq: nə almalı, hara yazmalı

Hamısı bir yerdə edilir: **Admin panel → Mağazalar → Mağaza əlavə et**. Növü seç, aldığın məlumatı yaz, **Yoxla**, sonra **İndi yenilə** bas. Bundan sonra məhsullar hər gün səhər 04:30-da özü yenilənir və app-da Discover, ağıllı axtarış, "Bunu mənə tap" və tövsiyələrdə görünür.

## 4 növ bağlantı

| Növ | Nə vaxt | Mağazadan nə istəməli | Panelə nə yazmalı |
|---|---|---|---|
| **Məhsul feed faylı (XML / CSV)** | Mağaza və ya şəbəkə məhsul faylı verirsə | "Product feed" linki (Google Shopping XML, CSV və ya TSV) | Feed URL |
| **AliExpress Affiliate API** | AliExpress | portals.aliexpress.com-da affiliate hesabı və open.aliexpress.com-da "Affiliates API" tətbiqi | App Key, App Secret, Tracking ID, açar sözlər |
| **Awin məhsul feed-i** | ASOS, Zalando, H&M və başqa Awin mağazaları | Awin publisher hesabı və mağaza proqramlarına qəbul | API key (Product Feed), feed ID-lər |
| **Yalnız affiliate link** | Trendyol, Hepsiburada və məhsul siyahısı verməyən mağazalar | Affiliate link formatı | Link şablonu, məsələn `https://ty.gl/abc?url={url_encoded}` |

## Trendyol və Hepsiburada ilə danışanda nə istəməli

1. **Ən yaxşısı:** "Bizə **product feed** (XML və ya CSV) verin: bütün geyim məhsulları, qiymət, şəkil, ölçü, stok, gündəlik yenilənən link." Belə link versələr, onu **Məhsul feed faylı** növü ilə əlavə et. Hər şey avtomatik işləyəcək.
2. **Feed vermirlərsə:** affiliate link formatını öyrən (məhsul linkini necə affiliate linkə çevirirlər). Bunu **Yalnız affiliate link** növü ilə əlavə et. Onda **Admin → Məhsullar**-da əl ilə əlavə etdiyin Trendyol məhsulları avtomatik bu linklə açılacaq və komissiya qazanacaqsan.

## Başqa şəbəkələr (CJ, Rakuten, Impact, Admitad…)
Onların hamısı publisher-lərə məhsul feed linki verir. Linki **Məhsul feed faylı** kimi əlavə et.

## Bilməli olduqların
- Gizli açarlar paneldə yalnız son 4 simvolu ilə görünür. Dəyişmək üçün yenisini yaz.
- Feed-dən yox olan məhsul avtomatik gizlədilir.
- Geyim olmayan məhsullar (telefon qabı və s.) və stokda olmayanlar avtomatik keçilir.
- Sıralama heç vaxt komissiyaya baxmır, yalnız üsluba, keyfiyyətə və qiymətə baxır.
