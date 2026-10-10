#!/usr/bin/env node
/**
 * Publish this repository to GitHub with the REST API.
 *
 * Written for machines with no `git` and no `gh`. It creates the repository if
 * needed, uploads every publishable file, and lands them as ONE commit through
 * the Git Data API (blobs → tree → commit → ref), then writes an annotated
 * release tag and verifies the remote tree against the local one.
 *
 * Notes that shaped this script:
 *
 *   - A freshly created repository has no commit, so `POST /git/blobs` on it
 *     answers `409 Git Repository is empty`. The first run therefore creates
 *     the default branch from `README.md` through the Contents API, which is
 *     the only write endpoint that tolerates an empty repository.
 *   - Writing `.github/workflows/*` needs the token scope `workflow` on top of
 *     `public_repo`; without it both the Contents API and a tree that contains
 *     such a path fail with a bare `404`, which is easy to misread as a wrong
 *     path. The script checks for it up front and refuses early.
 *   - Re-runs are incremental: a file whose git blob sha already matches the
 *     remote is skipped, and a run with nothing to change creates no commit.
 *
 *   node scripts/publish-github.mjs --check
 *   node scripts/publish-github.mjs --go [--repo <name>] [--tag <name>] [--private]
 *
 * The token comes from `GITHUB_TOKEN` or `.gh-token.txt` beside this repository
 * (outside it on purpose, so no `git add -A` can pick it up). Nothing printed
 * here contains the token.
 */

import { readFileSync, readdirSync, statSync, existsSync, lstatSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://api.github.com'

/** Read one `--flag value` argument. */
function arg(flag, fallback) {
	const index = process.argv.indexOf(flag)
	return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

/** Load the token from the environment or the side file; never log it. */
function loadToken() {
	if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim() !== '') return process.env.GITHUB_TOKEN.trim()
	const candidates = [join(repoRoot, '..', '.gh-token.txt'), join(repoRoot, '.gh-token.txt')]
	for (const candidate of candidates) {
		if (!existsSync(candidate)) continue
		const text = readFileSync(candidate, 'utf8').trim()
		if (text !== '') return text
	}
	throw new Error('no token: set GITHUB_TOKEN or write it to ' + candidates[0])
}

const token = loadToken()

/* ── HTTP with the retries a loopback proxy needs ─────────────────────────── */
async function request(method, path, body) {
	const url = path.startsWith('http') ? path : API + path
	const headers = {
		authorization: 'Bearer ' + token,
		accept: 'application/vnd.github+json',
		'user-agent': 'dsh-sidebar-tags-publish',
		'x-github-api-version': '2022-11-28',
		...(body === undefined ? {} : { 'content-type': 'application/json' })
	}
	let lastError = null
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		try {
			const response = await fetch(url, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(45000)
			})
			const text = await response.text()
			let json = null
			if (text !== '') {
				try {
					json = JSON.parse(text)
				} catch {
					json = { raw: text.slice(0, 300) }
				}
			}
			if (response.status >= 500 || response.status === 429) {
				lastError = new Error('HTTP ' + String(response.status))
				await new Promise((done) => setTimeout(done, 1200 * attempt))
				continue
			}
			return { status: response.status, headers: response.headers, json }
		} catch (error) {
			lastError = error
			console.log('    retry ' + String(attempt) + '/5: ' + String(error && error.message ? error.message : error))
			await new Promise((done) => setTimeout(done, 1200 * attempt))
		}
	}
	throw lastError === null ? new Error('request failed') : lastError
}

/* ── what gets published ─────────────────────────────────────────────────────
 * An allowlist rather than a .gitignore re-implementation: only these paths
 * leave this machine. The zip in the repository root is a no-network hand-off
 * artifact, and the publishing handbook is local documentation.
 */
const ROOT_FILES = [
	'.gitignore', '.npmignore', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE',
	'README.md', 'README.zh.md', 'cordis.patch.yml', 'package.json'
]
const DIRECTORIES = ['.github', 'lab', 'lib', 'scripts', 'tests', 'tools']

/** Collect the publishable files as repository-relative paths. */
function collectFiles() {
	const files = ROOT_FILES.slice()
	for (const directory of DIRECTORIES) {
		const walk = (current) => {
			for (const entry of readdirSync(current)) {
				const full = join(current, entry)
				if (lstatSync(full).isDirectory()) walk(full)
				else files.push(relative(repoRoot, full).split(sep).join('/'))
			}
		}
		walk(join(repoRoot, directory))
	}
	return files.sort()
}

/** Git's blob sha, which is what the API reports for a file. */
function gitBlobSha(buffer) {
	const header = Buffer.from('blob ' + String(buffer.length) + '\0', 'utf8')
	return createHash('sha1').update(Buffer.concat([header, buffer])).digest('hex')
}

/** URL-encode a repository path for a Contents API call. */
function encodePath(file) {
	return file.split('/').map(encodeURIComponent).join('/')
}

const mode = process.argv.includes('--go') ? 'go' : 'check'
const repoName = arg('--repo', 'dsh-sidebar-tags')
const tagName = arg('--tag', 'v1.0.0')
const branch = arg('--branch', 'main')
const privateRepo = process.argv.includes('--private')
const description = arg('--description',
	'Colored session tags for the DeepSeek Harness sidebar - tag a session from its row, see it at a glance, and filter history by tag.')

/* ── identity and preconditions ──────────────────────────────────────────── */
const viewer = await request('GET', '/user')
if (viewer.status !== 200) {
	console.error('token rejected: HTTP ' + String(viewer.status) + ' ' + JSON.stringify(viewer.json))
	process.exit(1)
}
const login = viewer.json.login
const scopes = String(viewer.headers.get('x-oauth-scopes') || '')
const scopeList = scopes.split(',').map((entry) => entry.trim()).filter(Boolean)
const hasWorkflowScope = scopeList.includes('workflow') || scopeList.includes('repo') || scopes === ''
console.log('authenticated as ' + login)
console.log('token scopes: ' + (scopes === '' ? '(hidden)' : scopes))

const files = collectFiles()
const workflowFiles = files.filter((file) => file.startsWith('.github/workflows/'))
console.log('publishable files: ' + String(files.length) + (workflowFiles.length > 0 ? ' (including ' + String(workflowFiles.length) + ' workflow)' : ''))
if (files.some((file) => file.includes('.gh-token'))) {
	console.error('refusing to publish: a token file is inside the repository')
	process.exit(1)
}
if (mode === 'check') {
	for (const file of files) console.log('  ' + file)
	console.log('\ncheck only; re-run with --go to publish')
	process.exit(0)
}
if (workflowFiles.length > 0 && !hasWorkflowScope) {
	console.error('this repository publishes ' + workflowFiles.join(', ') + ' but the token lacks the `workflow` scope')
	console.error('create a token with public_repo + workflow and try again')
	process.exit(1)
}

const BASE = '/repos/' + login + '/' + repoName

/* ── repository ──────────────────────────────────────────────────────────── */
let repo = await request('GET', BASE)
if (repo.status === 404) {
	console.log('creating repository ' + login + '/' + repoName)
	const created = await request('POST', '/user/repos', {
		name: repoName,
		description,
		homepage: 'https://github.com/' + login + '/' + repoName + '#readme',
		private: privateRepo,
		has_issues: true,
		has_wiki: false,
		has_projects: false,
		auto_init: false
	})
	if (created.status !== 201) {
		console.error('could not create the repository: HTTP ' + String(created.status) + ' ' + JSON.stringify(created.json))
		process.exit(1)
	}
	repo = { status: 200, json: created.json }
} else if (repo.status !== 200) {
	console.error('could not read the repository: HTTP ' + String(repo.status) + ' ' + JSON.stringify(repo.json))
	process.exit(1)
} else {
	console.log('repository exists: ' + repo.json.full_name)
}
const repoUrl = repo.json.html_url
console.log('repository: ' + repoUrl)

/* ── first commit on an empty repository ─────────────────────────────────── */
const head = await request('GET', BASE + '/git/ref/heads/' + branch)
let parentSha = head.status === 200 && head.json.object ? head.json.object.sha : undefined
if (parentSha === undefined) {
	// Only the Contents API accepts a write into a repository with no commits.
	const seed = readFileSync(join(repoRoot, 'README.md'))
	console.log('empty repository: seeding the default branch with README.md')
	const seeded = await request('PUT', BASE + '/contents/README.md', {
		message: 'chore: initialize the repository',
		content: seed.toString('base64'),
		branch
	})
	if (seeded.status !== 201 && seeded.status !== 200) {
		console.error('could not seed the branch: HTTP ' + String(seeded.status) + ' ' + JSON.stringify(seeded.json))
		process.exit(1)
	}
	const seededHead = await request('GET', BASE + '/git/ref/heads/' + branch)
	parentSha = seededHead.status === 200 ? seededHead.json.object.sha : undefined
	if (parentSha === undefined) {
		console.error('the branch did not appear after seeding')
		process.exit(1)
	}
}

/* ── which files actually changed? ───────────────────────────────────────── */
const parentCommit = await request('GET', BASE + '/git/commits/' + parentSha)
if (parentCommit.status !== 200) {
	console.error('could not read the parent commit: HTTP ' + String(parentCommit.status))
	process.exit(1)
}
const remoteTree = await request('GET', BASE + '/git/trees/' + parentCommit.json.tree.sha + '?recursive=1')
const remoteShas = new Map()
if (remoteTree.status === 200 && Array.isArray(remoteTree.json.tree)) {
	for (const entry of remoteTree.json.tree) if (entry.type === 'blob') remoteShas.set(entry.path, entry.sha)
}

const changed = []
const unchanged = []
for (const file of files) {
	const buffer = readFileSync(join(repoRoot, file))
	const sha = gitBlobSha(buffer)
	if (remoteShas.get(file) === sha) unchanged.push(file)
	else changed.push({ path: file, buffer, sha })
}
console.log('changed: ' + String(changed.length) + ', unchanged: ' + String(unchanged.length))
for (const entry of changed) console.log('  ~ ' + entry.path + ' (' + String(entry.buffer.length) + ' bytes)')
for (const file of unchanged) console.log('  = ' + file)

/* ── one tree, one commit, one ref update ────────────────────────────────── */
if (changed.length > 0) {
	const treeEntries = []
	for (const entry of changed) {
		const blob = await request('POST', BASE + '/git/blobs', {
			content: entry.buffer.toString('base64'),
			encoding: 'base64'
		})
		if (blob.status !== 201) {
			console.error('blob upload failed for ' + entry.path + ': HTTP ' + String(blob.status) + ' ' + JSON.stringify(blob.json))
			process.exit(1)
		}
		treeEntries.push({ path: entry.path, mode: '100644', type: 'blob', sha: blob.json.sha })
	}

	const tree = await request('POST', BASE + '/git/trees', {
		base_tree: parentCommit.json.tree.sha,
		tree: treeEntries
	})
	if (tree.status !== 201) {
		console.error('tree creation failed: HTTP ' + String(tree.status) + ' ' + JSON.stringify(tree.json))
		process.exit(1)
	}

	const message = [
		'feat: sidebar session tags for DeepSeek Harness',
		'',
		'Colored tags on the sidebar session row, a one-click tag picker in the row',
		'menu and on hover, tags and notes in the hover card, and a tag panel with',
		'per-tag counts, filtering, search, tag management and export/import.',
		'',
		'Ships as a hand-written client bundle in the Harness loader shape: no build',
		'step, no runtime dependencies (React is provided by the shell). Verified by a',
		'24-invariant bundle guard and 34 unit tests on bare Node.'
	].join('\n')
	const commit = await request('POST', BASE + '/git/commits', {
		message,
		tree: tree.json.sha,
		parents: [parentSha]
	})
	if (commit.status !== 201) {
		console.error('commit creation failed: HTTP ' + String(commit.status) + ' ' + JSON.stringify(commit.json))
		process.exit(1)
	}
	const ref = await request('PATCH', BASE + '/git/refs/heads/' + branch, { sha: commit.json.sha, force: false })
	if (ref.status !== 200) {
		console.error('ref update failed: HTTP ' + String(ref.status) + ' ' + JSON.stringify(ref.json))
		process.exit(1)
	}
	parentSha = commit.json.sha
	console.log('commit: ' + parentSha)
} else {
	console.log('nothing to commit; the branch already matches this checkout')
}

/* ── annotated release tag ───────────────────────────────────────────────── */
const existingTag = await request('GET', BASE + '/git/ref/tags/' + tagName)
if (existingTag.status === 200) {
	console.log('tag already present: ' + tagName)
} else {
	const tagObject = await request('POST', BASE + '/git/tags', {
		tag: tagName,
		message: tagName + ' - Session tags\n\nFirst release: colored session tags for the DeepSeek Harness sidebar.',
		object: parentSha,
		type: 'commit'
	})
	if (tagObject.status !== 201) {
		console.error('tag object failed: HTTP ' + String(tagObject.status) + ' ' + JSON.stringify(tagObject.json))
		process.exit(1)
	}
	const tagRef = await request('POST', BASE + '/git/refs', { ref: 'refs/tags/' + tagName, sha: tagObject.json.sha })
	if (tagRef.status !== 201) {
		console.error('tag ref failed: HTTP ' + String(tagRef.status) + ' ' + JSON.stringify(tagRef.json))
		process.exit(1)
	}
	console.log('tag created: ' + tagName)
}

/* ── topics: a failure here is not worth failing the release ─────────────── */
const topics = await request('PUT', BASE + '/topics', {
	names: ['dsh', 'dsh-plugin', 'deepseek-harness', 'sidebar', 'session-tags', 'web-ui']
})
console.log('topics: ' + (topics.status === 200 ? 'set' : 'HTTP ' + String(topics.status) + ' (ignored)'))

/* ── verify: the remote tree must equal this checkout, file by file ──────── */
const finalRef = await request('GET', BASE + '/git/ref/heads/' + branch)
const finalCommit = await request('GET', BASE + '/git/commits/' + finalRef.json.object.sha)
const finalTree = await request('GET', BASE + '/git/trees/' + finalCommit.json.tree.sha + '?recursive=1')
const published = new Map()
if (finalTree.status === 200 && Array.isArray(finalTree.json.tree)) {
	for (const entry of finalTree.json.tree) if (entry.type === 'blob') published.set(entry.path, entry.sha)
}
const missing = []
const differing = []
for (const file of files) {
	const local = gitBlobSha(readFileSync(join(repoRoot, file)))
	if (!published.has(file)) missing.push(file)
	else if (published.get(file) !== local) differing.push(file)
}
const extra = [...published.keys()].filter((path) => !files.includes(path))

console.log('\ndone')
console.log('  repo:      ' + repoUrl)
console.log('  commit:    ' + repoUrl + '/commit/' + finalRef.json.object.sha)
console.log('  files:     ' + String(published.size) + ' published, ' + String(files.length) + ' local')
console.log('  tag:       ' + repoUrl + '/releases/tag/' + tagName)
console.log('  missing:   ' + (missing.length === 0 ? 'none' : missing.join(', ')))
console.log('  differing: ' + (differing.length === 0 ? 'none' : differing.join(', ')))
console.log('  extra:     ' + (extra.length === 0 ? 'none' : extra.join(', ')))
if (missing.length > 0 || differing.length > 0) process.exit(1)
