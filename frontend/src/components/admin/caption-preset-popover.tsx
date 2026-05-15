"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Tags } from "lucide-react";
import { api } from "@/lib/api-client";

export interface CaptionPreset {
  id: string;
  name: string;
  text: string;
}

export function CaptionPresetButton({
  onPick,
  className,
}: {
  onPick: (preset: { id: string; name: string; text: string }) => void;
  className?: string;
}) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const { data: presets = [] } = useQuery({
    queryKey: ["media-caption-presets"],
    queryFn: async () => {
      const { data } = await api.get("/settings/media-caption-presets");
      return (data.data ?? []) as CaptionPreset[];
    },
    staleTime: 60_000,
  });

  function handleClick() {
    if (anchorRect) {
      setAnchorRect(null);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setAnchorRect(rect);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={className ?? "p-1 rounded hover:bg-muted text-amber-500"}
        onClick={handleClick}
        title="Usar preset de legenda"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </button>
      {anchorRect && (
        <CaptionPresetPopover
          presets={presets}
          anchorRect={anchorRect}
          onPick={(preset) => {
            onPick(preset);
            setAnchorRect(null);
          }}
          onClose={() => setAnchorRect(null)}
        />
      )}
    </>
  );
}

export function CaptionPresetPopover({
  presets,
  anchorRect,
  onPick,
  onClose,
}: {
  presets: CaptionPreset[];
  anchorRect: DOMRect;
  onPick: (preset: { id: string; name: string; text: string }) => void;
  onClose: () => void;
}) {
  const width = 288;
  const estimatedHeight = Math.min(280, Math.max(80, 48 + presets.length * 56));
  const openUp =
    anchorRect.bottom + estimatedHeight + 8 > window.innerHeight &&
    anchorRect.top > estimatedHeight + 8;

  const top = openUp
    ? anchorRect.top - estimatedHeight - 4
    : anchorRect.bottom + 4;
  const right = Math.max(8, window.innerWidth - anchorRect.right);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        role="menu"
        className="fixed z-[61] rounded-md border bg-popover text-popover-foreground shadow-xl"
        style={{ top, right, width }}
      >
        <div className="p-2 text-[11px] text-muted-foreground flex items-center gap-1 border-b">
          <Tags className="h-3 w-3" /> Mẫu chú thích
        </div>
        {presets.length > 0 ? (
          <div className="max-h-64 overflow-y-auto">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-2 py-2 hover:bg-muted text-xs border-b last:border-b-0"
                onClick={() => onPick({ id: p.id, name: p.name, text: p.text })}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-2">
                  {p.text}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 text-[11px] text-muted-foreground">
            Chưa có mẫu nào được đăng ký. Quản lý trong <strong>Cài đặt</strong>
            .
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
