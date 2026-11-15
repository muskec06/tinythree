# tinythree (Türkçe)

**Three.js'e derlenen küçük bir 3D sahne dili. Yapay zekâ modellerinin 3D sahneleri yaklaşık 3 kat daha az token ile yazması için tasarlandı.**

[**▶ Playground'u dene**](https://muskec06.github.io/tinythree/) · [Dil referansı](spec/LANGUAGE.md) · [AI istemi](ai/SYSTEM_PROMPT.md) · [Benchmark](bench/RESULTS.md) · [English](README.md)

![tinythree sahneleri](docs/hero.png)

## Neden?

Bir LLM Three.js yazarken çıktısının büyük kısmı tekrar eden kalıplara gider: `new THREE.Mesh(new THREE.BoxGeometry(...))`, `.position.set(...)`, render döngüsü, pencere boyutu ayarı. Çıktı tokenları hem yavaş hem pahalıdır. tinythree modele kısa bir yazım biçimi verir ve bu kalıp kodu derleyiciye bırakır. Fikir, aynı işi Blender için yapan [sand3d](https://github.com/sandflow-ai/sand3d)'den geliyor. tinythree ise web'i hedefliyor.

```
group table
  box top 2,.1,1 @0,1,0 wood
  box leg .1,1,.1 @.9,.5,.4 wood mirror=xz    // tek satır → dört ayak
anim ring rot.y spin 4s
```

## Kazanç

Beş örnek sahne, elle yazılmış kısa ve deyimsel Three.js ile karşılaştırıldı:

- **Toplamda 3,4 kat daha az token** (sahneye göre 2,7× ile 3,8× arası).
- **Daha hızlı yanıt:** Üretim süresi çıktı tokenıyla neredeyse doğru orantılı olduğu için sahne yaklaşık üçte bir sürede yazılır.
- **Tek seferlik maliyet:** Dili öğreten istem yaklaşık 1.100 token tutar ve ortalama 2 sahneden sonra kendini amorti eder.
- **Küçük düzenlemeler:** Bir nesneyi değiştirmek için JavaScript bloğu yerine tek bir kısa satır yeniden yazılır.

Ayrıntılar [bench/RESULTS.md](bench/RESULTS.md) dosyasında, ölçümü yeniden almak için: `npm run bench`.

## Kullanım

```bash
node bin/tinythree.js build scene.t3 -o scene.html      # tek başına çalışan web sayfası
node bin/tinythree.js compile scene.t3 -o scene.js      # ES modülü
python tools/render.py examples/building.t3 -o building.mp4   # kare kare video (MP4/MOV/WebM, şeffaf arka plan destekli)
```

Yapay zekâ ile kullanmak için:
1. [`ai/SYSTEM_PROMPT.md`](ai/SYSTEM_PROMPT.md) içeriğini sisteme ver.
2. Sahneyi tarif et.
3. Çıkan kodu playground'a yapıştır.
4. Hata alırsan hata satırını modele geri gönder.

## Eğitim videoları

Sahneler zamana bağlı saf bir `update(t)` fonksiyonu ürettiği için her kare tam zamanında render edilir. `bg=none` ile şeffaf arka planlı ProRes 4444 veya WebM çıkarıp kurgu programında başka görüntülerin üzerine bindirebilirsin.

Lisans: MIT
