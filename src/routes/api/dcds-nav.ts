import { createFileRoute } from "@tanstack/react-router";
import { fetchFmarketDcdsNav } from "@/lib/api/fmarket";

export const Route = createFileRoute("/api/dcds-nav")({
  server: {
    handlers: {
      GET: async () => {
        const result = await fetchFmarketDcdsNav();
        if (!result.ok) {
          return Response.json({ success: false, message: result.error }, { status: result.status && result.status >= 400 ? result.status : 502 });
        }

        return Response.json({
          success: true,
          code: "DCDS",
          nav: result.nav,
          updatedAt: result.updatedAt,
        });
      },
    },
  },
});
