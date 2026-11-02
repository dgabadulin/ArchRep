Логотип, иконки и favicon
=======================
Ассеты бренда ИСАР — в этой папке (frontend-v3/public/). Источник — поставка дизайнера
(temp/logo/исар + temp/logo/исар/1 размер + temp/logo/исар/фавикон), в git не коммитится.

| Файл                    | Назначение                                                       | Размер                  |
|-------------------------|------------------------------------------------------------------|-------------------------|
| logo.svg                | горизонтальный логотип (знак + «ИСАР») — сайдбар и экран входа    | viewBox 351,38 × 83,97  |
| logo.png                | растровая копия для README и писем                                | 368 × 96, прозрачный    |
| logo-white.svg / .png   | белая версия для тёмного фона                                     | как logo                |
| logo-icon.svg           | знак без надписи, квадрат 1:1 с полем ~6 %                        | viewBox 34,88 × 34,88   |
| logo-icon.png           | знак для приложений/витрины                                       | 512 × 512               |
| favicon.svg             | favicon (основной, подключается первым)                           | viewBox 31,14 × 31,14   |
| favicon-16/32/48.png    | растровые favicon                                                 | 16 / 32 / 48            |
| favicon-192/512.png     | PWA / Android                                                     | 192 / 512               |
| favicon.png             | алиас favicon-192.png (используется в index.html)                 | 192 × 192               |
| favicon.ico             | мультиразмерный ICO                                               | 16/24/32/48/64/128/256  |
| apple-touch-icon.png    | иконка iOS (белый непрозрачный фон, поле 10 %)                    | 180 × 180               |
| logo-email.png          | логотип для HTML-писем (только PNG, SVG в письмах не работает)    | 480 × 115, ≤ 40 КБ      |
| og-isar-1200x630.png    | превью ссылок (Open Graph, соцсети, мессенджеры)                  | 1200 × 630              |

Фирменный цвет: #00ABA7 (из поставки дизайнера; в мастер-файле встречается #00ACA8 —
нормализовано к одному значению).

Как пересобрать
---------------
Скрипт: scripts/make-brand-assets.ps1 (Windows, System.Drawing).

    powershell -ExecutionPolicy Bypass -File scripts/make-brand-assets.ps1 `
        -SourceDir temp\logo\исар -MasterLogo temp\logo\исар\лого.png

Что делает:
1. Копирует logo.png / logo-white.png из «1 размер», нормализует SVG: инлайнит классы
   в fill/stroke, приводит цвет к #00ABA7, убирает <style>/<defs>/id.
2. Из «фавикон\32 на 32.svg» делает квадратный favicon.svg и logo-icon.svg (поле 6 %).
3. Рендерит из favicon.svg: favicon-16/32/48/192/512, favicon.png, logo-icon.png,
   apple-touch-icon.png, favicon.ico (7 кадров) — геометрия читается прямо из SVG
   (<line>/<circle>), поэтому новый знак подхватывается без правки скрипта.
4. Из мастер-PNG делает logo-email.png (480 px) и og-isar-1200x630.png.

Без -SourceDir пересобираются только иконки из уже лежащего favicon.svg.

После замены ассетов пересоберите фронт: `cd frontend-v3 && npm run build`
(сборка пишется в ../frontend-v3-dist/, который в .gitignore).


