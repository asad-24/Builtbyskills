import "server-only"

import crypto from "node:crypto"

import { getMuxEnv } from "@/lib/env"

function muxAuthHeader() {
  const env = getMuxEnv()
  return `Basic ${Buffer.from(`${env.muxTokenId}:${env.muxTokenSecret}`).toString("base64")}`
}

export async function createMuxDirectUploadUrl() {
  const env = getMuxEnv()
  const response = await fetch("https://api.mux.com/video/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: muxAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cors_origin: env.siteUrl,
      new_asset_settings: {
        playback_policy: ["signed"],
        mp4_support: "none",
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Mux upload URL creation failed: ${response.status}`)
  }

  return response.json() as Promise<{
    data: { id: string; url: string; status: string; new_asset_settings?: unknown }
  }>
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

export function createMuxPlaybackToken(playbackId: string, expiresInSeconds = 900) {
  const env = getMuxEnv()
  const privateKey = env.muxSigningPrivateKey.replace(/\\n/g, "\n")
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: env.muxSigningKeyId }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64Url(
    JSON.stringify({
      sub: playbackId,
      aud: "v",
      exp: now + expiresInSeconds,
      iat: now,
    })
  )
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(privateKey)

  return `${header}.${payload}.${base64Url(signature)}`
}
