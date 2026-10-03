import "server-only"
import { S3Client } from "@aws-sdk/client-s3"
import { MissingEnvironmentError } from "@/lib/errors"

export function getR2Config() {
  const keys = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET_NAME"] as const
  const missing = keys.filter(key => !process.env[key])
  if (missing.length) throw new MissingEnvironmentError(missing)
  const endpoint = new URL(process.env.R2_ENDPOINT!)
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !endpoint.hostname.endsWith(".r2.cloudflarestorage.com")) throw new Error("Invalid private R2 endpoint configuration")
  if (process.env.R2_BUCKET_NAME !== "builtbyskills-course-videos") throw new Error("Unexpected course video bucket")
  return { bucket: process.env.R2_BUCKET_NAME, endpoint: endpoint.toString(), accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! }
}

export function getR2Client() {
  const config = getR2Config()
  return new S3Client({ region: "auto", endpoint: config.endpoint, maxAttempts: 2, requestChecksumCalculation: "WHEN_REQUIRED", requestHandler: { connectionTimeout: 5000, requestTimeout: 20000 }, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } })
}
