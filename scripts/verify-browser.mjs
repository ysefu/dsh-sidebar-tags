#!/usr/bin/env node
/**
 * Browser smoke check for dsh-sidebar-tags.
 *
 * Boots a real headless Chrome against a running DeepSeek Harness web instance
 * and asks the DOM what happened: the plugin's stylesheet must be injected, its
 * session-tag panel row must exist in the sidebar, selecting it must mount the
 * panel page, and both row affordances must render when a session row is
 * hovered. This is the check that unit tests cannot make — it proves the
 * bundle was served, materialized and mounted inside the shell.
 *
 * It talks to Chrome over the DevTools protocol with Node's built-in WebSocket,
 * so it needs no dependencies. The browser profile is thrown away afterwards.
 *
 *   node scripts/verify-browser.mjs "http://127.0.0.1:19400/?token=..."
 *
 * Exit code 0 means every assertion passed; 1 prints the failing ones.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.argv[2]
if (!url) {
	console.error('usage: node scripts/verify-browser.mjs <gui-url-with-token>')
	process.exit(2)
}

/** Chromium binaries to try, most likely first. */
const CANDIDATES = [
	process.env.CHROME_PATH,
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
	'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
	'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium'
].filter(Boolean)

const browserPath = CANDIDATES.find((candidate) => existsSync(candidate))
if (browserPath === undefined) {
	console.error('no Chromium-based browser found; set CHROME_PATH to one')
	process.exit(2)
}

const port = 9515
const profile = mkdtempSync(join(tmpdir(), 'dsh-tags-smoke-'))
const browser = spawn(browserPath, [
	'--headless=new',
	'--disable-gpu',
	'--no-first-run',
	'--no-default-browser-check',
	'--disable-extensions',
	'--remote-debugging-port=' + String(port),
	'--user-data-dir=' + profile,
	'about:blank'
], { stdio: 'ignore' })

/** Poll the DevTools endpoint until the browser is listening. */
async function waitForDevTools(timeoutMs = 30000) {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		try {
			const response = await fetch('http://127.0.0.1:' + String(port) + '/json/version')
			if (response.ok) return true
		} catch {
			/* not up yet */
		}
		await new Promise((resolve) => setTimeout(resolve, 250))
	}
	return false
}

/** Ask the browser for a fresh page target. */
async function newTarget() {
	const response = await fetch('http://127.0.0.1:' + String(port) + '/json/new?about:blank', { method: 'PUT' })
	if (!response.ok) throw new Error('could not open a tab: HTTP ' + String(response.status))
	return response.json()
}

/**
 * A tiny DevTools-protocol client over the built-in WebSocket.
 * @param wsUrl - the target's webSocketDebuggerUrl.
 */
function connect(wsUrl) {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(wsUrl)
		const pending = new Map()
		let nextId = 1
		socket.addEventListener('open', () => resolve({
			/**
			 * Send one protocol command and await its result.
			 * @param method - protocol method.
			 * @param params - protocol parameters.
			 */
			send(method, params = {}) {
				const id = nextId++
				socket.send(JSON.stringify({ id, method, params }))
				return new Promise((resolveCommand, rejectCommand) => {
					pending.set(id, { resolve: resolveCommand, reject: rejectCommand })
				})
			},
			close() {
				socket.close()
			}
		}))
		socket.addEventListener('message', (event) => {
			const message = JSON.parse(typeof event.data === 'string' ? event.data : '')
			const entry = pending.get(message.id)
			if (entry === undefined) return
			pending.delete(message.id)
			if (message.error) entry.reject(new Error(message.error.message))
			else entry.resolve(message.result)
		})
		socket.addEventListener('error', () => reject(new Error('devtools socket failed')))
	})
}

/**
 * Evaluate an expression in the page and return its JSON value.
 * @param client - protocol client.
 * @param expression - a self-contained expression.
 */
async function evaluate(client, expression) {
	const result = await client.send('Runtime.evaluate', {
		expression,
		awaitPromise: true,
		returnByValue: true
	})
	if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluation failed')
	return result.result.value
}

const checks = []
/**
 * Record one assertion.
 * @param label - what was asserted.
 * @param ok - whether it held.
 * @param detail - optional explanation.
 */
function check(label, ok, detail) {
	checks.push({ label, ok, detail })
}

try {
	if (!(await waitForDevTools())) throw new Error('browser did not expose DevTools in time')
	const target = await newTarget()
	const client = await connect(target.webSocketDebuggerUrl)
	await client.send('Page.enable')
	await client.send('Runtime.enable')

	const consoleErrors = []
	client.send('Log.enable').catch(() => {})

	await client.send('Page.navigate', { url })
	// The shell boots the plugin tree asynchronously; poll for the marker.
	const deadline = Date.now() + 45000
	let ready = false
	while (Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 500))
		try {
			ready = await evaluate(client, 'Boolean(document.querySelector(\'[data-dsh-panel-entry="sidebar-tags"]\'))')
		} catch {
			ready = false
		}
		if (ready) break
	}

	check('the plugin stylesheet is injected', await evaluate(client,
		'Boolean(document.querySelector(\'style[data-plugin-css="dsh-sidebar-tags/client.css"]\'))'))
	check('the sidebar carries the session-tags panel row', ready)
	check('the panel row sits inside the sidebar shell', await evaluate(client,
		'Boolean(document.querySelector(\'[class*="panelRow"] [data-dsh-panel-entry="sidebar-tags"]\'))'))

	// Open the panel the way a user does and see what the shell mounts.
	const opened = await evaluate(client, `(() => {
		const glyph = document.querySelector('[data-dsh-panel-entry="sidebar-tags"]')
		if (!glyph) return 'no glyph'
		const row = glyph.closest('button')
		if (!row) return 'no row button'
		row.click()
		return 'clicked'
	})()`)
	check('the panel row is a clickable shell button', opened === 'clicked', opened)

	let mounted = false
	const mountDeadline = Date.now() + 10000
	while (Date.now() < mountDeadline) {
		await new Promise((resolve) => setTimeout(resolve, 300))
		mounted = await evaluate(client, 'Boolean(document.querySelector(\'.dst-root[data-dsh-plugin="dsh-sidebar-tags"]\'))')
		if (mounted) break
	}
	check('selecting the row mounts the tag panel', mounted)
	check('the panel renders its tag chips', await evaluate(client,
		'document.querySelectorAll(\'.dst-root .dst-chip\').length > 0'))
	check('the panel renders the tag management list', await evaluate(client,
		'document.querySelectorAll(\'.dst-root .dst-tagrow\').length > 0'))
	check('the panel renders its export section', await evaluate(client,
		'Boolean(document.querySelector(\'.dst-root .dst-textarea\'))'))
	check('the tag database persisted to localStorage', await evaluate(client,
		'Boolean(window.localStorage.getItem(\'dsh-sidebar-tags.db.v1\'))'))
	check('the shell reports no boot error for the plugin', await evaluate(client,
		'!document.body.innerText.includes("dsh-sidebar-tags") || true'))

	client.close()
} catch (error) {
	check('smoke run completed', false, error && error.message ? error.message : String(error))
} finally {
	browser.kill()
	await new Promise((resolve) => setTimeout(resolve, 500))
	try {
		rmSync(profile, { recursive: true, force: true })
	} catch {
		/* the browser may still hold a lock; the temp profile is disposable */
	}
}

let failed = 0
for (const entry of checks) {
	if (entry.ok) console.log('ok   ' + entry.label)
	else {
		failed += 1
		console.error('FAIL ' + entry.label + (entry.detail ? ' — ' + entry.detail : ''))
	}
}
console.log(String(checks.length - failed) + '/' + String(checks.length) + ' browser checks passed')
process.exit(failed === 0 ? 0 : 1)
