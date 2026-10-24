import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { loadTestEnvironment } from './lms-test-env.mjs'
const config = loadTestEnvironment()
if (!config.LMS_TEST_DATABASE_URL) throw new Error('Set LMS_TEST_DATABASE_URL in the test environment file.')
const connection = new URL(config.LMS_TEST_DATABASE_URL)
const reference = new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
if (connection.hostname !== `db.${reference}.supabase.co` && decodeURIComponent(connection.username) !== `postgres.${reference}`) throw new Error('The database connection must belong to the SAME separate test project as its API URL.')
const dbEnv = { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432', PGDATABASE: connection.pathname.slice(1) || 'postgres', PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password), PGSSLMODE: connection.searchParams.get('sslmode') || 'require' }
function sql(statement) {
  const result = spawnSync('psql', ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'], { input: statement, env: dbEnv, encoding:'utf8' })
  if (result.status !== 0) throw new Error('Test migration failed. Check the test database connection and schema. ' + result.stderr.replaceAll(connection.password,'[redacted]'))
  return result.stdout.trim()
}
const hasHistory = sql("select to_regclass('supabase_migrations.schema_migrations') is not null") === 't'
if (!hasHistory && sql("select to_regclass('public.profiles') is not null") === 't') throw new Error('Existing schema has no migration history. Start with an empty test project or restore its proper migration history.')
sql('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text);')
const applied = new Set(sql('select version from supabase_migrations.schema_migrations').split('\n'))
for (const file of readdirSync('supabase/migrations').filter(f=>/^\d+_.*\.sql$/.test(f)).sort()) {
  const [version] = file.split('_')
  if (applied.has(version)) continue
  const migration = readFileSync(`supabase/migrations/${file}`,'utf8')
  // Some historical files own their transaction. The new portal migration and
  // history receipt run in one transaction; existing files remain unmodified.
  const ownsTransaction = /^begin;/im.test(migration)
  const receipt = `insert into supabase_migrations.schema_migrations(version,name) values('${version}','${file.replaceAll("'","''")}');`
  sql(ownsTransaction ? migration + '\n' + receipt : 'begin;\n' + migration + '\n' + receipt + '\ncommit;')
  console.log(`Applied test migration: ${file}`)
}
