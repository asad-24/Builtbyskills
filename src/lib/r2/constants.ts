// Decimal GB: product limit, deliberately below R2's object limit.
export const VIDEO_MAX_BYTES = 1_000_000_000
export const VIDEO_PART_BYTES = 16 * 1024 * 1024
export const VIDEO_UPLOAD_CONCURRENCY = 3
export const VIDEO_UPLOAD_TTL_SECONDS = 24 * 60 * 60
export const VIDEO_PART_URL_SECONDS = 10 * 60
export type VideoAssetSummary = { id: string; state: string; original_name: string; failure_code: string | null }
