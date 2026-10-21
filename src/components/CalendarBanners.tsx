import { calendarAlerts } from "@/engine/calendar";
import { formatViDate } from "@/engine/dates";
import { useCalendar } from "@/lib/use-calendar";
import { useTodayYmd } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { useMemo } from "react";

export function CalendarBanners() {
  const { data } = useCalendar();
  const today = useTodayYmd();
  const alerts = useMemo(() => (data ? calendarAlerts(data, today) : []), [data, today]);
  if (alerts.length === 0) return null;

  return (
    <div className="border-b border-border bg-card/95 px-3 py-2 backdrop-blur md:px-6">
      <ul className="space-y-1.5">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm",
              a.daysLeft === 0
                ? "border-warn/45 bg-warn/10"
                : "border-primary/20 bg-primary/5",
            )}
          >
            <CalendarDays
              className={cn("mt-0.5 h-4 w-4 shrink-0", a.daysLeft === 0 ? "text-warn" : "text-primary")}
            />
            <p className="min-w-0 leading-snug">
              <span className="font-medium">{a.message}</span>
              <span className="ml-2 text-xs text-muted-foreground">{formatViDate(a.occurDate)}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}