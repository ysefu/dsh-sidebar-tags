/**
 * Host half of `dsh-sidebar-tags`.
 *
 * The plugin is a pure browser-side UI contributor: it adds colored tags to
 * sidebar session rows, a tag editor on the row menu, and a tag-filtered
 * session panel. Everything it owns lives in the browser, so this half has no
 * host services, no routes and no storage.
 *
 * It is still a real Cordis plugin: the loader row inserted by
 * `cordis.patch.yml` mounts this module, and mounting it is what makes the
 * host publish the browser bundle declared by `dsh.client` in package.json.
 *
 * @module dsh-sidebar-tags
 */

/** Cordis plugin name; the loader patch id in `cordis.patch.yml` matches it. */
export const name = 'sidebar-tags'

/** No host services are consumed, so the plugin mounts unconditionally. */
export const inject = []

/**
 * Mount the host half.
 *
 * Intentionally empty: the browser half is a separate plugin that the web
 * client loads from `lib/client.js`. Keeping this function explicit (rather
 * than omitting the module) documents that the empty body is a decision, not
 * an unfinished host side.
 *
 * @returns Nothing.
 */
export function apply() {}
