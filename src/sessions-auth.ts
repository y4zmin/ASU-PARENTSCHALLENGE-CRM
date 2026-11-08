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
    !['admin', 'staff', 'coordinator', 'parent'].includes(activeRole)
  ) {
    await supabase.auth.signOut()
    window.location.href = '/index.html'
  }
}