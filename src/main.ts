import './style.css'
import { supabase } from './supabase'

const form = document.querySelector('.login-form') as HTMLFormElement
const emailInput = document.querySelector('#username') as HTMLInputElement
const passwordInput = document.querySelector('#password') as HTMLInputElement
const loginMessage = document.querySelector('#login-message') as HTMLParagraphElement
const loginButton = document.querySelector('#login-button') as HTMLButtonElement
const roleSelection = document.querySelector('#role-selection') as HTMLDivElement
const roleButtons = document.querySelector('#role-buttons') as HTMLDivElement

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  loginMessage.hidden = true
  loginMessage.textContent = ''

  roleSelection.hidden = true
  roleButtons.innerHTML = ''

  loginButton.disabled = true
  loginButton.textContent = 'Signing In...'

  const email = emailInput.value.trim()
  const password = passwordInput.value

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

if (error || !data.user) {
  loginMessage.textContent = 'Incorrect email or password.'
  loginMessage.hidden = false

  loginButton.disabled = false
  loginButton.textContent = 'Sign In'

  return
}

const { data: isActive, error: activeError } = await supabase.rpc(
  'is_active_user'
)

if (activeError || !isActive) {
  loginMessage.textContent = 'Your account is not active.'
  loginMessage.hidden = false

  loginButton.disabled = false
  loginButton.textContent = 'Sign In'

  await supabase.auth.signOut()
  return
}

const { data: roles, error: rolesError } = await supabase.rpc(
  'get_my_roles'
)

console.log('Roles returned:', roles)

if (rolesError || !roles || roles.length === 0) {
  loginMessage.textContent = 'No CRM role is assigned to this account.'
  loginMessage.hidden = false

  loginButton.disabled = false
  loginButton.textContent = 'Sign In'

  await supabase.auth.signOut()
  return
}

if (roles.length > 1) {
  loginButton.disabled = false
  loginButton.textContent = 'Sign In'

  roleSelection.hidden = false

  for (const role of roles) {
    const button = document.createElement('button')

    button.type = 'button'
    button.textContent =
      role.charAt(0).toUpperCase() + role.slice(1)

    button.addEventListener('click', async () => {
      const { error: switchError } = await supabase.rpc(
        'switch_active_role',
        {
          selected_role: role
        }
      )

      if (switchError) {
        loginMessage.textContent = 'Could not switch role.'
        loginMessage.hidden = false
        return
      }

      if (role === 'admin') {
        window.location.href = '/admin-dashboard.html'
      } else if (role === 'staff') {
        window.location.href = '/staff-dashboard.html'
      } else if (role === 'coordinator') {
        window.location.href = '/coordinator-dashboard.html'
      } else if (role === 'parent') {
        window.location.href = '/parent-dashboard.html'
      }
    })

    roleButtons.appendChild(button)
  }

  return
}

const { data: activeRole, error: roleError } = await supabase.rpc(
  'get_active_role'
)

if (roleError || !activeRole) {
  loginMessage.textContent = 'Could not determine your account role.'
  loginMessage.hidden = false

  loginButton.disabled = false
  loginButton.textContent = 'Sign In'

  await supabase.auth.signOut()
  return
}

if (activeRole === 'admin') {
  window.location.href = '/admin-dashboard.html'
} else if (activeRole === 'staff') {
  window.location.href = '/staff-dashboard.html'
} else if (activeRole === 'coordinator') {
  window.location.href = '/coordinator-dashboard.html'
} else if (activeRole === 'parent') {
  window.location.href = '/parent-dashboard.html'
} else {
  loginMessage.textContent = 'Unknown account role.'
  loginMessage.hidden = false

  loginButton.disabled = false
  loginButton.textContent = 'Sign In'

  await supabase.auth.signOut()
}

})