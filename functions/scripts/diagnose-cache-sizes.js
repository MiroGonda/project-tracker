// Phase 0e Item 2 diagnostic — read-only. Reports doneCards.length and
// doneCardsTotalAvailable for each cache/* doc, to verify whether the
// retention cap is actually being applied on every write.
//
// Run from functions/:
//   node scripts/diagnose-cache-sizes.js

'use strict'
const admin = require('firebase-admin')
admin.initializeApp({ projectId: 'phobos-9246e' })

;(async () => {
  const cols = await admin.firestore().collection('cache').get()
  const rows = []
  cols.forEach(d => {
    const data = d.data()
    rows.push({
      id:                       d.id,
      source:                   data.source || '?',
      activeCards:              (data.activeCards || []).length,
      doneCards:                (data.doneCards || []).length,
      doneCardsTotalAvailable:  data.doneCardsTotalAvailable ?? null,
      lastSyncStatus:           data.lastSyncStatus || '?',
      consecutiveFailures:      data.consecutiveFailures ?? 0,
      lastSuccessfulSync:       data.lastSuccessfulSync?.toDate?.()?.toISOString?.() || null,
      lastSyncError:            data.lastSyncError || null,
    })
  })
  rows.sort((a, b) => b.doneCards - a.doneCards)
  console.log('cache doc                            src     active   done   uncap   status     fails  lastOK')
  console.log('-----------------------------------  ------  ------  -----  ------  ---------  -----  ---------------------')
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(35)}  ${r.source.padEnd(6)}  ${String(r.activeCards).padStart(6)}  ${String(r.doneCards).padStart(5)}  ${String(r.doneCardsTotalAvailable ?? '-').padStart(6)}  ${r.lastSyncStatus.padEnd(9)}  ${String(r.consecutiveFailures).padStart(5)}  ${r.lastSuccessfulSync || ''}`
    )
    if (r.lastSyncError) console.log(`    └─ error: ${r.lastSyncError}`)
  }
  process.exit(0)
})().catch(e => { console.error(e.stack || e.message); process.exit(1) })
