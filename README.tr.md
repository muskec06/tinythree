<div align="center">

# tinythree

**Three.js'e derlenen küçük bir 3D sahne dili.**<br>
Yapay zekâ modelleri 3D sahneleri **3–7 kat daha az token** ile, daha hızlı ve daha ucuza yazsın diye tasarlandı.

[**Playground**](https://muskec06.github.io/tinythree/) · [Galeri](README.md#gallery) · [Dil referansı](spec/LANGUAGE.md) · [AI istemi](ai/SYSTEM_PROMPT.md) · [English](README.md)

<img src="docs/hero.gif" width="400" alt="57 satırlık tinythree koduyla 1.400 kafes kirişli Eyfel Kulesi">

</div>

## Neden?

Bir dil modeli Three.js yazarken çıktısının büyük kısmı tekrar eden kalıplara gider: `new THREE.Mesh(new THREE.BoxGeometry(…))`, `.position.set(…)`, render döngüsü, pencere boyutu ayarı. Çıktı tokenları ise yanıtın en yavaş ve en pahalı kısmıdır.

tinythree modele yalnızca sahneyi anlatan kısa bir yazım biçimi verir: ne nerede, neyden yapılmış, nasıl hareket ediyor. Bağımlılığı olmayan derleyici bunu düz Three.js'e çevirir. Web'i ve kare kare videoyu hedefliyor.

## Ölçüm

<img src="docs/benchmark.png" width="760" alt="10 sahnede token karşılaştırması">

11 sahne hem tinythree ile hem de elle, kısa ve deyimsel Three.js ile yazıldı. Sahnelerin beşi ünlü yapılar: 1.400 kafes kirişli detaylı Eyfel Kulesi, Pisa Kulesi, Giza Piramitleri, Stonehenge ve London Eye. İki sürüm de render edilerek aynı sahneyi çizdikleri doğrulandı.

- **Token:** Toplam 14.151'den 4.057'ye, yani **3,5 kat daha az** (sahneye göre 2,7× ile 6,9× arası; hazır parça, doku, model ve yazı kullanan sahnelerde kazanç en yüksek).
- **Hız:** Üretim süresi çıktı tokenıyla neredeyse doğru orantılı. Bir sahne yaklaşık üçte bir sürede yazılır.
- **Tek seferlik maliyet:** Dili öğreten istem yaklaşık 1.500 token tutar ve 2 sahneden sonra kendini çıkarır.

Ölçümü yeniden almak için `npm run bench` yeterli. Ayrıntılar [bench/RESULTS.md](bench/RESULTS.md) dosyasında.

## Three.js'in tamamını kapsıyor mu?

Evet. Tarayıcıda çalışan bir test paketiyle kontrol edildi: [**39 yetenek testinin 39'u geçiyor**](docs/CAPABILITIES.md).

- **tinythree sözdizimi (18 test):** Şekiller, kafes kuleler, malzemeler, görsel ve hazır dokular, yazı etiketleri, animasyonlu glTF modeller, hazır parça kütüphanesi, ışıklar, gölgeler, kopyalar, animasyon, perspektif ve ortografik kamera, video.
- **`js` / `tick` blokları (16 test):** Ek geometriler, cam ve shader malzemeleri, parçacıklar, iskelet animasyonu, fare ile seçim, ses.
- **`renderer` bloğu (5 test):** Ton eşleme, ortam haritaları, post-processing (bloom vb.), HTML etiketleri, WebXR.

Token tasarrufu ilk gruptan geliyor. Diğer ikisi sahne dosyasının içinde yazılan düz Three.js'tir: Three.js kadar token tutar, ama tinythree'den çıkmadan yapılabilir.

## Hızlı başlangıç

- **Tarayıcıda:** [Playground](https://muskec06.github.io/tinythree/)'u aç, bir örnek seç ve düzenle. Sahne yazdıkça güncellenir.
- **Yapay zekâ ile:**
  1. [`ai/SYSTEM_PROMPT.md`](ai/SYSTEM_PROMPT.md) içeriğini modele ver.
  2. Sahneyi tarif et (örneğin "gün batımında Kolezyum, kamera yavaşça dönsün").
  3. Çıkan kodu playground'a yapıştır.
  4. Hata alırsan hata satırını modele geri gönder.
- **Tek prompt ile, kod çalıştırabilen bir ajana (Claude Code, Codex, Cursor vb.):**

  > https://github.com/muskec06/tinythree reposunu kullanarak 3D bir Eyfel Kulesi oluştur, 10 saniyelik MP4 video olarak render et ve tinythree'nin düz Three.js'e göre ne kadar token kazandırdığını göster.

  Gerisini repodaki [`AGENTS.md`](AGENTS.md) anlatır: dili öğrenir, sahneyi yazıp denetler, videoyu üretir, aynı sahneyi düz Three.js ile de yazıp `tinythree tokens` ile karşılaştırır.
- **Komut satırından:**

```bash
git clone https://github.com/muskec06/tinythree && cd tinythree && npm install
node bin/tinythree.js build examples/eiffel-tower.t3 -o eiffel.html
node bin/tinythree.js tokens examples/eiffel-tower.t3 bench/threejs/eiffel-tower.js   # token kazancı
python tools/render.py examples/building.t3 -o building.mp4      # kare kare video
```

## Eğitim videoları

Sahneler zamana bağlı saf bir `update(t)` fonksiyonu ürettiği için her kare tam zamanında render edilir. Sonuç bilgisayarın hızına bağlı değildir. `bg=none` ile şeffaf arka planlı ProRes 4444 (MOV) veya WebM çıkarıp kurgu programında başka görüntülerin üzerine bindirebilirsin.

Lisans: [MIT](LICENSE)
