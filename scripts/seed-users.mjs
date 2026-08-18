// Seed camp accounts: creates each Supabase auth user and its app_users row.
// There is no sign-up screen — accounts exist because this script was run.
//
// CAVEAT, found the hard way: Supabase validates the email domain, and on this
// project it rejects `@junkyard.camp` outright — "Email address is invalid".
// The Auth admin API may or may not apply the same validator depending on the
// project, so if this script fails with that message, use
// `supabase/add-users.sql` instead. That writes auth.users directly, keeps the
// username@junkyard.camp convention the sign-in screen depends on, and is the
// path the live project's accounts were actually created with.
//
// Usage:
//   1. cp users.example.json users.json   and fill in real accounts
//      (users.json is git-ignored — never commit it)
//   2. SUPABASE_URL=https://<project>.supabase.co \
//      SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//      node scripts/seed-users.mjs
//
// The SERVICE-ROLE key bypasses row-level security. It must never appear in
// client code or in the repo — environment only, on the machine running this.
// Equal powers for everyone is a one-line change: make every role "director".
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const DOMAIN = 'junkyard.camp' // usernames map to <username>@junkyard.camp

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const users = JSON.parse(readFileSync(new URL('../users.json', import.meta.url), 'utf8'))
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let failures = 0
for (const u of users) {
  const { username, password, display_name, role = 'helper' } = u
  if (!username || !password || !display_name || !['helper', 'director'].includes(role)) {
    console.error(`FAIL ${username ?? '(missing username)'} — need username, password, display_name, role helper|director`)
    failures++
    continue
  }
  const email = `${username}@${DOMAIN}`

  // Create the auth user; if it already exists, find it and re-sync instead.
  let userId
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) {
    const { data: list, error: listError } = await supabase.auth.admin.listUsers()
    const existing = list?.users.find((x) => x.email === email)
    if (listError || !existing) {
      console.error(`FAIL ${username} — ${createError.message}`)
      failures++
      continue
    }
    userId = existing.id
    await supabase.auth.admin.updateUserById(userId, { password })
    console.log(`~ ${username} already existed — password updated`)
  } else {
    userId = created.user.id
    console.log(`+ ${username} created`)
  }

  const { error: rowError } = await supabase
    .from('app_users')
    .upsert({ id: userId, username, display_name, role })
  if (rowError) {
    console.error(`FAIL ${username} — app_users row: ${rowError.message}`)
    failures++
  } else {
    console.log(`  ${username} → ${display_name} (${role})`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} account(s) failed`)
  process.exit(1)
}
console.log(`\n${users.length} account(s) seeded`)
