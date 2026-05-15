"use client";

import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImagePicker } from "./image-picker";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  simple?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  simple,
}: RichTextEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [pickedImage, setPickedImage] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-invert max-w-none min-h-[200px] px-4 py-3 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && value && !htmlMode && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value, htmlMode]);

  if (!editor) return null;

  function openImageDialog() {
    setPickedImage(null);
    setImageDialogOpen(true);
  }

  function confirmInsertImage() {
    if (pickedImage && editor) {
      editor.chain().focus().setImage({ src: pickedImage }).run();
    }
    setImageDialogOpen(false);
    setPickedImage(null);
  }

  function insertLink() {
    const url = prompt("URL link:");
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="In đậm"
        >
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="In nghiêng"
        >
          <Italic className="h-4 w-4" />
        </ToolBtn>
        {!simple && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <ToolBtn
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              active={editor.isActive("heading", { level: 2 })}
              title="Tiêu đề H2"
            >
              <Heading2 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              active={editor.isActive("heading", { level: 3 })}
              title="Tiêu đề H3"
            >
              <Heading3 className="h-4 w-4" />
            </ToolBtn>
          </>
        )}
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Danh sách"
        >
          <List className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Danh sách có đánh số"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn onClick={insertLink} title="Liên kết">
          <LinkIcon className="h-4 w-4" />
        </ToolBtn>
        {!simple && (
          <ToolBtn onClick={openImageDialog} title="Hình ảnh">
            <ImageIcon className="h-4 w-4" />
          </ToolBtn>
        )}
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn
          onClick={() => editor.chain().focus().undo().run()}
          title="Hoàn tác"
        >
          <Undo className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().redo().run()}
          title="Làm lại"
        >
          <Redo className="h-4 w-4" />
        </ToolBtn>

        <div className="flex-1" />
        <Button
          variant={htmlMode ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            if (htmlMode) {
              editor.commands.setContent(value);
            }
            setHtmlMode(!htmlMode);
          }}
        >
          <Code className="h-3 w-3 mr-1" />
          HTML
        </Button>
      </div>

      {htmlMode ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={10}
          className="border-0 rounded-none font-mono text-sm focus-visible:ring-0"
        />
      ) : (
        <EditorContent editor={editor} />
      )}

      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hình ảnh</DialogTitle>
          </DialogHeader>
          <ImagePicker
            value={pickedImage}
            onChange={setPickedImage}
            variant="gallery"
            aspectRatio="auto"
            helperText="Upload mới hoặc chọn từ thư viện."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={confirmInsertImage} disabled={!pickedImage}>
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded hover:bg-muted transition-colors",
        active && "bg-muted text-primary",
      )}
    >
      {children}
    </button>
  );
}
