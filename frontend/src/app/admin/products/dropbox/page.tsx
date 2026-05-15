"use client";

import { DropboxBrowser } from "@/components/admin/dropbox-browser";

export default function DropboxBrowsePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Đồng bộ với Dropbox</h1>
      <DropboxBrowser />
    </div>
  );
}
