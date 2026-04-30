// Phase 0e Item 5 diagnostic — read-only.
// 1. Pulls config/access from Firestore.
// 2. Locates any board whose trelloShortId === "ArYIZvEC" (or any duplicate
//    shortLinks across boards, which would also produce stale-load behavior).
// 3. For each matching board, reads cache/{source}_{boardId} for last-sync
//    health, and probes the Trello API for the shortLink resolution.
//
// Run from functions/:
//   node scripts/diagnose-stale-shortlink.js [shortLink]
//
// shortLink defaults to "ArYIZvEC".

'use strict'
const admin = require('firebase-admin')
admin.initializeApp({ projectId: 'phobos-9246e' })

const TARGET = process.argv[2] || 'ArYIZvEC'

;(async () => {
  const db = admin.firestore()
  const cfgSnap = await db.doc('config/access').get()
  if (!cfgSnap.exists) { console.error('config/access not found'); process.exit(1) }
  const cfg = cfgSnap.data() || {}
  const boards = cfg.boards || {}
  const services = cfg.services || {}

  const matches = Object.entries(boards).filter(([, b]) => b?.trelloShortId === TARGET)
  console.log(`Boards with trelloShortId === "${TARGET}": ${matches.length}`)
  for (const [id, b] of matches) {
    console.log('---')
    console.log(`  configBoardId:      ${id}`)
    console.log(`  name:               ${b.name || '(none)'}`)
    console.log(`  source:             ${b.source || '(none)'}`)
    console.log(`  trelloShortId:      ${b.trelloShortId}`)
    console.log(`  startDate:          ${b.startDate || '(none)'}`)
    console.log(`  endDate:            ${b.endDate   || '(none)'}`)
    console.log(`  slaDays:            ${b.slaDays   ?? '(none)'}`)
    console.log(`  frostUsers:         ${(b.frostUsers || []).length}  ${JSON.stringify(b.frostUsers || [])}`)
    console.log(`  externalUsers:      ${(b.externalUsers || []).length}  ${JSON.stringify(b.externalUsers || [])}`)
    console.log(`  legacy users[]:     ${(b.users || []).length}  ${JSON.stringify(b.users || [])}`)
    console.log(`  customColumns:      ${(b.customColumns || []).length}`)

    // Cache state
    const cachePath = b.source === 'ares' ? `cache/ares_${id}` : `cache/manual_${id}`
    const cSnap = await db.doc(cachePath).get()
    if (!cSnap.exists) {
      console.log(`  cache (${cachePath}): MISSING`)
    } else {
      const c = cSnap.data()
      console.log(`  cache (${cachePath}):`)
      console.log(`    lastSyncStatus:       ${c.lastSyncStatus || '(none)'}`)
      console.log(`    consecutiveFailures:  ${c.consecutiveFailures ?? 0}`)
      console.log(`    lastSyncError:        ${c.lastSyncError || '(none)'}`)
      console.log(`    lastSuccessfulSync:   ${c.lastSuccessfulSync?.toDate?.()?.toISOString?.() || '(none)'}`)
      console.log(`    activeCards.length:   ${(c.activeCards || []).length}`)
      console.log(`    doneCards.length:     ${(c.doneCards   || []).length}`)
      console.log(`    doneCardsTotalAvail:  ${c.doneCardsTotalAvailable ?? '(none)'}`)
    }
  }

  // Also check if any OTHER board has trelloShortId duplicating someone else's
  const allShortIds = Object.entries(boards)
    .map(([id, b]) => ({ id, sid: b?.trelloShortId }))
    .filter(x => x.sid)
  const counts = new Map()
  for (const { id, sid } of allShortIds) {
    if (!counts.has(sid)) counts.set(sid, [])
    counts.get(sid).push(id)
  }
  const dupes = [...counts.entries()].filter(([, arr]) => arr.length > 1)
  console.log('\nDuplicate trelloShortIds across boards:', dupes.length)
  for (const [sid, arr] of dupes) console.log(`  ${sid} → ${arr.join(', ')}`)

  // Trello probe — direct lookup against /boards/{shortLink}
  if (services.trelloApiKey && services.trelloToken) {
    const u = `https://api.trello.com/1/boards/${TARGET}?fields=id,name,closed,shortLink,shortUrl&key=${services.trelloApiKey}&token=${services.trelloToken}`
    try {
      const r = await fetch(u)
      const text = await r.text()
      console.log(`\nTrello GET /boards/${TARGET}: ${r.status}`)
      console.log(`  body: ${text.slice(0, 400)}`)
    } catch (e) {
      console.log(`\nTrello probe error: ${e.message}`)
    }
  } else {
    console.log('\nTrello probe skipped — no services.trelloApiKey/Token in config/access')
  }

  process.exit(0)
})().catch(e => { console.error(e.stack || e.message); process.exit(1) })
