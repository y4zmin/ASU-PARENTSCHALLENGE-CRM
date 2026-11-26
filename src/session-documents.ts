import './session-documents.css'
import { supabase } from './supabase'
import { getSessionDocumentLink, listSessionDocuments } from './session-document-storage'

const documentsSection = document.querySelector<HTMLElement>('#session-documents-section')!
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
  const files = await listSessionDocuments(sessionId)
  return Promise.all(files.map(async (file) => ({
    name: file.name,
    url: await getSessionDocumentLink(file.path).catch(() => ''),
    updatedAt: file.updatedAt ?? '',
  })))
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
                ${document.url
                  ? `<a href="${escapeHtml(document.url)}" target="_blank" rel="noreferrer">${escapeHtml(document.name)}</a>`
                  : `${escapeHtml(document.name)} (Link unavailable)`}
              </div>
              <small>${document.updatedAt ? new Date(document.updatedAt).toLocaleString() : ''}</small>
            </li>
          `
        )
        .join('')}
    </ul>
  `
}

let documentsRequest = 0

async function refreshDocuments(sessionId: string): Promise<void> {
  const request = ++documentsRequest
  const list = document.querySelector<HTMLElement>('#session-documents-list')
  if (!list) return

  list.innerHTML = '<p class="attendance-intro">Loading documents...</p>'

  try {
    const documents = await loadSessionDocuments(sessionId)
    if (request === documentsRequest) list.innerHTML = renderDocumentList(documents)
  } catch {
    if (request === documentsRequest) list.textContent = 'We could not load documents for this session.'
  }
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

    if (!form.isConnected) return
    fileInput.value = ''
    setStatus('Document uploaded successfully.')
    if (sessionSelect.value === sessionId) await refreshDocuments(sessionId)
  } catch (error) {
    if (!form.isConnected) return
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

  for (const link of navLinks) {
    if (link.dataset.tab === 'documents') {
      link.classList.toggle('active', show)
    }
  }
}

function syncDocumentsSection(): void {
  const show = window.location.hash === '#documents'
  showDocumentsSection(show)
  if (show) void startDocuments()
}

window.addEventListener('hashchange', syncDocumentsSection)
syncDocumentsSection()

export {}
