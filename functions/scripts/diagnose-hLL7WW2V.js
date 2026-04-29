// Phase 0e Item 1 diagnostic — read-only.
// Pulls cache/ares_hLL7WW2V from Firestore, groups activeCards by currentList,
// and cross-references against the LANE_MAP shipped in functions/index.js.
//
// Run from functions/:
//   node scripts/diagnose-hLL7WW2V.js
//
// Auth: uses Application Default Credentials. If you don't have ADC set up,
// run `gcloud auth application-default login` first (or pass GOOGLE_APPLICATION_CREDENTIALS).

'use strict'
const admin = require('firebase-admin')
admin.initializeApp({ projectId: 'phobos-9246e' })

// Pull LANE_MAP from the same module the Cloud Function uses, so this stays in
// sync with what the production sync writes.
const fnSource = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8')
const laneMapMatch = fnSource.match(/const LANE_MAP = \{[\s\S]*?\n\}/)
// eslint-disable-next-line no-eval
const LANE_MAP = eval('(' + laneMapMatch[0].replace(/^const LANE_MAP =/, '') + ')')

;(async () => {
  const snap = await admin.firestore().doc('cache/ares_hLL7WW2V').get()
  if (!snap.exists) { console.error('cache/ares_hLL7WW2V not found'); process.exit(1) }
  const data = snap.data()
  const active = data.activeCards || []
  const done = data.doneCards || []

  console.log(`activeCards: ${active.length}`)
  console.log(`doneCards (capped): ${done.length}  (uncapped total: ${data.doneCardsTotalAvailable ?? 'n/a'})`)
  console.log('')

  // Group by currentList
  const byLane = new Map()
  for (const c of active) {
    const lane = c.currentList || '(no list)'
    if (!byLane.has(lane)) byLane.set(lane, [])
    byLane.get(lane).push(c)
  }

  // Sort by count desc
  const rows = [...byLane.entries()].sort((a, b) => b[1].length - a[1].length)

  console.log(`Unique lanes in active set: ${rows.length}`)
  console.log('')
  console.log('Lane                                                   Count   InMap   Status        Type           Category')
  console.log('-----------------------------------------------------  ------  ------  ------------  -------------  ---------')
  const missing = []
  const suspectDone = []
  for (const [lane, cards] of rows) {
    const mapped = LANE_MAP[lane]
    const inMap = !!mapped
    const status = mapped?.status || '—'
    const type = mapped?.type || '—'
    const cat = mapped?.category || '—'
    console.log(`${lane.padEnd(54).slice(0,54)}  ${String(cards.length).padStart(6)}  ${(inMap?'YES':'NO ').padEnd(6)}  ${status.padEnd(12)}  ${type.padEnd(13)}  ${cat}`)
    if (!inMap) missing.push({ lane, count: cards.length })
    if (mapped && mapped.status !== 'Done' && /approved|delivered|closed|archive|complete|done|released|completed|published|live|ship|shipped/i.test(lane)) {
      suspectDone.push({ lane, count: cards.length, status: mapped.status })
    }
  }

  console.log('')
  console.log(`Lanes missing from LANE_MAP: ${missing.length}`)
  for (const m of missing) console.log(`  • ${m.lane}  (${m.count} cards)`)

  console.log('')
  console.log(`Lanes that SOUND like Done but aren't mapped Done: ${suspectDone.length}`)
  for (const s of suspectDone) console.log(`  • ${s.lane}  (${s.count} cards, currently mapped: ${s.status})`)

  // Cards with completion-ish fields but classified active
  const completedish = active.filter(c => c.dateCompleted || c.completedAt || c.dueComplete === true)
  console.log('')
  console.log(`Active cards with completion-ish field set: ${completedish.length}`)
  if (completedish.length) {
    for (const c of completedish.slice(0, 15)) {
      console.log(`  • ${c.id} "${c.name?.slice(0,60) || '(no name)'}" lane="${c.currentList}" completedAt=${c.completedAt || c.dateCompleted || ''} dueComplete=${c.dueComplete}`)
    }
    if (completedish.length > 15) console.log(`  …and ${completedish.length - 15} more`)
  }

  process.exit(0)
})().catch(err => { console.error(err.stack || err.message); process.exit(1) })
