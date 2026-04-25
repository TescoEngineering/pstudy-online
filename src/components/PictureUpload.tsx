"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useTranslation } from "@/lib/i18n";

const BUCKET = "item-pictures";

type PictureUploadProps = {
  value: string;
  onChange: (url: string) => void;
  className?: string;
  readOnly?: boolean;
};

export function PictureUpload({ value, onChange, className = "", readOnly = false }: PictureUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    setImageLoadError(false);
  }, [value]);

  async function uploadFile(file: File) {
    if (readOnly) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("common.selectImageFile"));
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t("common.mustBeLoggedIn"));
      return;
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      toast.error(error.message || t("common.uploadFailed"));
      return;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(urlData.publicUrl);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = "";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  function handleRemove() {
    onChange("");
  }

  const dropZoneClass = `flex h-16 w-16 flex-col items-center justify-center rounded border-2 border-dashed transition ${
    isDragging
      ? "border-pstudy-primary bg-teal-50/50 text-pstudy-primary"
      : "border-stone-300 bg-stone-50 text-stone-500 hover:border-pstudy-primary hover:bg-teal-50/30 hover:text-pstudy-primary"
  }`;

  if (readOnly) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {value && !imageLoadError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageLoadError(true)}
            className="h-16 w-16 rounded object-cover ring-1 ring-stone-200"
          />
        ) : value && imageLoadError ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-16 w-16 flex-col items-center justify-center overflow-hidden rounded border border-amber-200 bg-amber-50/80 p-1 text-center text-[10px] leading-tight text-amber-900 underline"
            title={value}
          >
            {t("common.imageLoadFailedLink")}
          </a>
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded border border-stone-100 bg-stone-50 text-xs text-stone-400">
            —
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      {value ? (
        <div
          className="relative group"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <img
            src={value}
            alt="Item"
            className={`h-16 w-16 rounded object-cover ring-1 transition ${
              isDragging ? "ring-2 ring-pstudy-primary ring-offset-2" : "ring-stone-200"
            }`}
          />
          <div className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-black/50 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded bg-white px-2 py-1 text-xs font-medium text-stone-800 hover:bg-stone-100"
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="rounded bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-xs font-medium text-white">
              Drop to replace
            </div>
          )}
        </div>
      ) : value && imageLoadError ? (
        <div className="flex h-16 min-w-0 max-w-[12rem] flex-col justify-center gap-1 rounded border border-amber-200 bg-amber-50/80 px-2 py-1 text-left">
          <p className="text-[10px] font-medium text-amber-900">{t("common.imageLoadFailed")}</p>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-[10px] text-amber-800 underline"
            title={value}
          >
            {t("common.imageLoadFailedLink")}
          </a>
          <button
            type="button"
            onClick={() => {
              setImageLoadError(false);
              inputRef.current?.click();
            }}
            className="self-start text-[10px] font-medium text-pstudy-primary hover:underline"
          >
            {t("common.replaceImage")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={dropZoneClass}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="text-2xl">+</span>
          <span className="text-xs">{isDragging ? "Drop image" : "Add or drop"}</span>
        </button>
      )}
    </div>
  );
}
