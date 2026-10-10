#!/usr/bin/env node
/**
 * A throwaway static server for local verification.
 *
 * The browser verification lab (`lab/index.html`) and the plugin bundle it loads
 * must be served over http: browsers refuse classic `<script src>` from
 * `file://` in the ways this lab needs, and the plugin's own bundle is a classic
 * script. This server exists only for that, binds to localhost, and serves the
 * repository directory read-only.
 *
 *   node tools/serve.mjs [port]        # default 19500
 *
 * It is not part of the plugin and is never published (see `files` in
 * package.json).
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2] || 19500)

/** Content types for the handful of files this server ever sees. */
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.md': 'text/plain; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.map': 'application/json; charset=utf-8'
}

const server = createServer(async (request, response) => {
	try {
		const url = new URL(request.url || '/', 'http://localhost')
		const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
		let target = join(root, relative)
		// Never serve anything outside the repository, whatever the path claims.
		if (!target.startsWith(root + sep) && target !== root) {
			response.writeHead(403).end('forbidden')
			return
		}
		const info = await stat(target).catch(() => null)
		if (info === null) {
			response.writeHead(404).end('not found')
			return
		}
		if (info.isDirectory()) target = join(target, 'index.html')
		const body = await readFile(target)
		response.writeHead(200, {
			'content-type': TYPES[extname(target)] || 'application/octet-stream',
			'cache-control': 'no-store'
		})
		response.end(body)
	} catch (error) {
		response.writeHead(500).end(String((error && error.message) || error))
	}
})

server.listen(port, '127.0.0.1', () => {
	console.log('serving ' + root)
	console.log('verification lab: http://127.0.0.1:' + String(port) + '/lab/')
	console.log('plugin bundle:    http://127.0.0.1:' + String(port) + '/lib/client.js')
	console.log('press Ctrl+C to stop')
})
