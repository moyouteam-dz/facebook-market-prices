# Phone-First Web App Implementation Plan

**Date:** 2026-09-18  
**Design:** `docs/superpowers/specs/2026-09-18-phone-first-webapp-design.md`  
**Branch:** `feat/phone-first-webapp`

## Execution rules

- Work only on the feature branch until merge proposal.
- TDD for behavior changes: add a failing test, implement the minimum behavior, then refactor.
- Automated CI must run tests, typecheck, and production build.
- Never commit an Apify token or any user secret.
- Browser-first acceptance on Android Chrome; WebToApp only after the browser version is stable.
- No VPS, central database, accounts, scheduled jobs, or server-side runtime in v1.

## Task 1 — Bootstrap the Arabic RTL web app and CI

Create the React + TypeScript + Vite application, mobile-first RTL shell, primary routes, test harness, and GitHub Actions workflow.

Acceptance:
- Arabic `lang=ar`, `dir=rtl`.
- Home, update, review, history, and settings routes exist.
- CI runs unit tests, typecheck, and build.

## Task 2 — Local persistence and secret boundary

Implement Dexie/IndexedDB tables for:
- `secret_settings`
- `settings`
- `sources`
- `price_history`
- `product_aliases`
- `runs`

Add repository helpers and tests proving:
- token persists locally;
- token can be replaced/deleted;
- secret records are structurally separate from normal exportable data;
- schema initialization works in fake IndexedDB.

## Task 3 — Public Facebook source management

Implement source validation and CRUD:
- add/edit/delete;
- enable/disable;
- name/market/facebook URL;
- reject malformed or clearly unsupported URLs.

Add settings UI for source management and tests for validation + persistence.

## Task 4 — Deterministic Arabic price parser

Implement:
- Arabic-Indic digit normalization;
- whitespace/punctuation normalization;
- range separators `-`, `–`, `_`;
- DZD markers;
- single price => `price_min === price_max`;
- generic product phrase extraction near a price;
- deterministic confidence labels.

Tests cover realistic Arabic samples and noisy OCR-like text.

## Task 5 — Aliases, fingerprints, and deduplication

Implement:
- local product aliases;
- alias application before candidate review;
- stable observation fingerprints;
- candidate deduplication;
- persistence-level duplicate protection;
- same evidence repeated across refreshes does not create another history row.

Tests cover alias learning and repeated runs.

## Task 6 — Apify collection adapter

Implement a browser-side Apify adapter using the user's own token:
- test token without logging/exposing it;
- run/read the configured Facebook posts actor;
- normalize actor items into the internal post model;
- iterate media safely and collect real image URIs rather than assuming `media[0]`;
- treat unavailable source content as partial failure.

Use saved real-shaped fixtures in automated CI; no live Facebook call in CI.

## Task 7 — OCR abstraction and mobile worker

Define an `OcrEngine` abstraction and worker protocol.

Implement:
- image preprocessing boundary;
- sequential processing;
- worker messages for progress/cancel/error/result;
- ONNX Runtime Web integration boundary;
- Arabic detector + recognizer model configuration;
- tests against deterministic OCR text fixtures and mocked engine output.

A real-phone benchmark gates the final model choice. Automated CI must not require downloading live model assets.

## Task 8 — Manual refresh orchestration

Implement the complete refresh pipeline:
1. validate token and selected enabled sources;
2. fetch posts through Apify;
3. normalize/dedup posts;
4. parse post text;
5. OCR applicable images locally;
6. parse OCR text;
7. apply aliases;
8. merge/dedup candidates;
9. show partial errors without discarding successful candidates;
10. route to review.

Add run progress and cancellation state.

## Task 9 — Review and save gate

Implement editable review cards/table:
- product;
- min/max;
- source/market/date;
- confidence;
- evidence type;
- raw excerpt;
- post link;
- image preview when available;
- reject candidate;
- optional "remember correction" alias.

Only explicit `حفظ النتائج` writes reviewed rows to history.

Tests prove extraction never auto-saves.

## Task 10 — History, CSV, backup, and restore

Implement:
- history pagination/querying;
- product/source/date filters;
- UTF-8 CSV export with separate `price_min` and `price_max`;
- versioned JSON backup;
- backup excludes `secret_settings`;
- schema validation;
- merge-with-dedup restore;
- destructive local reset with confirmation.

## Task 11 — Security and mobile hardening

Implement:
- no arbitrary HTML rendering;
- no token in URL/log/export;
- clear token-delete control;
- lazy OCR loading;
- sequential low-memory image processing;
- release image/object URLs;
- accessible mobile interaction states;
- error/empty/loading states in Arabic RTL.

## Task 12 — GitHub Pages deployment and Android acceptance

Add a GitHub Pages deployment workflow for the static build.

Verify on Android Chrome:
- app loads from the phone;
- routing works;
- IndexedDB persists;
- source management works;
- live Apify refresh works with a user-supplied token;
- local OCR runs on representative Arabic price images;
- review/edit/save works;
- repeated refresh does not duplicate;
- history/search/export/backup/restore work;
- acceptable memory behavior.

Only after this acceptance is WebToApp packaging evaluated.
