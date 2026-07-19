import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = process.cwd()
const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage'])
const allowedFiles = new Set(['.env.example', 'scripts/privacy-check.mjs'])
const dangerousPatterns = [
  { label: 'Supabase secret key', regex: /sb_secret_[A-Za-z0-9_-]{12,}/g },
  { label: 'legacy service-role JWT', regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { label: 'service-role variable', regex: /(?:SUPABASE|VITE_SUPABASE)_(?:SERVICE_ROLE|SECRET)_KEY\s*=\s*[^\s]+/gi },
  { label: 'database connection string', regex: /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/gi }
]

const files = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path)
    else files.push(path)
  }
}

await walk(root)
const findings = []
for (const file of files) {
  const name = relative(root, file).replaceAll('\\', '/')
  if (/^\.env(?:\.|$)/.test(name) && !allowedFiles.has(name)) findings.push(`${name}: private environment file is tracked`)
  if (/\.(png|jpe?g|webp|gif|ico|woff2?)$/i.test(name)) continue
  const content = await readFile(file, 'utf8').catch(() => '')
  for (const pattern of dangerousPatterns) {
    pattern.regex.lastIndex = 0
    if (pattern.regex.test(content)) findings.push(`${name}: ${pattern.label}`)
  }
}

if (findings.length) {
  console.error('Privacy check failed:\n' + findings.map((finding) => `- ${finding}`).join('\n'))
  process.exit(1)
}
console.log(`Privacy check passed (${files.length} files scanned).`)
