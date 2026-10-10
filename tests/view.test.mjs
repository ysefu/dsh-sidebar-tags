/**
 * View layer: how a session-list snapshot, the live status map and the tag
 * database become the panel's rows, counts and filtered list.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadBundle } from './_harness.mjs'

/** The pure projection helpers, exposed by the bundle's test hook. */
function api() {
	return loadBundle().plugin.__test
}

/** A session-list snapshot shaped like the Host's projection. */
function listOf(rows) {
	const byId = {}
	for (const row of rows) byId[row.id] = row
	return { ids: rows.map((row) => row.id), byId }
}

const LIST = listOf([
	{ id: 's-new', title: 'Newest', updatedAt: 300 },
	{ id: 's-mid', title: 'Middle', updatedAt: 200, running: true },
	{ id: 's-old', title: 'Oldest', updatedAt: 100 },
	{ id: 's-blank', title: '', updatedAt: 400, blank: true },
	{ id: 's-untitled', title: '', updatedAt: 50 }
])

const SESSIONS = {
	's-mid': { tags: ['doing'], note: '', title: 'Middle', updatedAt: 1 },
	's-old': { tags: ['important', 'reference'], note: 'ship it', title: 'Oldest', updatedAt: 2 }
}

test('rows drop the provisional blank session and sort newest first', () => {
	const { deriveRows } = api()
	const rows = deriveRows(LIST, new Map(), SESSIONS, new Set())
	assert.deepEqual(rows.map((row) => row.id), ['s-new', 's-mid', 's-old', 's-untitled'])
	assert.equal(rows.find((row) => row.id === 's-mid').tags[0], 'doing')
	assert.equal(rows.find((row) => row.id === 's-old').note, 'ship it')
})

test('live status wins over the summary flag', () => {
	const { deriveRows } = api()
	const statuses = new Map([
		['s-mid', { running: false, pendingInteraction: { kind: 'approval' }, completionUnread: true }],
		['s-old', { running: true }]
	])
	const rows = deriveRows(LIST, statuses, SESSIONS, new Set())
	const mid = rows.find((row) => row.id === 's-mid')
	assert.equal(mid.running, false)
	assert.equal(mid.pending, true)
	assert.equal(rows.find((row) => row.id === 's-old').running, true)
})

test('archived ids are marked, and missing pieces never throw', () => {
	const { deriveRows } = api()
	const rows = deriveRows(LIST, undefined, undefined, new Set(['s-old']))
	assert.equal(rows.find((row) => row.id === 's-old').archived, true)
	assert.equal(rows.find((row) => row.id === 's-new').archived, false)
	assert.deepEqual(deriveRows(undefined, undefined, undefined, undefined), [])
	assert.deepEqual(deriveRows({ ids: [], byId: {} }, null, null, null), [])
})

test('an untitled session falls back to its display title, then to the id', () => {
	const { deriveRows } = api()
	const list = listOf([
		{ id: 'a', displayTitle: 'From displayTitle', updatedAt: 2 },
		{ id: 'b', updatedAt: 1 }
	])
	const rows = deriveRows(list, new Map(), {}, new Set())
	assert.equal(rows.find((row) => row.id === 'a').title, 'From displayTitle')
	assert.equal(rows.find((row) => row.id === 'b').title, '')
})

test('counts and filters cover all, one tag, and untagged', () => {
	const { deriveRows, countByTag, filterRows } = api()
	const rows = deriveRows(LIST, new Map(), SESSIONS, new Set())
	const counts = countByTag(rows)
	assert.equal(counts.get('important'), 1)
	assert.equal(counts.get('doing'), 1)
	assert.equal(counts.get('idea'), undefined)

	assert.equal(filterRows(rows, 'all', '').length, 4)
	assert.deepEqual(filterRows(rows, 'important', '').map((row) => row.id), ['s-old'])
	assert.deepEqual(filterRows(rows, 'untagged', '').map((row) => row.id), ['s-new', 's-untitled'])
})

test('the query is case-insensitive and searches notes too', () => {
	const { deriveRows, filterRows } = api()
	const rows = deriveRows(LIST, new Map(), SESSIONS, new Set())
	assert.deepEqual(filterRows(rows, 'all', 'MID').map((row) => row.id), ['s-mid'])
	assert.deepEqual(filterRows(rows, 'all', 'ship').map((row) => row.id), ['s-old'])
	assert.deepEqual(filterRows(rows, 'important', 'newest'), [])
	assert.equal(filterRows(rows, 'all', '   ').length, 4)
})

test('a tag with no sessions filters to an empty list, not an error', () => {
	const { deriveRows, filterRows } = api()
	const rows = deriveRows(LIST, new Map(), SESSIONS, new Set())
	assert.deepEqual(filterRows(rows, 'idea', ''), [])
	assert.deepEqual(filterRows(rows, 'ghost-tag', ''), [])
})

test('labels follow the document language', () => {
	const english = loadBundle({ lang: 'en' }).plugin.__test
	const tag = { id: 'x', zh: '\u5f85\u529e', en: 'To do' }
	assert.equal(english.isZh(), false)
	assert.equal(english.tagLabel(tag), 'To do')
	assert.equal(english.t('panelLabel'), 'Session tags')
	assert.equal(english.t('sessionCount', { count: 3 }), '3 sessions')
	assert.equal(english.t('missing.key'), 'missing.key')

	const chinese = loadBundle({ lang: 'zh-CN' }).plugin.__test
	assert.equal(chinese.isZh(), true)
	assert.equal(chinese.tagLabel(tag), '\u5f85\u529e')
	assert.equal(chinese.t('panelLabel'), '\u4f1a\u8bdd\u6807\u7b7e')
	assert.equal(chinese.t('sessionCount', { count: 3 }), '3 \u4e2a\u4f1a\u8bdd')
})

test('the language probe falls back to the browser language', () => {
	assert.equal(loadBundle({ lang: 'zh' }).plugin.__test.isZh(), true)
	assert.equal(loadBundle({ lang: 'zh-Hant' }).plugin.__test.isZh(), true)
	assert.equal(loadBundle({ lang: 'en-US' }).plugin.__test.isZh(), false)
	assert.equal(loadBundle({ lang: 'de' }).plugin.__test.isZh(), false)
})
