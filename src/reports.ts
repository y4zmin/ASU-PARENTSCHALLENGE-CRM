/*
Reports & Analytics tab for the staff dashboard.
Staff pick a report, filter it, and export it to Excel.
*/

import './attendance.css'

const reportsSection = document.querySelector<HTMLElement>('#reports-section')!

const sessionDashboard = document.querySelector<HTMLElement>('#events-dashboard')!

const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a[href]')

// title and intro at the top of the tab
const titleAndIntro = `
  <h2 class="attendance-title">Reports & Analytics</h2>
  <p class="attendance-intro">Pick a report, filter it, and export it to Excel.</p>
`

// fills in the tab
function startReportsTab(): void {
  reportsSection.innerHTML = titleAndIntro
}

// open/close the reports tab
function showReports(show: boolean): void {
  reportsSection.hidden = !show

  if (show) {
    sessionDashboard.style.display = 'none'
  }

  // only change our own link, so other tabs keep theirs
  for (const link of navLinks) {
    if (link.dataset.tab === 'reports') {
      if (show) {
        link.classList.add('active')
      } else {
        link.classList.remove('active')
      }
    }
  }
}

// runs when nav link clicked
function handleNavClick(event: Event): void {
  const clickedLink = event.currentTarget as HTMLAnchorElement
  showReports(clickedLink.dataset.tab === 'reports')
}

// run handleNavClick if any nav link is clicked
for (const link of navLinks) {
  link.addEventListener('click', handleNavClick)
}

// open tab if url ends with #reports
showReports(window.location.hash === '#reports')

// fill in the tab
startReportsTab()