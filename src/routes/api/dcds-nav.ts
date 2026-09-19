import { createFileRoute } from "@tanstack/react-router";
import { fetchFmarketDcdsNav } from "@/lib/api/fmarket";

export const Route = createFileRoute("/api/dcds-nav")({
  server: {
    handlers: {
      GET: async () => {
        const result = await fetchFmarketDcdsNav();
        if (!result) {
          return Response.json({ success: false, message: "Không lấy được giá DCDS từ Fmarket" }, { status: 502 });
        }

        return Response.json({
          success: true,
          code: result.code,
          nav: result.nav,
          updatedAt: result.updatedAt,
        });
      },
    },
  },
});
