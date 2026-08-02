import { createClient } from '@supabase/supabase-js'

const url = 'https://anqjgissfqtvlvmzglnr.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucWpnaXNzZnF0dmx2bXpnbG5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI1Njg2NiwiZXhwIjoyMDg2ODMyODY2fQ.CrFqJWfgJrdtOIz-L1krnRaB9TBz25PzRrHohvv5DHM'

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkUsers() {
  const { data: users, error } = await supabase.auth.admin.listUsers()
  console.log('Users:', users.users.length)
  if (error) console.error('Error:', error)
}

checkUsers()
