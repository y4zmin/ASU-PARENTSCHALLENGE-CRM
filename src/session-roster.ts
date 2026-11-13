/*
Session roster for the staff dashboard.
Staff pick a session and see every family registered for it,
with head counts so they can plan before the session.
They can print it (or save as PDF) to check families in.
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
  start_time: string
  end_time: string
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

// filled in from supabase when the page loads
let allSessions: SessionOption[] = []

// helper function for formatting date better
function formatDate(date: string): string {
  const dateParts = date.split('-')
  const dateObject = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]))
  return dateObject.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// turns '13:00:00' into '1:00 PM'
function formatTime(time: string): string {
  const parts = time.split(':')
  let hour = Number(parts[0])
  let period = 'AM'

  if (hour >= 12) {
    period = 'PM'
  }
  if (hour > 12) {
    hour -= 12
  }
  if (hour === 0) {
    hour = 12
  }

  return hour + ':' + parts[1] + ' ' + period
}

// '1 family' or '3 families'
function familyCount(count: number): string {
  if (count === 1) {
    return '1 family'
  }
  return count + ' families'
}

function getFamilyName(row: RegistrationRow): string {
  if (row.families) {
    return row.families.family_name
  }
  return 'Unknown family'
}

// everyone coming from one family
function getPeopleCount(row: RegistrationRow): number {
  return row.adult_count + row.children_under_6_count + row.children_6_to_12_count + row.children_over_12_count
}

// puts families in A to Z order
function byFamilyName(a: RegistrationRow, b: RegistrationRow): number {
  return getFamilyName(a).localeCompare(getFamilyName(b))
}

// finds the picked session so we can show its name and time
function findSession(sessionId: string): SessionOption | null {
  for (const session of allSessions) {
    if (String(session.id) === sessionId) {
      return session
    }
  }
  return null
}

// gets every session for the dropdown; newest first
async function loadSessions(): Promise<SessionOption[] | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, title, session_date, start_time, end_time')
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

// heading that only shows on the printed page
function printHeading(sessionId: string, rows: RegistrationRow[]): string {
  const session = findSession(sessionId)
  if (!session) {
    return ''
  }

  let people = 0
  for (const row of rows) {
    people += getPeopleCount(row)
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return `
    <div class="print-only roster-print-heading">
      <p class="roster-eyebrow">Parents Challenge · Session Roster</p>
      <h2>${session.title}</h2>
      <p class="roster-meta">
        ${formatDate(session.session_date)} · ${formatTime(session.start_time)} – ${formatTime(session.end_time)}
      </p>
      <p class="roster-meta">
        ${familyCount(rows.length)} registered · ${people} people expected · Printed ${today}
      </p>
    </div>
  `
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
        <td class="print-only"><span class="check-box"></span></td>
        <td>${getFamilyName(row)}</td>
        <td class="roster-status">${row.registration_status}</td>
        <td>${row.adult_count}</td>
        <td>${row.children_under_6_count}</td>
        <td>${row.children_6_to_12_count}</td>
        <td>${row.children_over_12_count}</td>
        <td><strong>${getPeopleCount(row)}</strong></td>
        <td class="roster-notes">${notes}</td>
      </tr>
    `
  }

  return html
}

// adds up every column for the bottom row
function totalsRow(rows: RegistrationRow[]): string {
  let adults = 0
  let under6 = 0
  let ages6to12 = 0
  let over12 = 0

  for (const row of rows) {
    adults += row.adult_count
    under6 += row.children_under_6_count
    ages6to12 += row.children_6_to_12_count
    over12 += row.children_over_12_count
  }

  const people = adults + under6 + ages6to12 + over12

  return `
    <tr class="roster-totals">
      <td class="print-only"></td>
      <td>Total (${familyCount(rows.length)})</td>
      <td></td>
      <td>${adults}</td>
      <td>${under6}</td>
      <td>${ages6to12}</td>
      <td>${over12}</td>
      <td>${people}</td>
      <td></td>
    </tr>
  `
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
    rosterContent.innerHTML = printHeading(sessionId, rows) +
      '<p class="empty-state">No families registered for this session yet.</p>'
    return
  }

  rosterContent.innerHTML = printHeading(sessionId, rows) + `
    <div class="table-wrapper">
      <table class="attendance-table">
        <thead>
          <tr>
            <th class="print-only">Check-in</th>
            <th>Family</th>
            <th>Status</th>
            <th>Adults</th>
            <th>Under 6</th>
            <th>Ages 6–12</th>
            <th>Over 12</th>
            <th>Total People</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rosterRows(rows)}
        </tbody>
        <tfoot>
          ${totalsRow(rows)}
        </tfoot>
      </table>
    </div>
  `
}

// runs when a different session is picked
function sessionChange(): void {
  const selectSession = document.querySelector<HTMLSelectElement>('#roster-session-select')!
  showRoster(selectSession.value)
}

// opens the browser print window (staff can also save as PDF there)
function printRoster(): void {
  window.print()
}

// title and intro at the top of the roster
const rosterTitle = `
  <h2 class="attendance-title no-print">Session Roster</h2>
  <p class="attendance-intro no-print">
    Pick a session to see the families registered for it.
    Print it to check families in at the session.
  </p>
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

  allSessions = sessions

  // session dropdown, print button, and empty spot for the table
  rosterSection.innerHTML = rosterTitle + `
    <div class="attendance-toolbar no-print">
      <div class="year-filter">
        <label for="roster-session-select">Session</label>
        <select id="roster-session-select">
          ${sessionOptions(sessions)}
        </select>
      </div>

      <button id="print-roster" class="print-button" type="button">Print Roster</button>
    </div>

    <div id="roster-content"></div>
  `

  // show newest session first
  showRoster(String(sessions[0].id))

  document.querySelector<HTMLSelectElement>('#roster-session-select')!.addEventListener('change', sessionChange)
  document.querySelector<HTMLButtonElement>('#print-roster')!.addEventListener('click', printRoster)
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