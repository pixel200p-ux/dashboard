import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolio, type PortfolioPayload } from "@/lib/api/portfolio";
import { toast } from "sonner";

export const PORTFOLIO_KEY = ["portfolio"] as const;

export function usePortfolio() {
  return useQuery({
    queryKey: PORTFOLIO_KEY,
    queryFn: () => fetchPortfolio(),
    staleTime: 5_000,
  });
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
