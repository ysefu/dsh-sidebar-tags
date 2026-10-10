#!/usr/bin/env node
/**
 * Bundle guard for dsh-sidebar-tags.
 *
 * The client half is hand-written and shipped as-is, so there is nothing to
 * transpile — but a bundle that the Harness client cannot load fails at runtime
 * inside the browser, where the failure is expensive to diagnose. This script
 * makes every structural requirement checkable from a terminal:
 *
 *   1. the files the loader needs exist;
 *   2. `lib/client.js` is a single classic script that opens with the
 *      `window.__ModuleLoader__.load({ id, factory })` registration;
 *   3. its syntax parses;
 *   4. the `id` matches package.json's `name` (the Harness resolves the bundle
 *      by that identity, and a mismatch silently registers nothing);
 *   5. the `@region` index in the header still names the sections the file has;
 *   6. `package.json` declares `dsh.client`, `dsh.bundle.patch`, and the patch
 *      file inserts exactly one row whose name matches the package name.
 *
 * Usage: node scripts/build.mjs [--check]
 * `--check` is accepted for symmetry with `pnpm check`; both modes are read-only
 * and print the same report.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const notes = []

/**
 * Record one check.
 * @param label - what was checked.
 * @param ok - whether it passed.
 * @param detail - optional explanation shown on failure.
 */
function check(label, ok, detail) {
	if (ok) notes.push('ok   ' + label)
	else failures.push('FAIL ' + label + (detail ? ' — ' + detail : ''))
}

/**
 * Read a file relative to the repository root.
 * @param relative - repository-relative path.
 * @returns the file text.
 */
function read(relative) {
	return readFileSync(join(root, relative), 'utf8')
}

/* 1 ─ files ---------------------------------------------------------------- */
const REQUIRED_FILES = [
	'package.json',
	'cordis.patch.yml',
	'lib/index.js',
	'lib/client.js',
	'README.md',
	'README.zh.md',
	'CHANGELOG.md',
	'LICENSE'
]
for (const file of REQUIRED_FILES) check('file exists: ' + file, existsSync(join(root, file)))

/* 2 ─ wrapper -------------------------------------------------------------- */
const client = read('lib/client.js')
const wrapper = /^window\.__ModuleLoader__\.load\(\{\s*\n\tid: '([^']+)',\s*\n\tfactory: \(require\) => \{/m.exec(client)
check('client.js opens with __ModuleLoader__.load({ id, factory })', wrapper !== null)
const bundleId = wrapper ? wrapper[1] : null
check('bundle registers require("react")', /require\('react'\)/.test(client))
check('bundle has no top-level import/export', !/^\s*(import|export)\s/m.test(client))

/* 3 ─ syntax --------------------------------------------------------------- */
try {
	// Compile only: the body is not executed, so no browser globals are needed.
	new Function(client)
	check('client.js parses as a classic script', true)
} catch (error) {
	check('client.js parses as a classic script', false, error.message)
}

try {
	// lib/index.js is an ES module, so it needs Node's own module parser rather
	// than `new Function` (which parses as a classic script). stdio is inherited
	// on purpose: some confined environments refuse a child whose stdio is piped.
	const checked = spawnSync(process.execPath, ['--check', join(root, 'lib/index.js')], { stdio: 'inherit' })
	check('index.js parses as an ES module', checked.status === 0, 'node --check reported a syntax error')
} catch (error) {
	check('index.js parses as an ES module', false, error.message)
}

/* 4 ─ identity ------------------------------------------------------------- */
const pkg = JSON.parse(read('package.json'))
check('bundle id matches package name', bundleId === pkg.name, 'bundle ' + bundleId + ' vs package ' + pkg.name)

/* 5 ─ region index --------------------------------------------------------- */
const headerRegions = [...client.matchAll(/^\s\*   - (\w+)\s/gm)].map((match) => match[1])
const bodyRegions = [...client.matchAll(/@region (\w+)/g)].map((match) => match[1]).filter((name, index, all) => all.indexOf(name) === index)
check('header region index is complete', headerRegions.length > 0 && headerRegions.every((name) => bodyRegions.includes(name)),
	'header [' + headerRegions.join(', ') + '] vs body [' + bodyRegions.join(', ') + ']')
check('every body region is documented', bodyRegions.every((name) => headerRegions.includes(name)),
	'body [' + bodyRegions.join(', ') + '] vs header [' + headerRegions.join(', ') + ']')

/* 6 ─ manifest + patch ----------------------------------------------------- */
check('package.json declares dsh.client.platform = web', Boolean(pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === 'web'))
check('package.json exports ./client', Boolean(pkg.exports && pkg.exports['./client']))
check('package.json declares dsh.bundle.patch', Boolean(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch))
check('package.json is ESM', pkg.type === 'module')
check('package.json engines constraint present', Boolean(pkg.dsh && pkg.dsh.engines && pkg.dsh.engines.dsh))

const patch = read('cordis.patch.yml')
const insertNames = [...patch.matchAll(/^\s+name: (.+)$/gm)].map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''))
check('patch inserts exactly one row', insertNames.length === 1, 'found ' + JSON.stringify(insertNames))
check('patch row mounts this package', insertNames.length === 1 && insertNames[0] === pkg.name)

/* 7 ─ test hook ------------------------------------------------------------ */
check('test hook is guarded', /window\.__DSH_SIDEBAR_TAGS_TEST__ === true/.test(client))

/* 8 ─ every other script parses -------------------------------------------
 * A JSDoc comment closed one character too early in a helper script is a
 * five-second fix and a fifteen-minute CI round trip when it is only caught on
 * the runner, so every `.mjs` in the repository is parsed here.
 */
const SCRIPT_GLOBS = ['scripts', 'tests', 'tools']
for (const directory of SCRIPT_GLOBS) {
	let entries = []
	try {
		entries = readdirSync(join(root, directory))
	} catch {
		continue
	}
	for (const entry of entries) {
		if (!entry.endsWith('.mjs')) continue
		const relative = directory + '/' + entry
		const parsed = spawnSync(process.execPath, ['--check', join(root, relative)], { stdio: 'ignore' })
		check('parses: ' + relative, parsed.status === 0, 'node --check rejected it')
	}
}

/* report ------------------------------------------------------------------- */
const verbose = process.argv.includes('--verbose')
if (verbose) for (const line of notes) console.log(line)
console.log('checked ' + (notes.length + failures.length) + ' invariants, ' + failures.length + ' failed')
for (const line of failures) console.error(line)
process.exit(failures.length === 0 ? 0 : 1)
