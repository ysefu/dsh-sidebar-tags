#!/usr/bin/env node
/**
 * In-process test entry for dsh-sidebar-tags.
 *
 * `node --test tests/` runs every test file in its own child process, which is
 * the best isolation but is unavailable in confined environments (a piped-stdio
 * spawn is refused there). This entry imports the same test files into one
 * process instead, so the suite runs anywhere Node runs:
 *
 *     npm test            # this file
 *
 * Node's own runner still works and is preferred when it is available:
 * `node --test tests/*.test.mjs`.
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
