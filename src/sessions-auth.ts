import { showDashboardNavigation } from './dashboard-navigation'
import { supabase } from './supabase'

const { data: sessionData } = await supabase.auth.getSession()

if (!sessionData.session) {
  window.location.href = '/index.html'
} else {
  const { data: activeRole, error } = await supabase.rpc(
    'get_active_role'
  )

  if (
    error ||
    !activeRole ||
    (activeRole !== 'admin' && activeRole !== 'staff' &&
      activeRole !== 'coordinator' && activeRole !== 'parent')
  ) {
    await supabase.auth.signOut({ scope: 'local' })
    window.location.href = '/index.html'
  } else {
    const home = `/${activeRole}-dashboard.html`
    document.querySelector<HTMLAnchorElement>('.logo-link')!.href = home
    showDashboardNavigation(activeRole)
  }
}
