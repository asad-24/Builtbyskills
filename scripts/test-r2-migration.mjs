// Disposable local PostgreSQL only. Does not read env files or connect remotely.
// Install @electric-sql/pglite in .tmp/r2-sql-check (not an app dependency).
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
const root = resolve(import.meta.dirname, "..")
const { PGlite } = await import(pathToFileURL(resolve(root, ".tmp/r2-sql-check/node_modules/@electric-sql/pglite/dist/index.js")).href)
const db = new PGlite()
try {
  await db.exec(await readFile(resolve(root, "supabase/tests/r2_video_scaffold.sql"), "utf8"))
  await db.exec(await readFile(resolve(root, "supabase/migrations/202610030001_private_r2_lesson_videos.sql"), "utf8"))
  await db.exec(await readFile(resolve(root, "supabase/tests/r2_video_security.sql"), "utf8"))
  // Exercise the forward migration with real pre-existing Ready/failed/validating
  // rows, not just an empty table. This database is disposable and local only.
  await db.exec(`
    insert into lessons(id,section_id,updated_at) values('00000000-0000-4000-8000-000000000090','00000000-0000-4000-8000-000000000005','2020-01-01');
    select reserve_lesson_video('00000000-0000-4000-8000-000000000090','00000000-0000-4000-8000-000000000001','2020-01-01','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000094','ready.mp4',100);
    select reserve_lesson_video('00000000-0000-4000-8000-000000000090','00000000-0000-4000-8000-000000000001','2020-01-01','00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000095','failed.mp4',100);
    select reserve_lesson_video('00000000-0000-4000-8000-000000000090','00000000-0000-4000-8000-000000000001','2020-01-01','00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000096','validating.mp4',100);
    update lesson_video_assets set state='validating', verified_bytes=100, object_etag='existing-etag' where id in ('00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000093');
    update lesson_video_uploads set state='validating', multipart_id='existing-multipart' where id in ('00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000096');
    update lesson_video_assets set state='failed' where id='00000000-0000-4000-8000-000000000092';
    update lesson_video_uploads set state='failed' where id='00000000-0000-4000-8000-000000000095';
    select validate_lesson_video('00000000-0000-4000-8000-000000000091','existing-etag','{"container":"mp4","video_codec":"h264","audio_codec":null,"pixel_format":"yuv420p","fast_start":true,"duration_seconds":200,"validation_version":"test"}');
  `)
  const snapshot = async () => JSON.stringify((await db.query("select * from lesson_video_assets order by id")).rows)
  const before = await snapshot()
  const forward = await readFile(resolve(root, "supabase/migrations/202610030002_admin_verified_r2_video_ready.sql"), "utf8")
  await db.exec(forward)
  await db.exec(forward) // idempotent second application
  if (await snapshot() !== before) throw new Error("Forward migration changed existing asset data")
  await db.exec(`
    delete from lessons where id='00000000-0000-4000-8000-000000000090';
    delete from lesson_video_uploads where id in ('00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000095','00000000-0000-4000-8000-000000000096');
    delete from lesson_video_assets where original_lesson_id='00000000-0000-4000-8000-000000000090';
  `)
  await db.exec(await readFile(resolve(root, "supabase/tests/r2_video_object_ready.sql"), "utf8"))
  console.log("PASS: additive R2 migration and disposable PostgreSQL security/lifecycle regression checks")
} catch (error) {
  console.error("FAIL:", error.message)
  process.exitCode = 1
} finally { await db.close() }
