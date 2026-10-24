// Runs real PostgreSQL RLS tests in a NEW disposable cluster. Never reads .env.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '..')
const directory = mkdtempSync(join(tmpdir(), 'rehan-portals-pg-'))
const data = join(directory, 'data')
const port = 55480 + Math.floor(Math.random()*400)
function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 10*1024*1024 })
  if (result.status !== 0) throw new Error(`${cmd} failed: ${result.stderr || result.stdout}`)
  return result.stdout
}
const sql = file => run('psql', ['-U', 'postgres', '-h', directory, '-p', String(port), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', file])
let started = false
try {
  run('initdb', ['-D', data, '--username=postgres', '--auth=trust', '--no-locale', '--encoding=UTF8'])
  run('pg_ctl', ['-D', data, '-l', join(directory,'postgres.log'), '-o', `-k ${directory} -p ${port} -h 127.0.0.1`, '-w', 'start'])
  started = true
  sql('supabase/tests/course_portals_scaffold.sql')
  for (const file of readdirSync(join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) sql(`supabase/migrations/${file}`)
  const output = sql('supabase/tests/course_portals.sql')
  console.log(output.split('\n').filter(line => line.includes('PASS:')).join('\n'))
  sql('supabase/tests/payment_approval.sql')
  console.log('PASS: existing transactional payment-approval regression tests with the new portal migration.')
  console.log('PASS: complete migration chain and course portal authorization tests on real isolated PostgreSQL.')
} finally {
  if (started) run('pg_ctl', ['-D',data,'-m','fast','-w','stop'])
  rmSync(directory,{recursive:true,force:true})
}
