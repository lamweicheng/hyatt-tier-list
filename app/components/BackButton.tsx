"use client";

import { useRouter } from "next/navigation";

export default function BackButton({
  label = "Back",
  className = ""
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${className}`}
      onClick={() => router.back()}
    >
      ← {label}
    </button>
  );
}
