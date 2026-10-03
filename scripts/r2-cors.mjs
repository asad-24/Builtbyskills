// Prints a policy only. Never connects to Cloudflare or reads R2 credentials.
const input = process.argv[2]
if (!input) throw new Error("Usage: node scripts/r2-cors.mjs https://YOUR_PRODUCTION_ORIGIN")
const production = new URL(input)
if (production.protocol !== "https:" || production.origin !== input || production.username || production.password || ["localhost", "127.0.0.1"].includes(production.hostname)) throw new Error("Supply the exact HTTPS production origin, without a path or trailing slash.")
console.log(JSON.stringify([{ AllowedOrigins: [production.origin, "http://localhost:3000"], AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["Content-Type", "Range"], ExposeHeaders: ["ETag", "Accept-Ranges", "Content-Range", "Content-Length"], MaxAgeSeconds: 300 }], null, 2))
