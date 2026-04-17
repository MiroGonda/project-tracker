import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ComposedChart, Area,
} from 'recharts'
import {
  LayoutDashboard, RefreshCw, AlertTriangle, AlertCircle,
  TrendingUp, Download, Check, Target, X, ChevronDown, ChevronUp,
  Circle, CheckCircle2, Calendar, Search, Minimize2, Settings2, Layers,
  Inbox, GanttChart, CalendarDays, ChevronLeft, ChevronRight,
  Plus, Link2, Eye, FileText, ImagePlus, Users,
  BarChart2, Table2, LayoutList, Pencil, ClipboardCopy, Trash2, Columns3, Type as TypeIcon,
} from 'lucide-react'
import { boardCards, boardMovements, boardSummary, cycleTime } from '../api/phobos'
import { subscribeRequests, saveRequest, deleteRequest, migrateLocalRequests } from '../api/requests'
import { fetchBoardLabels, createBoardLabel, addLabelToCard, deleteCard, setCardDue, fetchBoardCardsWithFields, setCardCustomField, fetchTrelloBoardCards, fetchBoardActions } from '../api/trello'
import { getPassConfigForBoard } from './Settings'
import { useAccess } from '../context/AccessContext'
import { db } from '../firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import Spinner from '../components/Spinner'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'

// ─── Constants ───────────────────────────────────────────────────────────────

const TRELLO_COLORS = {
  red:     { bg: 'bg-red-500/20',     text: 'text-red-400',     dot: '#ef4444' },
  orange:  { bg: 'bg-orange-500/20',  text: 'text-orange-400',  dot: '#f97316' },
  yellow:  { bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  dot: '#eab308' },
  green:   { bg: 'bg-green-500/20',   text: 'text-green-400',   dot: '#22c55e' },
  blue:    { bg: 'bg-blue-500/20',    text: 'text-blue-400',    dot: '#3b82f6' },
  purple:  { bg: 'bg-purple-500/20',  text: 'text-purple-400',  dot: '#a855f7' },
  pink:    { bg: 'bg-pink-500/20',    text: 'text-pink-400',    dot: '#ec4899' },
  sky:     { bg: 'bg-sky-500/20',     text: 'text-sky-400',     dot: '#0ea5e9' },
  lime:    { bg: 'bg-lime-500/20',    text: 'text-lime-400',    dot: '#84cc16' },
  default: { bg: 'bg-white/10',       text: 'text-text-muted',  dot: '#6b7280' },
}
function labelStyle(color) {
  return TRELLO_COLORS[color?.toLowerCase()] || TRELLO_COLORS.default
}

const STATUS_COLOR = {
  'Pending':      '#3b82f6',
  'Ongoing':      '#eab308',
  'For Review':   '#f97316',
  'Revising':     '#ef4444',
  'For Approval': '#a855f7',
  'Done':         '#22c55e',
}

const STATUS_ABBREV = {
  'Pending':      'Pnd',
  'Ongoing':      'Ong',
  'For Review':   'Rev',
  'Revising':     'Rvs',
  'For Approval': 'App',
  'Done':         'Done',
}

const STATUS_ORDER = ['Pending', 'Ongoing', 'For Review', 'Revising', 'For Approval', 'Done']

const DIST_COLORS = {
  'Work Lane':    '#6366f1',
  'Process Lane': '#a855f7',
  'Misc':         '#6b7280',
  'OPS':          '#0ea5e9',
  'Backlog':      '#6b7280',
  'Content':      '#f59e0b',
  'Design':       '#ec4899',
  'Dev':          '#22c55e',
  'Screens':      '#3b82f6',
  'Assets':       '#f97316',
  'Motion':       '#8b5cf6',
  'Discarded':    '#4b5563',
  'Pending':      '#3b82f6',
  'Ongoing':      '#eab308',
  'Done':         '#22c55e',
  'For Review':   '#f97316',
  'Revising':     '#ef4444',
  'For Approval': '#a855f7',
}


const LANE_MAP = {
  // ── WORK LANE — OPS ────────────────────────────────────────────────────────
  'Operations Backlog':                           { type: 'Work Lane', category: 'OPS',     status: 'Pending' },
  'Working on Ops Work':                          { type: 'Work Lane', category: 'OPS',     status: 'Ongoing' },
  'Ready for Ops Review':                         { type: 'Work Lane', category: 'OPS',     status: 'Ongoing' },
  'Reviewing Ops Work':                           { type: 'Work Lane', category: 'OPS',     status: 'Ongoing' },
  'Ops Work Complete':                            { type: 'Work Lane', category: 'OPS',     status: 'Done' },

  // ── WORK LANE — BACKLOG ─────────────────────────────────────────────────────
  'Production Backlog':                           { type: 'Work Lane', category: 'Backlog', status: 'Pending' },

  // ── WORK LANE — CONTENT ─────────────────────────────────────────────────────
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

  // ── WORK LANE — DESIGN ─────────────────────────────────────────────────────
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

  // ── WORK LANE — DEV ────────────────────────────────────────────────────────
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

  // ── PROCESS LANE — BACKLOG ──────────────────────────────────────────────────
  '➜ Process Lane':                               { type: 'Process Lane', category: 'Backlog',  status: 'Pending' },
  'Backlog: Process Lane':                        { type: 'Process Lane', category: 'Backlog',  status: 'Pending' },

  // ── PROCESS LANE — CONTENT ─────────────────────────────────────────────────
  '➜ Ready for Content':                          { type: 'Process Lane', category: 'Content',  status: 'Ongoing' },
  '➜ Content: Writing Content':                   { type: 'Process Lane', category: 'Content',  status: 'Ongoing' },
  '➜ Content: Ready for Client Review':           { type: 'Process Lane', category: 'Content',  status: 'For Review' },
  '➜ Content: Sent for Client Review':            { type: 'Process Lane', category: 'Content',  status: 'For Review' },
  '➜ Content: With Revision':                     { type: 'Process Lane', category: 'Content',  status: 'Revising' },
  '➜ Content: Working on Revision':               { type: 'Process Lane', category: 'Content',  status: 'Revising' },
  '➜ Content: Ready for Client Approval':         { type: 'Process Lane', category: 'Content',  status: 'For Approval' },
  '➜ Content: Sent for Client Approval':          { type: 'Process Lane', category: 'Content',  status: 'For Approval' },
  '➜ Content: Done':                              { type: 'Process Lane', category: 'Content',  status: 'Done' },

  // ── PROCESS LANE — SCREENS ─────────────────────────────────────────────────
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

  // ── PROCESS LANE — ASSETS ──────────────────────────────────────────────────
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

  // ── PROCESS LANE — MOTION ──────────────────────────────────────────────────
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

  // ── PROCESS LANE — DEV ─────────────────────────────────────────────────────
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

  // ── MISC ───────────────────────────────────────────────────────────────────
  'Discarded Work':                               { type: 'Misc', category: 'Discarded', status: 'Discarded' },
  'Unused Work':                                  { type: 'Misc', category: 'Discarded', status: 'Discarded' },
}

// ─── Pipeline Column Groups ───────────────────────────────────────────────────

const PROCESS_COL_GROUPS = [
  { category: 'Backlog',  color: '#6b7280', statuses: ['Pending'] },
  { category: 'Content',  color: '#f59e0b', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
  { category: 'Screens',  color: '#3b82f6', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
  { category: 'Assets',   color: '#f97316', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
  { category: 'Motion',   color: '#8b5cf6', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
  { category: 'Dev',      color: '#22c55e', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
]

const WORK_COL_GROUPS = [
  { category: 'Backlog',  color: '#6b7280', statuses: ['Pending'] },
  { category: 'Content',  color: '#f59e0b', statuses: ['Pending', 'Ongoing', 'Done'] },
  { category: 'Design',   color: '#ec4899', statuses: ['Pending', 'Ongoing', 'Done'] },
  { category: 'Dev',      color: '#22c55e', statuses: ['Pending', 'Ongoing', 'Done'] },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0] }

function getEffectiveDateRange(dateRange, customRange) {
  if (customRange) return { dateFrom: customRange.from, dateTo: customRange.to }
  const d = new Date()
  d.setDate(d.getDate() - dateRange)
  return { dateFrom: d.toISOString().split('T')[0], dateTo: today() }
}

function isOverdue(due) {
  if (!due) return false
  return new Date(due) < new Date(today())
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function extractList(card) {
  return card?.currentList || card?.list_name || card?.listName || card?.list || ''
}

function extractDate(card) {
  const d = card?.due || card?.dueDate
  return d ? d.split('T')[0] : null
}

function extractLabels(card) {
  const raw = card?.labels
  if (!Array.isArray(raw)) return []
  return raw.map(l =>
    typeof l === 'string' ? { name: l, color: 'default' } : { id: l?.id, name: l?.name || '', color: l?.color || 'default' }
  ).filter(l => l.name)
}

function extractMembers(card) {
  const raw = card?.members
  if (!Array.isArray(raw)) return []
  return raw.map(m => m?.fullName || m?.username || m?.name || (typeof m === 'string' ? m : '')).filter(Boolean)
}

function extractMcNumber(name) {
  const m = (name || '').match(/mc-(\d+)/i)
  return m ? `MC-${m[1]}` : null
}

function getLaneInfo(card) {
  return LANE_MAP[extractList(card)] || null
}

function extractCycleDays(record) {
  const v = record.cycleTimeDays ?? record.cycleDays ?? record.days ?? record.cycleTime ?? null
  if (v != null && !isNaN(Number(v))) return Number(v)
  const h = record.cycleHours ?? null
  if (h != null && !isNaN(Number(h))) return Number(h) / 24
  return null
}

/**
 * Card type based on labels:
 *   - Process = has a label whose name contains "Main Card" (case-insensitive)
 *   - Work    = everything else
 */
function getCardType(card) {
  const labels = extractLabels(card)
  const isProcess = labels.some(l => /main card/i.test(l.name))
  return isProcess ? 'Process' : 'Work'
}

function extractDifficulty(card) {
  for (const l of extractLabels(card)) {
    const m = (l.name || '').match(/^Difficulty:\s*(.+)$/i)
    if (m) return m[1].trim()
  }
  return null
}

function exportTableAsCsv(rows, headers, filename) {
  const lines = [headers.join(',')]
  for (const row of rows)
    lines.push(row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = filename
  a.click()
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function getPeriodKey(iso, period) {
  const d = new Date(iso)
  if (period === 'daily')   return iso.split('T')[0]
  if (period === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  // weekly: Sunday as week start
  const sun = new Date(d)
  sun.setDate(d.getDate() - d.getDay())
  return sun.toISOString().split('T')[0]
}

function formatPeriodLabel(key, period) {
  if (period === 'daily') {
    const [, m, d] = key.split('-')
    return `${+m}/${+d}`
  }
  if (period === 'monthly') {
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getPeriodBounds(key, period) {
  if (period === 'daily') {
    return [new Date(key), new Date(key + 'T23:59:59')]
  }
  if (period === 'monthly') {
    const [y, m] = key.split('-').map(Number)
    return [new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59, 59)]
  }
  // weekly
  const start = new Date(key)
  const end   = new Date(key)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59)
  return [start, end]
}

// Muted, dim palette — readable on dark backgrounds without being harsh
const DIFF_COLORS = { easy: '#5a9e78', medium: '#b8893a', hard: '#b85c5c', unknown: '#6b7280' }

// ── Movement field extractors (Phobos API field names vary) ──────────────────
function extractMovementToList(m) {
  // Only use fields that unambiguously represent a move destination.
  // Avoid m.list / m.currentList / m.to — those reflect the card's current state
  // at event time and are set on ALL activity records, not just list moves.
  return m.toList || m.listAfter || m.destinationList || ''
}
function extractMovementCardId(m) {
  return m.cardId || m.card_id || m.cardid || null
}
function extractMovementDate(m) {
  return m.movedAt || m.date || m.timestamp || m.createdAt || m.at ||
         m.occurredAt || m.eventDate || m.action_date || m.moved_at || m.created_at || null
}

/**
 * Builds a Map<cardId, dateStr> of when each card was last moved into a Done list.
 * Cards created directly into Done (board setup/import) will not have movement records
 * and are intentionally excluded — their dateLastActivity is unreliable as a completion date.
 */
function buildCompletionDateMap(movements) {
  const map = new Map()
  for (const m of movements) {
    const toList = extractMovementToList(m)
    if (LANE_MAP[toList]?.status !== 'Done') continue
    const cardId  = extractMovementCardId(m)
    const dateStr = extractMovementDate(m)
    if (!cardId || !dateStr) continue
    const existing = map.get(cardId)
    if (!existing || new Date(dateStr) > new Date(existing)) {
      map.set(cardId, dateStr)
    }
  }
  return map
}

/**
 * @param {Map} completionDateMap - from buildCompletionDateMap(movements).
 *   If empty (no movement data at all), falls back to dateLastActivity.
 */
function aggregateThroughput(doneCards, period, cutoff, completionDateMap = new Map()) {
  const map = {}
  for (const c of doneCards) {
    const cardId = c.id || c.cardId
    // Prefer movement-confirmed completion date; fall back only when no movement data exists
    const dateStr = completionDateMap.size > 0
      ? completionDateMap.get(cardId)
      : (c.dateLastActivity || c.updatedAt || c.due)
    if (!dateStr) continue
    const d = new Date(dateStr)
    if (cutoff && d < cutoff) continue
    const key  = getPeriodKey(dateStr, period)
    const type = getCardType(c)
    if (!map[key]) map[key] = { key, label: formatPeriodLabel(key, period), work: 0, process: 0, total: 0, easy: 0, medium: 0, hard: 0, unknown: 0, cards: [] }
    if (type === 'Work') {
      map[key].work++
      const diff = (extractDifficulty(c) || '').toLowerCase()
      const dk   = ['easy','medium','hard'].includes(diff) ? diff : 'unknown'
      map[key][dk]++
    } else {
      map[key].process++
    }
    map[key].total++
    map[key].cards.push(c)
  }
  return Object.keys(map).sort().map(k => map[k])
}

function computeTargetForPeriod(periodKey, period, targets) {
  const [pStart, pEnd] = getPeriodBounds(periodKey, period)
  let total = 0
  for (const t of targets) {
    const tStart = new Date(t.startDate)
    const tEnd   = new Date(t.endDate + 'T23:59:59')
    const overlapMs = Math.max(0, Math.min(pEnd, tEnd) - Math.max(pStart, tStart))
    if (overlapMs <= 0) continue
    const targetMs = tEnd - tStart
    total += t.value * (overlapMs / targetMs)
  }
  return total > 0 ? Math.round(total * 10) / 10 : null
}

// ─── Pagination helper ────────────────────────────────────────────────────────

async function fetchAllPages(apiFn, boardId, baseParams = {}) {
  let page = 1
  const allData = []
  while (true) {
    const result = await apiFn(boardId, { ...baseParams, page, pageSize: 200 })
    const batch  = Array.isArray(result?.data) ? result.data : []
    allData.push(...batch)
    const pg = result?.meta?.pagination
    if (!pg || page >= pg.totalPages) break
    page++
  }
  return allData
}

async function fetchAllCycleTime(rtProjectId, dateFrom, dateTo) {
  const pageSize = 200
  let page = 1, all = []
  while (true) {
    const res = await cycleTime(rtProjectId, { dateFrom, dateTo, status: 'all', pageSize, page })
    const batch = Array.isArray(res?.data) ? res.data : []
    all = all.concat(batch)
    if (batch.length < pageSize) break
    page++
  }
  return all
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent = 'text-text-muted', loading, footer, onClick }) {
  return (
    <div
      className={`bg-surface border rounded-xl p-4 flex flex-col gap-1 ${
        onClick ? 'cursor-pointer border-border hover:border-green-500/40 hover:bg-green-500/5 transition-colors' : 'border-border'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</span>
        {Icon && <Icon size={14} className={accent} />}
      </div>
      {loading
        ? <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
        : <div className="text-3xl font-bold text-text-primary">{value ?? '—'}</div>
      }
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  )
}

function StatusDistBar({ cards }) {
  const counts = {}
  for (const c of cards) {
    const st = getLaneInfo(c)?.status
    if (st && STATUS_ORDER.includes(st)) counts[st] = (counts[st] || 0) + 1
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  return (
    <div>
      <div className="h-2 w-full rounded-full overflow-hidden flex mt-1">
        {STATUS_ORDER.filter(s => counts[s]).map(s => (
          <div key={s} style={{ width: `${counts[s] / total * 100}%`, background: STATUS_COLOR[s] || '#6b7280' }} className="h-full" />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
        {STATUS_ORDER.filter(s => counts[s]).map(s => (
          <span key={s} className="text-[10px] text-text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[s] }} />
            {s} · {Math.round(counts[s] / total * 100)}%
          </span>
        ))}
      </div>
    </div>
  )
}

function SectionCard({ title, children, className = '', headerRight, drilldown, done, slim, headerColor }) {
  const borderClass = headerColor ? '' : drilldown ? 'border-fuchsia-500/40' : done ? 'border-green-500/40' : 'border-border'
  const bgClass     = headerColor ? '' : drilldown ? 'bg-fuchsia-500/10'     : done ? 'bg-green-500/10'     : ''
  const titleClass  = headerColor ? '' : drilldown ? 'text-fuchsia-400'      : done ? 'text-green-400'       : 'text-text-muted'
  const hColor66    = headerColor ? headerColor + '66' : undefined
  const hColor1a    = headerColor ? headerColor + '1a' : undefined
  return (
    <div className={`bg-surface border ${borderClass} rounded-xl flex flex-col ${className}`}
      style={hColor66 ? { borderColor: hColor66 } : undefined}>
      <div className={`px-4 ${slim ? 'py-2' : 'py-3'} border-b ${borderClass} ${bgClass} flex items-center justify-between rounded-t-xl`}
        style={hColor66 ? { borderColor: hColor66, background: hColor1a } : undefined}>
        <h3 className={`text-sm font-semibold ${titleClass}`} style={headerColor ? { color: headerColor } : undefined}>{title}</h3>
        {headerRight}
      </div>
      <div className="p-4 flex-1 min-h-0">{children}</div>
    </div>
  )
}

// ── FilterPicker ──────────────────────────────────────────────────────────────

function FilterPicker({ label, options, selected, mode, onToggleInclude, onToggleExclude, onClear }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref                 = useRef(null)
  const inputRef            = useRef(null)
  const count               = selected.size

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { if (open) { setSearch(''); setTimeout(() => inputRef.current?.focus(), 10) } }, [open])

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  const isInclude = mode === 'include'
  const activeColor = count > 0
    ? isInclude
      ? 'bg-green-500/10 text-green-400 border-green-500/30'
      : 'bg-red-500/10 text-red-400 border-red-500/30'
    : 'border-border text-text-muted hover:text-text-primary hover:bg-white/5'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${activeColor}`}
      >
        {label}
        {count > 0 && (
          <span className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${isInclude ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {isInclude ? '+' : '−'}{count}
          </span>
        )}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-surface border border-border rounded-xl shadow-xl w-56">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-bg rounded-lg">
              <Search size={11} className="text-text-muted shrink-0" />
              <input
                ref={inputRef}
                className="bg-transparent text-xs text-text-primary outline-none flex-1 placeholder:text-text-muted"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-2 text-[10px] text-text-muted px-1">
              <span className={isInclude && count > 0 ? 'text-green-400 font-medium' : ''}>↑ click = include</span>
              <span className="text-text-muted/40">·</span>
              <span className={!isInclude && count > 0 ? 'text-red-400 font-medium' : ''}>↓ right-click = exclude</span>
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filtered.length === 0
              ? <div className="px-3 py-2 text-xs text-text-muted">No options</div>
              : filtered.map(opt => {
                const isSelected = selected.has(opt)
                return (
                  <button
                    key={opt}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-white/5 text-left"
                    onClick={() => onToggleInclude(opt)}
                    onContextMenu={e => { e.preventDefault(); onToggleExclude(opt) }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? (isInclude ? 'bg-green-400' : 'bg-red-400') : 'bg-text-muted/40'}`} />
                    <span className="flex-1 truncate">{opt}</span>
                    {isSelected && isInclude  && <Check size={11} className="text-green-400 shrink-0" />}
                    {isSelected && !isInclude && <X     size={11} className="text-red-400 shrink-0" />}
                  </button>
                )
              })
            }
          </div>
          {count > 0 && (
            <div className="p-2 border-t border-border">
              <button
                className="w-full text-xs text-text-muted hover:text-text-primary py-1"
                onClick={onClear}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Throughput ─────────────────────────────────────────────────────────────────

function ThroughputTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const get     = key => payload.find(p => p.dataKey === key)
  const easy    = get('easy');   const medium  = get('medium')
  const hard    = get('hard');   const unknown = get('unknown')
  const process = get('process'); const target = get('target')
  const total   = (easy?.value||0) + (medium?.value||0) + (hard?.value||0) + (unknown?.value||0) + (process?.value||0)
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="text-text-muted mb-1">{label}</div>
      {easy?.value    > 0 && <div style={{ color: DIFF_COLORS.easy    }}>Easy:     <span className="font-semibold">{easy.value}</span></div>}
      {medium?.value  > 0 && <div style={{ color: DIFF_COLORS.medium  }}>Medium:   <span className="font-semibold">{medium.value}</span></div>}
      {hard?.value    > 0 && <div style={{ color: DIFF_COLORS.hard    }}>Hard:     <span className="font-semibold">{hard.value}</span></div>}
      {unknown?.value > 0 && <div style={{ color: DIFF_COLORS.unknown }}>Work (no label): <span className="font-semibold">{unknown.value}</span></div>}
      {process?.value > 0 && <div style={{ color: '#a855f7' }}>Process: <span className="font-semibold">{process.value}</span></div>}
      <div className="border-t border-border/40 mt-1 pt-1 text-text-muted">Total: <span className="font-semibold text-text-primary">{total}</span></div>
      {target?.value != null && <div style={{ color: '#f59e0b' }}>Target: <span className="font-semibold">{target.value}</span></div>}
    </div>
  )
}

function TargetsPanel({ targets, setTargets, boardId, onClose }) {
  const [form, setForm] = useState({ startDate: '', endDate: '', value: '' })
  function add() {
    if (!form.startDate || !form.endDate || !form.value) return
    const next = [...targets, { id: Date.now(), ...form, value: +form.value }]
    setTargets(next)
    localStorage.setItem(`targets_${boardId}`, JSON.stringify(next))
    setForm({ startDate: '', endDate: '', value: '' })
  }
  function remove(id) {
    const next = targets.filter(t => t.id !== id)
    setTargets(next)
    localStorage.setItem(`targets_${boardId}`, JSON.stringify(next))
  }
  return (
    <div className="rounded-xl border border-amber-500/25 bg-surface/70 backdrop-blur-md p-4 w-72 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Throughput Targets</span>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={13} /></button>
      </div>
      {targets.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {targets.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs text-text-muted">
              <Target size={11} className="text-amber-400 shrink-0" />
              <span className="flex-1">{fmtDateShort(t.startDate)} – {fmtDateShort(t.endDate)}</span>
              <span className="text-text-primary font-medium">{t.value}</span>
              <button onClick={() => remove(t.id)} className="hover:text-red-400"><X size={11} /></button>
            </div>
          ))}
          <div className="border-t border-border/40" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-muted">From</label>
            <input type="date" className="input text-xs py-1" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-muted">To</label>
            <input type="date" className="input text-xs py-1" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] text-text-muted">Target total for period</label>
            <input type="number" min="1" className="input text-xs py-1" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
          </div>
          <button className="btn-primary py-1 text-xs shrink-0" onClick={add}><Check size={12} /> Add</button>
        </div>
      </div>
    </div>
  )
}

function ThroughputSection({ doneCards, allDoneCards, boardId, cutoff, onBarClick, allowedPeriods, view, onViewChange, completionDateMap = new Map() }) {
  const [period,  setPeriod]  = useState('daily')
  const [showTgt, setShowTgt] = useState(false)
  const [targets, setTargets] = useState(() => {
    const raw = localStorage.getItem(`targets_${boardId}`)
    return raw ? JSON.parse(raw) : []
  })
  const tgtBtnRef = useRef(null)

  useEffect(() => {
    const raw = localStorage.getItem(`targets_${boardId}`)
    setTargets(raw ? JSON.parse(raw) : [])
  }, [boardId])

  useEffect(() => {
    if (!allowedPeriods.includes(period)) setPeriod(allowedPeriods[0])
  }, [allowedPeriods])

  const data = useMemo(() => aggregateThroughput(doneCards, period, cutoff, completionDateMap).map(p => ({
    ...p,
    target: computeTargetForPeriod(p.key, period, targets),
  })), [doneCards, period, cutoff, completionDateMap, targets])

  const yMax = useMemo(() => {
    const src = allDoneCards?.length ? allDoneCards : doneCards
    const allData = aggregateThroughput(src, period, cutoff, completionDateMap)
    const max = Math.max(...allData.map(d => d.total), 1)
    return Math.ceil(max * 1.2)
  }, [allDoneCards, doneCards, period, cutoff, completionDateMap])

  const hasTargets = targets.length > 0
  const PERIOD_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

  return (
    <SectionCard
      slim
      title="Throughput"
      headerRight={
        <div className="flex items-center gap-1.5">
          {/* Period toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden text-xs">
            {allowedPeriods.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 transition-colors ${period === p ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          {/* Targets icon button */}
          <button
            ref={tgtBtnRef}
            onClick={() => setShowTgt(v => !v)}
            title={hasTargets ? `Targets (${targets.length})` : 'Targets'}
            className={`p-1 rounded-lg border transition-colors ${
              hasTargets || showTgt
                ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                : 'border-border text-text-muted hover:bg-white/5'
            }`}
          >
            <Target size={13} />
          </button>
          {/* Chart / Table icon toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => onViewChange('chart')} title="Chart"
              className={`p-1 transition-colors ${view === 'chart' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
              <BarChart2 size={13} />
            </button>
            <button onClick={() => onViewChange('table')} title="Table"
              className={`p-1 transition-colors ${view === 'table' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
              <Table2 size={13} />
            </button>
          </div>
        </div>
      }
    >
      {view === 'chart' ? (
        <>
          <div className="relative h-[320px]">
            {showTgt && (
              <div className="absolute inset-0 z-10 rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowTgt(false)} />
                <div className="absolute top-2 right-2 z-20">
                  <TargetsPanel targets={targets} setTargets={setTargets} boardId={boardId} onClose={() => setShowTgt(false)} />
                </div>
              </div>
            )}
            {data.length === 0
              ? <div className="flex items-center justify-center h-full text-text-muted text-xs">No throughput data for this period</div>
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#2a2a2e" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, yMax]} />
                    <Tooltip content={<ThroughputTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="easy"    name="Easy"             stackId="a" fill={DIFF_COLORS.easy}    maxBarSize={40} cursor={onBarClick ? 'pointer' : undefined} onClick={onBarClick} />
                    <Bar dataKey="medium"  name="Medium"           stackId="a" fill={DIFF_COLORS.medium}  maxBarSize={40} cursor={onBarClick ? 'pointer' : undefined} onClick={onBarClick} />
                    <Bar dataKey="hard"    name="Hard"             stackId="a" fill={DIFF_COLORS.hard}    maxBarSize={40} cursor={onBarClick ? 'pointer' : undefined} onClick={onBarClick} />
                    <Bar dataKey="unknown" name="Work (no label)"  stackId="a" fill={DIFF_COLORS.unknown} maxBarSize={40} cursor={onBarClick ? 'pointer' : undefined} onClick={onBarClick} />
                    <Bar dataKey="process" name="Process"          stackId="a" fill="#a855f7"             maxBarSize={40} radius={[3,3,0,0]} cursor={onBarClick ? 'pointer' : undefined} onClick={onBarClick} />
                    {hasTargets && (
                      <Area dataKey="target" name="Target" stroke="#f59e0b" strokeDasharray="5 3" fill="#f59e0b" fillOpacity={0.08} type="stepAfter" connectNulls isAnimationActive={false} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: DIFF_COLORS.easy }} /> Easy</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: DIFF_COLORS.medium }} /> Medium</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: DIFF_COLORS.hard }} /> Hard</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: DIFF_COLORS.unknown }} /> Work (no label)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block bg-[#a855f7]" /> Process</span>
            {hasTargets && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#f59e0b] inline-block" /> Target</span>}
          </div>
        </>
      ) : (
        <div className="overflow-auto max-h-[340px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-text-muted border-b border-border">
                <th className="text-left py-2 pr-3">Period</th>
                <th className="text-right py-2 pr-3" style={{ color: DIFF_COLORS.easy }}>Easy</th>
                <th className="text-right py-2 pr-3" style={{ color: DIFF_COLORS.medium }}>Medium</th>
                <th className="text-right py-2 pr-3" style={{ color: DIFF_COLORS.hard }}>Hard</th>
                <th className="text-right py-2 pr-3" style={{ color: DIFF_COLORS.unknown }}>No label</th>
                <th className="text-right py-2 pr-3" style={{ color: '#a855f7' }}>Process</th>
                <th className="text-right py-2 pr-3">Total</th>
                {hasTargets && <th className="text-right py-2 pr-3" style={{ color: '#f59e0b' }}>Target</th>}
                {hasTargets && <th className="text-right py-2">vs Target</th>}
              </tr>
            </thead>
            <tbody>
              {data.map(row => {
                const vs = row.target ? Math.round(row.total / row.target * 100) : null
                const vsColor = vs == null ? '' : vs >= 100 ? 'text-green-400' : vs >= 75 ? 'text-amber-400' : 'text-red-400'
                return (
                  <tr key={row.key} className="border-b border-border/50 hover:bg-white/5">
                    <td className="py-1.5 pr-3 text-text-muted">{row.label}</td>
                    <td className="py-1.5 pr-3 text-right font-medium" style={{ color: DIFF_COLORS.easy }}>{row.easy}</td>
                    <td className="py-1.5 pr-3 text-right font-medium" style={{ color: DIFF_COLORS.medium }}>{row.medium}</td>
                    <td className="py-1.5 pr-3 text-right font-medium" style={{ color: DIFF_COLORS.hard }}>{row.hard}</td>
                    <td className="py-1.5 pr-3 text-right font-medium" style={{ color: DIFF_COLORS.unknown }}>{row.unknown}</td>
                    <td className="py-1.5 pr-3 text-right font-medium" style={{ color: '#a855f7' }}>{row.process}</td>
                    <td className="py-1.5 pr-3 text-right text-text-primary font-semibold">{row.total}</td>
                    {hasTargets && <td className="py-1.5 pr-3 text-right text-amber-400">{row.target ?? '—'}</td>}
                    {hasTargets && <td className={`py-1.5 text-right ${vsColor}`}>{vs != null ? `${vs}%` : '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

function ThroughputDrilldownTable({ cards }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-muted border-b border-fuchsia-500/20">
            <th className="text-left py-1.5 pr-3">Card</th>
            <th className="text-left py-1.5 pr-3 hidden md:table-cell">Lane</th>
            <th className="text-left py-1.5 pr-3 hidden lg:table-cell">Type</th>
            <th className="text-left py-1.5 pr-3 hidden lg:table-cell">Labels</th>
            <th className="text-left py-1.5">Completed</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((c, i) => {
            const lane = getLaneInfo(c)
            const labels = extractLabels(c)
            return (
              <tr key={c.id || i} className="border-b border-border/40 hover:bg-white/5">
                <td className="py-1.5 pr-3 text-text-primary truncate max-w-[200px]">{c.name}</td>
                <td className="py-1.5 pr-3 hidden md:table-cell">
                  {lane && <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-text-muted">{extractList(c)}</span>}
                </td>
                <td className="py-1.5 pr-3 hidden lg:table-cell">
                  {getCardType(c) === 'Work'    && <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300">Work</span>}
                  {getCardType(c) === 'Process' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300">Process</span>}
                </td>
                <td className="py-1.5 pr-3 hidden lg:table-cell">
                  <div className="flex gap-1 flex-wrap">
                    {labels.slice(0, 3).map((l, j) => {
                      const s = labelStyle(l.color)
                      return <span key={j} className={`px-1.5 py-0.5 rounded text-[10px] ${s.bg} ${s.text}`}>{l.name}</span>
                    })}
                    {labels.length > 3 && <span className="text-[10px] text-text-muted">+{labels.length - 3}</span>}
                  </div>
                </td>
                <td className="py-1.5 text-text-muted">{fmtDate(c.dateLastActivity)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Throughput KPI Panel ────────────────────────────────────────────────────────

function ThroughputKpiPanel({ p85Days, wipP85, diffCounts }) {
  const { easy = 0, medium = 0, hard = 0, unknown = 0 } = diffCounts || {}
  const total = easy + medium + hard + unknown

  function DiffRow({ label, count, color }) {
    const pct = total > 0 ? Math.round(count / total * 100) : 0
    return (
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
        <span className="text-xs text-text-muted flex-1">{label}</span>
        <span className="text-sm font-bold text-text-primary tabular-nums">{count}</span>
        <span className="text-[11px] text-text-muted/60 w-9 text-right tabular-nums">{pct}%</span>
      </div>
    )
  }

  return (
    <SectionCard slim title="Throughput KPIs">
      <div className="flex flex-col gap-5">
        {/* Cycle Time stats */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/60">Cycle Time</span>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-end justify-between">
              <span className="text-xs text-text-muted">Done (85p)</span>
              {p85Days != null
                ? <span className="text-lg font-bold tabular-nums leading-none" style={{ color: '#a855f7' }}>{p85Days.toFixed(1)}<span className="text-sm font-medium ml-0.5">d</span></span>
                : <span className="text-sm text-text-muted/40">—</span>
              }
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xs text-text-muted">WIP (85p)</span>
              {wipP85 != null
                ? <span className="text-lg font-bold tabular-nums leading-none" style={{ color: '#f59e0b' }}>{wipP85.toFixed(1)}<span className="text-sm font-medium ml-0.5">d</span></span>
                : <span className="text-sm text-text-muted/40">—</span>
              }
            </div>
          </div>
        </div>

        <div className="border-t border-border/40" />

        {/* Difficulty breakdown */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/60">Difficulty</span>
            <span className="text-xs text-text-muted/50">{total} total</span>
          </div>
          <div className="flex flex-col gap-2">
            <DiffRow label="Easy"   count={easy}    color={DIFF_COLORS.easy} />
            <DiffRow label="Medium" count={medium}  color={DIFF_COLORS.medium} />
            <DiffRow label="Hard"   count={hard}    color={DIFF_COLORS.hard} />
            {unknown > 0 && <DiffRow label="No label" count={unknown} color={DIFF_COLORS.unknown} />}
          </div>
          {total > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden mt-0.5 gap-px">
              {easy    > 0 && <div style={{ flex: easy,    background: DIFF_COLORS.easy }} />}
              {medium  > 0 && <div style={{ flex: medium,  background: DIFF_COLORS.medium }} />}
              {hard    > 0 && <div style={{ flex: hard,    background: DIFF_COLORS.hard }} />}
              {unknown > 0 && <div style={{ flex: unknown, background: DIFF_COLORS.unknown }} />}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

// ── Pipeline Distribution ──────────────────────────────────────────────────────

function DistBar({ label, count, total, color }) {
  const pct = total ? Math.round(count / total * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted truncate">{label}</span>
        <span className="text-text-muted ml-2 shrink-0">{count} · {pct}%</span>
      </div>
      <div className="h-2 w-full bg-bg rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color || '#6b7280' }} className="h-full rounded-full transition-all" />
      </div>
    </div>
  )
}

function PipelineDistribution({ cards, loading }) {
  const [tab, setTab] = useState('Category')
  const TABS = ['Category', 'Type', 'Labels']

  const { categoryMap, typeMap, labelMap } = useMemo(() => {
    const categoryMap = {}, typeMap = {}, labelMap = {}
    for (const c of cards) {
      // Category = the card's current list name
      const listName = extractList(c) || 'Unknown'
      categoryMap[listName] = (categoryMap[listName] || 0) + 1
      // Type = Work or Process based on "Main Card" label
      const type = getCardType(c)
      typeMap[type] = (typeMap[type] || 0) + 1
      // Labels
      for (const l of extractLabels(c)) {
        const key = `${l.name}||${l.color}`
        if (!labelMap[key]) labelMap[key] = { name: l.name, color: l.color, count: 0 }
        labelMap[key].count++
      }
    }
    return { categoryMap, typeMap, labelMap: Object.values(labelMap).sort((a, b) => b.count - a.count) }
  }, [cards])

  const total = cards.length

  if (loading) {
    return (
      <SectionCard title="Pipeline Distribution">
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-7 bg-white/5 rounded animate-pulse" />)}
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      slim
      title="Pipeline Distribution"
      headerRight={
        <div className="flex border border-border rounded-lg overflow-hidden text-xs">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2 py-0.5 transition-colors ${tab === t ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
              {t}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'Category' && (
        <div className="overflow-y-auto max-h-[260px] flex flex-col gap-3">
          {Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
            <DistBar key={cat} label={cat} count={count} total={total} color={DIST_COLORS[cat] || '#6b7280'} />
          ))}
          {Object.keys(categoryMap).length === 0 && <p className="text-xs text-text-muted">No list data</p>}
        </div>
      )}
      {tab === 'Type' && (
        <div className="flex flex-col gap-3">
          {['Work', 'Process'].filter(t => typeMap[t]).map(t => (
            <DistBar key={t} label={t} count={typeMap[t]} total={total}
              color={t === 'Work' ? '#6366f1' : '#a855f7'} />
          ))}
        </div>
      )}
      {tab === 'Labels' && (
        <div className="overflow-y-auto max-h-[260px] flex flex-col gap-2">
          {labelMap.length === 0
            ? <p className="text-xs text-text-muted">No labels found</p>
            : labelMap.map((l, i) => {
              const s = labelStyle(l.color)
              const maxCount = labelMap[0]?.count || 1
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`shrink-0 w-36 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${s.bg} ${s.text}`}>{l.name}</span>
                  <div className="flex-1 h-2 bg-bg rounded-full overflow-hidden">
                    <div style={{ width: `${l.count / maxCount * 100}%`, background: s.dot }} className="h-full rounded-full" />
                  </div>
                  <span className="text-[10px] text-text-muted w-6 text-right shrink-0">{l.count}</span>
                </div>
              )
            })
          }
        </div>
      )}
    </SectionCard>
  )
}

// ── Pipeline Table View ────────────────────────────────────────────────────────

function exportPipelineTableAsCsv(rows, colGroups, tableType, boardName) {
  const headers = ['MC#', ...colGroups.map(g => g.category), 'Done%']
  const lines   = [headers.join(',')]
  for (const row of rows) {
    const values = [
      row.mc,
      ...colGroups.map(g => {
        const total = g.statuses.reduce((s, st) => s + (row.counts[`${g.category}__${st}`] || 0), 0)
        return total || ''
      }),
      `${row.total > 0 ? Math.round((row.done / row.total) * 100) : 0}%`,
    ]
    lines.push(values.join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `pipeline_${tableType}_${(boardName || 'board').replace(/\s+/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function PipelineTableView({ activeCards, doneCards, loading, compact = false, exportRef, onCellClick, boardName, typeFilter }) {
  const resolvedType    = typeFilter === 'work' ? 'work' : typeFilter === 'process' ? 'process' : null
  const colGroups       = resolvedType === 'work' ? WORK_COL_GROUPS : PROCESS_COL_GROUPS
  const laneType        = resolvedType === 'work' ? 'Work Lane' : 'Process Lane'
  const compactStatuses = STATUS_ORDER.filter(s => colGroups.some(g => g.statuses.includes(s)))

  const [showSettings, setShowSettings]     = useState(false)
  const [includeNoMc, setIncludeNoMc]       = useState(true)
  const [includeDone, setIncludeDone]       = useState(true)

  const rows = useMemo(() => {
    const allCards = [...activeCards, ...doneCards]
      .filter(c => LANE_MAP[extractList(c)]?.type === laneType)
    const mcMap = {}
    for (const card of allCards) {
      const mcRaw = extractMcNumber(card.name)
      if (!includeNoMc && !mcRaw) continue
      const mc   = mcRaw || '—'
      const meta = LANE_MAP[extractList(card)]
      if (!meta) continue
      if (!includeDone && meta.status === 'Done') continue
      if (!mcMap[mc]) mcMap[mc] = { mc, counts: {}, total: 0, done: 0 }
      const key = `${meta.category}__${meta.status}`
      mcMap[mc].counts[key] = (mcMap[mc].counts[key] || 0) + 1
      mcMap[mc].total++
      if (meta.status === 'Done') mcMap[mc].done++
    }
    let result = Object.values(mcMap)
    // If includeDone is off, drop MC rows where every card was Done (they'd be empty after filtering)
    if (!includeDone) result = result.filter(r => r.total > 0)
    return result.sort((a, b) => {
      if (a.mc === '—') return 1
      if (b.mc === '—') return -1
      const na = parseInt(a.mc.replace('MC-', '')) || 0
      const nb = parseInt(b.mc.replace('MC-', '')) || 0
      return na - nb
    })
  }, [activeCards, doneCards, laneType, includeNoMc, includeDone])

  // Wire export callback
  useEffect(() => {
    if (exportRef) exportRef.current = () => exportPipelineTableAsCsv(rows, colGroups, resolvedType, boardName)
  }, [rows, colGroups, resolvedType, boardName, exportRef])

  function donePctColor(pct) {
    if (pct === 100) return '#22c55e'
    if (pct >= 75)   return '#84cc16'
    if (pct >= 50)   return '#eab308'
    if (pct >= 25)   return '#f97316'
    return '#e8e8e8'
  }

  if (loading) {
    return <div className="flex flex-col gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-7 bg-white/5 rounded animate-pulse" />)}</div>
  }

  if (!resolvedType) {
    return (
      <p className="text-xs text-text-muted text-center py-6">
        Select <span className="text-indigo-400 font-semibold">Work</span> or <span className="text-purple-400 font-semibold">Process</span> in the filter above to view the table.
      </p>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-text-muted">{rows.length} MCs</span>
        <div className="relative ml-auto">
          <button
            className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-text transition-colors"
            title="Table settings"
            onClick={() => setShowSettings(v => !v)}>
            <Settings2 size={13} />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-surface border border-border rounded-lg shadow-xl p-3 w-56 flex flex-col gap-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Table Settings</p>
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input type="checkbox" checked={includeNoMc} onChange={e => setIncludeNoMc(e.target.checked)}
                  className="accent-accent w-3.5 h-3.5 cursor-pointer" />
                <span className="text-xs text-text group-hover:text-accent transition-colors">Include cards with no MC#</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input type="checkbox" checked={includeDone} onChange={e => setIncludeDone(e.target.checked)}
                  className="accent-accent w-3.5 h-3.5 cursor-pointer" />
                <span className="text-xs text-text group-hover:text-accent transition-colors">Include Done cards</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {rows.length === 0
        ? <p className="text-xs text-text-muted py-4 text-center">No {tableType} cards found</p>
        : (
          <div className="overflow-auto max-h-[460px]">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-10">
                {!compact ? (
                  <>
                    {/* Row 1 — category headers */}
                    <tr className="bg-black/30">
                      <th className="sticky left-0 bg-bg z-10 min-w-[72px] px-2 py-1.5 text-left text-text-muted" rowSpan={2}>MC #</th>
                      {colGroups.map(g => (
                        <th key={g.category} colSpan={g.statuses.length}
                          className="border-b px-2 py-1 text-center font-semibold"
                          style={{ color: g.color, borderLeft: `2px solid ${g.color}` }}>
                          {g.category}
                        </th>
                      ))}
                      <th className="sticky right-0 bg-bg z-10 min-w-[56px] px-2 py-1.5 text-center text-green-400 font-semibold" rowSpan={2}>Done%</th>
                    </tr>
                    {/* Row 2 — status sub-headers */}
                    <tr className="bg-black/20 border-b border-border">
                      {colGroups.flatMap(g =>
                        g.statuses.map((s, si) => (
                          <th key={`${g.category}__${s}`}
                            className="min-w-[80px] px-1.5 py-1.5 text-center font-medium"
                            style={{ color: STATUS_COLOR[s], borderLeft: si === 0 ? `2px solid ${g.color}` : '1px solid rgba(255,255,255,0.08)' }}
                            title={`${g.category} – ${s}`}>
                            {s}
                          </th>
                        ))
                      )}
                    </tr>
                  </>
                ) : (
                  <tr className="bg-black/30 border-b border-border">
                    <th className="sticky left-0 bg-bg z-10 min-w-[72px] px-2 py-1.5 text-left text-text-muted">MC #</th>
                    {compactStatuses.map(s => (
                      <th key={s} className="border-l border-border/60 min-w-[44px] px-2 py-1.5 text-center font-medium"
                        style={{ color: STATUS_COLOR[s] }} title={s}>
                        {s}
                      </th>
                    ))}
                    <th className="sticky right-0 bg-bg z-10 min-w-[56px] px-2 py-1.5 text-center text-green-400 font-semibold">Done%</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const donePct  = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0
                  const pctColor = donePctColor(donePct)
                  return (
                    <tr key={row.mc}
                      className={`border-b border-border last:border-0 hover:bg-white/[0.025] ${ri % 2 !== 0 ? 'bg-white/[0.01]' : ''}`}>
                      <td className="sticky left-0 bg-surface z-10 px-2 py-1.5 font-mono font-bold text-accent border-r border-border/30 whitespace-nowrap">
                        {row.mc}
                      </td>
                      {!compact
                        ? colGroups.flatMap(g =>
                            g.statuses.map((s, si) => {
                              const count = row.counts[`${g.category}__${s}`] || 0
                              return (
                                <td key={`${g.category}__${s}`}
                                  className={`px-1.5 py-1.5 text-center ${count > 0 ? 'cursor-pointer hover:bg-white/5' : ''}`}
                                  style={{ borderLeft: si === 0 ? `2px solid ${g.color}40` : '1px solid rgba(255,255,255,0.05)' }}
                                  onClick={count > 0 && onCellClick ? () => onCellClick({ mc: row.mc, category: g.category, status: s, laneType }) : undefined}>
                                  {count > 0
                                    ? <span className="inline-flex items-center justify-center w-6 h-5 rounded font-bold text-[11px]"
                                        style={{ background: STATUS_COLOR[s] + '22', color: STATUS_COLOR[s] }}>
                                        {count}
                                      </span>
                                    : <span className="text-border/60 select-none">·</span>
                                  }
                                </td>
                              )
                            })
                          )
                        : compactStatuses.map(s => {
                            const count = colGroups.reduce((sum, g) => sum + (row.counts[`${g.category}__${s}`] || 0), 0)
                            return (
                              <td key={s}
                                className={`border-l border-border/20 px-1.5 py-1.5 text-center ${count > 0 ? 'cursor-pointer hover:bg-white/5' : ''}`}
                                onClick={count > 0 && onCellClick ? () => onCellClick({ mc: row.mc, category: null, status: s, laneType }) : undefined}>
                                {count > 0
                                  ? <span className="inline-flex items-center justify-center w-7 h-5 rounded font-bold text-[11px]"
                                      style={{ background: STATUS_COLOR[s] + '22', color: STATUS_COLOR[s] }}>
                                      {count}
                                    </span>
                                  : <span className="text-border/60 select-none">·</span>
                                }
                              </td>
                            )
                          })
                      }
                      <td className="sticky right-0 bg-surface z-10 px-2 py-1.5 text-center font-bold tabular-nums border-l border-border"
                        style={{ color: pctColor }}>
                        {donePct}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}

// ── Cycle Time Summary ─────────────────────────────────────────────────────────

function CycleTimeSummary({ cycleTimeData, loading }) {
  const stats = useMemo(() => {
    const records = (cycleTimeData || []).filter(r => r.cycleHours != null && !isNaN(Number(r.cycleHours)))
    if (!records.length) return null

    // p85
    const sorted   = [...records].sort((a, b) => Number(a.cycleHours) - Number(b.cycleHours))
    const p85Idx   = Math.min(Math.floor(0.85 * sorted.length), sorted.length - 1)
    const p85Hours = Number(sorted[p85Idx].cycleHours)
    const p85Days  = p85Hours / 24

    // Aging cards
    const agingCount = records.filter(r => Number(r.cycleHours) > p85Hours).length

    // Client turnaround (lists containing "sent for")
    const sentFor = records.filter(r => r.currentListName?.toLowerCase().includes('sent for'))
    const clientTurnaround = sentFor.length > 0
      ? (sentFor.reduce((s, r) => s + Number(r.cycleHours), 0) / sentFor.length) / 24
      : null

    // Pipeline (everything else)
    const pipeline = records.filter(r => !r.currentListName?.toLowerCase().includes('sent for'))
    const pipelineDays = pipeline.length > 0
      ? (pipeline.reduce((s, r) => s + Number(r.cycleHours), 0) / pipeline.length) / 24
      : null

    return { p85Days, agingCount, clientTurnaround, pipelineDays }
  }, [cycleTimeData])

  const CELLS = stats ? [
    { label: 'Aging Cards',     value: stats.agingCount,                           sub: '> p85',     color: '#ef4444' },
    { label: 'p85 Cycle Time',  value: stats.p85Days != null ? `${stats.p85Days.toFixed(1)}d` : '—', sub: '85th pct', color: '#6366f1' },
    { label: 'Client T/A',      value: stats.clientTurnaround != null ? `${stats.clientTurnaround.toFixed(1)}d` : '—', sub: 'sent for', color: '#f97316' },
    { label: 'Pipeline',        value: stats.pipelineDays != null ? `${stats.pipelineDays.toFixed(1)}d` : '—',         sub: 'internal', color: '#22c55e' },
  ] : null

  return (
    <SectionCard title="Cycle Time">
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : !CELLS ? (
        <p className="text-sm text-text-muted/40 text-center py-4">No cycle time data available for this period.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {CELLS.map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white/5 rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-text-muted uppercase tracking-wider leading-tight">{label}</p>
              <p className="text-xl font-bold tabular-nums mt-1" style={{ color }}>{value}</p>
              <p className="text-[10px] text-text-muted/50 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ── Cards Table ────────────────────────────────────────────────────────────────

function CardsTable({
  cards, loading, boardId,
  hideOverdue, initialSearch, cycleTimeMap, cycleTimeLoading, exportRef,
  selectedIds, onToggleSelect,
  hideFilterBar, externalSearch, externalShowOverdue,
  passMap, passFieldIds, onPassDateChange,
  hideCycleTime, requestsMap,
}) {
  const [search,       setSearch]       = useState(initialSearch || '')
  const [showOverdue,  setShowOverdue]  = useState(false)
  const [sortKey,      setSortKey]      = useState('due')
  const [sortDir,      setSortDir]      = useState('asc')
  const [page,         setPage]         = useState(1)
  const [editingPass,  setEditingPass]  = useState(null) // { cardId, key }
  const PAGE = 15

  const effectiveSearch   = externalSearch      !== undefined ? externalSearch      : search
  const effectiveOverdue  = externalShowOverdue !== undefined ? externalShowOverdue : showOverdue

  // Reset page when filters or search change
  useEffect(() => setPage(1), [cards, effectiveSearch, effectiveOverdue, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const displayed = useMemo(() => {
    let result = cards
    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase()
      result = result.filter(c => (c.name || '').toLowerCase().includes(q))
    }
    if (effectiveOverdue) result = result.filter(c => isOverdue(extractDate(c)))
    result = [...result].sort((a, b) => {
      let av, bv
      if (sortKey === 'name')     { av = a.name || ''; bv = b.name || '' }
      else if (sortKey === 'list') { av = extractList(a); bv = extractList(b) }
      else if (sortKey === 'due')  {
        av = extractDate(a) || '9999-99-99'
        bv = extractDate(b) || '9999-99-99'
      } else { // activity
        av = a.dateLastActivity || ''
        bv = b.dateLastActivity || ''
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [cards, effectiveSearch, effectiveOverdue, sortKey, sortDir])

  const paged  = displayed.slice((page - 1) * PAGE, page * PAGE)
  const pages  = Math.ceil(displayed.length / PAGE)

  const allPageSelected = selectedIds && paged.length > 0 && paged.every(c => selectedIds.has(c.id || c.cardId))

  function SortIcon({ k }) {
    if (sortKey !== k) return null
    return sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
  }

  function doExport() {
    exportTableAsCsv(
      displayed.map(c => {
        const lane = getLaneInfo(c)
        return [extractMcNumber(c.name) || '', c.name, lane?.type || '', extractList(c), extractLabels(c).map(l => l.name).join('; '), extractDate(c)]
      }),
      ['MC#', 'Name', 'Type', 'List', 'Labels', 'Due'],
      `cards-${boardId}.csv`,
    )
  }

  // Wire export function to ref so parent can trigger it
  useEffect(() => {
    if (exportRef) exportRef.current = doExport
  })

  if (loading) {
    return <div className="flex flex-col gap-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />)}</div>
  }

  return (
    <div>
      {/* Internal filter bar — only shown when not controlled by parent */}
      {!hideFilterBar && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-bg border border-border rounded-lg text-xs">
            <Search size={11} className="text-text-muted shrink-0" />
            <input
              className="bg-transparent text-xs text-text-primary outline-none w-32 placeholder:text-text-muted"
              placeholder="Search cards…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {!hideOverdue && (
            <button
              onClick={() => setShowOverdue(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                showOverdue ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'border-border text-text-muted hover:bg-white/5'
              }`}
            >
              <AlertTriangle size={11} /> Overdue
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-text-muted">{displayed.length} cards</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border">
              {selectedIds && (
                <th className="py-1.5 pr-2 w-6">
                  <input type="checkbox" className="accent-accent w-3 h-3 cursor-pointer"
                    checked={allPageSelected}
                    onChange={() => {
                      if (allPageSelected) paged.forEach(c => selectedIds.has(c.id || c.cardId) && onToggleSelect(c))
                      else paged.forEach(c => !selectedIds.has(c.id || c.cardId) && onToggleSelect(c))
                    }}
                  />
                </th>
              )}
              <th className="text-left py-1.5 pr-2 w-16">MC #</th>
              {requestsMap && <th className="text-left py-1.5 pr-3 w-24">Request</th>}
              <th className="text-left py-1.5 pr-3 cursor-pointer hover:text-text-primary" onClick={() => toggleSort('name')}>
                <span className="flex items-center gap-1">Card <SortIcon k="name" /></span>
              </th>
              <th className="text-left py-1.5 pr-3 w-20 hidden md:table-cell">Type</th>
              <th className="text-left py-1.5 pr-3 cursor-pointer hover:text-text-primary hidden md:table-cell" onClick={() => toggleSort('list')}>
                <span className="flex items-center gap-1">List <SortIcon k="list" /></span>
              </th>
              <th className="text-left py-1.5 pr-3 hidden lg:table-cell">Labels</th>
              <th className="text-left py-1.5 pr-3 hidden xl:table-cell">Difficulty</th>
              <th className="text-left py-1.5 pr-3 hidden xl:table-cell">Members</th>
              <th className="text-left py-1.5 pr-3 cursor-pointer hover:text-text-primary" onClick={() => toggleSort('due')}>
                <span className="flex items-center gap-1">Due <SortIcon k="due" /></span>
              </th>
              {!hideCycleTime && (
                <th className="text-right py-1.5 hidden lg:table-cell whitespace-nowrap" style={{ color: '#a855f7' }}>
                  Cycle Time
                  {cycleTimeLoading && <Spinner size={10} className="inline ml-1 opacity-60" />}
                </th>
              )}
              {passFieldIds && <>
                <th className="text-center py-1.5 px-2 hidden xl:table-cell text-emerald-400/70 whitespace-nowrap">1st Pass</th>
                <th className="text-center py-1.5 px-2 hidden xl:table-cell text-emerald-400/70 whitespace-nowrap">2nd Pass</th>
                <th className="text-center py-1.5 px-2 hidden xl:table-cell text-emerald-400/70 whitespace-nowrap">3rd Pass</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {paged.map((c, i) => {
              const mc       = extractMcNumber(c.name)
              const labels   = extractLabels(c)
              const members  = extractMembers(c)
              const due      = extractDate(c)
              const overdue  = isOverdue(due)
              const cardKey  = c.id || c.cardId
              const selected = selectedIds?.has(cardKey)
              return (
                <tr key={cardKey || i}
                  className={`border-b border-border/50 hover:bg-white/5 ${selected ? 'bg-accent/5' : ''}`}
                  onClick={onToggleSelect ? () => onToggleSelect(c) : undefined}
                  style={onToggleSelect ? { cursor: 'pointer' } : undefined}>
                  {selectedIds && (
                    <td className="py-1.5 pr-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="accent-accent w-3 h-3 cursor-pointer"
                        checked={!!selected}
                        onChange={() => onToggleSelect(c)} />
                    </td>
                  )}
                  <td className="py-1.5 pr-2">
                    {mc
                      ? <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{mc}</span>
                      : <span className="text-text-muted">—</span>
                    }
                  </td>
                  {requestsMap && (() => {
                    const req = requestsMap.get(cardKey)
                    return (
                      <td className="py-1.5 pr-3">
                        {req
                          ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300" title={req.name}>{req.mc || `#${req.item}`}</span>
                          : <span className="text-text-muted/30">—</span>
                        }
                      </td>
                    )
                  })()}
                  <td className="py-1.5 pr-3 max-w-[180px]" onClick={e => e.stopPropagation()}>
                    {(() => {
                      const href      = c.url || (c.shortLink ? `https://trello.com/c/${c.shortLink}` : `https://trello.com/c/${cardKey}`)
                      const laneInfo  = getLaneInfo(c)
                      const isProcess = getCardType(c) === 'Process'
                      const statusClr = isProcess && laneInfo?.status ? STATUS_COLOR[laneInfo.status] : null
                      const nameColor = overdue ? '#fca5a5' : statusClr || undefined
                      return (
                        <a href={href} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 hover:underline"
                          style={nameColor ? { color: nameColor } : undefined}>
                          {overdue && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
                          <span className="truncate">{c.name}</span>
                        </a>
                      )
                    })()}
                  </td>
                  <td className="py-1.5 pr-3 hidden md:table-cell">
                    {getCardType(c) === 'Work'    && <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300">Work</span>}
                    {getCardType(c) === 'Process' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300">Process</span>}
                  </td>
                  <td className="py-1.5 pr-3 hidden md:table-cell">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-text-muted">{extractList(c)}</span>
                  </td>
                  <td className="py-1.5 pr-3 hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {labels.filter(l => !/^Difficulty:/i.test(l.name)).slice(0, 3).map((l, j) => {
                        const s = labelStyle(l.color)
                        return <span key={j} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>{l.name}</span>
                      })}
                      {labels.filter(l => !/^Difficulty:/i.test(l.name)).length > 3 && (
                        <span className="text-[10px] text-text-muted">+{labels.filter(l => !/^Difficulty:/i.test(l.name)).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 hidden xl:table-cell">
                    {(() => {
                      const diff = extractDifficulty(c)
                      const dk   = diff ? diff.toLowerCase() : null
                      const color = DIFF_COLORS[dk] || null
                      return diff
                        ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}22`, color }}>{diff}</span>
                        : <span className="text-text-muted/30 text-[10px]">—</span>
                    })()}
                  </td>
                  <td className="py-1.5 pr-3 hidden xl:table-cell text-text-muted">
                    {members.slice(0, 2).join(', ')}{members.length > 2 ? ` +${members.length - 2}` : ''}
                  </td>
                  <td className={`py-1.5 pr-3 ${overdue ? 'text-red-400' : 'text-text-muted'}`}>
                    {due ? fmtDateShort(due) : '—'}
                  </td>
                  {!hideCycleTime && (
                    <td className="py-1.5 text-right hidden lg:table-cell">
                      {cycleTimeMap && (() => {
                        const key  = c.cardId ?? c.id ?? c.name
                        const days = key != null ? cycleTimeMap[key] : null
                        return days != null
                          ? <span className="text-xs font-mono font-medium" style={{ color: '#a855f7' }}>{Number(days).toFixed(1)}d</span>
                          : <span className="text-xs text-text-muted/40">—</span>
                      })()}
                    </td>
                  )}
                  {passFieldIds && (['first','second','third']).map(pk => {
                    const passes = passMap?.get(cardKey)
                    const val    = passes?.[pk] || null
                    const isEdit = editingPass?.cardId === cardKey && editingPass?.key === pk
                    return (
                      <td key={pk} className="py-1 px-2 text-center hidden xl:table-cell" onClick={e => e.stopPropagation()}>
                        {isEdit ? (
                          <input
                            type="date"
                            autoFocus
                            className="text-[10px] bg-surface border border-emerald-500/40 rounded px-1 py-0.5 text-text-primary outline-none w-28"
                            defaultValue={val ? val.slice(0, 10) : ''}
                            onBlur={e => {
                              setEditingPass(null)
                              const newVal = e.target.value
                              if (newVal !== (val ? val.slice(0, 10) : '')) {
                                onPassDateChange?.(cardKey, pk, newVal ? new Date(newVal).toISOString() : null)
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.target.blur()
                              if (e.key === 'Escape') { setEditingPass(null) }
                            }}
                          />
                        ) : (
                          <button
                            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors w-full text-center ${
                              val
                                ? 'text-emerald-300 hover:bg-emerald-500/10'
                                : 'text-text-muted/40 hover:text-text-muted hover:bg-white/5'
                            }`}
                            onClick={() => setEditingPass({ cardId: cardKey, key: pk })}
                            title={val ? `Set: ${val.slice(0,10)}` : 'Set date'}
                          >
                            {val ? val.slice(0, 10) : '+'}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
          <button className="btn-secondary py-1" disabled={page === 1}    onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>Page {page} of {pages}</span>
          <button className="btn-secondary py-1" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}

// ─── LabelModal ───────────────────────────────────────────────────────────────

const LABEL_COLORS = ['blue','green','red','yellow','orange','purple','pink','sky','lime']

function LabelModal({ selectedCards, boardId, onClose, onCardsUpdate }) {
  const [addName,    setAddName]    = useState('')
  const [addColor,   setAddColor]   = useState('blue')
  const [adding,     setAdding]     = useState(false)
  const [addResult,  setAddResult]  = useState(null)
  const [addErr,     setAddErr]     = useState(null)

  const [removeStaged, setRemoveStaged] = useState(new Set()) // label IDs staged for removal
  const [removing,     setRemoving]     = useState(false)
  const [removeResult, setRemoveResult] = useState(null)
  const [removeErr,    setRemoveErr]    = useState(null)

  // Derive unique labels present on the selected cards (no fetch needed)
  const labelsOnCards = useMemo(() => {
    const map = new Map()
    for (const card of selectedCards.values()) {
      for (const l of extractLabels(card)) {
        if (l.id && !map.has(l.id)) map.set(l.id, l)
      }
    }
    return [...map.values()]
  }, [selectedCards])

  // ── Add ──────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    const name = addName.trim()
    if (!name) return
    setAdding(true); setAddResult(null); setAddErr(null)

    let labelId
    try {
      // Silently fetch board labels to find an existing match
      const all = await fetchBoardLabels(boardId)
      const match = all.find(l => l.name.toLowerCase() === name.toLowerCase())
      if (match) {
        labelId = match.id
      } else {
        const created = await createBoardLabel(boardId, name, addColor)
        labelId = created.id
      }
    } catch (e) {
      setAddErr(`Could not resolve label: ${e.message}`)
      setAdding(false)
      return
    }

    let added = 0, skipped = 0, failed = 0
    for (const card of selectedCards.values()) {
      const cardId = card.id || card.cardId
      if (!cardId) { failed++; continue }
      try {
        const r = await addLabelToCard(cardId, labelId)
        if (r.status === 400) skipped++
        else if (r.ok)        added++
        else                  failed++
      } catch { failed++ }
    }

    setAddResult({ added, skipped, failed })
    setAddName('')
    setAdding(false)

    // Optimistically reflect on rows — find label color from board list
    if (added > 0) {
      try {
        const allLabels = await fetchBoardLabels(boardId)
        const lbl = allLabels.find(l => l.id === labelId)
        if (lbl) {
          const affectedIds = new Set(
            [...selectedCards.values()].map(c => c.id || c.cardId).filter(Boolean)
          )
          onCardsUpdate(prev => prev.map(c => {
            if (!affectedIds.has(c.id || c.cardId)) return c
            const already = (c.labels || []).some(l => l.id === lbl.id)
            if (already) return c
            return { ...c, labels: [...(c.labels || []), { id: lbl.id, name: lbl.name, color: lbl.color }] }
          }))
        }
      } catch { /* optimistic update is best-effort */ }
    }
  }

  // ── Remove ───────────────────────────────────────────────────────────────────
  async function handleRemove() {
    if (removeStaged.size === 0) return
    setRemoving(true); setRemoveResult(null); setRemoveErr(null)

    let removed = 0, skipped = 0, failed = 0
    for (const card of selectedCards.values()) {
      const cardId = card.id || card.cardId
      if (!cardId) { failed++; continue }
      const cardLabelIds = new Set(extractLabels(card).map(l => l.id).filter(Boolean))
      for (const labelId of removeStaged) {
        if (!cardLabelIds.has(labelId)) { skipped++; continue }
        try {
          const r = await (await import('../api/trello')).removeLabelFromCard(cardId, labelId)
          r.ok ? removed++ : failed++
        } catch { failed++ }
      }
    }

    setRemoveResult({ removed, skipped, failed })
    setRemoving(false)

    // Optimistically strip removed labels from rows
    if (removed > 0) {
      const affectedIds = new Set(
        [...selectedCards.values()].map(c => c.id || c.cardId).filter(Boolean)
      )
      onCardsUpdate(prev => prev.map(c => {
        if (!affectedIds.has(c.id || c.cardId)) return c
        return { ...c, labels: (c.labels || []).filter(l => !removeStaged.has(l.id)) }
      }))
    }
    setRemoveStaged(new Set())
  }

  const cardCount = selectedCards.size

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Modify Labels</h3>
          <span className="text-xs text-text-muted">{cardCount} card{cardCount !== 1 ? 's' : ''} selected</span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary ml-3"><X size={14} /></button>
        </div>

        <div className="p-4 flex flex-col gap-5">

          {/* ── Add section ── */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-text-primary">Add label</p>
            <p className="text-xs text-text-muted -mt-1">Type any name — reuses an existing board label or creates a new one.</p>
            <div className="flex gap-2">
              <input
                className="input text-xs py-1 flex-1"
                placeholder="Label name…"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !adding && handleAdd()}
              />
              <button className="btn-primary py-1 px-3 text-xs" onClick={handleAdd}
                disabled={adding || !addName.trim()}>
                {adding ? '…' : 'Add'}
              </button>
            </div>
            {/* Color picker — used only when creating a new label */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-text-muted">New label color:</span>
              {LABEL_COLORS.map(c => (
                <button key={c} onClick={() => setAddColor(c)} title={c}
                  style={{ background: TRELLO_COLORS[c]?.dot || '#888' }}
                  className={`w-3.5 h-3.5 rounded-full transition-transform ${addColor === c ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-100'}`}
                />
              ))}
            </div>
            {addErr    && <p className="text-xs text-red-400">{addErr}</p>}
            {addResult && (
              <p className="text-xs text-emerald-400">
                ✓ {addResult.added} added{addResult.skipped > 0 ? `, ${addResult.skipped} already present` : ''}{addResult.failed > 0 ? `, ${addResult.failed} failed` : ''}
              </p>
            )}
          </div>

          {/* ── Remove section ── */}
          {labelsOnCards.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-text-primary">Remove label</p>
              <p className="text-xs text-text-muted -mt-1">Labels currently on your selected cards.</p>
              <div className="flex flex-wrap gap-1.5">
                {labelsOnCards.map(l => {
                  const s   = labelStyle(l.color)
                  const on  = removeStaged.has(l.id)
                  return (
                    <button key={l.id}
                      onClick={() => setRemoveStaged(prev => { const n = new Set(prev); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n })}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-all ${s.bg} ${s.text} ${
                        on ? 'border-white/40 ring-1 ring-white/20' : 'border-transparent opacity-60 hover:opacity-90'
                      }`}>
                      {on && <X size={9} />}
                      {l.name}
                    </button>
                  )
                })}
              </div>
              {removeStaged.size > 0 && (
                <button className="btn-secondary py-1 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 self-start"
                  onClick={handleRemove} disabled={removing}>
                  {removing ? 'Removing…' : `Remove ${removeStaged.size} label${removeStaged.size !== 1 ? 's' : ''} from cards`}
                </button>
              )}
              {removeErr    && <p className="text-xs text-red-400">{removeErr}</p>}
              {removeResult && (
                <p className="text-xs text-emerald-400">
                  ✓ {removeResult.removed} removed{removeResult.skipped > 0 ? `, ${removeResult.skipped} not present` : ''}{removeResult.failed > 0 ? `, ${removeResult.failed} failed` : ''}
                </p>
              )}
            </div>
          )}

        </div>

        <div className="flex justify-end px-4 py-3 border-t border-border">
          <button className="btn-secondary py-1" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Request Tab ──────────────────────────────────────────────────────────────

function parseMarkdown(md) {
  if (!md) return ''
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
  // Tokenize links/images BEFORE HTML-escaping so URLs are never mangled
  function inline(s) {
    const re = /(!?\[([^\]]*)\]\(([^)]+)\))/g
    const parts = []
    let last = 0, m
    re.lastIndex = 0
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push({ t: 'text', v: s.slice(last, m.index) })
      const isImg = m[0][0] === '!'
      parts.push({ t: isImg ? 'img' : 'link', text: m[2], url: m[3] })
      last = m.index + m[0].length
    }
    if (last < s.length) parts.push({ t: 'text', v: s.slice(last) })
    return parts.map(p => {
      if (p.t === 'img')  return `<img src="${p.url}" alt="${esc(p.text)}" style="max-width:100%;border-radius:6px;margin:4px 0"/>`
      if (p.t === 'link') return `<a href="${p.url}" target="_blank" rel="noreferrer" class="text-accent underline hover:opacity-80">${esc(p.text)}</a>`
      return esc(p.v)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-xs font-mono">$1</code>')
    }).join('')
  }
  const lines = md.split('\n')
  const out = []
  let inUl = false, inOl = false
  for (const raw of lines) {
    if (/^-\s/.test(raw) || /^\* /.test(raw)) {
      if (!inUl) { if (inOl) { out.push('</ol>'); inOl = false }; out.push('<ul class="list-disc pl-5 my-1 space-y-0.5">'); inUl = true }
      out.push(`<li class="text-sm">${inline(raw.replace(/^[-*]\s/, ''))}</li>`)
    } else if (/^\d+\.\s/.test(raw)) {
      if (!inOl) { if (inUl) { out.push('</ul>'); inUl = false }; out.push('<ol class="list-decimal pl-5 my-1 space-y-0.5">'); inOl = true }
      out.push(`<li class="text-sm">${inline(raw.replace(/^\d+\.\s/, ''))}</li>`)
    } else {
      if (inUl) { out.push('</ul>'); inUl = false }
      if (inOl) { out.push('</ol>'); inOl = false }
      out.push(raw.trim() === '' ? '<div class="h-2"></div>' : `<p class="text-sm mb-1 leading-relaxed">${inline(raw)}</p>`)
    }
  }
  if (inUl) out.push('</ul>')
  if (inOl) out.push('</ol>')
  return out.join('')
}

function progressColor(pct) {
  if (pct === 100) return '#22c55e'
  if (pct >= 75)   return '#84cc16'
  if (pct >= 50)   return '#eab308'
  if (pct >= 25)   return '#f97316'
  return '#e8e8e8'
}

// Fractional weight per card status for incremental progress
const STATUS_WEIGHT = {
  'Pending':      0.00,
  'Ongoing':      0.20,
  'For Review':   0.50,
  'Revising':     0.60,
  'For Approval': 0.85,
  'Done':         1.00,
}

function computeRequestProgress(req, cards, doneCards, targets = []) {
  const ids = req.attachedCardIds
  if (!ids?.length) return null
  const idSet = new Set(ids)

  const attachedDone   = doneCards.filter(c => idSet.has(c.id || c.cardId))
  const attachedActive = cards.filter(c => idSet.has(c.id || c.cardId))
  const allAttached    = [...attachedDone, ...attachedActive]
  if (!allAttached.length) return null

  // Work off process cards if available, else all attached cards
  const processCards = allAttached.filter(c => getCardType(c) === 'Process')
  const srcCards     = processCards.length ? processCards : allAttached

  // Compute incremental progress per card based on its lane status
  const doneIds = new Set(attachedDone.map(c => c.id || c.cardId))
  let weightedSum = 0
  let doneCount   = 0
  for (const c of srcCards) {
    const isDone = doneIds.has(c.id || c.cardId) || LANE_MAP[extractList(c)]?.status === 'Done'
    if (isDone) { weightedSum += 1; doneCount++; continue }
    const status = LANE_MAP[extractList(c)]?.status
    weightedSum += STATUS_WEIGHT[status] ?? 0
  }

  // Find target value for the period that covers req.date
  let targetVal = null
  if (req.date && targets.length) {
    const reqD = new Date(req.date + 'T00:00:00')
    for (const t of targets) {
      if (reqD >= new Date(t.startDate) && reqD <= new Date(t.endDate + 'T23:59:59')) {
        targetVal = t.value
        break
      }
    }
  }

  const denominator = targetVal ?? srcCards.length
  if (!denominator) return null
  return {
    pct:      Math.min(100, Math.round(weightedSum / denominator * 100)),
    done:     doneCount,
    total:    denominator,
    vsTarget: targetVal != null,
  }
}

// Stage priority order (ascending): Ongoing < For Review < Revising < For Approval
const CARD_STAGE_PRIORITY = ['Ongoing', 'For Review', 'Revising', 'For Approval']

function computeCardStage(req, cards, doneCards) {
  const ids = req.attachedCardIds
  if (!ids?.length) return null
  const idSet = new Set(ids)
  const activeAttached = (cards || []).filter(c => idSet.has(c.id || c.cardId))
  if (activeAttached.length === 0) {
    // Check if any attached IDs exist in doneCards
    const doneAttached = (doneCards || []).filter(c => idSet.has(c.id || c.cardId))
    return doneAttached.length ? 'Done' : null
  }
  let best = -1
  for (const c of activeAttached) {
    const status = LANE_MAP[extractList(c)]?.status
    const idx = CARD_STAGE_PRIORITY.indexOf(status)
    if (idx > best) best = idx
  }
  return best >= 0 ? CARD_STAGE_PRIORITY[best] : null
}

function SortTh({ colKey, sortKey, sortDir, onSort, children, className = '' }) {
  const active = sortKey === colKey
  return (
    <th className={`text-left py-2.5 px-3 cursor-pointer select-none group ${className}`}
        onClick={() => onSort(colKey)}>
      <span className="flex items-center gap-1">
        {children}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
          {active && sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
        </span>
      </span>
    </th>
  )
}

// ─── Request Targets Panel ────────────────────────────────────────────────────

function ReqTargetsPanel({ targets, setTargets, boardId, onClose }) {
  const [form, setForm] = useState({ startDate: '', endDate: '', value: '' })
  function add() {
    if (!form.startDate || !form.endDate || !form.value) return
    const next = [...targets, { id: Date.now(), ...form, value: +form.value }]
    setTargets(next)
    localStorage.setItem(`req_targets_${boardId}`, JSON.stringify(next))
    setForm({ startDate: '', endDate: '', value: '' })
  }
  function remove(id) {
    const next = targets.filter(t => t.id !== id)
    setTargets(next)
    localStorage.setItem(`req_targets_${boardId}`, JSON.stringify(next))
  }
  return (
    <div className="rounded-xl border border-amber-500/25 bg-surface/70 backdrop-blur-md p-4 w-72 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Request Targets</span>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={13} /></button>
      </div>
      {targets.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {targets.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs text-text-muted">
              <Target size={11} className="text-amber-400 shrink-0" />
              <span className="flex-1">{fmtDateShort(t.startDate)} – {fmtDateShort(t.endDate)}</span>
              <span className="text-text-primary font-medium">{t.value}</span>
              <button onClick={() => remove(t.id)} className="hover:text-red-400"><X size={11} /></button>
            </div>
          ))}
          <div className="border-t border-border/40" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-muted">From</label>
            <input type="date" className="input text-xs py-1" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-muted">To</label>
            <input type="date" className="input text-xs py-1" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] text-text-muted">Target total for period</label>
            <input type="number" min="1" className="input text-xs py-1" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
          </div>
          <button className="btn-primary py-1 text-xs shrink-0" onClick={add}><Check size={12} /> Add</button>
        </div>
      </div>
    </div>
  )
}

// ─── Request Volume Section ───────────────────────────────────────────────────

function RequestVolumeSection({ requests, boardId }) {
  const [period,  setPeriod]  = useState('monthly')
  const [view,    setView]    = useState('table')
  const [showTgt, setShowTgt] = useState(false)
  const [targets, setTargets] = useState(() => {
    const raw = localStorage.getItem(`req_targets_${boardId}`)
    return raw ? JSON.parse(raw) : []
  })
  const tgtBtnRef = useRef(null)

  useEffect(() => {
    const raw = localStorage.getItem(`req_targets_${boardId}`)
    setTargets(raw ? JSON.parse(raw) : [])
    setShowTgt(false)
  }, [boardId])

  const data = useMemo(() => {
    const buckets = {}
    for (const r of requests) {
      if (!r.date) continue
      const d = new Date(r.date + 'T00:00:00')
      let key, label
      if (period === 'monthly') {
        key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      } else {
        const mon = new Date(d)
        mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
        key   = mon.toISOString().split('T')[0]
        label = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      if (!buckets[key]) buckets[key] = { key, label, open: 0, onHold: 0, closed: 0, total: 0 }
      const s = r.status || 'open'
      if (s === 'on-hold') buckets[key].onHold++
      else if (s === 'closed') buckets[key].closed++
      else buckets[key].open++
      buckets[key].total++
    }
    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key)).map(p => ({
      ...p,
      target: computeTargetForPeriod(p.key, period, targets),
    }))
  }, [requests, period, targets])

  const totalReqs   = requests.length
  const openCount   = requests.filter(r => !r.status || r.status === 'open').length
  const holdCount   = requests.filter(r => r.status === 'on-hold').length
  const closedCount = requests.filter(r => r.status === 'closed').length
  const hasTargets  = targets.length > 0

  return (
    <SectionCard
      slim
      title="Request Volume"
      className="shrink-0 mx-6 mt-4 mb-3"
      headerRight={
        <div className="flex items-center gap-1.5">
          {/* Summary pills */}
          <div className="flex items-center gap-3 text-[10px] mr-1">
            <span className="text-text-muted"><span className="font-semibold text-text-primary">{totalReqs}</span> total</span>
            <span className="text-text-muted"><span className="font-semibold text-blue-400">{openCount}</span> open</span>
            {holdCount > 0 && <span className="text-text-muted"><span className="font-semibold text-orange-400">{holdCount}</span> on hold</span>}
            <span className="text-text-muted"><span className="font-semibold text-emerald-400">{closedCount}</span> closed</span>
          </div>
          {/* Period toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden text-xs">
            {[['weekly', 'Week'], ['monthly', 'Month']].map(([p, lbl]) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 transition-colors ${period === p ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
                {lbl}
              </button>
            ))}
          </div>
          {/* Targets icon button */}
          <button
            ref={tgtBtnRef}
            onClick={() => setShowTgt(v => !v)}
            title={hasTargets ? `Targets (${targets.length})` : 'Targets'}
            className={`p-1 rounded-lg border transition-colors ${
              hasTargets || showTgt
                ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                : 'border-border text-text-muted hover:bg-white/5'
            }`}
          >
            <Target size={13} />
          </button>
          {/* Chart / Table toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('chart')} title="Chart"
              className={`p-1 transition-colors ${view === 'chart' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
              <BarChart2 size={13} />
            </button>
            <button onClick={() => setView('table')} title="Table"
              className={`p-1 transition-colors ${view === 'table' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
              <Table2 size={13} />
            </button>
          </div>
        </div>
      }
    >
      {data.length === 0 ? (
        <p className="text-xs text-text-muted/40 text-center py-6">No requests filed yet — add a request to see it plotted here.</p>
      ) : view === 'chart' ? (
        <>
          <div className="relative h-[200px]">
            {showTgt && (
              <div className="absolute inset-0 z-10 rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowTgt(false)} />
                <div className="absolute top-2 right-2 z-20">
                  <ReqTargetsPanel targets={targets} setTargets={setTargets} boardId={boardId} onClose={() => setShowTgt(false)} />
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} barSize={period === 'monthly' ? 28 : 16}>
                <CartesianGrid stroke="#2a2a2e" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface,#1f2937)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(val, name) => [val, name === 'onHold' ? 'On Hold' : name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                <Bar dataKey="closed" name="Closed"  stackId="a" fill="#22c55e" />
                <Bar dataKey="onHold" name="On Hold" stackId="a" fill="#f97316" />
                <Bar dataKey="open"   name="Open"    stackId="a" fill="#3b82f6" radius={[3,3,0,0]} />
                {hasTargets && (
                  <Area dataKey="target" name="Target" stroke="#f59e0b" strokeDasharray="5 3" fill="#f59e0b" fillOpacity={0.08} type="stepAfter" connectNulls isAnimationActive={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block bg-blue-500" /> Open</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block bg-orange-500" /> On Hold</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block bg-emerald-500" /> Closed</span>
            {hasTargets && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#f59e0b] inline-block" /> Target</span>}
          </div>
        </>
      ) : (
        <div className="overflow-auto max-h-[220px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border">
                <th className="text-left py-2 px-3">Period</th>
                <th className="text-right py-2 px-3 text-blue-400/70">Open</th>
                <th className="text-right py-2 px-3 text-orange-400/70">On Hold</th>
                <th className="text-right py-2 px-3 text-emerald-400/70">Closed</th>
                <th className="text-right py-2 px-3">Total</th>
                {hasTargets && <th className="text-right py-2 px-3 text-amber-400/70">Target</th>}
                {hasTargets && <th className="text-right py-2 px-3">vs Target</th>}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map(row => {
                const vs = row.target ? Math.round(row.total / row.target * 100) : null
                const vsColor = vs == null ? '' : vs >= 100 ? 'text-green-400' : vs >= 75 ? 'text-amber-400' : 'text-red-400'
                return (
                  <tr key={row.key} className="border-b border-border/30 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-medium text-text-primary">{row.label}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-blue-400">{row.open || <span className="text-text-muted/30">—</span>}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-orange-400">{row.onHold || <span className="text-text-muted/30">—</span>}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-400">{row.closed || <span className="text-text-muted/30">—</span>}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-text-primary">{row.total}</td>
                    {hasTargets && <td className="py-2 px-3 text-right tabular-nums text-amber-400">{row.target ?? <span className="text-text-muted/30">—</span>}</td>}
                    {hasTargets && <td className={`py-2 px-3 text-right tabular-nums font-medium ${vsColor}`}>{vs != null ? `${vs}%` : <span className="text-text-muted/30">—</span>}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Custom column cell — renders an editable control by column type ────────

function CustomFieldCell({ column, request, onSaveRequest }) {
  const value = request.customFields?.[column.id]
  const save = (v) => {
    const cf = { ...(request.customFields || {}) }
    if (v == null || v === '') delete cf[column.id]
    else                       cf[column.id] = v
    onSaveRequest({ ...request, customFields: cf })
  }

  if (column.type === 'checkbox') {
    const checked = !!value
    return (
      <button
        onClick={() => save(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-accent border-accent' : 'border-border hover:border-accent/50'}`}
      >
        {checked && <Check size={10} className="text-white" />}
      </button>
    )
  }

  if (column.type === 'date') {
    return (
      <input
        type="date"
        className="bg-transparent text-xs text-text-primary outline-none border-none p-0 w-full hover:text-text-primary focus:text-text-primary"
        value={value || ''}
        onChange={e => save(e.target.value)}
      />
    )
  }

  if (column.type === 'select') {
    const options = column.options || []
    return (
      <span className="inline-flex items-center relative">
        <select
          value={value || ''}
          onChange={e => save(e.target.value)}
          className="text-xs bg-transparent text-text-primary border-0 outline-none cursor-pointer appearance-none pr-4 py-0"
        >
          <option value="">—</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown size={8} className="absolute right-0 pointer-events-none opacity-40" />
      </span>
    )
  }

  // text (default)
  return (
    <input
      key={`${request.id}-${column.id}`}
      type="text"
      defaultValue={value || ''}
      onBlur={e => { if (e.target.value !== (value || '')) save(e.target.value) }}
      placeholder="—"
      className="bg-transparent text-xs text-text-primary outline-none border-none p-0 w-full placeholder:text-text-muted/25"
    />
  )
}

// ─── Custom Columns manager modal ────────────────────────────────────────────

function CustomColumnsModal({ columns, onChange, onClose }) {
  const [local, setLocal] = useState(columns)

  function updateCol(id, patch) {
    setLocal(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }
  function addCol() {
    setLocal(prev => [...prev, { id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: '', type: 'text' }])
  }
  function removeCol(id) {
    setLocal(prev => prev.filter(c => c.id !== id))
  }
  function addOption(id, opt) {
    const val = (opt || '').trim()
    if (!val) return
    setLocal(prev => prev.map(c => c.id === id ? { ...c, options: [...(c.options || []), val].filter((v, i, a) => a.indexOf(v) === i) } : c))
  }
  function removeOption(id, opt) {
    setLocal(prev => prev.map(c => c.id === id ? { ...c, options: (c.options || []).filter(o => o !== opt) } : c))
  }

  function save() {
    // Strip empty-name columns before saving
    const clean = local.filter(c => (c.name || '').trim())
                      .map(c => ({ ...c, name: c.name.trim(), ...(c.type === 'select' ? { options: c.options || [] } : {}) }))
    onChange(clean)
    onClose()
  }

  const COL_TYPES = [
    { value: 'text',     label: 'Text',     Icon: TypeIcon },
    { value: 'date',     label: 'Date',     Icon: Calendar },
    { value: 'checkbox', label: 'Checkbox', Icon: Check },
    { value: 'select',   label: 'Dropdown', Icon: LayoutList },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-[620px] max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Columns3 size={13} className="text-accent" /> Custom Columns</h3>
            <p className="text-[11px] text-text-muted mt-0.5">Add columns specific to this board. Shared across all users.</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {local.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-muted">
              <Columns3 size={28} className="text-text-muted/20" />
              <p className="text-xs">No custom columns yet.</p>
            </div>
          )}
          {local.map(col => (
            <div key={col.id} className="rounded-lg border border-border bg-bg/40 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  className="input text-sm flex-1"
                  value={col.name}
                  onChange={e => updateCol(col.id, { name: e.target.value })}
                  placeholder="Column name…"
                />
                <select
                  value={col.type}
                  onChange={e => updateCol(col.id, { type: e.target.value })}
                  className="input text-xs w-32 cursor-pointer"
                >
                  {COL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={() => removeCol(col.id)}
                  className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete column">
                  <Trash2 size={13} />
                </button>
              </div>
              {col.type === 'select' && (
                <div className="pl-1">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted/60 font-medium mb-1.5">Options</p>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {(col.options || []).length === 0 && <span className="text-[11px] text-text-muted/60 italic">No options yet.</span>}
                    {(col.options || []).map(opt => (
                      <span key={opt} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {opt}
                        <button onClick={() => removeOption(col.id, opt)} className="hover:text-red-400 transition-colors"><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                  <input
                    className="input text-xs w-full"
                    placeholder="Type an option and press Enter…"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        addOption(col.id, e.target.value)
                        e.target.value = ''
                        e.preventDefault()
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ))}

          <button onClick={addCol}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-border text-xs text-text-muted hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-colors">
            <Plus size={12} /> Add Column
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={save} className="btn-primary text-xs">Save Changes</button>
        </div>
      </div>
    </div>
  )
}

function RequestTab({ boardId, cards, doneCards, requests, requestsLoading, onSaveRequest, onDeleteRequest, passMap, slaDays, customColumns = [], canManageColumns = false, onUpdateColumns }) {
  const activeCards   = cards     || []
  const allCards      = useMemo(() => [...activeCards, ...(doneCards || [])], [activeCards, doneCards])

  const targets = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(`targets_${boardId}`) || '[]') } catch { return [] }
  }, [boardId])

  // Compute earliest pass date across all attached cards for a given pass key
  function getRequestPassDate(req, passKey) {
    if (!passMap || !req.attachedCardIds?.length) return null
    let min = null
    for (const cardId of req.attachedCardIds) {
      const passes = passMap.get(cardId)
      const d = passes?.[passKey]
      if (!d) continue
      if (!min || d < min) min = d
    }
    return min
  }

  // SLA-based text color for the latest (ongoing) pass date.
  // Healthy → green, ageing → amber → orange → red.
  function passTextColor(dateStr) {
    if (!slaDays || !dateStr) return null
    const d = new Date(dateStr.split('T')[0] + 'T00:00:00')
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const daysSince = Math.max(0, Math.floor((now - d) / 86400000))
    const ratio = daysSince / slaDays
    if (ratio >= 1)    return 'text-red-400'
    if (ratio >= 0.75) return 'text-orange-400'
    if (ratio >= 0.5)  return 'text-amber-400'
    return 'text-emerald-400'
  }

  const [editing,       setEditing]       = useState(null)
  const [isNew,         setIsNew]         = useState(false)
  const [briefMode,     setBriefMode]     = useState('edit')
  const [panelTab,      setPanelTab]      = useState('fields')
  const [cardSearch,    setCardSearch]    = useState('')
  const [excludeDone,   setExcludeDone]   = useState(true)
  const [opsCopied,     setOpsCopied]     = useState(false)
  const [columnsOpen,   setColumnsOpen]   = useState(false)
  const [mcCardFilter,  setMcCardFilter]  = useState('')
  const [mcDropOpen,    setMcDropOpen]    = useState(false)
  const [cardTabMode,   setCardTabMode]   = useState('view') // 'view' = read-only summary, 'edit' = attach/detach
  const [reqSort,       setReqSort]       = useState({ key: 'item', dir: 'asc' })
  const briefRef      = useRef(null)
  const imageInputRef = useRef(null)
  const mcDropRef     = useRef(null)

  // Clear editing panel when navigating to a different board
  useEffect(() => { setEditing(null) }, [boardId])

  // Default card search to the editing request name when switching to cards panel
  useEffect(() => {
    if (panelTab === 'cards' && editing?.name) setCardSearch(editing.name)
  }, [panelTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close MC dropdown on outside click
  useEffect(() => {
    function handler(e) { if (mcDropRef.current && !mcDropRef.current.contains(e.target)) setMcDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function suggestNextMc() {
    const nums = [
      ...activeCards.map(c => extractMcNumber(c.name)),
      ...requests.map(r => r.mc),
    ].filter(Boolean).map(s => parseInt(s.replace(/\D/g, ''), 10)).filter(n => !isNaN(n))
    return `MC-${nums.length ? Math.max(...nums) + 1 : 1}`
  }

  function nextItem() {
    return requests.length === 0 ? 1 : Math.max(...requests.map(r => r.item || 0)) + 1
  }

  function openNew() {
    setIsNew(true); setBriefMode('edit'); setPanelTab('fields'); setCardTabMode('edit')
    setEditing({
      id: `req_${Date.now()}`, item: nextItem(), mc: suggestNextMc(),
      date: new Date().toISOString().split('T')[0],
      name: '', deadline: '', spoc: '', brief: '', attachedCardIds: [], status: 'open',
    })
  }

  function openEdit(req) {
    setIsNew(false); setBriefMode('edit'); setPanelTab('fields'); setCardTabMode('view')
    setEditing({ attachedCardIds: [], status: 'open', ...req })
  }

  async function handleSave() {
    if (!editing) return
    await onSaveRequest(editing)
    // Propagate deadline to all attached active cards
    if (editing.deadline && editing.attachedCardIds?.length) {
      const dueISO = new Date(editing.deadline + 'T23:59:00').toISOString()
      const attachedActive = activeCards.filter(c => editing.attachedCardIds.includes(c.id || c.cardId))
      await Promise.allSettled(attachedActive.map(c => setCardDue(c.id || c.cardId, dueISO)))
    }
    setEditing(null)
  }

  async function handleDelete(id) {
    await onDeleteRequest(id)
    if (editing?.id === id) setEditing(null)
  }

  function toggleAttach(cardId) {
    setEditing(prev => {
      const ids = prev.attachedCardIds || []
      return { ...prev, attachedCardIds: ids.includes(cardId) ? ids.filter(i => i !== cardId) : [...ids, cardId] }
    })
  }

  function insertMd(before, after = '') {
    const ta = briefRef.current
    if (!ta) return
    const { selectionStart: ss, selectionEnd: se, value } = ta
    const sel  = value.slice(ss, se)
    const next = value.slice(0, ss) + before + sel + after + value.slice(se)
    setEditing(prev => ({ ...prev, brief: next }))
    setTimeout(() => {
      ta.focus()
      const cur = ss + before.length + (sel ? sel.length : after.length)
      ta.setSelectionRange(ss + before.length, sel ? ss + before.length + sel.length : cur)
    }, 0)
  }

  function handleLinkInsert() {
    const url = window.prompt('Enter URL:')
    if (url) insertMd('[', `](${url})`)
  }

  function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const name = file.name.replace(/\.[^.]+$/, '') || 'image'
      const md = `![${name}](${e.target.result})`
      setEditing(prev => {
        const brief = prev.brief || ''
        return { ...prev, brief: brief + (brief.endsWith('\n') || !brief ? '' : '\n') + md }
      })
    }
    reader.readAsDataURL(file)
  }

  function handleBriefPaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        handleImageUpload(item.getAsFile())
        return
      }
    }
  }

  function fmtFiled(iso) {
    if (!iso) return '—'
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function fUpdate(field) { return e => setEditing(prev => ({ ...prev, [field]: e.target.value })) }

  function handlePanelKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (editing?.name?.trim()) handleSave() }
    if (e.key === 'Escape') setEditing(null)
  }

  function toggleSort(key) {
    setReqSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  // MC options for card picker filter
  const cardMcOptions = useMemo(() => {
    const set = new Set()
    for (const c of allCards) {
      const mc = extractMcNumber(c.name)
      if (mc) set.add(mc)
    }
    return [...set].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10)
      const nb = parseInt(b.replace(/\D/g, ''), 10)
      return na - nb
    })
  }, [allCards])

  // Cards filtered for the attach panel — Process cards first, then Work
  const attachableCards = useMemo(() => {
    let pool = excludeDone ? activeCards : allCards
    if (mcCardFilter) pool = pool.filter(c => extractMcNumber(c.name) === mcCardFilter)
    const q = cardSearch.trim().toLowerCase()
    if (q) pool = pool.filter(c => (c.name || '').toLowerCase().includes(q))
    pool = [...pool].sort((a, b) => {
      const aP = getCardType(a) === 'Process' ? 0 : 1
      const bP = getCardType(b) === 'Process' ? 0 : 1
      return aP - bP
    })
    return pool.slice(0, 80)
  }, [allCards, activeCards, cardSearch, excludeDone, mcCardFilter])

  // Sorted request list
  const sortedRequests = useMemo(() => {
    const arr = [...requests]
    const { key, dir } = reqSort
    arr.sort((a, b) => {
      let av, bv
      if (key === 'item')     { av = a.item || 0; bv = b.item || 0 }
      else if (key === 'mc')  { av = parseInt((a.mc || '').replace(/\D/g, '') || '0'); bv = parseInt((b.mc || '').replace(/\D/g, '') || '0') }
      else if (key === 'date')     { av = a.date || ''; bv = b.date || '' }
      else if (key === 'name')     { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase() }
      else if (key === 'deadline') { av = a.deadline || '9999'; bv = b.deadline || '9999' }
      else if (key === 'spoc')     { av = (a.spoc || '').toLowerCase(); bv = (b.spoc || '').toLowerCase() }
      else                         { av = a[key] ?? ''; bv = b[key] ?? '' }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ?  1 : -1
      return 0
    })
    return arr
  }, [requests, reqSort])

  if (requestsLoading) return (
    <div className="flex items-center justify-center gap-2 mt-16 text-text-muted text-sm">
      <Spinner size={16} /> Loading requests…
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-130px)]" onKeyDown={handlePanelKey}>

      {/* ── Request Volume chart / table ── */}
      <RequestVolumeSection requests={requests} boardId={boardId} />

      {/* ── Request list + edit panel ── */}
      <div className="flex flex-1 min-h-0 border-t border-border">

      {/* ── Left: request list ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg/60 backdrop-blur shrink-0">
          <span className="text-xs text-text-muted">{requests.length} request{requests.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            {canManageColumns && (
              <button onClick={() => setColumnsOpen(true)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                title="Manage custom columns">
                <Columns3 size={11} /> Columns
                {customColumns.length > 0 && <span className="text-[10px] text-text-muted/60">({customColumns.length})</span>}
              </button>
            )}
            <button onClick={openNew} className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={12} /> New Request
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
            <FileText size={36} className="text-text-muted/20" />
            <p className="text-sm font-medium text-text-primary">No requests yet</p>
            <p className="text-xs text-text-muted">Track business requirements and their MCs here.</p>
            <button onClick={openNew} className="btn-secondary text-xs mt-1 flex items-center gap-1"><Plus size={11} /> Add first request</button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg/95 backdrop-blur z-10">
                {/* Group labels row — only visible when Passes or Custom groups exist */}
                {(passMap || customColumns.length > 0) && (
                  <tr className="text-[9px] uppercase tracking-widest font-semibold">
                    <th colSpan={9} className="py-1.5 px-3 text-text-muted/30 text-left">Request</th>
                    {passMap && (
                      <th colSpan={3} className="py-1.5 px-3 text-cyan-400/70 bg-cyan-500/5 border-l border-cyan-500/20">
                        <span className="flex items-center gap-1"><Layers size={9} /> Passes</span>
                      </th>
                    )}
                    {customColumns.length > 0 && (
                      <th colSpan={customColumns.length} className="py-1.5 px-3 text-accent/70 bg-accent/5 border-l border-accent/20">
                        <span className="flex items-center gap-1"><Columns3 size={9} /> Custom</span>
                      </th>
                    )}
                    <th className="py-1.5" />
                  </tr>
                )}
                <tr className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border">
                  <SortTh colKey="item" sortKey={reqSort.key} sortDir={reqSort.dir} onSort={toggleSort} className="w-10 text-center">
                    <span className="mx-auto">#</span>
                  </SortTh>
                  <SortTh colKey="mc"   sortKey={reqSort.key} sortDir={reqSort.dir} onSort={toggleSort} className="w-20">MC</SortTh>
                  <th className="text-left py-2.5 px-3 w-24">Status</th>
                  <SortTh colKey="date" sortKey={reqSort.key} sortDir={reqSort.dir} onSort={toggleSort} className="w-20">Filed</SortTh>
                  <SortTh colKey="name" sortKey={reqSort.key} sortDir={reqSort.dir} onSort={toggleSort} className="min-w-[260px] w-full">Name / Brief</SortTh>
                  <th className="text-left py-2.5 px-3 w-28">Stage</th>
                  <th className="text-left py-2.5 px-3 w-36">Progress</th>
                  <SortTh colKey="deadline" sortKey={reqSort.key} sortDir={reqSort.dir} onSort={toggleSort} className="w-24">Deadline</SortTh>
                  <SortTh colKey="spoc"     sortKey={reqSort.key} sortDir={reqSort.dir} onSort={toggleSort} className="w-28">SPOC</SortTh>
                  {passMap && <th className="text-left py-2.5 px-3 w-20 bg-cyan-500/5 border-l border-cyan-500/20">1st Pass</th>}
                  {passMap && <th className="text-left py-2.5 px-3 w-20 bg-cyan-500/5">2nd Pass</th>}
                  {passMap && <th className="text-left py-2.5 px-3 w-20 bg-cyan-500/5">3rd Pass</th>}
                  {customColumns.map((col, i) => (
                    <th key={col.id} className={`text-left py-2.5 px-3 min-w-[140px] bg-accent/5 ${i === 0 ? 'border-l border-accent/20' : ''}`}>
                      <span className="flex items-center gap-1">
                        {col.type === 'text'     && <TypeIcon size={9} className="text-accent/60" />}
                        {col.type === 'date'     && <Calendar size={9} className="text-accent/60" />}
                        {col.type === 'checkbox' && <Check    size={9} className="text-accent/60" />}
                        {col.type === 'select'   && <LayoutList size={9} className="text-accent/60" />}
                        {col.name}
                      </span>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {sortedRequests.map(r => {
                  const overdue    = r.deadline && new Date(r.deadline + 'T00:00:00') < new Date(today())
                  const isActive   = editing?.id === r.id
                  const reqStatus  = r.status || 'open'
                  const briefText  = r.brief
                    ?.replace(/!\[[^\]]*\]\([^)]+\)/g, '')
                    ?.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                    ?.replace(/[*_`#!]/g, '').replace(/\n/g, ' ').trim()
                  const prog  = computeRequestProgress(r, activeCards, doneCards, targets)
                  const stage = computeCardStage(r, activeCards, doneCards)
                  return (
                    <tr key={r.id} onClick={() => openEdit(r)}
                      className={`border-b border-border/40 cursor-pointer group transition-colors ${isActive ? 'bg-accent/5' : 'hover:bg-white/[0.025]'}`}>
                      <td className="py-3 px-3 text-center">
                        <span className="text-[11px] font-mono text-text-muted/50">{String(r.item).padStart(3, '0')}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                          {r.mc || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                        <span className="inline-flex items-center relative">
                          <select
                            value={reqStatus}
                            onChange={e => {
                              e.stopPropagation()
                              onSaveRequest({ ...r, status: e.target.value })
                            }}
                            className={`text-[10px] font-semibold pl-2 pr-4 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none
                              ${reqStatus === 'closed'  ? 'bg-emerald-500/15 text-emerald-400' :
                                reqStatus === 'on-hold' ? 'bg-red-500/15 text-red-400' :
                                                          'bg-blue-500/15 text-blue-400'}`}>
                            <option value="open">Open</option>
                            <option value="on-hold">On Hold</option>
                            <option value="closed">Closed</option>
                          </select>
                          <ChevronDown size={8} className="absolute right-1 pointer-events-none opacity-50" />
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-text-muted whitespace-nowrap">{fmtFiled(r.date)}</td>
                      <td className="py-3 px-3 min-w-0">
                        <div className="font-medium text-text-primary truncate">
                          {r.name || <span className="italic text-text-muted/40 font-normal">Untitled</span>}
                        </div>
                        {briefText && (
                          <div className="text-[11px] text-text-muted/55 truncate mt-0.5 italic">
                            {briefText.slice(0, 120)}{briefText.length > 120 ? '…' : ''}
                          </div>
                        )}
                      </td>
                      {/* Stage */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {stage
                          ? <span className="text-xs font-medium" style={{ color: STATUS_COLOR[stage] || '#6b7280' }}>{stage}</span>
                          : <span className="text-text-muted/25 text-xs">—</span>}
                      </td>
                      {/* Progress */}
                      <td className="py-3 px-3">
                        {prog ? (
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold tabular-nums" style={{ color: progressColor(prog.pct) }}>{prog.pct}%</span>
                              <span className="text-[10px] text-text-muted/50" title={prog.vsTarget ? 'done / period target' : 'done / total'}>
                                {prog.done}/{prog.total}{prog.vsTarget ? ' tgt' : ''}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, background: progressColor(prog.pct) }} />
                            </div>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-amber-400/70" title="No cards attached">
                            <AlertTriangle size={11} className="shrink-0" /> Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {r.deadline
                          ? <span className={`text-xs font-medium ${overdue ? 'text-red-400' : 'text-text-muted'}`}>{fmtFiled(r.deadline)}</span>
                          : <span className="text-text-muted/25 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-text-muted truncate block max-w-[110px]">
                          {r.spoc || <span className="text-text-muted/25">—</span>}
                        </span>
                      </td>
                      {passMap && (() => {
                        const passKeys = ['first', 'second', 'third']
                        const passDates = passKeys.map(pk => getRequestPassDate(r, pk))
                        // Index of the latest filled pass; earlier ones are "fulfilled"
                        let latestIdx = -1
                        for (let i = passDates.length - 1; i >= 0; i--) {
                          if (passDates[i]) { latestIdx = i; break }
                        }
                        const isOpen = (r.status || 'open') === 'open'
                        return passKeys.map((pk, i) => {
                          const d = passDates[i]
                          const leftBorder = i === 0 ? 'border-l border-cyan-500/10' : ''
                          if (!d) return (
                            <td key={pk} className={`py-3 px-3 text-xs whitespace-nowrap ${leftBorder}`}>
                              <span className="text-text-muted/25">—</span>
                            </td>
                          )
                          // Earlier (fulfilled) passes → muted grey
                          // Latest pass → SLA-graded color (green → amber → orange → red) when open
                          // Closed / on-hold → muted grey for all
                          const cls = isOpen && i === latestIdx
                            ? (passTextColor(d) || 'text-text-muted')
                            : 'text-text-muted'
                          return (
                            <td key={pk} className={`py-3 px-3 whitespace-nowrap ${leftBorder}`}>
                              <span className={`text-xs font-medium ${cls}`}>{fmtFiled(d.split('T')[0])}</span>
                            </td>
                          )
                        })
                      })()}
                      {customColumns.map((col, i) => (
                        <td key={col.id}
                          className={`py-3 px-3 ${i === 0 ? 'border-l border-accent/10' : ''}`}
                          onClick={e => e.stopPropagation()}
                        >
                          <CustomFieldCell column={col} request={r} onSaveRequest={onSaveRequest} />
                        </td>
                      ))}
                      <td className="py-3 px-3" onClick={e => { e.stopPropagation(); handleDelete(r.id) }}>
                        <button className="opacity-0 group-hover:opacity-100 text-text-muted/50 hover:text-red-400 transition-all p-1 rounded hover:bg-red-500/10">
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Right: edit panel ── */}
      {columnsOpen && (
        <CustomColumnsModal
          columns={customColumns}
          onChange={onUpdateColumns}
          onClose={() => setColumnsOpen(false)}
        />
      )}
      {editing && (
        <div className="w-[560px] shrink-0 border-l border-border bg-surface flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
            <span className="text-[10px] font-mono text-text-muted/50">#{String(editing.item).padStart(3, '0')}</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
              {editing.mc || '—'}
            </span>
            {isNew && <span className="text-[10px] text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">New</span>}
            {/* Status dropdown */}
            <span className="inline-flex items-center relative">
              <select
                value={editing.status || 'open'}
                onChange={e => { e.stopPropagation(); setEditing(prev => ({ ...prev, status: e.target.value })) }}
                onClick={e => e.stopPropagation()}
                className={`text-[10px] font-semibold pl-2 pr-4 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none
                  ${(editing.status || 'open') === 'closed'  ? 'bg-emerald-500/15 text-emerald-400' :
                    (editing.status || 'open') === 'on-hold' ? 'bg-red-500/15 text-red-400' :
                                                               'bg-blue-500/15 text-blue-400'}`}>
                <option value="open">Open</option>
                <option value="on-hold">On Hold</option>
                <option value="closed">Closed</option>
              </select>
              <ChevronDown size={8} className="absolute right-1 pointer-events-none opacity-50" />
            </span>
            <div className="flex-1" />
            <button onClick={() => setEditing(null)} className="text-text-muted hover:text-text-primary transition-colors"><X size={14} /></button>
          </div>

          {/* Panel tab bar */}
          <div className="flex border-b border-border shrink-0">
            {[['fields', 'Details'], ['cards', `Cards${editing.attachedCardIds?.length ? ` (${editing.attachedCardIds.length})` : ''}`]].map(([id, label]) => (
              <button key={id} onClick={() => setPanelTab(id)}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${panelTab === id ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Details tab ── */}
          {panelTab === 'fields' && (
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-medium">MC Number</label>
                  <input className="input w-full text-sm font-mono" value={editing.mc} onChange={fUpdate('mc')} placeholder="MC-1" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-medium">Date Filed</label>
                  <input type="date" className="input w-full text-sm" value={editing.date} onChange={fUpdate('date')} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-medium">Name</label>
                <input className="input w-full" value={editing.name} onChange={fUpdate('name')} placeholder="Request name…" autoFocus={isNew} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] uppercase tracking-wider mb-1.5 font-medium ${editing.attachedCardIds?.length ? 'text-text-muted' : 'text-text-muted/40'}`}>
                    Deadline
                    {!editing.attachedCardIds?.length && <span className="ml-1 normal-case text-[9px]">(attach cards first)</span>}
                  </label>
                  <input type="date" className="input w-full text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    value={editing.deadline || ''}
                    onChange={fUpdate('deadline')}
                    disabled={!editing.attachedCardIds?.length}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-medium">SPOC</label>
                  <input className="input w-full text-sm" value={editing.spoc} onChange={fUpdate('spoc')} placeholder="Contact name…" />
                </div>
              </div>
              {/* For Ops — auto-generated copy field */}
              {editing.mc && editing.date && editing.name && (() => {
                const month = new Date(editing.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long' })
                const opsText = `${editing.mc} - ${month} - ${editing.name}`
                return (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-medium">For Ops</label>
                    <div className="flex items-center gap-2">
                      <div className="input flex-1 text-sm bg-bg/50 text-text-primary select-all truncate">{opsText}</div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(opsText)
                          setOpsCopied(true)
                          setTimeout(() => setOpsCopied(false), 1500)
                        }}
                        className={`shrink-0 p-2 rounded-lg border transition-colors ${opsCopied ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-border text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                        title="Copy to clipboard"
                      >
                        {opsCopied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Custom columns */}
              {customColumns.length > 0 && (
                <div className="pt-2 border-t border-border/40 space-y-3">
                  {customColumns.map(col => {
                    const value = editing.customFields?.[col.id]
                    const setValue = (v) => setEditing(prev => {
                      const cf = { ...(prev.customFields || {}) }
                      if (v == null || v === '') delete cf[col.id]
                      else                       cf[col.id] = v
                      return { ...prev, customFields: cf }
                    })
                    return (
                      <div key={col.id}>
                        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-medium">{col.name}</label>
                        {col.type === 'text' && (
                          <input type="text" className="input w-full text-sm" value={value || ''} onChange={e => setValue(e.target.value)} placeholder="—" />
                        )}
                        {col.type === 'date' && (
                          <input type="date" className="input w-full text-sm" value={value || ''} onChange={e => setValue(e.target.value)} />
                        )}
                        {col.type === 'checkbox' && (
                          <button onClick={() => setValue(!value)}
                            className={`flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors`}>
                            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${value ? 'bg-accent border-accent' : 'border-border'}`}>
                              {value && <Check size={10} className="text-white" />}
                            </span>
                            {value ? 'Checked' : 'Unchecked'}
                          </button>
                        )}
                        {col.type === 'select' && (
                          <select value={value || ''} onChange={e => setValue(e.target.value)} className="input w-full text-sm cursor-pointer">
                            <option value="">— Select —</option>
                            {(col.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Brief */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Brief</label>
                  <div className="flex border border-border rounded-lg overflow-hidden text-[10px]">
                    {[['edit', <FileText size={9} key="e" />], ['preview', <Eye size={9} key="p" />]].map(([m, icon]) => (
                      <button key={m} onClick={() => setBriefMode(m)}
                        className={`flex items-center gap-1 px-2 py-1 capitalize transition-colors ${briefMode === m ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
                        {icon} {m}
                      </button>
                    ))}
                  </div>
                </div>
                {briefMode === 'edit' ? (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <div className="flex items-center gap-0.5 px-1.5 py-1 bg-bg border-b border-border">
                      <button onClick={() => insertMd('**', '**')} title="Bold"
                        className="w-7 h-6 flex items-center justify-center text-xs font-bold text-text-muted hover:text-text-primary hover:bg-white/5 rounded">B</button>
                      <button onClick={() => insertMd('*', '*')} title="Italic"
                        className="w-7 h-6 flex items-center justify-center text-xs italic text-text-muted hover:text-text-primary hover:bg-white/5 rounded">I</button>
                      <div className="w-px h-4 bg-border mx-0.5" />
                      <button onClick={() => insertMd('\n- ')} title="Bullet list"
                        className="w-7 h-6 flex items-center justify-center text-xs text-text-muted hover:text-text-primary hover:bg-white/5 rounded">•</button>
                      <button onClick={() => insertMd('\n1. ')} title="Numbered list"
                        className="px-1.5 h-6 flex items-center justify-center text-xs text-text-muted hover:text-text-primary hover:bg-white/5 rounded">1.</button>
                      <div className="w-px h-4 bg-border mx-0.5" />
                      <button onClick={handleLinkInsert} title="Insert link"
                        className="w-7 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 rounded">
                        <Link2 size={11} />
                      </button>
                      <button onClick={() => imageInputRef.current?.click()} title="Insert image (or paste)"
                        className="w-7 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 rounded">
                        <ImagePlus size={11} />
                      </button>
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { if (e.target.files[0]) handleImageUpload(e.target.files[0]); e.target.value = '' }} />
                      <button onClick={() => insertMd('`', '`')} title="Inline code"
                        className="w-7 h-6 flex items-center justify-center text-xs font-mono text-text-muted hover:text-text-primary hover:bg-white/5 rounded">`</button>
                      <span className="ml-auto text-[9px] text-text-muted/30 pr-1">Markdown · ⌘S</span>
                    </div>
                    <textarea ref={briefRef}
                      className="w-full bg-bg text-sm text-text-primary font-mono resize-none outline-none p-3 placeholder:text-text-muted/40"
                      rows={12} value={editing.brief} onChange={fUpdate('brief')}
                      onPaste={handleBriefPaste}
                      placeholder={"Describe the request…\n\nSupports **bold**, *italic*, - lists, [links](url), ![images](url) or paste an image"}
                    />
                  </div>
                ) : (
                  <div className="min-h-[200px] bg-bg border border-border rounded-lg p-4 text-text-primary leading-relaxed overflow-auto"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(editing.brief) || '<p class="text-sm text-text-muted/40 italic">No brief content yet.</p>' }}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Cards tab ── */}
          {panelTab === 'cards' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Attached cards summary */}
              {editing.attachedCardIds?.length > 0 && (() => {
                const prog = computeRequestProgress(editing, activeCards, doneCards)
                return prog ? (
                  <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Progress</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: progressColor(prog.pct) }}>{prog.pct}% · {prog.done}/{prog.total} done</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, background: progressColor(prog.pct) }} />
                    </div>
                  </div>
                ) : null
              })()}

              {/* Mode toggle header */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                  {cardTabMode === 'view' ? `${editing.attachedCardIds?.length || 0} attached` : 'Assign Cards'}
                </span>
                <button
                  onClick={() => setCardTabMode(m => m === 'view' ? 'edit' : 'view')}
                  className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-accent transition-colors px-2 py-1 rounded-md hover:bg-accent/10">
                  {cardTabMode === 'view'
                    ? <><Pencil size={10} /> Edit</>
                    : <><Eye size={10} /> View</>
                  }
                </button>
              </div>

              {/* ── View mode: clean read-only list of attached cards ── */}
              {cardTabMode === 'view' && (
                <div className="flex-1 overflow-y-auto">
                  {!editing.attachedCardIds?.length ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 text-text-muted">
                      <Layers size={24} className="text-text-muted/20" />
                      <p className="text-xs">No cards attached</p>
                      <button onClick={() => setCardTabMode('edit')} className="text-[11px] text-accent hover:underline">Assign cards</button>
                    </div>
                  ) : (
                    (() => {
                      const attachedIds = new Set(editing.attachedCardIds)
                      const attached = allCards
                        .filter(c => attachedIds.has(c.id || c.cardId))
                        .sort((a, b) => {
                          const aP = getCardType(a) === 'Process' ? 0 : 1
                          const bP = getCardType(b) === 'Process' ? 0 : 1
                          return aP - bP
                        })
                      return attached.map(c => {
                        const cardId   = c.id || c.cardId
                        const mc       = extractMcNumber(c.name)
                        const lane     = LANE_MAP[extractList(c)]
                        const status   = lane?.status
                        const cardType = getCardType(c)
                        const isDone   = (doneCards || []).some(d => (d.id || d.cardId) === cardId)
                        const passes   = passMap?.get(cardId)
                        return (
                          <div key={cardId} className="flex flex-col gap-1.5 px-5 py-3 border-b border-border/30">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0
                                ${cardType === 'Process' ? 'bg-purple-500/15 text-purple-300' : 'bg-indigo-500/15 text-indigo-300'}`}>
                                {cardType}
                              </span>
                              {mc && <span className="text-[10px] font-mono font-semibold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">{mc}</span>}
                              <span className="text-xs text-text-primary truncate flex-1">{c.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isDone ? (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#22c55e22', color: '#22c55e' }}>Done</span>
                              ) : status ? (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                  style={{ background: (STATUS_COLOR[status] || '#6b7280') + '22', color: STATUS_COLOR[status] || '#6b7280' }}>
                                  {status}
                                </span>
                              ) : null}
                              {passMap && passes && (
                                <>
                                  {passes.first  && <span className="text-[10px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded">P1: {fmtFiled(passes.first.split('T')[0])}</span>}
                                  {passes.second && <span className="text-[10px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded">P2: {fmtFiled(passes.second.split('T')[0])}</span>}
                                  {passes.third  && <span className="text-[10px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded">P3: {fmtFiled(passes.third.split('T')[0])}</span>}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })
                    })()
                  )}
                </div>
              )}

              {/* ── Edit mode: search, filter, attach/detach ── */}
              {cardTabMode === 'edit' && (
                <>
                  {/* Search & filters */}
                  <div className="px-5 py-3 border-b border-border shrink-0 space-y-2">
                    <div className="flex items-center gap-2">
                      {/* MC filter dropdown */}
                      <div className="relative shrink-0" ref={mcDropRef}>
                        <button onClick={() => setMcDropOpen(v => !v)}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${mcCardFilter ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-bg text-text-muted hover:text-text-primary'}`}>
                          <span>{mcCardFilter || 'MC'}</span>
                          <ChevronDown size={10} />
                        </button>
                        {mcDropOpen && (
                          <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto min-w-[100px]">
                            <button onClick={() => { setMcCardFilter(''); setMcDropOpen(false) }}
                              className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 ${!mcCardFilter ? 'text-accent' : 'text-text-muted'}`}>All</button>
                            {cardMcOptions.map(mc => (
                              <button key={mc} onClick={() => { setMcCardFilter(mc); setMcDropOpen(false) }}
                                className={`block w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-white/5 ${mcCardFilter === mc ? 'text-accent' : 'text-text-primary'}`}>{mc}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Name search */}
                      <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-bg border border-border rounded-lg">
                        <Search size={11} className="text-text-muted shrink-0" />
                        <input
                          className="bg-transparent text-xs text-text-primary outline-none flex-1 placeholder:text-text-muted"
                          placeholder="Search by name…"
                          value={cardSearch}
                          onChange={e => setCardSearch(e.target.value)}
                          autoFocus
                        />
                        {cardSearch && (
                          <button onClick={() => setCardSearch('')} className="text-text-muted hover:text-text-primary"><X size={10} /></button>
                        )}
                      </div>
                    </div>
                    {/* Exclude done toggle */}
                    <button onClick={() => setExcludeDone(v => !v)}
                      className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors">
                      <div className={`w-7 h-3.5 rounded-full transition-colors relative ${excludeDone ? 'bg-accent/60' : 'bg-white/10'}`}>
                        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${excludeDone ? 'left-[14px]' : 'left-0.5'}`} />
                      </div>
                      {excludeDone ? 'Hiding done cards' : 'Showing done cards'}
                    </button>
                  </div>

                  {/* Card list */}
                  <div className="flex-1 overflow-y-auto">
                    {attachableCards.length === 0 ? (
                      <div className="flex items-center justify-center h-24 text-xs text-text-muted">No cards found.</div>
                    ) : (
                      attachableCards.map(c => {
                        const cardId    = c.id || c.cardId
                        const checked   = editing.attachedCardIds?.includes(cardId)
                        const mc        = extractMcNumber(c.name)
                        const lane      = LANE_MAP[extractList(c)]
                        const status    = lane?.status
                        const isDone    = (doneCards || []).some(d => (d.id || d.cardId) === cardId)
                        return (
                          <div key={cardId}
                            onClick={() => toggleAttach(cardId)}
                            className={`relative flex items-start gap-3 px-5 py-3 border-b border-border/30 cursor-pointer transition-colors ${checked ? 'bg-accent/5' : 'hover:bg-white/[0.025]'}`}>
                            {/* Work/Process badge — top right */}
                            {(() => {
                              const cardType = getCardType(c)
                              return (
                                <span className={`absolute top-2 right-4 text-[9px] font-semibold px-1.5 py-0.5 rounded-full
                                  ${cardType === 'Process' ? 'bg-purple-500/15 text-purple-300' : 'bg-indigo-500/15 text-indigo-300'}`}>
                                  {cardType}
                                </span>
                              )
                            })()}
                            <div className="mt-0.5 shrink-0">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-accent border-accent' : 'border-border'}`}>
                                {checked && <Check size={10} className="text-white" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 pr-12">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {mc && <span className="text-[10px] font-mono font-semibold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">{mc}</span>}
                                <span className="text-xs text-text-primary truncate">{c.name}</span>
                                {isDone && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Done</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] text-text-muted/60 bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[160px]">{extractList(c)}</span>
                                {status && !isDone && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                    style={{ background: (STATUS_COLOR[status] || '#6b7280') + '22', color: STATUS_COLOR[status] || '#6b7280' }}>
                                    {status}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Panel footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
            {!isNew
              ? <button onClick={() => handleDelete(editing.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
              : <span />}
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={handleSave} className="btn-primary text-xs" disabled={!editing.name.trim()}>
                {isNew ? 'Add Request' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* flex flex-1 min-h-0 */}
    </div>
  )
}

// ─── Philippine Holidays (2025–2026) ─────────────────────────────────────────

const PH_HOLIDAYS = {
  // 2025 Regular Holidays
  '2025-01-01': "New Year's Day",
  '2025-04-09': 'Araw ng Kagitingan',
  '2025-04-17': 'Maundy Thursday',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Labor Day',
  '2025-06-12': 'Independence Day',
  '2025-08-25': 'National Heroes Day',
  '2025-11-30': 'Bonifacio Day',
  '2025-12-25': 'Christmas Day',
  '2025-12-30': 'Rizal Day',
  // 2025 Special Non-Working Days
  '2025-02-25': 'EDSA Revolution',
  '2025-08-21': 'Ninoy Aquino Day',
  '2025-11-01': "All Saints' Day",
  '2025-11-02': "All Souls' Day",
  '2025-12-08': 'Immaculate Conception',
  '2025-12-24': 'Christmas Eve',
  '2025-12-31': "New Year's Eve",
  // 2026 Regular Holidays
  '2026-01-01': "New Year's Day",
  '2026-04-02': 'Maundy Thursday',
  '2026-04-03': 'Good Friday',
  '2026-04-09': 'Araw ng Kagitingan',
  '2026-05-01': 'Labor Day',
  '2026-06-12': 'Independence Day',
  '2026-08-31': 'National Heroes Day',
  '2026-11-30': 'Bonifacio Day',
  '2026-12-25': 'Christmas Day',
  '2026-12-30': 'Rizal Day',
  // 2026 Special Non-Working Days
  '2026-02-25': 'EDSA Revolution',
  '2026-08-21': 'Ninoy Aquino Day',
  '2026-11-01': "All Saints' Day",
  '2026-11-02': "All Souls' Day",
  '2026-12-08': 'Immaculate Conception',
  '2026-12-24': 'Christmas Eve',
  '2026-12-31': "New Year's Eve",
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ boardId, cards, loading, requests, boardCfg }) {
  const today_d  = new Date()
  const [calYear,  setCalYear]  = useState(today_d.getFullYear())
  const [calMonth, setCalMonth] = useState(today_d.getMonth())
  const [ganttFilter, setGanttFilter] = useState('active') // 'active' or 'closed'

  const firstDay  = new Date(calYear, calMonth, 1)
  const lastDay   = new Date(calYear, calMonth + 1, 0)
  const startDow  = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  // Requests with deadlines this month
  const dueDates = useMemo(() => {
    const map = {}
    for (const r of requests) {
      if (!r.deadline) continue
      const d = new Date(r.deadline + 'T00:00:00')
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(r)
      }
    }
    return map
  }, [requests, calYear, calMonth])

  const todayDay = today_d.getFullYear() === calYear && today_d.getMonth() === calMonth
    ? today_d.getDate() : null

  // Gantt: filtered by active/closed toggle, bar from date filed to deadline
  const ganttItems = useMemo(() => {
    return [...requests]
      .filter(r => {
        const closed = (r.status || 'open') === 'closed'
        return ganttFilter === 'closed' ? closed : !closed
      })
      .sort((a, b) => {
        const da = a.deadline || '9999'
        const db = b.deadline || '9999'
        if (da < db) return -1
        if (da > db) return 1
        return (a.date || '') < (b.date || '') ? -1 : 1
      })
  }, [requests, ganttFilter])

  const ganttStart = useMemo(() => {
    // Start at earliest request filed date, or today-7
    let min = new Date(today_d)
    min.setDate(min.getDate() - 7)
    for (const r of ganttItems) {
      if (r.date) {
        const d = new Date(r.date + 'T00:00:00')
        if (d < min) min = d
      }
    }
    min.setHours(0, 0, 0, 0)
    return min
  }, [ganttItems]) // eslint-disable-line react-hooks/exhaustive-deps

  const ganttEnd = useMemo(() => {
    let end = new Date(today_d)
    end.setDate(end.getDate() + 60)
    for (const r of ganttItems) {
      if (r.deadline) {
        const d = new Date(r.deadline + 'T00:00:00')
        if (d > end) end = d
      }
    }
    end.setDate(end.getDate() + 7)
    return end
  }, [ganttItems]) // eslint-disable-line react-hooks/exhaustive-deps

  const ganttTotalDays = Math.max(1, Math.ceil((ganttEnd - ganttStart) / 86400000))

  function ganttPct(dateStr) {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
    const days = Math.ceil((d - ganttStart) / 86400000)
    return Math.min(100, Math.max(0, (days / ganttTotalDays) * 100))
  }

  const ganttWeeks = useMemo(() => {
    // Adaptive step: fewer labels for longer ranges to prevent overlap
    const step = ganttTotalDays > 180 ? 30
               : ganttTotalDays > 90  ? 14
               :                        7
    const weeks = []
    const d = new Date(ganttStart)
    while (d <= ganttEnd) {
      weeks.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), pct: (Math.ceil((d - ganttStart) / 86400000) / ganttTotalDays) * 100 })
      d.setDate(d.getDate() + step)
    }
    return weeks
  }, [ganttStart, ganttEnd, ganttTotalDays])

  const todayPct = Math.min(100, Math.max(0, (Math.ceil((today_d - ganttStart) / 86400000) / ganttTotalDays) * 100))

  // ── Project Duration breakdown ──
  const duration = useMemo(() => {
    if (!boardCfg?.startDate || !boardCfg?.endDate) return null
    const start = new Date(boardCfg.startDate + 'T00:00:00')
    const end   = new Date(boardCfg.endDate   + 'T00:00:00')
    const now   = new Date(); now.setHours(0, 0, 0, 0)
    if (end <= start) return null

    // Count business days between two dates (excludes weekends + PH holidays)
    function bizDays(from, to) {
      let count = 0
      const d = new Date(from)
      while (d < to) {
        const dow = d.getDay()
        const iso = d.toISOString().split('T')[0]
        if (dow !== 0 && dow !== 6 && !PH_HOLIDAYS[iso]) count++
        d.setDate(d.getDate() + 1)
      }
      return count
    }

    const totalCal    = Math.ceil((end - start) / 86400000)
    const totalBiz    = bizDays(start, end)
    const elapsedCal  = Math.max(0, Math.ceil((Math.min(now, end) - start) / 86400000))
    const elapsedBiz  = now >= end ? totalBiz : now <= start ? 0 : bizDays(start, now)
    const remainCal   = Math.max(0, Math.ceil((end - Math.max(now, start)) / 86400000))
    const remainBiz   = Math.max(0, totalBiz - elapsedBiz)
    const remainWeeks = Math.floor(remainCal / 7)
    const remainExtra = remainCal % 7
    const pct         = totalCal > 0 ? Math.min(100, Math.round((elapsedCal / totalCal) * 100)) : 0
    const isOverdue   = now > end

    return { start, end, totalCal, totalBiz, elapsedCal, elapsedBiz, remainCal, remainBiz, remainWeeks, remainExtra, pct, isOverdue }
  }, [boardCfg])

  if (loading) {
    return <div className="flex items-center justify-center gap-2 mt-10 text-text-muted text-sm"><Spinner size={16} /> Loading…</div>
  }

  const fmtD = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-6 space-y-6">

      {/* ── Project Duration ── */}
      {duration && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Project Duration</h3>
            <span className="text-xs text-text-muted">{fmtD(duration.start)} — {fmtD(duration.end)}</span>
          </div>
          <div className="p-5 space-y-5">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-2xl font-bold tabular-nums ${duration.isOverdue ? 'text-red-400' : 'text-accent'}`}>
                  {duration.pct}%
                </span>
                <span className="text-xs text-text-muted">
                  {duration.isOverdue
                    ? <span className="text-red-400 font-medium">Overdue</span>
                    : `${duration.elapsedCal} of ${duration.totalCal} days elapsed`
                  }
                </span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden relative">
                <div className={`h-full rounded-full transition-all ${duration.isOverdue ? 'bg-red-500' : 'bg-accent'}`}
                  style={{ width: `${duration.pct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-text-muted/60">
                <span>{fmtD(duration.start)}</span>
                <span>{fmtD(duration.end)}</span>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg rounded-lg border border-border/50 p-4">
                <span className="text-[10px] uppercase tracking-wider text-text-muted/60 font-medium block mb-2">Remaining</span>
                {duration.isOverdue ? (
                  <span className="text-xl font-bold tabular-nums text-red-400">0 days</span>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold tabular-nums text-text-primary">{duration.remainCal}</span>
                      <span className="text-xs text-text-muted">days</span>
                      <span className="text-text-muted/30 text-xs">·</span>
                      <span className="text-lg font-bold tabular-nums text-text-primary">{duration.remainWeeks}</span>
                      <span className="text-xs text-text-muted">weeks{duration.remainExtra > 0 ? ` ${duration.remainExtra}d` : ''}</span>
                    </div>
                    <div className="text-[11px] text-cyan-400 tabular-nums">
                      ({duration.remainBiz} business days)
                    </div>
                  </div>
                )}
                <span className="text-[11px] text-text-muted block mt-1.5">
                  of {duration.totalCal} days / {duration.totalBiz} business days total
                </span>
              </div>
              <div className="bg-bg rounded-lg border border-border/50 p-4">
                <span className="text-[10px] uppercase tracking-wider text-text-muted/60 font-medium block mb-2">Elapsed</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold tabular-nums text-text-primary">{duration.elapsedCal}</span>
                  <span className="text-xs text-text-muted">days</span>
                </div>
                <div className="text-[11px] text-cyan-400 tabular-nums mt-1.5">
                  ({duration.elapsedBiz} business days)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-text-primary">Calendar</h3>
            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500/40 inline-block" /> Requests</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500/30 inline-block" /> Holiday</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/5 border border-border/40 inline-block" /> Weekend</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1) } else setCalMonth(m => m-1) }}
              className="p-1 rounded hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-medium text-text-primary w-36 text-center">{MONTH_NAMES[calMonth]} {calYear}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1) } else setCalMonth(m => m+1) }}
              className="p-1 rounded hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-7 mb-1">
            {DOW.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-text-muted uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />
              const isToday   = day === todayDay
              const isWeekend = ((startDow + day - 1) % 7 === 0) || ((startDow + day - 1) % 7 === 6)
              const isoDay    = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const holiday   = PH_HOLIDAYS[isoDay]
              const dayReqs   = dueDates[day] || []
              return (
                <div key={day} className={`min-h-[80px] rounded-lg p-1.5 border transition-colors ${
                  isToday   ? 'border-accent/50 bg-accent/5' :
                  holiday   ? 'border-rose-500/20 bg-rose-500/5' :
                  isWeekend ? 'border-border/30 bg-white/[0.015]' :
                  'border-border/40 hover:border-border hover:bg-white/[0.02]'
                }`}>
                  <div className="flex items-start justify-between mb-1">
                    <span className={`text-xs font-medium ${
                      isToday ? 'text-accent' : isWeekend ? 'text-text-muted/35' : 'text-text-muted'
                    }`}>{day}</span>
                    {holiday && (
                      <span className="text-[8px] font-bold text-rose-400 leading-tight text-right block" title={holiday}>{holiday}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayReqs.slice(0, 3).map((r, j) => (
                      <div key={`r${j}`} className="truncate text-[9px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-300 leading-tight">
                        {r.mc || r.name}
                      </div>
                    ))}
                    {dayReqs.length > 3 && (
                      <div className="text-[9px] text-text-muted/60 px-1">+{dayReqs.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Gantt Chart ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-text-primary">Gantt Chart</h3>
            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              {ganttFilter === 'active' && (
                <>
                  <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded-sm bg-indigo-500/50 inline-block" /> Active</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded-sm bg-red-500/50 inline-block" /> Overdue</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded-sm bg-white/10 border border-border inline-block" /> No deadline</span>
                </>
              )}
              {ganttFilter === 'closed' && (
                <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded-sm bg-emerald-500/50 inline-block" /> Closed</span>
              )}
            </div>
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden text-[10px]">
            {[['active', 'Active'], ['closed', 'Closed']].map(([key, label]) => (
              <button key={key} onClick={() => setGanttFilter(key)}
                className={`px-3 py-1 transition-colors ${ganttFilter === key ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {ganttItems.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-text-muted">No requests yet. Add requests in the Request tab.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Header */}
              <div className="flex pl-52 pr-4 py-2 border-b border-border/50 relative">
                {ganttWeeks.map((w, i) => (
                  <div key={i} className="absolute text-[9px] text-text-muted/60 -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `calc(13rem + (100% - 13rem) * ${w.pct} / 100)` }}>
                    {w.label}
                  </div>
                ))}
                <div className="h-3" />
              </div>
              {/* Request rows */}
              {ganttItems.map(r => {
                const startDate = r.date || today()
                const endDate   = r.deadline
                const startPct  = ganttPct(startDate)
                const endPct    = endDate ? ganttPct(endDate) : null
                const barWidth  = endPct != null ? Math.max(endPct - startPct, 0.5) : 0
                const overdue   = endDate && new Date(endDate + 'T00:00:00') < today_d
                const closed    = (r.status || 'open') === 'closed'
                const barClass  = closed  ? 'bg-emerald-500/30 border border-emerald-500/30' :
                                  overdue ? 'bg-red-500/40 border border-red-500/30' :
                                            'bg-indigo-500/30 border border-indigo-500/30'
                return (
                  <div key={r.id} className="flex items-center pl-4 pr-4 py-1.5 border-b border-border/30 hover:bg-white/[0.02]">
                    {/* Label */}
                    <div className="w-48 shrink-0 pr-3 flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-semibold text-indigo-300 truncate">{r.mc || '—'}</span>
                        <span className={`text-[8px] px-1 rounded-full shrink-0 ${closed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                          {closed ? 'Closed' : 'Open'}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted truncate">{r.name || 'Untitled'}</span>
                    </div>
                    {/* Bar area */}
                    <div className="flex-1 relative h-7">
                      {/* Today line */}
                      <div className="absolute top-0 bottom-0 w-px bg-accent/50 z-10" style={{ left: `${todayPct}%` }} />
                      {/* Bar (only when deadline exists) */}
                      {endDate && (
                        <div className={`absolute top-1.5 bottom-1.5 rounded ${barClass}`}
                          style={{ left: `${startPct}%`, width: `${barWidth}%` }} />
                      )}
                      {/* Point marker for no-deadline requests */}
                      {!endDate && (
                        <div
                          className="absolute w-3 h-3 rounded-full bg-white/20 border-2 border-white/40 z-10"
                          style={{ left: `${startPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                        />
                      )}
                      {/* End label */}
                      {endDate && endPct != null && (
                        <div className="absolute top-1/2 -translate-y-1/2 text-[9px] text-text-muted/70 whitespace-nowrap"
                          style={{ left: `calc(${endPct}% + 4px)` }}>
                          {fmtDateShort(endDate)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BoardPage() {
  const { boardId }                                              = useParams()
  const { admin, accessibleIds, config, updateConfig, loading: accessLoading, getBoardRole, email } = useAccess()
  const { toasts, toast, dismiss }                               = useToast()

  // Board source — drives which data path (Phobos/Ares vs. direct Trello) we use
  const boardCfg      = config?.boards?.[boardId] || {}
  const isManualBoard = boardCfg.source === 'manual'
  const trelloShortId = boardCfg.trelloShortId || null

  const [configMissing, setConfigMissing] = useState(false)
  const [boardName,     setBoardName]     = useState(() => config?.boards?.[boardId]?.name || '')
  const [cards,         setCards]         = useState([])
  const [doneCards,        setDoneCards]        = useState([])
  const [movements,        setMovements]        = useState([])
  const [cycleTimeData,    setCycleTimeData]    = useState([])
  const [cycleTimeLoading, setCycleTimeLoading] = useState(false)
  const [cycleTimeFetched, setCycleTimeFetched] = useState(false) // true once a fetch has completed
  const [loading,          setLoading]          = useState(false)
  const [error,         setError]         = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  // Date range
  const [dateRange,    setDateRange]    = useState(30)      // 7 | 30
  const [customRange,  setCustomRange]  = useState(null)    // { from, to } | null
  const [showCalendar, setShowCalendar] = useState(false)
  const [pendingFrom,  setPendingFrom]  = useState(`${new Date().getFullYear()}-01-01`)
  const [pendingTo,    setPendingTo]    = useState(today())
  const calRef            = useRef(null)
  const pipelineExportRef = useRef(null)
  const loadingRef        = useRef(false) // prevents concurrent/double loadData calls

  // Drilldowns
  const [throughputDrilldown,  setThroughputDrilldown]  = useState(null)  // null | bucket
  const [doneDrilldown,        setDoneDrilldown]        = useState(false)
  const [tableCellDrilldown,   setTableCellDrilldown]   = useState(null)  // null | { mc, category, status, laneType, color }

  // Tabs
  const [activeTab, setActiveTab] = useState('dashboard')

  // Pipeline
  const [throughputView,    setThroughputView]    = useState('chart')
  const [pipelineView,      setPipelineView]      = useState('list')
  const [pipelineSearch,    setPipelineSearch]    = useState('')
  const [pipelineOverdue,   setPipelineOverdue]   = useState(false)
  const [selectedCards,     setSelectedCards]     = useState(new Map()) // id → card object
  const [trelloMenuOpen,    setTrelloMenuOpen]    = useState(false)
  const [labelsModalOpen,   setLabelsModalOpen]   = useState(false)
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false)
  const [deadlineDate,      setDeadlineDate]      = useState('')
  const [passDateModalOpen, setPassDateModalOpen] = useState(false)
  const [passDateValue,     setPassDateValue]     = useState('')
  const [passDateKey,       setPassDateKey]       = useState('first') // 'first' | 'second' | 'third'
  const trelloMenuRef = useRef(null)

  // Pass Tracking
  const passTracking    = useMemo(() => getPassConfigForBoard(boardId), [boardId])
  const [passMap,       setPassMap]       = useState(new Map()) // cardId → { first, second, third }

  // ── Requests — Firestore real-time subscription (shared across all users) ──
  const [requests,        setRequests]        = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)

  // ── Manual board computed data — populated from Firestore cache written by Cloud Function ──
  const [manualCompletionDates, setManualCompletionDates] = useState(new Map()) // cardId → ISO completion date
  const [manualCycleDays,       setManualCycleDays]       = useState({})        // cardId → days (done cards)
  const [manualActivatedDates,  setManualActivatedDates]  = useState(new Map()) // cardId → ISO first-activation date
  const [syncing,               setSyncing]               = useState(false)     // manual refresh in-flight
  const autoSyncFiredRef = useRef(false)                                        // prevent repeated auto-sync per board visit

  useEffect(() => {
    if (!boardId) return
    setRequestsLoading(true)
    migrateLocalRequests(boardId) // fire-and-forget: migrate any localStorage data on first load
    const unsub = subscribeRequests(
      boardId,
      data => { setRequests(data); setRequestsLoading(false) },
      err  => { console.error('requests subscription error:', err); setRequestsLoading(false) },
    )
    return unsub
  }, [boardId])

  const requestsMap = useMemo(() => {
    const m = new Map()
    for (const r of requests) {
      for (const cid of r.attachedCardIds || []) m.set(cid, r)
    }
    return m
  }, [requests])

  const handleSaveRequest   = useCallback(req => saveRequest(boardId, req),   [boardId])
  const handleDeleteRequest = useCallback(id  => deleteRequest(boardId, id),  [boardId])

  // Cycle time map: card identifier → days (for Done cards table)
  // Store under every possible identifier so any field on the card object can match
  const cycleTimeMap = useMemo(() => {
    if (isManualBoard) return manualCycleDays
    const map = {}
    for (const r of cycleTimeData) {
      const days = extractCycleDays(r)
      if (days == null) continue
      for (const k of [r.cardId, r.id, r.trelloId, r.name]) {
        if (k != null) map[String(k)] = days
      }
    }
    return map
  }, [isManualBoard, manualCycleDays, cycleTimeData])

  // Ongoing cycle time for active cards on manual boards: days since first activation
  const ongoingCycleMap = useMemo(() => {
    if (!isManualBoard) return null
    const now = Date.now()
    const map = {}
    for (const [cardId, activatedDate] of manualActivatedDates) {
      const days = (now - new Date(activatedDate).getTime()) / (1000 * 60 * 60 * 24)
      map[cardId] = Math.round(days * 10) / 10
    }
    return map
  }, [isManualBoard, manualActivatedDates])

  // cycleTimeP85 is computed after cutoffFilteredDoneCards (see below) so it reflects active filters

  // Filters (lifted — affect KPIs + throughput)
  const [typeFilter,      setTypeFilter]      = useState('all')
  const [listFilter,      setListFilter]      = useState(new Set())
  const [labelFilter,     setLabelFilter]     = useState(new Set())
  const [mcFilter,        setMcFilter]        = useState('')      // '' = all, 'MC-123' = specific
  const [mcDropdownOpen,  setMcDropdownOpen]  = useState(false)
  const mcDropdownRef = useRef(null)
  const [doneListFilter,  setDoneListFilter]  = useState(new Set())
  const [doneLabelFilter, setDoneLabelFilter] = useState(new Set())

  // Filter modes
  const [listFilterMode,      setListFilterMode]      = useState('include')
  const [labelFilterMode,     setLabelFilterMode]     = useState('include')
  const [doneListFilterMode,  setDoneListFilterMode]  = useState('include')
  const [doneLabelFilterMode, setDoneLabelFilterMode] = useState('include')

  // ── Filter persistence (per user, per board, across sessions) ────────────────
  // filterRestoring prevents the save effect from firing with stale state during restore
  const filterRestoring = useRef(false)
  const FILTER_DEFAULTS = {
    typeFilter: 'all', listFilter: [], listFilterMode: 'include',
    labelFilter: [], labelFilterMode: 'include', mcFilter: '',
    doneListFilter: [], doneListFilterMode: 'include',
    doneLabelFilter: [], doneLabelFilterMode: 'include',
    dateRange: 30, customRange: null,
  }

  // Restore saved filters when user or board changes
  useEffect(() => {
    if (!email || !boardId) return
    filterRestoring.current = true
    try {
      const saved = JSON.parse(localStorage.getItem(`board_filters_${email}_${boardId}`) || 'null')
      const f = saved || FILTER_DEFAULTS
      setTypeFilter(f.typeFilter ?? 'all')
      setListFilter(new Set(f.listFilter ?? []))
      setListFilterMode(f.listFilterMode ?? 'include')
      setLabelFilter(new Set(f.labelFilter ?? []))
      setLabelFilterMode(f.labelFilterMode ?? 'include')
      setMcFilter(f.mcFilter ?? '')
      setDoneListFilter(new Set(f.doneListFilter ?? []))
      setDoneListFilterMode(f.doneListFilterMode ?? 'include')
      setDoneLabelFilter(new Set(f.doneLabelFilter ?? []))
      setDoneLabelFilterMode(f.doneLabelFilterMode ?? 'include')
      setDateRange(f.dateRange ?? 30)
      setCustomRange(f.customRange ?? null)
    } catch { /* corrupt entry — leave current state */ }
  }, [email, boardId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save filters whenever they change (skips the first call after a restore)
  useEffect(() => {
    if (filterRestoring.current) { filterRestoring.current = false; return }
    if (!email || !boardId) return
    try {
      localStorage.setItem(`board_filters_${email}_${boardId}`, JSON.stringify({
        typeFilter, listFilter: [...listFilter], listFilterMode,
        labelFilter: [...labelFilter], labelFilterMode, mcFilter,
        doneListFilter: [...doneListFilter], doneListFilterMode,
        doneLabelFilter: [...doneLabelFilter], doneLabelFilterMode,
        dateRange, customRange,
      }))
    } catch { /* storage full */ }
  }, [email, boardId, typeFilter, listFilter, listFilterMode, labelFilter, labelFilterMode,
      mcFilter, doneListFilter, doneListFilterMode, doneLabelFilter, doneLabelFilterMode,
      dateRange, customRange]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close calendar on outside click
  useEffect(() => {
    function handler(e) { if (calRef.current && !calRef.current.contains(e.target)) setShowCalendar(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (accessLoading) return  // wait for config/auth to resolve before checking credentials
    if (isManualBoard) { setConfigMissing(false); return }
    const host   = localStorage.getItem('phobos_host')   || localStorage.getItem('ares_host')
    const apiKey = localStorage.getItem('phobos_api_key') || localStorage.getItem('ares_api_key')
    setConfigMissing(!host || !apiKey)
  }, [isManualBoard, accessLoading])

  useEffect(() => {
    if (config?.boards?.[boardId]?.name) setBoardName(config.boards[boardId].name)
  }, [config, boardId])

  const loadCycleTime = useCallback((dF, dT) => {
    const { dateFrom: df0, dateTo: dt0 } = getEffectiveDateRange(dateRange, customRange)
    const resolvedFrom = dF ?? df0
    const resolvedTo   = dT ?? dt0
    try {
      const rtProj = JSON.parse(localStorage.getItem(`rt_project_${boardId}`) || 'null')
      if (!rtProj?.id) { setCycleTimeFetched(true); return }
      setCycleTimeLoading(true)
      setCycleTimeFetched(false)
      fetchAllCycleTime(rtProj.id, resolvedFrom, resolvedTo)
        .then(data => setCycleTimeData(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => { setCycleTimeLoading(false); setCycleTimeFetched(true) })
    } catch { setCycleTimeFetched(true) }
  }, [boardId, dateRange, customRange])

  const loadData = useCallback(async (force = false) => {
    if (configMissing || !boardId) return
    if (loadingRef.current && !force) return
    loadingRef.current = true
    const { dateFrom, dateTo } = getEffectiveDateRange(dateRange, customRange)
    const cacheKey = `phobos_cache_${boardId}_${dateFrom}_${dateTo}`

    if (!force) {
      try {
        const raw = localStorage.getItem(cacheKey)
        if (raw) {
          const cached = JSON.parse(raw)
          if (Date.now() - cached.cachedAt < 15 * 60 * 1000) {
            setCards(cached.activeCards || [])
            setDoneCards(cached.doneCards || [])
            setMovements(cached.movements || [])
            if (cached.boardName) setBoardName(cached.boardName)
            setLastRefreshed(new Date(cached.cachedAt))
            setLoading(false)
            loadingRef.current = false
            loadCycleTime(dateFrom, dateTo)
            return
          }
        }
      } catch { /* stale/corrupt cache — fall through to fetch */ }
    }

    setLoading(true); setError(null)
    try {
      const [activeCards, doneFetched, movs, s] = await Promise.all([
        fetchAllPages(boardCards, boardId, { status: 'active' }),
        fetchAllPages(boardCards, boardId, { status: 'done' }),
        fetchAllPages(boardMovements, boardId, { dateFrom, dateTo }),
        boardSummary(boardId).catch(() => null),
      ])
      setCards(activeCards)
      setDoneCards(doneFetched)
      setMovements(movs)
      setLastRefreshed(new Date())
      // Cycle time — non-blocking, runs after main data is set
      loadCycleTime(dateFrom, dateTo)
      let fetchedName = null
      if (s) {
        fetchedName = s.projectName || s.name || s.boardName || s.board_name
        if (fetchedName) setBoardName(fetchedName)
      }
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          activeCards, doneCards: doneFetched, movements: movs,
          boardName: fetchedName || boardName, cachedAt: Date.now(),
        }))
      } catch { /* localStorage full — ignore */ }
    } catch (e) {
      setError(e.message)
      toast.error(`Error: ${e.message}`)
    } finally { setLoading(false); loadingRef.current = false }
  }, [boardId, dateRange, customRange, configMissing, loadCycleTime])

  /**
   * Manual-board data loader — calls Trello directly using trelloShortId.
   * Triggers the Cloud Function to re-fetch this board from Trello and write
   * updated data to Firestore. The onSnapshot listener below picks up the result
   * automatically — no polling needed.
   *
   * URL is the gen-1 Firebase Functions HTTPS trigger for this project.
   */
  const SYNC_URL = 'https://us-central1-phobos-9246e.cloudfunctions.net/syncBoardHttp'

  const triggerManualSync = useCallback(async () => {
    if (syncing || !boardId) return
    setSyncing(true)
    setError(null)
    try {
      const r    = await fetch(`${SYNC_URL}?boardId=${boardId}`)
      const data = await r.json()
      if (!data.ok) throw new Error(data.error || 'Sync failed')
      // onSnapshot fires automatically when the function writes to Firestore
    } catch (e) {
      toast.error(`Sync error: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }, [boardId, syncing])

  // Subscribe to Firestore cache written by the Cloud Function.
  // Fires immediately with existing cached data, then re-fires on every sync.
  useEffect(() => {
    if (!isManualBoard || !boardId) return
    if (!trelloShortId) { setLoading(false); return }

    setLoading(true)
    const unsub = onSnapshot(
      doc(db, 'cache', `manual_${boardId}`),
      (snap) => {
        if (!snap.exists()) {
          // Cloud Function hasn't run yet — show empty board, user can click refresh to sync
          setLoading(false)
          return
        }
        const data = snap.data()
        setCards(data.activeCards || [])
        setDoneCards(data.doneCards || [])
        setMovements([])
        setManualCompletionDates(new Map(Object.entries(data.completionDates || {})))
        setManualCycleDays(data.cycleDays || {})
        setManualActivatedDates(new Map(Object.entries(data.activatedDates || {})))
        const updatedAt = data.updatedAt?.toDate() || null
        setLastRefreshed(updatedAt)
        setCycleTimeLoading(false)
        setCycleTimeFetched(true)
        setLoading(false)

        // Auto-sync if cached data is older than 15 minutes and we haven't already triggered it this visit
        const STALE_MS = 15 * 60 * 1000
        if (updatedAt && !autoSyncFiredRef.current && (Date.now() - updatedAt.getTime()) > STALE_MS) {
          autoSyncFiredRef.current = true
          triggerManualSync()
        }
      },
      (err) => {
        console.error('Manual board snapshot error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [boardId, isManualBoard, trelloShortId])

  // Immediately clear stale board data when navigating to a new board
  useEffect(() => {
    setCards([])
    setDoneCards([])
    setMovements([])
    setCycleTimeData([])
    setCycleTimeLoading(false)
    setCycleTimeFetched(false)
    setManualCompletionDates(new Map())
    setManualCycleDays({})
    setManualActivatedDates(new Map())
    setSyncing(false)
    setError(null)
    setPassMap(new Map())
    setBoardName(config?.boards?.[boardId]?.name || '')
    setLoading(true)
    setActiveTab('request')
    autoSyncFiredRef.current = false
  }, [boardId])

  useEffect(() => {
    loadingRef.current = false // reset on board/range change so new fetch is always allowed
    if (!isManualBoard && !configMissing) loadData()
  }, [boardId, dateRange, customRange, configMissing, isManualBoard])

  // Load pass dates from Trello custom fields when pass tracking is enabled
  useEffect(() => {
    if (!passTracking?.enabled || !passTracking?.fieldIds) return
    const { first, second, third } = passTracking.fieldIds
    fetchBoardCardsWithFields(boardId).then(trelloCards => {
      const map = new Map()
      for (const tc of trelloCards) {
        const items = tc.customFieldItems || []
        const get = (fid) => items.find(i => i.idCustomField === fid)?.value?.date || null
        map.set(tc.id, { first: get(first), second: get(second), third: get(third) })
      }
      setPassMap(map)
    }).catch(() => {})
  }, [boardId, passTracking])

  // ── Derived ───────────────────────────────────────────────────────────────

  const throughputCutoff = useMemo(() => {
    if (customRange) return new Date(customRange.from)
    const d = new Date()
    d.setDate(d.getDate() - dateRange)
    return d
  }, [customRange, dateRange])

  const allowedPeriods = useMemo(() => {
    if (customRange) return ['daily', 'weekly', 'monthly']
    if (dateRange === 7)  return ['daily']
    return ['daily', 'weekly']
  }, [customRange, dateRange])

  const listOptions = useMemo(() => [...new Set(cards.map(c => extractList(c)).filter(Boolean))].sort(), [cards])
  const labelOptions = useMemo(() => [...new Set(cards.flatMap(c => extractLabels(c).map(l => l.name)).filter(Boolean))].sort(), [cards])
  const doneListOptions  = useMemo(() => [...new Set(doneCards.map(c => extractList(c)).filter(Boolean))].sort(), [doneCards])
  const doneLabelOptions = useMemo(() => [...new Set(doneCards.flatMap(c => extractLabels(c).map(l => l.name)).filter(Boolean))].sort(), [doneCards])
  const mcOptions = useMemo(() => {
    const nums = cards.map(c => extractMcNumber(c.name)).filter(Boolean)
    const unique = [...new Set(nums)]
    return unique.sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10)
      const nb = parseInt(b.replace(/\D/g, ''), 10)
      return nb - na // descending
    })
  }, [cards])

  function applyActiveFilters(list) {
    return list.filter(c => {
      if (listFilter.size > 0) {
        const match = listFilter.has(extractList(c))
        if (listFilterMode === 'include' && !match) return false
        if (listFilterMode === 'exclude' &&  match) return false
      }
      if (labelFilter.size > 0) {
        const hasLabel = extractLabels(c).some(l => labelFilter.has(l.name))
        if (labelFilterMode === 'include' && !hasLabel) return false
        if (labelFilterMode === 'exclude' &&  hasLabel) return false
      }
      if (typeFilter !== 'all') {
        const t = getCardType(c)
        if (typeFilter === 'work'    && t !== 'Work')    return false
        if (typeFilter === 'process' && t !== 'Process') return false
      }
      if (mcFilter) {
        if (extractMcNumber(c.name) !== mcFilter) return false
      }
      return true
    })
  }

  const filteredActiveCards = useMemo(() => applyActiveFilters(cards),     [cards, listFilter, labelFilter, typeFilter, mcFilter])
  const filteredDoneCards   = useMemo(() => applyActiveFilters(doneCards),  [doneCards, listFilter, labelFilter, typeFilter, mcFilter])

  // When the Done drilldown is open and done-specific filters are active, also apply them
  // to the data feeding the Throughput chart and KPIs so they stay in sync.
  const filteredDoneForThroughput = useMemo(() => {
    if (!doneDrilldown || (doneListFilter.size === 0 && doneLabelFilter.size === 0)) return filteredDoneCards
    return filteredDoneCards.filter(c => {
      if (doneListFilter.size > 0) {
        const match = doneListFilter.has(extractList(c))
        if (doneListFilterMode === 'include' && !match) return false
        if (doneListFilterMode === 'exclude' &&  match) return false
      }
      if (doneLabelFilter.size > 0) {
        const hasLabel = extractLabels(c).some(l => doneLabelFilter.has(l.name))
        if (doneLabelFilterMode === 'include' && !hasLabel) return false
        if (doneLabelFilterMode === 'exclude' &&  hasLabel) return false
      }
      return true
    })
  }, [doneDrilldown, filteredDoneCards, doneListFilter, doneLabelFilter, doneListFilterMode, doneLabelFilterMode])

  const completionDateMap = useMemo(
    () => isManualBoard ? manualCompletionDates : buildCompletionDateMap(movements),
    [isManualBoard, manualCompletionDates, movements],
  )

  const cutoffFilteredDoneCards = useMemo(() =>
    filteredDoneForThroughput.filter(c => {
      const cardId = c.id || c.cardId
      const d = completionDateMap.size > 0
        ? completionDateMap.get(cardId)
        : (c.dateLastActivity || c.updatedAt || c.due)
      return d && new Date(d) >= throughputCutoff
    }),
    [filteredDoneForThroughput, throughputCutoff, completionDateMap],
  )

  // p85 uses the same filtered+cutoff done cards as the throughput chart
  const cycleTimeP85 = useMemo(() => {
    const days = cutoffFilteredDoneCards
      .map(c => {
        const key = String(c.id || c.cardId || '')
        return isManualBoard ? (manualCycleDays[key] ?? null) : (cycleTimeMap[key] ?? null)
      })
      .filter(d => d != null && !isNaN(d))
      .sort((a, b) => a - b)
    if (!days.length) return null
    return days[Math.floor(days.length * 0.85)]
  }, [cutoffFilteredDoneCards, isManualBoard, manualCycleDays, cycleTimeMap])

  // WIP p85: 85th percentile age of active pipeline cards (Ongoing/For Review/Revising/For Approval)
  const wipP85 = useMemo(() => {
    // Build activation date map: first time each card entered a non-Pending, non-Done list
    const activationMap = new Map()
    if (!isManualBoard) {
      for (const m of movements) {
        const toList = extractMovementToList(m)
        const status = LANE_MAP[toList]?.status
        if (!status || status === 'Pending' || status === 'Done') continue
        const cardId  = extractMovementCardId(m)
        const dateStr = extractMovementDate(m)
        if (!cardId || !dateStr) continue
        const existing = activationMap.get(cardId)
        if (!existing || new Date(dateStr) < new Date(existing)) {
          activationMap.set(cardId, dateStr)
        }
      }
    }

    const now = Date.now()
    const ages = filteredActiveCards
      .filter(c => {
        const status = LANE_MAP[extractList(c)]?.status
        return status && status !== 'Pending' && status !== 'Done'
      })
      .map(c => {
        const key = String(c.id || c.cardId || '')
        if (isManualBoard) return ongoingCycleMap?.[key] ?? null
        const activated = activationMap.get(key)
        if (activated) return (now - new Date(activated).getTime()) / (1000 * 60 * 60 * 24)
        // Fallback: dateLastActivity
        const d = c.dateLastActivity || c.updatedAt
        if (d) return (now - new Date(d).getTime()) / (1000 * 60 * 60 * 24)
        return null
      })
      .filter(d => d != null && !isNaN(d))
      .sort((a, b) => a - b)
    if (!ages.length) return null
    return ages[Math.floor(ages.length * 0.85)]
  }, [filteredActiveCards, isManualBoard, movements, ongoingCycleMap])

  // KPI counts are scoped to the same cards visible in the throughput chart
  const diffCounts = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0, unknown: 0 }
    for (const c of cutoffFilteredDoneCards) {
      const diff = (extractDifficulty(c) || '').toLowerCase()
      const dk   = ['easy','medium','hard'].includes(diff) ? diff : 'unknown'
      counts[dk]++
    }
    return counts
  }, [cutoffFilteredDoneCards])

  const filteredDoneForDrilldown = useMemo(() => {
    return doneCards.filter(c => {
      const cardId = c.id || c.cardId
      const d = completionDateMap.size > 0
        ? completionDateMap.get(cardId)
        : (c.dateLastActivity || c.updatedAt || c.due)
      if (!d || new Date(d) < throughputCutoff) return false
      if (typeFilter !== 'all') {
        const t = getCardType(c)
        if (typeFilter === 'work'    && t !== 'Work')    return false
        if (typeFilter === 'process' && t !== 'Process') return false
      }
      if (doneListFilter.size > 0) {
        const match = doneListFilter.has(extractList(c))
        if (doneListFilterMode === 'include' && !match) return false
        if (doneListFilterMode === 'exclude' &&  match) return false
      }
      if (doneLabelFilter.size > 0) {
        const hasLabel = extractLabels(c).some(l => doneLabelFilter.has(l.name))
        if (doneLabelFilterMode === 'include' && !hasLabel) return false
        if (doneLabelFilterMode === 'exclude' &&  hasLabel) return false
      }
      return true
    })
  }, [doneCards, completionDateMap, typeFilter, doneListFilter, doneLabelFilter, doneListFilterMode, doneLabelFilterMode, throughputCutoff])

  const periodDoneCount = useMemo(() =>
    filteredDoneCards.filter(c => {
      const cardId = c.id || c.cardId
      const d = completionDateMap.size > 0
        ? completionDateMap.get(cardId)
        : (c.dateLastActivity || c.updatedAt || c.due)
      return d && new Date(d) >= throughputCutoff
    }).length,
    [filteredDoneCards, completionDateMap, throughputCutoff],
  )

  const periodActiveCount = useMemo(() =>
    filteredActiveCards.filter(c => {
      const d = c.dateLastActivity || c.updatedAt
      return d && new Date(d) >= throughputCutoff
    }).length,
    [filteredActiveCards, throughputCutoff],
  )

  const overdueCount = useMemo(() =>
    filteredActiveCards.filter(c => isOverdue(extractDate(c))).length,
    [filteredActiveCards],
  )

  const doneTypeBreakdown = useMemo(() => {
    let work = 0, process = 0
    for (const c of doneCards) {
      const t = getLaneInfo(c)?.type
      if (t === 'Work Lane')    work++
      else if (t === 'Process Lane') process++
    }
    return { work, process }
  }, [doneCards])

  const periodLabel = customRange
    ? `${fmtDateShort(customRange.from)} – ${fmtDateShort(customRange.to)}`
    : `last ${dateRange}d`

  function toggleListInclude(v) {
    if (listFilterMode !== 'include') { setListFilterMode('include'); setListFilter(new Set([v])) }
    else setListFilter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }
  function toggleListExclude(v) {
    if (listFilterMode !== 'exclude') { setListFilterMode('exclude'); setListFilter(new Set([v])) }
    else setListFilter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }
  function toggleLabelInclude(v) {
    if (labelFilterMode !== 'include') { setLabelFilterMode('include'); setLabelFilter(new Set([v])) }
    else setLabelFilter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }
  function toggleLabelExclude(v) {
    if (labelFilterMode !== 'exclude') { setLabelFilterMode('exclude'); setLabelFilter(new Set([v])) }
    else setLabelFilter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }
  function toggleDoneListInclude(v) {
    if (doneListFilterMode !== 'include') { setDoneListFilterMode('include'); setDoneListFilter(new Set([v])) }
    else setDoneListFilter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }
  function toggleDoneListExclude(v) {
    if (doneListFilterMode !== 'exclude') { setDoneListFilterMode('exclude'); setDoneListFilter(new Set([v])) }
    else setDoneListFilter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }
  function toggleDoneLabelInclude(v) {
    if (doneLabelFilterMode !== 'include') { setDoneLabelFilterMode('include'); setDoneLabelFilter(new Set([v])) }
    else setDoneLabelFilter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }
  function toggleDoneLabelExclude(v) {
    if (doneLabelFilterMode !== 'exclude') { setDoneLabelFilterMode('exclude'); setDoneLabelFilter(new Set([v])) }
    else setDoneLabelFilter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }

  function handleTableCellClick({ mc, category, status, laneType }) {
    setTableCellDrilldown({ mc, category, status, laneType, color: STATUS_COLOR[status] || '#6b7280' })
    setThroughputDrilldown(null)
    setDoneDrilldown(false)
  }

  // Selection
  const selectedIds = useMemo(() => new Set(selectedCards.keys()), [selectedCards])

  function handleToggleSelect(card) {
    const key = card.id || card.cardId
    if (!key) return
    setSelectedCards(prev => {
      const next = new Map(prev)
      next.has(key) ? next.delete(key) : next.set(key, card)
      return next
    })
  }

  function handleSelectAllFiltered() {
    setSelectedCards(prev => {
      const next = new Map(prev)
      filteredActiveCards.forEach(c => { const k = c.id || c.cardId; if (k) next.set(k, c) })
      return next
    })
  }

  function handleClearSelection() { setSelectedCards(new Map()) }

  async function handleDeleteSelected() {
    const ids = [...selectedCards.keys()]
    if (!ids.length) return
    let deleted = 0, failed = 0
    for (const cardId of ids) {
      try {
        const r = await deleteCard(cardId)
        r.ok ? deleted++ : failed++
      } catch { failed++ }
    }
    if (deleted) {
      setCards(prev => prev.filter(c => !selectedCards.has(c.id || c.cardId)))
      setSelectedCards(new Map())
      toast.success(`Deleted ${deleted} card${deleted > 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}`)
    } else {
      toast.error(`Failed to delete ${failed} card${failed > 1 ? 's' : ''}`)
    }
  }

  async function handlePassDateChange(cardId, passKey, isoDate) {
    const fieldId = passTracking?.fieldIds?.[passKey]
    if (!fieldId) return
    try {
      const r = await setCardCustomField(cardId, fieldId, isoDate)
      if (r.ok) {
        setPassMap(prev => {
          const next = new Map(prev)
          const existing = next.get(cardId) || { first: null, second: null, third: null }
          next.set(cardId, { ...existing, [passKey]: isoDate })
          return next
        })
      } else {
        toast.error('Failed to update pass date.')
      }
    } catch { toast.error('Failed to update pass date.') }
  }

  async function handleBulkSetPassDate(passKey, isoDate) {
    const fieldId = passTracking?.fieldIds?.[passKey]
    if (!fieldId) return
    const ids = [...selectedCards.keys()]
    if (!ids.length) return
    let ok = 0, failed = 0
    for (const cardId of ids) {
      try {
        const r = await setCardCustomField(cardId, fieldId, isoDate)
        if (r.ok) {
          ok++
          setPassMap(prev => {
            const next = new Map(prev)
            const existing = next.get(cardId) || { first: null, second: null, third: null }
            next.set(cardId, { ...existing, [passKey]: isoDate })
            return next
          })
        } else { failed++ }
      } catch { failed++ }
    }
    if (ok) toast.success(`Set ${passKey} pass date on ${ok} card${ok > 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}`)
    else toast.error('Failed to set pass date.')
    setPassDateModalOpen(false)
  }

  async function handleSetDeadline(due) {
    const ids = [...selectedCards.keys()]
    if (!ids.length) return
    let ok = 0, failed = 0
    for (const cardId of ids) {
      try {
        const r = await setCardDue(cardId, due)
        r.ok ? ok++ : failed++
      } catch { failed++ }
    }
    const action = due ? 'Updated deadline' : 'Removed deadline'
    if (ok) {
      if (due) {
        setCards(prev => prev.map(c => {
          const key = c.id || c.cardId
          if (!selectedCards.has(key)) return c
          return { ...c, due }
        }))
      }
      toast.success(`${action} for ${ok} card${ok > 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}`)
    } else {
      toast.error(`Failed for ${failed} card${failed > 1 ? 's' : ''}`)
    }
    setDeadlineModalOpen(false)
    setDeadlineDate('')
  }

  // Close Trello menu on outside click
  useEffect(() => {
    function handler(e) { if (trelloMenuRef.current && !trelloMenuRef.current.contains(e.target)) setTrelloMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close MC dropdown on outside click
  useEffect(() => {
    function handler(e) { if (mcDropdownRef.current && !mcDropdownRef.current.contains(e.target)) setMcDropdownOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const tableCellDrilldownCards = useMemo(() => {
    if (!tableCellDrilldown) return []
    const { mc, category, status, laneType } = tableCellDrilldown
    return [...filteredActiveCards, ...cutoffFilteredDoneCards].filter(c => {
      const meta = LANE_MAP[extractList(c)]
      if (!meta) return false
      if (meta.type !== laneType) return false
      if (meta.status !== status) return false
      if (category && meta.category !== category) return false
      const cardMc = extractMcNumber(c.name) || '—'
      return cardMc === mc
    })
  }, [tableCellDrilldown, filteredActiveCards, cutoffFilteredDoneCards])

  const hasAccess = admin || accessibleIds.has(boardId)

  // ── Render guards ─────────────────────────────────────────────────────────

  if (isManualBoard && !trelloShortId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-sm">No Trello board configured for this project.</p>
        <p className="text-xs text-text-muted/60">Set the Trello Short Board ID in Admin to load data.</p>
        <Link to="/admin" className="btn-primary">Go to Admin</Link>
      </div>
    )
  }

  if (accessLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">Loading…</div>
    )
  }

  if (configMissing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-sm">Phobos API not configured.</p>
        <Link to="/settings" className="btn-primary">Go to Settings</Link>
      </div>
    )
  }
  if (!accessLoading && !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-sm">You don't have access to this project.</p>
        <Link to="/settings" className="btn-secondary">Back to Settings</Link>
      </div>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  const boardRole = getBoardRole(boardId)

  const TABS = [
    { id: 'request',     label: 'Request',     icon: Inbox },
    { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
    { id: 'timeline',    label: 'Timeline',    icon: CalendarDays },
  ]

  return (
    <div className="h-full overflow-y-auto">
      {/* Syncing indicator — non-blocking pill at top-center */}
      {syncing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border shadow-lg text-xs text-text-primary pointer-events-none">
          <Spinner size={11} />
          Syncing with Trello…
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border px-6 pt-4 pb-0">
        {/* Title row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary leading-tight truncate">
              {boardName || boardId}
            </h1>
            {lastRefreshed && (
              <p className="text-[10px] text-text-muted mt-0.5">Updated {fmtTime(lastRefreshed)}</p>
            )}
          </div>

          {/* Dashboard-only controls */}
          {activeTab === 'dashboard' && (
            <div className="flex items-center gap-1.5 mt-1">
              {[7, 30].map(d => (
                <button
                  key={d}
                  onClick={() => { setDateRange(d); setCustomRange(null) }}
                  className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                    !customRange && dateRange === d
                      ? 'bg-accent/20 text-accent border-accent/30'
                      : 'border-border text-text-muted hover:bg-white/5'
                  }`}
                >
                  {d}d
                </button>
              ))}
              <div className="relative" ref={calRef}>
                <button
                  onClick={() => setShowCalendar(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                    customRange
                      ? 'bg-accent/20 text-accent border-accent/30'
                      : 'border-border text-text-muted hover:bg-white/5'
                  }`}
                >
                  <Calendar size={11} />
                  {customRange ? `${fmtDateShort(customRange.from)} – ${fmtDateShort(customRange.to)}` : 'Custom'}
                </button>
                {showCalendar && (
                  <div className="absolute right-0 top-full mt-1 z-30 bg-surface border border-border rounded-xl shadow-xl p-4 w-64">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-3">Custom Range</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-text-muted">From</label>
                        <input type="date" className="input text-xs py-1" max={pendingTo}
                          value={pendingFrom} onChange={e => setPendingFrom(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-text-muted">To</label>
                        <input type="date" className="input text-xs py-1" min={pendingFrom} max={today()}
                          value={pendingTo} onChange={e => setPendingTo(e.target.value)} />
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          className="btn-primary py-1 text-xs flex-1"
                          disabled={!pendingFrom || !pendingTo}
                          onClick={() => { setCustomRange({ from: pendingFrom, to: pendingTo }); setShowCalendar(false) }}
                        >
                          Apply
                        </button>
                        {customRange && (
                          <button className="btn-secondary py-1 text-xs" onClick={() => { setCustomRange(null); setShowCalendar(false) }}>
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button className="btn-secondary py-1" onClick={() => { isManualBoard ? triggerManualSync() : loadData(true) }} disabled={loading || syncing}>
                <RefreshCw size={13} className={(loading || syncing) ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 -mb-px">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && activeTab === 'dashboard' && (
        <div className="mx-6 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* ── Request tab ── */}
      {activeTab === 'request' && (
        <RequestTab
          boardId={boardId} cards={cards} doneCards={doneCards}
          requests={requests} requestsLoading={requestsLoading}
          onSaveRequest={handleSaveRequest} onDeleteRequest={handleDeleteRequest}
          passMap={passTracking?.enabled ? passMap : null}
          slaDays={boardCfg.slaDays}
          customColumns={boardCfg.customColumns || []}
          canManageColumns={admin || getBoardRole(boardId) === 'frost'}
          onUpdateColumns={(cols) => {
            if (!config) return
            const boards = { ...config.boards }
            boards[boardId] = { ...boards[boardId], customColumns: cols }
            updateConfig({ ...config, boards })
          }}
        />
      )}

      {/* ── Timeline tab ── */}
      {activeTab === 'timeline' && (
        <TimelineTab boardId={boardId} cards={cards} loading={loading} requests={requests} boardCfg={config?.boards?.[boardId]} />
      )}


      {/* ── Dashboard tab ── */}
      {activeTab === 'dashboard' && (loading
        ? <div className="flex items-center justify-center gap-2 mt-10 text-text-muted text-sm"><Spinner size={16} /> Loading…</div>
        : (
          <div className="p-6 space-y-5">

            {/* KPI row */}
            <div className={`grid grid-cols-2 gap-3 ${passTracking?.enabled ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
              <KpiCard
                icon={Circle} accent="text-accent"
                label="Active Cards" value={periodActiveCount}
                sub={`active in ${periodLabel}`}
                footer={<StatusDistBar cards={filteredActiveCards} />}
              />
              <KpiCard
                icon={CheckCircle2} accent="text-green-500"
                label="Done Cards" value={periodDoneCount}
                sub={`completed in ${periodLabel}`}
                onClick={() => { setDoneDrilldown(true); setThroughputDrilldown(null) }}
                footer={
                  <div className="flex items-center gap-3 text-[10px] text-text-muted border-t border-border/40 pt-1 mt-1">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#6366f1]" /> Work: {doneTypeBreakdown.work}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#a855f7]" /> Process: {doneTypeBreakdown.process}</span>
                  </div>
                }
              />
              <KpiCard
                icon={AlertTriangle} accent={overdueCount > 0 ? 'text-red-400' : 'text-text-muted/40'}
                label="Overdue" value={overdueCount}
                sub="past due date"
              />
              <KpiCard
                icon={TrendingUp} accent="text-yellow-500"
                label="Period Activity" value={movements.length}
                sub={`movements in ${periodLabel}`}
              />
              {passTracking?.enabled && (() => {
                const total = filteredActiveCards.length
                const counts = { first: 0, second: 0, third: 0 }
                for (const c of filteredActiveCards) {
                  const key = c.id || c.cardId
                  const p = passMap.get(key)
                  if (p?.first)  counts.first++
                  if (p?.second) counts.second++
                  if (p?.third)  counts.third++
                }
                return (
                  <KpiCard
                    icon={Layers} accent="text-emerald-400"
                    label="Pass Coverage"
                    value={`${counts.first}/${total}`}
                    sub="cards with 1st Pass"
                    footer={
                      <div className="flex items-center gap-2 text-[10px] text-text-muted border-t border-border/40 pt-1 mt-1">
                        <span>2nd: {counts.second}/{total}</span>
                        <span>·</span>
                        <span>3rd: {counts.third}/{total}</span>
                      </div>
                    }
                  />
                )
              })()}
            </div>

            {/* Section row: Throughput + KPIs + Pipeline Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4">
              <ThroughputSection
                doneCards={filteredDoneForThroughput}
                allDoneCards={doneCards}
                boardId={boardId}
                cutoff={throughputCutoff}
                completionDateMap={completionDateMap}
                allowedPeriods={allowedPeriods}
                view={throughputView}
                onViewChange={setThroughputView}
                onBarClick={bucket => { setThroughputDrilldown(bucket); setDoneDrilldown(false) }}
              />
              <ThroughputKpiPanel p85Days={cycleTimeP85} wipP85={wipP85} diffCounts={diffCounts} />
              <PipelineDistribution cards={filteredActiveCards} loading={loading} />
            </div>

            {/* Pipeline section — four mutually exclusive states */}
            {throughputDrilldown ? (
              <SectionCard
                drilldown
                title={`Throughput — ${throughputDrilldown.label} (${throughputDrilldown.cards.length} cards)`}
                headerRight={
                  <button
                    className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
                    onClick={() => setThroughputDrilldown(null)}
                  >
                    <X size={12} /> Back to Active Cards
                  </button>
                }
              >
                <ThroughputDrilldownTable cards={throughputDrilldown.cards} />
              </SectionCard>
            ) : tableCellDrilldown ? (
              <SectionCard
                headerColor={tableCellDrilldown.color}
                title={`${tableCellDrilldown.mc}${tableCellDrilldown.category ? ` · ${tableCellDrilldown.category}` : ''} · ${tableCellDrilldown.status} (${tableCellDrilldownCards.length} cards)`}
                headerRight={
                  <button
                    className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: tableCellDrilldown.color }}
                    onClick={() => setTableCellDrilldown(null)}
                  >
                    <X size={12} /> Back to Pipeline
                  </button>
                }
              >
                <CardsTable cards={tableCellDrilldownCards} boardId={boardId} hideOverdue />
              </SectionCard>
            ) : doneDrilldown ? (
              <SectionCard
                done
                title={`Done Cards — ${filteredDoneForDrilldown.length}${filteredDoneForDrilldown.length !== doneCards.length ? ` of ${doneCards.length}` : ''}`}
                headerRight={
                  <button
                    className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                    onClick={() => setDoneDrilldown(false)}
                  >
                    <X size={12} /> Back to Active Cards
                  </button>
                }
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <FilterPicker
                    label="Lists"
                    options={doneListOptions}
                    selected={doneListFilter}
                    mode={doneListFilterMode}
                    onToggleInclude={toggleDoneListInclude}
                    onToggleExclude={toggleDoneListExclude}
                    onClear={() => { setDoneListFilter(new Set()); setDoneListFilterMode('include') }}
                  />
                  <FilterPicker
                    label="Labels"
                    options={doneLabelOptions}
                    selected={doneLabelFilter}
                    mode={doneLabelFilterMode}
                    onToggleInclude={toggleDoneLabelInclude}
                    onToggleExclude={toggleDoneLabelExclude}
                    onClear={() => { setDoneLabelFilter(new Set()); setDoneLabelFilterMode('include') }}
                  />
                </div>
                <CardsTable
                  cards={filteredDoneForDrilldown}
                  boardId={boardId}
                  hideOverdue
                  cycleTimeMap={cycleTimeMap}
                  cycleTimeLoading={cycleTimeLoading}
                />
              </SectionCard>
            ) : (
              <SectionCard
                slim
                title={`Pipeline (${filteredActiveCards.length}${filteredActiveCards.length !== cards.length ? ` of ${cards.length}` : ''})`}
                headerRight={
                  <div className="flex items-center gap-1.5">
                    <button
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-border text-xs text-text-muted hover:bg-white/5 transition-colors"
                      onClick={() => pipelineExportRef.current?.()}
                      title="Export CSV"
                    >
                      <Download size={11} />
                    </button>
                    <div className="flex border border-border rounded-lg overflow-hidden">
                      <button onClick={() => setPipelineView('list')} title="List view"
                        className={`p-1 transition-colors ${pipelineView === 'list' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
                        <LayoutList size={13} />
                      </button>
                      <button onClick={() => setPipelineView('table')} title="Table view"
                        className={`p-1 transition-colors ${pipelineView === 'table' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-white/5'}`}>
                        <Table2 size={13} />
                      </button>
                    </div>
                  </div>
                }
              >
                {/* Unified filter bar */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {/* Search — leftmost */}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-bg border border-border rounded-lg text-xs">
                    <Search size={11} className="text-text-muted shrink-0" />
                    <input
                      className="bg-transparent text-xs text-text-primary outline-none w-28 placeholder:text-text-muted"
                      placeholder="Search cards…"
                      value={pipelineSearch}
                      onChange={e => setPipelineSearch(e.target.value)}
                    />
                  </div>
                  {/* MC# dropdown */}
                  <div className="relative" ref={mcDropdownRef}>
                    <button
                      onClick={() => setMcDropdownOpen(v => !v)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                        mcFilter
                          ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                          : 'border-border text-text-muted hover:bg-white/5'
                      }`}
                    >
                      {mcFilter || 'MC-#'} <ChevronDown size={11} />
                    </button>
                    {mcDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 z-30 bg-surface border border-border rounded-lg shadow-xl py-1 w-36 max-h-56 overflow-y-auto">
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:bg-white/5 transition-colors"
                          onClick={() => { setMcFilter(''); setMcDropdownOpen(false) }}
                        >
                          All
                        </button>
                        {mcOptions.map(mc => (
                          <button
                            key={mc}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors font-mono ${
                              mcFilter === mc ? 'text-indigo-300 bg-indigo-500/10' : 'text-text-primary hover:bg-white/5'
                            }`}
                            onClick={() => { setMcFilter(mc); setMcDropdownOpen(false) }}
                          >
                            {mc}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <FilterPicker
                    label="Lists"
                    options={listOptions}
                    selected={listFilter}
                    mode={listFilterMode}
                    onToggleInclude={toggleListInclude}
                    onToggleExclude={toggleListExclude}
                    onClear={() => { setListFilter(new Set()); setListFilterMode('include') }}
                  />
                  <FilterPicker
                    label="Labels"
                    options={labelOptions}
                    selected={labelFilter}
                    mode={labelFilterMode}
                    onToggleInclude={toggleLabelInclude}
                    onToggleExclude={toggleLabelExclude}
                    onClear={() => { setLabelFilter(new Set()); setLabelFilterMode('include') }}
                  />
                  <div className="flex border border-border rounded-lg overflow-hidden text-xs">
                    {['all', 'work', 'process'].map(t => (
                      <button key={t} onClick={() => setTypeFilter(t)}
                        className={`px-2.5 py-1 capitalize transition-colors ${
                          typeFilter === t
                            ? t === 'work' ? 'bg-indigo-500/20 text-indigo-300' : t === 'process' ? 'bg-purple-500/20 text-purple-300' : 'bg-accent/20 text-accent'
                            : 'text-text-muted hover:bg-white/5'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  {/* Overdue toggle */}
                  <button
                    onClick={() => setPipelineOverdue(v => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                      pipelineOverdue ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'border-border text-text-muted hover:bg-white/5'
                    }`}
                  >
                    <AlertTriangle size={11} /> Overdue
                  </button>
                </div>

                {/* Selection + Trello action bar */}
                {pipelineView === 'list' && (
                  <div className="flex items-center gap-2 mb-2 min-h-[24px]">
                    <span className="text-xs text-text-muted">{filteredActiveCards.length} cards</span>
                    {selectedIds.size > 0 ? (
                      <>
                        <span className="text-xs text-accent font-medium">{selectedIds.size} selected</span>
                        <button className="text-xs text-text-muted hover:text-text-primary px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
                          onClick={handleClearSelection}>Clear</button>
                        {/* Bulk Actions dropdown */}
                        <div className="relative ml-1" ref={trelloMenuRef}>
                          <button
                            onClick={() => setTrelloMenuOpen(v => !v)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 text-xs hover:bg-blue-500/20 transition-colors"
                          >
                            Bulk Actions <ChevronDown size={11} />
                          </button>
                          {trelloMenuOpen && (
                            <div className="absolute left-0 top-full mt-1 z-30 bg-surface border border-border rounded-lg shadow-xl py-1 w-48">
                              <button className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-white/5 transition-colors"
                                onClick={() => { setTrelloMenuOpen(false); setLabelsModalOpen(true) }}>
                                Modify Labels
                              </button>
                              <button className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-white/5 transition-colors"
                                onClick={() => { setTrelloMenuOpen(false); setDeadlineDate(''); setDeadlineModalOpen(true) }}>
                                Set Deadline
                              </button>
                              <button className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:bg-white/5 transition-colors"
                                onClick={() => { setTrelloMenuOpen(false); handleSetDeadline(null) }}>
                                Remove Deadline
                              </button>
                              {passTracking?.enabled && (
                                <button className="w-full text-left px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                  onClick={() => { setTrelloMenuOpen(false); setPassDateValue(''); setPassDateKey('first'); setPassDateModalOpen(true) }}>
                                  Set Pass Date
                                </button>
                              )}
                              <div className="border-t border-border my-1" />
                              <button className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                onClick={() => { setTrelloMenuOpen(false); handleDeleteSelected() }}>
                                Delete Card(s)
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <button className="text-xs text-text-muted hover:text-accent transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
                        onClick={handleSelectAllFiltered}>
                        Select all filtered
                      </button>
                    )}
                  </div>
                )}

                {pipelineView === 'list'
                  ? (
                    <CardsTable
                      cards={filteredActiveCards}
                      boardId={boardId}
                      exportRef={pipelineExportRef}
                      hideFilterBar
                      externalSearch={pipelineSearch}
                      externalShowOverdue={pipelineOverdue}
                      selectedIds={selectedIds}
                      onToggleSelect={handleToggleSelect}
                      passMap={passTracking?.enabled ? passMap : undefined}
                      passFieldIds={passTracking?.enabled ? passTracking.fieldIds : undefined}
                      onPassDateChange={handlePassDateChange}
                      hideCycleTime={!isManualBoard}
                      cycleTimeMap={isManualBoard ? ongoingCycleMap : undefined}
                      requestsMap={requestsMap}
                    />
                  ) : (
                    <PipelineTableView
                      activeCards={filteredActiveCards}
                      doneCards={cutoffFilteredDoneCards}
                      loading={loading}
                      boardName={boardName}
                      exportRef={pipelineExportRef}
                      typeFilter={typeFilter}
                      onCellClick={handleTableCellClick}
                    />
                  )
                }
              </SectionCard>
            )}

          </div>
        )
      )}

      {labelsModalOpen && (
        <LabelModal
          selectedCards={selectedCards}
          boardId={boardId}
          onClose={() => setLabelsModalOpen(false)}
          onCardsUpdate={updater => { setCards(updater); setDoneCards(updater) }}
        />
      )}

      {deadlineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Set Deadline</h2>
              <button onClick={() => setDeadlineModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Setting deadline for {selectedCards.size} card{selectedCards.size > 1 ? 's' : ''}.
            </p>
            <input
              type="date"
              className="input w-full mb-4"
              value={deadlineDate}
              onChange={e => setDeadlineDate(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs" onClick={() => setDeadlineModalOpen(false)}>Cancel</button>
              <button
                className="btn-primary text-xs"
                disabled={!deadlineDate}
                onClick={() => handleSetDeadline(new Date(deadlineDate).toISOString())}
              >
                Set Deadline
              </button>
            </div>
          </div>
        </div>
      )}

      {passDateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Set Pass Date</h2>
              <button onClick={() => setPassDateModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Setting pass date for {selectedCards.size} card{selectedCards.size > 1 ? 's' : ''}.
            </p>
            <div className="flex gap-1 mb-3">
              {[['first', '1st Pass'], ['second', '2nd Pass'], ['third', '3rd Pass']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPassDateKey(key)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors ${
                    passDateKey === key
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-border text-text-muted hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="date"
              className="input w-full mb-4"
              value={passDateValue}
              onChange={e => setPassDateValue(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs" onClick={() => setPassDateModalOpen(false)}>Cancel</button>
              <button
                className="btn-primary text-xs"
                disabled={!passDateValue}
                onClick={() => handleBulkSetPassDate(passDateKey, new Date(passDateValue).toISOString())}
              >
                Set Pass Date
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
