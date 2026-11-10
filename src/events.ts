import './events.css'
import { supabase } from './supabase'

type Session = {
  id: number
  title: string
  type: string
  sessionTypeId: number
  date: string
  time: string
  capacity: number
  registered: number
  status: string
}

type SessionTypeRecord =
  | { name: string }
  | { name: string }[]
  | null

let sessions: Session[] = []

const statusColors: Record<string, string> = {
  scheduled: '#4f8a5b',
  completed: '#2563eb',
  cancelled: '#b91c1c',
}

const sessionTypes = [
  { id: 1, name: 'In-Person' },
  { id: 2, name: 'Lunch and Learn' },
  { id: 3, name: 'Evening Virtual' },
  { id: 4, name: 'Community event' },
  { id: 5, name: 'Mandatory' },
  { id: 6, name: 'Platinum/Volunteer' },
  { id: 7, name: 'Other' },
  { id: 8, name: 'Nurturing Fathers' },
  { id: 9, name: 'Owning Your Life' },
]

const { data: activeRole, error: roleError } = await supabase.rpc(
  'get_active_role'
)

if (roleError || !activeRole) {
  console.error('Could not load active role:', roleError?.message)
}

const canManageSessions =
  activeRole === 'admin' || activeRole === 'staff'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return entities[character]
  })
}

async function loadSessions(): Promise<void> {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      title,
      session_type_id,
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
    const sessionType = session.session_types as unknown as SessionTypeRecord

    const typeName = Array.isArray(sessionType)
      ? sessionType[0]?.name
      : sessionType?.name

    return {
      id: session.id,
      title: session.title,
      type: typeName ?? 'Session',
      sessionTypeId: session.session_type_id,
      date: session.session_date ?? '',
      time: session.start_time ?? '',
      capacity: session.capacity ?? 0,
      registered: 0,
      status: session.status ?? 'scheduled',
    }
  })
}

function formatStatus(status: string): string {
  if (!status) return 'Unknown'

  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDate(date: string): string {
  if (!date) return ''

  const parsedDate = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) return date

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(time: string): string {
  if (!time) return ''

  const [hourString, minute] = time.split(':')
  const hour = Number(hourString)

  if (!Number.isFinite(hour) || minute === undefined) return time

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minute} ${period}`
}

function buildSummaryCards(): string {
  return `
    <div class="events-summary">
      <div class="summary-card">
        <span class="summary-label">Total Sessions</span>
        <strong>${sessions.length}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Scheduled</span>
        <strong>${sessions.filter((session) => session.status === 'scheduled').length}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Completed</span>
        <strong>${sessions.filter((session) => session.status === 'completed').length}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Registrations</span>
        <strong>${sessions.reduce((total, session) => total + session.registered, 0)}</strong>
      </div>
    </div>
  `
}

function buildTableRows(): string {
  return sessions
    .map((session) => {
      const safeTitle = escapeHtml(session.title)
      const safeType = escapeHtml(session.type)
      const safeStatus = escapeHtml(formatStatus(session.status))
      const statusColor = statusColors[session.status] ?? '#64748b'

      return `
        <tr>
          <td>
            <div class="session-name">${safeTitle}</div>
          </td>
          <td>${safeType}</td>
          <td>${formatDate(session.date)}</td>
          <td>${formatTime(session.time)}</td>
          <td>${session.registered} / ${session.capacity}</td>
          <td>
            <span
              class="status-pill"
              style="background-color: ${statusColor};"
            >
              ${safeStatus}
            </span>
          </td>
          ${
            canManageSessions
              ? `
                <td>
                  <button
                    class="secondary-btn edit-session-btn"
                    type="button"
                    data-session-id="${session.id}"
                    aria-label="Edit ${safeTitle}"
                  >
                    Edit
                  </button>
                </td>
              `
              : ''
          }
        </tr>
      `
    })
    .join('')
}

function renderDashboard(): void {
  const dashboard =
    document.querySelector<HTMLElement>('#events-dashboard')

  if (!dashboard) {
    console.error('Events dashboard container not found.')
    return
  }

  dashboard.innerHTML = `
    <div class="events-header">
      <h2>Session Dashboard</h2>
      ${
        canManageSessions
          ? '<button class="primary-btn" id="create-event-btn" type="button">Create Event</button>'
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
            ${canManageSessions ? '<th>Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${buildTableRows()}
        </tbody>
      </table>
    </div>
  `

  dashboard
    .querySelector<HTMLButtonElement>('#create-event-btn')
    ?.addEventListener('click', () => openSessionModal())

  dashboard
    .querySelector<HTMLTableSectionElement>('tbody')
    ?.addEventListener('click', (event) => {
      const target = event.target

      if (!(target instanceof HTMLElement)) return

      const editButton = target.closest<HTMLButtonElement>(
        '.edit-session-btn'
      )

      if (!editButton) return

      const sessionId = Number(editButton.dataset.sessionId)
      const session = sessions.find((item) => item.id === sessionId)

      if (session) {
        openSessionModal(session)
      }
    })
}

function openSessionModal(session?: Session): void {
  const dashboard =
    document.querySelector<HTMLElement>('#events-dashboard')

  if (!dashboard) return

  const isEditing = session !== undefined
  const modal = document.createElement('div')
  modal.className = 'event-modal-overlay'

  const selectedTypeId = session?.sessionTypeId ?? sessionTypes[0].id
  const selectedStatus = session?.status ?? 'scheduled'
  const timeForInput = session?.time ? session.time.slice(0, 5) : ''

  modal.innerHTML = `
    <div
      class="event-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
    >
      <div class="event-modal-header">
        <h3 id="event-modal-title">
          ${isEditing ? 'Edit Session' : 'Create Event'}
        </h3>
        <button
          class="close-modal-btn"
          type="button"
          aria-label="Close"
        >×</button>
      </div>

      <form id="event-form">
        <div class="form-grid">
          <label>
            Event Title
            <input
              type="text"
              name="title"
              required
              maxlength="150"
              placeholder="Enter event title"
              value="${escapeHtml(session?.title ?? '')}"
            />
          </label>

          <label>
            Event Type
            <select name="type" required>
              ${sessionTypes
                .map(
                  (type) => `
                    <option
                      value="${type.id}"
                      ${type.id === selectedTypeId ? 'selected' : ''}
                    >
                      ${escapeHtml(type.name)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              name="date"
              required
              value="${escapeHtml(session?.date ?? '')}"
            />
          </label>

          <label>
            Time
            <input
              type="time"
              name="time"
              required
              value="${escapeHtml(timeForInput)}"
            />
          </label>

          <label>
            Capacity
            <input
              type="number"
              name="capacity"
              min="1"
              required
              value="${session?.capacity ?? 20}"
            />
          </label>

          <label>
            Status
            <select name="status" required>
              <option
                value="scheduled"
                ${selectedStatus === 'scheduled' ? 'selected' : ''}
              >
                Scheduled
              </option>
              <option
                value="completed"
                ${selectedStatus === 'completed' ? 'selected' : ''}
              >
                Completed
              </option>
              <option
                value="cancelled"
                ${selectedStatus === 'cancelled' ? 'selected' : ''}
              >
                Cancelled
              </option>
            </select>
          </label>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="secondary-btn close-modal-btn"
          >
            Cancel
          </button>
          <button type="submit" class="primary-btn">
            ${isEditing ? 'Save Changes' : 'Save Event'}
          </button>
        </div>
      </form>
    </div>
  `

  dashboard.appendChild(modal)

  modal
    .querySelectorAll<HTMLButtonElement>('.close-modal-btn')
    .forEach((button) => {
      button.addEventListener('click', () => modal.remove())
    })

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove()
  })

  const form = modal.querySelector<HTMLFormElement>('#event-form')

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()

    const formData = new FormData(form)
    const title = String(formData.get('title') ?? '').trim()
    const sessionTypeId = Number(formData.get('type'))
    const date = String(formData.get('date') ?? '')
    const time = String(formData.get('time') ?? '')
    const capacity = Number(formData.get('capacity'))
    const status = String(formData.get('status') ?? 'scheduled')

    if (!title || !date || !time || capacity < 1) {
      alert('Please complete all fields with valid values.')
      return
    }

    const submitButton =
      form.querySelector<HTMLButtonElement>('button[type="submit"]')

    if (submitButton) {
      submitButton.disabled = true
      submitButton.textContent = isEditing ? 'Saving…' : 'Creating…'
    }

    if (session) {
      const { data, error } = await supabase
        .from('sessions')
        .update({
          title,
          session_type_id: sessionTypeId,
          session_date: date,
          start_time: time,
          capacity,
          status,
        })
        .eq('id', session.id)
        .select('id')
        .maybeSingle()

      if (error || !data) {
        console.error('Could not update session:', error?.message)
        alert(
          'The session could not be updated. Please check your permissions and try again.'
        )

        if (submitButton) {
          submitButton.disabled = false
          submitButton.textContent = 'Save Changes'
        }

        return
      }
    } else {
      const { error } = await supabase.rpc('create_session', {
        p_title: title,
        p_session_type_id: sessionTypeId,
        p_session_date: date,
        p_start_time: time,
        p_capacity: capacity,
        p_status: status,
      })

      if (error) {
        console.error('Could not create session:', error.message)
        alert('The event could not be created. Please try again.')

        if (submitButton) {
          submitButton.disabled = false
          submitButton.textContent = 'Save Event'
        }

        return
      }
    }

    modal.remove()
    await loadSessions()
    renderDashboard()
  })
}

await loadSessions()
renderDashboard()