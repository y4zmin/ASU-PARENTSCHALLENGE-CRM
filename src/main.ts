import './style.css'
import { supabase } from './supabase'

const form = document.querySelector('.login-form') as HTMLFormElement
const emailInput = document.querySelector('#username') as HTMLInputElement
const passwordInput = document.querySelector('#password') as HTMLInputElement

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const email = emailInput.value.trim()
  const password = passwordInput.value

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    alert(`Login failed: ${error.message}`)
    return
  }

  if (!data.user) {
    alert('Login failed.')
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profileError) {
    alert(`Could not load profile: ${profileError.message}`)
    return
  }

  console.log('Login successful')
  console.log('Role:', profile.role)

  if (profile.role === 'admin') {
    window.location.href = '/parent-dashboard.html'
  } else if (profile.role === 'staff') {
    window.location.href = '/parent-dashboard.html'
  } else {
    window.location.href = '/parent-dashboard.html'
  }
})