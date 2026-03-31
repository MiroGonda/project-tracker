# Pipeline API Guide

External API for accessing Ares pipeline data (Trello boards, cards, movements, cycle time).

**Base URL:** `https://<your-ares-host>/api/v1/trello`

---

## Authentication

Every request requires an API key in the `X-API-Key` header. Keys are provisioned by your Ares admin (server-side env var `TRELLO_EXTERNAL_API_KEYS`).

```bash
curl -H "X-API-Key: YOUR_KEY" https://<your-ares-host>/api/v1/trello/boards
```

```javascript
const res = await fetch('https://<your-ares-host>/api/v1/trello/boards', {
  headers: { 'X-API-Key': 'YOUR_KEY' }
});
const { ok, data } = await res.json();
```

```python
import requests

resp = requests.get(
    "https://<your-ares-host>/api/v1/trello/boards",
    headers={"X-API-Key": "YOUR_KEY"}
)
data = resp.json()["data"]
```

| Status | Meaning |
|--------|---------|
| `401` | Missing or invalid API key |
| `503` | API keys haven't been configured on the server |

---

## Rate Limits

**60 requests per minute** per API key. Response headers:

| Header | Meaning |
|--------|---------|
| `X-RateLimit-Limit` | Max requests per 60-second window |
| `X-RateLimit-Remaining` | Requests left in the current window |
| `X-RateLimit-Reset` | Seconds until the window resets |

When exceeded, returns `429` with `retryAfter` (seconds to wait):

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "retryAfter": 42
  }
}
```

---

## Response Format

All responses use a standard envelope. Check `"ok"` first.

### Success

```json
{
  "ok": true,
  "data": [ ... ],
  "meta": {
    "timestamp": "2026-03-18T08:00:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Paginated Success

```json
{
  "ok": true,
  "data": [ ... ],
  "meta": {
    "timestamp": "2026-03-18T08:00:00.000Z",
    "requestId": "...",
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "total": 127,
      "totalPages": 3
    }
  }
}
```

### Error

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Board not found or has no tracked cards"
  },
  "meta": {
    "timestamp": "2026-03-18T08:00:00.000Z",
    "requestId": "..."
  }
}
```

---

## Endpoints

### GET /boards

List all tracked Trello boards with card counts.

**Parameters:** None

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "boardId": "hLL7WW2V",
      "projectName": "GCash: Design Support 2026",
      "activeCards": 24,
      "doneCards": 12,
      "totalCards": 36
    }
  ]
}
```

Use the `boardId` from this response as the `:boardId` path parameter in other endpoints.

```bash
curl -H "X-API-Key: YOUR_KEY" https://<your-ares-host>/api/v1/trello/boards
```

---

### GET /boards/:boardId/cards

Cards for a specific board. Defaults to active cards only.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `active` | Filter: `active`, `done` |
| `list` | string | — | Filter by list name (case-insensitive, partial match) |
| `label` | string | — | Filter by label name (case-insensitive, partial match) |
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `50` | Results per page (max 200) |

**Response (each card):**

```json
{
  "boardId": "hLL7WW2V",
  "name": "Homepage hero banner redesign",
  "currentList": "Working On",
  "status": "active",
  "members": [
    { "fullName": "Jane Doe", "username": "janedoe" }
  ],
  "labels": [
    { "name": "Urgent", "color": "red" }
  ],
  "due": "2026-03-01T00:00:00.000Z",
  "dateLastActivity": "2026-03-17T14:22:00.000Z"
}
```

```bash
# Get active cards
curl -H "X-API-Key: YOUR_KEY" \
     "https://<your-ares-host>/api/v1/trello/boards/hLL7WW2V/cards"

# Get done cards, page 2
curl -H "X-API-Key: YOUR_KEY" \
     "https://<your-ares-host>/api/v1/trello/boards/hLL7WW2V/cards?status=done&page=2"

# Filter by list name
curl -H "X-API-Key: YOUR_KEY" \
     "https://<your-ares-host>/api/v1/trello/boards/hLL7WW2V/cards?list=Working"
```

---

### GET /boards/:boardId/movements

Card movement events (list-to-list transitions) within a date range. Useful for tracking workflow throughput.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `dateFrom` | string | `2020-01-01` | Start date (YYYY-MM-DD) |
| `dateTo` | string | today | End date (YYYY-MM-DD) |
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `50` | Results per page (max 200) |

```bash
# Movements in March 2026
curl -H "X-API-Key: YOUR_KEY" \
     "https://<your-ares-host>/api/v1/trello/boards/hLL7WW2V/movements?dateFrom=2026-03-01&dateTo=2026-03-31"
```

---

### GET /boards/:boardId/summary

High-level overview of a board: card counts per list, recent movements, and health status.

**Parameters:** `boardId` in path

Returns `404` if the board has no tracked cards.

```bash
curl -H "X-API-Key: YOUR_KEY" \
     https://<your-ares-host>/api/v1/trello/boards/hLL7WW2V/summary
```

---

### GET /cards/:cardId

Single card with full metadata and movement history.

**Parameters:** `cardId` in path (MongoDB `_id` or Trello card ID)

Returns `404` if the card is not found.

```bash
curl -H "X-API-Key: YOUR_KEY" \
     https://<your-ares-host>/api/v1/trello/cards/65a1b2c3d4e5f6a7b8c9d0e1
```

---

### GET /cycle-time

Cycle time data for cards in a Raintool project. Measures how long cards take to move through the pipeline.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `rtProjectId` | string | — | **Required.** Raintool project ID |
| `dateFrom` | string | `2020-01-01` | Start date (YYYY-MM-DD) |
| `dateTo` | string | today | End date (YYYY-MM-DD) |
| `status` | string | `all` | Filter: `all`, `active`, `done` |
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `50` | Results per page (max 200) |

Returns `400` if `rtProjectId` is missing.

```bash
# Cycle time for completed cards in Q1 2026
curl -H "X-API-Key: YOUR_KEY" \
     "https://<your-ares-host>/api/v1/trello/cycle-time?rtProjectId=12345&status=done&dateFrom=2026-01-01&dateTo=2026-03-31"
```

---

## Pagination

Paginated endpoints accept `page` and `pageSize` query parameters.

| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `page` | 1 | 1+ | Which page to return |
| `pageSize` | 50 | 1–200 | Results per page |

The `meta.pagination` object tells you where you are:

```json
{
  "page": 2,
  "pageSize": 50,
  "total": 127,
  "totalPages": 3
}
```

To fetch all results, loop until `page >= totalPages`, or set `pageSize=200` to minimize requests.

---

## Error Codes

| HTTP Status | Error Code | When |
|-------------|------------|------|
| `400` | `BAD_REQUEST` | Missing required parameter (e.g., `rtProjectId`) |
| `401` | `UNAUTHORIZED` | Missing or invalid API key |
| `404` | `NOT_FOUND` | Board or card not found |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many requests — wait `retryAfter` seconds |
| `503` | `SERVICE_UNAVAILABLE` | External API not configured on the server |
