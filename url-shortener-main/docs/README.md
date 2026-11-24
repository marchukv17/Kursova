# Покажчик документації

Усі артефакти лабораторних 1–5 лежать у цій папці.

## Лабораторна 2 — бізнес і архітектура

| Файл | Опис |
|------|------|
| [`business_doc.md`](business_doc.md) | Опис системи, ролі, сценарії, функціональні/нефункціональні вимоги, обмеження. |
| [`architecture_diagram.png`](architecture_diagram.png) | Діаграма Client → Backend → Database з майбутніми модулями. |
| [`architecture_diagram.drawio`](architecture_diagram.drawio) | Редаговане джерело діаграми архітектури. |
| [`roadmap.md`](roadmap.md) | План на тижні 3–6, беклог і ризики. |

## Лабораторна 3 — domain-driven design

| Файл | Опис |
|------|------|
| [`domain/entities.md`](domain/entities.md) | Сутності та атрибути за кожним bounded context. |
| [`domain/glossary.md`](domain/glossary.md) | Ubiquitous language (13 термінів) з усуненням неоднозначностей. |
| [`domain/context_map.png`](domain/context_map.png) | Bounded contexts та їхні зв'язки. |
| [`domain/context_map.drawio`](domain/context_map.drawio) | Редаговане джерело контекстної карти. |

## Лабораторна 4 — рішення, контракт API, CRUD

| Файл | Опис |
|------|------|
| [`adr/0001-architecture-style.md`](adr/0001-architecture-style.md) | Рішення про модульний моноліт і умови перегляду. |
| [`adr/0002-layered-architecture.md`](adr/0002-layered-architecture.md) | Шари, напрямок залежностей, заборонені зв'язки. |
| [`adr/0003-api-style-and-error-model.md`](adr/0003-api-style-and-error-model.md) | Стиль REST, коди статусів, модель помилок, відповідність OpenAPI. |
| [`api/openapi.yaml`](api/openapi.yaml) | Контракт OpenAPI 3.0.3 для всього API. |
| [`api/swagger_screenshot.png`](api/swagger_screenshot.png) | Рендер контракту в Swagger Editor. |

## Звіти лабораторних

| Файл | Опис |
|------|------|
| [`reports/lab1_report.md`](reports/lab1_report.md) | Зріз «клієнт → бекенд → база даних». |
| [`reports/lab2_report.md`](reports/lab2_report.md) | Бізнес-документ, діаграма та roadmap. |
| [`reports/lab3_report.md`](reports/lab3_report.md) | DDD: піддомени, глосарій, контекстна карта, код моделі. |
| [`reports/lab4_report.md`](reports/lab4_report.md) | Рішення про архітектуру, OpenAPI, CRUD, ADR, тести. |
| [`reports/lab5_report.md`](reports/lab5_report.md) | Ідемпотентність, ретраї, таймаути, режим деградації. |

## Порядок читання

1. Почніть із `reports/lab1_report.md`, щоб зрозуміти робочий зріз.
2. Далі `business_doc.md` і `architecture_diagram.png` (лаб. 2).
3. Потім `domain/` (лаб. 3), ADR і `api/openapi.yaml` (лаб. 4).
4. Завершіть `reports/lab5_report.md` — там поведінка стійкості.
