import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Kpi({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "profit" | "loss" | "default";
  className?: string;
}) {
  return (
    <Card className={cn("flex h-full flex-col p-4", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-lg font-semibold tabular-nums sm:text-xl",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-auto pt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );
}
