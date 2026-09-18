import type { HTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-(--shadow-card) sm:p-5 min-w-0 overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight", className)} {...props} />;
}

export function CardDesc({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CollapsibleCard({
  title,
  description,
  headerAction,
  className,
  defaultOpen = true,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 text-card-foreground shadow-(--shadow-card) sm:p-5 min-w-0 overflow-hidden", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold tracking-tight text-foreground">{title}</div>
          {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          {headerAction ? (
            <span
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {headerAction}
            </span>
          ) : null}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
