const createSearchBox = () => {
  const section = document.querySelector<HTMLElement>('#attendance-section')
  if (!section) return

  const existing = document.querySelector<HTMLInputElement>('#attendance-search')
  if (existing) return

  const filterWrap = document.createElement('div')
  filterWrap.className = 'attendance-search-wrap'

  const input = document.createElement('input')
  input.id = 'attendance-search'
  input.type = 'search'
  input.placeholder = 'Search sessions or attendees'
  input.setAttribute('aria-label', 'Search attendance records')

  filterWrap.appendChild(input)
  section.appendChild(filterWrap)

  return input
}

const applySearch = () => {
  const input = document.querySelector<HTMLInputElement>('#attendance-search')
  if (!input) return

  const query = input.value.trim().toLowerCase()

  const rows = document.querySelectorAll<HTMLTableRowElement>('#year-content .attendance-table tbody tr')
  rows.forEach((row) => {
    const text = row.textContent?.toLowerCase() ?? ''
    const match = !query || text.includes(query)

    row.style.display = match ? '' : 'none'
  })
}

const setupSearch = () => {
  const section = document.querySelector<HTMLElement>('#attendance-section')
  if (!section) return

  const input = createSearchBox()
  if (!input) return

  input.addEventListener('input', applySearch)
  applySearch()
}

const init = () => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSearch)
  } else {
    setupSearch()
  }

  const section = document.querySelector<HTMLElement>('#attendance-section')

  if (section) {
    const observer = new MutationObserver(() => {
      if (document.querySelector<HTMLInputElement>('#attendance-search')) {
        return
      }

      setupSearch()
    })

    observer.observe(section, {
      childList: true,
      subtree: true,
    })
  }
}

init()
