"use client";

import React, { useRef } from "react";
import {
  MousePointer,
  PencilLine,
  Type,
  Image as ImageIcon,
  PenTool,
  Pen,
  Square,
  ShieldAlert,
  Link as LinkIcon,
  Hand,
} from "lucide-react";
import { useEditorStore, EditorTool } from "@/store/editor-store";
import { AddImageOperation } from "@/core/models/operations";

export const EditorToolRail: React.FC = () => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const {
    activeTool,
    setActiveTool,
    executeAddOperation,
    currentPageNumber,
    showToast,
  } = useEditorStore();

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = async () => {
          const maxDim = 250;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          const op: AddImageOperation = {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: "add_image",
            pageNumber: currentPageNumber,
            imageDataUrl: dataUrl,
            mimeType: "image/png",
            rect: {
              x: 100,
              y: 100,
              width: w,
              height: h,
            },
            opacity: 1,
            rotation: 0,
            timestamp: Date.now(),
          };

          await executeAddOperation(op);
          setActiveTool("select");
          showToast("Image inserted onto page");
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } catch {
      showToast("Failed to load image");
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const tools: {
    id: EditorTool;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    action?: () => void;
  }[] = [
    {
      id: "select",
      label: "Select / Pointer (V)",
      icon: MousePointer,
    },
    {
      id: "edit_text",
      label: "Edit Existing Text (E)",
      icon: PencilLine,
    },
    {
      id: "add_text",
      label: "Add New Text (T)",
      icon: Type,
    },
    {
      id: "add_image",
      label: "Insert Image",
      icon: ImageIcon,
      action: () => imageInputRef.current?.click(),
    },
    {
      id: "draw",
      label: "Signature / Draw",
      icon: PenTool,
    },
    {
      id: "whiteout",
      label: "Whiteout",
      icon: Pen,
    },
    {
      id: "shape_rect",
      label: "Shape (Rectangle)",
      icon: Square,
    },
    {
      id: "blackout",
      label: "Redact / Blackout",
      icon: ShieldAlert,
    },
    {
      id: "link",
      label: "Hyperlink",
      icon: LinkIcon,
    },
    {
      id: "grab",
      label: "Hand / Pan View (Space)",
      icon: Hand,
    },
  ];

  return (
    <div className="w-[72px] bg-[#fbf9f4] border-r border-[#d8d4c8] flex flex-col items-center gap-2 py-4 z-10 shrink-0 select-none">
      <style jsx>{`
        .ib {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #0d1b3d;
          transition: background .2s, transform .2s, color .2s;
        }
        .ib:hover {
          background: #e7e3d8;
          transform: translateY(-1px);
        }
        .ib.on {
          background: #0d1b3d;
          color: #ffd84d;
        }
      `}</style>

      {/* Hidden image file input */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageSelected}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
      />

      {tools.map((t) => {
        const Icon = t.icon;
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => {
              if (t.action) {
                t.action();
              } else {
                setActiveTool(t.id);
              }
            }}
            className={`ib ${isActive ? "on" : ""}`}
            title={t.label}
            aria-label={t.label}
          >
            <Icon className="w-5 h-5" />
          </button>
        );
      })}
    </div>
  );
};
