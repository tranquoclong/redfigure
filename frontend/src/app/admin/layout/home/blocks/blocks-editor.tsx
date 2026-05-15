"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { extractError } from "@/lib/extract-error";
import {
  BLOCK_TYPES,
  type AnyHomeBlock,
  type BlockType,
  type HomeBlocksResponse,
} from "@/lib/home-blocks";
import { revalidateHomeBlocks } from "../../_actions";
import {
  createBlockOfType,
  SINGLETON_TYPES,
  TYPE_DESCRIPTIONS,
  TYPE_LABELS,
} from "./block-defaults";
import { BlockForm } from "./block-forms";

export function BlocksEditor() {
  const qc = useQueryClient();
  const [blocks, setBlocks] = useState<AnyHomeBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [pendingType, setPendingType] = useState<BlockType | "">("");

  const { isLoading } = useQuery({
    queryKey: ["admin", "home-blocks"],
    queryFn: async () => {
      const { data } = await api.get<{ data: HomeBlocksResponse }>(
        "/admin/site/home-blocks",
      );
      const next = [...data.data.blocks].sort((a, b) => a.order - b.order);
      setBlocks(next);
      setDirty(false);
      return data.data;
    },
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: AnyHomeBlock[]) => {
      const { data } = await api.put<{ data: HomeBlocksResponse }>(
        "/admin/site/home-blocks",
        { blocks: input },
      );
      return data.data;
    },
    onSuccess: async (resp) => {
      setBlocks([...resp.blocks].sort((a, b) => a.order - b.order));
      setDirty(false);
      setSaveError("");
      setSaveSuccess("Đã lưu · cập nhật trang chủ");
      await revalidateHomeBlocks();
      await qc.invalidateQueries({ queryKey: ["admin", "home-blocks"] });
      setTimeout(() => setSaveSuccess(""), 3000);
    },
    onError: (err) => {
      setSaveError(extractError(err));
      setSaveSuccess("");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((current) => {
      const oldIdx = current.findIndex((b) => b.id === active.id);
      const newIdx = current.findIndex((b) => b.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return current;
      const next = arrayMove(current, oldIdx, newIdx);

      return next.map((b, i) => ({ ...b, order: i }));
    });
    setDirty(true);
  }

  function toggleActive(id: string) {
    setBlocks((cur) =>
      cur.map((b) => (b.id === id ? { ...b, isActive: !b.isActive } : b)),
    );
    setDirty(true);
  }

  function removeBlock(id: string) {
    if (!confirm("Chắc chắn muốn xóa block này?")) return;
    setBlocks((cur) => cur.filter((b) => b.id !== id));
    setDirty(true);
  }

  function updateBlockData(id: string, patch: Partial<AnyHomeBlock["data"]>) {
    setBlocks((cur) =>
      cur.map((b) =>
        b.id === id
          ? ({ ...b, data: { ...b.data, ...patch } } as AnyHomeBlock)
          : b,
      ),
    );
    setDirty(true);
  }

  function addBlock(type: BlockType) {
    const exists = blocks.some((b) => b.type === type);
    if (exists && SINGLETON_TYPES.has(type)) {
      const ok = confirm(
        `Loại "${TYPE_LABELS[type]}" thường chỉ có 1 ở trang chủ. Vẫn muốn thêm một bản sao thứ 2?`,
      );
      if (!ok) return;
    }
    const newBlock = createBlockOfType(type, blocks.length);
    setBlocks((cur) => [...cur, newBlock]);
    setDirty(true);

    setEditingId(newBlock.id);
  }

  const editingBlock = editingId
    ? (blocks.find((b) => b.id === editingId) ?? null)
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Page Builder · Home Page</CardTitle>
            <p className="mt-1 text-xs text-white/55">
              Kéo theo tay cầm <GripVertical className="inline size-3" /> để sắp
              xếp lại. Toggle để tắt mà không mất văn bản. Lưu vào máy chủ bằng
              nút trên cùng bên phải.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Select
                value={pendingType}
                onValueChange={(v) => setPendingType(v as BlockType)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Chọn loại block…" />
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pendingType}
                onClick={() => {
                  if (pendingType) {
                    addBlock(pendingType);
                    setPendingType("");
                  }
                }}
              >
                <Plus className="size-4" /> Thêm
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!dirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate(blocks)}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {dirty ? "Lưu" : "Đã lưu"}
              </Button>
            </div>
            {pendingType && (
              <p className="text-[11px] text-white/55">
                {TYPE_DESCRIPTIONS[pendingType]}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {saveError && (
          <div className="flex items-start gap-2 rounded-md border border-magenta/40 bg-magenta/10 p-3 text-sm text-magenta">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccess && (
          <div className="rounded-md border border-lime/40 bg-lime/10 p-3 text-sm text-lime">
            ✓ {saveSuccess}
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-white/55">Đang tải...</p>
        ) : blocks.length === 0 ? (
          <p className="rounded-md border border-white/10 bg-black/30 p-6 text-center text-sm text-white/55">
            Chưa có block. Dùng &ldquo;Thêm block&rdquo; để bắt đầu.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((block) => (
                <SortableBlockRow
                  key={block.id}
                  block={block}
                  onEdit={() => setEditingId(block.id)}
                  onToggle={() => toggleActive(block.id)}
                  onRemove={() => removeBlock(block.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      <Dialog
        open={editingBlock !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {editingBlock && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Chỉnh sửa · {TYPE_LABELS[editingBlock.type]}
                </DialogTitle>
              </DialogHeader>
              <BlockForm
                block={editingBlock}
                onChange={(patch) => updateBlockData(editingBlock.id, patch)}
              />
              <DialogFooter>
                <Button onClick={() => setEditingId(null)}>Xong</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface SortableBlockRowProps {
  block: AnyHomeBlock;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

function SortableBlockRow({
  block,
  onEdit,
  onToggle,
  onRemove,
}: SortableBlockRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-md border bg-black/30 p-3 transition-colors ${
        block.isActive ? "border-white/10" : "border-white/5 opacity-60"
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-white/40 hover:text-white active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Arrastar pra reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold uppercase tracking-wider text-white">
            {TYPE_LABELS[block.type]}
          </span>
          {!block.isActive && (
            <span className="rounded border border-white/15 bg-white/5 px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-wider text-white/55">
              Không hoạt động
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-white/55">
          {TYPE_DESCRIPTIONS[block.type]}
        </p>
      </div>
      <Switch
        checked={block.isActive}
        onCheckedChange={onToggle}
        aria-label="Kích hoạt"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onEdit}
        aria-label="Chỉnh sửa block"
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Xóa block"
        className="text-magenta hover:text-magenta hover:bg-magenta/10"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
