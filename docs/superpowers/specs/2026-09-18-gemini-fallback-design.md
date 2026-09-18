# Hybrid Gemini Fallback Design

**Date:** 2026-09-18
**Status:** Approved
**Extends:** `docs/superpowers/specs/2026-09-18-phone-first-webapp-design.md`

## Goal
Keep deterministic/local extraction as the primary path and use Gemini only as an optional fallback when deterministic parsing finds no candidates or only low-confidence candidates.

## Architecture
```text
Apify -> post text + images -> local OCR -> deterministic parser
                                      |
                         reliable candidates? yes -> review
                                      |
                                      no
                                      v
                               Gemini fallback
                                      |
                            structured JSON only
                                      |
                         local validation + dedup
                                      |
                                    review
                                      |
                             explicit user save
```

Gemini never writes directly to price history.

## Trigger policy
Gemini is called only when enabled and configured, and the deterministic result for a post has zero candidates or only low-confidence candidates. High/medium deterministic candidates do not require Gemini. If Gemini is unavailable, rate-limited, invalidly configured, or returns invalid output, deterministic processing continues and the run remains reviewable/diagnosable.

## Gemini key
Each user supplies their own Gemini API key. It is tested before saving and stored in the existing local secret-settings store under a separate key. It is never included in URLs, logs, diagnostics, CSV, JSON backup, or source records, and is never displayed again after saving. Reset-all deletes it.

## Settings
Add an Arabic RTL Gemini panel:
- Gemini API key: test/save/replace/delete.
- Toggle: `استخدام Gemini عند فشل التحليل`.
The toggle is non-secret local settings. Gemini fallback is inactive without both the toggle and a valid stored key.

## AI input and privacy
Send only the minimum evidence needed for the current post: post text and local OCR text associated with that post. Do not send Apify credentials, Gemini credentials, local history, aliases database, backup data, unrelated posts, or full CDN URLs.

## Structured output
The Gemini adapter accepts only a JSON array matching:
```json
[
  {
    "product": "بطاطا",
    "price_min": 80,
    "price_max": 100,
    "currency": "DZD"
  }
]
```
Reject malformed objects, blank products, non-finite/negative prices, unsupported currency, and normalize reversed min/max. AI candidates are marked with an AI-assisted provenance flag while preserving whether evidence originated from post text/OCR.

## Review gate
All AI-assisted candidates enter the same mandatory review screen. The user can edit or reject them. Only `حفظ النتائج` persists accepted observations.

## Diagnostics
For each refresh keep a bounded, local-only diagnostic summary sufficient to distinguish collection, image-fetch, OCR, deterministic parsing, and Gemini fallback failures. Never include API keys. Do not expose full signed/CDN image URLs in user-facing diagnostics. OCR evidence samples are bounded and remain local.

When a run produces zero candidates, remain on the Update screen and show an Arabic summary (posts inspected, images processed/failed, parser candidates, Gemini attempted/succeeded/failed) instead of navigating to an empty Review screen.

## Cost control
Gemini is not called for every image. OCR remains local and sequential. Evidence is grouped by post and Gemini is invoked only for fallback posts, minimizing free-tier/API usage.

## Testing
TDD covers secret exclusion, settings toggle, fallback trigger policy, structured-response validation, failure degradation, diagnostics redaction, zero-result UX, and mandatory review behavior. Existing deterministic parser/OCR tests remain green. Android Chrome acceptance must verify one deterministic-success case and one Gemini-fallback case before WebToApp packaging.
