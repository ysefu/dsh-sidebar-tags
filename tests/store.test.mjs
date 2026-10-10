/**
 * Data layer: the tag database, its persistence contract, and its tolerance for
 * corrupted or hand-edited payloads.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fakeStorage, loadBundle } from './_harness.mjs'

/** The pure data layer, exposed by the bundle's test hook. */
function api() {
	return loadBundle().plugin.__test
}

test('a fresh database carries the builtin tags and nothing else', () => {
	const { emptyDb, BUILTIN_TAGS } = api()
	const db = emptyDb()
	assert.equal(db.version, 1)
	assert.equal(db.tags.length, BUILTIN_TAGS.length)
	assert.deepEqual(db.sessions, {})
	for (const tag of db.tags) {
		assert.equal(tag.builtin, true)
		assert.match(tag.color, /^#[0-9a-f]{6}$/i)
		assert.ok(tag.zh && tag.en, 'both labels exist for ' + tag.id)
	}
})

test('tagging a session creates a record, untagging drops it', () => {
	const { emptyDb, toggleSessionTag } = api()
	let db = emptyDb()
	db = toggleSessionTag(db, 's1', 'todo', { title: 'first session' })
	assert.deepEqual(db.sessions.s1.tags, ['todo'])
	assert.equal(db.sessions.s1.title, 'first session')
	db = toggleSessionTag(db, 's1', 'important', { title: 'first session' })
	assert.deepEqual(db.sessions.s1.tags, ['todo', 'important'])
	db = toggleSessionTag(db, 's1', 'todo', { title: 'first session' })
	assert.deepEqual(db.sessions.s1.tags, ['important'])
	db = toggleSessionTag(db, 's1', 'important', { title: 'first session' })
	assert.equal(db.sessions.s1, undefined)
})

test('an unknown tag id is refused rather than stored', () => {
	const { emptyDb, setSessionTags } = api()
	const db = setSessionTags(emptyDb(), 's1', ['todo', 'nope'], { title: 'x' })
	assert.deepEqual(db.sessions.s1.tags, ['todo'])
})

test('a session with a note survives losing its last tag', () => {
	const { emptyDb, setSessionTags, toggleSessionTag } = api()
	let db = setSessionTags(emptyDb(), 's1', ['todo'], { title: 'x' })
	db = { ...db, sessions: { ...db.sessions, s1: { ...db.sessions.s1, note: 'keep me' } } }
	db = toggleSessionTag(db, 's1', 'todo', { title: 'x' })
	assert.deepEqual(db.sessions.s1.tags, [])
	assert.equal(db.sessions.s1.note, 'keep me')
})

test('creating a tag appends it after the builtins with a distinct id', () => {
	const { emptyDb, addTag } = api()
	const db = addTag(emptyDb(), '  Client work  ', '#123456')
	assert.equal(db.tags.length, 7)
	const created = db.tags[db.tags.length - 1]
	assert.equal(created.zh, 'Client work')
	assert.equal(created.en, 'Client work')
	assert.equal(created.color, '#123456')
	assert.equal(created.builtin, false)
	assert.ok(db.tags.every((tag, index, all) => all.findIndex((other) => other.id === tag.id) === index), 'ids are unique')
})

test('a blank name creates nothing', () => {
	const { emptyDb, addTag } = api()
	const db = emptyDb()
	assert.equal(addTag(db, '   ', '#123456'), db)
	assert.equal(addTag(db, '', '#123456'), db)
})

test('an unusable colour falls back instead of reaching the DOM', () => {
	const { emptyDb, addTag, safeColor } = api()
	assert.equal(safeColor('red'), '#64748b')
	assert.equal(safeColor('javascript:alert(1)'), '#64748b')
	assert.equal(safeColor('#abc'), '#abc')
	assert.equal(addTag(emptyDb(), 'x', 'expression(alert(1))').tags.slice(-1)[0].color, '#64748b')
})

test('renaming and recolouring keep the id and the assignments', () => {
	const { emptyDb, updateTag, toggleSessionTag } = api()
	let db = toggleSessionTag(emptyDb(), 's1', 'idea', { title: 'x' })
	db = updateTag(db, 'idea', { name: 'Backlog', color: '#010203' })
	const tag = db.tags.find((candidate) => candidate.id === 'idea')
	assert.equal(tag.zh, 'Backlog')
	assert.equal(tag.en, 'Backlog')
	assert.equal(tag.color, '#010203')
	assert.deepEqual(db.sessions.s1.tags, ['idea'])
})

test('deleting a tag removes its assignments everywhere', () => {
	const { emptyDb, toggleSessionTag, removeTag } = api()
	let db = toggleSessionTag(emptyDb(), 's1', 'todo', { title: 'a' })
	db = toggleSessionTag(db, 's1', 'idea', { title: 'a' })
	db = toggleSessionTag(db, 's2', 'todo', { title: 'b' })
	db = removeTag(db, 'todo')
	assert.equal(db.tags.some((tag) => tag.id === 'todo'), false)
	assert.deepEqual(db.sessions.s1.tags, ['idea'])
	assert.equal(db.sessions.s2, undefined)
})

test('pruning drops records for sessions the host no longer lists', () => {
	const { emptyDb, toggleSessionTag, pruneSessions } = api()
	let db = toggleSessionTag(emptyDb(), 'alive', 'todo', { title: 'a' })
	db = toggleSessionTag(db, 'dead', 'todo', { title: 'b' })
	const pruned = pruneSessions(db, new Set(['alive']))
	assert.deepEqual(Object.keys(pruned.sessions), ['alive'])
	assert.equal(pruneSessions(pruned, new Set(['alive', 'dead'])), pruned, 'no change returns the same object')
})

test('remembered titles refresh only for live rows', () => {
	const { emptyDb, toggleSessionTag, rememberTitles } = api()
	let db = toggleSessionTag(emptyDb(), 's1', 'todo', { title: 'old' })
	db = toggleSessionTag(db, 's2', 'todo', { title: 'third' })
	const next = rememberTitles(db, [{ id: 's1', title: 'new' }, { id: 's3', title: 'unrelated' }])
	assert.equal(next.sessions.s1.title, 'new')
	assert.equal(next.sessions.s2.title, 'third')
	assert.equal(next.sessions.s3, undefined)
})

test('validation repairs a corrupted payload instead of throwing', () => {
	const { validateDb } = api()
	const cases = [
		undefined,
		null,
		42,
		'not an object',
		{},
		{ version: 1, tags: 'nope', sessions: 7 },
		{ version: 1, tags: [null, { id: '' }, { id: 'a' }, { id: 'a' }], sessions: { s: { tags: ['a', 'ghost'] } } },
		{ version: 1, tags: [{ id: 'a', zh: 'x'.repeat(999) }], sessions: { s: { tags: ['a'], note: 'n'.repeat(999) } } }
	]
	for (const raw of cases) {
		const db = validateDb(raw)
		assert.equal(db.version, 1)
		assert.ok(Array.isArray(db.tags) && db.tags.length > 0, 'tags stay usable for ' + JSON.stringify(raw))
		assert.equal(typeof db.sessions, 'object')
		for (const tag of db.tags) assert.ok(tag.zh.length <= 24 && tag.en.length <= 24)
		for (const session of Object.values(db.sessions)) {
			assert.ok(session.note.length <= 500)
			assert.ok(session.tags.every((id) => db.tags.some((tag) => tag.id === id)), 'no dangling references')
		}
	}
})

test('storage round-trips through localStorage', () => {
	const { emptyDb, toggleSessionTag, saveDb, loadDb } = api()
	const storage = fakeStorage()
	const db = toggleSessionTag(emptyDb(), 's1', 'todo', { title: 'hello' })
	assert.equal(saveDb(db, storage), true)
	const restored = loadDb(storage)
	assert.deepEqual(restored.sessions.s1.tags, ['todo'])
	assert.equal(restored.sessions.s1.title, 'hello')
	assert.equal(restored.tags.length, db.tags.length)
})

test('an unparseable payload is preserved, not dropped', () => {
	const { loadDb, STORAGE_KEY } = api()
	const storage = fakeStorage('{ this is not json')
	const db = loadDb(storage)
	assert.equal(db.tags.length, 6, 'a fresh database is returned')
	assert.equal(storage.raw(STORAGE_KEY + '.unreadable'), '{ this is not json')
})

test('a payload from a newer plugin version is left alone', () => {
	const { loadDb, STORAGE_KEY } = api()
	const future = JSON.stringify({ version: 99, tags: [{ id: 'x' }], sessions: {} })
	const storage = fakeStorage(future)
	const db = loadDb(storage)
	assert.equal(db.tags.length, 6)
	assert.equal(storage.raw(STORAGE_KEY), future, 'the newer payload is untouched')
})

test('a blocked storage layer degrades to memory-only', () => {
	const { createTagsStore, loadDb } = api()
	assert.equal(loadDb(null).tags.length, 6)
	const store = createTagsStore({ storage: null, debounceMs: 0 })
	const created = store.actions.createTag('Offline', '#123456')
	assert.equal(created.zh, 'Offline')
	assert.equal(store.getSnapshot().tags.length, 7)
	assert.equal(store.actions.importDb('{ broken'), false)
	assert.equal(store.actions.importDb(JSON.stringify(store.getSnapshot())), true)
})

test('the controller notifies subscribers and debounces writes', async () => {
	const { createTagsStore, emptyDb } = api()
	const storage = fakeStorage()
	const store = createTagsStore({ storage, debounceMs: 5, initial: emptyDb() })
	let notifications = 0
	const unsubscribe = store.subscribe(() => { notifications += 1 })
	store.actions.toggleTag('s1', 'todo', { title: 't' })
	store.actions.toggleTag('s1', 'idea', { title: 't' })
	assert.equal(notifications, 2)
	assert.equal(storage.getItem('dsh-sidebar-tags.db.v1'), null, 'nothing is written before the debounce elapses')
	await new Promise((resolve) => setTimeout(resolve, 20))
	const written = JSON.parse(storage.getItem('dsh-sidebar-tags.db.v1'))
	assert.deepEqual(written.sessions.s1.tags, ['todo', 'idea'])
	unsubscribe()
	store.actions.createTag('later', '#111111')
	assert.equal(notifications, 2, 'unsubscribed listeners are not called')
})

test('export then import restores the same database', () => {
	const { createTagsStore, emptyDb } = api()
	const source = createTagsStore({ storage: null, debounceMs: 0, initial: emptyDb() })
	source.actions.toggleTag('s1', 'important', { title: 'Report' })
	source.actions.createTag('Client A', '#abcdef')
	const exported = JSON.stringify(source.getSnapshot())

	const target = createTagsStore({ storage: null, debounceMs: 0 })
	assert.equal(target.actions.importDb(exported), true)
	const restored = target.getSnapshot()
	assert.deepEqual(restored.sessions.s1.tags, ['important'])
	assert.ok(restored.tags.some((tag) => tag.zh === 'Client A'))
})

test('subscribers see a stable snapshot object between writes', () => {
	const { createTagsStore } = api()
	const store = createTagsStore({ storage: null, debounceMs: 0 })
	const before = store.getSnapshot()
	assert.equal(store.getSnapshot(), before)
	store.actions.toggleTag('s1', 'todo', { title: 't' })
	assert.notEqual(store.getSnapshot(), before)
})
