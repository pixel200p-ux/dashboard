/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Sign-in is enabled, but sign-up is restricted by ALLOWED_SIGNUP_EMAILS.
 * Keep that server variable empty to disable account creation entirely.
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = true;

/**
 * Only these addresses may create local accounts. Keep empty to disable all
 * public sign-ups. Configure with comma-separated emails on the server.
 */
export const allowedSignupEmails = (process.env.ALLOWED_SIGNUP_EMAILS ?? "")
	.split(",")
	.map((email) => email.trim().toLowerCase())
	.filter(Boolean);
