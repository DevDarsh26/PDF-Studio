"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UploadHomepage } from "@/components/upload/UploadHomepage";
import { PasswordModal } from "@/components/modals/PasswordModal";
import { Toast } from "@/components/ui/Toast";
import { useEditorStore } from "@/store/editor-store";

export default function DashboardPage() {
  const router = useRouter();
  const rawBytes = useEditorStore((state) => state.rawBytes);
  const metadata = useEditorStore((state) => state.metadata);

  // If a document gets loaded while on /dashboard, navigate to editor on /
  useEffect(() => {
    if (rawBytes && metadata) {
      router.push("/");
    }
  }, [rawBytes, metadata, router]);

  return (
    <div className="flex flex-col min-h-screen w-screen bg-[#f4f1ea] text-[#0d1b3d] antialiased overflow-x-hidden">
      <PasswordModal />
      <Toast />
      <UploadHomepage onBackToLanding={() => router.push("/")} />
    </div>
  );
}
