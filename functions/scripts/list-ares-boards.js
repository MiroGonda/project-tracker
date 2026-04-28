// One-shot helper for Phase 0d Task 4: list Ares board IDs from config/access
// so we can seed cache/ares_* via syncBoardHttp before the frontend deploys.
//
// Run from functions/ with default credentials (gcloud ADC or Firebase login):
//   node scripts/list-ares-boards.js
//
// Output: one line per Ares board, "boardId\tname".

'use strict'
const admin = require('firebase-admin')
admin.initializeApp({ projectId: 'phobos-9246e' })

;(async () => {
  const snap = await admin.firestore().doc('config/access').get()
  if (!snap.exists) { console.error('config/access not found'); process.exit(1) }
  const cfg = snap.data() || {}
  const entries = Object.entries(cfg.boards || {})
  const ares = entries.filter(([, b]) => b?.source === 'ares')
  const manual = entries.filter(([, b]) => b?.source === 'manual')
  console.log(`Total boards: ${entries.length} (ares=${ares.length}, manual=${manual.length})`)
  console.log('--- ARES ---')
  for (const [id, b] of ares) console.log(`${id}\t${b.name || '(no name)'}`)
  console.log('--- MANUAL ---')
  for (const [id, b] of manual) console.log(`${id}\t${b.name || '(no name)'}\t${b.trelloShortId || '(no trelloShortId)'}`)
  process.exit(0)
})().catch(err => { console.error(err.message); process.exit(1) })
