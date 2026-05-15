"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { TopBarMessage } from "@/lib/site-content";
import { revalidateTopBar, revalidateMarquee } from "../_actions";

import { extractError } from "@/lib/extract-error";
interface TopBarPayload {
  messages: TopBarMessage[];
}
interface MarqueePayload {
  items: string[];
}

function TopBarCard() {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [messages, setMessages] = useState<TopBarMessage[]>([]);
  const [serverKey, setServerKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "site", "topbar"],
    queryFn: async () => {
      const { data } = await api.get<{ data: TopBarPayload }>("/site/topbar");
      return data.data;
    },
  });

  if (query.data) {
    const fresh = JSON.stringify(query.data.messages);
    if (fresh !== serverKey) {
      setServerKey(fresh);
      setMessages(query.data.messages);
    }
  }
  const hydrated = serverKey !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: TopBarPayload = { messages };
      await api.put("/admin/site/topbar", payload);

      try {
        await revalidateTopBar();
      } catch {}
    },
    onSuccess: () => {
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateMessage = (index: number, patch: Partial<TopBarMessage>) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );
  };
  const addMessage = () => {
    setMessages((prev) => [...prev, { text: "", align: "right" }]);
  };
  const removeMessage = (index: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Header</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Thông báo hiển thị trên cùng của trang. Bên trái/phải xác định xem nó
          xuất hiện ở bên trái hay bên phải của thanh.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {query.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        )}

        {hydrated && (
          <div className="space-y-2">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <Input
                  value={msg.text}
                  onChange={(e) => updateMessage(idx, { text: e.target.value })}
                  placeholder="Nội dung thông báo"
                  className="flex-1"
                />
                <select
                  value={msg.align}
                  onChange={(e) =>
                    updateMessage(idx, {
                      align: e.target.value as "left" | "right",
                    })
                  }
                  className="h-10 px-3 text-sm"
                >
                  <option value="left">Trái</option>
                  <option value="right">Phải</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMessage(idx)}
                  disabled={messages.length === 1}
                  title={
                    messages.length === 1
                      ? "Phải có ít nhất 1 thông báo"
                      : "Xóa"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMessage}
            >
              <Plus className="h-4 w-4 mr-1" /> Thêm thông báo
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !hydrated}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Lưu Header
              </>
            )}
          </Button>
          {saved && (
            <span className="text-sm text-green-500">
              Đã lưu! Trang web được cập nhật.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MarqueeCard() {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [serverKey, setServerKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "site", "marquee"],
    queryFn: async () => {
      const { data } = await api.get<{ data: MarqueePayload }>("/site/marquee");
      return data.data;
    },
  });

  if (query.data) {
    const fresh = JSON.stringify(query.data.items);
    if (fresh !== serverKey) {
      setServerKey(fresh);
      setItems(query.data.items);
    }
  }
  const hydrated = serverKey !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      await api.put("/admin/site/marquee", { items });
      try {
        await revalidateMarquee();
      } catch {}
    },
    onSuccess: () => {
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateItem = (index: number, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === index ? value : it)));
  };
  const addItem = () => setItems((prev) => [...prev, ""]);
  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Marquee (dải chạy dưới hero)</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Thông báo ngắn chạy vô hạn. Xuất hiện xen kẽ với ★.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {query.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        )}

        {hydrated && (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <Input
                  value={item}
                  onChange={(e) => updateItem(idx, e.target.value)}
                  placeholder="Ví dụ: NHỰA CAO CẤP"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" /> Thêm item
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !hydrated}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Lưu Marquee
              </>
            )}
          </Button>
          {saved && <span className="text-sm text-green-500">Đã lưu!</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function HeaderForm() {
  return (
    <div className="space-y-6">
      <TopBarCard />
      <MarqueeCard />
    </div>
  );
}
