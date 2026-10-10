/**
 * Shared test scaffolding for dsh-sidebar-tags.
 *
 * The plugin ships as one classic-script bundle that the Harness client loads
 * with `window.__ModuleLoader__.load({ id, factory })`. These helpers stand in
 * for that client: a tiny fake DOM, a fake React, a fake Cordis context, and a
 * loader that captures the registered plugin exports. Everything is plain Node
 * — no jsdom, no bundler, no network.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Read a file from the repository root. */
export function readRepoFile(relative) {
	return readFileSync(join(root, relative), 'utf8')
}

/** A localStorage-shaped store, optionally seeded with a raw string. */
export function fakeStorage(seed) {
	const map = new Map()
	if (seed !== undefined) map.set('dsh-sidebar-tags.db.v1', seed)
	return {
		getItem(key) {
			return map.has(key) ? map.get(key) : null
		},
		setItem(key, value) {
			map.set(key, String(value))
		},
		removeItem(key) {
			map.delete(key)
		},
		/** Test-only: read a key without going through getItem. */
		raw(key) {
			return map.get(key)
		},
		/** Test-only: every key currently stored. */
		keys() {
			return [...map.keys()]
		}
	}
}

/**
 * A React stand-in: `createElement` returns a plain descriptor, and every Hook
 * is a no-op. Slot *registration* is what these tests cover; rendering is
 * covered by the browser smoke check described in the README.
 */
export function fakeReact() {
	let stateCalls = 0
	return {
		createElement(type, props, ...children) {
			return { type, props: props || {}, children }
		},
		useState(initial) {
			stateCalls += 1
			const value = typeof initial === 'function' ? initial() : initial
			return [value, () => {}]
		},
		useEffect() {},
		useMemo(factory) {
			return factory()
		},
		useCallback(fn) {
			return fn
		},
		useRef(initial) {
			return { current: initial }
		},
		useSyncExternalStore(subscribe, getSnapshot) {
			return getSnapshot()
		},
		/** Test-only: how many times a component asked for state. */
		stateCalls() {
			return stateCalls
		}
	}
}

/** A minimal `document` good enough for stylesheet injection and lang probing. */
export function fakeDocument(lang = 'en') {
	const head = { children: [], appendChild(node) { this.children.push(node) } }
	const styles = []
	return {
		documentElement: { lang },
		head,
		querySelector(selector) {
			const match = /^style\[data-plugin-css=(.*)\]$/.exec(selector)
			if (match === null) return null
			const wanted = JSON.parse(match[1])
			return styles.find((style) => style.dataset.pluginCss === wanted) || null
		},
		createElement(tag) {
			const node = { tagName: tag, dataset: {}, textContent: '' }
			if (tag === 'style') styles.push(node)
			return node
		},
		/** Test-only: injected stylesheets. */
		styles() {
			return styles
		}
	}
}

/**
 * A Cordis-store-shaped observable.
 * @param initial - starting value.
 */
export function fakeStore(initial) {
	let value = initial
	const listeners = new Set()
	return {
		getSnapshot: () => value,
		subscribe(listener) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		/** Test-only: publish a new value. */
		set(next) {
			value = next
			for (const listener of [...listeners]) listener()
		},
		/** Test-only: how many subscribers are attached. */
		size() {
			return listeners.size
		}
	}
}

/**
 * A fake Cordis client context that records every slot registration.
 *
 * `declared` seeds the seats the fake shell declares; contribution to an
 * undeclared seat must stay dormant until the seat is declared, which is the
 * behaviour the plugin relies on.
 */
export function fakeContext(options = {}) {
	const registered = []
	const pending = new Map()
	const declared = new Set(options.declared || [])
	const effects = []
	const services = new Map(Object.entries(options.services || {}))

	const flush = (seat) => {
		const queue = pending.get(seat)
		if (!queue) return
		pending.delete(seat)
		for (const callback of queue) callback()
	}

	return {
		registered,
		effects,
		slots: {
			inject(seat, callback) {
				if (declared.has(seat)) callback()
				else {
					if (!pending.has(seat)) pending.set(seat, [])
					pending.get(seat).push(callback)
				}
				return () => {}
			},
			register(options_, component) {
				registered.push({ seat: options_.name, options: options_, component })
				return () => {}
			}
		},
		get(name) {
			return services.get(name)
		},
		/** Test-only: provide or replace a service. */
		provide(name, value) {
			services.set(name, value)
		},
		effect(callback) {
			effects.push(callback)
			const dispose = callback()
			return typeof dispose === 'function' ? dispose : () => {}
		},
		/** Test-only: declare a seat after the plugin applied. */
		declare(seat) {
			declared.add(seat)
			flush(seat)
		},
		/** Test-only: seats still waiting for a declaration. */
		pendingSeats() {
			return [...pending.keys()]
		}
	}
}

/**
 * Load `lib/client.js` the way the Harness client does and return its exports.
 *
 * The globals it installs (`window`, `document`, `navigator`, `localStorage`)
 * are returned so a test can inspect and mutate them afterwards.
 * @param options - language, storage seed and whether to enable the test hook.
 * @returns `{ plugin, window, document, localStorage, react }`.
 */
export function loadBundle(options = {}) {
	const react = fakeReact()
	const document = fakeDocument(options.lang || 'en')
	const localStorage = options.storage === null ? null : (options.storage || fakeStorage(options.storageSeed))
	let captured = null

	const window = {
		__DSH_SIDEBAR_TAGS_TEST__: options.testHook !== false,
		__ModuleLoader__: {
			load(entry) {
				captured = entry
			}
		},
		setTimeout: (fn, ms) => setTimeout(fn, ms),
		clearTimeout: (id) => clearTimeout(id),
		confirm: () => options.confirm !== false
	}

	// A modern Node already defines `navigator` as a getter-only global, and in
	// some sandboxes `localStorage` is defined too. Both are installed with
	// defineProperty and deleted afterwards, which restores the original
	// accessors instead of trying to assign over them.
	const globals = globalThis
	const installed = ['window', 'document', 'navigator', 'localStorage']
	const values = {
		window,
		document,
		navigator: { language: options.lang || 'en' },
		localStorage: localStorage === null ? undefined : localStorage
	}
	for (const key of installed) {
		if (values[key] === undefined) continue
		Object.defineProperty(globals, key, { value: values[key], configurable: true, writable: true })
	}

	try {
		const source = readRepoFile('lib/client.js')
		// eslint-disable-next-line no-new-func -- the bundle *is* a classic script
		new Function('window', 'document', 'navigator', 'localStorage', source)(
			window,
			document,
			values.navigator,
			values.localStorage
		)
	} finally {
		for (const key of installed) {
			try {
				delete globals[key]
			} catch {
				/* non-configurable global: leave it as the host defined it */
			}
		}
	}

	if (captured === null) throw new Error('bundle did not call window.__ModuleLoader__.load')
	const plugin = captured.factory((id) => {
		if (id === 'react') return react
		throw new Error('unexpected require: ' + id)
	})
	return { id: captured.id, plugin, window, document, localStorage, react }
}
