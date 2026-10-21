import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolio, type PortfolioPayload } from "@/lib/api/portfolio";
import { ensurePortfolioPriceSnapshot } from "@/lib/api/prices";
import { todayVnYmd } from "@/engine/dates";
import { toast } from "sonner";

export const PORTFOLIO_KEY = ["portfolio"] as const;

let snapshotAttemptDate: string | null = null;

export function usePortfolio() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: PORTFOLIO_KEY,
    queryFn: () => fetchPortfolio(),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!query.data || snapshotAttemptDate === todayVnYmd()) return;
    const asOf = todayVnYmd();
    snapshotAttemptDate = asOf;

    void ensurePortfolioPriceSnapshot()
      .then((updated) => {
        if (updated) queryClient.setQueryData(PORTFOLIO_KEY, updated);
      })
      .catch((error: unknown) => {
        snapshotAttemptDate = null;
        console.error("[price snapshot]", error);
      });
  }, [query.data, queryClient]);

  return query;
}

export function usePortfolioMutation<TArgs>(
  fn: (args: TArgs) => Promise<PortfolioPayload>,
  ok = "Đã lưu",
  refreshCalendar = false,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(PORTFOLIO_KEY, data);
      if (refreshCalendar) {
        void qc.invalidateQueries({ queryKey: ["calendar"] });
      }
      toast.success(ok);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Không lưu được");
    },
  });
}
