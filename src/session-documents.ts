import './session-documents.css'
import { supabase } from './supabase'

const documentsSection = document.querySelector<HTMLElement>('#session-documents-section')!
const sessionDashboard = document.querySelector<HTMLElement>('#events-dashboard')!
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-bar a')

interface SessionOption {
  id: string
  title: string
  session_date: string
}

interface DocumentRecord {
  name: string
  url: string
  updatedAt: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => {
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

function normalizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function loadSessions(): Promise<SessionOption[] | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, title, session_date')
    .order('session_date', { ascending: false })

  if (error) {
    console.error('Could not load sessions for documents:', error.message)
    return null
  }

  return (data ?? []) as SessionOption[]
}

function renderSessionOptions(sessions: SessionOption[]): string {
  return sessions
    .map(
      (session) => `<option value="${session.id}">${escapeHtml(session.title)}</option>`
    )
    .join('')
}

async function loadSessionDocuments(sessionId: string): Promise<DocumentRecord[]> {
  const bucketName = 'session-documents'

  const { data, error } = await supabase.storage
    .from(bucketName)
    .list(sessionId, { limit: 100, offset: 0 })

  if (error) {
    console.error('Could not load session documents:', error.message)
    return []
  }

  const records: DocumentRecord[] = []

  for (const item of data ?? []) {
    if (item.name.startsWith('.')) {
      continue
    }

    const filePath = `${sessionId}/${item.name}`
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 60 * 60 * 24)

    records.push({
      name: item.name,
      url: signedUrlError ? '#' : signedUrlData?.signedUrl ?? '#',
      updatedAt: item.updated_at ?? new Date().toISOString(),
    })
  }

  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function renderDocumentList(documents: DocumentRecord[]): string {
  if (documents.length === 0) {
    return '<p class="empty-state">No documents uploaded for this session yet.</p>'
  }

  return `
    <ul class="document-list">
      ${documents
        .map(
          (document) => `
            <li class="document-item">
              <div>
                <a href="${document.url}" target="_blank" rel="noreferrer">
                  ${escapeHtml(document.name)}
                </a>
              </div>
              <small>${new Date(document.updatedAt).toLocaleString()}</small>
            </li>
          `
        )
        .join('')}
    </ul>
  `
}

async function refreshDocuments(sessionId: string): Promise<void> {
  const list = document.querySelector<HTMLElement>('#session-documents-list')
  if (!list) return

  list.innerHTML = '<p class="attendance-intro">Loading documents...</p>'

  const documents = await loadSessionDocuments(sessionId)
  list.innerHTML = renderDocumentList(documents)
}

function setStatus(message: string, isError = false): void {
  const status = document.querySelector<HTMLElement>('#document-status')
  if (!status) return

  status.textContent = message
  status.classList.toggle('error', isError)
}

async function handleDocumentUpload(event: Event): Promise<void> {
  event.preventDefault()

  const form = event.currentTarget as HTMLFormElement
  const fileInput = form.querySelector<HTMLInputElement>('#session-document-file')
  const sessionSelect = document.querySelector<HTMLSelectElement>('#session-doc-select')

  if (!fileInput || !sessionSelect) return

  const file = fileInput.files?.[0]
  const sessionId = sessionSelect.value

  if (!file) {
    setStatus('Choose a file before uploading.', true)
    return
  }

  if (!sessionId) {
    setStatus('Choose a session first.', true)
    return
  }

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (submitButton) {
    submitButton.disabled = true
    submitButton.textContent = 'Uploading...'
  }

  const safeFileName = normalizeFileName(file.name)
  const storagePath = `${sessionId}/${Date.now()}-${safeFileName}`

  try {
    const { error } = await supabase.storage
      .from('session-documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      throw error
    }

    fileInput.value = ''
    setStatus('Document uploaded successfully.')
    await refreshDocuments(sessionId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The document could not be uploaded.'

    setStatus(
      'Upload failed. Check that the session-documents bucket exists and the signed-in user can upload there. ' + message,
      true
    )
  } finally {
    if (submitButton) {
      submitButton.disabled = false
      submitButton.textContent = 'Upload Document'
    }
  }
}

async function startDocuments(): Promise<void> {
  documentsSection.innerHTML = `
    <h2 class="attendance-title no-print">Session Documents</h2>
    <p class="attendance-intro no-print">
      Upload files for a session so staff can keep session materials together.
    </p>

    <div class="attendance-toolbar no-print">
      <div class="year-filter">
        <label for="session-doc-select">Session</label>
        <select id="session-doc-select"></select>
      </div>
    </div>

    <form id="session-document-form" class="document-upload-form">
      <label class="document-upload-label" for="session-document-file">Choose file</label>
      <input id="session-document-file" type="file" />
      <button type="submit" class="primary-btn">Upload Document</button>
    </form>

    <p id="document-status" class="document-status"></p>
    <div id="session-documents-list"></div>
  `

  const sessions = await loadSessions()

  if (!sessions || sessions.length === 0) {
    documentsSection.innerHTML +=
      '<p class="empty-state">No sessions are available yet. Create a session before uploading documents.</p>'
    return
  }

  const select = document.querySelector<HTMLSelectElement>('#session-doc-select')

  if (select) {
    select.innerHTML = renderSessionOptions(sessions)
    select.addEventListener('change', async () => {
      const selectedSession = select.value
      if (selectedSession) {
        await refreshDocuments(selectedSession)
      }
    })
  }

  const form = document.querySelector<HTMLFormElement>('#session-document-form')
  form?.addEventListener('submit', handleDocumentUpload)

  const firstSessionId = String(sessions[0].id)
  await refreshDocuments(firstSessionId)
}

function showDocumentsSection(show: boolean): void {
  documentsSection.hidden = !show

  if (show) {
    sessionDashboard.style.display = 'none'
  }

  for (const link of navLinks) {
    if (link.dataset.tab === 'documents') {
      link.classList.toggle('active', show)
    }
  }
}

for (const link of navLinks) {
  link.addEventListener('click', (event) => {
    const clickedLink = event.currentTarget as HTMLAnchorElement

    if (clickedLink.dataset.tab === 'documents') {
      showDocumentsSection(true)
      void startDocuments()
    } else {
      showDocumentsSection(false)
    }
  })
}

if (window.location.hash === '#documents') {
  showDocumentsSection(true)
  void startDocuments()
} else {
  showDocumentsSection(false)
}

export {}