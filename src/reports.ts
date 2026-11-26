/*
Reports & Analytics tab for the staff dashboard.
Shows program numbers as charts staff can export to Excel or print for funders and the board.
*/

import './attendance.css'
import './reports.css'
import { supabase } from './supabase'

const reportsSection = document.querySelector<HTMLElement>('#reports-section')!

const sessionDashboard = document.querySelector<HTMLElement>('#events-dashboard')!

// one family in one program year, with everything the Families Served report needs
interface FamilyReportRow {
  programYear: string
  familyId: number
  familyName: string
  county: string
  status: string
  parentCount: number
  scholarCount: number
  attended: boolean
}

// one county (or status) in the breakdown, with its totals
interface GroupSummary {
  name: string
  families: number
  attended: number
  parents: number
  scholars: number
}

// just an id, used to count parents and scholars
interface IdRow {
  id: number
}

// program_years table
interface ProgramYearRow {
  name: string
}

// families table, with its parents and scholars
interface FamilyRow {
  id: number
  family_name: string
  county: string | null
  status: string
  parents: IdRow[]
  scholars: IdRow[]
}

// one family enrolled in one program year (family_program_years table)
interface EnrollmentRow {
  families: FamilyRow | null
  program_years: ProgramYearRow | null
}

// sessions table, only the program year
interface SessionRow {
  program_years: ProgramYearRow | null
}

// registrations table, only which family
interface RegistrationRow {
  family_id: number
}

// one attendance row, only what we need to know who came in which year
interface AttendanceRow {
  sessions: SessionRow | null
  registrations: RegistrationRow | null
}

// filled in from supabase when the page loads
let familyRows: FamilyReportRow[] = []

// the families that match the filters right now, used by the exports
let shownRows: FamilyReportRow[] = []

// the breakdown on screen right now, used by the summary export
let shownGroups: GroupSummary[] = []

// shown when a family has no county saved
const noCounty = 'Not set'

// title and intro at the top of the tab
const titleAndIntro = `
  <div class="report-header no-print">
    <h2 class="attendance-title">Reports & Analytics</h2>
    <p class="attendance-intro">Program numbers you can share with funders, the board, and your team.</p>
  </div>
`

// stops names typed into forms from being read as html
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// gets which families came to at least one session in each program year, like '2026-2027|3'
async function loadAttendedKeys(): Promise<string[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      sessions ( program_years ( name ) ),
      registrations ( family_id )
    `)
    .eq('attendance_status', 'present')

  // if this fails, the report still shows, just without attendance
  if (error) {
    console.error('Could not load attendance for reports:', error.message)
    return []
  }

  const keys: string[] = []
  for (const row of data as unknown as AttendanceRow[]) {
    if (row.sessions && row.sessions.program_years && row.registrations) {
      const key = row.sessions.program_years.name + '|' + row.registrations.family_id
      if (!keys.includes(key)) {
        keys.push(key)
      }
    }
  }

  return keys
}

// gets every family enrolled in each program year, with their county, status, parents and scholars
async function loadFamilyRows(): Promise<FamilyReportRow[] | null> {
  const { data, error } = await supabase
    .from('family_program_years')
    .select(`
      program_years ( name ),
      families (
        id, family_name, county, status,
        parents ( id ),
        scholars ( id )
      )
    `)

  if (error) {
    console.error('Could not load families for reports:', error.message)
    return null
  }

  const attendedKeys = await loadAttendedKeys()
  const rows: FamilyReportRow[] = []

  for (const row of data as unknown as EnrollmentRow[]) {
    if (!row.families || !row.program_years) {
      continue
    }

    const family = row.families
    const year = row.program_years.name

    let county = noCounty
    if (family.county) {
      county = family.county
    }

    rows.push({
      programYear: year,
      familyId: family.id,
      familyName: family.family_name,
      county: county,
      status: family.status,
      parentCount: family.parents.length,
      scholarCount: family.scholars.length,
      attended: attendedKeys.includes(year + '|' + family.id),
    })
  }

  return rows
}

// puts families in A to Z order
function byFamilyName(a: FamilyReportRow, b: FamilyReportRow): number {
  return a.familyName.localeCompare(b.familyName)
}

// biggest group first, then A to Z, with 'Not set' always last
function byFamiliesThenName(a: GroupSummary, b: GroupSummary): number {
  if (a.name === noCounty) {
    return 1
  }
  if (b.name === noCounty) {
    return -1
  }
  if (a.families !== b.families) {
    return b.families - a.families
  }
  return a.name.localeCompare(b.name)
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// what percent one number is of another, rounded; 0 if there's nothing to divide by
function percentOf(part: number, whole: number): number {
  if (whole === 0) {
    return 0
  }
  return Math.round((part / whole) * 100)
}

// '1 family' or '3 families'
function familyWord(count: number): string {
  if (count === 1) {
    return '1 family'
  }
  return count + ' families'
}

// gets every program year in the data; newest first
function getProgramYears(): string[] {
  const years: string[] = []

  for (const row of familyRows) {
    if (!years.includes(row.programYear)) {
      years.push(row.programYear)
    }
  }

  years.sort()
  years.reverse()
  return years
}

// gets every county in the data, A to Z, with 'Not set' last
function getCounties(): string[] {
  const counties: string[] = []
  let hasNoCounty = false

  for (const row of familyRows) {
    if (row.county === noCounty) {
      hasNoCounty = true
    } else if (!counties.includes(row.county)) {
      counties.push(row.county)
    }
  }

  counties.sort()
  if (hasNoCounty) {
    counties.push(noCounty)
  }
  return counties
}

// one dropdown option for each value
function options(values: string[]): string {
  let html = ''

  for (const value of values) {
    html += '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'
  }

  return html
}

// gets the value of one dropdown
function pickedValue(id: string): string {
  return document.querySelector<HTMLSelectElement>(id)!.value
}

// keeps only the families that match the year, county, and status
function filterFamilies(year: string, county: string, status: string): FamilyReportRow[] {
  const matches: FamilyReportRow[] = []

  for (const row of familyRows) {
    if (row.programYear !== year) {
      continue
    }
    if (county !== 'all' && row.county !== county) {
      continue
    }
    if (status !== 'all' && row.status !== status) {
      continue
    }
    matches.push(row)
  }

  matches.sort(byFamilyName)
  return matches
}

// adds up families, attendance, parents, and scholars for each county (or each status)
function getGroups(rows: FamilyReportRow[], groupBy: string): GroupSummary[] {
  const groups: GroupSummary[] = []

  for (const row of rows) {
    let name = row.county
    if (groupBy === 'status') {
      name = capitalize(row.status)
    }

    // find this group, or make a new one
    let group: GroupSummary | null = null
    for (const existing of groups) {
      if (existing.name === name) {
        group = existing
      }
    }

    if (!group) {
      group = { name: name, families: 0, attended: 0, parents: 0, scholars: 0 }
      groups.push(group)
    }

    group.families += 1
    group.parents += row.parentCount
    group.scholars += row.scholarCount
    if (row.attended) {
      group.attended += 1
    }
  }

  groups.sort(byFamiliesThenName)
  return groups
}

// adds every group together for the Total row
function getTotal(groups: GroupSummary[]): GroupSummary {
  const total: GroupSummary = { name: 'Total', families: 0, attended: 0, parents: 0, scholars: 0 }

  for (const group of groups) {
    total.families += group.families
    total.attended += group.attended
    total.parents += group.parents
    total.scholars += group.scholars
  }

  return total
}

// how many different counties are in the rows (not counting 'Not set')
function countCounties(rows: FamilyReportRow[]): number {
  const counties: string[] = []

  for (const row of rows) {
    if (row.county !== noCounty && !counties.includes(row.county)) {
      counties.push(row.county)
    }
  }

  return counties.length
}

// what the filters are set to like 'Adams county · Active families only'
function filtersInWords(): string {
  const county = pickedValue('#report-county')
  const status = pickedValue('#report-status')

  let words = 'All counties'
  if (county !== 'all') {
    words = county + ' county'
  }

  if (status === 'all') {
    words += ' · Active and inactive families'
  } else {
    words += ' · ' + capitalize(status) + ' families only'
  }

  return words
}

// the big number and one plain sentence at the top, ready to quote in a report
function headline(year: string, total: GroupSummary, counties: number): string {
  let countyWords = 'across ' + counties + ' counties'
  if (counties === 1) {
    countyWords = 'in 1 county'
  }

  let noun = 'families'
  if (total.families === 1) {
    noun = 'family'
  }

  return `
    <section class="report-headline">
      <p class="headline-number">${total.families}</p>
      <div>
        <p class="headline-title">${noun} served in ${escapeHtml(year)}</p>
        <p class="headline-sentence">
          ${countyWords} · ${total.attended} of ${total.families} came to at least one session
        </p>
        <p class="headline-filters">${escapeHtml(filtersInWords())}</p>
      </div>
    </section>
  `
}

// horizontal bars, one for each group; the dark part is families who attended, the light part is families who haven't yet
function breakdownChart(groups: GroupSummary[], groupLabel: string): string {
  // the longest bar fills the track, the others are sized to match
  let largest = 1
  for (const group of groups) {
    if (group.families > largest) {
      largest = group.families
    }
  }

  let rows = ''
  for (const group of groups) {
    const notYet = group.families - group.attended
    const attendedWidth = (group.attended / largest) * 100
    const notYetWidth = (notYet / largest) * 100

    let attendedPart = ''
    if (group.attended > 0) {
      attendedPart = '<span class="bar-part attended" style="width: ' + attendedWidth + '%;" title="' +
        escapeHtml(group.name) + ': ' + familyWord(group.attended) + ' attended"></span>'
    }

    let notYetPart = ''
    if (notYet > 0) {
      notYetPart = '<span class="bar-part not-yet" style="width: ' + notYetWidth + '%;" title="' +
        escapeHtml(group.name) + ': ' + familyWord(notYet) + ' not yet"></span>'
    }

    rows += `
      <li class="bar-row">
        <span class="bar-label">${escapeHtml(group.name)}</span>
        <span class="bar-track">${attendedPart}${notYetPart}</span>
        <span class="bar-value"><strong>${group.families}</strong> · ${percentOf(group.attended, group.families)}% attended</span>
      </li>
    `
  }

  return `
    <section class="chart-panel">
      <div class="panel-heading">
        <div>
          <h3>Families by ${groupLabel.toLowerCase()}</h3>
          <p>Each bar is one ${groupLabel.toLowerCase()}, split by whether the family has come to a session yet.</p>
        </div>
        <ul class="chart-legend">
          <li><span class="legend-key attended"></span>Attended</li>
          <li><span class="legend-key not-yet"></span>Not yet</li>
        </ul>
      </div>
      <ul class="bar-chart">${rows}</ul>
    </section>
  `
}

// big ring showing what share of families came to at least one session
function participationChart(total: GroupSummary): string {
  const percent = percentOf(total.attended, total.families)
  const notYet = total.families - total.attended

  // a thin white gap where the two parts meet, so they read as separate
  let ring = 'var(--chart-attended) 0% 100%'
  if (percent === 0) {
    ring = 'var(--chart-not-yet) 0% 100%'
  } else if (percent < 100) {
    ring = 'var(--chart-attended) 0% ' + (percent - 0.6) + '%, #fff ' + (percent - 0.6) + '% ' + percent + '%, ' +
      'var(--chart-not-yet) ' + percent + '% 99.4%, #fff 99.4% 100%'
  }

  return `
    <section class="chart-panel">
      <div class="panel-heading">
        <div>
          <h3>Participation</h3>
          <p>Families who came to at least one session this year.</p>
        </div>
      </div>
      <div class="ring-wrap">
        <div class="ring" style="background: conic-gradient(${ring});" role="img"
          aria-label="${percent}% of families attended at least one session">
          <div class="ring-hole">
            <span class="ring-percent">${percent}%</span>
            <span class="ring-label">attended</span>
          </div>
        </div>
        <ul class="chart-legend stacked">
          <li><span class="legend-key attended"></span>Attended <strong>${total.attended}</strong></li>
          <li><span class="legend-key not-yet"></span>Not yet <strong>${notYet}</strong></li>
        </ul>
      </div>
    </section>
  `
}

// shows the Families Served report for the picked filters
function showFamiliesServed(): void {
  const year = pickedValue('#report-year')
  const groupBy = pickedValue('#report-group')
  const reportContent = document.querySelector<HTMLElement>('#report-content')!

  shownRows = filterFamilies(year, pickedValue('#report-county'), pickedValue('#report-status'))
  shownGroups = getGroups(shownRows, groupBy)
  const total = getTotal(shownGroups)

  // only show "Clear filters" when a filter is on
  const filtersOn = pickedValue('#report-county') !== 'all' || pickedValue('#report-status') !== 'all'
  document.querySelector<HTMLButtonElement>('#report-clear')!.hidden = !filtersOn

  let groupLabel = 'County'
  if (groupBy === 'status') {
    groupLabel = 'Status'
  }

  if (shownRows.length === 0) {
    reportContent.innerHTML = '<p class="empty-state">No families match these filters. Try "Clear filters".</p>'
    return
  }

  reportContent.innerHTML = `
    ${headline(year, total, countCounties(shownRows))}
    <div class="chart-grid">
      ${breakdownChart(shownGroups, groupLabel)}
      ${participationChart(total)}
    </div>
    <p class="report-footnote">"Attended" means the family came to at least one session in the program year.</p>
  `
}

// sets County and Family status back to all
function clearFilters(): void {
  document.querySelector<HTMLSelectElement>('#report-county')!.value = 'all'
  document.querySelector<HTMLSelectElement>('#report-status')!.value = 'all'
  showFamiliesServed()
}

// loads the data, then fills in the tab
async function startReportsTab(): Promise<void> {
  reportsSection.innerHTML = titleAndIntro + '<p class="attendance-intro">Loading reports...</p>'

  const rows = await loadFamilyRows()

  if (rows === null) {
    reportsSection.innerHTML = titleAndIntro + '<p class="empty-state">Could not load reports right now. Please try again later.</p>'
    return
  }

  familyRows = rows
  const programYears = getProgramYears()

  if (programYears.length === 0) {
    reportsSection.innerHTML = titleAndIntro + '<p class="empty-state">No families have been enrolled yet.</p>'
    return
  }

  // report tabs, one toolbar, and empty spot for the report
  reportsSection.innerHTML = titleAndIntro + `
    <nav class="report-tabs no-print" aria-label="Reports">
      <button type="button" class="report-tab active" aria-current="page">Families Served</button>
      <button type="button" class="report-tab" disabled title="Coming soon">Parent Engagement</button>
      <button type="button" class="report-tab" disabled title="Coming soon">Scholars by School Type</button>
    </nav>

    <div class="report-toolbar no-print">
      <div class="toolbar-fields">
        <label class="toolbar-field">
          <span>Program year</span>
          <select id="report-year">${options(programYears)}</select>
        </label>

        <label class="toolbar-field">
          <span>Break down by</span>
          <select id="report-group">
            <option value="county">County</option>
            <option value="status">Family status</option>
          </select>
        </label>

        <span class="toolbar-divider" aria-hidden="true"></span>

        <label class="toolbar-field">
          <span>County</span>
          <select id="report-county">
            <option value="all">All counties</option>
            ${options(getCounties())}
          </select>
        </label>

        <label class="toolbar-field">
          <span>Family status</span>
          <select id="report-status">
            <option value="all">Active and inactive</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </label>

        <button type="button" id="report-clear" class="link-button" hidden>Clear filters</button>
      </div>
    </div>

    <div id="report-content" class="report-content"></div>
  `

  showFamiliesServed()

  // update the report when any dropdown changes
  document.querySelector<HTMLSelectElement>('#report-year')!.addEventListener('change', showFamiliesServed)
  document.querySelector<HTMLSelectElement>('#report-group')!.addEventListener('change', showFamiliesServed)
  document.querySelector<HTMLSelectElement>('#report-county')!.addEventListener('change', showFamiliesServed)
  document.querySelector<HTMLSelectElement>('#report-status')!.addEventListener('change', showFamiliesServed)
  document.querySelector<HTMLButtonElement>('#report-clear')!.addEventListener('click', clearFilters)
}

// open/close the reports tab
function showReports(show: boolean): void {
  reportsSection.hidden = !show

  if (show) {
    sessionDashboard.style.display = 'none'
  }
}

// open the tab when the url ends with #reports
function syncReports(): void {
  showReports(window.location.hash === '#reports')
}

window.addEventListener('hashchange', syncReports)
syncReports()

// load the data and fill in the tab
startReportsTab()