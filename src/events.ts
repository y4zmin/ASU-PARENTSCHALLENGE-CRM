import './events.css'
import { supabase } from './supabase'
import { showSessionRegistrationDetails } from './session-registration-details'

type Session = {
  id: number
  title: string
  type: string
  sessionTypeId: number
  date: string
  time: string
  capacity: number | null
  capacitySummary: CapacitySummary | null
  rsvpEnabled: boolean
  waitlistEnabled: boolean
  rsvpCloseHours: number | null
  status: string
}

type CapacitySummary = {
  capacity: number | null
  registered_headcount: number
  available_spots: number | null
  waitlisted_families: number
}

type SessionTypeRecord =
  | { name: string }
  | { name: string }[]
  | null

type ParentRegistration = {
  id: number | string
  sessionId: number
  familyId: number | string
  status: 'registered' | 'waitlisted'
}

let sessions: Session[] = []
let linkedFamilyIds: (number | string)[] = []
let parentRegistrations: ParentRegistration[] = []
let parentRegistrationLoadFailed = false
let cancellationPending = false

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
const canRegisterForSessions = !roleError && activeRole === 'parent'
const canViewRegistrationDetails = !roleError && (canManageSessions || activeRole === 'coordinator')

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
      rsvp_enabled,
      waitlist_enabled,
      rsvp_close_hours,
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
      capacity: session.capacity ?? null,
      capacitySummary: null,
      rsvpEnabled: session.rsvp_enabled !== false,
      waitlistEnabled: session.waitlist_enabled === true,
      rsvpCloseHours: session.rsvp_close_hours ?? null,
      status: session.status ?? 'scheduled',
    }
  })

  if (roleError || !(canManageSessions || canRegisterForSessions || activeRole === 'coordinator')) return
  // The RPC accepts one session ID. Limit the number of concurrent requests.
  for (let offset = 0; offset < sessions.length; offset += 8) {
    await Promise.all(sessions.slice(offset, offset + 8).map(refreshCapacity))
  }
}

async function refreshCapacity(session: Session): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('get_session_capacity_summary', {
      p_session_id: session.id,
    })
    const summary = Array.isArray(data) ? data[0] : undefined
    session.capacitySummary = !error && summary ? summary : null
  } catch {
    session.capacitySummary = null
  }
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
  const registered = sessions.every((session) => session.capacitySummary !== null)
    ? sessions.reduce((total, session) => total + (session.capacitySummary?.registered_headcount ?? 0), 0)
    : 'Unavailable'

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
        <span class="summary-label">Registered attendees</span>
        <strong>${registered}</strong>
      </div>
    </div>
  `
}

async function loadParentRegistrations(): Promise<void> {
  try {
    const { data: familyIds, error: familyError } = await supabase.rpc('get_current_user_family_ids')
    if (familyError || !Array.isArray(familyIds) || !familyIds.every(isFamilyId)) {
      parentRegistrationLoadFailed = true
      return
    }
    linkedFamilyIds = familyIds
    if (linkedFamilyIds.length === 0) return

    const { data, error } = await supabase
      .from('registrations')
      .select('id, session_id, family_id, registration_status')
      .in('family_id', linkedFamilyIds)
      .in('registration_status', ['registered', 'waitlisted'])

    if (error || !data) {
      parentRegistrationLoadFailed = true
      return
    }

    parentRegistrations = data.flatMap((row) => {
      if (!isFamilyId(row.id) || !isFamilyId(row.family_id) ||
          !linkedFamilyIds.some((id) => String(id) === String(row.family_id)) ||
          (row.registration_status !== 'registered' && row.registration_status !== 'waitlisted')) return []

      return [{
        id: row.id,
        sessionId: Number(row.session_id),
        familyId: row.family_id,
        status: row.registration_status,
      }]
    })
  } catch {
    parentRegistrationLoadFailed = true
  }
}

function activeRegistrations(sessionId: number): ParentRegistration[] {
  return parentRegistrations.filter((registration) => registration.sessionId === sessionId)
}

function remainingFamilies(registrations: ParentRegistration[]): (number | string)[] {
  return linkedFamilyIds.filter((id) =>
    !registrations.some((registration) => String(registration.familyId) === String(id))
  )
}

function buildTableRows(): string {
  const today = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short' }).format(new Date())

  return sessions
    .map((session) => {
      const safeTitle = escapeHtml(session.title)
      const safeType = escapeHtml(session.type)
      const safeStatus = escapeHtml(formatStatus(session.status))
      const statusColor = statusColors[session.status] ?? '#64748b'
      const summary = session.capacitySummary
      const full = summary?.available_spots === 0
      const registrationAction = full && session.waitlistEnabled ? 'Join Waitlist' : 'Register'
      let registrationUnavailable = ''
      if (session.status !== 'scheduled') {
        registrationUnavailable = 'Registration closed'
      } else if (!session.date) {
        registrationUnavailable = 'Date not set'
      } else if (session.date < today) {
        registrationUnavailable = 'Session date has passed'
      } else if (!session.rsvpEnabled) {
        registrationUnavailable = 'RSVP disabled'
      }
      const capacityLabel = summary
        ? summary.capacity === null
          ? `${summary.registered_headcount} registered · No limit`
          : `${summary.registered_headcount} / ${summary.capacity} · ${summary.available_spots} spots left`
        : 'Capacity unavailable'

      const registrations = canRegisterForSessions ? activeRegistrations(session.id) : []
      const cancellationActions = session.status === 'scheduled' && session.date >= today
        ? registrations.map(({ id, familyId, status }) => {
          const action = status === 'waitlisted' ? 'Leave Waitlist' : 'Cancel Registration'
          const label = linkedFamilyIds.length > 1 ? `${action} (Family ${familyId})` : action
          return `<button class="secondary-btn cancel-registration-btn" type="button" data-registration-id="${id}" aria-label="${label} for ${safeTitle}">${label}</button>`
        }).join(' ')
        : ''
      const offerRegistration = registrations.length === 0 || remainingFamilies(registrations).length > 0

      return `
        <tr>
          <td>
            ${canViewRegistrationDetails
              ? `<button type="button" class="session-details-btn" aria-haspopup="dialog" data-session-id="${session.id}">${safeTitle}</button>`
              : `<div class="session-name">${safeTitle}</div>`}
          </td>
          <td>${safeType}</td>
          <td>${formatDate(session.date)}</td>
          <td>${formatTime(session.time)}</td>
          <td>
            ${capacityLabel}
            ${summary && summary.waitlisted_families > 0
              ? `<br><small>Waitlisted families: ${summary.waitlisted_families}</small>`
              : ''}
          </td>
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
          ${
            canRegisterForSessions
              ? `
                <td>
                  ${cancellationActions}
                  ${offerRegistration || !cancellationActions
                    ? registrationUnavailable || `<button class="secondary-btn register-session-btn" type="button" data-session-id="${session.id}" aria-label="${registrationAction} for ${safeTitle}">${registrationAction}</button>`
                    : ''}
                </td>
              `
              : ''
          }
        </tr>
      `
    })
    .join('')
}

function renderDashboard(registrationMessage = ''): void {
  const message = registrationMessage || (parentRegistrationLoadFailed
    ? 'Existing registration status could not be loaded. Reload the page to check your bookings.'
    : '')
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

    ${canRegisterForSessions ? `<p id="registration-status" role="status" tabindex="-1">${escapeHtml(message)}</p>` : ''}
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
            ${canManageSessions || canRegisterForSessions ? '<th>Actions</th>' : ''}
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
    ?.addEventListener('click', async (event) => {
      const target = event.target

      if (!(target instanceof HTMLElement)) return

      if (canViewRegistrationDetails) {
        const detailsButton = target.closest<HTMLButtonElement>('.session-details-btn')
        const session = detailsButton && sessions.find((item) => item.id === Number(detailsButton.dataset.sessionId))
        if (session && detailsButton) {
          showSessionRegistrationDetails(session, detailsButton)
          return
        }
      }

      if (canRegisterForSessions) {
        if (cancellationPending) return
        const cancelButton = target.closest<HTMLButtonElement>('.cancel-registration-btn')
        if (cancelButton) {
          const registration = parentRegistrations.find((item) =>
            String(item.id) === cancelButton.dataset.registrationId
          )
          if (registration) await cancelRegistration(registration, cancelButton)
          return
        }

        const registerButton = target.closest<HTMLButtonElement>('.register-session-btn')
        if (registerButton) {
          const session = sessions.find((item) => item.id === Number(registerButton.dataset.sessionId))
          if (!session) return
          const familyIds = remainingFamilies(activeRegistrations(session.id))
          if (familyIds.length > 0) {
            openRegistrationForm(session, familyIds)
          } else {
            alert(parentRegistrationLoadFailed
              ? 'We could not load your linked families. Reload the page and try again.'
              : 'No linked family is available for registration for this session.')
          }
          return
        }
      }

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

async function cancelRegistration(registration: ParentRegistration, button: HTMLButtonElement): Promise<void> {
  const session = sessions.find((item) => item.id === registration.sessionId)
  if (!session || !linkedFamilyIds.some((id) => String(id) === String(registration.familyId))) return

  const subject = `Family ${registration.familyId} for ${session.title}`
  const waitlisted = registration.status === 'waitlisted'
  const question = waitlisted ? `Leave the waitlist for ${subject}?` : `Cancel registration for ${subject}?`
  if (!window.confirm(question)) return

  cancellationPending = true
  button.disabled = true
  const label = button.textContent
  button.textContent = 'Cancelling…'
  try {
    const { data, error } = await supabase.rpc('cancel_registration_and_promote_waitlist', {
      p_registration_id: registration.id,
    })
    const result = Array.isArray(data) ? data[0] : undefined
    if (error || String(result?.cancelled_registration_id) !== String(registration.id)) {
      alert('Cancellation could not be confirmed. Reload the page to check your registration and try again.')
      return
    }

    parentRegistrations = parentRegistrations.filter((item) => item !== registration)
    await refreshCapacity(session)
    renderDashboard(waitlisted ? `Left the waitlist for ${subject}.` : `Registration cancelled for ${subject}.`)
    document.querySelector<HTMLButtonElement>(`.register-session-btn[data-session-id="${session.id}"]`)?.focus()
  } catch {
    alert('Cancellation could not be confirmed. Check your connection and reload the page.')
  } finally {
    button.disabled = false
    button.textContent = label
    cancellationPending = false
  }
}

function isFamilyId(value: unknown): value is number | string {
  return typeof value === 'number'
    ? Number.isSafeInteger(value) && value > 0
    : typeof value === 'string' && /^[1-9]\d*$/.test(value)
}

function openRegistrationForm(session: Session, familyIds: (number | string)[]): void {
  if (document.querySelector('#registration-dialog')) return

  const dialog = document.createElement('dialog')
  dialog.id = 'registration-dialog'
  dialog.className = 'event-modal'
  dialog.setAttribute('aria-labelledby', 'registration-title')

  const attendeeFields = [
    ['adult_count', 'Adults'],
    ['children_under_6_count', 'Children under 6'],
    ['children_6_to_12_count', 'Children ages 6–12'],
    ['children_over_12_count', 'Children over 12'],
  ]

  dialog.innerHTML = `
    <div class="event-modal-header">
      <h3 id="registration-title">Register for ${escapeHtml(session.title)}</h3>
    </div>
    <form novalidate>
      <div class="form-grid">
        <label>
          Family
          <select name="family_id" required>
            ${familyIds.length > 1 ? '<option value="">Select your family</option>' : ''}
            ${familyIds.map((id) => `<option value="${id}">Family ${id}</option>`).join('')}
          </select>
        </label>
        ${attendeeFields.map(([name, label]) => `
          <label>
            ${label}
            <input name="${name}" type="number" min="0" step="1" value="${name === 'adult_count' ? 1 : 0}" required>
          </label>
        `).join('')}
        <label>
          Childcare needed
          <select name="childcare_required">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
        <label>
          Notes (optional)
          <textarea name="notes" rows="3"></textarea>
        </label>
      </div>
      ${session.rsvpCloseHours !== null
        ? `<p>RSVP closes ${session.rsvpCloseHours} hours before the session starts.</p>`
        : ''}
      <p id="registration-error" class="registration-error" role="alert"></p>
      <div class="form-actions">
        <button class="secondary-btn" type="button">Close</button>
        <button class="primary-btn" type="submit">Register</button>
      </div>
    </form>
  `

  const form = dialog.querySelector('form')!
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const close = form.querySelector<HTMLButtonElement>('button[type="button"]')!
  const feedback = form.querySelector<HTMLElement>('#registration-error')!

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submit.disabled) return

    const values = new FormData(form)
    const familyId = familyIds.find((id) => String(id) === values.get('family_id'))
    if (!canRegisterForSessions || familyId === undefined) {
      feedback.textContent = 'Select a family linked to your account.'
      return
    }

    const [adults, under6, ages6to12, over12] = attendeeFields.map(
      ([name]) => {
        const value = values.get(name)
        return typeof value === 'string' && value.trim() ? Number(value) : NaN
      }
    )
    const counts = [adults, under6, ages6to12, over12]
    const total = counts.reduce((sum, count) => sum + count, 0)
    if (counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
        total > 2147483647) {
      feedback.textContent = 'Enter a whole number of 0 or more in each attendee field.'
      return
    }
    if (total === 0) {
      feedback.textContent = 'Add at least one attendee to register. All attendee counts are 0.'
      return
    }

    feedback.textContent = ''
    submit.disabled = true
    close.disabled = true
    submit.textContent = 'Registering…'

    try {
      const { data, error } = await supabase.rpc('register_for_session', {
        p_family_id: familyId,
        p_session_id: session.id,
        p_adult_count: adults,
        p_children_under_6_count: under6,
        p_children_6_to_12_count: ages6to12,
        p_children_over_12_count: over12,
        p_childcare_required: values.get('childcare_required') === 'true',
        p_notes: String(values.get('notes') ?? '').trim() || null,
      })

      if (error) {
        const message = error.message
        if (/permission denied|cannot register another family/i.test(message)) {
          feedback.textContent = 'Your account cannot register this family. Please contact Parents Challenge.'
        } else if (/closed|deadline/i.test(message)) {
          feedback.textContent = 'The RSVP deadline for this session has passed.'
        } else if (/disabled|not found|full/i.test(message)) {
          feedback.textContent = 'Registration is unavailable for this session. Please check the session details.'
        } else {
          feedback.textContent = 'Registration could not be confirmed. Please try again or contact Parents Challenge.'
        }
        return
      }

      const result = Array.isArray(data) ? data[0] : undefined
      const status = result?.registration_status
      if (isFamilyId(result?.registration_id) && (status === 'registered' || status === 'waitlisted')) {
        parentRegistrations.push({ id: result.registration_id, familyId, sessionId: session.id, status })
      }
      const subject = `Family ${familyId} for ${session.title}`
      const position = result?.waitlist_position
      let message = `Could not confirm the registration status for ${subject}. Please contact Parents Challenge.`
      if (status === 'registered') {
        message = `Registration confirmed for ${subject}.`
      } else if (status === 'waitlisted') {
        message = `${subject} is on the waitlist.${
          Number.isInteger(position) && position > 0 ? ` Waitlist position ${position}.` : ''
        }`
      }
      const dashboardStatus = document.querySelector('#registration-status')
      if (dashboardStatus) dashboardStatus.textContent = message
      await refreshCapacity(session)
      renderDashboard(message)
      dialog.close()
      const action = isFamilyId(result?.registration_id)
        ? `.cancel-registration-btn[data-registration-id="${result.registration_id}"]`
        : `.register-session-btn[data-session-id="${session.id}"]`
      document.querySelector<HTMLButtonElement>(action)?.focus()
    } catch {
      feedback.textContent = 'Registration could not be confirmed. Check your connection and try again.'
    } finally {
      submit.disabled = false
      close.disabled = false
      submit.textContent = 'Register'
    }
  })

  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('cancel', (event) => {
    if (submit.disabled) event.preventDefault()
  })
  dialog.addEventListener('close', () => dialog.remove(), { once: true })
  document.body.append(dialog)
  dialog.showModal()
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

await Promise.all([loadSessions(), canRegisterForSessions ? loadParentRegistrations() : undefined])
renderDashboard()