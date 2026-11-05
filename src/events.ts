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

let sessions: Session[] = [
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

function buildSummaryCards() {
  return `
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
  `
}

function buildTableRows() {
  return sessions
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
    .join('')
}

function renderDashboard() {
  const dashboard = document.querySelector<HTMLElement>('#events-dashboard')

  if (!dashboard) return

  dashboard.innerHTML = `
    <div class="events-header">
      <h2>Session Dashboard</h2>
      <button class="primary-btn" id="create-event-btn">Create Event</button>
    </div>

    ${buildSummaryCards()}

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
          ${buildTableRows()}
        </tbody>
      </table>
    </div>
  `

  const createButton = document.querySelector<HTMLButtonElement>('#create-event-btn')
  createButton?.addEventListener('click', openCreateEventModal)
}

function openCreateEventModal() {
  const dashboard = document.querySelector<HTMLElement>('#events-dashboard')
  if (!dashboard) return

  const modal = document.createElement('div')
  modal.className = 'event-modal-overlay'

  modal.innerHTML = `
    <div class="event-modal">
      <div class="event-modal-header">
        <h3>Create Event</h3>
        <button class="close-modal-btn" type="button" aria-label="Close">×</button>
      </div>

      <form id="event-form">
        <div class="form-grid">
          <label>
            Event Title
            <input type="text" name="title" required placeholder="Enter event title" />
          </label>

          <label>
            Event Type
            <select name="type">
              <option>Lunch & Learn</option>
              <option>Mandatory</option>
              <option>In-person</option>
              <option>Virtual</option>
              <option>Community event</option>
              <option>Platinum</option>
            </select>
          </label>

          <label>
            Date
            <input type="date" name="date" required />
          </label>

          <label>
            Time
            <input type="text" name="time" required placeholder="e.g. 5:30 PM" />
          </label>

          <label>
            Capacity
            <input type="number" name="capacity" min="1" required value="20" />
          </label>

          <label>
            Status
            <select name="status">
              <option>Open</option>
              <option>Full</option>
              <option>In Progress</option>
              <option>Cancelled</option>
            </select>
          </label>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary-btn close-modal-btn">Cancel</button>
          <button type="submit" class="primary-btn">Save Event</button>
        </div>
      </form>
    </div>
  `

  dashboard.appendChild(modal)

  const closeButtons = modal.querySelectorAll('.close-modal-btn')
  closeButtons.forEach((button) => {
    button.addEventListener('click', () => modal.remove())
  })

  const form = modal.querySelector<HTMLFormElement>('#event-form')
  form?.addEventListener('submit', (event) => {
    event.preventDefault()

    const formData = new FormData(form)
    const title = String(formData.get('title') ?? '').trim()
    const type = String(formData.get('type') ?? 'Lunch & Learn')
    const date = String(formData.get('date') ?? '')
    const time = String(formData.get('time') ?? '')
    const capacity = Number(formData.get('capacity') ?? 20)
    const status = String(formData.get('status') ?? 'Open') as Session['status']

    if (!title || !date || !time) return

    sessions = [
      {
        id: Date.now(),
        title,
        type,
        date,
        time,
        capacity,
        registered: 0,
        status,
      },
      ...sessions,
    ]

    modal.remove()
    renderDashboard()
  })
}

renderDashboard()