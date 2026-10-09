import { supabase } from './supabase'
import './dashboard.css'

async function loadDashboardUser() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    window.location.href = '/'
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error(profileError)
    return
  }

  const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()

  const nameElement = document.querySelector('#user-name')

  if (nameElement && fullName) {
    nameElement.textContent = `, ${fullName}`
  }
}

loadDashboardUser()