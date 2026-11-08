import './events.css'
import { supabase } from './supabase'

type Session = {
  id: number
  title: string
  type: string
  date: string
  time: string
  capacity: number
  registered: number
  status: string
}

let sessions: Session[] = []

const statusColors: Record<string, string> = {
  scheduled: '#4f8a5b',
  completed: '#2563eb',
  cancelled: '#b91c1c',
}

const { data: activeRole, error: roleError } = await supabase.rpc(
  'get_active_role'
)

if (roleError || !activeRole) {
  console.error('Could not load active role.')
}

const canManageSessions =
  activeRole === 'admin' || activeRole === 'staff'

async function loadSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
    id,
    title,
   session_date,
   start_time,
   capacity,
   status,
   session_types!sessions_session_type_id_fkey (
    name
    )
    `)
    .order('session_date', { ascending: true })

  if (error) {
    console.error('Could not load sessions:', error.message)
    return
  }

sessions = (data ?? []).map((session) => {
  const sessionType = session.session_types as unknown as
    | { name: string }
    | { name: string }[]
    | null

  return {
    id: session.id,
    title: session.title,
    type: Array.isArray(sessionType)
      ? sessionType[0]?.name ?? 'Session'
      : sessionType?.name ?? 'Session',
    date: session.session_date ?? '',
    time: session.start_time ?? '',
    capacity: session.capacity ?? 0,
    registered: 0,
    status: session.status ?? 'scheduled',
  }
})
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}


function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(time: string): string {
  if (!time) return ''

  const [hourString, minute] = time.split(':')
  const hour = Number(hourString)

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minute} ${period}`
}

function buildSummaryCards() {
  return `
    <div class="events-summary">
      <div class="summary-card">
        <span class="summary-label">Total Sessions</span>
        <strong>${sessions.length}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Scheduled</span>
        <strong>${sessions.filter((s) => s.status === 'scheduled').length}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Completed</span>
        <strong>${sessions.filter((s) => s.status === 'completed').length}</strong>
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
          <td>${formatTime(session.time)}</td>
          <td>${session.registered} / ${session.capacity}</td>
          <td>
            <span
              class="status-pill"
              style="background-color: ${statusColors[session.status]};"
            >
              ${formatStatus(session.status)}
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
      ${canManageSessions
      ? '<button class="primary-btn" id="create-event-btn">Create Event</button>'
      : ''
}
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
                <option value="1">In-Person</option>
                <option value="2">Lunch and Learn</option>
                <option value="3">Evening Virtual</option>
                <option value="4">Community event</option>
                <option value="5">Mandatory</option>
                <option value="6">Platinum/Volunteer</option>
                <option value="7">Other</option>
                <option value="8">Nurturing Fathers</option>
                <option value="9">Owning Your Life</option>
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
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
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
  form?.addEventListener('submit', async (event) => {
    event.preventDefault()

    const formData = new FormData(form)
    const title = String(formData.get('title') ?? '').trim()
    const sessionTypeId = Number(formData.get('type'))
    const date = String(formData.get('date') ?? '')
    const time = String(formData.get('time') ?? '')
    const capacity = Number(formData.get('capacity') ?? 20)
    const status = String(formData.get('status') ?? 'scheduled') as Session['status']


    if (!title || !date || !time) return

  const { data: newSessionId, error: createError } =
  await supabase.rpc('create_session', {
  p_title: title,
  p_session_type_id: sessionTypeId,
  p_session_date: date,
  p_start_time: time,
  p_capacity: capacity,
  p_status: status,
  })

  if (createError) {
    console.error(
    'Could not create session:',
    createError.message
  )
  return
  }

  console.log(
  'Session created successfully:',
  newSessionId
)

  modal.remove()

  await loadSessions()
  renderDashboard()
  })
}

await loadSessions()
renderDashboard()