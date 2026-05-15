"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { extractError } from "@/lib/extract-error";
import { revalidateAllSite } from "./_actions";

type StatusResponse = { data: { disabled: boolean } };

export function CacheToggle() {
  const [disabled, setDisabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get<StatusResponse>("/admin/site/cache/status");
        if (alive) setDisabled(Boolean(res.data?.data?.disabled));
      } catch {
        if (alive) setDisabled(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleChange(next: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    const previous = disabled;
    setDisabled(next);
    try {
      await api.post("/admin/site/cache/toggle", { disabled: next });

      await revalidateAllSite();
    } catch (err) {
      setDisabled(previous);
      setError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  if (disabled === null) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-fog/40">
        Cache: …
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-[12px] cursor-pointer select-none">
        <span className="text-fog/80">
          {disabled ? "Cache disabled" : "Cache active"}
        </span>
        <Switch
          checked={disabled}
          onCheckedChange={handleChange}
          disabled={busy}
          aria-label="Desabilitar cache do site"
          data-testid="cache-toggle"
        />
      </label>
      {disabled && (
        <p className="text-[11px] text-amber-500">
          ⚠ Hiệu năng giảm sút — hãy tắt sau khi kiểm tra.
        </p>
      )}
      {error && <p className="text-[11px] text-magenta">{error}</p>}
    </div>
  );
}
