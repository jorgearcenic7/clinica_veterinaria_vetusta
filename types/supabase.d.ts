/**
 * Aliases over the real @supabase/supabase-js SDK types, so the rest of the
 * codebase has a stable name for "authenticated user/session" without
 * reinventing fields the SDK already defines and owns.
 *
 * Used by: frontend/modules/shared/auth.js (and its duplicate
 * frontend/supabase-client.js) requireSession/requireAdmin, frontend/auth.js
 * dashboardPathForSession, and backend/lib/reservations.js
 * requireAdminRequest (the `user` returned by `supabase.auth.getUser`,
 * passed on as `adminUser` to `logAdminAction`).
 */

import type { Session, User } from "@supabase/supabase-js";

export type AuthenticatedUser = User;
export type AuthenticatedSession = Session;
