/*
Attendance tab for the staff dashboard.
Lets staff see every family's attendance
and how close each family is to the 12 hours they need.
*/

import './attendance.css'
import './staff-attendance.css'
import { supabase } from './supabase'

// empty box in html where the staff attendance tab goes; '!' at end to say box is always on page
const staffSection = document.querySelector<HTMLElement>('#staff-attendance-section')!

// session dashboard hidden while the attendance tab is open
const sessionDashboard = document.querySelector<HTMLElement>('#events-dashboard')!

// all links in nav bar
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a')

// one attended session for one family
interface StaffRecord {
  programYear: string
  familyName: string
  sessionTitle: string
  sessionDate: string
  startTime: string
  endTime: string
  mandatory: boolean
  attendeeCount: number
  attendeeNames: string[]
}

// one family's totals for a program year; kept in minutes so times like 1 hour 20 minutes add up exactly
interface FamilySummary {
  familyName: string
  sessionCount: number
  minutes: number
  instructionalMinutes: number
  mandatoryDone: boolean
}

// program_years table
interface ProgramYearRow {
  name: string
}

// sessions table
interface SessionRow {
  title: string
  session_date: string
  start_time: string
  end_time: string
  is_mandatory: boolean
  program_years: ProgramYearRow | null
}

// families table
interface FamilyRow {
  family_name: string
}

// registrations table
interface RegistrationRow {
  families: FamilyRow | null
}

// a parent or scholar's name
interface PersonName {
  first_name: string
  last_name: string
}

// one person at a session (attendance_members table)
interface AttendeeRow {
  attendance_status: string | null
  attendee_type: string
  display_name: string | null
  parents: PersonName | null
  scholars: PersonName | null
}

// one attendance row with everything connected to it
interface AttendanceRow {
  sessions: SessionRow | null
  registrations: RegistrationRow | null
  attendance_members: AttendeeRow[]
}

// one family enrolled in one program year (family_program_years table)
interface EnrollmentRow {
  families: FamilyRow | null
  program_years: ProgramYearRow | null
}

// a family enrolled in a program year, even if they haven't attended anything yet
interface Enrollment {
  programYear: string
  familyName: string
}

// filled in from supabase when the page loads
let staffRecords: StaffRecord[] = []
let enrollments: Enrollment[] = []

// required hours of learning, and the same in minutes
const requiredHours = 12
const requiredMinutes = requiredHours * 60

// which box is picked: 'all', 'complete', or 'in-progress'
let cardFilter = 'all'

// which family's sessions are open; empty means none
let openFamily = ''

// which month is picked, like '2026-10'; 'all' means the whole program year
let monthFilter = 'all'

// title and intro at the top of the tab
const titleAndIntro = `
  <h2 class="attendance-title">Attendance</h2>
  <p class="attendance-intro">
    View every family's attendance and their progress toward the required 12 hours of learning.
  </p>
`

// get each person's name with who they are
function getAttendeeName(member: AttendeeRow): string {
  if (member.attendee_type === 'parent' && member.parents) {
    return member.parents.first_name + ' ' + member.parents.last_name + ' (Parent)'
  }

  if (member.attendee_type === 'scholar' && member.scholars) {
    return member.scholars.first_name + ' ' + member.scholars.last_name + ' (Scholar)'
  }

  if (member.display_name) {
    return member.display_name + ' (Guest)'
  }

  return 'Unknown'
}

// changes a supabase row into a simpler record
function toStaffRecord(row: AttendanceRow): StaffRecord | null {
  // skip this row if the session didn't come back
  if (!row.sessions) {
    return null
  }

  const session = row.sessions

  let familyName = 'Unknown family'
  if (row.registrations && row.registrations.families) {
    familyName = row.registrations.families.family_name
  }

  let programYear = ''
  if (session.program_years) {
    programYear = session.program_years.name
  }

  // who from the family came, and how many
  const attendeeNames: string[] = []
  for (const member of row.attendance_members) {
    if (member.attendance_status === 'attended') {
      attendeeNames.push(getAttendeeName(member))
    }
  }

  return {
    programYear: programYear,
    familyName: familyName,
    sessionTitle: session.title,
    sessionDate: session.session_date,
    startTime: session.start_time,
    endTime: session.end_time,
    mandatory: session.is_mandatory,
    attendeeCount: attendeeNames.length,
    attendeeNames: attendeeNames,
  }
}

// puts newer sessions first
function newestFirst(a: StaffRecord, b: StaffRecord): number {
  if (a.sessionDate < b.sessionDate) {
    return 1
  }
  if (a.sessionDate > b.sessionDate) {
    return -1
  }
  return 0
}

// gets every family's attendance from supabase; RLS lets staff see all families
async function loadStaffAttendance(): Promise<StaffRecord[] | null> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      sessions (
        title, session_date, start_time, end_time, is_mandatory,
        program_years ( name )
      ),
      registrations (
        families ( family_name )
      ),
      attendance_members (
        attendance_status, attendee_type, display_name,
        parents ( first_name, last_name ),
        scholars ( first_name, last_name )
      )
    `)
    .eq('attendance_status', 'present')

  if (error) {
    console.error('Could not load attendance:', error.message)
    return null
  }

  const records: StaffRecord[] = []
  // supabase guesses the wrong shape here, so we tell typescript what it really is
  for (const row of data as unknown as AttendanceRow[]) {
    const record = toStaffRecord(row)
    if (record) {
      records.push(record)
    }
  }

  records.sort(newestFirst)
  return records
}

// gets every family enrolled in each program year, so families with 0 hours still show up
async function loadEnrollments(): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from('family_program_years')
    .select(`
      families ( family_name ),
      program_years ( name )
    `)

  // if this fails, still show the families that have attendance
  if (error) {
    console.error('Could not load enrollments:', error.message)
    return []
  }

  const list: Enrollment[] = []
  // supabase guesses the wrong shape here, so we tell typescript what it really is
  for (const row of data as unknown as EnrollmentRow[]) {
    if (row.families && row.program_years) {
      list.push({ programYear: row.program_years.name, familyName: row.families.family_name })
    }
  }

  return list
}

// how long a session was in minutes
function getMinutes(record: StaffRecord): number {
  const start = record.startTime.split(':')
  const end = record.endTime.split(':')

  const startMinutes = Number(start[0]) * 60 + Number(start[1])
  const endMinutes = Number(end[0]) * 60 + Number(end[1])

  return endMinutes - startMinutes
}

// formats a date like 2026-10-06 into Oct 6, 2026
function formatDate(date: string): string {
  const dateParts = date.split('-')
  const dateObject = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]))
  return dateObject.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// turns minutes into hours for showing on the page, like 80 minutes -> 1.33
function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 100) / 100
  return String(hours)
}

// gets the month part of a date, like 2026-10-06 -> 2026-10
function getMonthKey(date: string): string {
  return date.slice(0, 7)
}

// formats a month like 2026-10 into October 2026
function formatMonth(monthKey: string): string {
  const parts = monthKey.split('-')
  const dateObject = new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
  return dateObject.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// gets every program year from enrollments and attendance; newest first
function getProgramYears(): string[] {
  const years: string[] = []

  for (const enrollment of enrollments) {
    if (!years.includes(enrollment.programYear)) {
      years.push(enrollment.programYear)
    }
  }

  for (const record of staffRecords) {
    if (!years.includes(record.programYear)) {
      years.push(record.programYear)
    }
  }

  // years look like 2026-2027, so sorting them as text and flipping puts the newest first
  years.sort()
  years.reverse()
  return years
}

// build one dropdown option for each program year
function yearOptions(years: string[]): string {
  let options = ''

  for (const year of years) {
    options += '<option>' + year + '</option>'
  }

  return options
}

// gets every month that has attendance in one program year; newest first
function getMonths(year: string): string[] {
  const months: string[] = []

  // records are already newest first, so months come out newest first too
  for (const record of staffRecords) {
    const monthKey = getMonthKey(record.sessionDate)
    if (record.programYear === year && !months.includes(monthKey)) {
      months.push(monthKey)
    }
  }

  return months
}

// build the month dropdown for one program year
function monthOptions(year: string): string {
  let options = '<option value="all">All months</option>'

  for (const monthKey of getMonths(year)) {
    options += '<option value="' + monthKey + '">' + formatMonth(monthKey) + '</option>'
  }

  return options
}

// adds up sessions and minutes for each family in one program year, or one month of it
function getFamilySummaries(year: string, month: string): FamilySummary[] {
  const summaries: FamilySummary[] = []

  // for the whole year, start with every enrolled family at 0 so families who haven't attended still show up
  if (month === 'all') {
    for (const enrollment of enrollments) {
      if (enrollment.programYear === year) {
        summaries.push({ familyName: enrollment.familyName, sessionCount: 0, minutes: 0, instructionalMinutes: 0, mandatoryDone: false })
      }
    }
  }

  for (const record of staffRecords) {
    if (record.programYear !== year) {
      continue
    }

    // skip sessions from other months when a month is picked
    if (month !== 'all' && getMonthKey(record.sessionDate) !== month) {
      continue
    }

    // find this family's summary, or make a new one
    let summary: FamilySummary | null = null
    for (const existing of summaries) {
      if (existing.familyName === record.familyName) {
        summary = existing
      }
    }

    if (!summary) {
      summary = { familyName: record.familyName, sessionCount: 0, minutes: 0, instructionalMinutes: 0, mandatoryDone: false }
      summaries.push(summary)
    }

    summary.sessionCount += 1
    summary.minutes += getMinutes(record)
    summary.instructionalMinutes += getMinutes(record) * record.attendeeCount

    if (record.mandatory) {
      summary.mandatoryDone = true
    }
  }

  summaries.sort(fewestHoursFirst)
  return summaries
}

// puts families with the fewest hours first, so the ones who need help are at the top
function fewestHoursFirst(a: FamilySummary, b: FamilySummary): number {
  return a.minutes - b.minutes
}

// keeps only the families whose name matches the search
function filterFamilies(summaries: FamilySummary[], query: string): FamilySummary[] {
  const search = query.trim().toLowerCase()

  if (!search) {
    return summaries
  }

  const matches: FamilySummary[] = []
  for (const summary of summaries) {
    if (summary.familyName.toLowerCase().includes(search)) {
      matches.push(summary)
    }
  }

  return matches
}

// keeps only the families that match the box that was clicked
function filterByCard(summaries: FamilySummary[]): FamilySummary[] {
  if (cardFilter === 'all') {
    return summaries
  }

  const matches: FamilySummary[] = []
  for (const summary of summaries) {
    const isComplete = summary.minutes >= requiredMinutes

    if (cardFilter === 'complete' && isComplete) {
      matches.push(summary)
    }
    if (cardFilter === 'in-progress' && !isComplete) {
      matches.push(summary)
    }
  }

  return matches
}

// adds 'active' to the box that matches the current filter, so it looks selected
function cardClass(filter: string): string {
  if (cardFilter === filter) {
    return 'staff-card clickable active'
  }
  return 'staff-card clickable'
}

// runs when a box is clicked; clicking the same box again shows all families
function handleCardClick(event: Event): void {
  const clickedCard = event.currentTarget as HTMLButtonElement
  const filter = clickedCard.dataset.filter!

  if (cardFilter === filter) {
    cardFilter = 'all'
  } else {
    cardFilter = filter
  }

  yearChange()
}

// runs when a family name is clicked; clicking the same family again closes it
function handleFamilyClick(event: Event): void {
  const clickedButton = event.currentTarget as HTMLButtonElement
  const familyName = clickedButton.dataset.family!

  if (openFamily === familyName) {
    openFamily = ''
  } else {
    openFamily = familyName
  }

  yearChange()
}

// builds the list of sessions one family attended in one program year, or one month of it
function buildFamilySessions(familyName: string, year: string, month: string): string {
  let rows = ''

  for (const record of staffRecords) {
    if (record.familyName !== familyName || record.programYear !== year) {
      continue
    }

    if (month !== 'all' && getMonthKey(record.sessionDate) !== month) {
      continue
    }

    let mandatoryTag = ''
    if (record.mandatory) {
      mandatoryTag = ' <span class="mandatory-tag">Mandatory</span>'
    }

    rows += `
      <tr>
        <td>${formatDate(record.sessionDate)}</td>
        <td>${record.sessionTitle}${mandatoryTag}</td>
        <td>${record.attendeeNames.join(', ')}</td>
        <td>${formatHours(getMinutes(record))}</td>
        <td>${record.attendeeCount}</td>
        <td>${formatHours(getMinutes(record) * record.attendeeCount)}</td>
      </tr>
    `
  }

  if (!rows) {
    return '<p class="empty-state">No sessions attended yet this program year.</p>'
  }

  return `
    <table class="family-sessions">
      <thead>
        <tr>
          <th>Date</th>
          <th>Session</th>
          <th>Who Attended</th>
          <th>Hours</th>
          <th>People</th>
          <th>Instructional Hours</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `
}

// builds the summary boxes at the top
function buildSummaryCards(summaries: FamilySummary[]): string {
  let completed = 0
  let instructionalMinutes = 0

  for (const summary of summaries) {
    if (summary.minutes >= requiredMinutes) {
      completed += 1
    }
    instructionalMinutes += summary.instructionalMinutes
  }

  const inProgress = summaries.length - completed

  return `
    <div class="staff-cards">
      <button type="button" class="${cardClass('all')}" data-filter="all">
        <p class="staff-card-label">Families Enrolled</p>
        <p class="staff-card-number">${summaries.length}</p>
      </button>
      <button type="button" class="${cardClass('complete')}" data-filter="complete">
        <p class="staff-card-label">Completed ${requiredHours} Hours</p>
        <p class="staff-card-number">${completed}</p>
      </button>
      <button type="button" class="${cardClass('in-progress')}" data-filter="in-progress">
        <p class="staff-card-label">Under ${requiredHours} Hours</p>
        <p class="staff-card-number">${inProgress}</p>
      </button>
      <div class="staff-card">
        <p class="staff-card-label">Total Instructional Hours</p>
        <p class="staff-card-number">${formatHours(instructionalMinutes)}</p>
      </div>
    </div>
  `
}

// builds one table row for each family, plus the open family's sessions under it
function buildFamilyRows(summaries: FamilySummary[], year: string): string {
  let rows = ''

  for (const summary of summaries) {
    let percent = (summary.minutes / requiredMinutes) * 100
    if (percent > 100) {
      percent = 100
    }

    let status = '<span class="status-pill in-progress">In progress</span>'
    let fillClass = 'mini-fill'
    if (summary.minutes === 0) {
      status = '<span class="status-pill not-started">Not started</span>'
    }
    if (summary.minutes >= requiredMinutes) {
      status = '<span class="status-pill complete">Complete</span>'
      fillClass = 'mini-fill complete'
    }

    let mandatory = '<span class="mandatory-missing">Not yet</span>'
    if (summary.mandatoryDone) {
      mandatory = 'Attended'
    }

    let arrow = '▶'
    if (openFamily === summary.familyName) {
      arrow = '▼'
    }

    rows += `
      <tr>
        <td>
          <button type="button" class="family-toggle" data-family="${summary.familyName}">
            <span class="toggle-arrow">${arrow}</span> ${summary.familyName}
          </button>
        </td>
        <td>${summary.sessionCount}</td>
        <td>${mandatory}</td>
        <td>
          <div class="mini-bar">
            <div class="${fillClass}" style="width: ${percent}%;"></div>
          </div>
        </td>
        <td class="hours-cell">${formatHours(summary.minutes)} / ${requiredHours}</td>
        <td>${formatHours(summary.instructionalMinutes)}</td>
        <td>${status}</td>
      </tr>
    `

    // show this family's sessions right under their row
    if (openFamily === summary.familyName) {
      rows += `
        <tr class="family-details-row">
          <td colspan="7">${buildFamilySessions(summary.familyName, year, 'all')}</td>
        </tr>
      `
    }
  }

  return rows
}

// builds the summary boxes for one month
function buildMonthCards(summaries: FamilySummary[], year: string, month: string): string {
  let minutes = 0
  let instructionalMinutes = 0

  for (const summary of summaries) {
    minutes += summary.minutes
    instructionalMinutes += summary.instructionalMinutes
  }

  // count each session once, even if many families came to it
  const sessions: string[] = []
  for (const record of staffRecords) {
    const sessionKey = record.sessionDate + ' ' + record.sessionTitle
    if (record.programYear === year && getMonthKey(record.sessionDate) === month && !sessions.includes(sessionKey)) {
      sessions.push(sessionKey)
    }
  }

  return `
    <div class="staff-cards">
      <div class="staff-card">
        <p class="staff-card-label">Families Attended</p>
        <p class="staff-card-number">${summaries.length}</p>
      </div>
      <div class="staff-card">
        <p class="staff-card-label">Sessions Attended</p>
        <p class="staff-card-number">${sessions.length}</p>
      </div>
      <div class="staff-card">
        <p class="staff-card-label">Hours Attended</p>
        <p class="staff-card-number">${formatHours(minutes)}</p>
      </div>
      <div class="staff-card">
        <p class="staff-card-label">Instructional Hours</p>
        <p class="staff-card-number">${formatHours(instructionalMinutes)}</p>
      </div>
    </div>
  `
}

// finds one family's minutes for the whole year, so the month view can still show their 12 hour progress
function getYearMinutes(yearSummaries: FamilySummary[], familyName: string): number {
  for (const summary of yearSummaries) {
    if (summary.familyName === familyName) {
      return summary.minutes
    }
  }
  return 0
}

// builds one table row for each family that came in one month, plus the open family's sessions under it
function buildMonthRows(summaries: FamilySummary[], yearSummaries: FamilySummary[], year: string, month: string): string {
  let rows = ''

  for (const summary of summaries) {
    const yearMinutes = getYearMinutes(yearSummaries, summary.familyName)

    let percent = (yearMinutes / requiredMinutes) * 100
    if (percent > 100) {
      percent = 100
    }

    let fillClass = 'mini-fill'
    if (yearMinutes >= requiredMinutes) {
      fillClass = 'mini-fill complete'
    }

    let arrow = '▶'
    if (openFamily === summary.familyName) {
      arrow = '▼'
    }

    rows += `
      <tr>
        <td>
          <button type="button" class="family-toggle" data-family="${summary.familyName}">
            <span class="toggle-arrow">${arrow}</span> ${summary.familyName}
          </button>
        </td>
        <td>${summary.sessionCount}</td>
        <td class="hours-cell">${formatHours(summary.minutes)}</td>
        <td>${formatHours(summary.instructionalMinutes)}</td>
        <td>
          <div class="mini-bar">
            <div class="${fillClass}" style="width: ${percent}%;"></div>
          </div>
        </td>
        <td class="hours-cell">${formatHours(yearMinutes)} / ${requiredHours}</td>
      </tr>
    `

    // show this family's sessions from this month right under their row
    if (openFamily === summary.familyName) {
      rows += `
        <tr class="family-details-row">
          <td colspan="6">${buildFamilySessions(summary.familyName, year, month)}</td>
        </tr>
      `
    }
  }

  return rows
}

// shows the boxes and families table for one month of a program year
function showMonth(year: string, month: string): void {
  const yearContent = document.querySelector<HTMLElement>('#staff-year-content')!
  const summaries = getFamilySummaries(year, month)
  const yearSummaries = getFamilySummaries(year, 'all')

  // only the families that match the search
  const query = document.querySelector<HTMLInputElement>('#staff-attendance-search')!.value
  const filtered = filterFamilies(summaries, query)

  let resultsLine = formatMonth(month) + ' only. Year Progress counts the whole program year.'
  if (query.trim()) {
    resultsLine = 'Showing ' + filtered.length + ' of ' + summaries.length + ' families · ' + resultsLine
  }

  yearContent.innerHTML = `
    ${buildMonthCards(summaries, year, month)}
    <p class="search-results">${resultsLine}</p>

    <div class="table-wrapper">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Family</th>
            <th>Sessions</th>
            <th>Hours</th>
            <th>Instructional Hours</th>
            <th>Year Progress</th>
            <th>Year Hours</th>
          </tr>
        </thead>
        <tbody>
          ${buildMonthRows(filtered, yearSummaries, year, month) || `
            <tr>
              <td colspan="6" class="empty-state">No matching families found.</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `

  // make the family names clickable
  const familyButtons = yearContent.querySelectorAll<HTMLButtonElement>('.family-toggle')
  for (const button of familyButtons) {
    button.addEventListener('click', handleFamilyClick)
  }
}

// shows the boxes and families table for one program year
function showYear(year: string): void {
  // a month is picked, so show just that month
  if (monthFilter !== 'all') {
    showMonth(year, monthFilter)
    return
  }

  const yearContent = document.querySelector<HTMLElement>('#staff-year-content')!
  const summaries = getFamilySummaries(year, 'all')

  // only the families that match the box and the search
  const query = document.querySelector<HTMLInputElement>('#staff-attendance-search')!.value
  const filtered = filterFamilies(filterByCard(summaries), query)

  let resultsLine = ''
  if (query.trim() || cardFilter !== 'all') {
    resultsLine = '<p class="search-results">Showing ' + filtered.length + ' of ' + summaries.length + ' families</p>'
  }

  yearContent.innerHTML = `
    ${buildSummaryCards(summaries)}
    ${resultsLine}

    <div class="table-wrapper">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Family</th>
            <th>Sessions</th>
            <th>Mandatory</th>
            <th>Progress</th>
            <th>Hours</th>
            <th>Instructional Hours</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${buildFamilyRows(filtered, year) || `
            <tr>
              <td colspan="7" class="empty-state">No matching families found.</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `

  // make the boxes clickable
  const cards = yearContent.querySelectorAll<HTMLButtonElement>('.staff-card.clickable')
  for (const card of cards) {
    card.addEventListener('click', handleCardClick)
  }

  // make the family names clickable
  const familyButtons = yearContent.querySelectorAll<HTMLButtonElement>('.family-toggle')
  for (const button of familyButtons) {
    button.addEventListener('click', handleFamilyClick)
  }
}

// runs when a different year is picked or the search changes
function yearChange(): void {
  const selectYear = document.querySelector<HTMLSelectElement>('#staff-year-select')!
  showYear(selectYear.value)
}

// runs when a different program year is picked; each year has its own months, so the month list starts over
function yearPicked(): void {
  const selectYear = document.querySelector<HTMLSelectElement>('#staff-year-select')!
  const selectMonth = document.querySelector<HTMLSelectElement>('#staff-month-select')!

  monthFilter = 'all'
  selectMonth.innerHTML = monthOptions(selectYear.value)
  yearChange()
}

// runs when a different month is picked
function monthPicked(): void {
  const selectMonth = document.querySelector<HTMLSelectElement>('#staff-month-select')!

  monthFilter = selectMonth.value
  openFamily = ''
  yearChange()
}

// loads attendance from supabase, then fills in the tab
async function startStaffAttendanceTab(): Promise<void> {
  staffSection.innerHTML = titleAndIntro + '<p class="attendance-intro">Loading attendance...</p>'

  const records = await loadStaffAttendance()

  // if loading from supabase failed, show an error message
  if (records === null) {
    staffSection.innerHTML = titleAndIntro + '<p class="empty-state">Could not load attendance right now. Please try again later.</p>'
    return
  }

  staffRecords = records
  enrollments = await loadEnrollments()
  const programYears = getProgramYears()

  // no families or attendance yet
  if (programYears.length === 0) {
    staffSection.innerHTML = titleAndIntro + '<p class="empty-state">No families or attendance recorded yet.</p>'
    return
  }

  // year and month dropdowns, search box, and empty spot for the families table
  staffSection.innerHTML = titleAndIntro + `
    <div class="attendance-toolbar">
      <div class="staff-filters">
        <div class="year-filter">
          <label for="staff-year-select">Program year</label>
          <select id="staff-year-select">
            ${yearOptions(programYears)}
          </select>
        </div>

        <div class="year-filter">
          <label for="staff-month-select">Month</label>
          <select id="staff-month-select">
            ${monthOptions(programYears[0])}
          </select>
        </div>
      </div>

      <div class="attendance-controls">
        <input
          id="staff-attendance-search"
          type="search"
          placeholder="Search families"
          aria-label="Search families"
        />
      </div>
    </div>

    <div id="staff-year-content"></div>
  `

  // show newest year first
  showYear(programYears[0])

  // update the table when the year, month, or search changes
  document.querySelector<HTMLSelectElement>('#staff-year-select')!.addEventListener('change', yearPicked)
  document.querySelector<HTMLSelectElement>('#staff-month-select')!.addEventListener('change', monthPicked)
  document.querySelector<HTMLInputElement>('#staff-attendance-search')!.addEventListener('input', yearChange)
}

// open/close the attendance tab
function showStaffAttendance(show: boolean): void {
  staffSection.hidden = !show

  if (show) {
    sessionDashboard.style.display = 'none'
  } else {
    sessionDashboard.style.display = ''
  }

  for (const link of navLinks) {
    if (show && link.dataset.tab === 'attendance') {
      link.classList.add('active')
    } else {
      link.classList.remove('active')
    }
  }
}

// runs when nav link clicked
function handleNavClick(event: Event): void {
  const clickedLink = event.currentTarget as HTMLAnchorElement

  if (clickedLink.dataset.tab === 'attendance') {
    showStaffAttendance(true)
  } else {
    showStaffAttendance(false)
  }
}

// run handleNavClick if any nav link is clicked
for (const link of navLinks) {
  link.addEventListener('click', handleNavClick)
}

// open tab if url ends with #attendance
if (window.location.hash === '#attendance') {
  showStaffAttendance(true)
} else {
  showStaffAttendance(false)
}

// load the data and fill in the tab
startStaffAttendanceTab()