/*
Attendance tab for the parent dashboard.
Lets parents see the sessions their family went to
and how close they are to the 12 hours they need.
*/

import './attendance.css'
import { supabase } from './supabase'

// empty box in html where the attendance tab goes; '!' at end to say box is always on page
const section = document.querySelector<HTMLElement>('#attendance-section')!

// all links in nav bar
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a')

// attended session kept record
interface AttendanceRecord {
  programYear: string
  sessionTitle: string
  sessionType: string
  typeColor: string
  sessionDate: string
  startTime: string
  endTime: string
  attendees: string[]
  mandatory: boolean
}

// a parent or scholar's name
interface PersonName {
  first_name: string
  last_name: string
}

// one person who came to a session (attendance_members table)
interface AttendeeRow {
  member_type: string
  other_member_name: string | null
  guest_name: string | null
  parents: PersonName | null
  scholars: PersonName | null
}

// session_types table
interface SessionTypeRow {
  name: string
  color_code: string
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
  session_types: SessionTypeRow | null
  program_years: ProgramYearRow | null
}

// registrations table
interface RegistrationRow {
  sessions: SessionRow | null
}

// one attendance row with everything connected to it
interface AttendanceRow {
  registrations: RegistrationRow | null
  attendance_members: AttendeeRow[]
}

// filled in from supabase when the page loads
let attendanceRecords: AttendanceRecord[] = []

// get each person's name with who they are
function getAttendeeName(member: AttendeeRow): string {
  if (member.member_type === 'parent' && member.parents) {
    return member.parents.first_name + ' ' + member.parents.last_name + ' (Parent)'
  }

  if (member.member_type === 'scholar' && member.scholars) {
    return member.scholars.first_name + ' ' + member.scholars.last_name + ' (Scholar)'
  }

  if (member.guest_name) {
     return member.guest_name + ' (Guest)'
  }

  if (member.other_member_name) {
    return member.other_member_name + ' (Family)'
  }

  return 'Unknown'
}

function toAttendanceRecord(row: AttendanceRow): AttendanceRecord | null {
  
  // skip this row if the session didn't come back
  if (!row.registrations || !row.registrations.sessions) {
    return null
  }

  const session = row.registrations.sessions

  // names of everyone who came
  const attendees: string[] = []
  for (const member of row.attendance_members) {
    attendees.push(getAttendeeName(member))
  }

  // grey dot if the session has no type
  let typeName = 'Other'
  let typeColor = '#999999'
  if (session.session_types) {
    typeName = session.session_types.name
    typeColor = session.session_types.color_code
  }

  let programYear = ''
  if (session.program_years) {
    programYear = session.program_years.name
  }

  return {
    programYear: programYear,
    sessionTitle: session.title,
    sessionType: typeName,
    typeColor: typeColor,
    sessionDate: session.session_date,
    startTime: session.start_time,
    endTime: session.end_time,
    attendees: attendees,
    mandatory: session.is_mandatory,
  }
}

// puts newer sessions first
function newestFirst(a: AttendanceRecord, b: AttendanceRecord): number {
  if (a.sessionDate < b.sessionDate) {
    return 1
  }
  if (a.sessionDate > b.sessionDate) {
    return -1
  }
  return 0
}

// gets the family's attendance from supabase; RLS only sends back their own family's rows
async function loadAttendance(): Promise<AttendanceRecord[] | null> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      registrations (
        sessions (
          title, session_date, start_time, end_time, is_mandatory,
          session_types ( name, color_code ),
          program_years ( name )
        )
      ),
      attendance_members (
        member_type, other_member_name, guest_name,
        parents ( first_name, last_name ),
        scholars ( first_name, last_name )
      )
    `)
    .eq('attendance_status', 'present')

  if (error) {
    console.error('Could not load attendance:', error.message)
    return null
  }

  const records: AttendanceRecord[] = []
  // supabase guesses the wrong shape here, so we tell typescript what it really is
  for (const row of data as unknown as AttendanceRow[]) {
    const record = toAttendanceRecord(row)
    if (record) {
      records.push(record)
    }
  }

  records.sort(newestFirst)
  return records
}

// helper function for formatting date better
function formatDate(date: string): string {
  const dateParts = date.split('-')
  const dateObject = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]))
  return dateObject.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// how long a session was in hours
function getHours(record: AttendanceRecord): number {
  const start = record.startTime.split(':')
  const end = record.endTime.split(':')

  const startMinutes = Number(start[0]) * 60 + Number(start[1])
  const endMinutes = Number(end[0]) * 60 + Number(end[1])

  return (endMinutes - startMinutes) / 60
}

// builds one table row for each session
function buildTableRows(records: AttendanceRecord[]): string {
  let rows = ''

  for (const record of records) {
    let mandatoryTag = ''
    if (record.mandatory) {
      mandatoryTag = '<span class="mandatory-tag">Mandatory</span>'
    }
    rows += `
      <tr>
        <td>${formatDate(record.sessionDate)}</td>
        <td>${record.sessionTitle}</td>
        <td>
          <span class="type-dot" style="background-color: ${record.typeColor};"></span>
          ${record.sessionType}
          ${mandatoryTag}
        </td>
        <td>${record.attendees.join(', ')}</td>
        <td class="hours-cell">${getHours(record)}</td>
      </tr>
    `
  }

  return rows
}

// gets sessions from one program year
function getYearRecords(year: string): AttendanceRecord[] {
  const yearRecords: AttendanceRecord[] = []

  for (const record of attendanceRecords) {
    if (record.programYear === year) {
      yearRecords.push(record)
    }
  }

  return yearRecords
}

// gets every program year in the data; newest first
function getProgramYears(): string[] {
  const years: string[] = []

  for (const record of attendanceRecords) {
    if (!years.includes(record.programYear)) {
      years.push(record.programYear)
    }
  }

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

// required hours of learning
const requiredHours = 12

// adds up hours from a list of sessions
function getTotalHours(records: AttendanceRecord[]): number {
  let totalHours = 0

  for (const record of records) {
    totalHours += getHours(record)
  }

  return totalHours
}

// build hours progress section
function buildProgressSection(records: AttendanceRecord[]): string {
  const totalHours = getTotalHours(records)
  const hoursLeft = requiredHours - totalHours
  let percent = (totalHours / requiredHours) * 100

  if (percent > 100) {
    percent = 100
  }

  let message = ''
  let barClass = 'progress-fill'

  if (hoursLeft > 0) {
    message = hoursLeft + ' hours left to go'
  } else {
    message = 'All ' + requiredHours + ' hours completed!'
    barClass = 'progress-fill complete'
  }

  return `
    <div class="progress-section">
      <p class="progress-text">${totalHours} of ${requiredHours} hours completed</p>
      <div class="progress-bar">
        <div class="${barClass}" style="width: ${percent}%;"></div>
      </div>
      <p class="progress-message">${message}</p>
    </div>
  `
}

// open/close the attendance tab
function showAttendance(show: boolean): void {
  section.hidden = !show

  for (const link of navLinks) {
    if (show && link.dataset.tab === 'attendance') {
      link.classList.add('active')
    } else {
      link.classList.remove('active')
    }
  }
}

// filter records by session title/type/attendee
function filterRecords(records: AttendanceRecord[], query: string): AttendanceRecord[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return records
  }

  return records.filter((record) =>
    record.sessionTitle.toLowerCase().includes(normalized) ||
    record.sessionType.toLowerCase().includes(normalized) ||
    record.programYear.toLowerCase().includes(normalized) ||
    record.attendees.some((person) => person.toLowerCase().includes(normalized))
  )
}

// title and intro at the top of the tab
const titleAndIntro = `
  <h2 class="attendance-title">Attendance History</h2>
  <p class="attendance-intro">
    Track the sessions you and your family have attended
    and your progress toward the required 12 hours of learning.
  </p>
`

// shows hours progress and sessions table for one program year
function showYear(year: string): void {
  const yearContent = document.querySelector<HTMLElement>('#year-content')!

  const yearRecords = getYearRecords(year)
  const query = (document.querySelector<HTMLInputElement>('#attendance-search')?.value ?? '').trim()
  const filteredRecords = filterRecords(yearRecords, query)

  const rows = buildTableRows(filteredRecords)

  let resultsLine = ''
  if (query) {
    const matchedHours = getTotalHours(filteredRecords)

    let hourWord = 'hours'
    if (matchedHours === 1) {
      hourWord = 'hour'
    }

    resultsLine = '<p class="search-results">Showing ' + filteredRecords.length + ' of ' + yearRecords.length +
      ' sessions · ' + matchedHours + ' ' + hourWord + '</p>'

  }

  yearContent.innerHTML = `
    ${buildProgressSection(yearRecords)}
    ${resultsLine}

    <div class="table-wrapper">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Session</th>
            <th>Type</th>
            <th>Who Attended</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `
            <tr>
              <td colspan="5" class="empty-state">No matching sessions found.</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `
}


// runs when a different year is picked or the search changes
function yearChange(): void {
  const selectYear = document.querySelector<HTMLSelectElement>('#year-select')!
  showYear(selectYear.value)
}

// loads attendance from supabase, then fills in the tab
async function startAttendanceTab(): Promise<void> {
  section.innerHTML = titleAndIntro + '<p class="attendance-intro">Loading attendance...</p>'

  const records = await loadAttendance()

  // if loading from supabase failed, show an error message  
  if (records === null) {
    section.innerHTML = titleAndIntro + '<p class="empty-state">Could not load your attendance right now. Please try again later.</p>'
    return
  }

  attendanceRecords = records
  const programYears = getProgramYears()

  // no sessions attended yet
  if (programYears.length === 0) {
    section.innerHTML = titleAndIntro + buildProgressSection([]) +
      '<p class="empty-state">No sessions recorded yet. Sessions you attend will show up here.</p>'
    return
  }

  // year dropdown, search box, and empty spot for content
  section.innerHTML = titleAndIntro + `
    <div class="attendance-toolbar">
      <div class="year-filter">
        <label for="year-select">Program year</label>
        <select id="year-select">
          ${yearOptions(programYears)}
        </select>
      </div>

      <div class="attendance-controls">
        <input
          id="attendance-search"
          type="search"
          placeholder="Search sessions or attendees"
          aria-label="Search attendance records"
        />
      </div>
    </div>

    <div id="year-content"></div>
  `

  // show newest year first
  showYear(programYears[0])

  // update the table when the year or search changes
  document.querySelector<HTMLSelectElement>('#year-select')!.addEventListener('change', yearChange)
  document.querySelector<HTMLInputElement>('#attendance-search')!.addEventListener('input', yearChange)
}

// runs when nav link clicked
function handleNavClick(event: Event): void {
  const clickedLink = event.currentTarget as HTMLAnchorElement

  if (clickedLink.dataset.tab === 'attendance') {
    showAttendance(true)
  } else {
    showAttendance(false)
  }
}

// run handleNavClick if any nav link is clicked
for (const link of navLinks) {
  link.addEventListener('click', handleNavClick)
}

// open tab if url ends with #attendance
if (window.location.hash === '#attendance') {
  showAttendance(true)
} else {
  showAttendance(false)
}

// load the data and fill in the tab
startAttendanceTab()
