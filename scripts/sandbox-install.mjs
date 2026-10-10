#!/usr/bin/env node
/**
 * Install this checkout into a throwaway DeepSeek Harness profile.
 *
 * The point is isolation: verifying a sidebar plugin by editing the profile you
 * actually work in is a good way to lose a working setup. This script creates
 * (or reuses) a profile under a separate `DSH_HOME`, installs this directory
 * into it with the CLI's own `link:` install path, and prints the URL to boot.
 *
 *   node scripts/sandbox-install.mjs [--home <dir>] [--profile <name>]
 *
 * It never touches the default `DSH_HOME` unless you point `--home` at it.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Read one `--flag value` argument.
 * @param flag - flag name including dashes.
 * @param fallback - value used when the flag is absent.
 * @returns the argument value.
 */
function arg(flag, fallback) {
	const index = process.argv.indexOf(flag)
	return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const home = resolve(arg('--home', join(repo, '.dsh-sandbox')))
const profile = arg('--profile', 'sidebar-tags-dev')
const port = arg('--port', '19400')

const dsh = process.env.DSH_CLI || 'dsh'
mkdirSync(home, { recursive: true })

/** Run the CLI with the sandbox home and echo the command first. */
function run(args, allowFailure = false) {
	console.log('> ' + dsh + ' ' + args.join(' '))
	const result = spawnSync(dsh, args, {
		stdio: 'inherit',
		shell: process.platform === 'win32',
		env: { ...process.env, DSH_HOME: home }
	})
	if (result.status !== 0 && !allowFailure) process.exit(result.status === null ? 1 : result.status)
	return result.status === 0
}

const profileDir = join(home, 'profiles', profile)
if (!existsSync(profileDir)) {
	console.log('creating profile "' + profile + '" in ' + home + ' from the shipped web template')
	run(['--profile', profile, '--from-default-profile', 'web', '--dump-config'])
}

// pnpm reaches the registry for nothing here: the plugin has no dependencies,
// and the profile already installed its own.
if (!run(['plugin', '--profile', profile, 'add', '--offline', repo], true)) {
	console.error('\ninstall failed. If the CLI is not on PATH, set DSH_CLI to it, e.g.')
	console.error('  DSH_CLI="D:\\DeepSeekHarness\\resources\\runtime\\cli\\bin\\dsh.cmd" node scripts/sandbox-install.mjs')
	process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
const bundles = manifest.dsh && manifest.dsh.profile ? manifest.dsh.profile.bundles : []
console.log('\nprofile bundles: ' + bundles.join(', '))
if (!bundles.includes('dsh-sidebar-tags')) {
	console.error('the profile does not list dsh-sidebar-tags; the install did not take')
	process.exit(1)
}

console.log('\nnext:')
console.log('  DSH_HOME=' + home + ' ' + dsh + ' --profile ' + profile + ' --port ' + port + ' --no-open')
console.log('  then open the printed http://127.0.0.1:' + port + '/?token=… URL')
console.log('  and clean up with: rm -rf ' + home)
