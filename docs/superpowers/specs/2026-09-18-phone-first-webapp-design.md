# Phone-First Facebook Market Prices Web App Design

**Date:** 2026-09-18  
**Status:** Approved design  
**Supersedes:** the earlier VPS/Python-first runtime design for the end-user application

## 1. Goal

Build an Arabic RTL web application that can be developed, deployed, tested, and used entirely from an Android phone. The application collects public Facebook posts through Apify, extracts price observations from post text and attached images, lets the user review and correct every candidate result, and stores an unlimited local price history on that user's device.

The first release must not require a VPS, Android Studio, a desktop computer, a central database, user accounts, or a shared backend. Each user provides and pays for their own Apify access token and owns their own local data.

## 2. Product constraints approved by the user

- Primary device: Android phone.
- Development workflow: phone-only; cloud CI/build/deploy performs tasks that would normally require a local desktop toolchain.
- UI language: Arabic only, RTL.
- Connectivity: online use is expected. Offline mode is out of scope.
- Refresh model: manual only, through a visible "تحديث الأسعار الآن" action.
- Data ownership: local per device/user, not shared centrally.
- History retention: unlimited unless the user deletes data.
- Authentication: none.
- Facebook scope for v1: public Facebook pages. Public groups are deferred.
- Source management: user can add, edit, disable, and delete public Facebook page sources.
- Products: generic/flexible, not limited to vegetables and fruit.
- Currency: Algerian dinar (DZD) only in v1.
- Price model: preserve ranges using `price_min` and `price_max`; a single price stores the same value in both fields.
- Review gate: extracted observations are never committed directly to history. They must first appear in a review screen.
- Learning: corrections to product names can be saved as local aliases and applied automatically in future runs.
- Backup/restore: supported locally; the Apify token must never be included in backup files.
- Distribution: begin as a browser-hosted web app; package the same app with WebToApp only after the browser version is stable.

## 3. Architecture

```text
Public Facebook pages
        |
        v
      Apify
        ^
        | user's scoped Apify token
        |
Arabic RTL Web App on Android
        |
        +--> Post text ----------------------+
        |                                    |
        +--> Image URLs --> Local OCR Worker |
                                             v
                                   Deterministic parser
                                             |
                                             v
                                      Review screen
                                             |
                                      user confirms
                                             v
                                          IndexedDB
                                             |
                     +-----------------------+------------------+
                     |                       |                  |
                History/search          CSV export        JSON backup
```

There is no application server in v1. Apify is the only remote processing dependency for Facebook collection. OCR, parsing, review, deduplication, alias learning, history, export, and backup all run locally in the web application.

## 4. Technology stack

### 4.1 Application

- React
- TypeScript
- Vite
- Arabic RTL layout
- Dexie.js over IndexedDB for local persistence

The application must remain a static client-side site so it can be hosted cheaply and deployed automatically from GitHub.

### 4.2 Apify integration

The app calls the Apify API directly from the browser. Each user configures their own Apify token once on their device.

The application must:

- allow entering, replacing, testing, and deleting the token;
- persist the token locally so it is not requested on every launch;
- never include the token in logs, CSV exports, JSON backups, URLs, analytics, or error reports;
- strongly recommend a scoped token with only the permissions required to run/read the configured actor workflow;
- treat client-side token storage as best-effort convenience, not as a server-side secret boundary.

The token is stored in a dedicated local secret-settings record excluded from every export path.

### 4.3 Local OCR

OCR runs on the phone, not on a remote OCR service.

Proposed runtime:

- ONNX Runtime Web;
- PaddleOCR-compatible text detection model converted for ONNX/Web execution;
- Arabic-capable recognition model converted for ONNX/Web execution;
- OCR executed in a Web Worker so inference does not block the UI thread.

The v1 OCR flow does not require an orientation classifier unless testing shows it is needed. Large images are resized before inference to reduce memory pressure. Images are processed sequentially or with very low concurrency to avoid Android WebView/browser memory spikes.

Model assets are served as static application assets. Normal browser caching may reuse them across launches; offline operation is not promised or tested.

## 5. User experience

The first release has five primary areas.

### 5.1 Home

Shows the latest reviewed prices and provides:

- "تحديث الأسعار الآن";
- search by product;
- filter by market/source;
- quick access to history.

### 5.2 Update

The user selects enabled sources and starts a manual refresh. Progress is visible by stage, for example:

```text
جلب المنشورات          ✓
تحميل الصور            ✓
قراءة الصور            2 / 8
تحليل الأسعار          ...
```

A failed source does not cancel successful sources unless the whole Apify run is unusable.

### 5.3 Review

Every extracted candidate appears before persistence with at least:

- product;
- `price_min`;
- `price_max`;
- market/source;
- post date;
- evidence type (`post_text` or `image_ocr`);
- raw evidence excerpt;
- source post link;
- image preview when applicable;
- confidence.

The user can edit fields, reject an observation, or accept it. A product-name correction may optionally be remembered as a local alias.

Only the explicit "حفظ النتائج" action writes reviewed observations to price history.

### 5.4 History

Stores all reviewed observations without an application-defined retention limit. The user can search/filter by:

- product;
- market/source;
- date range.

The history screen must preserve both `price_min` and `price_max` rather than collapsing a range to an average.

### 5.5 Settings

Contains:

- Apify token setup/test/delete;
- source management;
- learned product aliases;
- backup;
- restore;
- CSV export;
- destructive local-data reset with confirmation.

## 6. Source management

A source record contains at least:

```text
id
name
market
facebook_url
enabled
created_at
updated_at
```

The application accepts user-managed public Facebook page URLs. The four Algerian market pages used during development are useful default/demo fixtures but are not hard-coded as the only supported sources.

URL validation should reject obviously unsupported or malformed inputs before an Apify run. Runtime availability remains dependent on what Facebook exposes publicly and what the selected Apify actor can retrieve.

## 7. Collection and normalization

The collection adapter normalizes Apify output into a small internal post model instead of storing the entire actor payload.

Target normalized post shape:

```text
post_id
source_id
source_page
market
post_url
post_date
text
image_urls[]
raw_actor_item_ref (optional diagnostic reference, not the full payload by default)
```

Media extraction must not assume that `media[0]` is a usable photo. It must iterate media entries and choose actual image fields when present, including structures equivalent to `image.uri` and `photo_image.uri`.

Unavailable content is recorded as a source/post retrieval issue and does not break the rest of the update.

## 8. Parsing strategy

The parser is deterministic in v1. It does not use a generative AI service.

### 8.1 Normalization

Normalize at least:

- Arabic-Indic and Western digits;
- Arabic punctuation/spacing variants;
- common range separators such as `-`, `–`, and `_`;
- DZD markers such as `دج` and equivalent formatting variants;
- whitespace and line boundaries.

### 8.2 Generic product extraction

Because the application is not limited to a fixed produce catalog, the parser treats the phrase near a detected DZD price/range as a product candidate. It uses local aliases only for normalization, not as a requirement for recognition.

Examples:

```text
البصل : 35–40 دج
=> product="البصل", price_min=35, price_max=40

بطاطا 80 دج
=> product="بطاطا", price_min=80, price_max=80
```

Ambiguous candidates are kept with lower confidence and sent to review rather than guessed into a final value.

### 8.3 Text before OCR

Post text is parsed first because it is faster and usually more reliable. Attached images are then processed locally when they may contain useful price information. OCR output goes through the same normalization and parser pipeline as post text.

### 8.4 Confidence

Each candidate receives a simple deterministic confidence label such as `high`, `medium`, or `low` based on evidence quality, for example proximity between product text and a DZD price expression and whether OCR text is noisy.

Confidence never bypasses the review step.

## 9. Deduplication

Deduplication occurs before final save and again at persistence boundaries.

A stable observation fingerprint should include enough fields to distinguish genuine price changes while preventing repeated saves of the same evidence. Candidate components include:

```text
source_id
post_id
normalized_product
price_min
price_max
source_type
```

If the same observation is found in both post text and image OCR, the review layer may merge them into one candidate while preserving both evidence references. Re-running an unchanged Apify result must not create duplicate history rows.

## 10. Local data model

IndexedDB stores separate logical collections.

### 10.1 `secret_settings`

Contains the Apify token and any future local-only secrets. It is excluded from backup/export code paths by construction.

### 10.2 `settings`

Non-secret app preferences and schema version.

### 10.3 `sources`

User-managed Facebook page definitions.

### 10.4 `price_history`

Each reviewed observation contains at least:

```text
id
product
normalized_product
price_min
price_max
currency = "DZD"
market
source_id
source_page
post_id
post_url
source_type
raw_text
image_url
post_date
scraped_at
reviewed_at
confidence
fingerprint
```

### 10.5 `product_aliases`

```text
id
observed_name
canonical_name
created_at
updated_at
```

Aliases affect future processing. Existing history is not rewritten automatically.

### 10.6 `runs`

Stores non-secret update diagnostics such as:

```text
id
started_at
finished_at
selected_sources
posts_received
images_processed
candidates_found
candidates_saved
candidates_rejected
errors[]
```

No token value or authorization header may be stored.

## 11. Backup, restore, and export

### 11.1 JSON backup

A backup is a single versioned JSON file containing:

- non-secret settings;
- sources;
- full price history;
- learned aliases;
- optional non-secret run history.

The Apify token is intentionally absent.

Restore validates the backup schema/version before modifying local data. The user must explicitly confirm whether restore merges with or replaces existing data. The default v1 behavior should be **merge with deduplication**, because it is safer against accidental history loss.

After restore, if no local Apify token exists, the app asks the user to configure one before the next refresh.

### 11.2 CSV

CSV export focuses on reviewed price observations and uses UTF-8. It includes `price_min` and `price_max` separately and does not include secrets.

## 12. Security model

The application has no server-side secret store in v1. Therefore the design does not claim that a browser-stored Apify token is impossible to extract from the user's own device.

Risk reduction measures:

- scoped Apify token recommended and explained during setup;
- no unnecessary third-party scripts;
- strict Content Security Policy where supported by the chosen static host;
- token never interpolated into URLs;
- authorization sent only to Apify endpoints;
- no token logging;
- no token in backup/CSV;
- explicit token deletion control;
- sanitize any user-controlled or Facebook-derived text before rendering;
- avoid rendering arbitrary HTML from post content.

## 13. Performance and mobile behavior

The design is optimized for an Android phone browser/WebView:

- lazy-load OCR runtime only when needed;
- execute OCR in a Web Worker;
- resize images before inference;
- process images sequentially or with minimal concurrency;
- keep Apify payloads transient and persist only normalized data needed by the app;
- show progress and allow cancellation of a long local OCR run;
- release image/object URLs and intermediate tensors promptly;
- do not preload all historical rows into memory at once.

## 14. Hosting and phone-only development workflow

The repository is the source of truth. The user does not need Node.js, Android Studio, Gradle, or an Android SDK on their phone.

Development/deployment flow:

```text
ChatGPT / GitHub from phone
        |
        v
Git commits / pull requests
        |
        v
GitHub Actions
        |
        +--> tests
        +--> production build
        v
Static web deployment
        |
        v
Chrome Android validation
        |
        v
WebToApp packaging after web acceptance
```

GitHub Pages is the initial hosting target because the app is static. If later requirements need headers or hosting behavior that GitHub Pages cannot provide cleanly, the same build may move to another static host without changing the application architecture.

WebToApp packaging is a release step, not the development runtime. Browser acceptance comes first. Before distribution, WebToApp must be verified to preserve IndexedDB/local storage reliably across normal launches and app updates.

## 15. Error handling

Fatal-to-current-run errors:

- missing/invalid Apify token when refresh starts;
- Apify run cannot be created/read at all;
- IndexedDB cannot persist reviewed data;
- incompatible backup schema during restore.

Non-fatal/partial errors:

- one source returns no posts;
- one public page is unavailable;
- one image fails to download;
- one OCR operation fails;
- one post has no recognizable price;
- a candidate is ambiguous.

Partial failures are shown clearly in the run summary while preserving successful candidates.

## 16. Testing strategy

### 16.1 Unit tests

Cover:

- Arabic/Western digit normalization;
- price range separators;
- DZD parsing;
- generic product candidate extraction;
- alias application;
- confidence assignment;
- fingerprints/deduplication;
- backup secret exclusion;
- restore schema validation.

### 16.2 Integration tests

Use saved fixtures rather than live Facebook calls for automated CI:

- real-shaped Apify JSON fixtures;
- image/media normalization fixtures;
- OCR text fixtures;
- IndexedDB persistence tests;
- update -> review -> save flow;
- backup -> clear -> restore flow.

### 16.3 Browser/mobile acceptance

Manually validate on Android Chrome before WebToApp packaging:

- Arabic RTL rendering;
- token persistence;
- source management;
- live Apify refresh;
- local OCR on representative Arabic price images;
- review edits and alias learning;
- deduplication across repeated refreshes;
- history search/filter;
- CSV download;
- backup and restore;
- acceptable memory behavior on a real phone.

## 17. Migration from the existing Python prototype

The existing Python pipeline remains useful as a reference and fixture generator, but it is no longer the end-user runtime.

Migration principles:

- preserve validated parsing behavior, especially `price_min`/`price_max`;
- reuse real Apify sample data as test fixtures;
- port behavior to TypeScript using fresh tests rather than line-by-line translation;
- keep the Python prototype under a legacy/reference area until the web version passes the acceptance criteria;
- do not require Python or PaddlePaddle on the user's phone.

No legacy code is deleted as part of the design/spec phase.

## 18. Scope deferred beyond v1

The following are intentionally out of scope:

- Facebook public groups;
- private Facebook content;
- user accounts;
- shared/central price database;
- sync between devices;
- scheduled/background refresh;
- push notifications;
- offline mode;
- currencies other than DZD;
- native Android/Kotlin application;
- generative-AI price extraction;
- automatic rewriting of historical data when an alias changes.

## 19. Acceptance criteria

The v1 design is accepted only when all of the following work on an Android phone without a VPS or PC-side runtime:

- web app opens correctly in Android Chrome;
- Arabic RTL UI is complete;
- user enters an Apify token once and it persists locally;
- user can test, replace, and delete the token;
- user can add, edit, disable, and remove public Facebook page sources;
- manual refresh retrieves live Apify post data;
- post text is parsed locally;
- relevant images are downloaded and OCR runs locally on the phone;
- parser produces generic product candidates with `price_min` and `price_max` in DZD;
- all candidates appear in review before save;
- user can edit or reject candidates;
- user corrections can create reusable local aliases;
- reviewed observations persist in IndexedDB with unlimited history;
- repeated refreshes do not duplicate unchanged observations;
- history can be searched/filtered by product, source/market, and date;
- CSV export works and contains no secret;
- JSON backup works and contains no Apify token;
- JSON restore works with validation and deduplication;
- automated tests/build run in GitHub Actions;
- static deployment is usable directly from the phone;
- after browser acceptance, WebToApp packaging preserves the required local storage behavior.
