/*
Session roster for the staff dashboard.
Staff pick a session and see every family registered for it,
with head counts so they can plan before the session.
*/

import { supabase } from './supabase'

// empty box in html where the roster goes
const rosterSection = document.querySelector<HTMLElement>('#session-roster-section')!

// all links in nav bar
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a')

// one session in the dropdown
interface SessionOption {
  id: string
  title: string
  session_date: string
}

// families table
interface FamilyRow {
  family_name: string
}

// one family registered for a session (registrations table)
interface RegistrationRow {
  registration_status: string
  adult_count: number
  children_under_6_count: number
  children_6_to_12_count: number
  children_over_12_count: number
  notes: string | null
  families: FamilyRow | null
}

// helper function for formatting date better
function formatDate(date: string): string {
  const dateParts = date.split('-')
  const dateObject = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]))
  return dateObject.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getFamilyName(row: RegistrationRow): string {
  if (row.families) {
    return row.families.family_name
  }
  return 'Unknown family'
}

// puts families in A to Z order
function byFamilyName(a: RegistrationRow, b: RegistrationRow): number {
  return getFamilyName(a).localeCompare(getFamilyName(b))
}

// gets every session for the dropdown; newest first
async function loadSessions(): Promise<SessionOption[] | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, title, session_date')
    .order('session_date', { ascending: false })

  if (error) {
    console.error('Could not load sessions:', error.message)
    return null
  }

  return data as SessionOption[]
}

// gets every family registered for one session
async function loadRoster(sessionId: string): Promise<RegistrationRow[] | null> {
  const { data, error } = await supabase
    .from('registrations')
    .select(`
      registration_status, adult_count, children_under_6_count,
      children_6_to_12_count, children_over_12_count, notes,
      families ( family_name )
    `)
    .eq('session_id', sessionId)

  if (error) {
    console.error('Could not load roster:', error.message)
    return null
  }

  const rows = data as unknown as RegistrationRow[]
  rows.sort(byFamilyName)
  return rows
}

// one dropdown option for each session
function sessionOptions(sessions: SessionOption[]): string {
  let options = ''

  for (const session of sessions) {
    options += '<option value="' + session.id + '">' +
      formatDate(session.session_date) + ' · ' + session.title + '</option>'
  }

  return options
}

// one table row for each registered family
function rosterRows(rows: RegistrationRow[]): string {
  let html = ''

  for (const row of rows) {
    let notes = '—'
    if (row.notes) {
      notes = row.notes
    }

    html += `
      <tr>
        <td>${getFamilyName(row)}</td>
        <td>${row.registration_status}</td>
        <td>${row.adult_count}</td>
        <td>${row.children_under_6_count}</td>
        <td>${row.children_6_to_12_count}</td>
        <td>${row.children_over_12_count}</td>
        <td>${notes}</td>
      </tr>
    `
  }

  return html
}

// shows the roster table for one session
async function showRoster(sessionId: string): Promise<void> {
  const rosterContent = document.querySelector<HTMLElement>('#roster-content')!
  rosterContent.innerHTML = '<p class="attendance-intro">Loading roster...</p>'

  const rows = await loadRoster(sessionId)

  if (rows === null) {
    rosterContent.innerHTML = '<p class="empty-state">Could not load this roster right now. Please try again later.</p>'
    return
  }

  if (rows.length === 0) {
    rosterContent.innerHTML = '<p class="empty-state">No families registered for this session yet.</p>'
    return
  }

  rosterContent.innerHTML = `
    <div class="table-wrapper">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Family</th>
            <th>Status</th>
            <th>Adults</th>
            <th>Under 6</th>
            <th>Ages 6–12</th>
            <th>Over 12</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRows(rows)}
        </tbody>
      </table>
    </div>
  `
}

// runs when a different session is picked
function sessionChange(): void {
  const selectSession = document.querySelector<HTMLSelectElement>('#roster-session-select')!
  showRoster(selectSession.value)
}

// title and intro at the top of the roster
const rosterTitle = `
  <h2 class="attendance-title">Session Roster</h2>
  <p class="attendance-intro">Pick a session to see the families registered for it.</p>
`

// loads sessions from supabase, then fills in the roster
async function startRoster(): Promise<void> {
  rosterSection.innerHTML = rosterTitle + '<p class="attendance-intro">Loading sessions...</p>'

  const sessions = await loadSessions()

  if (sessions === null) {
    rosterSection.innerHTML = rosterTitle + '<p class="empty-state">Could not load sessions right now. Please try again later.</p>'
    return
  }

  if (sessions.length === 0) {
    rosterSection.innerHTML = rosterTitle + '<p class="empty-state">No sessions have been added yet.</p>'
    return
  }

  // session dropdown and empty spot for the table
  rosterSection.innerHTML = rosterTitle + `
    <div class="attendance-toolbar">
      <div class="year-filter">
        <label for="roster-session-select">Session</label>
        <select id="roster-session-select">
          ${sessionOptions(sessions)}
        </select>
      </div>
    </div>

    <div id="roster-content"></div>
  `

  // show newest session first
  showRoster(sessions[0].id)

  document.querySelector<HTMLSelectElement>('#roster-session-select')!.addEventListener('change', sessionChange)
}

// roster shows with the attendance tab
function showRosterSection(show: boolean): void {
  rosterSection.hidden = !show
}

// runs when nav link clicked
function handleNavClick(event: Event): void {
  const clickedLink = event.currentTarget as HTMLAnchorElement
  showRosterSection(clickedLink.dataset.tab === 'attendance')
}

for (const link of navLinks) {
  link.addEventListener('click', handleNavClick)
}

// open with the tab if url ends with #attendance
showRosterSection(window.location.hash === '#attendance')

// load the data and fill in the roster
startRoster()