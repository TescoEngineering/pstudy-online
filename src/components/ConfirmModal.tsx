"use client";

import { useTranslation } from "@/lib/i18n";

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "normal";
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "danger",
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const finalCancel = cancelLabel ?? t("common.cancel");
  const finalConfirm = confirmLabel ?? t("common.delete");

  if (!open) return null;

  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-semibold text-stone-900">{title}</h3>
        {message && <p className="mb-6 text-stone-600">{message}</p>}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            {finalCancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={
              variant === "danger"
                ? "rounded-lg px-4 py-2 font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 bg-red-600 hover:bg-red-700"
                : "btn-primary"
            }
          >
            {finalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
