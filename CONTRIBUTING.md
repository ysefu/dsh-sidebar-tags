# Contributing to dsh-sidebar-tags

Thanks for taking a look. This is a small plugin; the rules are short.

## Before a PR

```bash
node scripts/build.mjs      # bundle + manifest guard
node scripts/test.mjs       # unit suite, one process
```

Both must pass. If you changed anything under `lib/client.js`, also run it in a
browser — the guard proves the bundle is *loadable*, not that the UI works:

```bash
# 1. point a Harness profile at your checkout
dsh plugin --profile <your-dev-profile> add link:$PWD
# 2. restart that profile, then open the Web GUI and exercise the changed path
```

`lab/index.html` (with `node tools/serve.mjs`) renders the same bundle in a
stand-in shell, which is faster for pure UI work: it needs no Harness install,
only network access for the React UMD build it loads.

If you have a running instance and a Chromium binary, the automated version is:

```bash
node scripts/verify-browser.mjs "http://127.0.0.1:<port>/?token=<token>"
```

## Ground rules

- **Never touch a shipped Harness file.** The plugin only contributes to
  declared seats through `ctx.slots.inject`; a review will reject direct DOM
  takeovers of the sidebar (skin-style overrides) because they break on every
  host release.
- **Keep the bundle hand-readable.** No bundler, no transpiler, no generated
  file that a reviewer cannot open. `lib/client.js` is the source; keep the
  `@region` sections and the header index in sync (the guard checks this).
- **Every new pure function gets a test.** The data model, validation and
  projections are the parts that must not regress silently.
- **No new runtime dependency** without a discussion issue first. The plugin
  runs with zero dependencies by design; `react` is provided by the shell.
- **Copy changes go in both dictionaries** (`ZH` and `EN` in the i18n region),
  and user-visible strings are never built by concatenating translated words.

## Reporting a bug

Please include:

- Harness version (`dsh --version`, or the version shown in Settings → Account);
- the output of `dsh --profile <profile> --dump-config` (trim anything private);
- the browser console errors, if any, plus whether the panel row appears at all;
- what you did, what you expected, what happened.

## Adding a tag preset or a colour

Builtin tags live in `BUILTIN_TAGS` and the editor palette in `PALETTE`, both in
the store/constants regions of `lib/client.js`. New builtin ids must be stable
forever (they are what the stored data references) and must carry both a `zh`
and an `en` label.
