import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { allowedSignupEmails } from "@/lib/auth/email-password";

async function handleAuth(request: Request) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname.endsWith("/sign-up/email")) {
    const body = (await request.clone().json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !allowedSignupEmails.includes(email)) {
      return Response.json(
        { code: "SIGN_UP_DISABLED", message: "Tạo tài khoản mới đang bị giới hạn." },
        { status: 403 },
      );
    }
  }
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
