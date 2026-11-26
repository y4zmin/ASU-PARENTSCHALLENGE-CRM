type DashboardRole = 'admin' | 'staff' | 'coordinator' | 'parent'
type MenuItem = [label: string, href?: string]

const menus: Record<DashboardRole, MenuItem[]> = {
  admin: [
    ["Home","/admin-dashboard.html"],
    ["Users"],
    ["Families"],
    ["Scholars"],
    ["Sessions","/sessions-dashboard.html"],
    ["Attendance"],
    ["Documents"],
    ["Reports & Analytics"],
    ["Applications","/manage-applications.html"],
  ],
  staff: [
    ["Home","/staff-dashboard.html"],
    ["Families"],
    ["Scholars"],
    ["Sessions","/sessions-dashboard.html"],
    ["Attendance","/staff-dashboard.html#attendance"],
    ["Parent Coordinators"],
    ["Documents","/staff-dashboard.html#documents"],
    ["Reports & Analytics","/staff-dashboard.html#reports"],
    ["Applications","/manage-applications.html"],
  ],
  coordinator: [
    ["Home","/coordinator-dashboard.html"],
    ["Assigned Families"],
    ["Parents"],
    ["Scholars"],
    ["Sessions","/sessions-dashboard.html"],
    ["Attendance"],
    ["Documents"],
  ],
  parent: [
    ["Home","/parent-dashboard.html"],
    ["My Family Profile","/parent-dashboard.html#family-profile"],
    ["Scholars","/parent-scholars.html"],
    ["Sessions","/sessions-dashboard.html"],
    ["Attendance","/parent-dashboard.html#attendance"],
    ["Documents"],
    ["Resources"],
  ],
}

export function showDashboardNavigation(role: DashboardRole): void {
  const navigation = document.querySelector<HTMLElement>('#dashboard-navigation')
  const list = navigation?.querySelector('.nav-bar')
  if (!navigation || !list) return

  const items = menus[role].map(([label, href]) => {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.textContent = label

    if (href) {
      link.href = href
      if (href === window.location.pathname) link.setAttribute('aria-current', 'page')
    } else {
      link.setAttribute('aria-disabled', 'true')
      link.title = 'Coming soon'
    }

    item.append(link)
    return item
  })

  list.replaceChildren(...items)
  navigation.hidden = false
}
