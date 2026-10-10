/**
 * Bundle contract: the plugin registers the right slots with the right ids,
 * orders, locale namespaces and injected faces, and stays dormant for seats the
 * shell has not declared.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fakeContext, fakeStore, loadBundle } from './_harness.mjs'

/** The seats this plugin contributes to, in registration order. */
const EXPECTED = [
	{ seat: 'sidebar.panellist', id: 'sidebar-tags', order: 30 },
	{ seat: 'main', id: undefined, order: undefined, key: 'sidebar-tags' },
	{ seat: 'sidebar.session.row.leading', id: 'sidebar-tags.badge', order: 50 },
	{ seat: 'sidebar.session.row.hover', id: 'sidebar-tags.hover', order: 50 },
	{ seat: 'sidebar.workspaces.session.menu.item', id: 'sidebar-tags.menu', order: 450 },
	{ seat: 'sidebar.workspaces.session.row.action', id: 'sidebar-tags.action', order: 300 }
]

/** Build a context with every service the plugin injects. */
function serviceContext() {
	return fakeContext({
		declared: EXPECTED.map((entry) => entry.seat),
		services: {
			sessions: { list: fakeStore({ ids: [], byId: {} }) },
			uiSession: { sessionStatus: fakeStore(new Map()) },
			workspaces: { list: fakeStore({ items: [], archivedSessionIds: [], pinnedSessionIds: [] }) },
			uiWorkspace: { openSession() {} },
			locale: { register: () => () => {} }
		}
	})
}

test('the bundle registers itself under the plugin id', () => {
	const { id, plugin } = loadBundle()
	assert.equal(id, 'dsh-sidebar-tags')
	assert.equal(plugin.name, 'dsh-sidebar-tags')
	assert.equal(typeof plugin.apply, 'function')
	assert.deepEqual(plugin.inject, ['slots', 'sessions', 'workspaces', 'uiSession', 'uiWorkspace', 'locale'])
})

test('every seat is contributed with its documented identity', () => {
	const { plugin } = loadBundle()
	const ctx = serviceContext()
	plugin.apply(ctx)
	assert.equal(ctx.registered.length, EXPECTED.length)
	for (const [index, expected] of EXPECTED.entries()) {
		const entry = ctx.registered[index]
		assert.equal(entry.seat, expected.seat, 'seat #' + index)
		assert.equal(entry.options.name, expected.seat)
		if (expected.id !== undefined) assert.equal(entry.options.id, expected.id)
		if (expected.order !== undefined) assert.equal(entry.options.order, expected.order)
		if (expected.key !== undefined) assert.equal(entry.options.key, expected.key)
		assert.equal(typeof entry.component, 'function', 'component for ' + expected.seat)
	}
})

test('the panel label resolves lazily, so it follows the language', () => {
	const { plugin } = loadBundle({ lang: 'en' })
	const ctx = serviceContext()
	plugin.apply(ctx)
	const row = ctx.registered.find((entry) => entry.seat === 'sidebar.panellist')
	assert.equal(typeof row.options.label, 'function')
	assert.equal(row.options.label(), 'Session tags')
})

test('nothing is contributed to a seat the shell has not declared', () => {
	const { plugin } = loadBundle()
	const ctx = fakeContext({
		declared: [],
		services: {
			sessions: { list: fakeStore({ ids: [], byId: {} }) },
			uiSession: { sessionStatus: fakeStore(new Map()) },
			workspaces: { list: fakeStore({ items: [] }) },
			uiWorkspace: {},
			locale: { register: () => () => {} }
		}
	})
	plugin.apply(ctx)
	assert.equal(ctx.registered.length, 0)
	assert.deepEqual(ctx.pendingSeats().sort(), [...new Set(EXPECTED.map((entry) => entry.seat))].sort())

	ctx.declare('sidebar.panellist')
	assert.equal(ctx.registered.length, 1)
	assert.equal(ctx.registered[0].seat, 'sidebar.panellist')
})

test('a missing service degrades to no data instead of throwing', () => {
	const { plugin } = loadBundle()
	const ctx = fakeContext({ declared: EXPECTED.map((entry) => entry.seat), services: {} })
	assert.doesNotThrow(() => plugin.apply(ctx))
	assert.equal(ctx.registered.length, EXPECTED.length)
	const panel = ctx.registered.find((entry) => entry.seat === 'main')
	assert.doesNotThrow(() => panel.component({ store: undefined }))
})

test('the stylesheet is injected once and tagged with the plugin id', () => {
	const { plugin, document } = loadBundle()
	const ctx = serviceContext()
	plugin.apply(ctx)
	plugin.apply(serviceContext())
	const styles = document.styles()
	assert.equal(styles.length, 1)
	assert.equal(styles[0].dataset.plugin, 'dsh-sidebar-tags')
	assert.equal(styles[0].dataset.pluginCss, 'dsh-sidebar-tags/client.css')
	assert.match(styles[0].textContent, /\.dst-root\{/)
})
