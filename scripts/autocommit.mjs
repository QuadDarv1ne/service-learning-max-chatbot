#!/usr/bin/env node
/**
 * Auto-commit watcher.
 *
 * Watches the project for file changes and automatically commits them
 * (optionally pushing to the remote) after a short debounce period.
 *
 * Usage:
 *   bun run autocommit                       # watch, commit and push
 *   AUTOCOMMIT_PUSH=false bun run autocommit # commit only, no push
 *
 * Environment variables:
 *   AUTOCOMMIT_DEBOUNCE_MS  quiet period before committing (default: 5000)
 *   AUTOCOMMIT_PUSH         "false" disables git push (default: enabled)
 *   AUTOCOMMIT_MESSAGE      commit message prefix (default: "chore(auto)")
 *
 * Uses only Node built-ins — no extra dependencies required.
 */

import { watch } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const DEBOUNCE_MS = Number(process.env.AUTOCOMMIT_DEBOUNCE_MS ?? 5000)
const PUSH = process.env.AUTOCOMMIT_PUSH !== 'false'
const PREFIX = process.env.AUTOCOMMIT_MESSAGE || 'chore(auto)'

// Paths that should never trigger a commit.
const IGNORE_PATTERNS = [
  /(^|[\\/])\.git([\\/]|$)/,
  /(^|[\\/])node_modules([\\/]|$)/,
  /(^|[\\/])\.next([\\/]|$)/,
  /(^|[\\/])out([\\/]|$)/,
  /(^|[\\/])build([\\/]|$)/,
  /(^|[\\/])coverage([\\/]|$)/,
  /(^|[\\/])\.vercel([\\/]|$)/,
  /(^|[\\/])db([\\/]|$)/,
  /\.log$/,
  /\.db(-journal)?$/,
  /\.sqlite3?$/,
  /\.tsbuildinfo$/,
]

const isIgnored = (p) => !p || IGNORE_PATTERNS.some((re) => re.test(p))

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }).trim()
}

function hasStagedChanges() {
  try {
    // Exit code 0 means "no differences" -> nothing staged.
    run('git diff --cached --quiet')
    return false
  } catch {
    return true
  }
}

let busy = false
let timer = null

function commit() {
  if (busy) return
  busy = true
  try {
    run('git add -A')

    if (!hasStagedChanges()) {
      console.log('[autocommit] nothing to commit')
      return
    }

    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const message = `${PREFIX}: ${stamp}`
    run(`git commit -m "${message}"`)
    console.log(`[autocommit] committed: ${message}`)

    if (PUSH) {
      run('git push')
      console.log('[autocommit] pushed to remote')
    }
  } catch (e) {
    const detail = e.stderr?.toString().trim() || e.message
    console.error('[autocommit] error:', detail)
  } finally {
    busy = false
  }
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(commit, DEBOUNCE_MS)
}

console.log(`[autocommit] watching ${ROOT}`)
console.log(`[autocommit] debounce=${DEBOUNCE_MS}ms push=${PUSH}`)

watch(ROOT, { recursive: true }, (_event, filename) => {
  if (isIgnored(filename)) return
  schedule()
})

process.on('SIGINT', () => {
  console.log('\n[autocommit] stopped')
  process.exit(0)
})
