/**
 * Trello → Firestore sync functions
 *
 * HTTP trigger:   syncBoardHttp?boardId=<id>
 *   URL: https://us-central1-phobos-9246e.cloudfunctions.net/syncBoardHttp
 *   Called by the frontend refresh button on manual boards.
 *
 * Scheduled:      syncAllBoards (every 30 minutes)
 *   Reads all manual boards from config/access and syncs each one.
 *
 * Output document: cache/manual_{boardId}
 *   { activeCards, doneCards, completionDates, activatedDates, cycleDays, updatedAt }
 *
 * Set credentials once before deploying:
 *   firebase functions:secrets:set TRELLO_KEY    (paste your API key when prompted)
 *   firebase functions:secrets:set TRELLO_TOKEN  (paste your token when prompted)
 */

'use strict'

const { onRequest }  = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const admin            = require('firebase-admin')

const TRELLO_KEY   = defineSecret('TRELLO_KEY')
const TRELLO_TOKEN = defineSecret('TRELLO_TOKEN')

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
  '-> Render: Sent for Client Approval':          { type: 'Process Lane', category: 'Assets',   status: 'For Approval' },
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

// ─── Trello API helpers ────────────────────────────────────────────────────────

const TRELLO_BASE = 'https://api.trello.com/1'

function qs(key, token, extra = {}) {
  return new URLSearchParams({ key, token, ...extra }).toString()
}

async function fetchCards(shortBoardId, key, token) {
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

async function fetchActions(shortBoardId, key, token, since = null) {
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

// ─── Core sync logic ───────────────────────────────────────────────────────────

async function syncBoard(boardId, trelloShortId, key, token) {
  // Load existing cache — used to seed maps for incremental action merging
  const cacheRef  = db.doc(`cache/manual_${boardId}`)
  const cacheSnap = await cacheRef.get()
  const existing  = cacheSnap.exists ? cacheSnap.data() : null
  const since     = existing?.lastActionDate || null

  // Fetch cards (always full — we need current board state) +
  // only actions newer than the last sync (full history on first run)
  const [allCards, newActions] = await Promise.all([
    fetchCards(trelloShortId, key, token),
    fetchActions(trelloShortId, key, token, since),
  ])

  // Split by LANE_MAP — mirrors BoardPage.jsx getLaneInfo() logic
  const activeCards = allCards.filter(c => {
    const lane = LANE_MAP[c.currentList]
    return !lane || (lane.status !== 'Done' && lane.category !== 'Discarded')
  })
  const doneCards = allCards.filter(c => LANE_MAP[c.currentList]?.status === 'Done')

  // Seed maps from existing cache, then layer in new actions
  const completionMap    = new Map(Object.entries(existing?.completionDates || {}))
  const firstActivatedAt = new Map(Object.entries(existing?.activatedDates  || {}))

  for (const a of newActions) {
    const toList   = a.data?.listAfter?.name  || ''
    const fromList = a.data?.listBefore?.name || ''
    const cardId   = a.data?.card?.id
    const date     = a.date
    if (!cardId || !date) continue

    // Completion: keep the most recent move to a Done lane
    if (LANE_MAP[toList]?.status === 'Done') {
      const ex = completionMap.get(cardId)
      if (!ex || new Date(date) > new Date(ex)) completionMap.set(cardId, date)
    }

    // First activation: keep the earliest move out of a Pending lane
    if (LANE_MAP[fromList]?.status === 'Pending') {
      const ex = firstActivatedAt.get(cardId)
      if (!ex || new Date(date) < new Date(ex)) firstActivatedAt.set(cardId, date)
    }
  }

  // Cycle days = completion − first activation
  const cycleDays = {}
  for (const [cardId, completionDate] of completionMap) {
    const startDate = firstActivatedAt.get(cardId)
    if (!startDate) continue
    const days = (new Date(completionDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
    if (days >= 0) cycleDays[cardId] = Math.round(days * 10) / 10
  }

  // Advance the cursor: use the date of the most recent new action so the next
  // sync only fetches actions that arrived after this one.
  const lastActionDate = newActions.length > 0
    ? newActions[0].date                   // actions are newest-first
    : (existing?.lastActionDate || null)

  await cacheRef.set({
    activeCards,
    doneCards,
    completionDates: Object.fromEntries(completionMap),
    activatedDates:  Object.fromEntries(firstActivatedAt),
    cycleDays,
    updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
    lastActionDate,
    boardId,
    trelloShortId,
  })

  return {
    activeCount: activeCards.length,
    doneCount:   doneCards.length,
    newActions:  newActions.length,
    incremental: !!since,
  }
}

// ─── HTTP trigger — called by the frontend refresh button ─────────────────────
// URL: https://us-central1-phobos-9246e.cloudfunctions.net/syncBoardHttp?boardId=<id>

exports.syncBoardHttp = onRequest(
  { secrets: [TRELLO_KEY, TRELLO_TOKEN], region: 'us-central1', cors: true, invoker: 'public' },
  async (req, res) => {
    const key   = TRELLO_KEY.value()
    const token = TRELLO_TOKEN.value()

    const { boardId } = req.query
    if (!boardId) {
      res.status(400).json({ ok: false, error: 'Missing boardId query parameter' })
      return
    }

    try {
      const configSnap = await db.doc('config/access').get()
      const config     = configSnap.data() || {}
      const board      = config.boards?.[boardId]

      if (!board)                    { res.status(404).json({ ok: false, error: `Board ${boardId} not found in config` }); return }
      if (board.source !== 'manual') { res.status(400).json({ ok: false, error: 'Board is not configured as manual' }); return }
      if (!board.trelloShortId)      { res.status(400).json({ ok: false, error: 'Board has no trelloShortId configured' }); return }

      const result = await syncBoard(boardId, board.trelloShortId, key, token)
      res.json({ ok: true, boardId, ...result })
    } catch (err) {
      console.error('syncBoardHttp error:', err)
      res.status(500).json({ ok: false, error: err.message })
    }
  },
)

// ─── Scheduled trigger — background sync every 30 minutes ────────────────────

exports.syncAllBoards = onSchedule(
  { schedule: 'every 30 minutes', secrets: [TRELLO_KEY, TRELLO_TOKEN], region: 'us-central1' },
  async () => {
    const key   = TRELLO_KEY.value()
    const token = TRELLO_TOKEN.value()

    const configSnap   = await db.doc('config/access').get()
    const config       = configSnap.data() || {}
    const manualBoards = Object.entries(config.boards || {})
      .filter(([, b]) => b.source === 'manual' && b.trelloShortId)

    if (!manualBoards.length) {
      console.log('syncAllBoards: no manual boards found')
      return
    }

    await Promise.allSettled(
      manualBoards.map(([boardId, board]) =>
        syncBoard(boardId, board.trelloShortId, key, token)
          .then(r  => console.log(`Synced ${boardId} (${board.trelloShortId}): ${r.activeCount} active, ${r.doneCount} done`))
          .catch(e => console.error(`Failed to sync ${boardId}:`, e.message))
      )
    )
  },
)
