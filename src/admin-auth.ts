import { supabase } from './supabase'

const { data: sessionData } = await supabase.auth.getSession()

if (!sessionData.session) {
  window.location.href = '/index.html'
} else {
  const { data: activeRole, error } = await supabase.rpc(
    'get_active_role'
  )

  if (error || !activeRole) {
    await supabase.auth.signOut()
    window.location.href = '/index.html'
  } else if (activeRole !== 'admin') {
    if (activeRole === 'staff') {
      window.location.href = '/staff-dashboard.html'
    } else if (activeRole === 'coordinator') {
      window.location.href = '/coordinator-dashboard.html'
    } else if (activeRole === 'parent') {
      window.location.href = '/parent-dashboard.html'
    } else {
      await supabase.auth.signOut()
      window.location.href = '/index.html'
    }
  }
}