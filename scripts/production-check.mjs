import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFile(join(root, path), 'utf8')
const [config, pagesWorkflow, envExample] = await Promise.all([
  read('supabase/config.toml'),
  read('.github/workflows/pages.yml'),
  read('.env.example')
])
const migrationNames = (await readdir(join(root, 'supabase/migrations'))).filter((name) => name.endsWith('.sql')).sort()
const migrations = await Promise.all(migrationNames.map(async (name) => ({ name, sql: await read(`supabase/migrations/${name}`) })))
const allSql = migrations.map(({ sql }) => sql).join('\n')
const failures = []

const requiredTables = ['profiles', 'categories', 'dishes', 'interaction_options', 'wishlists', 'wishlist_items', 'reviews', 'push_subscriptions']
for (const table of requiredTables) {
  if (!new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(allSql)) {
    failures.push(`${table}: RLS is not enabled in migrations`)
  }
}

if (!/enable_signup\s*=\s*false/i.test(config)) failures.push('supabase/config.toml must disable public signup')
if (!migrationNames.some((name) => name.includes('production_hardening'))) failures.push('production hardening migration is missing')
if (!/revoke all privileges[\s\S]+from anon, authenticated/i.test(allSql)) failures.push('least-privilege table revocation is missing')
if (!/vars\.VITE_SUPABASE_PUBLISHABLE_KEY/.test(pagesWorkflow)) failures.push('Pages must read the publishable key from a GitHub variable')
if (!/vars\.VITE_VAPID_PUBLIC_KEY/.test(pagesWorkflow)) failures.push('Pages must read the public VAPID key from a GitHub variable')
if (/SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/i.test(pagesWorkflow)) failures.push('Pages workflow must never receive a Supabase secret key')
if (!/VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me/.test(envExample)) failures.push('.env.example must contain only the publishable placeholder')

const privateUuid = /'[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'/i
for (const { name, sql } of migrations) {
  if (privateUuid.test(sql)) failures.push(`${name}: contains a UUID literal; keep real Auth UUIDs out of migrations`)
}

if (failures.length) {
  console.error('Production check failed:\n' + failures.map((failure) => `- ${failure}`).join('\n'))
  process.exit(1)
}

console.log(`Production check passed (${migrationNames.length} migrations, ${requiredTables.length} RLS tables).`)
