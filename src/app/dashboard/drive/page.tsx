"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { uploadFile } from "@/lib/upload";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

type DriveItemDto = {
  _id: string;
  type: "folder" | "file";
  name: string;
  parent: string | null;
  url?: string;
  size?: number;
  contentType?: string;
  createdByName?: string;
  createdAt?: string;
};

function fileIcon(item: DriveItemDto) {
  const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
    return <FileImage className="h-10 w-10 text-violet-500" aria-hidden />;
  if (ext === "pdf")
    return <FileText className="h-10 w-10 text-rose-500" aria-hidden />;
  if (["xls", "xlsx", "csv"].includes(ext))
    return <FileSpreadsheet className="h-10 w-10 text-emerald-500" aria-hidden />;
  if (["doc", "docx", "txt"].includes(ext))
    return <FileText className="h-10 w-10 text-sky-500" aria-hidden />;
  return <File className="h-10 w-10 text-slate-400" aria-hidden />;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DrivePage() {
  const toast = useToast();
  const [parent, setParent] = useState<string | null>(null);
  const [items, setItems] = useState<DriveItemDto[] | null>(null);
  const [path, setPath] = useState<{ _id: string; name: string }[]>([]);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renaming, setRenaming] = useState<DriveItemDto | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const [deleting, setDeleting] = useState<DriveItemDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [uploading, setUploading] = useState(0);
  const [preview, setPreview] = useState<DriveItemDto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (parent) params.set("parent", parent);
    return api<{
      items: DriveItemDto[];
      path: { _id: string; name: string }[];
    }>(`/api/drive?${params}`)
      .then((data) => {
        setItems(data.items);
        setPath(data.path);
      })
      .catch(() => setItems([]));
  }, [parent]);

  useEffect(() => {
    load();
  }, [load]);

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api("/api/drive", {
        method: "POST",
        json: { type: "folder", name: folderName, parent },
      });
      toast.success(`Folder “${folderName}” created.`);
      setFolderModalOpen(false);
      setFolderName("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create folder.");
    } finally {
      setCreating(false);
    }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(files.length);
    let done = 0;
    for (const file of files) {
      try {
        const url = await uploadFile(file, "drive");
        await api("/api/drive", {
          method: "POST",
          json: {
            type: "file",
            name: file.name,
            parent,
            url,
            size: file.size,
            contentType: file.type,
          },
        });
        done++;
        setUploading(files.length - done);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `Could not upload ${file.name}.`
        );
      }
    }
    setUploading(0);
    if (done > 0)
      toast.success(`Uploaded ${done} file${done === 1 ? "" : "s"}.`);
    load();
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    setRenameBusy(true);
    try {
      await api("/api/drive", {
        method: "PATCH",
        json: { id: renaming._id, name: renameValue },
      });
      setRenaming(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename.");
    } finally {
      setRenameBusy(false);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/drive?id=${deleting._id}`, { method: "DELETE" });
      toast.success(`Deleted “${deleting.name}”.`);
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function openItem(item: DriveItemDto) {
    if (item.type === "folder") setParent(item._id);
    else if (item.url) setPreview(item);
  }

  function previewKind(item: DriveItemDto): "image" | "frame" | "none" {
    const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
    if (["pdf", "txt"].includes(ext)) return "frame";
    return "none";
  }

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Drive</h1>
          <p className="mt-1.5 text-slate-500">
            The church&apos;s shared documents — organised in folders, stored safely
            in the cloud.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => setFolderModalOpen(true)}>
            <FolderPlus className="h-4 w-4" aria-hidden />
            New folder
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            loading={uploading > 0}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {uploading > 0 ? `Uploading ${uploading}…` : "Upload files"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onPickFiles}
            className="hidden"
            aria-label="Upload files"
          />
        </div>
      </div>

      {/* Breadcrumbs — the Finder path bar */}
      <nav
        aria-label="Folder path"
        className="mt-6 flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
      >
        <button
          onClick={() => setParent(null)}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold transition-colors duration-150 ${
            parent === null
              ? "text-slate-900"
              : "text-indigo-600 hover:bg-indigo-50"
          }`}
        >
          <HardDrive className="h-4 w-4" aria-hidden />
          Drive
        </button>
        {path.map((p, i) => (
          <span key={p._id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
            <button
              onClick={() => setParent(p._id)}
              className={`cursor-pointer rounded-md px-1.5 py-0.5 font-semibold transition-colors duration-150 ${
                i === path.length - 1
                  ? "text-slate-900"
                  : "text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              {p.name}
            </button>
          </span>
        ))}
      </nav>

      {/* The Finder grid */}
      <div className="mt-4 min-h-[50vh] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {items === null && (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-50" />
            ))}
          </div>
        )}

        {items?.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <Folder className="h-12 w-12 fill-sky-100 text-sky-300" aria-hidden />
            <p className="mt-3 font-semibold text-slate-900">
              {parent === null ? "Drive is empty" : "This folder is empty"}
            </p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Create folders to organise — circulars, exam papers, government
              letters — then upload files into them.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {items?.map((item) => (
            <div
              key={item._id}
              className="group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-2 py-4 transition-colors duration-150 hover:bg-indigo-50/60"
              onClick={() => openItem(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openItem(item)}
            >
              {item.type === "folder" ? (
                <Folder
                  className="h-12 w-12 fill-sky-300 text-sky-400"
                  aria-hidden
                />
              ) : (
                fileIcon(item)
              )}
              <p className="line-clamp-2 max-w-full text-center text-xs leading-tight font-medium break-words text-slate-800">
                {item.name}
              </p>
              {item.type === "file" && (
                <p className="text-[10px] text-slate-400">
                  {formatSize(item.size)}
                </p>
              )}

              <div className="absolute top-1 right-1 hidden gap-0.5 group-hover:flex">
                <button
                  aria-label={`Rename ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(item);
                    setRenameValue(item.name);
                  }}
                  className="cursor-pointer rounded-md bg-white p-1 text-slate-400 shadow-sm ring-1 ring-slate-200 transition-colors duration-150 hover:text-slate-700"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  aria-label={`Delete ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(item);
                  }}
                  className="cursor-pointer rounded-md bg-white p-1 text-slate-400 shadow-sm ring-1 ring-slate-200 transition-colors duration-150 hover:text-rose-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New folder */}
      <Modal
        open={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        title="New folder"
        subtitle={path.length > 0 ? `Inside ${path[path.length - 1].name}` : "At the top level of Drive"}
      >
        <form onSubmit={createFolder} className="space-y-4">
          <TextField
            label="Folder name"
            required
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="e.g. Circulars 2026-27"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setFolderModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create folder
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename */}
      <Modal
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title={`Rename ${renaming?.type === "folder" ? "folder" : "file"}`}
      >
        <form onSubmit={rename} className="space-y-4">
          <TextField
            label="New name"
            required
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={renameBusy}>
              Rename
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title={`Delete ${deleting?.type === "folder" ? "folder" : "file"}?`}
        message={
          deleting?.type === "folder"
            ? `“${deleting?.name}” will be removed. Folders must be empty before deleting.`
            : `“${deleting?.name}” will be removed from Drive. This cannot be undone.`
        }
      />

      {/* In-app preview — Quick Look, more or less */}
      {preview &&
        createPortal(
          <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${preview.name}`}
          >
            <div
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
              onClick={() => setPreview(null)}
            />
            <div className="absolute inset-3 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in sm:inset-10">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {preview.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatSize(preview.size)}
                    {preview.createdByName ? ` · uploaded by ${preview.createdByName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Open in new tab
                  </a>
                  <button
                    onClick={() => setPreview(null)}
                    aria-label="Close preview"
                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-100/80 p-4">
                {previewKind(preview) === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-md"
                  />
                )}
                {previewKind(preview) === "frame" && (
                  <iframe
                    src={preview.url}
                    title={preview.name}
                    className="h-full w-full rounded-lg border border-slate-200 bg-white"
                  />
                )}
                {previewKind(preview) === "none" && (
                  <div className="text-center">
                    {fileIcon(preview)}
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      No in-app preview for this file type
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Word/Excel files open in their own apps — use “Open in
                      new tab” to download.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
