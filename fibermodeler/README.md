<div align="center">

<img src="docs/logo.svg" width="72" alt="FiberModeler">

# FiberModeler

**Редактор бизнес-процессов в нотациях BPMN 2.0 и IDEF0.**
Работает офлайн, в браузере, на macOS / Windows / Linux. Без установки, без аккаунта, без облака.

</div>

---

## Что это

Один редактор вместо двух: полноценное BPMN 2.0-моделирование (как в Bizagi Modeler) и полноценный
IDEF0 с декомпозицией и ICOM-стрелками (как в IDEF0-редакторах) — с современным интерфейсом,
векторным экспортом и проверкой моделей по правилам нотации.

* **Ручное моделирование** — основной режим: палитра, drag & drop, быстрые кнопки связей, инлайн-редактирование.
* **Табличный конструктор** — заполняете ячейки, диаграмма строится по правилам нотации.
* **Авто-построение** — текстовое описание процесса превращается в модель. Встроенный движок работает
  офлайн (разбор текста + библиотека шаблонов); при желании можно подключить Claude, OpenAI, Ollama или свой endpoint.
* **Экспорт** — PNG, JPEG, SVG, **векторный PDF** (с кириллицей), BPMN 2.0 XML, JSON, весь проект в PDF.
* **Импорт** — BPMN 2.0 XML (из Camunda, Bizagi, bpmn.io), JSON, собственный формат проекта.

## Запуск

### macOS (рекомендуется)

```bash
git clone <repo> && cd FiberModeler
./FiberModeler.command        # или двойной клик по файлу в Finder
```

Откроется браузер на `http://127.0.0.1:8765`. Нужен только Python 3 (в macOS он есть из коробки).

### Любая система

```bash
python3 serve.py              # http://127.0.0.1:8765
python3 serve.py --port 9000 --no-open
```

### Один файл, без сервера

`dist/FiberModeler.html` — всё приложение в одном файле: скачайте и откройте двойным кликом.
Пересобрать: `python3 tools/build_single_file.py`.

## Первые пять минут

1. **Демо-проект** на стартовом экране — готовый BPMN-процесс и модель IDEF0 с декомпозицией.
2. Элемент из палитры слева → клик по холсту (или перетаскиванием).
3. Выделите элемент — вокруг появятся синие стрелки: клик создаёт следующий шаг, перетаскивание — связь.
4. Двойной клик по элементу — редактирование текста прямо на холсте.
5. `L` — авторасположение, `⌘⇧V` — проверка модели, `⌘S` — сохранить, `⌘K` — палитра команд.

## Возможности

| Область | Что есть |
|---|---|
| BPMN 2.0 | 22 типа событий, 11 типов действий, 5 шлюзов, пулы и дорожки, данные, артефакты, 4 типа связей |
| IDEF0 | функциональные блоки, стрелки I/C/O/M и вызова, ICOM-коды, туннелирование, нумерация A0/A1…, декомпозиция с переносом стрелок |
| Холст | зум 10–500 %, панорама, сетка и привязка, линейки, мини-карта, умные направляющие, box-selection, resize-ручки |
| Редактирование | Undo/Redo на все операции, копирование/вставка, дублирование, выравнивание и распределение, авторазметка, перестроение связей |
| Проверка | правила BPMN (старт/конец, висящие потоки, шлюзы, пулы, сообщения) и IDEF0 (управление, выход, дубли номеров, стороны стрелок) с переходом к проблемному элементу |
| Проект | дерево моделей, декомпозиции, документация проекта/диаграммы/элемента, автосохранение и восстановление после сбоя, недавние проекты |
| Интерфейс | светлая и тёмная темы, русский и английский, командная палитра, контекстные меню, горячие клавиши, печать A4–A0 с предпросмотром |

## Горячие клавиши

| | |
|---|---|
| `⌘/Ctrl + N` / `O` / `S` / `⇧S` | новый проект / открыть / сохранить / сохранить как |
| `⌘/Ctrl + Z` / `Y` (`⇧Z`) | отменить / повторить |
| `⌘/Ctrl + C` / `V` / `X` / `D` | копировать / вставить / вырезать / дублировать |
| `⌘/Ctrl + A`, `Delete` | выделить всё, удалить |
| `⌘/Ctrl + F` / `K` / `P` | поиск / палитра команд / печать |
| `⌘/Ctrl + 1` / `2` / `3` | панели: структура / свойства / проблемы |
| `L`, `F`, `Enter` | авторазметка, вписать в экран, переименовать |
| `Space` + мышь, колесо | панорама, зум |

## Формат файлов

`.fibermodel` — ZIP-контейнер с читаемой структурой:

```
mimetype                     application/vnd.fibermodeler.project
project.json                 метаданные + список диаграмм
models/bpmn/<id>.json        по файлу на диаграмму
models/idef0/<id>.json
documentation/<id>.md        документация
preview.svg                  превью
```

Проект переносится между компьютерами целиком: элементы, координаты, связи, свойства, иерархия
декомпозиции, стили, документация.

## Разработка

```bash
node tests/run.js             # 62 теста, без зависимостей
node tests/run.js io          # только io.test.js
python3 tools/build_single_file.py
python3 tools/subset_font.py  # пересобрать встроенный шрифт для PDF
```

Архитектура и принятые решения — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Зависимостей нет: ни одной строки чужого кода в рантайме. Тесты запускаются голым Node ≥ 18,
приложение — любым современным браузером (Safari 16.4+, Chrome, Edge, Firefox).

## AI-режим (опционально)

Программа полностью работает без AI. В «Настройки → AI» можно выбрать провайдера:

* **Встроенный (офлайн)** — по умолчанию: разбор текста по правилам + подбор шаблона, без сети.
* **Claude / OpenAI / Ollama / свой endpoint** — ключ хранится только в этом браузере.
  Если внешний вызов не удался, модель всё равно будет построена встроенным движком.

---

<div align="center">

## FiberModeler in English

</div>

A business process editor for **BPMN 2.0** and **IDEF0** in one app: manual modelling first, with a
table builder and an optional text-to-model generator on top. Runs offline in the browser on macOS,
Windows and Linux — `python3 serve.py`, or open `dist/FiberModeler.html` directly.

* Full BPMN palette (events, activities, gateways, pools and lanes, data, artifacts) with notation-aware
  connection rules and validation.
* Real IDEF0: ICOM arrows bound to box sides, tunnelled arrows, node numbering, decomposition that
  carries the parent arrows into the child diagram.
* Vector PDF and SVG export with embedded Cyrillic-capable font, BPMN 2.0 XML import/export with DI,
  printing from A4 to A0 with tiling and preview.
* Undo/redo for every operation, auto layout, alignment tools, search, command palette, dark mode,
  Russian and English interface.

Switch the language in **Tools → Language** or with the globe button in the title bar.

## Лицензия

MIT. Встроенный шрифт для PDF — подмножество DejaVu Sans (Bitstream Vera / public domain).
