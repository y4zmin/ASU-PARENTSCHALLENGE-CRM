import { supabase } from './supabase'

const logoutLink = document.querySelector('#logout-link') as HTMLAnchorElement

logoutLink.addEventListener('click', async (event) => {
  event.preventDefault()

  await supabase.auth.signOut({ scope: 'local' })

  window.location.replace('/index.html')
})