/**
 * Trello / Phobos → Firestore sync functions
 *
 * Phase 0d (2026-04-28): the frontend no longer calls Phobos directly for board
 * card / movement / cycle-time data. All boards (Ares + manual) now sync to
 * Firestore on a 45-minute schedule; the SPA reads cache only.
 *
 * HTTP trigger:   syncBoardHttp?boardId=<id>
 *   URL: https://us-central1-phobos-9246e.cloudfunctions.net/syncBoardHttp
 *   Called by the frontend manual-refresh button. Accepts both Ares and manual
 *   boards; dispatches by config.boards[id].source.
 *
 * Scheduled:      syncAllBoards (every 45 minutes)
 *   Iterates ALL boards in config/access. Sequential per-board with a 1.5s
 *   delay between boards. Dispatches by source.
 *
 * Output documents:
 *   cache/manual_{boardId}  — Trello-source boards
 *   cache/ares_{boardId}    — Phobos-source boards
 * Both share the same payload shape:
 *   { activeCards, doneCards, completionDates, activatedDates, cycleDays,
 *     updatedAt, lastActionDate, boardId, source,
 *     // Health (Phase 0d):
 *     lastSyncStatus, lastSuccessfulSync, lastSyncError, consecutiveFailures }
 *
 * Trello credentials and Phobos host/API key are read from config/access.services
 * at run time. No env-var secrets.
 */

'use strict'

const { onRequest }  = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const admin            = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()

// ─── LANE_MAP ──────────────────────────────────────────────────────────────────
// Must stay in sync with src/pages/BoardPage.jsx — used to classify cards and
// identify Pending / Done lanes for completion date and cycle time computation.

const LANE_MAP = {
  // ── WORK LANE — OPS ─────────────────────────────────────────────────────────
  'Operations Backlog':                           { type: 'Work Lane', category: 'OPS',     status: 'Pending' },
  'Working on Ops Work':                          { type: 'Work Lane', category: 'OPS',     status: 'Ongoing' },
  'Ready for Ops Review':                         { type: 'Work Lane', category: 'OPS',     status: 'Ongoing' },
  'Reviewing Ops Work':                           { type: 'Work Lane', category: 'OPS',     status: 'Ongoing' },
  'Ops Work Complete':                            { type: 'Work Lane', category: 'OPS',     status: 'Done' },

  // ── WORK LANE — BACKLOG ──────────────────────────────────────────────────────
  'Production Backlog':                           { type: 'Work Lane', category: 'Backlog', status: 'Pending' },

  // ── WORK LANE — CONTENT ──────────────────────────────────────────────────────
  'Content Backlog':                              { type: 'Work Lane', category: 'Content', status: 'Pending' },
  'Ready for Content':                            { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Working on Content':                           { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Ready for Content Peer Review':                { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Working on Content Peer Review':               { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Ready for Content Review':                     { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Working on Content Review':                    { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Ready for Content Refinement':                 { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Working on Content Refinement':                { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Ready for Content Checks':                     { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Working on Content Checks':                    { type: 'Work Lane', category: 'Content', status: 'Ongoing' },
  'Content Complete':                             { type: 'Work Lane', category: 'Content', status: 'Done' },

  // ── WORK LANE — DESIGN ───────────────────────────────────────────────────────
  'Design Backlog':                               { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: Screens':                             { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: Components':                          { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: Normalization':                       { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: Assets':                              { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: Sketch Revisions':                    { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: Render Revisions':                    { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: UI Revisions':                        { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: Icons':                               { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Backlog: Motion':                              { type: 'Work Lane', category: 'Design',  status: 'Pending' },
  'Ready for Design':                             { type: 'Work Lane', category: 'Design',  status: 'Ongoing' },
  'Working on Design':                            { type: 'Work Lane', category: 'Design',  status: 'Ongoing' },
  'Ready for Peer Review':                        { type: 'Work Lane', category: 'Design',  status: 'Ongoing' },
  'Working on Peer Review':                       { type: 'Work Lane', category: 'Design',  status: 'Ongoing' },
  'Ready for Design Review':                      { type: 'Work Lane', category: 'Design',  status: 'Ongoing' },
  'Working on Design Review':                     { type: 'Work Lane', category: 'Design',  status: 'Ongoing' },
  'Design Complete':                              { type: 'Work Lane', category: 'Design',  status: 'Done' },

  // ── WORK LANE — DEV ─────────────────────────────────────────────────────────
  'Development Backlog':                          { type: 'Work Lane', category: 'Dev',     status: 'Pending' },
  'Backlog: Bugs and Fixes':                      { type: 'Work Lane', category: 'Dev',     status: 'Pending' },
  'Ready for Development':                        { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Working on Development':                       { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Ready for Dev Peer Review':                    { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Working on Dev Peer Review':                   { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Ready for Code Review':                        { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Working on Code Review':                       { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Ready for Design and Content QA':              { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Working on Design and Content QA':             { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Working on Bugs and Fixes':                    { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Ready for QA Validation':                      { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Validating Bugs and Fixes':                    { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Passed QA':                                    { type: 'Work Lane', category: 'Dev',     status: 'Ongoing' },
  'Development Complete':                         { type: 'Work Lane', category: 'Dev',     status: 'Done' },

  // ── PROCESS LANE — BACKLOG ───────────────────────────────────────────────────
  '➜ Process Lane':                               { type: 'Process Lane', category: 'Backlog',  status: 'Pending' },
  'Backlog: Process Lane':                        { type: 'Process Lane', category: 'Backlog',  status: 'Pending' },

  // ── PROCESS LANE — CONTENT ───────────────────────────────────────────────────
  '➜ Ready for Content':                          { type: 'Process Lane', category: 'Content',  status: 'Ongoing' },
  '➜ Content: Writing Content':                   { type: 'Process Lane', category: 'Content',  status: 'Ongoing' },
  '➜ Content: Ready for Client Review':           { type: 'Process Lane', category: 'Content',  status: 'For Review' },
  '➜ Content: Sent for Client Review':            { type: 'Process Lane', category: 'Content',  status: 'For Review' },
  '➜ Content: With Revision':                     { type: 'Process Lane', category: 'Content',  status: 'Revising' },
  '➜ Content: Working on Revision':               { type: 'Process Lane', category: 'Content',  status: 'Revising' },
  '➜ Content: Ready for Client Approval':         { type: 'Process Lane', category: 'Content',  status: 'For Approval' },
  '➜ Content: Sent for Client Approval':          { type: 'Process Lane', category: 'Content',  status: 'For Approval' },
  '➜ Content: Done':                              { type: 'Process Lane', category: 'Content',  status: 'Done' },

  // ── PROCESS LANE — SCREENS ───────────────────────────────────────────────────
  '➜ Ready for Screen Design':                    { type: 'Process Lane', category: 'Screens',  status: 'Ongoing' },
  '➜ Screen: Working on it':                      { type: 'Process Lane', category: 'Screens',  status: 'Ongoing' },
  '➜ Screen: Ready for Client Review':            { type: 'Process Lane', category: 'Screens',  status: 'For Review' },
  '➜ Screen: Sent for Client Review':             { type: 'Process Lane', category: 'Screens',  status: 'For Review' },
  '➜ Screen: With Revision':                      { type: 'Process Lane', category: 'Screens',  status: 'Revising' },
  '➜ Screen: Working on Revision':                { type: 'Process Lane', category: 'Screens',  status: 'Revising' },
  '➜ Screen: Ready for Client Approval':          { type: 'Process Lane', category: 'Screens',  status: 'For Approval' },
  '➜ Screen: Sent for Client Approval':           { type: 'Process Lane', category: 'Screens',  status: 'For Approval' },
  '➜ Screen: Done':                               { type: 'Process Lane', category: 'Screens',  status: 'Done' },
  '➜ Ready for Componentization':                 { type: 'Process Lane', category: 'Screens',  status: 'Ongoing' },
  '➜ Component: Working on it':                   { type: 'Process Lane', category: 'Screens',  status: 'Ongoing' },
  '➜ Component: Ready for Client Review':         { type: 'Process Lane', category: 'Screens',  status: 'For Review' },
  '➜ Component: Sent for Client Review':          { type: 'Process Lane', category: 'Screens',  status: 'For Review' },
  '➜ Component: With Revision':                   { type: 'Process Lane', category: 'Screens',  status: 'Revising' },
  '➜ Component: Working on Revision':             { type: 'Process Lane', category: 'Screens',  status: 'Revising' },
  '➜ Component: Ready for Client Approval':       { type: 'Process Lane', category: 'Screens',  status: 'For Approval' },
  '➜ Component: Sent for Client Approval':        { type: 'Process Lane', category: 'Screens',  status: 'For Approval' },
  '➜ Component: Done':                            { type: 'Process Lane', category: 'Screens',  status: 'Done' },

  // ── PROCESS LANE — ASSETS ────────────────────────────────────────────────────
  '➜ Ready for Sketch':                           { type: 'Process Lane', category: 'Assets',   status: 'Ongoing' },
  '➜ Sketch: Working on it':                      { type: 'Process Lane', category: 'Assets',   status: 'Ongoing' },
  '➜ Sketch: Ready for Client Review':            { type: 'Process Lane', category: 'Assets',   status: 'For Review' },
  '➜ Sketch: Sent for Client Review':             { type: 'Process Lane', category: 'Assets',   status: 'For Review' },
  '➜ Sketch: With Revision':                      { type: 'Process Lane', category: 'Assets',   status: 'Revising' },
  '➜ Sketch: Working on Revision':                { type: 'Process Lane', category: 'Assets',   status: 'Revising' },
  '➜ Sketch: Ready for Client Approval':          { type: 'Process Lane', category: 'Assets',   status: 'For Approval' },
  '➜ Sketch: Sent for Client Approval':           { type: 'Process Lane', category: 'Assets',   status: 'For Approval' },
  '➜ Ready for Render':                           { type: 'Process Lane', category: 'Assets',   status: 'Ongoing' },
  '➜ Render: Working on it':                      { type: 'Process Lane', category: 'Assets',   status: 'Ongoing' },
  '➜ Render: Ready for Client Review':            { type: 'Process Lane', category: 'Assets',   status: 'For Review' },
  '➜ Render: Sent for Client Review':             { type: 'Process Lane', category: 'Assets',   status: 'For Review' },
  '➜ Render: With Revision':                      { type: 'Process Lane', category: 'Assets',   status: 'Revising' },
  '➜ Render: Working on Revision':                { type: 'Process Lane', category: 'Assets',   status: 'Revising' },
  '➜ Render: Ready for Client Approval':          { type: 'Process Lane', category: 'Assets',   status: 'For Approval' },
  '➜ Render: Sent for Client Approval':           { type: 'Process Lane', category: 'Assets',   status: 'For Approval' },
  '➜ Render: Done':                               { type: 'Process Lane', category: 'Assets',   status: 'Done' },
  '➜ Ready for CRM Review':                       { type: 'Process Lane', category: 'Assets',   status: 'Ongoing' },
  '➜ Sent for CRM Review':                        { type: 'Process Lane', category: 'Assets',   status: 'Ongoing' },
  '➜ Ready for Brand Review':                     { type: 'Process Lane', category: 'Assets',   status: 'Ongoing' },
  '➜ Sent for Brand Review':                      { type: 'Process Lane', category: 'Assets',   status: 'Ongoing' },

  // ── PROCESS LANE — MOTION ────────────────────────────────────────────────────
  '➜ Ready for Rough Animation':                  { type: 'Process Lane', category: 'Motion',   status: 'Ongoing' },
  '➜ Rough Animation: Working on it':             { type: 'Process Lane', category: 'Motion',   status: 'Ongoing' },
  '➜ Rough Animation: Ready for Client Review':   { type: 'Process Lane', category: 'Motion',   status: 'For Review' },
  '➜ Rough Animation: Sent For Client Review':    { type: 'Process Lane', category: 'Motion',   status: 'For Review' },
  '➜ Rough Animation: With Revision':             { type: 'Process Lane', category: 'Motion',   status: 'Revising' },
  '➜ Rough Animation: Working on Revision':       { type: 'Process Lane', category: 'Motion',   status: 'Revising' },
  '➜ Rough Animation: Ready for Client Approval': { type: 'Process Lane', category: 'Motion',   status: 'For Approval' },
  '➜ Rough Animation: Sent For Client Approval':  { type: 'Process Lane', category: 'Motion',   status: 'For Approval' },
  '➜ Ready for Final Animation':                  { type: 'Process Lane', category: 'Motion',   status: 'Ongoing' },
  '➜ Final Animation: Working on it':             { type: 'Process Lane', category: 'Motion',   status: 'Ongoing' },
  '➜ Final Animation: Ready for Client Review':   { type: 'Process Lane', category: 'Motion',   status: 'For Review' },
  '➜ Final Animation: Sent for Client Review':    { type: 'Process Lane', category: 'Motion',   status: 'For Review' },
  '➜ Final Animation: With Revision':             { type: 'Process Lane', category: 'Motion',   status: 'Revising' },
  '➜ Final Animation: Working on Revision':       { type: 'Process Lane', category: 'Motion',   status: 'Revising' },
  '➜ Final Animation: Ready for Client Approval': { type: 'Process Lane', category: 'Motion',   status: 'For Approval' },
  '➜ Final Animation: Sent for Client Approval':  { type: 'Process Lane', category: 'Motion',   status: 'For Approval' },
  '➜ Final Animation: Done':                      { type: 'Process Lane', category: 'Motion',   status: 'Done' },

  // ── PROCESS LANE — DEV ───────────────────────────────────────────────────────
  '➜ Ready for Development':                      { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Development: Working on it':                 { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Ready for DQA':                              { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ DQA: Working on it':                         { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Ready for CQA':                              { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ CQA: Working on it':                         { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Ready for Integration':                      { type: 'Process Lane', category: 'Dev',      status: 'For Review' },
  '➜ Sent for Integration':                       { type: 'Process Lane', category: 'Dev',      status: 'For Review' },
  '➜ Integration: Ongoing':                       { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Development: Ready for UAT':                 { type: 'Process Lane', category: 'Dev',      status: 'For Approval' },
  '➜ Development: Sent for UAT':                  { type: 'Process Lane', category: 'Dev',      status: 'For Approval' },
  '➜ UAT: Ongoing':                               { type: 'Process Lane', category: 'Dev',      status: 'Revising' },
  '➜ UAT: With Issues':                           { type: 'Process Lane', category: 'Dev',      status: 'Revising' },
  '➜ UAT: Done':                                  { type: 'Process Lane', category: 'Dev',      status: 'Done' },
  '➜ Development: Ready for Release':             { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Development: Pushed to Production':          { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Development: Completed':                     { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Development: Released':                      { type: 'Process Lane', category: 'Dev',      status: 'Ongoing' },
  '➜ Development: Done':                          { type: 'Process Lane', category: 'Dev',      status: 'Done' },

  // ── MISC ─────────────────────────────────────────────────────────────────────
  'Discarded Work':                               { type: 'Misc', category: 'Discarded', status: 'Discarded' },
  'Unused Work':                                  { type: 'Misc', category: 'Discarded', status: 'Discarded' },
}

// ─── Sync configuration ──────────────────────────────────────────────────────

// First-sync (or post-failure full-fetch) lookback for Phobos /movements.
// Phobos requires a date range. Subsequent incremental syncs use the cursor.
const ARES_MOVEMENT_LOOKBACK_DAYS = 90

// Delay between board syncs in syncAllBoards. Sequential per-board with a
// gap is the user-specified throttling shape ("slowly"). Bumped from 1500 to
// 3000 during Phase 0d Task 4 deploy when Phobos rate-limited mid-seed.
const INTER_BOARD_DELAY_MS = 3000

// Retry policy for Phobos calls — mirrors src/api/phobos.js's withRetry.
// Phobos returns 429 with a retryAfter hint when the per-second/per-minute
// limit is hit; 503 indicates transient unavailability.
const PHOBOS_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000]  // up to 4 retries

// Done-card retention cap: Firestore documents are limited to 1 MiB. A board
// with several thousand completed cards exceeds that limit even after card-
// field trimming. We retain the most recent 12 months of done cards by
// `dateLastActivity`, and apply a count-based hard cap of 1500 cards as a
// safety net in case a board's annual throughput pushes past the date cap.
// `doneCardsTotalAvailable` is recorded so a future UI can disclose "+N older
// cards not loaded". Originally set to 548 days (18 months) but tightened to
// 365 days during Phase 0d Task 4 deploy when JFC Chowking's 2025-2027 cache
// doc still exceeded 1 MiB at 18 months. Tune the constants further if a
// board ever approaches the limit again.
const DONE_CARDS_RETENTION_DAYS = 365  // 12 months
const DONE_CARDS_HARD_CAP       = 1000 // count-based safety cap (lowered from 1500 during Phase 0d Task 4 deploy when richer cards on GCash Design Support 2026 still pushed past 1 MiB at 1500)

function applyDoneCardsCap(allDoneCards) {
  const cutoffMs = Date.now() - DONE_CARDS_RETENTION_DAYS * 86400000
  let within = allDoneCards.filter(c => {
    const d = c.dateLastActivity || c.updatedAt
    if (!d) return true            // keep cards with no activity stamp; they're rare
    return new Date(d).getTime() >= cutoffMs
  })
  // If the date cap alone isn't sufficient (very busy board, or many recent
  // completions), keep the most-recent-by-dateLastActivity slice of size HARD_CAP.
  if (within.length > DONE_CARDS_HARD_CAP) {
    within = within
      .slice()
      .sort((a, b) => new Date(b.dateLastActivity || b.updatedAt || 0) - new Date(a.dateLastActivity || a.updatedAt || 0))
      .slice(0, DONE_CARDS_HARD_CAP)
  }
  return {
    doneCards:                within,
    doneCardsTotalAvailable:  allDoneCards.length,
    doneCardsCutoffMs:        cutoffMs,
  }
}

// Prune cardId→date maps to only entries whose cardId still appears in the
// cached card arrays. Without this, completionDates/activatedDates accumulate
// entries for cards excluded by the retention cap and push the doc past
// Firestore's 1 MiB limit on busy boards.
function pruneMapsToCachedCards(completionMap, activatedMap, activeCards, doneCards) {
  const valid = new Set()
  for (const c of activeCards) if (c.id) valid.add(c.id)
  for (const c of doneCards)   if (c.id) valid.add(c.id)
  const completion = {}
  const activation = {}
  for (const [k, v] of completionMap) if (valid.has(k)) completion[k] = v
  for (const [k, v] of activatedMap)  if (valid.has(k)) activation[k] = v
  return { completionDates: completion, activatedDates: activation }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ─── Trello API helpers ────────────────────────────────────────────────────────

const TRELLO_BASE = 'https://api.trello.com/1'

function qs(key, token, extra = {}) {
  return new URLSearchParams({ key, token, ...extra }).toString()
}

async function fetchTrelloCards(shortBoardId, key, token) {
  const [listsRes, cardsRes] = await Promise.all([
    fetch(`${TRELLO_BASE}/boards/${shortBoardId}/lists?${qs(key, token, { filter: 'open', fields: 'id,name' })}`),
    fetch(`${TRELLO_BASE}/boards/${shortBoardId}/cards?${qs(key, token, {
      filter:        'open',
      fields:        'id,name,idList,labels,due,dateLastActivity',
      members:       'true',
      member_fields: 'fullName,username',
    })}`),
  ])
  if (!listsRes.ok) throw new Error(`Trello lists ${listsRes.status}: ${await listsRes.text()}`)
  if (!cardsRes.ok) throw new Error(`Trello cards ${cardsRes.status}: ${await cardsRes.text()}`)

  const lists    = await listsRes.json()
  const rawCards = await cardsRes.json()
  const listMap  = Object.fromEntries(lists.map(l => [l.id, l.name]))

  return rawCards.map(c => ({
    id:               c.id,
    name:             c.name,
    currentList:      listMap[c.idList] || '',
    labels:           (c.labels  || []).map(l => ({ id: l.id, name: l.name, color: l.color })),
    due:              c.due              || null,
    dateLastActivity: c.dateLastActivity || null,
    members:          (c.members || []).map(m => ({ fullName: m.fullName, username: m.username })),
  }))
}

async function fetchTrelloActions(shortBoardId, key, token, since = null) {
  const allActions = []
  const limit = 1000
  let before = null

  while (true) {
    const params = { filter: 'updateCard:idList', limit: String(limit), fields: 'date,data' }
    if (before) params.before = before
    if (since)  params.since  = since
    const r = await fetch(`${TRELLO_BASE}/boards/${shortBoardId}/actions?${qs(key, token, params)}`)
    if (!r.ok) throw new Error(`Trello actions ${r.status}: ${await r.text()}`)
    const batch = await r.json()
    if (!batch.length) break
    allActions.push(...batch)
    if (batch.length < limit) break
    before = batch[batch.length - 1].id
  }

  return allActions
}

// ─── Phobos API helpers ────────────────────────────────────────────────────────
//
// Mirrors src/api/phobos.js's client shape: baseURL = ${host}/api/v1/trello,
// auth via X-API-Key header. Sequential pagination: each page awaits the prior.

async function fetchPhobosOnce(host, apiKey, path, params = {}) {
  const queryStr = new URLSearchParams(params).toString()
  const url      = `${host.replace(/\/$/, '')}/api/v1/trello${path}${queryStr ? '?' + queryStr : ''}`

  let lastBody = ''
  for (let attempt = 0; attempt <= PHOBOS_RETRY_DELAYS_MS.length; attempt++) {
    const r = await fetch(url, { headers: { 'X-API-Key': apiKey } })
    if (r.ok) return r.json()

    lastBody = (await r.text()).slice(0, 200)

    // Retry only on 429 / 503. Honor server-suggested retryAfter when present
    // (Phobos returns it inside the JSON error envelope as a number of seconds).
    const isTransient = r.status === 429 || r.status === 503
    if (!isTransient || attempt >= PHOBOS_RETRY_DELAYS_MS.length) {
      throw new Error(`Phobos ${path} ${r.status}: ${lastBody}`)
    }
    let delayMs = PHOBOS_RETRY_DELAYS_MS[attempt]
    try {
      const parsed = JSON.parse(lastBody)
      const retryAfter = parsed?.error?.retryAfter
      if (typeof retryAfter === 'number' && retryAfter > 0) {
        delayMs = Math.max(delayMs, retryAfter * 1000)
      }
    } catch { /* body wasn't JSON — fall back to exponential delay */ }
    await sleep(delayMs)
  }
  throw new Error(`Phobos ${path} retries exhausted: ${lastBody}`)
}

async function fetchPhobosAllPages(host, apiKey, path, baseParams = {}) {
  const out = []
  let page = 1
  while (true) {
    const json = await fetchPhobosOnce(host, apiKey, path, { ...baseParams, page: String(page), pageSize: '200' })
    const batch = Array.isArray(json?.data) ? json.data : []
    out.push(...batch)
    const pg = json?.meta?.pagination
    if (!pg || page >= pg.totalPages) break
    page++
  }
  return out
}

// Movement field extraction — Phobos response shape varies by endpoint version,
// so we try the same field aliases the SPA does (see src/pages/BoardPage.jsx
// extractMovement* helpers).
function moveToList(m)   { return m.toList   || m.listAfter   || m.destinationList || '' }
function moveFromList(m) { return m.fromList || m.listBefore  || m.sourceList      || '' }
function moveCardId(m)   { return m.cardId   || m.card_id     || m.cardid          || (m.card && m.card.id) || null }
function moveDate(m) {
  return m.movedAt || m.date || m.timestamp || m.createdAt || m.at ||
         m.occurredAt || m.eventDate || m.action_date || m.moved_at || m.created_at || null
}

// Normalize a raw Phobos card to the same compact shape `fetchTrelloCards`
// produces for manual boards. Phobos returns additional metadata (descriptions,
// attachments, comments counts, etc.) that BoardPage doesn't read. Without
// trimming, large boards blow past Firestore's 1 MiB document size limit.
function normalizePhobosCard(c) {
  const list =
    c.currentList || c.list_name || c.listName || c.list || ''
  const labels = Array.isArray(c.labels)
    ? c.labels.map(l => ({ id: l.id, name: l.name, color: l.color }))
    : []
  const members = Array.isArray(c.members)
    ? c.members.map(m => ({ fullName: m.fullName || m.full_name, username: m.username }))
    : []
  return {
    id:               c.id || c.cardId,
    name:             c.name,
    currentList:      list,
    labels,
    due:              c.due || c.dueDate || null,
    dateLastActivity: c.dateLastActivity || c.updatedAt || null,
    members,
  }
}

// ─── Common health-field helpers ──────────────────────────────────────────────

function buildSuccessHealthFields() {
  const ts = admin.firestore.FieldValue.serverTimestamp()
  return {
    lastSyncStatus:      'success',
    lastSuccessfulSync:  ts,
    lastSyncError:       null,
    consecutiveFailures: 0,
    updatedAt:           ts,
  }
}

function buildFailureHealthFields(prevFailures, errMessage) {
  return {
    lastSyncStatus:      'failed',
    lastSyncError:       String(errMessage || 'unknown error').slice(0, 500),
    consecutiveFailures: (prevFailures || 0) + 1,
    // Note: lastActionDate (cursor), lastSuccessfulSync, and the data fields
    // are intentionally NOT included — failure must not advance the cursor or
    // overwrite a known-good cache.
  }
}

// ─── Manual board sync (Trello → cache/manual_*) ─────────────────────────────

async function syncManualBoard(boardId, trelloShortId, key, token) {
  const cacheRef  = db.doc(`cache/manual_${boardId}`)
  const cacheSnap = await cacheRef.get()
  const existing  = cacheSnap.exists ? cacheSnap.data() : null
  const previousFailed = existing?.lastSyncStatus === 'failed'

  try {
    // If previous run failed, drop the cursor and refetch full history.
    const since = previousFailed ? null : (existing?.lastActionDate || null)

    // Cards: always fetched in full (we need current list assignment). Actions:
    // incremental from cursor (or full on first run / post-failure).
    const [allCards, newActions] = await Promise.all([
      fetchTrelloCards(trelloShortId, key, token),
      fetchTrelloActions(trelloShortId, key, token, since),
    ])

    const activeCards = allCards.filter(c => {
      const lane = LANE_MAP[c.currentList]
      return !lane || (lane.status !== 'Done' && lane.category !== 'Discarded')
    })
    const allDoneCards = allCards.filter(c => LANE_MAP[c.currentList]?.status === 'Done')
    const { doneCards, doneCardsTotalAvailable, doneCardsCutoffMs } = applyDoneCardsCap(allDoneCards)

    const completionMap    = new Map(Object.entries(existing?.completionDates || {}))
    const firstActivatedAt = new Map(Object.entries(existing?.activatedDates  || {}))

    for (const a of newActions) {
      const toList   = a.data?.listAfter?.name  || ''
      const fromList = a.data?.listBefore?.name || ''
      const cardId   = a.data?.card?.id
      const date     = a.date
      if (!cardId || !date) continue

      if (LANE_MAP[toList]?.status === 'Done') {
        const ex = completionMap.get(cardId)
        if (!ex || new Date(date) > new Date(ex)) completionMap.set(cardId, date)
      }
      if (LANE_MAP[fromList]?.status === 'Pending') {
        const ex = firstActivatedAt.get(cardId)
        if (!ex || new Date(date) < new Date(ex)) firstActivatedAt.set(cardId, date)
      }
    }

    const cycleDays = {}
    for (const [cardId, completionDate] of completionMap) {
      const startDate = firstActivatedAt.get(cardId)
      if (!startDate) continue
      const days = (new Date(completionDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
      if (days >= 0) cycleDays[cardId] = Math.round(days * 10) / 10
    }

    const lastActionDate = newActions.length > 0
      ? newActions[0].date                   // Trello returns newest-first
      : (existing?.lastActionDate || null)

    const { completionDates, activatedDates } = pruneMapsToCachedCards(
      completionMap, firstActivatedAt, activeCards, doneCards,
    )

    await cacheRef.set({
      activeCards,
      doneCards,
      doneCardsTotalAvailable,
      doneCardsCutoffMs,
      completionDates,
      activatedDates,
      cycleDays,
      lastActionDate,
      boardId,
      trelloShortId,
      source: 'manual',
      ...buildSuccessHealthFields(),
    }, { merge: true })

    return {
      activeCount:             activeCards.length,
      doneCount:               doneCards.length,
      doneCardsTotalAvailable,
      newActions:              newActions.length,
      incremental:             !!since,
    }
  } catch (err) {
    await cacheRef.set(buildFailureHealthFields(existing?.consecutiveFailures, err.message), { merge: true })
    throw err
  }
}

// ─── Ares board sync (Phobos → cache/ares_*) ─────────────────────────────────

async function syncAresBoard(boardId, phobosHost, phobosApiKey) {
  const cacheRef  = db.doc(`cache/ares_${boardId}`)
  const cacheSnap = await cacheRef.get()
  const existing  = cacheSnap.exists ? cacheSnap.data() : null
  const previousFailed = existing?.lastSyncStatus === 'failed'

  try {
    // If previous run failed, drop the cursor and refetch from the lookback.
    const since = previousFailed ? null : (existing?.lastActionDate || null)

    // Movement date range. Phobos /movements requires dateFrom/dateTo, so
    // first-sync (or recovery) uses a fixed lookback window.
    const todayIso = new Date().toISOString().slice(0, 10)
    const dateFrom = since
      ? since.slice(0, 10)
      : new Date(Date.now() - ARES_MOVEMENT_LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10)

    // Sequential between endpoints (do NOT Promise.all — this is the user's
    // explicit "slowly" requirement to keep request rate low). Sequential pagination
    // inside fetchPhobosAllPages too. Normalize cards on the way out: Phobos
    // returns extra metadata that BoardPage doesn't use, and the raw shape
    // can push the cache doc past Firestore's 1 MiB limit on large boards.
    const activeRaw = await fetchPhobosAllPages(phobosHost, phobosApiKey, `/boards/${boardId}/cards`,     { status: 'active' })
    const doneRaw   = await fetchPhobosAllPages(phobosHost, phobosApiKey, `/boards/${boardId}/cards`,     { status: 'done'   })
    const movements = await fetchPhobosAllPages(phobosHost, phobosApiKey, `/boards/${boardId}/movements`, { dateFrom, dateTo: todayIso })
    const activeCards   = activeRaw.map(normalizePhobosCard)
    const allDoneCards  = doneRaw.map(normalizePhobosCard)
    const { doneCards, doneCardsTotalAvailable, doneCardsCutoffMs } = applyDoneCardsCap(allDoneCards)

    // Summary — single call, optional (only used for boardName fallback).
    let summaryName = null
    try {
      const s = await fetchPhobosOnce(phobosHost, phobosApiKey, `/boards/${boardId}/summary`)
      const data = s?.data
      summaryName = data?.projectName || data?.name || data?.boardName || data?.board_name || null
    } catch (e) {
      // Summary failure is non-fatal for the sync — just skip the name update.
      console.warn(`syncAresBoard ${boardId}: summary fetch failed (non-fatal):`, e.message)
    }

    // Seed maps from existing cache (if any), then layer in this batch's movements.
    // Using maps lets us do greatest-completion / earliest-activation correctly
    // even when incremental fetches return overlapping windows.
    const completionMap    = new Map(Object.entries(existing?.completionDates || {}))
    const firstActivatedAt = new Map(Object.entries(existing?.activatedDates  || {}))

    for (const m of movements) {
      const toList   = moveToList(m)
      const fromList = moveFromList(m)
      const cardId   = moveCardId(m)
      const date     = moveDate(m)
      if (!cardId || !date) continue

      // Completion: keep the most recent move into a Done lane.
      if (LANE_MAP[toList]?.status === 'Done') {
        const ex = completionMap.get(cardId)
        if (!ex || new Date(date) > new Date(ex)) completionMap.set(cardId, date)
      }
      // First activation: keep the earliest move OUT of a Pending lane.
      // Mirrors syncManualBoard semantics so cycleDays is computed identically.
      if (LANE_MAP[fromList]?.status === 'Pending') {
        const ex = firstActivatedAt.get(cardId)
        if (!ex || new Date(date) < new Date(ex)) firstActivatedAt.set(cardId, date)
      }
    }

    // Ares cycle-time: intentionally empty post-2026-04-28 (Phase 0d Raintool removal).
    // activatedDates / completionDates remain populated to drive WIP-age and
    // completion-date displays. Field shape preserved for frontend consumers.
    const cycleDays = {}

    // Cursor: most recent movement date in this batch (or the prior cursor).
    let lastActionDate = existing?.lastActionDate || null
    for (const m of movements) {
      const d = moveDate(m)
      if (!d) continue
      if (!lastActionDate || new Date(d) > new Date(lastActionDate)) lastActionDate = d
    }

    const { completionDates, activatedDates } = pruneMapsToCachedCards(
      completionMap, firstActivatedAt, activeCards, doneCards,
    )

    await cacheRef.set({
      activeCards,
      doneCards,
      doneCardsTotalAvailable,
      doneCardsCutoffMs,
      completionDates,
      activatedDates,
      cycleDays,
      lastActionDate,
      boardId,
      boardName: summaryName || existing?.boardName || null,
      source: 'ares',
      ...buildSuccessHealthFields(),
    }, { merge: true })

    return {
      activeCount:             activeCards.length,
      doneCount:               doneCards.length,
      doneCardsTotalAvailable,
      newMovements:            movements.length,
      incremental:             !!since,
    }
  } catch (err) {
    await cacheRef.set(buildFailureHealthFields(existing?.consecutiveFailures, err.message), { merge: true })
    throw err
  }
}

// ─── Source dispatcher ────────────────────────────────────────────────────────

async function syncBoardBySource(boardId, board, services) {
  const source = board?.source
  if (source === 'manual') {
    if (!board.trelloShortId)                       throw new Error('Manual board missing trelloShortId')
    if (!services.trelloApiKey || !services.trelloToken) throw new Error('Trello credentials not configured')
    return syncManualBoard(boardId, board.trelloShortId, services.trelloApiKey, services.trelloToken)
  }
  if (source === 'ares') {
    if (!services.phobosHost || !services.phobosApiKey) throw new Error('Phobos host/API key not configured')
    return syncAresBoard(boardId, services.phobosHost, services.phobosApiKey)
  }
  throw new Error(`Unknown board source: ${source}`)
}

// ─── HTTP trigger — manual refresh button on the SPA ─────────────────────────
// URL: https://us-central1-phobos-9246e.cloudfunctions.net/syncBoardHttp?boardId=<id>

exports.syncBoardHttp = onRequest(
  { region: 'us-central1', cors: true, invoker: 'public', timeoutSeconds: 540, memory: '1GiB' },
  async (req, res) => {
    const { boardId } = req.query
    if (!boardId) {
      res.status(400).json({ ok: false, error: 'Missing boardId query parameter' })
      return
    }

    try {
      const configSnap = await db.doc('config/access').get()
      const config     = configSnap.data() || {}
      const board      = config.boards?.[boardId]
      const services   = config.services || {}

      if (!board) {
        res.status(404).json({ ok: false, error: `Board ${boardId} not found in config` })
        return
      }
      if (!board.source) {
        res.status(400).json({ ok: false, error: `Board ${boardId} has no source configured (expected 'ares' or 'manual')` })
        return
      }

      const result = await syncBoardBySource(boardId, board, services)
      res.json({ ok: true, boardId, source: board.source, ...result })
    } catch (err) {
      console.error('syncBoardHttp error:', err)
      res.status(500).json({ ok: false, error: err.message })
    }
  },
)

// ─── Scheduled trigger — every 45 minutes ────────────────────────────────────

exports.syncAllBoards = onSchedule(
  { schedule: 'every 45 minutes', region: 'us-central1', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const configSnap = await db.doc('config/access').get()
    const config     = configSnap.data() || {}
    const services   = config.services || {}
    const boards     = Object.entries(config.boards || {})
      .filter(([, b]) => b && (b.source === 'manual' || b.source === 'ares'))

    if (!boards.length) {
      console.log('syncAllBoards: no boards to sync')
      return
    }

    let succeeded = 0
    let failed    = 0

    // Sequential per-board with INTER_BOARD_DELAY_MS pause. The user-specified
    // "slowly" pacing — we never run two board syncs in parallel.
    for (const [boardId, board] of boards) {
      try {
        const r = await syncBoardBySource(boardId, board, services)
        succeeded++
        console.log(`Synced ${boardId} (${board.source}): active=${r.activeCount} done=${r.doneCount} incremental=${r.incremental}`)
      } catch (e) {
        failed++
        console.error(`Failed to sync ${boardId} (${board.source}):`, e.message)
      }
      await sleep(INTER_BOARD_DELAY_MS)
    }

    console.log(`syncAllBoards complete: ${succeeded} succeeded, ${failed} failed, of ${boards.length} total`)
  },
)
