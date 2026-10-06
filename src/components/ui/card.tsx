import type { HTMLAttributes, ReactNode } from "react";
import { useContext, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CollapsibleCardGroupContext } from "./collapsible-card-group-context";

export function CollapsibleCardGroup({
  children,
  defaultOpen = true,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const groupState = {
    open,
    toggle: () => setOpen((previous) => !previous),
    openAll: () => setOpen(true),
  };

  return (
    <CollapsibleCardGroupContext.Provider value={groupState}>
      {children}
    </CollapsibleCardGroupContext.Provider>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-dragon-block=""
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-(--shadow-card) backdrop-blur-[14px] sm:p-5 min-w-0 overflow-hidden",
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
  const group = useContext(CollapsibleCardGroupContext);
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = group?.open ?? localOpen;

  return (
    <div data-dragon-block="" className={cn("rounded-xl border border-border bg-card p-4 text-card-foreground shadow-(--shadow-card) backdrop-blur-[14px] sm:p-5 min-w-0 overflow-hidden", className)}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          onClick={() => group ? group.toggle() : setLocalOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold tracking-tight text-foreground">{title}</div>
            {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
          </div>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {headerAction ? (
          <span
            className="shrink-0"
            onClickCapture={() => {
              if (group) group.openAll();
              else setLocalOpen(true);
            }}
          >
            {headerAction}
          </span>
        ) : null}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
