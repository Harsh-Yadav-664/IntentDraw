import { createClient } from '@supabase/supabase-js'

const url = 'https://anqjgissfqtvlvmzglnr.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucWpnaXNzZnF0dmx2bXpnbG5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI1Njg2NiwiZXhwIjoyMDg2ODMyODY2fQ.CrFqJWfgJrdtOIz-L1krnRaB9TBz25PzRrHohvv5DHM'

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function setupDevUser() {
  console.log('Creating dev user...')
  
  // Try to create the user
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'dev@intentdraw.local',
    password: 'password123',
    email_confirm: true,
  })

  if (error) {
    if (error.message.includes('already exists')) {
      // Find the user if it exists
      const { data: usersData } = await supabase.auth.admin.listUsers()
      const devUser = usersData.users.find(u => u.email === 'dev@intentdraw.local')
      console.log('Dev user already exists:', devUser.id)
    } else {
      console.error('Error creating user:', error)
    }
  } else {
    console.log('Dev user created:', data.user.id)
  }
}

setupDevUser()
