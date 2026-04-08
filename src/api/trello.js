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
