"use client";

import { Gift, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/constants";
import { useFreeGift } from "@/hooks/use-free-gift";

export function FreeGiftProgress({
  compact = false,
  subtotalOverride,
}: {
  compact?: boolean;

  subtotalOverride?: number;
}) {
  const { activeGift, isUnlocked, amountLeft, progress } = useFreeGift({
    subtotalOverride,
  });

  if (!activeGift) return null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-purple-500/5",
        isUnlocked ? "border-purple-500/30" : "border-purple-500/20",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      {isUnlocked ? (
        <div className="flex items-center gap-2">
          <Gift
            className={cn(
              "shrink-0 text-purple-400",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
          />
          <span
            className={cn(
              "text-purple-400 font-medium",
              compact ? "text-xs" : "text-sm",
            )}
          >
            Bạn đã nhận: {activeGift.label}
          </span>
        </div>
      ) : (
        <>
          <p className={cn("text-white/70", compact ? "text-xs" : "text-sm")}>
            Còn thiếu{" "}
            <span className="font-bold text-purple-400">
              {formatCurrency(amountLeft)}
            </span>{" "}
            để nhận{" "}
            <span className="text-purple-400 font-medium">
              {activeGift.label}
            </span>
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-magenta transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <CheckCircle2
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                progress >= 100 ? "text-purple-400" : "text-white/15",
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
