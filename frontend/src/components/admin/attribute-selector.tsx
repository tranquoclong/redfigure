"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Check, Trash2, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

interface AiMatchedAttr {
  attributeValueId: string;
  attributeName: string;
  value: string;
  confidence: "exact" | "fuzzy";
  aiOriginal?: string;
}

interface AiUnmatchedAttr {
  attributeName: string;
  value: string;
  confidence: "new";
}

interface AttributeSelectorProps {
  selectedValueIds: string[];
  onChange: (valueIds: string[]) => void;
  aiMatched?: AiMatchedAttr[];
  aiUnmatched?: AiUnmatchedAttr[];
  onPendingCountChange?: (count: number) => void;
}

interface AttrValue {
  id: string;
  value: string;
  slug: string;
}

interface Attr {
  id: string;
  name: string;
  slug: string;
  values: AttrValue[];
}

export function AttributeSelector({
  selectedValueIds,
  onChange,
  aiMatched,
  aiUnmatched,
  onPendingCountChange,
}: AttributeSelectorProps) {
  const queryClient = useQueryClient();
  const [newAttrName, setNewAttrName] = useState("");
  const [newValueFor, setNewValueFor] = useState<string | null>(null);
  const [newValueText, setNewValueText] = useState("");

  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());

  const [mergingKey, setMergingKey] = useState<string | null>(null);

  const pendingUnmatched = (aiUnmatched ?? []).filter(
    (u) => !resolvedKeys.has(`${u.attributeName}:${u.value}`),
  );

  useEffect(() => {
    onPendingCountChange?.(pendingUnmatched.length);
  }, [pendingUnmatched.length, onPendingCountChange]);

  const { data: attributes } = useQuery({
    queryKey: ["attributes"],
    queryFn: async () => {
      const { data } = await api.get("/attributes");
      return (data.data ?? data) as Attr[];
    },
  });

  const createAttr = useMutation({
    mutationFn: (name: string) => api.post("/attributes", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      setNewAttrName("");
    },
  });

  const createValue = useMutation({
    mutationFn: ({ attrId, value }: { attrId: string; value: string }) =>
      api.post(`/attributes/${attrId}/values`, { value }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      const created = res.data.data ?? res.data;
      onChange([...selectedValueIds, created.id]);
      setNewValueText("");
      setNewValueFor(null);
    },
  });

  function toggleValue(valueId: string) {
    if (selectedValueIds.includes(valueId)) {
      onChange(selectedValueIds.filter((id) => id !== valueId));
    } else {
      onChange([...selectedValueIds, valueId]);
    }
  }

  function markResolved(attrName: string, value: string) {
    setResolvedKeys((prev) => new Set(prev).add(`${attrName}:${value}`));
    setMergingKey(null);
  }

  function handleAccept(attrId: string, attrName: string, value: string) {
    createValue.mutate(
      { attrId, value },
      { onSuccess: () => markResolved(attrName, value) },
    );
  }

  function handleReject(attrName: string, value: string) {
    markResolved(attrName, value);
  }

  function handleMerge(
    existingValueId: string,
    attrName: string,
    aiValue: string,
  ) {
    if (!selectedValueIds.includes(existingValueId)) {
      onChange([...selectedValueIds, existingValueId]);
    }
    markResolved(attrName, aiValue);
  }

  return (
    <div className="space-y-4">
      {pendingUnmatched.length > 0 && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 flex items-center gap-2">
          <span className="text-blue-400 text-sm font-medium">
            {pendingUnmatched.length} thuộc tính mới từ AI cần xem xét
          </span>
          <span className="text-xs text-blue-400/60">
            — chấp nhận, từ chối hoặc hợp nhất trước khi xuất bản
          </span>
        </div>
      )}

      {attributes?.map((attr) => {
        const isCollection = attr.slug === "colecao";
        const attrPending = pendingUnmatched.filter(
          (u) => u.attributeName === attr.name,
        );

        return (
          <Card
            key={attr.id}
            className={isCollection ? "border-amber-500/30 bg-amber-500/5" : ""}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{attr.name}</CardTitle>
                {isCollection && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-500/50 text-amber-400"
                  >
                    Thủ công
                  </Badge>
                )}
                {attrPending.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-blue-500/50 text-blue-400"
                  >
                    {attrPending.length} mới từ AI cần xem xét
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-2">
                {attr.values.map((val) => {
                  const selected = selectedValueIds.includes(val.id);
                  const aiMatch = aiMatched?.find(
                    (m) => m.attributeValueId === val.id,
                  );
                  const aiLabel = aiMatch
                    ? aiMatch.confidence === "exact"
                      ? "AI"
                      : "Kiểm tra"
                    : null;
                  const aiColor = aiMatch
                    ? aiMatch.confidence === "exact"
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-amber-500/50 bg-amber-500/10"
                    : "";

                  return (
                    <Badge
                      key={val.id}
                      variant={selected ? "default" : "outline"}
                      className={`cursor-pointer ${selected && aiColor ? aiColor : ""}`}
                      onClick={() => toggleValue(val.id)}
                      title={
                        aiMatch?.aiOriginal
                          ? `AI đề xuất: "${aiMatch.aiOriginal}"`
                          : undefined
                      }
                    >
                      {val.value}
                      {aiLabel && (
                        <span
                          className={`ml-1 text-[9px] font-bold ${aiMatch?.confidence === "exact" ? "text-green-400" : "text-amber-400"}`}
                        >
                          {aiLabel}
                        </span>
                      )}
                      {selected && !aiLabel && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>

              {attrPending.map((u) => {
                const key = `${u.attributeName}:${u.value}`;
                const isMerging = mergingKey === key;

                return (
                  <div
                    key={key}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2.5 mb-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-blue-500/50 bg-blue-500/10 text-blue-300"
                        >
                          {u.value}
                          <span className="ml-1 text-[9px] font-bold text-blue-400">
                            Mới
                          </span>
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Đề xuất bởi AI
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          onClick={() =>
                            handleAccept(attr.id, u.attributeName, u.value)
                          }
                          title="Tạo giá trị này và chọn"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Chấp nhận
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleReject(u.attributeName, u.value)}
                          title="Từ chối"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Từ chối
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-cyan hover:bg-cyan/10"
                          onClick={() => setMergingKey(isMerging ? null : key)}
                          title="Giá trị này tương đương với một giá trị hiện có"
                        >
                          <GitMerge className="h-3 w-3 mr-1" />
                          Hợp nhất
                        </Button>
                      </div>
                    </div>

                    {isMerging && (
                      <div className="mt-2 pt-2 border-t border-blue-500/20">
                        <p className="text-xs text-muted-foreground mb-1.5">
                          Chọn giá trị hiện có tương đương với &quot;
                          {u.value}&quot;:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {attr.values.map((val) => (
                            <Badge
                              key={val.id}
                              variant="outline"
                              className="cursor-pointer hover:bg-cyan/10 hover:border-cyan/50"
                              onClick={() =>
                                handleMerge(val.id, u.attributeName, u.value)
                              }
                            >
                              {val.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {newValueFor === attr.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newValueText.trim())
                      createValue.mutate({
                        attrId: attr.id,
                        value: newValueText,
                      });
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={newValueText}
                    onChange={(e) => setNewValueText(e.target.value)}
                    placeholder="Giá trị mới..."
                    autoFocus
                    className="max-w-[200px] h-8 text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    OK
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setNewValueFor(null);
                      setNewValueText("");
                    }}
                  >
                    Hủy
                  </Button>
                </form>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setNewValueFor(attr.id);
                    setNewValueText("");
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Giá trị mới
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex gap-2">
        <Input
          placeholder="Thuộc tính mới (ví dụ: Giống loài)"
          value={newAttrName}
          onChange={(e) => setNewAttrName(e.target.value)}
          className="max-w-[250px]"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!newAttrName.trim()}
          onClick={() => createAttr.mutate(newAttrName)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Tạo Thuộc tính
        </Button>
      </div>
    </div>
  );
}
