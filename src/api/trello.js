const BASE = 'https://api.trello.com/1'

function getCreds() {
  return {
    key:   localStorage.getItem('trello_api_key') || '',
    token: localStorage.getItem('trello_token')   || '',
  }
}

function qs(extra = {}) {
  const { key, token } = getCreds()
  return new URLSearchParams({ key, token, ...extra }).toString()
}

/** GET /1/boards/:boardId/labels */
export async function fetchBoardLabels(boardId) {
  const r = await fetch(`${BASE}/boards/${boardId}/labels?${qs()}`)
  if (!r.ok) throw new Error(`Trello ${r.status}: ${await r.text()}`)
  return r.json()
}

/** POST /1/boards/:boardId/labels */
export async function createBoardLabel(boardId, name, color = null) {
  const r = await fetch(`${BASE}/boards/${boardId}/labels?${qs({ name, ...(color ? { color } : {}) })}`, { method: 'POST' })
  if (!r.ok) throw new Error(`Trello ${r.status}: ${await r.text()}`)
  return r.json()
}

/**
 * POST /1/cards/:cardId/idLabels
 * Returns { status } — 400 means the card already has this label (not a real error).
 */
export async function addLabelToCard(cardId, labelId) {
  const r = await fetch(`${BASE}/cards/${cardId}/idLabels?${qs({ value: labelId })}`, { method: 'POST' })
  return r
}

/** DELETE /1/cards/:cardId/idLabels/:labelId */
export async function removeLabelFromCard(cardId, labelId) {
  const r = await fetch(`${BASE}/cards/${cardId}/idLabels/${labelId}?${qs()}`, { method: 'DELETE' })
  return r
}

/** DELETE /1/cards/:cardId */
export async function deleteCard(cardId) {
  const r = await fetch(`${BASE}/cards/${cardId}?${qs()}`, { method: 'DELETE' })
  return r
}

/** PUT /1/cards/:cardId — set or clear due date */
export async function setCardDue(cardId, due) {
  // due: ISO string to set, null to clear
  const r = await fetch(`${BASE}/cards/${cardId}?${qs({ due: due ?? 'null' })}`, { method: 'PUT' })
  return r
}

// ─── Custom Fields ────────────────────────────────────────────────────────────

/** GET /1/boards/:boardId/customFields */
export async function fetchBoardCustomFields(boardId) {
  const r = await fetch(`${BASE}/boards/${boardId}/customFields?${qs()}`)
  if (!r.ok) throw new Error(`Trello ${r.status}: ${await r.text()}`)
  return r.json()
}

/** GET /1/boards/:boardId?fields=id — resolves short ID to full 24-char ID */
export async function fetchBoardFullId(boardId) {
  const r = await fetch(`${BASE}/boards/${boardId}?${qs({ fields: 'id' })}`)
  if (!r.ok) throw new Error(`Trello ${r.status}: ${await r.text()}`)
  const data = await r.json()
  return data.id
}

/** POST /1/customFields — creates a date-type custom field on a board */
export async function createCustomField(boardId, name) {
  const fullId = await fetchBoardFullId(boardId)
  const r = await fetch(`${BASE}/customFields?${qs({
    idModel: fullId,
    modelType: 'board',
    name,
    type: 'date',
    pos: 'bottom',
    display_cardFront: 'true',
  })}`, { method: 'POST' })
  if (!r.ok) throw new Error(`Trello ${r.status}: ${await r.text()}`)
  return r.json()
}

/**
 * GET /1/boards/:boardId/cards?customFieldItems=true&fields=id&filter=open
 * Returns array of { id, customFieldItems: [{ idCustomField, value: { date } }] }
 */
export async function fetchBoardCardsWithFields(boardId) {
  const r = await fetch(`${BASE}/boards/${boardId}/cards?${qs({ customFieldItems: 'true', fields: 'id', filter: 'open' })}`)
  if (!r.ok) throw new Error(`Trello ${r.status}: ${await r.text()}`)
  return r.json()
}

/**
 * PUT /1/cards/:cardId/customField/:fieldId/item
 * isoDate: ISO string to set, null/undefined to clear.
 */
export async function setCardCustomField(cardId, fieldId, isoDate) {
  const r = await fetch(`${BASE}/cards/${cardId}/customField/${fieldId}/item?${qs()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: isoDate ? { date: isoDate } : {} }),
  })
  return r
}

/**
 * Fetch all open cards from a Trello board (by short ID or full ID) and
 * normalize them to match the Phobos card shape expected by BoardPage.
 * Returns a flat array of all cards — caller splits into active/done by LANE_MAP.
 *
 * Normalized shape: { id, name, currentList, labels, due, dateLastActivity, members }
 * — compatible with extractList(), extractLabels(), extractMembers(), getLaneInfo()
 *   and every other card helper in BoardPage without modification.
 */
export async function fetchTrelloBoardCards(shortBoardId) {
  const [listsRes, cardsRes] = await Promise.all([
    fetch(`${BASE}/boards/${shortBoardId}/lists?${qs({ filter: 'open', fields: 'id,name' })}`),
    fetch(`${BASE}/boards/${shortBoardId}/cards?${qs({
      filter:       'open',
      fields:       'id,name,idList,labels,due,dateLastActivity',
      members:      'true',
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
    labels:           (c.labels   || []).map(l => ({ id: l.id, name: l.name, color: l.color })),
    due:              c.due              || null,
    dateLastActivity: c.dateLastActivity || null,
    members:          (c.members  || []).map(m => ({ fullName: m.fullName, username: m.username })),
  }))
}

/**
 * GET /1/boards/:boardId/actions?filter=updateCard:idList
 * Returns card list-change actions for the board (paginated, newest first).
 * Each action: { id, date, data: { card: { id }, listBefore: { name }, listAfter: { name } } }
 *
 * since: optional ISO string — only return actions newer than this date (incremental fetch).
 *        Omit for a full history fetch.
 */
export async function fetchBoardActions(shortBoardId, since = null) {
  const allActions = []
  const limit = 1000
  let before = null

  while (true) {
    const params = { filter: 'updateCard:idList', limit, fields: 'date,data' }
    if (before) params.before = before
    if (since)  params.since  = since
    const r = await fetch(`${BASE}/boards/${shortBoardId}/actions?${qs(params)}`)
    if (!r.ok) throw new Error(`Trello actions ${r.status}: ${await r.text()}`)
    const batch = await r.json()
    if (!batch.length) break
    allActions.push(...batch)
    if (batch.length < limit) break
    before = batch[batch.length - 1].id
  }

  return allActions
}
