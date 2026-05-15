"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { api } from "@/lib/api-client";
import {
  Mail,
  Eye,
  Code,
  Save,
  ImageIcon,
  Copy,
  Check,
  Send,
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Undo,
  Redo,
  Palette,
  Minus,
  Type,
  Loader2,
} from "lucide-react";

interface TagInfo {
  tag: string;
  description: string;
}

interface EmailTemplate {
  id: string;
  type: string;
  subject: string;
  htmlBody: string;
  availableTags: string;
  isActive: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  welcome: "Chào mừng",
  "order-confirmation": "Xác nhận đơn hàng",
  "status-change": "Thay đổi trạng thái",
  "password-reset": "Đặt lại mật khẩu",
  "review-request": "Yêu cầu đánh giá (gửi lần đầu)",
  "review-reminder": "Yêu cầu đánh giá (gửi nhắc nhở)",
  "review-reward": "Phần thưởng đánh giá",
  "low-stock-alert": "Thông báo hết hàng",
  "affiliate-welcome": "Người giới thiệu: Chào mừng",
  "affiliate-payment-request-admin":
    "Người giới thiệu: Yêu cầu thanh toán (admin)",
  "affiliate-payment-received": "Người giới thiệu: Đã nhận thanh toán",
};

const COLORS = [
  "#1a1a2e",
  "#525f7f",
  "#8898aa",
  "#e0a526",
  "#e74c3c",
  "#27ae60",
  "#2980b9",
  "#8e44ad",
  "#f39c12",
  "#ffffff",
];

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("URL của link:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt("URL của ảnh:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const btnClass = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-border px-2 py-1.5 bg-muted/30">
      <button
        onClick={() => editor.chain().focus().undo().run()}
        className={btnClass(false)}
        title="Hoàn tác"
      >
        <Undo className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        className={btnClass(false)}
        title="Làm lại"
      >
        <Redo className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive("bold"))}
        title="In đậm"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive("italic"))}
        title="In nghiêng"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass(editor.isActive("underline"))}
        title="Gạch chân"
      >
        <UnderlineIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(editor.isActive("strike"))}
        title="Gạch ngang"
      >
        <Strikethrough className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={btnClass(editor.isActive("paragraph"))}
        title="Đoạn văn"
      >
        <Type className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btnClass(editor.isActive("heading", { level: 1 }))}
        title="Tiêu đề 1"
      >
        <Heading1 className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive("heading", { level: 2 }))}
        title="Tiêu đề 2"
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive("heading", { level: 3 }))}
        title="Tiêu đề 3"
      >
        <Heading3 className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive("bulletList"))}
        title="Danh sách"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive("orderedList"))}
        title="Danh sách đánh số"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btnClass(false)}
        title="Đường kẻ ngang"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={btnClass(editor.isActive({ textAlign: "left" }))}
        title="Căn trái"
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={btnClass(editor.isActive({ textAlign: "center" }))}
        title="Căn giữa"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={btnClass(editor.isActive({ textAlign: "right" }))}
        title="Căn phải"
      >
        <AlignRight className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className={btnClass(false)}
          title="Màu chữ"
        >
          <Palette className="h-4 w-4" />
        </button>
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-popover border border-border rounded-lg shadow-lg z-50 grid grid-cols-5 gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  editor.chain().focus().setColor(color).run();
                  setShowColorPicker(false);
                }}
                className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <button
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setShowColorPicker(false);
              }}
              className="w-6 h-6 rounded border border-border text-xs hover:bg-muted col-span-5 text-center"
            >
              Xóa màu
            </button>
          </div>
        )}
      </div>

      <button
        onClick={addLink}
        className={btnClass(editor.isActive("link"))}
        title="Thêm link"
      >
        <LinkIcon className="h-4 w-4" />
      </button>
      <button
        onClick={addImage}
        className={btnClass(false)}
        title="Chèn ảnh (URL)"
      >
        <ImageIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AdminEmailsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [viewMode, setViewMode] = useState<"visual" | "code" | "preview">(
    "visual",
  );
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [error, setError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false }),
      Image,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
    ],
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      setEditBody(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[440px] px-4 py-3",
      },
    },
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data } = await api.get("/email-templates");
      return (data.data ?? data) as EmailTemplate[];
    },
  });

  const { data: galleryData } = useQuery({
    queryKey: ["media-gallery", gallerySearch],
    queryFn: async () => {
      const params: Record<string, string> = { perPage: "20" };
      if (gallerySearch) params.search = gallerySearch;
      const { data } = await api.get("/media", { params });
      return data;
    },
    enabled: showGallery,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      subject: string;
      htmlBody: string;
    }) => {
      const { data: result } = await api.put(`/email-templates/${data.id}`, {
        subject: data.subject,
        htmlBody: data.htmlBody,
      });
      return result;
    },
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (err: unknown) => {
      const resp = (
        err as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setError(resp?.error?.message ?? "Lỗi khi lưu template");
    },
  });

  const testMutation = useMutation({
    mutationFn: async (data: {
      type: string;
      email: string;
      subject: string;
      htmlBody: string;
    }) => {
      const { data: result } = await api.post(
        `/email-templates/${data.type}/test`,
        {
          email: data.email,
          subject: data.subject,
          htmlBody: data.htmlBody,
        },
      );
      return result;
    },
    onError: (err: unknown) => {
      const resp = (
        err as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setError(resp?.error?.message ?? "Lỗi khi gửi email");
    },
  });

  const selectedTemplate = templates?.find(
    (t: EmailTemplate) => t.id === selectedId,
  );
  let availableTags: TagInfo[] = [];
  try {
    availableTags = selectedTemplate
      ? JSON.parse(selectedTemplate.availableTags)
      : [];
  } catch {
    availableTags = [];
  }

  const selectTemplate = useCallback(
    (tpl: EmailTemplate) => {
      setSelectedId(tpl.id);
      setEditSubject(tpl.subject);
      setEditBody(tpl.htmlBody);

      setViewMode(/<table\b/i.test(tpl.htmlBody) ? "code" : "visual");
      testMutation.reset();
      updateMutation.reset();
      if (editor) {
        editor.commands.setContent(tpl.htmlBody, { emitUpdate: false });
      }
    },
    [editor, testMutation, updateMutation],
  );

  function handleSave() {
    if (!selectedId) return;
    updateMutation.mutate({
      id: selectedId,
      subject: editSubject,
      htmlBody: editBody,
    });
  }

  function handleSendTest() {
    if (!selectedTemplate || !testEmail) return;
    testMutation.mutate({
      type: selectedTemplate.type,
      email: testEmail,
      subject: editSubject,
      htmlBody: editBody,
    });
  }

  function insertTagAtCursor(tag: string) {
    const placeholder = `{{${tag}}}`;
    if (viewMode === "visual" && editor) {
      editor.chain().focus().insertContent(placeholder).run();
      setEditBody(editor.getHTML());
    } else {
      setEditBody((prev) => prev + placeholder);
      if (editor)
        editor.commands.setContent(editBody + placeholder, {
          emitUpdate: false,
        });
    }
  }

  function copyTag(tag: string) {
    navigator.clipboard.writeText(`{{${tag}}}`);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  }

  function copyAllTags(tags: TagInfo[]) {
    if (!tags.length) return;
    const text = tags.map((t) => `{{${t.tag}}} — ${t.description}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedTag("__all__");
    setTimeout(() => setCopiedTag(null), 1500);
  }

  function insertImage(url: string, alt: string) {
    if (viewMode === "visual" && editor) {
      editor.chain().focus().setImage({ src: url, alt }).run();
      setEditBody(editor.getHTML());
    } else {
      const imgHtml = `<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:6px" />`;
      setEditBody((prev) => prev + imgHtml);
      if (editor)
        editor.commands.setContent(editBody + imgHtml, { emitUpdate: false });
    }
    setShowGallery(false);
  }

  function switchToCode() {
    setViewMode("code");
  }

  function switchToVisual() {
    if (editor) editor.commands.setContent(editBody, { emitUpdate: false });
    setViewMode("visual");
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Quản lý Email</h1>
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Quản lý Email</h1>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-2">
          {templates?.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => selectTemplate(tpl)}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${
                selectedId === tpl.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {TYPE_LABELS[tpl.type] ?? tpl.type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {tpl.subject}
              </p>
            </button>
          ))}
        </div>

        {selectedTemplate ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Tiêu đề Email
              </label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sử dụng các thẻ như {"{{name_client}}"} trong tiêu đề
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={switchToVisual}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm ${
                  viewMode === "visual"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Type className="h-3.5 w-3.5" />
                Visual
              </button>
              <button
                onClick={switchToCode}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm ${
                  viewMode === "code"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Code className="h-3.5 w-3.5" />
                HTML
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm ${
                  viewMode === "preview"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                onClick={() => setShowGallery(!showGallery)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-muted text-muted-foreground hover:text-foreground"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Thư viện ảnh
              </button>
              <div className="flex-1" />
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1 px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
              </button>
            </div>

            {updateMutation.isSuccess && (
              <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-3 py-2 text-sm">
                Lưu template thành công!
              </div>
            )}
            {testMutation.isSuccess && (
              <div className="bg-blue-50 text-blue-700 border border-blue-200 rounded-md px-3 py-2 text-sm">
                Email thử nghiệm đã được gửi tới {testEmail}!
              </div>
            )}

            {showGallery && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Tìm kiếm ảnh..."
                    value={gallerySearch}
                    onChange={(e) => setGallerySearch(e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => setShowGallery(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Đóng
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                  {galleryData?.data?.map(
                    (img: {
                      id: string;
                      card?: string;
                      gallery?: string;
                      full?: string;
                      thumb?: string;
                      alt?: string;
                      filename?: string;
                    }) => (
                      <button
                        key={img.id}
                        onClick={() =>
                          insertImage(
                            img.card ?? img.gallery ?? img.full ?? "",
                            img.alt ?? img.filename ?? "",
                          )
                        }
                        className="aspect-square rounded border overflow-hidden hover:ring-2 ring-primary"
                      >
                        <img
                          src={img.thumb || img.card}
                          alt={img.alt || img.filename}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ),
                  ) ?? (
                    <p className="col-span-full text-sm text-muted-foreground">
                      Không có ảnh trong thư viện
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
              <div>
                {viewMode === "visual" ? (
                  <div className="border rounded-md overflow-hidden bg-white">
                    <EditorToolbar editor={editor!} />
                    <EditorContent editor={editor} />
                  </div>
                ) : viewMode === "code" ? (
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full h-[500px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
                    spellCheck={false}
                  />
                ) : (
                  <div className="border rounded-md bg-white overflow-auto h-[500px]">
                    <iframe
                      srcDoc={editBody}
                      className="w-full h-full border-0"
                      title="Email Preview"
                      sandbox=""
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Tags có sẵn</h3>
                    <button
                      type="button"
                      onClick={() => copyAllTags(availableTags)}
                      disabled={availableTags.length === 0}
                      className="flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Sao chép tất cả các thẻ"
                    >
                      {copiedTag === "__all__" ? (
                        <>
                          <Check className="h-3 w-3 text-green-500" />
                          Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Sao chép tất cả
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nhấn vào thẻ để chèn vào con trỏ. Sử dụng biểu tượng để sao
                    chép.
                  </p>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {availableTags.map((tagInfo) => (
                      <div
                        key={tagInfo.tag}
                        className="flex items-center gap-1.5 group"
                      >
                        <button
                          onClick={() => insertTagAtCursor(tagInfo.tag)}
                          className="flex-1 text-left rounded border px-2 py-1.5 text-xs font-mono bg-muted/50 hover:bg-primary/10 hover:border-primary/30 transition-colors"
                          title={`Chèn {{${tagInfo.tag}}}`}
                        >
                          <span className="text-primary">{`{{${tagInfo.tag}}}`}</span>
                          <span className="block text-muted-foreground text-[10px] mt-0.5">
                            {tagInfo.description}
                          </span>
                        </button>
                        <button
                          onClick={() => copyTag(tagInfo.tag)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Sao chép thẻ"
                        >
                          {copiedTag === tagInfo.tag ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    Gửi thử nghiệm
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Gửi template này với dữ liệu ví dụ đến email đã cho.
                  </p>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={testMutation.isPending || !testEmail}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {testMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Đang gửi...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Gửi Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Chọn một template để chỉnh sửa</p>
          </div>
        )}
      </div>
    </div>
  );
}
