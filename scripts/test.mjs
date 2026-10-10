#!/usr/bin/env node
/**
 * In-process test entry for dsh-sidebar-tags.
 *
 * Node's own runner gives every test file its own child process, which is the
 * better isolation but is unavailable in confined environments (a piped-stdio
 * spawn is refused there) — and that refusal is also why the CI failure this
 * file was written around could hide locally: the runner died before it could
 * report the real error. This entry imports the same test files into one
 * process instead, so the suite runs anywhere Node runs:
 *
 *     npm test            # this file
 *
 * Node's own runner is preferred where it works, and CI uses it as well:
 * `node --test "tests/<glob>.test.mjs"` (a glob — a bare directory argument is
 * read as a module path on a non-TTY runner).
 */

import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests')
const files = readdirSync(testsDir).filter((name) => name.endsWith('.test.mjs')).sort()

let failed = 0
for (const file of files) {
	await import(pathToFileURL(join(testsDir, file)).href).catch((error) => {
		failed += 1
		console.error('FAIL ' + file)
		console.error(error && error.stack ? error.stack : error)
	})
}

if (failed > 0) {
	console.error(failed + ' test file(s) failed to load')
	process.exit(1)
}
