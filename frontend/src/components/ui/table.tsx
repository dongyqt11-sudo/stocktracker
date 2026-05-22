import * as React from "react";

import { cn } from "../../lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-12 border-b border-[var(--border)] px-4 text-left text-xs font-semibold text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("h-[52px] border-b border-[var(--border-light)] px-4 align-middle text-text-primary", className)}
      {...props}
    />
  );
}
