import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = error.message || "An unexpected error occurred. Try reloading the page.";
  const databaseError = /DATABASE_URL|database|ENOTFOUND|Unauthorized|Supabase/i.test(message);
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-background px-6 text-foreground"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Không tải được ứng dụng</h1>
      <p className="max-w-xl wrap-break-word text-sm text-muted-foreground">{message}</p>
      {databaseError && (
        <div className="max-w-xl rounded-xl border border-border bg-card p-4 text-left text-sm shadow-(--shadow-card)">
          <p className="font-semibold">Kiểm tra cấu hình database</p>
          <p className="mt-1 text-muted-foreground">
            Local không dùng được <code>DATABASE_URL</code> nếu <code>VITE_AUTH_ENABLED=false</code>. Hãy xóa biến này để dùng PGLite local, hoặc bật auth và thay bằng connection string Supabase đang hoạt động.
          </p>
        </div>
      )}
      <button type="button" className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90" onClick={() => window.location.reload()}>
        Tải lại trang
      </button>
    </main>
  );
}
