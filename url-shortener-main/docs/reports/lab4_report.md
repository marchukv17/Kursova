# Лабораторна 4 — Мікросервіси vs моноліт, контракт API та CRUD

## Мета

1. Свідомо обрати архітектуру: модульний моноліт чи пілот мікросервісів.
2. Описати контракт API в `openapi.yaml` і перевірити його в Swagger Editor.
3. Реалізувати базовий CRUD для обраного контексту (Links).
4. Зафіксувати рішення та правила розшарування в ADR.

## Крок 0 — Рішення про стиль архітектури

Ми обрали **модульний моноліт** (рекомендований варіант за замовчуванням).
Обґрунтування:

- Мала команда, вузький домен, розгортання на одній машині, немає платформи для
  service discovery чи розподіленого трасування.
- Шви домену (Links, Items, майбутні Identity/Analytics) виражені як **модулі**, а
  не процеси, тож межі все ще явні.
- Пізніше розбиття на сервіси — це рефакторинг за тим самим контрактом OpenAPI.

Рішення, альтернативи й тригери «коли переглядати» записані в
`docs/adr/0001-architecture-style.md`.

## Крок 1 — Контракт API (`docs/api/openapi.yaml`)

Контракт — OpenAPI 3.0.3, охоплює повний CRUD для контексту Links плюс
підтримувальні ендпоїнти:

| Метод  | Шлях          | Успіх   | Помилки                   |
|--------|---------------|---------|---------------------------|
| GET    | `/health`     | 200     | —                         |
| GET    | `/items`      | 200     | 429                       |
| GET    | `/links`      | 200     | 429, 503                  |
| POST   | `/links`      | 201     | 400, 409, 429, 503        |
| GET    | `/links/{id}` | 200     | 404, 429                  |
| PUT    | `/links/{id}` | 200     | 400, 404, 429             |
| PATCH  | `/links/{id}` | 200     | 400, 404, 429             |
| DELETE | `/links/{id}` | 204     | 404, 429                  |
| GET    | `/{slug}`     | 302     | 404                       |

DTO та єдина модель помилки визначені в `components.schemas`:

- **`CreateLinkRequest`** — `originalUrl` (обов'язково, `format: uri`),
  необов'язковий `slug` (шаблон `^[A-Za-z0-9_-]{3,32}$`), необов'язковий `title`.
- **`UpdateLinkRequest`** — необов'язкові `originalUrl`, `title`.
- **`LinkResponse`** — `id`, `slug`, `originalUrl`, `shortUrl`, `title`, `clicks`,
  `createdAt`, `updatedAt`.
- **`LinkListResponse`** — `{ items: [LinkResponse] }`.
- **`Item`** — `{ id, name }`.
- **`ErrorResponse`** — `{ error, code?, details?, requestId }`, обов'язкові
  `error` і `requestId`.

Багаторазові відповіді (`BadRequest`, `NotFound`, `Conflict`, `RateLimited`,
`ServiceUnavailable`) посилаються на `ErrorResponse` і мають конкретні приклади.

### Валідація в Swagger Editor

YAML вставлено в https://editor.swagger.io/ і відрендерено без помилок. Рендер
збережено як `docs/api/swagger_screenshot.png` і вставлено в README у розділі
«Документація API» разом із посиланням на YAML. Як і вимагалося, Swagger UI **не**
вбудовується в сам застосунок.

## Крок 2 — Реалізація CRUD

Розшарування відповідає ADR 0002 (`api → service → domain`, залежності вниз):

- **`src/api/links.routes.js`** — контролери. Розбирають запит, викликають один
  метод сервісу, задають код статусу, додають `requestId` у тіло. Без SQL і без
  бізнес-правил.
- **`src/service/link.service.js`** — сценарії. Валідація через `Link.create`,
  генерація slug за відсутності (випадкові 7 символів із повторенням при колізії),
  виконання підготовлених запитів, мапінг рядок ↔ сутність ↔ DTO відповіді,
  кидання типізованих помилок.
- **`src/domain/Link.js`** — сутність та інваріанти (валідація URL/slug/title).
- **`src/infra/`** — ініціалізація БД, request-id, rate limit, chaos, middleware
  помилок.

Поведінка реалізована точно за контрактом:

- `POST /links` → `201` зі створеним посиланням; `400` при помилці валідації;
  `409`, коли власний slug уже зайнятий.
- `GET /links` → `200` з `{ items }`.
- `GET /links/{id}` → `200` або `404`.
- `PUT` / `PATCH /links/{id}` → `200`, `400` або `404`; slug незмінний.
- `DELETE /links/{id}` → `204` або `404`.
- `GET /health` → `200 { "status": "ok" }`.
- `GET /{slug}` → `302` на оригінальний URL і збільшення лічильника кліків.

## Крок 3 — ADR

- `docs/adr/0001-architecture-style.md` — модульний моноліт, критерії перегляду.
- `docs/adr/0002-layered-architecture.md` — що лежить у `api/`, `service/`,
  `domain/`; напрямок залежностей; заборонені зв'язки (наприклад, `api/` не має
  торкатися БД).
- `docs/adr/0003-api-style-and-error-model.md` — стиль REST, політика кодів
  статусів, єдина форма помилки, заголовок кореляції, ідемпотентність,
  відповідність OpenAPI.

## Крок 4 — Тести

Юніт-тести рівня service/ лежать у `tests/link.service.test.js` і використовують
in-memory базу SQLite (`createDatabase(':memory:')`), тож вони швидкі й ізольовані.

Обов'язкові випадки (мінімум два) плюс додаткові:

- **Успіх** — `create()` повертає нормалізоване посилання: згенерований slug
  відповідає шаблону, `shortUrl` побудований із базового URL, `clicks` починається
  з 0.
- **Помилка** — `create()` без `originalUrl` кидає `ValidationError` з кодом
  `ORIGINAL_URL_REQUIRED` і `details[0].field === 'originalUrl'`.
- Додатково: не-http URL відхилено; дубль slug → `ConflictError`; невідомий id →
  `NotFoundError`; оновлення зберігає slug; розв'язання збільшує кліки; видалення й
  повторне читання → `NotFoundError`.

Запуск:

```bash
npm test
```

Усі вісім тестів проходять.

## Ручна перевірка

```bash
npm start
curl -s localhost:3000/health
curl -s localhost:3000/links
curl -s -X POST localhost:3000/links \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://example.com/very/long/path","title":"Demo"}'
curl -s -X POST localhost:3000/links \
  -H "Content-Type: application/json" \
  -d '{"title":"missing url"}'   # -> 400 ValidationError
```

## Чеклист вимог

| Вимога лаб. 4 (модульний моноліт)                      | Де виконано                                 |
|--------------------------------------------------------|---------------------------------------------|
| `docs/adr/0001-architecture-style.md`                  | наявний                                     |
| `docs/adr/0002-layered-architecture.md`                | наявний                                     |
| `docs/adr/0003-api-style-and-error-model.md`           | наявний                                     |
| `docs/api/openapi.yaml` з CRUD + DTO + моделлю помилок | наявний, перевірено в Swagger Editor        |
| `docs/api/swagger_screenshot.png` + розділ у README    | наявний і пов'язаний із README              |
| Код у `api/`, `service/`, `domain/`                    | `src/api`, `src/service`, `src/domain`      |
| POST/GET/PUT|PATCH/DELETE + `GET /health`               | `src/api/links.routes.js`, `health.routes.js` |
| Два юніт-тести рівня service/ (успіх + помилка)        | `tests/link.service.test.js` (8 тестів)     |

## Результат

API є contract-first: специфікація OpenAPI — джерело істини, код її реалізує, а
розшарування тримає HTTP-задачі поза доменом. Рішення про архітектуру явне й
оборотне, із задокументованими тригерами для перегляду.

## Висновок

Написання контракту OpenAPI до обробників змусило прояснити коди статусів і форми
помилок, що безпосередньо уможливило роботу зі стійкості в лаб. 5. Шариста
структура також зробила юніт-тести сервісу тривіальними, бо домен не має
залежностей від фреймворків.
