"use client";

import { useState } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { extractError } from "@/lib/extract-error";
import { revalidateAllSite } from "./_actions";

type FlushResult = {
  flushed: string[];
  failed: string[];
  scannedCount: number;
};

export function FlushCacheButton() {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [result, setResult] = useState<FlushResult | null>(null);

  async function handleFlush() {
    if (state === "loading") return;
    if (
      !confirm(
        "Clear site cache? All subsequent requests will fetch fresh data from the database.",
      )
    )
      return;
    setState("loading");
    setError("");
    setResult(null);
    try {
      const res = await api.post<{ data: FlushResult }>(
        "/admin/site/cache/flush",
      );
      const flushResult = res.data?.data ?? {
        flushed: [],
        failed: [],
        scannedCount: 0,
      };
      setResult(flushResult);
      await revalidateAllSite();

      if (flushResult.failed.length > 0) {
        setState("error");
        setError(
          `${flushResult.failed.length} of ${flushResult.scannedCount} keys failed to clear`,
        );
        setTimeout(() => {
          setState("idle");
          setResult(null);
        }, 8000);
      } else {
        setState("ok");
        setTimeout(() => {
          setState("idle");
          setResult(null);
        }, 5000);
      }
    } catch (err) {
      setError(extractError(err));
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  }

  const okLabel =
    result && state === "ok"
      ? `${result.flushed.length} key${result.flushed.length === 1 ? "" : "s"} flushed`
      : "Cache cleared";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleFlush}
        disabled={state === "loading"}
        data-testid="flush-cache-button"
      >
        {state === "loading" ? (
          <RefreshCw className="size-4 animate-spin" />
        ) : state === "ok" ? (
          <Check className="size-4 text-lime" />
        ) : state === "error" ? (
          <AlertCircle className="size-4 text-magenta" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {state === "loading"
          ? "Clearing…"
          : state === "ok"
            ? okLabel
            : state === "error"
              ? "Error"
              : "Clear cache"}
      </Button>
      {error && <p className="text-[11px] text-magenta">{error}</p>}
      {state === "ok" && result && result.scannedCount === 0 && (
        <p className="text-[11px] text-fog/60">Cache was already empty.</p>
      )}
    </div>
  );
}
