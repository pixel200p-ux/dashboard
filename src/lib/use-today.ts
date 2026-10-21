import { useEffect, useState } from "react";
import { todayYmd } from "@/engine/dates";

export function useTodayYmd(): string {
  const [today, setToday] = useState(todayYmd);

  useEffect(() => {
    const refreshToday = () => setToday(todayYmd());
    const intervalId = window.setInterval(refreshToday, 60_000);
    document.addEventListener("visibilitychange", refreshToday);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshToday);
    };
  }, []);

  return today;
}
