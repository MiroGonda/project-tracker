# Runn API v1 — Full Reference Documentation

> **Source**: Compiled from the official Runn OpenAPI v3.1 spec at `https://developer.runn.io/openapi/v1.0.0.json`  
> **Version**: 1.0.0  
> **Last captured**: March 2026

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URLs](#base-urls)
- [Versioning](#versioning)
- [Pagination](#pagination)
- [Common Query Parameters](#common-query-parameters)
- [Error Responses](#error-responses)
- [Common Schemas](#common-schemas)
- [Activity Log](#activity-log)
- [Actuals](#actuals)
- [Assignments](#assignments)
- [Clients](#clients)
- [Contracts](#contracts)
- [Custom Fields](#custom-fields)
- [Holiday Groups](#holiday-groups)
- [Invitations](#invitations)
- [Me](#me)
- [People](#people)
- [People Tags](#people-tags)
- [Placeholders](#placeholders)
- [Project Tags](#project-tags)
- [Projects](#projects)
- [Rate Cards](#rate-cards)
- [Reports](#reports)
- [Roles](#roles)
- [Skills](#skills)
- [Teams](#teams)
- [Time Offs](#time-offs)
- [Users](#users)
- [Utility](#utility)
- [Views](#views)
- [Workstreams](#workstreams)

---

## Overview

The Runn API uses REST principles, exposing predictable resource-oriented URLs. It accepts JSON request bodies and returns JSON-encoded responses. Errors are communicated via standard HTTP response codes.

The Runn API v1 base URL is `https://api.runn.io` (EU) or `https://api.us.runn.io` (US). Your specific domain can be found under **Settings > API** in the Runn app. Only administrators can access this page.

---

## Authentication

All endpoints require Bearer token authentication.

```
Authorization: Bearer <YOUR_API_TOKEN>
```

Include this header on every request. Requests without a valid token return `401 Unauthorized`.

---

## Base URLs

| Region | Base URL |
|--------|----------|
| EU (default) | `https://api.runn.io` |
| US | `https://api.us.runn.io` |

---

## Versioning

Every request must include the API version header:

```
accept-version: 1.0.0
```

This is a **required** header on all endpoints.

---

## Pagination

All list endpoints use **cursor-based pagination**. Responses include:

```json
{
  "values": [ ...array of objects... ],
  "nextCursor": "string | null"
}
```

To retrieve the next page, pass `nextCursor` as the `cursor` query parameter. When `nextCursor` is `null`, you have reached the end.

**Common pagination query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | — | Cursor token from previous response |
| `limit` | integer | varies | Items per page (see per-endpoint maximums) |
| `sortBy` | string | `id` | Field to sort by: `id`, `createdAt`, `updatedAt` |
| `order` | string | `asc` | Sort order: `asc` or `desc` |

---

## Common Query Parameters

**`modifiedAfter`** — Present on most list endpoints. Filters results to objects modified after a given timestamp.

- Format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ`

---

## Error Responses

| Status | Schema | Description |
|--------|--------|-------------|
| `400` | `BadRequest` | Malformed request |
| `401` | `Unauthorized` | Missing or invalid token |
| `404` | `NotFound` | Resource not found |
| `409` | `Conflict` | Conflict with existing resource |
| `422` | `UnprocessableEntity` | Validation failed |

**Error schema:**
```json
{
  "error": "Bad Request",
  "message": "Human-readable explanation",
  "statusCode": 400
}
```

---

## Common Schemas

### Reference
External system identifiers attached to Runn objects.
```json
{
  "referenceName": "string (required, minLength: 1)",
  "externalId": "string (required, minLength: 1)"
}
```

### Tag
```json
{
  "id": "integer",
  "name": "string"
}
```

### RosteredDays
Minutes per weekday in a contract schedule. Every value must equal `minutesPerDay` or `0`.
```json
{
  "monday": "number",
  "tuesday": "number",
  "wednesday": "number",
  "thursday": "number",
  "friday": "number"
}
```

### Actor
Represents who performed an action. Determined by the `type` field.

| `type` | Description |
|--------|-------------|
| `user` | A Runn user acting via the web app |
| `api` | An API key |
| `csv` | A CSV file upload |
| `integration` | A third-party integration |
| `system` | Automated system process |
| `runn_support` | The Runn support team |

---

## Activity Log

### List Events
`GET https://api.runn.io/activity-log/`

Returns a paginated list of account events. Only supported for live accounts (not test accounts). More event types will be added over time.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cursor` | string | No | Cursor for pagination |
| `limit` | integer | No | Default: 50, Max: 200 |
| `eventType` | array[string] | No | Filter by type. Values: `project_deleted`, `person_deleted`, `contract_deleted`, `actual_deleted`, `time_off_deleted`, `assignment_deleted` |
| `occurredAfter` | string (date-time) | No | Only return events after this ISO 8601 timestamp |
| `orderBy` | string | No | Default: `desc`. Values: `asc`, `desc` |

**Response `200`:**
```json
{
  "values": [ ...Event objects... ],
  "nextCursor": "string | null"
}
```

**Event Types:**

Each event has `eventId`, `type`, `actor` (Actor schema), and `timestamp` fields, plus a resource-specific object.

| Event Type | Resource Field | Description |
|------------|----------------|-------------|
| `actual_deleted` | `actual` | An actual was deleted |
| `assignment_deleted` | `assignment` | An assignment was deleted |
| `contract_deleted` | `contract` | A contract was deleted |
| `person_deleted` | `person` | A person was deleted |
| `project_deleted` | `project` | A project was deleted |
| `time_off_deleted` | `timeOff` | A time off was deleted |

---

## Actuals

Actuals represent time entries (timesheets). Minutes values represent total time for a day and **overwrite** any previous actual for the same project/person/role/workstream on the same date.

### Create or Update an Actual
`POST https://api.runn.io/actuals/`

**Request Body:**
```json
{
  "date": "YYYY-MM-DD (required)",
  "billableMinutes": "number (default: 0, min: 0)",
  "nonbillableMinutes": "number (default: 0, min: 0)",
  "billableNote": "string (optional)",
  "nonbillableNote": "string (optional)",
  "personId": "number (required)",
  "projectId": "number (required)",
  "roleId": "number (required)",
  "phaseId": "number | null (optional)",
  "workstreamId": "number | null (optional)"
}
```

Either `billableMinutes` or `nonbillableMinutes` must be set.

**Response `201`:** Actual object.

---

### Create or Update Actuals in Bulk
`POST https://api.runn.io/actuals/bulk/`

Create or update up to 100 actuals in a single call.

**Request Body:**
```json
{
  "actuals": [ ...array of ActualInput (min: 1, max: 100)... ]
}
```

**Response `200`:** Array of Actual objects.

---

### Delete a Specific Actual
`DELETE https://api.runn.io/actuals/{actualId}/`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `actualId` | integer | Unique identifier of the actual |

**Response `204`:** No content on success.
**Response `404`:** Actual not found.

---

### List Actuals
`GET https://api.runn.io/actuals/`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | — | Pagination cursor |
| `limit` | integer | 100 | Max: 500 |
| `sortBy` | string | `id` | `createdAt`, `updatedAt`, or `id` |
| `order` | string | `asc` | `asc` or `desc` |
| `minDate` | date | — | Start date filter (YYYY-MM-DD) |
| `maxDate` | date | — | End date filter inclusive (YYYY-MM-DD) |
| `projectId` | integer | — | Filter by project |
| `roleId` | integer | — | Filter by role |
| `personId` | integer | — | Filter by person |
| `workstreamId` | integer | — | Filter by workstream |
| `modifiedAfter` | date/datetime | — | Filter by modification time |

**Response `200`:**
```json
{
  "values": [ ...Actual objects... ],
  "nextCursor": "string | null"
}
```

**Actual Object:**
```json
{
  "id": "integer",
  "date": "YYYY-MM-DD",
  "billableMinutes": "number",
  "nonbillableMinutes": "number",
  "billableNote": "string | null",
  "nonbillableNote": "string | null",
  "phaseId": "number | null",
  "personId": "number",
  "projectId": "number",
  "roleId": "number",
  "workstreamId": "number | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Update an Actual (Time Entry)
`POST https://api.runn.io/actuals/time-entry`

Adds minutes to a matching actual rather than overwriting. Creates a new actual if none exists.

**Request Body:**
```json
{
  "date": "YYYY-MM-DD (required)",
  "billableMinutes": "number (default: 0)",
  "nonbillableMinutes": "number (default: 0)",
  "billableNote": "string (optional)",
  "nonbillableNote": "string (optional)",
  "personId": "number (required)",
  "projectId": "number (required)",
  "roleId": "number (required)",
  "phaseId": "number | null (optional — undefined = no change, null = clear, value = update)",
  "workstreamId": "number | null (optional — same semantics as phaseId)"
}
```

**Response `201`:** Updated Actual object.

---

## Assignments

### Create an Assignment
`POST https://api.runn.io/assignments/`

Creates a new assignment. If the specified period overlaps with scheduled leave, the assignment is automatically split into segments.

**Request Body:**
```json
{
  "personId": "number (required)",
  "projectId": "number (required)",
  "roleId": "number (required)",
  "startDate": "YYYY-MM-DD (required)",
  "endDate": "YYYY-MM-DD (required)",
  "minutesPerDay": "number (required, min: 0, default: 0)",
  "phaseId": "number | null (optional)",
  "note": "string (optional)",
  "isBillable": "boolean (default: true)",
  "isNonWorkingDay": "boolean (optional — auto-set if omitted)",
  "workstreamId": "number | null (optional)"
}
```

> When `isNonWorkingDay` is `true`, `endDate` must equal `startDate`.

**Response `201`:** Array of Assignment objects (may be multiple if split due to leave overlap).

---

### Delete an Assignment
`DELETE https://api.runn.io/assignments/{assignmentId}/`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `assignmentId` | integer | Assignment ID |

**Response `200`:** Deleted Assignment object.

---

### List Assignments
`GET https://api.runn.io/assignments/`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | — | Pagination cursor |
| `limit` | integer | 100 | Max: 500 |
| `sortBy` | string | `id` | `createdAt`, `updatedAt`, or `id` |
| `order` | string | `asc` | `asc` or `desc` |
| `personId` | integer | — | Filter by person |
| `roleId` | integer | — | Filter by role |
| `projectId` | integer | — | Filter by project |
| `startDate` | date | — | Include assignments overlapping this start date |
| `endDate` | date | — | Include assignments overlapping this end date |
| `modifiedAfter` | date/datetime | — | |

**Response `200`:**
```json
{
  "values": [ ...Assignment objects... ],
  "nextCursor": "string | null"
}
```

**Assignment Object:**
```json
{
  "id": "integer",
  "personId": "integer",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "projectId": "integer",
  "minutesPerDay": "integer",
  "roleId": "integer",
  "isActive": "boolean",
  "note": "string | null",
  "isBillable": "boolean",
  "phaseId": "integer | null",
  "isNonWorkingDay": "boolean",
  "isTemplate": "boolean",
  "isPlaceholder": "boolean",
  "workstreamId": "number | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

## Clients

### Create a Client
`POST https://api.runn.io/clients/`

**Request Body:**
```json
{
  "name": "string (required, minLength: 1)",
  "website": "string (url, optional)",
  "references": [ ...Reference objects... ]
}
```

**Response `201`:** Client object.

---

### Create Clients in Bulk
`POST https://api.runn.io/clients/bulk/`

Create up to 100 clients in a single call.

**Request Body:**
```json
{
  "clients": [ ...ClientInput objects (min: 1, max: 100)... ]
}
```

**Response `200`:** Array of Client objects.

---

### List Clients
`GET https://api.runn.io/clients/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No | Case-insensitive substring match |
| `sortBy` | string | Yes | `id`, `createdAt`, or `updatedAt` |
| `order` | string | No | `asc` or `desc` (default: `asc`) |
| `cursor` | string | No | Pagination cursor |
| `limit` | integer | No | Default: 50, Max: 200 |
| `modifiedAfter` | date/datetime | No | |

**Response `200`:**
```json
{
  "values": [ ...Client objects... ],
  "nextCursor": "string | null"
}
```

**Client Object:**
```json
{
  "id": "integer",
  "name": "string",
  "website": "string | null",
  "isArchived": "boolean",
  "references": [ ...Reference objects... ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### List a Client's Projects
`GET https://api.runn.io/clients/{clientId}/projects/`

**Path Parameters:** `clientId` (integer)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeArchived` | boolean | Yes | Default: `false` |
| `cursor` | string | No | |
| `limit` | integer | No | Default: 50, Max: 200 |
| `modifiedAfter` | date/datetime | No | |

**Response `200`:** Paginated list of Project objects.

---

### Show a Client
`GET https://api.runn.io/clients/{clientId}`

**Response `200`:** Client object.

---

### Update a Client
`PATCH https://api.runn.io/clients/{clientId}`

**Request Body** (all fields optional):
```json
{
  "name": "string (minLength: 1)",
  "website": "string (url)",
  "isArchived": "boolean",
  "references": [ ...Reference objects... ]
}
```

**Response `200`:** Updated Client object.

---

## Contracts

Contracts define a person's role, rate, and working schedule for a date range. A person can have multiple contracts over time.

### List Contracts
`GET https://api.runn.io/contracts/`

See also `GET /people/{personId}/contracts` for a specific person.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sortBy` | string | Yes | `id`, `createdAt`, or `updatedAt` |
| `order` | string | No | `asc` or `desc` |
| `cursor` | string | No | |
| `limit` | integer | No | Default: 50, Max: 200 |
| `modifiedAfter` | date/datetime | No | |

**Response `200`:** Paginated list of Contract objects.

**Contract Object:**
```json
{
  "id": "integer",
  "personId": "integer",
  "roleId": "integer",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD | null",
  "employmentType": "employee | contractor",
  "costPerHour": "number | null",
  "minutesPerDay": "number | null",
  "rosteredDays": { ...RosteredDays... },
  "jobTitle": "string | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Update a Contract
`PATCH https://api.runn.io/contracts/{contractId}`

**Path Parameters:** `contractId` (integer)

**Request Body** (all fields optional):
```json
{
  "roleId": "number",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD | null",
  "employmentType": "employee | contractor",
  "costPerHour": "number",
  "minutesPerDay": "number (min: 1)",
  "rosteredDays": { ...RosteredDays... },
  "jobTitle": "string"
}
```

**Response `200`:** Updated Contract object.

---

## Custom Fields

Custom fields can be applied to either `PERSON` or `PROJECT` model types. Four field types are supported: **Checkbox**, **Date**, **Text**, and **Select**.

---

### Checkbox Custom Fields

#### List Checkbox Custom Fields
`GET https://api.runn.io/custom-fields/checkbox/`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | `PERSON` or `PROJECT` |
| `cursor` | string | |
| `limit` | integer | Default: 50, Max: 200 |

**Response `200`:** Paginated list of CustomFieldCheckbox objects.

**CustomFieldCheckbox Object:**
```json
{
  "id": "integer",
  "name": "string",
  "description": "string | null",
  "model": "PERSON | PROJECT",
  "required": "boolean",
  "showInPlanner": "boolean",
  "sortOrder": "integer",
  "filterableInPlanner": "boolean"
}
```

#### Create a Checkbox Custom Field
`POST https://api.runn.io/custom-fields/checkbox/`

**Request Body:**
```json
{
  "name": "string (required, minLength: 1)",
  "model": "PERSON | PROJECT (required)",
  "required": "boolean (required, default: false)",
  "showInPlanner": "boolean (required, default: false)",
  "filterableInPlanner": "boolean (required, default: true)",
  "description": "string (optional)"
}
```

**Response `201`:** CustomFieldCheckbox object.

#### Update a Checkbox Custom Field
`PATCH https://api.runn.io/custom-fields/checkbox/{checkboxFieldId}`

**Request Body** (all optional):
```json
{
  "name": "string",
  "description": "string",
  "required": "boolean",
  "showInPlanner": "boolean",
  "filterableInPlanner": "boolean"
}
```

**Response `200`:** Updated CustomFieldCheckbox object.

#### Delete a Checkbox Custom Field
`DELETE https://api.runn.io/custom-fields/checkbox/{checkboxFieldId}`

**Response `204`:** No content.

---

### Date Custom Fields

#### Create a Date Custom Field
`POST https://api.runn.io/custom-fields/date/`

**Request Body:**
```json
{
  "name": "string (required)",
  "model": "PERSON | PROJECT (required)",
  "required": "boolean (required)",
  "showInPlanner": "boolean (required)",
  "filterableInPlanner": "boolean (required)",
  "description": "string (optional)"
}
```

**Response `201`:** CustomFieldDate object.

#### List Date Custom Fields
`GET https://api.runn.io/custom-fields/date/`

Same query params as checkbox list. Returns paginated CustomFieldDate objects.

#### Update a Date Custom Field
`PATCH https://api.runn.io/custom-fields/date/{dateFieldId}`

#### Delete a Date Custom Field
`DELETE https://api.runn.io/custom-fields/date/{id}`

**Response `204`:** No content.

---

### Text Custom Fields

#### Create a Text Custom Field
`POST https://api.runn.io/custom-fields/text/`

Same request body structure as Date. **Response `201`:** CustomFieldText object.

#### Show / List Text Custom Fields
`GET https://api.runn.io/custom-fields/text/`

Same query params as checkbox. Returns paginated CustomFieldText objects.

#### Update a Text Custom Field
`PATCH https://api.runn.io/custom-fields/text/{textFieldId}`

#### Delete a Text Custom Field
`DELETE https://api.runn.io/custom-fields/text/{textFieldId}`

---

### Select Custom Fields

#### Create a Select Custom Field
`POST https://api.runn.io/custom-fields/select/`

**Request Body:**
```json
{
  "name": "string (required, minLength: 1)",
  "model": "PERSON | PROJECT (required)",
  "options": [ { "name": "string" } ],
  "singleSelect": "boolean (required, default: false)",
  "required": "boolean (required)",
  "showInPlanner": "boolean (required)",
  "filterableInPlanner": "boolean (required)",
  "description": "string (optional)"
}
```

**Response `201`:** CustomFieldSelect object.

**CustomFieldSelect Object:**
```json
{
  "id": "integer",
  "name": "string",
  "description": "string | null",
  "model": "PERSON | PROJECT",
  "options": [ { "id": "integer", "name": "string" } ],
  "singleSelect": "boolean",
  "required": "boolean",
  "showInPlanner": "boolean",
  "sortOrder": "integer",
  "filterableInPlanner": "boolean"
}
```

#### Show / List Select Custom Fields
`GET https://api.runn.io/custom-fields/select/`

#### Update a Select Custom Field
`PATCH https://api.runn.io/custom-fields/select/{selectFieldId}`

#### Delete a Select Custom Field
`DELETE https://api.runn.io/custom-fields/select/{selectFieldId}`

#### Create a Select Custom Field Option
`POST https://api.runn.io/custom-fields/select/{selectFieldId}/options`

**Request Body:**
```json
{ "name": "string (required, minLength: 1)" }
```

**Response `201`:** `{ "option": { "id": integer, "name": "string" } }`

#### Update a Select Custom Field Option
`PATCH https://api.runn.io/custom-fields/select/{selectFieldId}/options/{selectOptionId}`

**Request Body:**
```json
{ "name": "string (required, minLength: 1)" }
```

**Response `200`:** `{ "option": { "id": integer, "name": "string" } }`

#### Delete a Select Custom Field Option
`DELETE https://api.runn.io/custom-fields/select/{selectFieldId}/options/{selectOptionId}`

**Response `204`:** No content.

---

## Holiday Groups

### List Holiday Groups
`GET https://api.runn.io/holiday-groups/`

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `cursor` | string | — |
| `limit` | integer | 50 (Max: 200) |
| `sortBy` | string | `id` |
| `order` | string | `asc` |

**Response `200`:** Paginated list of HolidayGroup objects.

**HolidayGroup Object:**
```json
{
  "id": "integer",
  "name": "string",
  "countryCode": "string",
  "countryName": "string | null",
  "regionName": "string | null",
  "holidayIds": [ "integer" ]
}
```

---

### Show a Holiday Group
`GET https://api.runn.io/holiday-groups/{holidayGroupId}`

**Response `200`:** HolidayGroup object.

---

### Show Holidays for a Holiday Group
`GET https://api.runn.io/holiday-groups/{holidayGroupId}/holidays`

**Response `200`:** Paginated list of Holiday objects.

**Holiday Object:**
```json
{
  "id": "integer",
  "name": "string",
  "date": "YYYY-MM-DD",
  "observed": "YYYY-MM-DD | null",
  "type": "string"
}
```

---

## Invitations

### List Invitations
`GET https://api.runn.io/invitations/`

Does not return the invitation token for security reasons.

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `cursor` | string | — |
| `limit` | integer | 50 (Max: 200) |
| `sortBy` | string | `id` — options: `createdAt`, `sentAt`, `id` |
| `order` | string | `asc` |

**Response `200`:** Paginated list of Invitation objects.

**Invitation Object:**
```json
{
  "id": "integer",
  "email": "string",
  "userType": "admin | editor | viewer_all | viewer_basic | timesheet_only | manager | contributor",
  "financialPermission": "all | no_salaries | restricted | none",
  "manageProjectsPermission": "all | specific | restricted | none",
  "managePeoplePermission": "all | restricted | none",
  "manageAccountPermission": "boolean",
  "addAllPeopleToProjectsPermission": "boolean",
  "viewPlannerPermission": "boolean",
  "createdAt": "datetime",
  "sentAt": "datetime",
  "expiresAt": "datetime"
}
```

---

### Create an Invitation for a User
`POST https://api.runn.io/invitations/`

**Request Body:**
```json
{
  "email": "string (required)",
  "userType": "admin | editor | viewer_all | viewer_basic | timesheet_only | manager | contributor (required)",
  "financialPermission": "all | no_salaries | restricted | none (required)",
  "fromUser": "string (email of admin user sending the invite — required)",
  "manageProjectsPermission": "all | specific | restricted | none (required)",
  "manageOthersPermission": "all | none (required)"
}
```

**Response `201`:** Invitation object.

---

### Delete an Invitation
`DELETE https://api.runn.io/invitations/{invitationId}`

**Response `204`:** No content.

---

## Me

### Who Am I?
`GET https://api.runn.io/me/`

Returns information about the currently authenticated API key.

**Response `200`:**
```json
{ "name": "string" }
```

---

## People

People represent employees, contractors, and placeholders in Runn.

### Create a Person
`POST https://api.runn.io/people/`

Also creates a new contract for the person.

**Request Body:**
```json
{
  "firstName": "string (required, minLength: 1)",
  "lastName": "string (required, minLength: 1)",
  "roleId": "integer (required)",
  "email": "string (optional)",
  "teamId": "integer | null (optional)",
  "holidaysGroupId": "integer (optional)",
  "tags": [ { "id": "integer" } ],
  "references": [ ...Reference objects... ],
  "managers": [ { "userId": "integer" } ],
  "startDate": "YYYY-MM-DD (default: today)",
  "endDate": "YYYY-MM-DD (optional)",
  "employmentType": "employee | contractor (default: employee)",
  "costPerHour": "number (defaults to role's cost)",
  "minutesPerDay": "number (min: 1, defaults to account default)",
  "rosteredDays": { ...RosteredDays... },
  "jobTitle": "string (hidden feature)"
}
```

**Response `201`:** Person object.

---

### Delete a Person or Placeholder
`DELETE https://api.runn.io/people/{personId}`

Fails if the person has existing assignments or actuals (to preserve historical reports). Use `force=true` to override.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `force` | boolean | Yes | Default: `false`. Set to `true` to delete even with history |

**Response `204`:** No content.

---

### List People
`GET https://api.runn.io/people/`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | — | |
| `limit` | integer | 50 | Max: 200 |
| `sortBy` | string | `id` | `id`, `createdAt`, `updatedAt` |
| `order` | string | `asc` | |
| `includePlaceholders` | boolean | `false` | |
| `email` | string | — | Case-insensitive substring |
| `firstName` | string | — | Case-insensitive substring |
| `lastName` | string | — | Case-insensitive substring |
| `externalId` | string | — | External ID filter |
| `modifiedAfter` | date/datetime | — | |

**Response `200`:** Paginated list of CollectionPerson objects.

**CollectionPerson Object:**
```json
{
  "id": "number",
  "firstName": "string",
  "lastName": "string",
  "email": "string | null",
  "isArchived": "boolean",
  "teamId": "integer | null",
  "references": [ ...Reference objects... ],
  "tags": [ ...Tag objects... ],
  "holidaysGroupId": "number | null",
  "managers": [ { "id": "integer" } ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Show a Person or Placeholder
`GET https://api.runn.io/people/{personId}`

**Response `200`:** Full Person object (includes `notes`, `skills`, `customFields`).

**Person Object:**
```json
{
  "id": "number",
  "firstName": "string",
  "lastName": "string",
  "email": "string | null",
  "isArchived": "boolean",
  "references": [ ...Reference objects... ],
  "notes": [ { "id": "integer", "note": "string", "createdBy": "string" } ],
  "teamId": "number | null",
  "tags": [ ...Tag objects... ],
  "skills": [ { "id": "integer", "level": "integer | null" } ],
  "holidaysGroupId": "number | null",
  "customFields": {
    "select": [ { "id": "integer", "name": "string", "values": [ { "id": "integer", "name": "string" } ] } ],
    "text": [ { "id": "integer", "name": "string", "value": "string" } ],
    "checkbox": [ { "id": "integer", "name": "string", "value": "boolean" } ],
    "date": [ { "id": "integer", "name": "string", "value": "YYYY-MM-DD | null" } ]
  },
  "managers": [ { "id": "integer" } ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Update a Person or Placeholder
`PATCH https://api.runn.io/people/{personId}`

To add a new role/job title, use `POST /people/{personId}/contracts` instead.

**Request Body** (all optional):
```json
{
  "firstName": "string (minLength: 1)",
  "lastName": "string (minLength: 1)",
  "email": "string",
  "tags": [ { "id": "integer" } ],
  "teamId": "integer | null",
  "references": [ ...Reference objects... ],
  "isArchived": "boolean",
  "managers": [ { "userId": "integer" } ]
}
```

**Response `200`:** Updated Person object.

---

### People — Actuals

#### List Actuals for a Person
`GET https://api.runn.io/people/{personId}/actuals/`

**Query Parameters:** `cursor`, `limit` (50/200), `projectId`, `roleId`, `modifiedAfter`

**Response `200`:** Paginated list of Actual objects.

---

### People — Assignments

#### List Assignments for a Person or Placeholder
`GET https://api.runn.io/people/{personId}/assignments/`

**Query Parameters:** `cursor`, `limit` (50/200), `projectId`, `roleId`, `startDate`, `endDate`, `modifiedAfter`

**Response `200`:** Paginated list of Assignment objects.

---

### People — Contracts

#### Add a New Contract to a Person
`POST https://api.runn.io/people/{personId}/contracts/`

**Request Body:** ContractInput
```json
{
  "roleId": "integer (required)",
  "startDate": "YYYY-MM-DD (default: today)",
  "endDate": "YYYY-MM-DD (optional)",
  "employmentType": "employee | contractor (default: employee)",
  "costPerHour": "number (defaults to role)",
  "minutesPerDay": "number (min: 1)",
  "rosteredDays": { ...RosteredDays... },
  "jobTitle": "string"
}
```

**Response `201`:** Contract object.

#### Delete a Contract for a Person
`DELETE https://api.runn.io/people/{personId}/contracts/{contractId}`

**Response `204`:** No content.

#### List Contracts for a Person
`GET https://api.runn.io/people/{personId}/contracts/`

**Response `200`:** Paginated list of Contract objects (default limit: 20, max: 50).

#### List People Current Contracts
`GET https://api.runn.io/people/contracts/current`

List current contracts across all people.

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

#### Show Current Contract for a Person
`GET https://api.runn.io/people/{personId}/contracts/current`

**Response `200`:** Contract object. `404` if no current contract.

---

### People — Custom Fields

#### Add a Checkbox Custom Value to a Person or Placeholder
`PATCH https://api.runn.io/people/{personId}/custom-fields/checkbox/`

**Request Body:** `{ "id": number, "value": boolean }`  
**Response `200`:** `{ "id": number, "value": boolean }`

#### Add a Date Custom Value to a Person or Placeholder
`PATCH https://api.runn.io/people/{personId}/custom-fields/date/`

**Request Body:** `{ "id": number, "value": "YYYY-MM-DD | null" }`  
**Response `200`:** Same shape.

#### Add a Text Custom Value to a Person or Placeholder
`PATCH https://api.runn.io/people/{personId}/custom-fields/text/`

**Request Body:** `{ "id": number, "value": "string" }`  
**Response `200`:** Same shape.

#### Add Custom Select Options to a Person or Placeholder
`PATCH https://api.runn.io/people/{personId}/custom-fields/select/`

**Request Body:** `{ "id": number, "values": [ { "id": number } ] }`  
**Response `200`:** Same shape.

#### List People Custom Fields
`GET https://api.runn.io/people/custom-fields`

List all custom fields across all people.

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

**Response `200`:** Paginated list of PersonCustomField objects.

---

### People — Notes

#### List People Notes
`GET https://api.runn.io/people/notes`

List all person notes across all people.

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

**Response `200`:** Paginated list of PersonNote objects.

**PersonNote Object:**
```json
{
  "id": "integer",
  "createdBy": "string | null",
  "createdByEmail": "string | null",
  "note": "string",
  "personId": "integer",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### People — Projects

#### Add Project to a Person or Placeholder
`POST https://api.runn.io/people/{personId}/projects/`

**Request Body:**
```json
{
  "projectId": "integer (required)",
  "roleId": "integer (required)",
  "workstreamId": "integer (optional)"
}
```

**Response `201`:** No content.

#### List Projects for a Person or Placeholder
`GET https://api.runn.io/people/{personId}/projects/`

**Query Parameters:** `cursor`, `limit` (50/200)

**Response `200`:** Paginated list of Project objects.

---

### People — Skills

#### Add a Skill to a Person or Placeholder
`POST https://api.runn.io/people/{personId}/skills/`

**Request Body:**
```json
{
  "skillId": "integer (required)",
  "level": "1 | 2 | 3 | 4 | null (optional)"
}
```

**Response `201`:** Competency object.

#### List Skills for a Person or Placeholder
`GET https://api.runn.io/people/{personId}/skills/`

**Query Parameters:** `cursor`, `limit` (50/200), `modifiedAfter`

**Response `200`:** Paginated list of Competency objects.

**Competency Object:**
```json
{
  "skillId": "integer",
  "level": "1 | 2 | 3 | 4 | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### Update a Skill for a Person or Placeholder
`PATCH https://api.runn.io/people/{personId}/skills/{skillId}`

**Request Body:** `{ "level": 1 | 2 | 3 | 4 | null }`  
**Response `200`:** Updated Competency object.

#### Remove a Skill from a Person or Placeholder
`DELETE https://api.runn.io/people/{personId}/skills/{skillId}`

**Response `204`:** No content.

#### List People Skills (All)
`GET https://api.runn.io/people/skills`

**Query Parameters:** `cursor`, `limit` (50/200), `includePlaceholders` (boolean), `modifiedAfter`

**Response `200`:** Paginated list of PersonCompetency objects (includes `personId`).

---

### People — Teams (Deprecated)

> ⚠️ These endpoints are deprecated. Use `PATCH /people/{personId}` with `teamId` instead.

#### Add a Person or Placeholder to a Team
`POST https://api.runn.io/people/{personId}/teams/`

**Request Body:** `{ "teamId": integer }`

#### Remove a Person or Placeholder from a Team
`DELETE https://api.runn.io/people/{personId}/teams/{teamId}`

#### Show Current Team for a Person or Placeholder
`GET https://api.runn.io/people/{personId}/teams/current`

---

### People — Time Off

#### List Rostered Time Offs for a Person
`GET https://api.runn.io/people/{personId}/time-offs/rostered-off`

**Response `200`:** Paginated list of TimeOff objects.

#### List Leave for a Person
`GET https://api.runn.io/people/{personId}/time-offs/leave`

**Response `200`:** Paginated list of TimeOff objects.

#### List Holidays for a Person
`GET https://api.runn.io/people/{personId}/time-offs/holidays`

**Response `200`:** Paginated list of TimeOff objects (with additional `holidayId` field).

---

## People Tags

### Create a People Tag
`POST https://api.runn.io/people-tags/`

**Request Body:** `{ "name": "string (required, minLength: 1)" }`  
**Response `201`:** People tag object `{ id, name, archived, createdAt, updatedAt }`.

### Delete a People Tag
`DELETE https://api.runn.io/people-tags/{peopleTagId}`

**Response `202`:** Accepted.

### List People Tags
`GET https://api.runn.io/people-tags/`

**Query Parameters:** `cursor`, `limit` (50/200), `sortBy`, `order`, `modifiedAfter`

**Response `200`:** Paginated list of people tag objects.

### Show a People Tag
`GET https://api.runn.io/people-tags/{peopleTagId}`

**Response `200`:** People tag object.

### Update a People Tag
`PATCH https://api.runn.io/people-tags/{peopleTagId}`

**Request Body:** `{ "archived": boolean }`  
**Response `200`:** Updated people tag object.

---

## Placeholders

Placeholders are unassigned role slots. They behave similarly to people but without personal details.

> Placeholders with no project or assignments will be **auto-deleted within 24 hours**.

### Create a Placeholder
`POST https://api.runn.io/placeholders/`

**Request Body:**
```json
{
  "roleId": "integer (required)",
  "costPerHour": "number (optional, defaults to role)",
  "teamId": "integer | null (optional)",
  "tags": [ { "id": "integer" } ]
}
```

**Response `201`:** PlaceholderInput object.

### List Placeholders
`GET https://api.runn.io/placeholders/`

**Query Parameters:** `cursor`, `limit` (50/200), `sortBy`, `order`, `modifiedAfter`

**Response `200`:** Paginated list of Placeholder objects.

**Placeholder Object:**
```json
{
  "id": "integer",
  "firstName": "string",
  "lastName": "string",
  "isArchived": "boolean",
  "tags": [ ...Tag objects... ],
  "references": [ ...Reference objects... ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Add a Skill to a Placeholder
`POST https://api.runn.io/placeholders/{placeholderId}/skills/`

**Request Body:** `{ "skillId": integer, "level": 1|2|3|4|null }`  
**Response `201`:** Competency object.

### Remove a Skill from a Placeholder
`DELETE https://api.runn.io/placeholders/{placeholderId}/skills/{skillId}`

**Response `204`:** No content.

### Add a Placeholder to a Team
`POST https://api.runn.io/placeholders/{placeholderId}/teams/`

**Request Body:** `{ "teamId": integer }`  
**Response `201`:** No content.

### Remove a Placeholder from a Team
`DELETE https://api.runn.io/placeholders/{placeholderId}/teams/{teamId}`

**Response `202`:** Accepted.

---

## Project Tags

### Create a Project Tag
`POST https://api.runn.io/project-tags/`

**Request Body:** `{ "name": "string (required, minLength: 1)" }`  
**Response `201`:** ProjectTag object.

### List Project Tags
`GET https://api.runn.io/project-tags/`

**Query Parameters:** `cursor`, `limit` (50/200), `sortBy`, `order`, `includeArchived` (boolean), `modifiedAfter`

**Response `200`:** Paginated list of ProjectTag objects.

**ProjectTag Object:**
```json
{
  "id": "integer",
  "name": "string",
  "projectIds": [ "integer" ],
  "archived": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Show a Project Tag
`GET https://api.runn.io/project-tags/{projectTagId}`

### Update a Project Tag
`PATCH https://api.runn.io/project-tags/{projectTagId}`

**Request Body:** `{ "archived": boolean }`

### Add a Project Tag to a Project
`POST https://api.runn.io/project-tags/{projectTagId}/project/{projectId}`

**Response `201`:** Updated ProjectTag object.

### Remove a Project Tag from a Project
`DELETE https://api.runn.io/project-tags/{projectTagId}/project/{projectId}`

**Response `204`:** No content.

---

## Projects

### Create a Project
`POST https://api.runn.io/projects/`

Two creation modes: **from scratch** or **from a template**.

**From scratch:**
```json
{
  "name": "string (required, minLength: 1)",
  "clientId": "number (required)",
  "emoji": "string (optional)",
  "isConfirmed": "boolean (optional)",
  "isTemplate": "boolean (optional)",
  "budget": "number (min: 0, optional)",
  "expensesBudget": "number (min: 0, optional)",
  "teamId": "number | null (optional)",
  "pricingModel": "fp | tm | nb (default: tm)",
  "rateCardId": "integer (optional, uses standard if omitted)",
  "rateType": "hours | days (default: account setting)",
  "references": [ ...Reference objects... ],
  "managerIds": [ "integer" ]
}
```

**From template:**
```json
{
  "fromTemplate": {
    "templateId": "integer (required)",
    "startDate": "YYYY-MM-DD (required)"
  },
  "name": "string",
  "clientId": "number"
}
```

**Response `201`:** Project object.

---

### Delete a Project
`DELETE https://api.runn.io/projects/{projectId}/`

Cannot delete a project with existing actuals or assignments.

**Response `204`:** No content.  
**Response `409`:** Conflict (has assignments/actuals).

---

### List Projects
`GET https://api.runn.io/projects/`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeArchived` | boolean | Yes | Default: `true` |
| `cursor` | string | No | |
| `limit` | integer | No | Default: 50, Max: 200 |
| `sortBy` | string | No | `id`, `createdAt`, `updatedAt` |
| `order` | string | No | `asc` or `desc` |
| `name` | string | No | Case-insensitive substring |
| `externalId` | string | No | External ID filter |
| `modifiedAfter` | date/datetime | No | |

**Response `200`:** Paginated list of Project objects.

**Project Object:**
```json
{
  "id": "integer",
  "name": "string",
  "isTemplate": "boolean",
  "isArchived": "boolean",
  "isConfirmed": "boolean",
  "pricingModel": "fp | tm | nb",
  "rateType": "hours | days",
  "teamId": "integer | null",
  "budget": "number | null",
  "expensesBudget": "number | null",
  "references": [ ...Reference objects... ],
  "clientId": "integer",
  "rateCardId": "integer",
  "customFields": {
    "select": [ ...NestedCustomFieldSelect... ],
    "text": [ ...NestedCustomFieldText... ],
    "checkbox": [ ...NestedCustomFieldCheckbox... ],
    "date": [ ...NestedCustomFieldDate... ]
  },
  "managerIds": [ "number" ],
  "tags": [ ...Tag objects... ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

**Pricing Models:** `fp` = Fixed Price, `tm` = Time & Materials, `nb` = Non-Billable

---

### Show a Project
`GET https://api.runn.io/projects/{projectId}`

**Response `200`:** Project object.

---

### Update a Project
`PATCH https://api.runn.io/projects/{projectId}`

**Request Body** (all optional):
```json
{
  "name": "string",
  "isConfirmed": "boolean",
  "isArchived": "boolean",
  "isTemplate": "boolean",
  "budget": "number (min: 0)",
  "expensesBudget": "number (min: 0)",
  "clientId": "number",
  "teamId": "number | null",
  "pricingModel": "fp | tm | nb",
  "rateType": "hours | days",
  "references": [ ...Reference objects... ],
  "tags": [ { "id": "integer" } ],
  "managerIds": [ "integer" ]
}
```

**Response `200`:** Updated Project object.

---

### Projects — Actuals

#### List Actuals for a Project
`GET https://api.runn.io/projects/{projectId}/actuals/`

**Query Parameters:** `cursor`, `limit` (50/200), `personId`, `roleId`, `modifiedAfter`

**Response `200`:** Paginated list of Actual objects.

---

### Projects — Assignments

#### List Assignments for a Project
`GET https://api.runn.io/projects/{projectId}/assignments/`

**Query Parameters:** `cursor`, `limit` (50/200), `personId`, `roleId`, `startDate`, `endDate`, `modifiedAfter`

**Response `200`:** Paginated list of Assignment objects.

---

### Projects — Budget Roles

#### Create a Project Budget Role
`POST https://api.runn.io/projects/{projectId}/budget-roles/`

Cannot use `estimatedBudget` if no project rate exists for the role.

**Request Body:**
```json
{
  "roleId": "integer (required)",
  "estimatedMinutes": "integer (min: 0)"
}
```
OR:
```json
{
  "roleId": "integer (required)",
  "estimatedBudget": "integer (min: 0)"
}
```

**Response `201`:** No content.

#### Get a Paginated List of Project Budget Roles for a Project
`GET https://api.runn.io/projects/{projectId}/budget-roles/`

**Response `200`:** Paginated list of ProjectBudgetRole objects.

**ProjectBudgetRole Object:**
```json
{
  "projectId": "integer",
  "roleId": "integer",
  "estimatedMinutes": "integer",
  "estimatedBudget": "integer",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### Get a Project Budget Role
`GET https://api.runn.io/projects/{projectId}/budget-roles/{roleId}`

#### Update a Project Budget Role
`PATCH https://api.runn.io/projects/{projectId}/budget-roles/{roleId}`

**Request Body:** `{ "estimatedMinutes": integer }` or `{ "estimatedBudget": integer }`

#### Delete a Project Budget Role
`DELETE https://api.runn.io/projects/{projectId}/budget-roles/{roleId}`

Cannot delete if implicitly created from project membership.

#### List Budget Roles (All Projects)
`GET https://api.runn.io/budget-roles/`

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

---

### Projects — Custom Fields

#### Add a Checkbox Custom Value to a Project
`PATCH https://api.runn.io/projects/{projectId}/custom-fields/checkbox/`

**Request Body:** `{ "id": number, "value": boolean }`

#### Add a Date Custom Field Value to a Project
`PATCH https://api.runn.io/projects/{projectId}/custom-fields/date/`

**Request Body:** `{ "id": number, "value": "YYYY-MM-DD | null" }`

#### Add a Select Custom Field to a Project
`PATCH https://api.runn.io/projects/{projectId}/custom-fields/select/`

**Request Body:** `{ "id": number, "values": [ { "id": number } ] }`

#### Add a Text Custom Field Value to a Project
`PATCH https://api.runn.io/projects/{projectId}/custom-fields/text/`

**Request Body:** `{ "id": number, "value": "string" }`

#### List Project Custom Fields (All Projects)
`GET https://api.runn.io/projects/custom-fields`

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

**Response `200`:** Paginated list of ProjectCustomField objects.

---

### Projects — Milestones

#### List Project Milestones (All Projects)
`GET https://api.runn.io/milestones/`

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

#### List Milestones for a Project
`GET https://api.runn.io/projects/{projectId}/milestones/`

**Query Parameters:** `cursor`, `limit` (50/200), `startDate`, `endDate`

#### Create a Milestone for a Project
`POST https://api.runn.io/projects/{projectId}/milestones/`

**Request Body:**
```json
{
  "title": "string (required)",
  "icon": "start | end | flag | dollar | warning | <emoji> (required)",
  "date": "YYYY-MM-DD (required)",
  "note": "string (optional)"
}
```

**Response `201`:** Milestone object.

**Milestone Object:**
```json
{
  "id": "integer",
  "title": "string | null",
  "icon": "string | null",
  "note": "string | null",
  "date": "YYYY-MM-DD",
  "projectId": "number",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### Update a Milestone for a Project
`PATCH https://api.runn.io/projects/{projectId}/milestones/{milestoneId}`

**Request Body** (all optional): `title`, `icon`, `note`, `date`

#### Delete a Milestone for a Project
`DELETE https://api.runn.io/projects/{projectId}/milestones/{milestoneId}`

**Response `204`:** No content.

---

### Projects — Notes

#### Create a Project Note
`POST https://api.runn.io/projects/{projectId}/notes/`

Creator defaults to the API user.

**Request Body:** `{ "note": "string (required)" }`  
**Response `201`:** ProjectNote object.

**ProjectNote Object:**
```json
{
  "id": "integer",
  "createdBy": "string | null",
  "createdByEmail": "string | null",
  "note": "string",
  "projectId": "integer",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### List Project Notes (All Projects)
`GET https://api.runn.io/project-notes/`

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

#### List Notes for a Project
`GET https://api.runn.io/projects/{projectId}/notes/`

**Query Parameters:** `cursor`, `limit` (50/200)

---

### Projects — Other Expenses

#### Create an Other Expense for a Project
`POST https://api.runn.io/projects/{projectId}/other-expenses/`

**Request Body:**
```json
{
  "cost": "number (required, min: 0)",
  "charge": "number (required, min: 0)",
  "name": "string (required, minLength: 1)",
  "date": "YYYY-MM-DD (required)"
}
```

**Response `201`:** ProjectOtherExpense object.

**ProjectOtherExpense Object:**
```json
{
  "id": "integer",
  "cost": "number",
  "charge": "number",
  "name": "string",
  "date": "YYYY-MM-DD",
  "projectId": "integer",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### Update an Other Expense on a Project
`PATCH https://api.runn.io/projects/{projectId}/other-expenses/{otherExpenseId}/`

**Request Body** (all optional): `cost`, `charge`, `name`, `date`

#### List Other Expenses for a Project
`GET https://api.runn.io/projects/{projectId}/other-expenses/`

**Query Parameters:** `cursor`, `limit` (20/50)

#### List Other Expenses (All Projects)
`GET https://api.runn.io/other-expenses/`

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

---

### Projects — Phases

Project phases divide a project into smaller sections to group tasks and assignments.

#### List Phases (All Projects)
`GET https://api.runn.io/phases/`

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

#### List Phases for a Project
`GET https://api.runn.io/projects/{projectId}/phases/`

**Query Parameters:** `cursor`, `limit` (20/50)

#### Show a Phase for a Project
`GET https://api.runn.io/projects/{projectId}/phases/{phaseId}`

#### Create a Phase for a Project
`POST https://api.runn.io/projects/{projectId}/phases/`

**Request Body:**
```json
{
  "name": "string (required, minLength: 1)",
  "startDate": "YYYY-MM-DD (required)",
  "endDate": "YYYY-MM-DD (required)",
  "color": "#67D0D5 | #FDCD4F | #F191CC | #B19DE6 | #9CE277 | #CD97DA | #84DBA0 | #FFB077 | #9CC5BF | #E8C681 | #6899F1 | #DDAE9F (required)"
}
```

**Response `201`:** ProjectPhase object.

**ProjectPhase Object:**
```json
{
  "id": "number",
  "name": "string",
  "color": "string (hex)",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "projectId": "number",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### Update a Phase for a Project
`PATCH https://api.runn.io/projects/{projectId}/phases/{phaseId}`

**Request Body** (all optional): `name`, `startDate`, `endDate`, `color`

#### Delete a Phase for a Project
`DELETE https://api.runn.io/projects/{projectId}/phases/{phaseId}`

**Response `204`:** No content.

---

### Projects — People

#### List People Assigned to a Project
`GET https://api.runn.io/projects/{projectId}/people/`

**Query Parameters:** `includeArchived` (required, boolean), `cursor`, `limit` (50/200)

**Response `200`:** Paginated list of CollectionPerson objects.

#### List Members of Projects
`GET https://api.runn.io/project-members/`

Does not include removal events.

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

**Response `200`:** Paginated list:
```json
{
  "id": "number",
  "personId": "number",
  "projectId": "number",
  "roleId": "number",
  "isPlaceholder": "boolean",
  "workstreamId": "number | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Projects — Person Requests

Person requests are used to request that a placeholder role be filled or a new person be hired.

#### Create a Person Request on a Project
`POST https://api.runn.io/projects/{projectId}/person-requests/`

**Request Body:**
```json
{
  "personId": "integer (required — ID of the placeholder)",
  "status": "NEED_TO_HIRE | REQUESTED | PENDING (required)"
}
```

**Response `200`:** PersonRequest object.

**PersonRequest Object:**
```json
{
  "id": "number",
  "personId": "number",
  "projectId": "number",
  "status": "NEED_TO_HIRE | REQUESTED | PENDING",
  "requesterId": "number | null",
  "updaterId": "number | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### List Person Requests (All Projects)
`GET https://api.runn.io/person-requests/`

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

#### List the Person Requests for a Project
`GET https://api.runn.io/projects/{projectId}/person-requests/`

**Query Parameters:** `cursor`, `limit` (50/200)

#### Show a Single Person Request for a Project
`GET https://api.runn.io/projects/{projectId}/person-requests/{personRequestId}`

#### Update the Status of a Person Request on a Project
`PATCH https://api.runn.io/projects/{projectId}/person-requests/{personRequestId}`

**Request Body:** `{ "status": "NEED_TO_HIRE | REQUESTED | PENDING" }`  
**Response `200`:** `{ "id": integer, "status": string }`

---

### Projects — Rates

#### List Role Rates (All Projects)
`GET https://api.runn.io/project-rates/`

**Query Parameters:** `cursor`, `limit` (100/500), `modifiedAfter`

**Response `200`:** Paginated list of ProjectRate objects.

**ProjectRate Object:**
```json
{
  "id": "integer",
  "projectId": "integer",
  "roleId": "integer",
  "rate": "number",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### List Role Rates for a Project
`GET https://api.runn.io/projects/{projectId}/project-rates/`

**Query Parameters:** `cursor`, `limit` (50/200)

#### Update a Rate for a Role on a Project
`PATCH https://api.runn.io/projects/{projectId}/project-rates/{projectRateId}/`

**Request Body:** `{ "rate": number (min: 0) }`  
**Response `200`:** Updated ProjectRate object.

---

### Projects — Timesheet Lock

> ⚠️ This feature is in beta and only available to selected customers.

#### Show a Timesheet Lock for a Project
`GET https://api.runn.io/projects/{projectId}/timesheet-lock/`

**Response `200`:**
```json
{
  "status": "LOCKED | UNLOCKED | null",
  "lockedUntil": "datetime | null",
  "lastUpdatedBy": "string | null",
  "updatedAt": "datetime | null"
}
```

#### Update a Timesheet Lock for a Project
`PATCH https://api.runn.io/projects/{projectId}/timesheet-lock/`

**Request Body (to lock):**
```json
{ "status": "LOCKED", "lockedUntil": "YYYY-MM-DD" }
```

**Request Body (to unlock):**
```json
{ "status": "UNLOCKED" }
```

Returns an error if all timesheets have not been filled out to the selected date.

---

### Projects — Tags

#### Add a Project Tag to a Project
`POST https://api.runn.io/project-tags/{projectTagId}/project/{projectId}`

**Response `201`:** Updated ProjectTag object.

#### Remove a Project Tag from a Project
`DELETE https://api.runn.io/project-tags/{projectTagId}/project/{projectId}`

**Response `204`:** No content.

---

### Projects — Workstreams

#### Add a Workstream to a Project
`POST https://api.runn.io/projects/{projectId}/project-workstreams/{workstreamId}/`

**Response `201`:** ProjectWorkstream object.

#### Delete Project Workstream
`DELETE https://api.runn.io/projects/{projectId}/project-workstreams/{workstreamId}/`

**Response `200`:** Deleted ProjectWorkstream object.

#### List Project Workstreams (All Projects)
`GET https://api.runn.io/project-workstreams/`

**Query Parameters:** `cursor`, `limit` (50/200), `modifiedAfter`

**Response `200`:** Paginated list of objects:
```json
{ "projectId": number, "workstreamId": number, "createdAt": datetime, "updatedAt": datetime }
```

#### List Workstreams Assigned to a Project
`GET https://api.runn.io/projects/{projectId}/project-workstreams/`

**Query Parameters:** `includeArchived` (required), `cursor`, `limit` (50/200)

**Response `200`:** Paginated list of ProjectWorkstream objects.

**ProjectWorkstream Object:**
```json
{
  "id": "integer",
  "name": "string",
  "archived": "boolean",
  "projectIds": [ "integer" ]
}
```

#### View Project Workstream
`GET https://api.runn.io/projects/{projectId}/project-workstreams/{workstreamId}/`

**Response `200`:** ProjectWorkstream object.

---

## Rate Cards

### Create a Rate Card
`POST https://api.runn.io/rate-cards/`

**Request Body:**
```json
{
  "name": "string | null (required)",
  "description": "string | null (required)",
  "references": [ ...Reference objects... ],
  "isBlendedRateCard": "boolean (required)",
  "blendedRate": "number | null (required)",
  "rateType": "hours | days | null (required)"
}
```

**Response `201`:** RateCard object.

**RateCard Object:**
```json
{
  "id": "integer",
  "name": "string | null",
  "description": "string | null",
  "isArchived": "boolean",
  "references": [ ...Reference objects... ],
  "isBlendedRateCard": "boolean",
  "blendedRate": "number | null",
  "rateType": "hours | days | null",
  "projectIds": [ "integer" ],
  "rates": [
    {
      "role": { "id": number, "name": "string" },
      "rateHourly": "number",
      "rateDaily": "number"
    }
  ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Delete a Rate Card
`DELETE https://api.runn.io/rate-cards/{rateCardId}`

Rate cards that are internal, standard, or have associated projects cannot be deleted.

**Response `204`:** No content.

---

### List Rate Cards
`GET https://api.runn.io/rate-cards/`

**Query Parameters:** `cursor`, `limit` (50/200), `sortBy`, `order`, `modifiedAfter`

---

### Show a Rate Card
`GET https://api.runn.io/rate-cards/{rateCardId}`

**Response `200`:** RateCard object.

---

### Update a Rate Card
`PATCH https://api.runn.io/rate-cards/{rateCardId}`

**Request Body** (all optional):
```json
{
  "name": "string",
  "description": "string | null",
  "references": [ ...Reference objects... ],
  "isBlendedRateCard": "boolean",
  "blendedRate": "number | null (min: 0)",
  "rateType": "hours | days"
}
```

---

## Reports

### People — Get By-Day Entries for a Person
`GET https://api.runn.io/reports/hours/people/{personId}`

Returns a per-day breakdown combining assignments and actuals for a person.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | date | Only entries starting on or after this date |
| `endDate` | date | Only entries ending on or before this date |
| `cursor` | string | |
| `limit` | integer | Default: 50, Max: 200 |

**Response `200`:** Paginated list of ReportsHoursPeople objects:
```json
{
  "date": "YYYY-MM-DD",
  "roleId": "integer",
  "projectId": "integer",
  "personId": "integer",
  "workstreamId": "integer | null",
  "phaseId": "integer | null",
  "billableMinutes": "integer",
  "nonBillableMinutes": "integer",
  "totalMinutes": "integer",
  "assignments": {
    "billableMinutes": "integer",
    "nonBillableMinutes": "integer",
    "totalMinutes": "integer",
    "phaseId": "integer | null"
  },
  "actuals": {
    "billableMinutes": "integer",
    "nonBillableMinutes": "integer",
    "totalMinutes": "integer",
    "phaseId": "integer | null"
  }
}
```

> `billableMinutes` returns actual minutes where available, otherwise assignment minutes.

---

### People — Show Metrics (Beta)
`GET https://api.runn.io/reports/people/{personId}/`

Get a report for a person from the People Overview Report. Available under the **Advanced Plan** only.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | date | — | First day of period (monthly = 1st of month, weekly = Monday, quarterly = 1st of quarter) |
| `periodType` | string | `monthly` | `monthly`, `weekly`, or `quarterly` |

**Response `200`:**
```json
{
  "id": "integer",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "jobTitle": "string",
  "team": "string",
  "employmentType": "string",
  "metrics": [
    {
      "startDate": "string",
      "endDate": "string",
      "revenue": "number",
      "projectCosts": "number",
      "businessCosts": "number",
      "totalEffortHours": "number",
      "billableEffortHours": "number",
      "nonBillableEffortHours": "number",
      "totalUtilization": "number",
      "billableUtilization": "number",
      "contractCapacity": "number",
      "effectiveCapacity": "number",
      "overtime": "number",
      "remainingAvailability": "number",
      "timeOffHours": "number",
      "completedTimesheet": "boolean"
    }
  ]
}
```

---

### Projects — Get By-Day Entries for a Project
`GET https://api.runn.io/reports/hours/projects/{projectId}`

**Query Parameters:** `startDate`, `endDate`, `cursor`, `limit` (50/200)

**Response `200`:** Paginated list of ReportsHoursProjects objects (same structure as people report but with `personId` as the varying dimension).

---

### Projects — List Totals for Projects
`GET https://api.runn.io/reports/totals/projects/`

**Query Parameters:** `includeArchived` (required), `cursor`, `limit` (max: 10)

**Response `200`:** Paginated list of ProjectAggregate objects:
```json
{
  "id": "integer",
  "billableMinutes": "integer",
  "nonBillableMinutes": "integer",
  "totalMinutes": "integer",
  "assignments": { "billableMinutes": integer, "nonBillableMinutes": integer, "totalMinutes": integer },
  "actuals": { "billableMinutes": integer, "nonBillableMinutes": integer, "totalMinutes": integer }
}
```

---

### Projects — Show Totals for a Project
`GET https://api.runn.io/reports/totals/projects/{projectId}`

**Response `200`:** ProjectAggregate object.

---

### Projects — Show Metrics (Beta)
`GET https://api.runn.io/reports/projects/{projectId}/`

Available under the **Advanced Plan** only.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | date | Start of reporting period |
| `periodType` | string | `monthly`, `weekly`, `quarterly`. Omit for all-inclusive overview |

**Response `200`:**
```json
{
  "id": "integer",
  "name": "string",
  "pricingModel": "tm | fp | nb",
  "budget": "number | null",
  "budgetRemaining": "number",
  "timeBudgetRemaining": "number | null",
  "metrics": [
    {
      "startDate": "string | null",
      "endDate": "string | null",
      "timeMaterialsBenchmark": "number",
      "revenue": "number",
      "profit": "number",
      "costs": "number",
      "margin": "number (percentage)",
      "totalEffortHours": "number",
      "billableEffortHours": "number",
      "nonBillableEffortHours": "number"
    }
  ]
}
```

---

## Roles

### List Roles
`GET https://api.runn.io/roles/`

**Query Parameters:** `name` (substring), `cursor`, `limit` (50/200), `sortBy`, `order`, `modifiedAfter`

**Response `200`:** Paginated list of Role objects.

**Role Object:**
```json
{
  "id": "integer",
  "name": "string | null",
  "isArchived": "boolean",
  "defaultHourCost": "number",
  "standardRate": "number",
  "references": [ ...Reference objects... ],
  "personIds": [ "integer" ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Create a Role
`POST https://api.runn.io/roles/`

**Request Body:**
```json
{
  "name": "string (required, minLength: 1)",
  "defaultHourCost": "number (min: 0, default: 0)",
  "standardRate": "number (min: 0, default: 0)",
  "references": [ ...Reference objects... ]
}
```

**Response `201`:** Role object.

---

### Show a Role
`GET https://api.runn.io/roles/{roleId}`

**Response `200`:** Role object.

---

### Update a Role
`PATCH https://api.runn.io/roles/{roleId}`

**Request Body** (all optional):
```json
{
  "name": "string (minLength: 1)",
  "isArchived": "boolean",
  "references": [ ...Reference objects... ],
  "standardRate": "number (min: 0)",
  "defaultHourCost": "number (min: 0)"
}
```

**Response `200`:** Updated Role object.

---

## Skills

### Add People to a Skill
`POST https://api.runn.io/skills/{skillId}/people/`

**Request Body:**
```json
{
  "people": [
    {
      "personId": "integer (required)",
      "level": "1 | 2 | 3 | 4 | null (optional)"
    }
  ]
}
```

**Response `201`:** `{ "values": [ ...Competency objects... ] }`

---

### Create a Skill
`POST https://api.runn.io/skills/`

**Request Body:** `{ "name": "string (required, minLength: 1)" }`  
**Response `201`:** Skill object.

**Skill Object:**
```json
{
  "id": "integer",
  "name": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Delete a Skill
`DELETE https://api.runn.io/skills/{skillId}`

**Response `204`:** No content.

---

### List People for a Skill
`GET https://api.runn.io/skills/{skillId}/people/`

**Query Parameters:** `cursor`, `limit` (50/200)

**Response `200`:** Paginated list of CollectionPerson objects.

---

### List Skills
`GET https://api.runn.io/skills/`

**Query Parameters:** `sortBy` (required), `order`, `cursor`, `limit` (50/200), `modifiedAfter`

**Response `200`:** Paginated list of Skill objects.

---

### Show a Skill
`GET https://api.runn.io/skills/{skillId}`

**Response `200`:** Skill object.

---

### Update a Skill
`PATCH https://api.runn.io/skills/{skillId}`

**Request Body:** `{ "name": "string (required, minLength: 1)" }`  
**Response `200`:** Updated Skill object.

---

## Teams

### List Teams
`GET https://api.runn.io/teams/`

**Query Parameters:** `cursor`, `limit` (50/200), `sortBy`, `order`, `modifiedAfter`

**Response `200`:** Paginated list of Team objects.

**Team Object:**
```json
{
  "id": "integer",
  "name": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Create a Team
`POST https://api.runn.io/teams/`

**Request Body:** `{ "name": "string (required, minLength: 1)" }`  
**Response `201`:** Team object.

---

### Show a Team
`GET https://api.runn.io/teams/{teamId}/`

**Response `200`:** Team object.

---

### Update a Team
`PATCH https://api.runn.io/teams/{teamId}/`

**Request Body:** `{ "name": "string (required, minLength: 1)" }`  
**Response `200`:** Updated Team object.

---

### Delete a Team
`DELETE https://api.runn.io/teams/{teamId}/`

**Response `204`:** No content.

---

### List People in a Team
`GET https://api.runn.io/teams/{teamId}/people/`

**Query Parameters:** `cursor`, `limit` (50/200)

**Response `200`:** Paginated list of CollectionPerson objects.

---

## Time Offs

Time offs cover three types: **Holidays** (tied to a holiday group), **Leave** (manually created), and **Rostered Off** (days not worked per contract schedule).

---

### Holidays

#### List Holiday Time Offs
`GET https://api.runn.io/time-offs/holidays/`

**Query Parameters:** `sortBy` (required), `order`, `cursor`, `limit` (50/200), `personId`, `modifiedAfter`

**Response `200`:** Paginated list of TimeOff objects (with additional `holidayId` field).

**TimeOff Object:**
```json
{
  "id": "integer",
  "personId": "integer",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "note": "string | null",
  "minutesPerDay": "integer | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Leave

#### Create a Leave Time Off
`POST https://api.runn.io/time-offs/leave/`

Supports automatic merging of overlapping leave. May return an existing time off if the new entry is a subset.

**Request Body:**
```json
{
  "personId": "integer (required)",
  "startDate": "YYYY-MM-DD (required)",
  "endDate": "YYYY-MM-DD (required)",
  "note": "string (optional)",
  "minutesPerDay": "integer | null (min: 15 — omit for full day)"
}
```

**Response `201`:** TimeOff object.

---

#### Create Leave Time Offs in Bulk
`POST https://api.runn.io/time-offs/leave/bulk/`

**Request Body:**
```json
{
  "time_offs": [ ...TimeOffLeaveInput objects (min: 1, max: 100)... ]
}
```

**Response `200`:** Array of TimeOff objects.

---

#### Delete a Leave Time Off
`DELETE https://api.runn.io/time-offs/leave/{timeOffId}/`

**Response `202`:** Accepted.

---

#### Delete Leave Time Offs in Bulk
`DELETE https://api.runn.io/time-offs/leave/bulk/`

**Request Body:**
```json
{
  "timeOffIds": [ "number (min: 1, max: 100)" ]
}
```

**Response `202`:** Accepted.

---

#### List Leave Time Offs
`GET https://api.runn.io/time-offs/leave/`

**Query Parameters:** `sortBy` (required), `order`, `cursor`, `limit` (50/200), `personId`, `startDate`, `endDate`, `modifiedAfter`

**Response `200`:** Paginated list of TimeOff objects.

---

#### Show a Leave Time Off
`GET https://api.runn.io/time-offs/leave/{timeOffId}/`

**Response `200`:** TimeOff object.

---

### Rostered

#### Delete a Rostered Time Off
`DELETE https://api.runn.io/time-offs/rostered-off/{timeOffId}`

**Response `202`:** Accepted.

---

#### List Rostered Time Offs
`GET https://api.runn.io/time-offs/rostered-off/`

**Query Parameters:** `sortBy` (required), `order`, `cursor`, `limit` (50/200), `personId`, `modifiedAfter`

**Response `200`:** Paginated list of TimeOff objects.

---

## Users

### List Users
`GET https://api.runn.io/users/`

To create users, use `POST /invitations`.

**Query Parameters:** `cursor`, `limit` (50/200), `modifiedAfter`

**Response `200`:** Paginated list of User objects.

**User Object:**
```json
{
  "id": "integer",
  "firstName": "string | null",
  "lastName": "string | null",
  "email": "string",
  "personId": "integer | null",
  "permissions": {
    "type": "superuser | admin | editor | viewer_all | viewer_basic | timesheet_only",
    "financial": "all | no_salaries | restricted | none",
    "manageProjects": "all | specific | restricted | none",
    "managePeople": "all | restricted | none",
    "manageAccount": "boolean",
    "addAllPeopleToProjects": "boolean",
    "viewPlanner": "boolean"
  },
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Show a User
`GET https://api.runn.io/users/{userId}`

**Response `200`:** User object.

---

### Delete a User
`DELETE https://api.runn.io/users/{userId}`

**Response `204`:** No content.

---

### Allocate a View to a User
`POST https://api.runn.io/users/{userId}/views/{viewId}`

**Response `201`:** No content.  
**Response `409`:** View already allocated.

---

### Remove Allocated View from User
`DELETE https://api.runn.io/users/{userId}/views/{viewId}/`

**Response `204`:** No content.

---

### List Allocated Views for a User
`GET https://api.runn.io/users/{userId}/views/`

**Query Parameters:** `cursor`, `limit` (50/200)

**Response `200`:** Paginated list of View objects.

---

## Utility

### Convert a Legacy ID from API v0 to a New ID
`GET https://api.runn.io/legacy-id/{model}/{legacyId}`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | One of: `accounts`, `actuals`, `assignments`, `clients`, `contracts`, `help_documents`, `invitations`, `milestones`, `notes`, `people`, `phases`, `project_member`, `project_rates`, `projects`, `rate_cards`, `role_charge_our_rate`, `roles`, `tags`, `teams`, `time_offs`, `users`, `user_accounts`, `holiday_groups`, `skills`, `other_expenses`, `people_notes` |
| `legacyId` | string | The v0 legacy ID to convert |

**Response `200`:** New integer ID.

---

## Views

### List Views
`GET https://api.runn.io/views/`

**Query Parameters:** `cursor`, `limit` (50/200), `modifiedAfter`

**Response `200`:** Paginated list of View objects.

**View Object:**
```json
{
  "id": "integer",
  "name": "string",
  "description": "string | null",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

## Workstreams

Workstreams represent work categories or streams within projects.

### Create a Workstream
`POST https://api.runn.io/workstreams/`

**Request Body:** `{ "name": "string (required, minLength: 1)" }`  
**Response `201`:** Workstream object.

**Workstream Object:**
```json
{
  "id": "integer",
  "name": "string",
  "archived": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### Delete a Workstream
`DELETE https://api.runn.io/workstreams/{workstreamId}/`

**Response `204`:** No content.

---

### List Workstreams
`GET https://api.runn.io/workstreams/`

**Query Parameters:** `cursor`, `limit` (50/200), `sortBy`, `order`, `modifiedAfter`

**Response `200`:** Paginated list of Workstream objects.

---

### Update a Workstream
`PATCH https://api.runn.io/workstreams/{workstreamId}/`

**Request Body** (all optional):
```json
{
  "name": "string (minLength: 1)",
  "archived": "boolean"
}
```

**Response `200`:** Updated Workstream object.

---

### Show a Workstream
`GET https://api.runn.io/workstreams/{workstreamId}/`

**Response `200`:** Workstream object.

---

## Quick Reference — All Endpoints

| Method | Path | Summary |
|--------|------|---------|
| `GET` | `/activity-log/` | List events |
| `POST` | `/actuals/` | Create or update an actual |
| `POST` | `/actuals/bulk/` | Create or update actuals in bulk |
| `DELETE` | `/actuals/{actualId}/` | Delete a specific actual |
| `GET` | `/actuals/` | List actuals |
| `POST` | `/actuals/time-entry` | Update an actual (additive) |
| `POST` | `/assignments/` | Create an assignment |
| `DELETE` | `/assignments/{assignmentId}/` | Delete an assignment |
| `GET` | `/assignments/` | List assignments |
| `POST` | `/clients/` | Create a client |
| `POST` | `/clients/bulk/` | Create clients in bulk |
| `GET` | `/clients/` | List clients |
| `GET` | `/clients/{clientId}` | Show a client |
| `PATCH` | `/clients/{clientId}` | Update a client |
| `GET` | `/clients/{clientId}/projects/` | List a client's projects |
| `GET` | `/contracts/` | List contracts |
| `PATCH` | `/contracts/{contractId}` | Update a contract |
| `GET` | `/custom-fields/checkbox/` | List checkbox custom fields |
| `POST` | `/custom-fields/checkbox/` | Create a checkbox custom field |
| `PATCH` | `/custom-fields/checkbox/{id}` | Update a checkbox custom field |
| `DELETE` | `/custom-fields/checkbox/{id}` | Delete a checkbox custom field |
| `GET` | `/custom-fields/date/` | List date custom fields |
| `POST` | `/custom-fields/date/` | Create a date custom field |
| `PATCH` | `/custom-fields/date/{id}` | Update a date custom field |
| `DELETE` | `/custom-fields/date/{id}` | Delete a date custom field |
| `GET` | `/custom-fields/text/` | List text custom fields |
| `POST` | `/custom-fields/text/` | Create a text custom field |
| `PATCH` | `/custom-fields/text/{id}` | Update a text custom field |
| `DELETE` | `/custom-fields/text/{id}` | Delete a text custom field |
| `GET` | `/custom-fields/select/` | List select custom fields |
| `POST` | `/custom-fields/select/` | Create a select custom field |
| `PATCH` | `/custom-fields/select/{id}` | Update a select custom field |
| `DELETE` | `/custom-fields/select/{id}` | Delete a select custom field |
| `POST` | `/custom-fields/select/{id}/options` | Create a select option |
| `PATCH` | `/custom-fields/select/{id}/options/{optId}` | Update a select option |
| `DELETE` | `/custom-fields/select/{id}/options/{optId}` | Delete a select option |
| `GET` | `/holiday-groups/` | List holiday groups |
| `GET` | `/holiday-groups/{id}` | Show a holiday group |
| `GET` | `/holiday-groups/{id}/holidays` | Show holidays for a group |
| `GET` | `/invitations/` | List invitations |
| `POST` | `/invitations/` | Create an invitation |
| `DELETE` | `/invitations/{id}` | Delete an invitation |
| `GET` | `/me/` | Who am I? |
| `GET` | `/people/` | List people |
| `POST` | `/people/` | Create a person |
| `GET` | `/people/{id}` | Show a person or placeholder |
| `PATCH` | `/people/{id}` | Update a person or placeholder |
| `DELETE` | `/people/{id}` | Delete a person or placeholder |
| `GET` | `/people/{id}/actuals/` | List actuals for a person |
| `GET` | `/people/{id}/assignments/` | List assignments for a person |
| `GET` | `/people/{id}/contracts/` | List contracts for a person |
| `POST` | `/people/{id}/contracts/` | Add a new contract to a person |
| `DELETE` | `/people/{id}/contracts/{cid}` | Delete a contract for a person |
| `GET` | `/people/{id}/contracts/current` | Show current contract for a person |
| `GET` | `/people/contracts/current` | List all people current contracts |
| `PATCH` | `/people/{id}/custom-fields/checkbox/` | Add checkbox value to person |
| `PATCH` | `/people/{id}/custom-fields/date/` | Add date value to person |
| `PATCH` | `/people/{id}/custom-fields/text/` | Add text value to person |
| `PATCH` | `/people/{id}/custom-fields/select/` | Add select values to person |
| `GET` | `/people/custom-fields` | List all people custom fields |
| `GET` | `/people/notes` | List all people notes |
| `GET` | `/people/{id}/projects/` | List projects for a person |
| `POST` | `/people/{id}/projects/` | Add project to a person |
| `GET` | `/people/{id}/skills/` | List skills for a person |
| `POST` | `/people/{id}/skills/` | Add a skill to a person |
| `PATCH` | `/people/{id}/skills/{sid}` | Update a skill for a person |
| `DELETE` | `/people/{id}/skills/{sid}` | Remove a skill from a person |
| `GET` | `/people/skills` | List all people skills |
| `GET` | `/people/{id}/time-offs/leave` | List leave for a person |
| `GET` | `/people/{id}/time-offs/holidays` | List holidays for a person |
| `GET` | `/people/{id}/time-offs/rostered-off` | List rostered time offs for a person |
| `GET` | `/people-tags/` | List people tags |
| `POST` | `/people-tags/` | Create a people tag |
| `GET` | `/people-tags/{id}` | Show a people tag |
| `PATCH` | `/people-tags/{id}` | Update a people tag |
| `DELETE` | `/people-tags/{id}` | Delete a people tag |
| `GET` | `/placeholders/` | List placeholders |
| `POST` | `/placeholders/` | Create a placeholder |
| `POST` | `/placeholders/{id}/skills/` | Add a skill to a placeholder |
| `DELETE` | `/placeholders/{id}/skills/{sid}` | Remove a skill from a placeholder |
| `POST` | `/placeholders/{id}/teams/` | Add a placeholder to a team |
| `DELETE` | `/placeholders/{id}/teams/{tid}` | Remove a placeholder from a team |
| `GET` | `/project-tags/` | List project tags |
| `POST` | `/project-tags/` | Create a project tag |
| `GET` | `/project-tags/{id}` | Show a project tag |
| `PATCH` | `/project-tags/{id}` | Update a project tag |
| `POST` | `/project-tags/{id}/project/{pid}` | Add tag to project |
| `DELETE` | `/project-tags/{id}/project/{pid}` | Remove tag from project |
| `GET` | `/projects/` | List projects |
| `POST` | `/projects/` | Create a project |
| `GET` | `/projects/{id}` | Show a project |
| `PATCH` | `/projects/{id}` | Update a project |
| `DELETE` | `/projects/{id}/` | Delete a project |
| `GET` | `/projects/{id}/actuals/` | List actuals for a project |
| `GET` | `/projects/{id}/assignments/` | List assignments for a project |
| `GET` | `/budget-roles/` | List budget roles (all) |
| `GET` | `/projects/{id}/budget-roles/` | List budget roles for a project |
| `POST` | `/projects/{id}/budget-roles/` | Create a project budget role |
| `GET` | `/projects/{id}/budget-roles/{rid}` | Get a project budget role |
| `PATCH` | `/projects/{id}/budget-roles/{rid}` | Update a project budget role |
| `DELETE` | `/projects/{id}/budget-roles/{rid}` | Delete a project budget role |
| `PATCH` | `/projects/{id}/custom-fields/checkbox/` | Add checkbox value to project |
| `PATCH` | `/projects/{id}/custom-fields/date/` | Add date value to project |
| `PATCH` | `/projects/{id}/custom-fields/select/` | Add select values to project |
| `PATCH` | `/projects/{id}/custom-fields/text/` | Add text value to project |
| `GET` | `/projects/custom-fields` | List all project custom fields |
| `GET` | `/milestones/` | List all project milestones |
| `GET` | `/projects/{id}/milestones/` | List milestones for a project |
| `POST` | `/projects/{id}/milestones/` | Create a milestone |
| `PATCH` | `/projects/{id}/milestones/{mid}` | Update a milestone |
| `DELETE` | `/projects/{id}/milestones/{mid}` | Delete a milestone |
| `GET` | `/project-notes/` | List all project notes |
| `GET` | `/projects/{id}/notes/` | List notes for a project |
| `POST` | `/projects/{id}/notes/` | Create a project note |
| `GET` | `/other-expenses/` | List all other expenses |
| `GET` | `/projects/{id}/other-expenses/` | List other expenses for a project |
| `POST` | `/projects/{id}/other-expenses/` | Create an other expense |
| `PATCH` | `/projects/{id}/other-expenses/{eid}/` | Update an other expense |
| `GET` | `/phases/` | List all phases |
| `GET` | `/projects/{id}/phases/` | List phases for a project |
| `GET` | `/projects/{id}/phases/{pid}` | Show a phase |
| `POST` | `/projects/{id}/phases/` | Create a phase |
| `PATCH` | `/projects/{id}/phases/{pid}` | Update a phase |
| `DELETE` | `/projects/{id}/phases/{pid}` | Delete a phase |
| `GET` | `/projects/{id}/people/` | List people assigned to a project |
| `GET` | `/project-members/` | List members of projects |
| `GET` | `/person-requests/` | List all person requests |
| `GET` | `/projects/{id}/person-requests/` | List person requests for a project |
| `POST` | `/projects/{id}/person-requests/` | Create a person request |
| `GET` | `/projects/{id}/person-requests/{rid}` | Show a person request |
| `PATCH` | `/projects/{id}/person-requests/{rid}` | Update person request status |
| `GET` | `/project-rates/` | List role rates (all) |
| `GET` | `/projects/{id}/project-rates/` | List role rates for a project |
| `PATCH` | `/projects/{id}/project-rates/{rid}/` | Update a rate for a role on a project |
| `GET` | `/projects/{id}/timesheet-lock/` | Show timesheet lock for a project |
| `PATCH` | `/projects/{id}/timesheet-lock/` | Update timesheet lock for a project |
| `GET` | `/project-workstreams/` | List project workstreams (all) |
| `GET` | `/projects/{id}/project-workstreams/` | List workstreams for a project |
| `GET` | `/projects/{id}/project-workstreams/{wid}/` | View project workstream |
| `POST` | `/projects/{id}/project-workstreams/{wid}/` | Add workstream to a project |
| `DELETE` | `/projects/{id}/project-workstreams/{wid}/` | Delete project workstream |
| `GET` | `/rate-cards/` | List rate cards |
| `POST` | `/rate-cards/` | Create a rate card |
| `GET` | `/rate-cards/{id}` | Show a rate card |
| `PATCH` | `/rate-cards/{id}` | Update a rate card |
| `DELETE` | `/rate-cards/{id}` | Delete a rate card |
| `GET` | `/reports/hours/people/{id}` | By-day entries for a person |
| `GET` | `/reports/people/{id}/` | Person metrics (beta) |
| `GET` | `/reports/hours/projects/{id}` | By-day entries for a project |
| `GET` | `/reports/totals/projects/` | List totals for all projects |
| `GET` | `/reports/totals/projects/{id}` | Show totals for a project |
| `GET` | `/reports/projects/{id}/` | Project metrics (beta) |
| `GET` | `/roles/` | List roles |
| `POST` | `/roles/` | Create a role |
| `GET` | `/roles/{id}` | Show a role |
| `PATCH` | `/roles/{id}` | Update a role |
| `GET` | `/skills/` | List skills |
| `POST` | `/skills/` | Create a skill |
| `GET` | `/skills/{id}` | Show a skill |
| `PATCH` | `/skills/{id}` | Update a skill |
| `DELETE` | `/skills/{id}` | Delete a skill |
| `GET` | `/skills/{id}/people/` | List people for a skill |
| `POST` | `/skills/{id}/people/` | Add people to a skill |
| `GET` | `/teams/` | List teams |
| `POST` | `/teams/` | Create a team |
| `GET` | `/teams/{id}/` | Show a team |
| `PATCH` | `/teams/{id}/` | Update a team |
| `DELETE` | `/teams/{id}/` | Delete a team |
| `GET` | `/teams/{id}/people/` | List people in a team |
| `GET` | `/time-offs/holidays/` | List holiday time offs |
| `GET` | `/time-offs/leave/` | List leave time offs |
| `POST` | `/time-offs/leave/` | Create a leave time off |
| `GET` | `/time-offs/leave/{id}/` | Show a leave time off |
| `DELETE` | `/time-offs/leave/{id}/` | Delete a leave time off |
| `POST` | `/time-offs/leave/bulk/` | Create leave time offs in bulk |
| `DELETE` | `/time-offs/leave/bulk/` | Delete leave time offs in bulk |
| `GET` | `/time-offs/rostered-off/` | List rostered time offs |
| `DELETE` | `/time-offs/rostered-off/{id}` | Delete a rostered time off |
| `GET` | `/users/` | List users |
| `GET` | `/users/{id}` | Show a user |
| `DELETE` | `/users/{id}` | Delete a user |
| `POST` | `/users/{id}/views/{vid}` | Allocate a view to a user |
| `DELETE` | `/users/{id}/views/{vid}/` | Remove allocated view from user |
| `GET` | `/users/{id}/views/` | List allocated views for a user |
| `GET` | `/legacy-id/{model}/{legacyId}` | Convert legacy ID |
| `GET` | `/views/` | List views |
| `GET` | `/workstreams/` | List workstreams |
| `POST` | `/workstreams/` | Create a workstream |
| `GET` | `/workstreams/{id}/` | Show a workstream |
| `PATCH` | `/workstreams/{id}/` | Update a workstream |
| `DELETE` | `/workstreams/{id}/` | Delete a workstream |

---

*This document was compiled from the Runn OpenAPI v3.1 specification. Check `https://developer.runn.io/openapi/v1.0.0.json` directly for the latest machine-readable spec.*
