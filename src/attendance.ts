/*
Attendance tab for the parent dashboard.
Lets parents see the sessions their family went to
and how close they are to the 12 hours they need.
*/

import './attendance.css'

// empty box in html where the attendance tab goes; '!' at end to say box is always on page
const section = document.querySelector<HTMLElement>('#attendance-section')!

// all links in nav bar
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a')

// attended session kept record
interface AttendanceRecord {
  programYear: string
  sessionTitle: string
  sessionType: string
  sessionDate: string
  startTime: string
  endTime: string
  attendees: string[]
}

// sample data for now, will come from supabase later
const attendanceRecords: AttendanceRecord[] = [
  {
    programYear: '2026-2027',
    sessionTitle: 'Session 1',
    sessionType: 'Lunch & Learn',
    sessionDate: '2026-10-06',
    startTime: '12:00',
    endTime: '13:00',
    attendees: ['Vanessa Aniston (Parent)', 'Jake Aniston (Scholar)'],
  },
  {
    programYear: '2026-2027',
    sessionTitle: 'Session 2',
    sessionType: 'In-person',
    sessionDate: '2026-09-22',
    startTime: '18:00',
    endTime: '20:00',
    attendees: ['Vanessa Aniston (Parent)', 'Maria Lopez (Guest)'],
  },
  {
    programYear: '2026-2027',
    sessionTitle: 'Session 3',
    sessionType: 'Mandatory',
    sessionDate: '2026-08-25',
    startTime: '17:00',
    endTime: '19:00',
    attendees: ['Vanessa Aniston (Parent)', 'Daniel Aniston (Parent)', 'Jake Aniston (Scholar)', 'Alice Aniston (Scholar)'],
  },
  {
    programYear: '2025-2026',
    sessionTitle: 'Session 4',
    sessionType: 'In-person',
    sessionDate: '2026-04-14',
    startTime: '18:00',
    endTime: '21:00',
    attendees: ['Vanessa Aniston (Parent)', 'Jake Aniston (Scholar)'],
  },
  {
    programYear: '2025-2026',
    sessionTitle: 'Session 5',
    sessionType: 'Community event',
    sessionDate: '2026-03-21',
    startTime: '11:00',
    endTime: '14:00',
    attendees: ['Vanessa Aniston (Parent)', 'Daniel Aniston (Parent)', 'Jake Aniston (Scholar)', 'Alice Aniston (Scholar)'],
  },
  {
    programYear: '2025-2026',
    sessionTitle: 'Session 6',
    sessionType: 'In-person',
    sessionDate: '2025-11-18',
    startTime: '18:00',
    endTime: '21:00',
    attendees: ['Vanessa Aniston (Parent)'],
  },
  {
    programYear: '2025-2026',
    sessionTitle: 'Session 7',
    sessionType: 'Mandatory',
    sessionDate: '2025-08-26',
    startTime: '17:00',
    endTime: '20:00',
    attendees: ['Vanessa Aniston (Parent)', 'Daniel Aniston (Parent)'],
  },
]

// color for each session type
const sessionTypeColors: Record<string, string> = {
  'In-person': '#4A90D9',
  'Lunch & Learn': '#F5A623',
  'Virtual': '#7ED321',
  'Community event': '#9013FE',
  'Mandatory': '#D0021B',
  'Platinum': '#8B8B8B',
  'Other': '#4A4A4A',
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
    rows += `
      <tr>
        <td>${formatDate(record.sessionDate)}</td>
        <td>${record.sessionTitle}</td>
        <td>
          <span class="type-dot" style="background-color: ${sessionTypeColors[record.sessionType]};"></span>
          ${record.sessionType}
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

// every program year in the data
const programYears = getProgramYears()

// title, description, year dropdown, search box, and empty spot for content
section.innerHTML = `
  <h2 class="attendance-title">Attendance History</h2>
  <p class="attendance-intro">
    Track the sessions you and your family have attended
    and your progress toward the required 12 hours of learning.
  </p>

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

  <div id="year-content"></div>
`

// shows hours progress and sessions table for one program year
function showYear(year: string): void {
  const yearContent = document.querySelector<HTMLElement>('#year-content')!

  const yearRecords = getYearRecords(year)
  const query = (document.querySelector<HTMLInputElement>('#attendance-search')?.value ?? '').trim()
  const filteredRecords = filterRecords(yearRecords, query)

  const rows = buildTableRows(filteredRecords)

  yearContent.innerHTML = `
    ${buildProgressSection(filteredRecords)}

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

// show newest year when page first loads
showYear(programYears[0])

// program year dropdown
const selectYear = document.querySelector<HTMLSelectElement>('#year-select')!

// runs when different year is picked
function yearChange(): void {
  showYear(selectYear.value)
}

// run the yearChange whenever dropdown changes
selectYear.addEventListener('change', yearChange)

// live search
const searchInput = document.querySelector<HTMLInputElement>('#attendance-search')

searchInput?.addEventListener('input', () => {
  showYear(selectYear.value)
})

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
