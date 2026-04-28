import axios from 'axios'

// ─── Cache module ─────────────────────────────────────────────────────────────
//
// Per-call TTL cache backed by localStorage. Keys are prefixed with
// `phobos_call_` so they can be enumerated/cleared without touching unrelated
// localStorage entries. On QuotaExceededError we evict the oldest 25% of
// phobos_call_* entries and retry once; if that still fails the write is
// silently dropped (a cache miss is not fatal).

const CACHE_TTL_MS = 15 * 60 * 1000  // 15 minutes — single source of truth.
const CACHE_PREFIX = 'phobos_call_'

function buildCacheKey(label, args) {
  // Stable JSON over (label, args) — args is whatever shape the caller passes,
  // so a JSON.stringify roundtrip is the cheapest stable hash.
  return CACHE_PREFIX + label + ':' + JSON.stringify(args)
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.cachedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function cacheSet(key, data) {
  const entry = JSON.stringify({ data, cachedAt: Date.now() })
  try {
    localStorage.setItem(key, entry)
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      evictOldestPhobosCalls()
      try { localStorage.setItem(key, entry) } catch { /* still full — drop write */ }
    }
    // Other storage errors: swallow; cache misses are non-fatal.
  }
}

function evictOldestPhobosCalls() {
  const entries = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(CACHE_PREFIX)) continue
    try {
      const parsed = JSON.parse(localStorage.getItem(k))
      if (parsed?.cachedAt) entries.push({ key: k, cachedAt: parsed.cachedAt })
      else localStorage.removeItem(k) // corrupt
    } catch { localStorage.removeItem(k) }
  }
  entries.sort((a, b) => a.cachedAt - b.cachedAt)
  const drop = Math.max(1, Math.floor(entries.length / 4))
  for (let i = 0; i < drop && i < entries.length; i++) localStorage.removeItem(entries[i].key)
}

/**
 * Clear cached Phobos calls. Pass a boardId to clear only entries that name
 * that board, or no arg to clear all.
 */
export function clearPhobosCache(boardId) {
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(CACHE_PREFIX)) continue
    if (!boardId || k.includes(boardId)) toRemove.push(k)
  }
  toRemove.forEach(k => localStorage.removeItem(k))
}

// ─── Retry with exponential backoff ───────────────────────────────────────────
//
// Phobos returns 429 Too Many Requests when the per-second / per-minute limit
// is hit. We retry up to 3 times at 1s / 2s / 4s. 503 is treated the same
// (transient unavailability). After exhaustion we throw a RateLimitError so
// the UI can render a recoverable state instead of a generic stack.

const RETRY_DELAYS_MS = [1000, 2000, 4000]

export class RateLimitError extends Error {
  constructor(message, originalStatus) {
    super(message)
    this.name = 'RateLimitError'
    this.status = originalStatus
  }
}

async function withRetry(fn) {
  let lastStatus
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err?.response?.status
      if (status !== 429 && status !== 503) throw err
      lastStatus = status
      if (attempt >= RETRY_DELAYS_MS.length) break
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
    }
  }
  throw new RateLimitError(
    `Phobos rate limited after ${RETRY_DELAYS_MS.length} retries`,
    lastStatus
  )
}

// ─── Client config ────────────────────────────────────────────────────────────

function getConfig() {
  // Migrate old 'ares_*' keys to 'phobos_*' on first read
  const host   = localStorage.getItem('phobos_host')    || localStorage.getItem('ares_host')    || ''
  const apiKey = localStorage.getItem('phobos_api_key') || localStorage.getItem('ares_api_key') || ''
  return { host, apiKey }
}

function phobosClient() {
  const { host, apiKey } = getConfig()
  return axios.create({
    baseURL: `${host}/api/v1/trello`,
    headers: { 'X-API-Key': apiKey },
    timeout: 20000,
  })
}

// ─── Cached + retried request helper ──────────────────────────────────────────

async function cachedPhobosCall(label, cacheArgs, networkFn) {
  const key = buildCacheKey(label, cacheArgs)
  const entry = cacheGet(key)
  if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
    return entry.data
  }
  const data = await withRetry(networkFn)
  cacheSet(key, data)
  return data
}

// ─── Boards list ──────────────────────────────────────────────────────────────
//
// Kept separate from the generic call cache because it has a different TTL
// (5 min — sidebar refreshes it more aggressively) and a custom shape.

const BOARDS_CACHE_KEY = 'phobos_cache_boards'
const BOARDS_CACHE_TTL = 5 * 60 * 1000

export const listBoards = (force = false) => {
  if (!force) {
    try {
      const raw = localStorage.getItem(BOARDS_CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw)
        if (Date.now() - cached.cachedAt < BOARDS_CACHE_TTL) return Promise.resolve(cached.boards)
      }
    } catch { /* fall through */ }
  }
  return withRetry(() => phobosClient().get('/boards')).then(r => {
    const raw = r.data?.data
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.boards) ? raw.boards : [])
    const boards = arr.map(b => ({
      id:          b.boardId,
      name:        b.projectName,
      activeCards: b.activeCards,
      doneCards:   b.doneCards,
      totalCards:  b.totalCards,
    }))
    try { localStorage.setItem(BOARDS_CACHE_KEY, JSON.stringify({ boards, cachedAt: Date.now() })) } catch { /* full */ }
    return boards
  })
}

// ─── Board endpoints (retry-wrapped, no cache as of Phase 0d) ─────────────────
//
// Phase 0d moved board-data fetching server-side (see functions/index.js). The
// SPA reads these from cache/{ares|manual}_{boardId} via Firestore subscription
// rather than calling Phobos directly. These exports remain — wrapped in
// withRetry as defense-in-depth — for any future caller that legitimately
// needs a live read. Per call-signature TTL caching was removed because the
// frontend has no caller for them on the board-mount path anymore. The cache
// module (cacheGet/cacheSet/clearPhobosCache/cachedPhobosCall) is intentionally
// retained but unused; resurrecting any of these functions for a board-mount
// path would regress the Phase 0d cross-user coordination model.

export const boardSummary = (boardId) =>
  withRetry(() => phobosClient().get(`/boards/${boardId}/summary`)).then(r => r.data?.data)

/**
 * Cards for a board. API params: status (active|done), list, label, page, pageSize.
 */
export const boardCards = (boardId, params = {}) =>
  withRetry(() => phobosClient().get(`/boards/${boardId}/cards`, { params })).then(r => {
    const raw = r.data?.data
    return { data: Array.isArray(raw) ? raw : [], meta: r.data?.meta || {} }
  })

/**
 * Movement events for a board. API params: dateFrom, dateTo, page, pageSize.
 */
export const boardMovements = (boardId, params = {}) =>
  withRetry(() => phobosClient().get(`/boards/${boardId}/movements`, { params })).then(r => {
    const raw = r.data?.data
    return { data: Array.isArray(raw) ? raw : [], meta: r.data?.meta || {} }
  })

// (Raintool integration fully removed 2026-04-28 — Phase 0d. The cycleTime
// endpoint, rtClient, listRaintoolProjects, and the raintool_host localStorage
// seeding are gone. Manual cycle time is computed by the Cloud Function from
// Trello action history; Ares cycle time is no longer surfaced.)
