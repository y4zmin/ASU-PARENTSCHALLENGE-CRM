import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Keep persistence and auth events scoped to this browser tab.
const authStorage = window.sessionStorage
const tabKeyName = 'parents-challenge.auth-tab'
let tabId = authStorage.getItem(tabKeyName)
if (!tabId) {
  tabId = Array.from(crypto.getRandomValues(new Uint32Array(4)), (word) => word.toString(16).padStart(8, '0')).join('')
  authStorage.setItem(tabKeyName, tabId)
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: authStorage,
      storageKey: `pc-${new URL(supabaseUrl).host}-${tabId}`,
    },
  }
)