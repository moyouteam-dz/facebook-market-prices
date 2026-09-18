# Gemini Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional BYOK Gemini extraction fallback after local OCR/deterministic parsing while preserving mandatory review and local-first data ownership.

**Architecture:** Deterministic parsing remains primary. Evidence is grouped per Facebook post; only posts with zero or exclusively low-confidence deterministic candidates are eligible for Gemini when enabled and configured. Gemini returns strict JSON which is validated locally before candidates enter the existing review gate.

**Tech Stack:** React, TypeScript, Vite, Dexie/IndexedDB, Vitest, Testing Library, Gemini REST API.

**Spec:** `docs/superpowers/specs/2026-09-18-gemini-fallback-design.md`

## Global Constraints
- Arabic-only RTL UI.
- Phone-first static browser application; no VPS/backend/accounts.
- Gemini is optional BYOK and fallback-only.
- Never expose Apify/Gemini keys in URLs, logs, diagnostics, CSV, or backup.
- Gemini never writes directly to history.
- Every candidate requires explicit review/save.
- OCR stays local and sequential.
- TDD for every behavior change.

---

### Task 1: Gemini secret storage and backup exclusion
**Files:** Modify `src/db/secrets.ts`, backup/reset code; Test secret/backup tests.
**Interfaces:** Produce `getGeminiApiKey(db)`, `replaceGeminiApiKey(db,key)`, `deleteGeminiApiKey(db)`.
- [ ] Add failing tests proving Gemini key round-trip, deletion, reset deletion, and absence from serialized backup.
- [ ] Run focused tests and verify RED.
- [ ] Implement separate `gemini_api_key` secret using `secret_settings`.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit `feat: store Gemini key locally and exclude it from backups`.

### Task 2: Gemini settings and validation
**Files:** Create `src/gemini/tokenValidation.ts`; modify `src/pages/SettingsPage.tsx`; tests under `tests/gemini/` and settings UI tests.
**Interfaces:** Produce `testGeminiApiKey(key, fetchImpl?) => Promise<boolean>`; persist boolean setting `gemini_fallback_enabled`.
- [ ] Write failing tests for valid/invalid key responses, save/replace/delete UI, and enable toggle.
- [ ] Verify RED.
- [ ] Implement minimal REST validation without putting key in URL; use authorization header supported by the selected Gemini endpoint.
- [ ] Render Arabic panel and fallback toggle; never echo stored key.
- [ ] Verify GREEN and commit `feat: add Gemini fallback settings`.

### Task 3: Strict Gemini extraction adapter
**Files:** Create `src/gemini/extraction.ts`; test `tests/gemini/extraction.test.ts`.
**Interfaces:** Consume `{postText,ocrText,signal}`; produce validated `GeminiPriceCandidate[]`.
- [ ] Write failing tests for strict JSON array, blank product, negative/non-finite values, wrong currency, reversed range, malformed/non-JSON response, and abort.
- [ ] Verify RED.
- [ ] Implement a minimal prompt requiring DZD structured output and no guessing when no price is present.
- [ ] Validate every returned object locally; normalize reversed min/max; discard invalid objects.
- [ ] Verify GREEN and commit `feat: add validated Gemini price extraction`.

### Task 4: Fallback trigger policy
**Files:** Create `src/gemini/fallbackPolicy.ts`; test `tests/gemini/fallbackPolicy.test.ts`.
**Interfaces:** Produce `shouldUseGemini(candidates, enabled, hasKey): boolean`.
- [ ] RED tests: false for disabled/no-key/high/medium candidate; true for zero candidates; true when all deterministic candidates are low confidence.
- [ ] Implement exact policy.
- [ ] GREEN and commit `feat: gate Gemini behind deterministic fallback policy`.

### Task 5: Refresh integration and provenance
**Files:** Modify `src/refresh/manualRefresh.ts` and review candidate types; tests under `tests/refresh/`.
**Interfaces:** Extend options with optional Gemini extractor/config; candidates expose `ai_assisted: boolean` while retaining `source_type`.
- [ ] RED tests proving no Gemini call on reliable deterministic extraction, one grouped call per eligible post, AI candidate goes to review only, Gemini failure is nonfatal.
- [ ] Implement post-scoped evidence aggregation and fallback call after local OCR.
- [ ] Dedup deterministic/AI candidates using existing fingerprint semantics.
- [ ] GREEN and commit `feat: integrate Gemini as extraction fallback`.

### Task 6: Safe diagnostics and zero-result UX
**Files:** Modify `src/refresh/manualRefresh.ts`, run/result diagnostic types, `src/pages/UpdatePage.tsx`; tests.
**Interfaces:** Return bounded diagnostic counters and sanitized error categories.
- [ ] RED tests for posts/images/parser/Gemini counters, no API key/full CDN URL leakage, and zero-candidate run staying on Update.
- [ ] Implement bounded local diagnostics; categorize image/OCR/Gemini failures without signed URLs.
- [ ] Show Arabic zero-result summary instead of opening empty Review.
- [ ] GREEN and commit `feat: add safe refresh diagnostics`.

### Task 7: Review UI for AI-assisted candidates
**Files:** Modify `src/pages/ReviewPage.tsx` and review tests.
**Interfaces:** Display an Arabic AI-assisted badge/label; persistence still uses explicit save.
- [ ] RED UI test that AI candidate is visibly identified and is not persisted before save.
- [ ] Implement label and preserve edit/reject/save behavior.
- [ ] GREEN and commit `feat: identify AI-assisted review candidates`.

### Task 8: Full verification and deployment gate
**Files:** Update `docs/mobile-acceptance.md`.
- [ ] Run full unit suite; expected all PASS.
- [ ] Run TypeScript typecheck; expected success.
- [ ] Run production Vite build; expected success.
- [ ] Verify generated artifacts contain no literal test API secrets.
- [ ] Update Android checklist with deterministic-success and Gemini-fallback scenarios.
- [ ] Commit `docs: add Gemini Android acceptance checks`.
- [ ] Push feature branch/PR, require green CI, review diff/security boundaries, merge only when green.
- [ ] Verify main CI + GitHub Pages deployment succeeds before requesting one Android rerun.
