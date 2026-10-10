# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-10-10

First release. A pure client-side plugin for the DeepSeek Harness Web GUI.

### Added

- **Session tags**: six builtin tags (To do / Doing / Important / Reference /
  Archivable / Idea) plus user-created tags, each with a name and a color.
- **Row badge**: the session row's leading seat shows the first tag as a colored
  dot, with `+n` when more tags are set.
- **Row menu entry** (`sidebar.workspaces.session.menu.item`, order 450) and a
  **hover row action** (`sidebar.workspaces.session.row.action`, order 300):
  both open the same one-click tag picker for that session.
- **Hover card section** (`sidebar.session.row.hover`): every tag of the row
  plus its note.
- **Panel** (`sidebar.panellist` + the keyed `main` seat): per-tag session
  counts, one-click tag filtering, an "untagged" filter, full-text search over
  titles and notes, click-to-open, per-row quick tag toggles, tag creation,
  rename, recolor, delete, and export/import/reset of the whole tag database.
- **Persistence** in `localStorage` under `dsh-sidebar-tags.db.v1`, with schema
  validation, version guarding, and preservation of an unreadable payload under
  a `.unreadable` sibling key instead of dropping it.
- **Bilingual copy** (Chinese and English), resolved from the document language
  at call time so a language switch needs no reload.
- **Tooling**: `scripts/build.mjs` (bundle and manifest guard),
  `scripts/test.mjs` (in-process test entry), `scripts/verify-browser.mjs`
  (headless-Chromium smoke check), `lab/index.html` plus `tools/serve.mjs`
  (a stand-in shell for inspecting the UI without installing anything).

### Notes

- The plugin registers only into seats the shell declares, always through
  `ctx.slots.inject`, so a Harness without a seat stays quiet rather than
  failing the boot.
- The row badge is a resting-state marker: the host renders that seat only while
  a row's primary state is idle.

[Unreleased]: https://github.com/ysefu/dsh-sidebar-tags/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ysefu/dsh-sidebar-tags/releases/tag/v1.0.0
