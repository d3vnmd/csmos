# Browser Strike (BS)

Хөтөч дээр ажилладаг, round-д суурилсан тактикийн 5v5 шутер тоглоом. Ямар нэг суулгалт шаардахгүй.
A round-based 5v5 tactical shooter that runs in the browser. Nothing to install.

Бүх газрын зураг, 3D загвар, бэлдэц (texture), дууг кодоор шинээр үүсгэсэн. Өөр тоглоомын asset огт ашиглаагүй.
All maps, models, textures and sounds are generated in code. No assets from other games are used.

## Горимууд / Modes

| Горим | Газрын зураг | Тайлбар |
|------|-----|-------------|
| **Bomb Defusal 5v5** | Sandfort | Raiders бөмбөгийг A эсвэл B site-д тавих, Guardians хамгаалах эсвэл тайлах. Эдийн засаг, худалдан авах цэс, halftime-д тал солих. |
| **Sniper Duel 1v1** | Blockyard | Longbow .338 буугаар 1v1, 8 оноо түрүүлж авсан нь ялна. |

## Тоглоомын механик / Features

- 5v5 тоглолт: та болон 4 бот багийн анд, 5 бот өрсөлдөгчийн эсрэг. Ботын түвшин Easy, Normal, Hard гэсэн гурав.
- Round систем: buy time 25 секунд, round 1:55, бөмбөгийн таймер 40 секунд, тайлах хугацаа 10 секунд (kit-тэй бол 5).
- Эдийн засаг: эхлэх мөнгө $800, ялалт $3250 эсвэл $3500, ялагдлын урамшуулал $1400-оос $3400 хүртэл, зэвсэг тус бүрийн kill reward.
- Зэвсэг:
  - Гар буу: Sparrow K18, Wren P9, Thunder D50
  - SMG ба буудлага: Hornet MX, Breacher 12
  - Винтов: Ranger 556, Vanguard AR, Sentinel R4
  - Снайпер: Longbow .338
  - Хутга: Talon Knife (ар талаас нь хатгавал илүү хохирол учруулна)
  - Гранат: Frag, Smoke
  - Хамгаалалт: Kevlar, Helmet, Defuse Kit
- Recoil, spread (хөдөлж, үсэрч, суугаа үеийн нарийвчлал), толгойд тусахад 4 дахин хохирол, хуяг нэвтрэлт.
- Нас барсан тоглогчийн зэвсэг газар унах ба түүнийг авах, бөмбөгийг унагах ба авах.
- HUD: дугуй радар, оноо ба цаг, kill feed, гэмтлийн чиглэл, scoreboard (Tab), худалдан авах цэс (B).
- Нас барсны дараа багийн андыг ажиглах (spectate).

## Ажиллуулах / Run locally

ES modules ашигладаг тул `file://`-ээр нээгдэхгүй. Энгийн static server хэрэгтэй:

```bash
python3 -m http.server 8000
```

Дараа нь хөтөч дээрээ http://localhost:8000 хаягийг нээнэ.

GitHub Pages дээр ч шууд ажиллана: repo-гийн root фолдерыг publish хийхэд хангалттай.

## Удирдлага / Controls

| Товч | Үйлдэл |
|-----|--------|
| W A S D | Хөдлөх |
| Mouse 1 / Mouse 2 | Буудах / Дуран (scope), хутганы хүчтэй цохилт |
| Shift / Ctrl (C) / Space | Алхах / Суух / Үсрэх |
| R | Сум цэнэглэх |
| 1–5, Q, хулганы дугуй | Зэвсэг солих |
| E | Бөмбөг тавих, тайлах, зэвсэг авах |
| G | Зэвсэг унагах |
| B / Tab / Esc | Худалдан авах цэс / Оноо / Түр зогсоох |

## Бүтэц / Structure

```
index.html        лобби + HUD-ийн бүтэц
css/style.css     UI стиль
lib/              three.js r170 (MIT)
src/main.js       renderer, цэс, үндсэн гогцоо
src/game.js       тоглолт, round, эдийн засаг, бөмбөг, буудлага
src/bot.js        ботын AI (худалдан авалт, зорилго, тулаан)
src/map.js        газрын зургийн grid layout, мөргөлдөөн, nav grid
src/nav.js        A* замчлал
src/physics.js    хөдөлгөөн, raycast
src/models.js     агент, зэвсэг, бөмбөгийн процедураль загвар
src/viewmodel.js  нэгдүгээр биеийн буу, гар
src/effects.js    tracer, оч, утаа, дэлбэрэлт
src/audio.js      WebAudio-оор нийлэгжүүлсэн дуу
src/hud.js        HUD, радар, buy menu, scoreboard
src/lobby.js      үндсэн цэсний 3D дэвсгэр
```

Debug: хөтчийн console дээр `BS.game` болон `BS.simulate(seconds)`-ийг ашиглаж болно.
