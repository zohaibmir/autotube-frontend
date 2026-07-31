/**
 * supabase.ts — stub kept for backward compatibility during migration.
 *
 * The Supabase JS client has been removed. All auth now flows through FastAPI:
 *   POST /api/auth/login
 *   POST /api/auth/signup
 *   POST /api/auth/refresh
 *   POST /api/auth/logout
 *   POST /api/auth/change-password
 *
 * This file will be deleted once all imports are confirmed clean.
 * Token storage is handled by @lib/tokenStore.
 */
export const supabase = null as never
