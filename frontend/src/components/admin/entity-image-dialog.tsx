"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "./image-picker";

interface EntityImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  currentValue: string | null;

  onSave: (url: string | null) => Promise<void>;
  variant?: "thumb" | "card" | "gallery" | "full";
  aspectRatio?: "square" | "1200x630" | "auto";
  helperText?: string;
}

export function EntityImageDialog({
  open,
  onOpenChange,
  title,
  currentValue,
  onSave,
  variant = "full",
  aspectRatio = "auto",
  helperText,
}: EntityImageDialogProps) {
  const [local, setLocal] = useState<string | null>(currentValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setLocal(currentValue);
  }, [open, currentValue]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(local);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <ImagePicker
          value={local}
          onChange={setLocal}
          variant={variant}
          aspectRatio={aspectRatio}
          helperText={helperText}
          disabled={saving}
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
