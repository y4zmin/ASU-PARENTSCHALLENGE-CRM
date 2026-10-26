import './events.css'

type Session = {
  id: number
  title: string
  type: string
  date: string
  time: string
  capacity: number
  registered: number
  status: 'Open' | 'Full' | 'Cancelled' | 'In Progress'
}

const sessions: Session[] = [
  {
    id: 1,
    title: 'Lunch & Learn: Family Budgeting',
    type: 'Lunch & Learn',
    date: '2026-10-14',
    time: '12:00 PM',
    capacity: 40,
    registered: 31,
    status: 'Open',
  },
  {
    id: 2,
    title: 'Parent Orientation',
    type: 'Mandatory',
    date: '2026-10-18',
    time: '5:30 PM',
    capacity: 60,
    registered: 60,
    status: 'Full',
  },
  {
    id: 3,
    title: 'STEM Workshop for Scholars',
    type: 'In-person',
    date: '2026-10-21',
    time: '4:00 PM',
    capacity: 25,
    registered: 18,
    status: 'Open',
  },
  {
    id: 4,
    title: 'Virtual Family Support Session',
    type: 'Virtual',
    date: '2026-10-24',
    time: '6:00 PM',
    capacity: 30,
    registered: 22,
    status: 'Open',
  },
  {
    id: 5,
    title: 'Community Resource Fair',
    type: 'Community event',
    date: '2026-10-28',
    time: '10:00 AM',
    capacity: 80,
    registered: 74,
    status: 'In Progress',
  },
  {
    id: 6,
    title: 'Scholar Success Check-In',
    type: 'Platinum',
    date: '2026-10-30',
    time: '3:30 PM',
    capacity: 20,
    registered: 20,
    status: 'Full',
  },
]
const statusColors: Record<string, string> = {
  Open: '#4f8a5b',
  Full: '#d97706',
  Cancelled: '#b91c1c',
  'In Progress': '#2563eb',
}

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const dashboard = document.querySelector<HTMLElement>('#events-dashboard')

if (!dashboard) {
  throw new Error('Events dashboard container not found')
}

dashboard.innerHTML = `
  <div class="events-header">
    <h2>Session Dashboard</h2>
    <button class="primary-btn">Create Event</button>
  </div>

  <div class="events-summary">
    <div class="summary-card">
      <span class="summary-label">Total Sessions</span>
      <strong>${sessions.length}</strong>
    </div>
    <div class="summary-card">
      <span class="summary-label">Open</span>
      <strong>${sessions.filter((s) => s.status === 'Open').length}</strong>
    </div>
    <div class="summary-card">
      <span class="summary-label">Full</span>
      <strong>${sessions.filter((s) => s.status === 'Full').length}</strong>
    </div>
    <div class="summary-card">
      <span class="summary-label">Registrations</span>
      <strong>${sessions.reduce((sum, s) => sum + s.registered, 0)}</strong>
    </div>
  </div>

  <div class="table-wrapper">
    <table class="events-table">
      <thead>
        <tr>
          <th>Session</th>
          <th>Type</th>
          <th>Date</th>
          <th>Time</th>
          <th>Capacity</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${sessions
          .map(
            (session) => `
              <tr>
                <td>
                  <div class="session-name">${session.title}</div>
                </td>
                <td>${session.type}</td>
                <td>${formatDate(session.date)}</td>
                <td>${session.time}</td>
                <td>${session.registered} / ${session.capacity}</td>
                <td>
                  <span
                    class="status-pill"
                    style="background-color: ${statusColors[session.status]};"
                  >
                    ${session.status}
                  </span>
                </td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  </div>
`