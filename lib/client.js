/**
 * dsh-sidebar-tags — browser half.
 *
 * Loaded by the DeepSeek Harness web client from this exact file, in the
 * standard client-plugin bundle shape:
 *
 *     window.__ModuleLoader__.load({ id, factory: (require) => exports })
 *
 * The factory registers the plugin and stays lazy: nothing below runs until the
 * client materializes this bundle, and the only module it asks the host for is
 * React (`require('react')`), which every Harness shell already ships.
 *
 * The file is hand-written CommonJS with `@region` module sections and no build
 * step. That is deliberate: the published artifact is the source, so a checkout
 * is installable, reviewable and diffable as-is. `scripts/build.mjs` validates
 * the wrapper, the region index and the syntax instead of transpiling.
 * See "Why no build step" in README.md.
 *
 * Layout:
 *   - constants  plugin identity, panel id, stylesheet
 *   - dom        stylesheet injection
 *   - store      tag data model + localStorage persistence + snapshot controller
 *   - i18n       zh/en copy
 *   - sessions   session-list projection helpers
 *   - ui         panel page, tag management, row badge, row pickers
 *   - plugin     slot registrations and the Cordis `apply`
 */

window.__ModuleLoader__.load({
	id: 'dsh-sidebar-tags',
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

		let React = require('react')

		/* ==================================================================== *
		 * @region constants
		 * ==================================================================== */

		/** Plugin id: bundle identity, CSS tag and the loader row name. */
		const PLUGIN_ID = 'dsh-sidebar-tags'

		/** Panel id shared by the sidebar row and the keyed `main` page. */
		const PANEL_ID = 'sidebar-tags'

		/** Stylesheet text injected once per document. */
		const CSS = [
			'.dst-root{--dst-gap:10px;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--dst-gap);height:100%;min-height:0;padding:20px 24px 28px;color:var(--dsw-alias-label-primary);overflow-y:auto}',
			'.dst-root *{box-sizing:border-box}',
			'.dst-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}',
			'.dst-title{margin:0;font-size:18px;font-weight:600;line-height:24px}',
			'.dst-subtitle{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
			'.dst-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
			'.dst-ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
			'.dst-input{box-sizing:border-box;width:100%;height:32px;padding:0 10px;font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);outline:none}',
			'.dst-input:focus-visible{border-color:var(--dsw-alias-state-business-primary)}',
			'.dst-search{max-width:260px}',
			'.dst-textarea{box-sizing:border-box;width:100%;padding:8px 10px;font-family:var(--ds-font-family-code);font-size:12px;line-height:17px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);resize:vertical;outline:none}',
			'.dst-btn{box-sizing:border-box;height:30px;padding:0 12px;font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-elevated-fill);border:1px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);cursor:pointer}',
			'.dst-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
			'.dst-btn-primary{color:var(--dsw-alias-label-primary-inverted);background:var(--dsw-alias-label-primary);border-color:transparent}',
			'.dst-btn-danger{color:var(--dsw-alias-state-error-primary,#e5484d);border-color:var(--dsw-alias-state-error-primary,#e5484d);background:0 0}',
			'.dst-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
			'.dst-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
			'.dst-chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l3);border-radius:999px;cursor:pointer}',
			'.dst-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}',
			'.dst-chip.is-on{border-color:var(--dsw-alias-state-business-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}',
			'.dst-chip-sm{height:24px;padding:0 8px}',
			'.dst-chip-label{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.dst-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}',
			'.dst-count{font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}',
			'.dst-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:40px 0;color:var(--dsw-alias-label-tertiary);font-size:13px}',
			'.dst-list{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none;min-height:0}',
			'.dst-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--dsw-radius-md)}',
			'.dst-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
			'.dst-item.is-archived{opacity:.6}',
			'.dst-item-open{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;padding:0;font:inherit;text-align:left;color:inherit;background:0 0;border:none;cursor:pointer}',
			'.dst-item-head{display:flex;align-items:center;gap:6px;min-width:0}',
			'.dst-item-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}',
			'.dst-item-note{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
			'.dst-flag{font-size:11px;line-height:1}',
			'.dst-flag-run{color:var(--dsw-alias-state-business-primary)}',
			'.dst-flag-wait{color:var(--dsw-alias-state-warning-primary,#f5a524)}',
			'.dst-item-actions{display:flex;align-items:center;gap:4px;flex:none}',
			'.dst-mini{width:16px;height:16px;padding:0;border-radius:50%;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l3);cursor:pointer}',
			'.dst-mini.is-on{border-color:transparent}',
			'.dst-section{display:flex;flex-direction:column;gap:8px;margin-top:8px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l3)}',
			'.dst-h3{margin:0;font-size:13px;font-weight:600;line-height:20px}',
			'.dst-creator{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
			'.dst-colors{display:flex;align-items:center;gap:4px}',
			'.dst-color{width:18px;height:18px;padding:0;border:1px solid var(--dsw-alias-border-l3);border-radius:50%;cursor:pointer}',
			'.dst-color.is-on{box-shadow:0 0 0 2px var(--dsw-alias-label-primary)}',
			'.dst-taglist{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}',
			'.dst-tagrow{display:flex;flex-direction:column;gap:6px;padding:6px 8px;border-radius:var(--dsw-radius-md)}',
			'.dst-tagrow:hover{background:var(--dsw-alias-interactive-bg-hover)}',
			'.dst-tagrow-main{display:flex;align-items:center;gap:8px;width:100%;padding:0;font:inherit;font-size:13px;text-align:left;color:inherit;background:0 0;border:none;cursor:pointer}',
			'.dst-tagrow-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.dst-tagrow-edit{display:flex;flex-direction:column;gap:8px;padding:8px 0 2px}',
			'.dst-badge{display:inline-flex;align-items:center;gap:2px;flex:none}',
			'.dst-badge-more{font-size:9px;line-height:1;color:var(--dsw-alias-label-tertiary)}',
			'.dst-hover{display:flex;flex-direction:column;gap:6px;margin-top:6px}',
			'.dst-hover-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
			'.dst-hover-tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--dsw-alias-label-secondary)}',
			'.dst-hover-note{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}',
			'.dst-menu{display:flex;flex-direction:column;gap:6px;padding:6px 8px 8px;min-width:180px}',
			'.dst-menu-title{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
			'.dst-menu-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
			'.dst-action{position:relative;display:inline-flex;align-items:center}',
			'.dst-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:var(--dsw-radius-sm);cursor:pointer}',
			'.dst-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
			'.dst-pop{position:absolute;bottom:calc(100% + 6px);right:0;z-index:40;display:flex;flex-direction:column;gap:6px;min-width:170px;padding:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);box-shadow:0 8px 24px #0003}',
			'@media (max-width:720px){.dst-root{padding:14px 14px 20px}.dst-search{max-width:none;width:100%}}'
		].join('')

		/* ==================================================================== *
		 * @region dom
		 * ==================================================================== */

		/**
		 * Inject a stylesheet once per document, tagged the way every Harness
		 * client plugin tags its own CSS.
		 * @param id - stable stylesheet identity.
		 * @param css - stylesheet text.
		 * @returns nothing.
		 */
		function injectStyles(id, css) {
			if (typeof document === 'undefined') return
			if (document.querySelector('style[data-plugin-css=' + JSON.stringify(id) + ']') !== null) return
			const tag = document.createElement('style')
			tag.dataset.plugin = PLUGIN_ID
			tag.dataset.pluginCss = id
			tag.textContent = css
			document.head.appendChild(tag)
		}

		/* ==================================================================== *
		 * @region store
		 * ==================================================================== */

		/** localStorage key holding the whole tag database. */
		const STORAGE_KEY = 'dsh-sidebar-tags.db.v1'

		/** Suffix used to preserve an unreadable payload instead of dropping it. */
		const STORAGE_BACKUP_SUFFIX = '.unreadable'

		/** Database schema version written into every payload. */
		const DB_VERSION = 1

		/** Longest accepted note, in characters. */
		const NOTE_MAX = 500

		/** Longest accepted tag name, in characters. */
		const TAG_NAME_MAX = 24

		/**
		 * Tags shipped on a fresh install. Ids are stable and never translated;
		 * names carry both languages so the chips can follow the UI language.
		 */
		const BUILTIN_TAGS = [
			{ id: 'todo', zh: '待办', en: 'To do', color: '#f5a524', order: 10 },
			{ id: 'doing', zh: '进行中', en: 'Doing', color: '#3b82f6', order: 20 },
			{ id: 'important', zh: '重要', en: 'Important', color: '#ef4444', order: 30 },
			{ id: 'reference', zh: '参考', en: 'Reference', color: '#14b8a6', order: 40 },
			{ id: 'archivable', zh: '可归档', en: 'Archivable', color: '#8b5cf6', order: 50 },
			{ id: 'idea', zh: '灵感', en: 'Idea', color: '#eab308', order: 60 }
		]

		/** Palette offered by the tag editor, in pick order. */
		const PALETTE = [
			'#f5a524', '#3b82f6', '#ef4444', '#14b8a6',
			'#8b5cf6', '#eab308', '#ec4899', '#64748b'
		]

		/** Fallback colour for a tag whose stored colour is unusable. */
		const FALLBACK_COLOR = '#64748b'

		/** Accept `#rgb` and `#rrggbb` only; anything else falls back. */
		const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

		/**
		 * Normalize a stored colour, falling back when it is not a hex colour.
		 * @param value - candidate colour.
		 * @returns a usable hex colour.
		 */
		function safeColor(value) {
			return typeof value === 'string' && COLOR_RE.test(value) ? value : FALLBACK_COLOR
		}

		/**
		 * Mint a tag id that cannot collide with a builtin id.
		 * @returns a fresh id.
		 */
		function newTagId() {
			return 'tag-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
		}

		/**
		 * Build the database a fresh install starts from.
		 * @returns an empty database carrying the builtin tags.
		 */
		function emptyDb() {
			return {
				version: DB_VERSION,
				tags: BUILTIN_TAGS.map((tag) => ({
					id: tag.id,
					zh: tag.zh,
					en: tag.en,
					color: tag.color,
					order: tag.order,
					builtin: true
				})),
				sessions: {}
			}
		}

		/**
		 * Coerce one stored tag row into a usable tag, or drop it.
		 * @param raw - candidate row.
		 * @returns a tag, or `null` when the row is unusable.
		 */
		function coerceTag(raw) {
			if (!raw || typeof raw !== 'object') return null
			const id = typeof raw.id === 'string' ? raw.id.trim() : ''
			if (id === '') return null
			const zh = typeof raw.zh === 'string' && raw.zh.trim() !== '' ? raw.zh.trim() : id
			const en = typeof raw.en === 'string' && raw.en.trim() !== '' ? raw.en.trim() : zh
			const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 999
			return {
				id,
				zh: zh.slice(0, TAG_NAME_MAX),
				en: en.slice(0, TAG_NAME_MAX),
				color: safeColor(raw.color),
				order,
				builtin: raw.builtin === true
			}
		}

		/**
		 * Coerce one stored session row into a usable record, or drop it.
		 * @param raw - candidate row.
		 * @param knownTagIds - tag ids the row may reference.
		 * @returns a session tag record, or `null` when nothing survives.
		 */
		function coerceSessionRecord(raw, knownTagIds) {
			if (!raw || typeof raw !== 'object') return null
			const tags = Array.isArray(raw.tags)
				? [...new Set(raw.tags.filter((id) => typeof id === 'string' && knownTagIds.has(id)))]
				: []
			const note = typeof raw.note === 'string' && raw.note.trim() !== ''
				? raw.note.trim().slice(0, NOTE_MAX)
				: ''
			const title = typeof raw.title === 'string' ? raw.title : ''
			const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0
			if (tags.length === 0 && note === '') return null
			return { tags, note, title, updatedAt }
		}

		/**
		 * Order tags by their explicit order, then by id, for stable chips.
		 * @param tags - tags to order.
		 * @returns a new ordered array.
		 */
		function sortTags(tags) {
			return [...tags].sort((left, right) => {
				if (left.order !== right.order) return left.order - right.order
				return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
			})
		}

		/**
		 * Validate a raw payload into a database, dropping whatever is unusable.
		 *
		 * A corrupt or hand-edited payload therefore degrades to "fewer tags"
		 * instead of throwing somewhere inside React.
		 * @param raw - parsed payload from storage or an import.
		 * @returns a usable database.
		 */
		function validateDb(raw) {
			if (!raw || typeof raw !== 'object') return emptyDb()
			const tags = []
			const seen = new Set()
			for (const candidate of Array.isArray(raw.tags) ? raw.tags : []) {
				const tag = coerceTag(candidate)
				if (tag === null || seen.has(tag.id)) continue
				seen.add(tag.id)
				tags.push(tag)
			}
			if (tags.length === 0) for (const tag of emptyDb().tags) { seen.add(tag.id); tags.push(tag) }
			const sessions = {}
			const source = raw.sessions && typeof raw.sessions === 'object' ? raw.sessions : {}
			for (const sessionId of Object.keys(source)) {
				const record = coerceSessionRecord(source[sessionId], seen)
				if (record !== null) sessions[sessionId] = record
			}
			return { version: DB_VERSION, tags: sortTags(tags), sessions }
		}

		/**
		 * Resolve localStorage without throwing in hosts that block it.
		 * @returns the storage, or `null` when unavailable.
		 */
		function safeLocalStorage() {
			try {
				if (typeof localStorage === 'undefined') return null
				return localStorage
			} catch {
				return null
			}
		}

		/**
		 * Read the database from storage.
		 *
		 * A payload that cannot be parsed is preserved under a `.unreadable`
		 * sibling key and replaced by a fresh database, so a broken write never
		 * costs the user their data silently.
		 * @param storage - storage to read from (defaults to localStorage).
		 * @returns the database.
		 */
		function loadDb(storage) {
			const target = storage || safeLocalStorage()
			if (target === null) return emptyDb()
			let text = null
			try {
				text = target.getItem(STORAGE_KEY)
			} catch {
				return emptyDb()
			}
			if (text === null || text === '') return emptyDb()
			try {
				const parsed = JSON.parse(text)
				// A newer plugin wrote this payload: keep it intact and start empty
				// here rather than downgrading someone else's data.
				if (parsed && typeof parsed === 'object' && typeof parsed.version === 'number' && parsed.version > DB_VERSION) return emptyDb()
				return validateDb(parsed)
			} catch {
				try {
					target.setItem(STORAGE_KEY + STORAGE_BACKUP_SUFFIX, text)
					target.removeItem(STORAGE_KEY)
				} catch {
					/* storage full or blocked: the fresh database is still usable */
				}
				return emptyDb()
			}
		}

		/**
		 * Persist the database, ignoring quota and privacy-mode failures.
		 * @param db - database to write.
		 * @param storage - storage to write to (defaults to localStorage).
		 * @returns whether the write succeeded.
		 */
		function saveDb(db, storage) {
			const target = storage || safeLocalStorage()
			if (target === null) return false
			try {
				target.setItem(STORAGE_KEY, JSON.stringify(db))
				return true
			} catch {
				return false
			}
		}

		/**
		 * Set the tags of one session, creating or dropping its record as needed.
		 * @param db - database to derive from.
		 * @param sessionId - session to change.
		 * @param tagIds - next tag ids.
		 * @param meta - remembered display title.
		 * @returns a new database.
		 */
		function setSessionTags(db, sessionId, tagIds, meta) {
			const known = new Set(db.tags.map((tag) => tag.id))
			const next = [...new Set(tagIds)].filter((id) => known.has(id))
			const previous = db.sessions[sessionId]
			const note = previous ? previous.note : ''
			const sessions = { ...db.sessions }
			if (next.length === 0 && note === '') delete sessions[sessionId]
			else {
				sessions[sessionId] = {
					tags: next,
					note,
					title: (meta && meta.title) || (previous ? previous.title : ''),
					updatedAt: Date.now()
				}
			}
			return { ...db, sessions }
		}

		/**
		 * Toggle one tag on one session.
		 * @param db - database to derive from.
		 * @param sessionId - session to change.
		 * @param tagId - tag to toggle.
		 * @param meta - remembered display title.
		 * @returns a new database.
		 */
		function toggleSessionTag(db, sessionId, tagId, meta) {
			const previous = db.sessions[sessionId]
			const current = previous ? previous.tags : []
			const next = current.includes(tagId)
				? current.filter((id) => id !== tagId)
				: [...current, tagId]
			return setSessionTags(db, sessionId, next, meta)
		}

		/**
		 * Create a user tag.
		 * @param db - database to derive from.
		 * @param name - user-facing label, used for both languages.
		 * @param color - chosen colour.
		 * @returns a new database.
		 */
		function addTag(db, name, color) {
			const label = String(name === undefined || name === null ? '' : name).trim().slice(0, TAG_NAME_MAX)
			if (label === '') return db
			const order = db.tags.reduce((max, tag) => Math.max(max, tag.order), 0) + 10
			const tag = { id: newTagId(), zh: label, en: label, color: safeColor(color), order, builtin: false }
			return { ...db, tags: sortTags([...db.tags, tag]) }
		}

		/**
		 * Rename or recolour a tag in place, keeping its id and its assignments.
		 * @param db - database to derive from.
		 * @param tagId - tag to change.
		 * @param patch - next name and/or colour.
		 * @returns a new database.
		 */
		function updateTag(db, tagId, patch) {
			const name = patch && patch.name !== undefined ? String(patch.name).trim().slice(0, TAG_NAME_MAX) : undefined
			const color = patch && patch.color !== undefined ? safeColor(patch.color) : undefined
			return {
				...db,
				tags: db.tags.map((tag) => {
					if (tag.id !== tagId) return tag
					const next = { ...tag }
					if (name !== undefined && name !== '') { next.zh = name; next.en = name }
					if (color !== undefined) next.color = color
					return next
				})
			}
		}

		/**
		 * Delete a tag and every assignment of it.
		 * @param db - database to derive from.
		 * @param tagId - tag to delete.
		 * @returns a new database.
		 */
		function removeTag(db, tagId) {
			const sessions = {}
			for (const sessionId of Object.keys(db.sessions)) {
				const record = db.sessions[sessionId]
				const tags = record.tags.filter((id) => id !== tagId)
				if (tags.length === 0 && record.note === '') continue
				sessions[sessionId] = { ...record, tags }
			}
			return { ...db, tags: db.tags.filter((tag) => tag.id !== tagId), sessions }
		}

		/**
		 * Drop records whose session no longer exists in the live catalog.
		 * @param db - database to derive from.
		 * @param aliveIds - session ids the host still knows about.
		 * @returns a new database, or the same one when nothing was stale.
		 */
		function pruneSessions(db, aliveIds) {
			const alive = aliveIds instanceof Set ? aliveIds : new Set(aliveIds || [])
			const sessions = {}
			let changed = false
			for (const sessionId of Object.keys(db.sessions)) {
				if (alive.has(sessionId)) sessions[sessionId] = db.sessions[sessionId]
				else changed = true
			}
			return changed ? { ...db, sessions } : db
		}

		/**
		 * Refresh the remembered titles of tagged sessions that are still live,
		 * so the panel can label history the current session page cannot see.
		 * @param db - database to derive from.
		 * @param rows - live rows carrying `id` and `title`.
		 * @returns a new database, or the same one when nothing changed.
		 */
		function rememberTitles(db, rows) {
			let changed = false
			const sessions = { ...db.sessions }
			for (const row of rows || []) {
				const record = sessions[row.id]
				if (record === undefined) continue
				const title = typeof row.title === 'string' ? row.title : ''
				if (title === '' || record.title === title) continue
				sessions[row.id] = { ...record, title }
				changed = true
			}
			return changed ? { ...db, sessions } : db
		}

		/**
		 * Parse an exported payload for import, keeping only valid content.
		 * @param text - JSON text produced by the export action.
		 * @returns the imported database, or `null` when the text is unusable.
		 */
		function parseImport(text) {
			try {
				const parsed = JSON.parse(String(text))
				if (!parsed || typeof parsed !== 'object') return null
				return validateDb(parsed)
			} catch {
				return null
			}
		}

		/**
		 * Build the snapshot store the UI subscribes to.
		 *
		 * Writes are synchronous in memory and debounced on disk, so a tag click
		 * repaints immediately while a burst of edits costs one storage write.
		 * @param options - storage override and debounce window, for tests.
		 * @returns `{ getSnapshot, subscribe, flush, actions }`.
		 */
		function createTagsStore(options) {
			const settings = options || {}
			const storage = settings.storage === undefined ? safeLocalStorage() : settings.storage
			const debounceMs = typeof settings.debounceMs === 'number' ? settings.debounceMs : 150
			let db = settings.initial ? validateDb(settings.initial) : loadDb(storage)
			const listeners = new Set()
			let timer = null
			let dirty = false

			const flush = () => {
				timer = null
				if (!dirty) return
				dirty = false
				saveDb(db, storage)
			}
			const schedule = () => {
				dirty = true
				if (debounceMs <= 0) { flush(); return }
				if (timer !== null) return
				timer = setTimeout(flush, debounceMs)
			}
			const commit = (next) => {
				if (next === db) return
				db = next
				schedule()
				for (const listener of [...listeners]) listener()
			}

			return {
				/**
				 * Read the current database.
				 * @returns the database.
				 */
				getSnapshot() {
					return db
				},
				/**
				 * Subscribe to database changes.
				 * @param listener - called after every committed change.
				 * @returns an unsubscribe function.
				 */
				subscribe(listener) {
					listeners.add(listener)
					return () => { listeners.delete(listener) }
				},
				/** Write the pending database to storage immediately. */
				flush,
				actions: {
					/**
					 * Toggle a tag on a session.
					 * @param sessionId - session to change.
					 * @param tagId - tag to toggle.
					 * @param meta - remembered title for offline rendering.
					 */
					toggleTag(sessionId, tagId, meta) {
						commit(toggleSessionTag(db, sessionId, tagId, meta))
					},
					/**
					 * Create a tag.
					 * @param name - label.
					 * @param color - colour.
					 * @returns the created tag, or `null` when the name was blank.
					 */
					createTag(name, color) {
						const next = addTag(db, name, color)
						if (next === db) return null
						const created = next.tags[next.tags.length - 1]
						commit(next)
						return created
					},
					/**
					 * Rename or recolour a tag.
					 * @param tagId - tag to change.
					 * @param patch - next name and/or colour.
					 */
					updateTag(tagId, patch) {
						commit(updateTag(db, tagId, patch))
					},
					/**
					 * Delete a tag and its assignments.
					 * @param tagId - tag to delete.
					 */
					deleteTag(tagId) {
						commit(removeTag(db, tagId))
					},
					/**
					 * Drop records for sessions the host no longer lists.
					 * @param aliveIds - live session ids.
					 */
					prune(aliveIds) {
						commit(pruneSessions(db, aliveIds))
					},
					/**
					 * Refresh remembered titles from the live session list.
					 * @param rows - live rows carrying `id` and `title`.
					 */
					remember(rows) {
						commit(rememberTitles(db, rows))
					},
					/**
					 * Replace the database from an export payload.
					 * @param text - exported JSON.
					 * @returns whether the payload was accepted.
					 */
					importDb(text) {
						const parsed = parseImport(text)
						if (parsed === null) return false
						commit(parsed)
						return true
					},
					/** Discard every tag and assignment, keeping the builtin tags. */
					reset() {
						commit(emptyDb())
					}
				}
			}
		}

		/* ==================================================================== *
		 * @region i18n
		 * ==================================================================== */

		/** Locale namespace, named after the plugin. */
		const NS = 'dshSidebarTags'

		const ZH = {
			panelLabel: '会话标签',
			panelTitle: '会话标签',
			panelSubtitle: '给会话打标签，按标签找回历史会话',
			searchPlaceholder: '搜索标题或备注',
			filterAll: '全部',
			filterUntagged: '未打标签',
			emptyList: '没有匹配的会话',
			emptyHint: '换个标签，或清空搜索词',
			emptyHistory: '还没有可标记的会话',
			sessionCount: '{count} 个会话',
			addTag: '新建标签',
			addTagPlaceholder: '标签名，回车创建',
			manageTags: '标签管理',
			save: '保存',
			delete: '删除',
			deleteConfirm: '删除标签「{name}」？所有会话上的这个标签都会移除。',
			colorLabel: '颜色',
			moreTags: '+{count}',
			exportTitle: '导出备份',
			exportHint: '复制下面这段 JSON 保存起来，换浏览器时可再导入。',
			copy: '复制',
			copied: '已复制',
			importTitle: '导入备份',
			importHint: '粘贴之前导出的 JSON，导入会覆盖当前标签数据。',
			importConfirm: '导入',
			importFailed: '这段 JSON 读不出来，请检查是否完整。',
			importDone: '已导入',
			resetAll: '清空全部标签数据',
			resetConfirm: '清空所有标签和备注？此操作不可撤销。',
			resetDone: '已清空',
			rowMenuLabel: '打标签…',
			rowActionLabel: '标签',
			storageBroken: '浏览器存储不可用，标签只在本页有效。'
		}

		const EN = {
			panelLabel: 'Session tags',
			panelTitle: 'Session tags',
			panelSubtitle: 'Tag sessions and find them again by tag',
			searchPlaceholder: 'Search title or note',
			filterAll: 'All',
			filterUntagged: 'Untagged',
			emptyList: 'No sessions match',
			emptyHint: 'Pick another tag, or clear the search',
			emptyHistory: 'No taggable sessions yet',
			sessionCount: '{count} sessions',
			addTag: 'New tag',
			addTagPlaceholder: 'Tag name, press Enter',
			manageTags: 'Manage tags',
			save: 'Save',
			delete: 'Delete',
			deleteConfirm: 'Delete the tag "{name}"? It is removed from every session.',
			colorLabel: 'Color',
			moreTags: '+{count}',
			exportTitle: 'Export a backup',
			exportHint: 'Copy this JSON somewhere safe; import it to bring the tags back.',
			copy: 'Copy',
			copied: 'Copied',
			importTitle: 'Import a backup',
			importHint: 'Paste an exported JSON. Importing replaces the current tag data.',
			importConfirm: 'Import',
			importFailed: 'That JSON could not be read; check that it is complete.',
			importDone: 'Imported',
			resetAll: 'Erase all tag data',
			resetConfirm: 'Erase every tag and note? This cannot be undone.',
			resetDone: 'Erased',
			rowMenuLabel: 'Tag this session…',
			rowActionLabel: 'Tags',
			storageBroken: 'Browser storage is unavailable; tags last only for this page.'
		}

		/**
		 * Whether the interface should speak Chinese.
		 * @returns true for a Chinese document or browser language.
		 */
		function isZh() {
			const lang = typeof document !== 'undefined' && document.documentElement ? document.documentElement.lang : ''
			const nav = typeof navigator !== 'undefined' && navigator.language ? navigator.language : ''
			return (String(lang) + String(nav)).toLowerCase().startsWith('zh')
		}

		/**
		 * Translate one key, filling `{placeholders}`.
		 * @param key - dictionary key.
		 * @param params - placeholder values.
		 * @returns the localized string.
		 */
		function t(key, params) {
			const table = isZh() ? ZH : EN
			let text = table[key] !== undefined ? table[key] : (EN[key] !== undefined ? EN[key] : key)
			if (params) for (const name of Object.keys(params)) text = text.split('{' + name + '}').join(String(params[name]))
			return text
		}

		/**
		 * Read a tag's label in the active language.
		 * @param tag - tag to label.
		 * @returns the label.
		 */
		function tagLabel(tag) {
			if (!tag) return ''
			return isZh() ? (tag.zh || tag.en || tag.id) : (tag.en || tag.zh || tag.id)
		}

		/* ==================================================================== *
		 * @region sessions
		 * ==================================================================== */

		/**
		 * Read a snapshot out of a Cordis-store observable.
		 * @param source - candidate observable.
		 * @returns its value, or `undefined`.
		 */
		function readSnapshot(source) {
			if (!source || typeof source !== 'object') return undefined
			try {
				if (typeof source.getSnapshot === 'function') return source.getSnapshot()
			} catch {
				return undefined
			}
			return undefined
		}

		/**
		 * Subscribe a component to one store observable.
		 *
		 * The subscription is installed in an effect and re-read whenever the
		 * source object changes, so a service replaced at runtime (plugin
		 * reload) is picked up without remounting the component.
		 * @param source - the observable to read.
		 * @param selector - projection applied to the snapshot.
		 * @returns the projected value.
		 */
		function useStore(source, selector) {
			const [value, setValue] = React.useState(() => selector(readSnapshot(source)))
			React.useEffect(() => {
				setValue(selector(readSnapshot(source)))
				if (!source || typeof source.subscribe !== 'function') return undefined
				let dispose = null
				try {
					dispose = source.subscribe(() => setValue(selector(readSnapshot(source))))
				} catch {
					dispose = null
				}
				return typeof dispose === 'function' ? dispose : undefined
			}, [source, selector])
			return value
		}

		/**
		 * Derive the panel's row list from the session-list projection.
		 *
		 * Blank rows (the provisional New Session) are skipped: they are not
		 * history the user can come back to.
		 * @param list - `sessions.list` snapshot.
		 * @param statuses - `uiSession.sessionStatus` snapshot.
		 * @param sessions - tag records by session id.
		 * @param archivedIds - ids the workspace layer reports as archived.
		 * @returns rows ordered by most recent update.
		 */
		function deriveRows(list, statuses, sessions, archivedIds) {
			const rows = []
			const byId = list && list.byId ? list.byId : {}
			const ids = list && Array.isArray(list.ids) ? list.ids : Object.keys(byId)
			for (const id of ids) {
				const session = byId[id]
				if (!session || session.blank === true) continue
				const status = statuses && typeof statuses.get === 'function' ? statuses.get(id) : undefined
				const title = typeof session.title === 'string' && session.title !== ''
					? session.title
					: (typeof session.displayTitle === 'string' ? session.displayTitle : '')
				const record = sessions ? sessions[id] : undefined
				rows.push({
					id,
					title,
					note: record ? record.note : '',
					updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : 0,
					running: status ? status.running === true : session.running === true,
					pending: Boolean(status && status.pendingInteraction),
					archived: archivedIds instanceof Set ? archivedIds.has(id) : false,
					tags: record ? record.tags : []
				})
			}
			return rows.sort((left, right) => right.updatedAt - left.updatedAt)
		}

		/**
		 * Count sessions per tag id.
		 * @param rows - derived rows.
		 * @returns a map of tag id → count.
		 */
		function countByTag(rows) {
			const counts = new Map()
			for (const row of rows) for (const tagId of row.tags) counts.set(tagId, (counts.get(tagId) || 0) + 1)
			return counts
		}

		/**
		 * Apply the tag filter and the free-text query.
		 * @param rows - derived rows.
		 * @param filter - `'all'`, `'untagged'`, or a tag id.
		 * @param query - free text matched against title and note.
		 * @returns the matching rows.
		 */
		function filterRows(rows, filter, query) {
			const needle = String(query === undefined || query === null ? '' : query).trim().toLowerCase()
			return rows.filter((row) => {
				if (filter === 'untagged') { if (row.tags.length > 0) return false }
				else if (filter && filter !== 'all') { if (!row.tags.includes(filter)) return false }
				if (needle === '') return true
				return (row.title + ' ' + row.note).toLowerCase().includes(needle)
			})
		}

		/* ==================================================================== *
		 * @region ui
		 * ==================================================================== */

		function h(tag, props, ...children) {
			return React.createElement(tag, props, ...children)
		}

		/**
		 * Subscribe a component to the tag store.
		 * @param store - tags store.
		 * @returns the current database, re-rendering on change.
		 */
		function useTagsDb(store) {
			return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
		}

		/** Colour swatch grid used by the tag editor and the creator row. */
		function ColorPicker(props) {
			return h('div', { className: 'dst-colors', role: 'radiogroup', 'aria-label': t('colorLabel') },
				PALETTE.map((color) => h('button', {
					key: color,
					type: 'button',
					role: 'radio',
					'aria-checked': props.value === color ? 'true' : 'false',
					'aria-label': color,
					className: 'dst-color' + (props.value === color ? ' is-on' : ''),
					style: { background: color },
					onClick: () => props.onChange(color)
				})))
		}

		/** One editable tag row inside the manage section. */
		function TagRow(props) {
			const [name, setName] = React.useState(tagLabel(props.tag))
			const [open, setOpen] = React.useState(false)
			React.useEffect(() => { setName(tagLabel(props.tag)) }, [props.tag.id, props.tag.zh, props.tag.en])
			return h('li', { className: 'dst-tagrow' },
				h('button', {
					type: 'button',
					className: 'dst-tagrow-main',
					title: tagLabel(props.tag),
					'aria-expanded': open ? 'true' : 'false',
					onClick: () => setOpen((value) => !value)
				},
					h('span', { className: 'dst-dot', style: { background: props.tag.color } }),
					h('span', { className: 'dst-tagrow-name' }, tagLabel(props.tag)),
					h('span', { className: 'dst-count' }, String(props.count || 0))
				),
				open && h('div', { className: 'dst-tagrow-edit' },
					h('input', {
						className: 'dst-input',
						value: name,
						maxLength: TAG_NAME_MAX,
						'aria-label': t('manageTags'),
						onChange: (event) => setName(event.target.value),
						onKeyDown: (event) => {
							if (event.key === 'Enter') { props.onRename(name); setOpen(false) }
							if (event.key === 'Escape') { setName(tagLabel(props.tag)); setOpen(false) }
						}
					}),
					h(ColorPicker, { value: props.tag.color, onChange: (color) => props.onColor(color) }),
					h('div', { className: 'dst-row' },
						h('button', {
							type: 'button',
							className: 'dst-btn dst-btn-primary',
							onClick: () => { props.onRename(name); setOpen(false) }
						}, t('save')),
						h('button', {
							type: 'button',
							className: 'dst-btn dst-btn-danger',
							onClick: () => { if (window.confirm(t('deleteConfirm', { name: tagLabel(props.tag) }))) props.onDelete() }
						}, t('delete'))
					)
				)
			)
		}

		/** Backup section: export text, import text, and the destructive reset. */
		function BackupSection(props) {
			const [text, setText] = React.useState('')
			const [status, setStatus] = React.useState('')
			const exportText = React.useMemo(() => JSON.stringify(props.db, null, 2), [props.db])
			const flash = (message) => {
				setStatus(message)
				window.setTimeout(() => setStatus(''), 1800)
			}
			return h('section', { className: 'dst-section' },
				h('h3', { className: 'dst-h3' }, t('exportTitle')),
				h('p', { className: 'dst-hint' }, t('exportHint')),
				h('textarea', { className: 'dst-textarea', readOnly: true, value: exportText, rows: 4, onFocus: (event) => event.target.select() }),
				h('div', { className: 'dst-row' },
					h('button', {
						type: 'button',
						className: 'dst-btn',
						onClick: () => {
							const clipboard = navigator.clipboard
							if (!clipboard || typeof clipboard.writeText !== 'function') return
							clipboard.writeText(exportText).then(() => flash(t('copied')), () => {})
						}
					}, t('copy')),
					status !== '' && h('span', { className: 'dst-ok' }, status)
				),
				h('h3', { className: 'dst-h3' }, t('importTitle')),
				h('p', { className: 'dst-hint' }, t('importHint')),
				h('textarea', {
					className: 'dst-textarea',
					value: text,
					rows: 3,
					placeholder: '{ "version": 1, "tags": [], "sessions": {} }',
					onChange: (event) => setText(event.target.value)
				}),
				h('div', { className: 'dst-row' },
					h('button', {
						type: 'button',
						className: 'dst-btn dst-btn-primary',
						onClick: () => {
							const ok = props.onImport(text)
							flash(ok ? t('importDone') : t('importFailed'))
							if (ok) setText('')
						}
					}, t('importConfirm')),
					h('button', {
						type: 'button',
						className: 'dst-btn dst-btn-danger',
						onClick: () => { if (window.confirm(t('resetConfirm'))) { props.onReset(); flash(t('resetDone')) } }
					}, t('resetAll'))
				)
			)
		}

		/** Tag chips: filter the list, and carry the per-tag session count. */
		function FilterChips(props) {
			const chip = (key, label, color, count) => h('button', {
				key,
				type: 'button',
				className: 'dst-chip' + (props.filter === key ? ' is-on' : ''),
				'aria-pressed': props.filter === key ? 'true' : 'false',
				onClick: () => props.onFilter(key)
			},
				color !== null && h('span', { className: 'dst-dot', style: { background: color } }),
				h('span', { className: 'dst-chip-label' }, label),
				h('span', { className: 'dst-count' }, String(count))
			)
			return h('div', { className: 'dst-chips' },
				chip('all', t('filterAll'), null, props.total),
				props.tags.map((tag) => chip(tag.id, tagLabel(tag), tag.color, props.counts.get(tag.id) || 0)),
				chip('untagged', t('filterUntagged'), null, props.untagged)
			)
		}

		/** The panel page: header, filters, the session list and tag management. */
		function TagPanel(props) {
			const { store, services } = props
			const db = useTagsDb(store)
			const [filter, setFilter] = React.useState('all')
			const [query, setQuery] = React.useState('')
			const [draft, setDraft] = React.useState('')
			const [draftColor, setDraftColor] = React.useState(PALETTE[0])

			const list = useStore(services.sessionList, (snapshot) => snapshot)
			const statuses = useStore(services.sessionStatus, (snapshot) => snapshot)
			const archivedSet = useStore(services.workspaces, React.useCallback(
				(snapshot) => new Set(snapshot && Array.isArray(snapshot.archivedSessionIds) ? snapshot.archivedSessionIds : []),
				[]
			))

			const rows = React.useMemo(
				() => deriveRows(list, statuses, db.sessions, archivedSet),
				[list, statuses, db.sessions, archivedSet]
			)

			React.useEffect(() => {
				if (rows.length === 0) return
				store.actions.prune(new Set(rows.map((row) => row.id)))
				store.actions.remember(rows)
			}, [rows, store])

			const counts = React.useMemo(() => countByTag(rows), [rows])
			const shown = React.useMemo(() => filterRows(rows, filter, query), [rows, filter, query])
			const tagById = React.useMemo(() => new Map(db.tags.map((tag) => [tag.id, tag])), [db.tags])
			const untagged = rows.filter((row) => row.tags.length === 0).length

			return h('div', { className: 'dst-root', 'data-dsh-plugin': PLUGIN_ID },
				h('header', { className: 'dst-header' },
					h('div', null,
						h('h2', { className: 'dst-title' }, t('panelTitle')),
						h('p', { className: 'dst-subtitle' }, t('panelSubtitle') + ' · ' + t('sessionCount', { count: shown.length }))
					),
					h('input', {
						className: 'dst-input dst-search',
						type: 'search',
						value: query,
						placeholder: t('searchPlaceholder'),
						'aria-label': t('searchPlaceholder'),
						onChange: (event) => setQuery(event.target.value)
					})
				),
				h(FilterChips, {
					tags: db.tags,
					counts,
					filter,
					total: rows.length,
					untagged,
					onFilter: setFilter
				}),
				shown.length === 0
					? h('div', { className: 'dst-empty' },
						h('p', null, rows.length === 0 ? t('emptyHistory') : t('emptyList')),
						rows.length !== 0 && h('p', { className: 'dst-hint' }, t('emptyHint')))
					: h('ul', { className: 'dst-list' },
						shown.map((row) => h('li', { key: row.id, className: 'dst-item' + (row.archived ? ' is-archived' : '') },
							h('button', {
								type: 'button',
								className: 'dst-item-open',
								title: row.title || row.id,
								onClick: () => props.openSession(row.id)
							},
								h('span', { className: 'dst-item-head' },
									row.tags.slice(0, 3).map((tagId) => h('span', {
										key: tagId,
										className: 'dst-dot',
										style: { background: (tagById.get(tagId) || {}).color || FALLBACK_COLOR }
									})),
									row.tags.length > 3 && h('span', { className: 'dst-count' }, t('moreTags', { count: row.tags.length - 3 })),
									row.running && h('span', { className: 'dst-flag dst-flag-run', title: 'running' }, '●'),
									row.pending && h('span', { className: 'dst-flag dst-flag-wait', title: 'pending' }, '!'),
									h('span', { className: 'dst-item-title' }, row.title || row.id)
								),
								row.note !== '' && h('span', { className: 'dst-item-note' }, row.note)
							),
							h('div', { className: 'dst-item-actions' },
								db.tags.map((tag) => h('button', {
									key: tag.id,
									type: 'button',
									className: 'dst-mini' + (row.tags.includes(tag.id) ? ' is-on' : ''),
									title: tagLabel(tag),
									'aria-label': tagLabel(tag),
									'aria-pressed': row.tags.includes(tag.id) ? 'true' : 'false',
									style: row.tags.includes(tag.id) ? { background: tag.color, borderColor: tag.color } : undefined,
									onClick: () => store.actions.toggleTag(row.id, tag.id, { title: row.title })
								}, ' '))
							)
						))
					),
				h('section', { className: 'dst-section' },
					h('h3', { className: 'dst-h3' }, t('manageTags')),
					h('div', { className: 'dst-creator' },
						h('input', {
							className: 'dst-input',
							value: draft,
							maxLength: TAG_NAME_MAX,
							placeholder: t('addTagPlaceholder'),
							'aria-label': t('addTag'),
							onChange: (event) => setDraft(event.target.value),
							onKeyDown: (event) => {
								if (event.key !== 'Enter') return
								const created = store.actions.createTag(draft, draftColor)
								if (created !== null) { setDraft(''); setFilter(created.id) }
							}
						}),
						h(ColorPicker, { value: draftColor, onChange: setDraftColor }),
						h('button', {
							type: 'button',
							className: 'dst-btn dst-btn-primary',
							onClick: () => {
								const created = store.actions.createTag(draft, draftColor)
								if (created !== null) { setDraft(''); setFilter(created.id) }
							}
						}, t('addTag'))
					),
					h('ul', { className: 'dst-taglist' },
						db.tags.map((tag) => h(TagRow, {
							key: tag.id,
							tag,
							count: counts.get(tag.id) || 0,
							onRename: (name) => store.actions.updateTag(tag.id, { name }),
							onColor: (color) => store.actions.updateTag(tag.id, { color }),
							onDelete: () => { store.actions.deleteTag(tag.id); if (filter === tag.id) setFilter('all') }
						}))
					)
				),
				h(BackupSection, {
					db,
					onImport: store.actions.importDb,
					onReset: () => { store.actions.reset(); setFilter('all'); setQuery('') }
				})
			)
		}

		/** The sidebar row glyph: a tag outline carrying the plugin's data hook. */
		function PanelIcon(props) {
			const size = props && props.size ? props.size : 16
			return h('svg', {
				viewBox: '0 0 16 16',
				width: size,
				height: size,
				fill: 'none',
				stroke: 'currentColor',
				strokeWidth: 1.3,
				strokeLinecap: 'round',
				strokeLinejoin: 'round',
				'aria-hidden': 'true',
				'data-dsh-panel-entry': PANEL_ID
			},
				h('path', { d: 'M2.5 7.2V3.4c0-.5.4-.9.9-.9h3.8c.3 0 .5.1.7.3l5 5c.4.4.4 1 0 1.3l-3.9 3.9c-.4.4-1 .4-1.3 0l-5-5a1 1 0 0 1-.2-.8z' }),
				h('circle', { cx: 5.4, cy: 5.4, r: 1 })
			)
		}

		/** Row badge: the session's first tag as a colored dot, plus a `+n`. */
		function RowBadge(props) {
			const db = useTagsDb(props.store)
			const record = db.sessions[props.sessionId]
			if (!record || record.tags.length === 0) return null
			const tagById = new Map(db.tags.map((tag) => [tag.id, tag]))
			const first = tagById.get(record.tags[0])
			if (!first) return null
			const label = record.tags.map((id) => tagLabel(tagById.get(id))).filter(Boolean).join(', ')
			return h('span', { className: 'dst-badge', title: label },
				h('span', { className: 'dst-dot', style: { background: first.color } }),
				record.tags.length > 1 && h('span', { className: 'dst-badge-more' }, '+' + (record.tags.length - 1))
			)
		}

		/** Hover-card body: every tag of the row, plus its note. */
		function RowHoverInfo(props) {
			const db = useTagsDb(props.store)
			const record = db.sessions[props.sessionId]
			if (!record || (record.tags.length === 0 && record.note === '')) return null
			const tagById = new Map(db.tags.map((tag) => [tag.id, tag]))
			return h('div', { className: 'dst-hover' },
				record.tags.length > 0 && h('div', { className: 'dst-hover-tags' },
					record.tags.map((tagId) => {
						const tag = tagById.get(tagId)
						if (!tag) return null
						return h('span', { key: tagId, className: 'dst-hover-tag' },
							h('span', { className: 'dst-dot', style: { background: tag.color } }),
							h('span', null, tagLabel(tag))
						)
					})
				),
				record.note !== '' && h('div', { className: 'dst-hover-note' }, record.note)
			)
		}

		/** The tag picker shared by both row affordances. */
		function TagPicker(props) {
			const db = useTagsDb(props.store)
			const record = db.sessions[props.sessionId]
			const selected = record ? record.tags : []
			return h('div', { className: 'dst-menu-tags' },
				db.tags.map((tag) => h('button', {
					key: tag.id,
					type: 'button',
					className: 'dst-chip dst-chip-sm' + (selected.includes(tag.id) ? ' is-on' : ''),
					'aria-pressed': selected.includes(tag.id) ? 'true' : 'false',
					onClick: () => {
						props.store.actions.toggleTag(props.sessionId, tag.id, { title: props.displayTitle })
						if (typeof props.onPicked === 'function') props.onPicked()
					}
				},
					h('span', { className: 'dst-dot', style: { background: tag.color } }),
					h('span', { className: 'dst-chip-label' }, tagLabel(tag))
				))
			)
		}

		/** Row menu entry: the picker, closing the menu after a pick. */
		function SessionTagMenuItem(props) {
			const menuState = typeof props.useMenuOpenState === 'function' ? props.useMenuOpenState() : null
			return h('div', { className: 'dst-menu', role: 'group', 'aria-label': t('rowMenuLabel') },
				h('div', { className: 'dst-menu-title' }, t('rowMenuLabel')),
				h(TagPicker, {
					store: props.store,
					sessionId: props.sessionId,
					displayTitle: props.displayTitle,
					onPicked: () => { if (menuState && typeof menuState[1] === 'function') menuState[1](false) }
				})
			)
		}

		/** Row hover action: the same picker behind a small tag button. */
		function SessionTagRowAction(props) {
			const [open, setOpen] = React.useState(false)
			return h('span', { className: 'dst-action' },
				h('button', {
					type: 'button',
					className: 'dst-iconbtn',
					title: t('rowActionLabel'),
					'aria-label': t('rowActionLabel'),
					'aria-expanded': open ? 'true' : 'false',
					onClick: (event) => { event.stopPropagation(); setOpen((value) => !value) }
				}, h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': 'true' },
					h('path', { d: 'M2.5 7.2V3.4c0-.5.4-.9.9-.9h3.8c.3 0 .5.1.7.3l5 5c.4.4.4 1 0 1.3l-3.9 3.9c-.4.4-1 .4-1.3 0l-5-5a1 1 0 0 1-.2-.8z' }),
					h('circle', { cx: 5.4, cy: 5.4, r: 1 }))),
				open && h('div', { className: 'dst-pop', onClick: (event) => event.stopPropagation() },
					h(TagPicker, {
						store: props.store,
						sessionId: props.sessionId,
						displayTitle: props.displayTitle
					})
				)
			)
		}

		/* ==================================================================== *
		 * @region plugin
		 * ==================================================================== */

		/** Services the browser half reads; `slots` is what it registers into. */
		const inject = ['slots', 'sessions', 'workspaces', 'uiSession', 'uiWorkspace', 'locale']

		/**
		 * Register the plugin's UI contributions.
		 *
		 * Every seat belongs to a shell plugin this package cannot depend on at
		 * runtime (`ui-sidebar`, `ui-layout`, `ui-workspace`), so each
		 * registration goes through `slots.inject`: the callback runs once the
		 * owner declares the seat, a shell without the seat leaves the
		 * contribution absent instead of failing the boot, and a seat declared
		 * again (plugin reload) re-registers automatically.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			injectStyles(PLUGIN_ID + '/client.css', CSS)

			const store = createTagsStore()
			const locale = ctx.get('locale')
			if (locale && typeof locale.register === 'function') {
				ctx.effect(() => locale.register(NS, { zh: ZH, en: EN }), PLUGIN_ID + ': dictionaries')
			}
			if (safeLocalStorage() === null) {
				// Storage is blocked (private mode, embedded webview). The panel
				// keeps working in memory; say so instead of losing data silently.
				try { console.warn(PLUGIN_ID + ': ' + t('storageBroken')) } catch { /* console unavailable */ }
			}

			const sessions = ctx.get('sessions')
			const uiSession = ctx.get('uiSession')
			const workspaces = ctx.get('workspaces')
			const uiWorkspace = ctx.get('uiWorkspace')
			const services = {
				sessionList: sessions && sessions.list ? sessions.list : null,
				sessionStatus: uiSession && uiSession.sessionStatus ? uiSession.sessionStatus : null,
				workspaces: workspaces && workspaces.list ? workspaces.list : null
			}
			const openSession = (sessionId) => {
				if (uiWorkspace && typeof uiWorkspace.openSession === 'function') uiWorkspace.openSession(sessionId)
			}

			const slots = ctx.slots
			const disposed = []
			const contribute = (seat, options, Component) => {
				disposed.push(slots.inject(seat, () => slots.register(options, Component)))
			}

			contribute('sidebar.panellist', {
				name: 'sidebar.panellist',
				id: PANEL_ID,
				order: 30,
				label: () => t('panelLabel')
			}, PanelIcon)

			contribute('main', {
				name: 'main',
				key: PANEL_ID
			}, (props) => h(TagPanel, { ...props, store, services, openSession }))

			contribute('sidebar.session.row.leading', {
				name: 'sidebar.session.row.leading',
				id: PANEL_ID + '.badge',
				order: 50,
				inject: () => ({ store })
			}, RowBadge)

			contribute('sidebar.session.row.hover', {
				name: 'sidebar.session.row.hover',
				id: PANEL_ID + '.hover',
				order: 50,
				inject: () => ({ store })
			}, RowHoverInfo)

			contribute('sidebar.workspaces.session.menu.item', {
				name: 'sidebar.workspaces.session.menu.item',
				id: PANEL_ID + '.menu',
				order: 450,
				inject: () => ({ store })
			}, SessionTagMenuItem)

			contribute('sidebar.workspaces.session.row.action', {
				name: 'sidebar.workspaces.session.row.action',
				id: PANEL_ID + '.action',
				order: 300,
				inject: () => ({ store })
			}, SessionTagRowAction)

			ctx.effect(() => () => {
				for (const dispose of disposed.splice(0)) dispose()
				store.flush()
			}, PLUGIN_ID + ': contributions')
		}

		exports.apply = apply
		exports.inject = inject
		exports.name = PLUGIN_ID

		// The harness build and the unit tests read the pure data layer through
		// this hook. It is never set in a real page, so production code paths are
		// untouched; `scripts/build.mjs --check` asserts the guard is still here.
		if (typeof window !== 'undefined' && window.__DSH_SIDEBAR_TAGS_TEST__ === true) {
			exports.__test = {
				PLUGIN_ID, PANEL_ID, CSS, STORAGE_KEY, DB_VERSION, BUILTIN_TAGS, PALETTE,
				safeColor, emptyDb, validateDb, sortTags, loadDb, saveDb, parseImport,
				setSessionTags, toggleSessionTag, addTag, updateTag, removeTag,
				pruneSessions, rememberTitles, createTagsStore,
				deriveRows, countByTag, filterRows, isZh, t, tagLabel, readSnapshot
			}
		}

		return module.exports
	}
})
