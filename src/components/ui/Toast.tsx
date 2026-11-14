"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";

export const Toast: React.FC = () => {
  const { toastMessage } = useEditorStore();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="bg-slate-900/90 text-white backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-slate-700/60 flex items-center space-x-2 text-xs font-medium">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{toastMessage}</span>
      </div>
    </div>
  );
};

