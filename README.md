# dsh-sidebar-tags

[![ci](https://github.com/ysefu/dsh-sidebar-tags/actions/workflows/ci.yml/badge.svg)](https://github.com/ysefu/dsh-sidebar-tags/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Colored session tags for the DeepSeek Harness sidebar.** Tag any session from
its own row, see the tag at a glance, and filter your whole history by tag from
a dedicated sidebar panel.

[中文说明](README.zh.md) · [Changelog](CHANGELOG.md) · MIT

---

## Why

A long-running Harness install turns into hundreds of sessions across several
workspaces. The sidebar can show them, search them and archive them, but there
is no way to say *"this one is a client deliverable"* or *"come back to this on
Friday"* — and no way to get those sessions back as a set.

This plugin adds exactly that layer, and nothing else:

| | |
|---|---|
| **Tags on the row** | A colored dot (plus `+n`) at the start of the session row |
| **Tag from the row** | An entry in the row's "…" menu and a hover button, both a one-click picker |
| **Tag on hover** | The hover card lists the session's tags and its note |
| **Tag panel** | A sidebar panel: per-tag counts, one-click filtering, full-text search over titles and notes, jump to session, create/rename/recolor/delete tags, export/import a backup |

It is a pure client-side plugin: no host routes, no files outside the browser, no
model-facing content, no changes to any shipped Harness file. Data lives in
`localStorage` and can be exported as JSON at any time.

## Install

```bash
# from npm (once published)
dsh plugin --profile <profile> add dsh-sidebar-tags

# from a checkout of this repository
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-sidebar-tags
```

Then restart that profile (or reload the Web GUI). The plugin appears in the
sidebar as **Session tags**.

Uninstall:

```bash
dsh plugin --profile <profile> remove dsh-sidebar-tags
```

## Use

1. Hover a session row and click the tag button, or open the row's **…** menu and
   use **Tag this session…**.
2. Pick one or more tags. The row gets a colored dot immediately.
3. Open **Session tags** in the sidebar to see counts per tag, filter the list,
   search titles and notes, and manage the tag set itself.
4. Tags are stored per browser profile. Use **Export a backup** in the panel to
   keep a copy, and **Import a backup** to bring it to another browser.

Six tags ship with the plugin (To do / Doing / Important / Reference /
Archivable / Idea); all of them can be renamed, recolored or deleted, and new
ones can be created in the panel.

## Compatibility

| Harness | Status |
|---|---|
| `0.2.0-rc.2` | tested (see "How this was verified") |
| `0.2.0-rc.1` | expected compatible (same slot contract) |
| older lines | the plugin stays dormant and logs nothing; the seats it needs did not exist |

The plugin contributes only to seats the shell declares
(`sidebar.panellist`, the keyed `main`, `sidebar.session.row.leading`,
`sidebar.session.row.hover`, `sidebar.workspaces.session.menu.item`,
`sidebar.workspaces.session.row.action`) and every registration goes through
`ctx.slots.inject`. A shell without a seat never runs the callback, so a future
Harness that renames a seat degrades to "this one feature is missing" instead of
breaking the boot.

### Known limits

- **The row dot is a resting-state marker.** The host renders
  `sidebar.session.row.leading` only while a row's primary state is idle; a row
  that is running, waiting for approval or carrying an unread completion shows
  the host's own status dot there instead. The tags are still visible in the
  hover card, the row menu and the panel.
- **`localStorage` is per browser profile.** Clearing site data clears tags;
  private windows start empty. Export a backup if that matters.
- **Sessions deleted outside the Harness** may leave a record behind; the panel
  prunes records for sessions the host no longer lists the next time it opens.
- The panel lists the sessions the current page knows about, plus remembered
  titles for tagged sessions that are no longer loaded.

## How this was verified

Everything below is runnable from a checkout with plain Node (no bundler, no
network):

```bash
node scripts/build.mjs                 # bundle + manifest guard (34 invariants)
node scripts/test.mjs                  # 34 unit tests, in one process
node --test "tests/**/*.test.mjs"      # the same tests through Node's own runner
```

`scripts/verify-browser.mjs <gui-url>` drives a headless Chromium over the
DevTools protocol against a live instance and asserts that the stylesheet is
injected, the panel row exists, selecting it mounts the panel, and the panel
renders — useful in CI with a browser available. `lab/index.html` (served by
`node tools/serve.mjs`) renders the same bundle in a stand-in shell so the UI can
be inspected without installing anything.

State that has actually been observed, not just intended:

- the loader mounts the plugin from a profile `link:` install, and the host
  serves `dsh-sidebar-tags/client.js` in the profile's boot graph;
- `scripts/build.mjs` and the unit suite pass on Node 24;
- the four row/panel components, the store and the projections are covered by
  the unit tests at the level of registration contract and pure functions.

Not yet observed: a click-through of the rendered panel inside a real Harness
window. The environment this plugin was written in had no browser that could
start (sandbox) — that check is the first thing to run on a normal desktop, and
`scripts/verify-browser.mjs` automates it.

## How it works

```
sidebar.panellist ──► panel row (icon)          ┐
main (key = sidebar-tags) ──► the panel page    │  registered with ctx.slots.inject,
sidebar.session.row.leading ──► the row dot     │  so load order never matters and a
sidebar.session.row.hover ──► tags + note       │  shell without the seat stays quiet
sidebar.workspaces.session.menu.item ──► picker │
sidebar.workspaces.session.row.action ──► picker┘

localStorage ──► TagsDb ──► snapshot store ──► components (React.useSyncExternalStore)
                                 ▲
                    pure functions: validate, migrate, toggle, prune, filter
```

Panel data comes from the Harness' own Cordis stores (`sessions.list`,
`uiSession.sessionStatus`, `workspaces.list`) read through `getSnapshot()` and
`subscribe()` — the same observables the shipped sidebar reads, so no extra
polling, RPC or duplicate cache exists.

### Why no build step

`lib/client.js` is hand-written CommonJS wrapped in the one call the Harness
loader expects:

```js
window.__ModuleLoader__.load({ id: 'dsh-sidebar-tags', factory: (require) => { … } })
```

The only module it requires is `react`, which every shell provides. That means
the published artifact is the source: a checkout is installable and reviewable
as-is, `git diff` shows behaviour, and there is no toolchain to trust or keep
current. `scripts/build.mjs` replaces a bundler with a structural check —
wrapper shape, bundle id versus package name, patch row versus package name,
region index versus file body, and syntax. The trade-off is no TypeScript and no
tree-shaking, which a plugin of this size does not miss; if that changes, the
module boundaries are already laid out as `@region` sections for a move to
`tsdown`.

## Repository layout

```
lib/index.js            host half (inert: the plugin is browser-only)
lib/client.js           browser half — the shipped bundle
cordis.patch.yml        the bundle patch layer that mounts the plugin
scripts/build.mjs       bundle and manifest guard
scripts/test.mjs        in-process test entry
scripts/verify-browser.mjs  headless-Chromium smoke check
scripts/sandbox-install.mjs install into a throwaway profile
scripts/publish-github.mjs  create + push the repository over the REST API (no git needed)
tests/                  34 unit tests + the fake-shell harness
lab/index.html          stand-in shell that renders the bundle in a browser
tools/serve.mjs         throwaway static server for the lab
```

## Contributing

Issues and PRs are welcome. Please run `node scripts/build.mjs && node
scripts/test.mjs` before opening a PR; CI runs both plus the browser smoke check.

## License

MIT — see [LICENSE](LICENSE).
