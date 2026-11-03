/*
Attendance tab for the staff dashboard.
Lets staff see every family's attendance
and how close each family is to the 12 hours they need.
*/

import './attendance.css'
import { supabase } from './supabase'

// empty box in html where the staff attendance tab goes; '!' at end to say box is always on page
const staffSection = document.querySelector<HTMLElement>('#staff-attendance-section')!

const sessionDashboard = document.querySelector<HTMLElement>('#events-dashboard')!

// all links in nav bar
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a')

// one attended session for one family
interface StaffRecord {
  programYear: string
  familyName: string
  sessionDate: string
  startTime: string
  endTime: string
}

// one family's totals for a program year
interface FamilySummary {
  familyName: string
  sessionCount: number
  hours: number
}

// program_years table
interface ProgramYearRow {
  name: string
}

// sessions table
interface SessionRow {
  session_date: string
  start_time: string
  end_time: string
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

// one attendance row with everything connected to it
interface AttendanceRow {
  sessions: SessionRow | null
  registrations: RegistrationRow | null
}

// filled in from supabase when the page loads
let staffRecords: StaffRecord[] = []

// required hours of learning
const requiredHours = 12

// title and intro at the top of the tab
const titleAndIntro = `
  <h2 class="attendance-title">Attendance</h2>
  <p class="attendance-intro">
    View every family's attendance and their progress toward the required 12 hours of learning.
  </p>
`

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

  return {
    programYear: programYear,
    familyName: familyName,
    sessionDate: session.session_date,
    startTime: session.start_time,
    endTime: session.end_time,
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
        session_date, start_time, end_time,
        program_years ( name )
      ),
      registrations (
        families ( family_name )
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

// how long a session was in hours
function getHours(record: StaffRecord): number {
  const start = record.startTime.split(':')
  const end = record.endTime.split(':')

  const startMinutes = Number(start[0]) * 60 + Number(start[1])
  const endMinutes = Number(end[0]) * 60 + Number(end[1])

  return (endMinutes - startMinutes) / 60
}

// gets every program year in the data; newest first
function getProgramYears(): string[] {
  const years: string[] = []

  for (const record of staffRecords) {
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

// adds up sessions and hours for each family in one program year
function getFamilySummaries(year: string): FamilySummary[] {
  const summaries: FamilySummary[] = []

  for (const record of staffRecords) {
    if (record.programYear !== year) {
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
      summary = { familyName: record.familyName, sessionCount: 0, hours: 0 }
      summaries.push(summary)
    }

    summary.sessionCount += 1
    summary.hours += getHours(record)
  }

  return summaries
}

// builds one table row for each family
function buildFamilyRows(summaries: FamilySummary[]): string {
  let rows = ''

  for (const summary of summaries) {
    rows += `
      <tr>
        <td>${summary.familyName}</td>
        <td>${summary.sessionCount}</td>
        <td class="hours-cell">${summary.hours} / ${requiredHours}</td>
      </tr>
    `
  }

  return rows
}

// shows the families table for one program year
function showYear(year: string): void {
  const yearContent = document.querySelector<HTMLElement>('#staff-year-content')!
  const rows = buildFamilyRows(getFamilySummaries(year))

  yearContent.innerHTML = `
    <div class="table-wrapper">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Family</th>
            <th>Sessions Attended</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `
}

// runs when a different year is picked
function yearChange(): void {
  const selectYear = document.querySelector<HTMLSelectElement>('#staff-year-select')!
  showYear(selectYear.value)
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
  const programYears = getProgramYears()

  // no attendance recorded yet
  if (programYears.length === 0) {
    staffSection.innerHTML = titleAndIntro + '<p class="empty-state">No attendance recorded yet.</p>'
    return
  }

  // year dropdown and empty spot for the families table
  staffSection.innerHTML = titleAndIntro + `
    <div class="attendance-toolbar">
      <div class="year-filter">
        <label for="staff-year-select">Program year</label>
        <select id="staff-year-select">
          ${yearOptions(programYears)}
        </select>
      </div>
    </div>

    <div id="staff-year-content"></div>
  `

  // show newest year first
  showYear(programYears[0])

  // update the table when the year changes
  document.querySelector<HTMLSelectElement>('#staff-year-select')!.addEventListener('change', yearChange)
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