import { supabase } from './supabase'
import { getSessionDocumentLink, listSessionDocuments } from './session-document-storage'

type DetailRow = { id: string; name: string | null; kind: 'family' | 'parent' | 'scholar' }

export function showSessionRegistrationDetails(
  session: { id: number; title: string }, trigger: HTMLButtonElement
): void {
  if (document.querySelector('#session-roster-dialog')) return

  const dialog = document.createElement('dialog')
  dialog.id = 'session-roster-dialog'
  dialog.className = 'session-roster-dialog'
  dialog.setAttribute('aria-labelledby', 'session-roster-title')
  dialog.innerHTML = `
    <div class="session-roster-shell">
      <header class="session-roster-header">
        <div>
          <p class="session-roster-session"></p>
          <h2 id="session-roster-title" tabindex="-1"></h2>
        </div>
        <button class="session-roster-close" type="button" aria-label="Close session details">×</button>
      </header>
      <nav class="session-roster-nav session-roster-sections" aria-label="Session sections"></nav>
      <nav class="session-roster-nav session-roster-breadcrumb" aria-label="Family navigation"></nav>
      <div class="session-roster-content">
        <p class="session-roster-status" role="status"></p>
        <div class="session-roster-results"></div>
      </div>
    </div>
  `

  dialog.querySelector('.session-roster-session')!.textContent = session.title
  const heading = dialog.querySelector<HTMLElement>('#session-roster-title')!
  const nav = dialog.querySelector<HTMLElement>('.session-roster-breadcrumb')!
  const sections = dialog.querySelector<HTMLElement>('.session-roster-sections')!
  const content = dialog.querySelector<HTMLElement>('.session-roster-content')!
  const status = dialog.querySelector<HTMLElement>('.session-roster-status')!
  const results = dialog.querySelector<HTMLElement>('.session-roster-results')!
  dialog.querySelector('.session-roster-close')!.addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', () => {
    dialog.remove()
    trigger.focus()
  }, { once: true })

  function button(label: string, className: string, action: () => void): HTMLButtonElement {
    const element = document.createElement('button')
    element.className = className
    element.type = 'button'
    element.textContent = label
    element.addEventListener('click', action)
    return element
  }

  function showFamilies(rows: DetailRow[]): void {
    const list = document.createElement('ul')
    list.className = 'session-roster-families'
    for (const row of rows) {
      const item = document.createElement('li')
      item.append(button(row.name || 'Unnamed family', 'session-roster-family', () => void load(row)))
      list.append(item)
    }
    results.append(list)
  }

  function showMembers(rows: DetailRow[]): void {
    const groups = [
      { kind: 'parent', title: 'Parents and Guardians' },
      { kind: 'scholar', title: 'Scholars' },
    ]
    const grid = document.createElement('div')
    grid.className = 'session-roster-members'
    for (const { kind, title } of groups) {
      const section = document.createElement('section')
      const label = document.createElement('h3')
      label.textContent = title
      const list = document.createElement('ul')
      for (const row of rows.filter((member) => member.kind === kind)) {
        const item = document.createElement('li')
        item.textContent = row.name || 'Name unavailable'
        list.append(item)
      }
      section.append(label)
      if (list.children.length) {
        section.append(list)
      } else {
        const empty = document.createElement('p')
        empty.textContent = 'None listed'
        section.append(empty)
      }
      grid.append(section)
    }
    results.append(grid)
  }

  const familiesButton = button('Registered Families', 'secondary-btn', () => void load())
  const documentsButton = button('Documents', 'secondary-btn', () => void loadDocuments())
  sections.append(familiesButton, documentsButton)

  let request = 0
  async function loadDocuments(): Promise<void> {
    const current = ++request
    familiesButton.setAttribute('aria-pressed', 'false')
    documentsButton.setAttribute('aria-pressed', 'true')
    nav.hidden = true
    heading.textContent = 'Documents'
    heading.focus()
    content.scrollTop = 0
    results.replaceChildren()
    status.textContent = 'Loading documents…'

    try {
      const files = await listSessionDocuments(String(session.id))
      if (!dialog.open || current !== request) return
      status.textContent = files.length ? '' : 'No documents are available for this session.'
      const list = document.createElement('ul')
      list.className = 'session-roster-documents'
      const rows = files.map((file) => {
        const item = document.createElement('li')
        const name = document.createElement('strong')
        name.textContent = file.name
        const actions = document.createElement('div')
        item.append(name, actions)
        list.append(item)
        return { file, actions }
      })
      results.append(list)

      // Sign only this session's paths, in small batches.
      for (let offset = 0; offset < rows.length; offset += 6) {
        if (!dialog.open || current !== request) return
        await Promise.all(rows.slice(offset, offset + 6).map(async ({ file, actions }) => {
          const links = await Promise.allSettled([
            getSessionDocumentLink(file.path),
            getSessionDocumentLink(file.path, true),
          ])
          if (!dialog.open || current !== request) return
          for (const [index, link] of links.entries()) {
            const label = index === 0 ? 'View' : 'Download'
            if (link.status === 'rejected') {
              const unavailable = document.createElement('span')
              unavailable.textContent = label + ' unavailable'
              actions.append(unavailable)
              continue
            }
            const anchor = document.createElement('a')
            anchor.href = link.value
            anchor.textContent = label
            anchor.setAttribute('aria-label', label + ' ' + file.name)
            if (index === 0) {
              anchor.target = '_blank'
              anchor.rel = 'noopener noreferrer'
            }
            actions.append(anchor)
          }
        }))
      }
    } catch {
      if (!dialog.open || current !== request) return
      status.textContent = 'We could not load documents for this session.'
      results.append(button('Try again', 'secondary-btn', () => void loadDocuments()))
    }
  }
  async function load(family?: DetailRow): Promise<void> {
    const current = ++request
    familiesButton.setAttribute('aria-pressed', 'true')
    documentsButton.setAttribute('aria-pressed', 'false')
    const title = family ? family.name || 'Family members' : 'Registered Families'
    nav.hidden = !family
    nav.replaceChildren()
    if (family) nav.append(button('Registered Families', 'session-roster-back', () => void load()), ' / ')
    const crumb = document.createElement('span')
    crumb.setAttribute('aria-current', 'page')
    crumb.textContent = title
    nav.append(crumb)
    heading.textContent = title
    heading.focus()
    content.scrollTop = 0
    results.replaceChildren()
    status.textContent = family ? 'Loading family members…' : 'Loading registered families…'

    try {
      const { data, error } = await supabase.rpc('get_session_registration_details', {
        p_session_id: session.id,
        p_family_id: family?.id ?? null,
      })
      if (!dialog.open || current !== request) return
      if (error || !Array.isArray(data)) throw new Error('Could not load session details')
      const rows = data as DetailRow[]
      if (rows.length === 0) {
        status.textContent = family ? 'No family members are available.' : 'No registered families are available.'
        return
      }
      status.textContent = ''
      if (family) showMembers(rows)
      else showFamilies(rows)
    } catch {
      if (!dialog.open || current !== request) return
      status.textContent = 'We could not load these details.'
      results.append(button('Try again', 'secondary-btn', () => void load(family)))
    }
  }

  document.body.append(dialog)
  dialog.showModal()
  void load()
}
