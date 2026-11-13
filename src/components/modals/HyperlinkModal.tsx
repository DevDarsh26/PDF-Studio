"use client";

import React, { useState, useEffect } from "react";
import { Link as LinkIcon, ExternalLink, BookOpen, Trash2, X, Check } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { AddHyperlinkOperation, DeleteHyperlinkOperation } from "@/core/models/operations";

export const HyperlinkModal: React.FC = () => {
  const {
    pendingLinkRect,
    activeEditingLink,
    closeLinkModal,
    currentPageNumber,
    pageInfos,
    executeAddOperation,
  } = useEditorStore();

  const [targetType, setTargetType] = useState<"external_url" | "internal_page">("external_url");
  const [url, setUrl] = useState("https://");
  const [targetPage, setTargetPage] = useState<number>(1);

  useEffect(() => {
    if (activeEditingLink) {
      setTargetType(
        activeEditingLink.targetType === "internal_page"
          ? "internal_page"
          : "external_url"
      );
      if (activeEditingLink.targetType === "external_url") {
        setUrl(String(activeEditingLink.target));
      } else {
        const pNum =
          typeof activeEditingLink.target === "number"
            ? activeEditingLink.target
            : 1;
        setTargetPage(pNum);
      }
    } else {
      setTargetType("external_url");
      setUrl("https://");
      setTargetPage(Math.min(currentPageNumber + 1, pageInfos.length || 1));
    }
  }, [activeEditingLink, currentPageNumber, pageInfos.length]);

  if (!pendingLinkRect) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const op: AddHyperlinkOperation = {
      id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: currentPageNumber,
      timestamp: Date.now(),
      type: "add_hyperlink",
      rect: pendingLinkRect,
      targetType,
      url: targetType === "external_url" ? url : undefined,
      targetPage: targetType === "internal_page" ? targetPage : undefined,
    };

    await executeAddOperation(op);
    closeLinkModal();
  };

  const handleDelete = async () => {
    if (!activeEditingLink) return;

    const op: DeleteHyperlinkOperation = {
      id: `del-link-${Date.now()}`,
      pageNumber: currentPageNumber,
      timestamp: Date.now(),
      type: "delete_hyperlink",
      linkId: activeEditingLink.id,
      rect: activeEditingLink.rect,
    };

    await executeAddOperation(op);
    closeLinkModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <LinkIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {activeEditingLink ? "Edit Hyperlink Destination" : "Add Hyperlink"}
              </h3>
              <p className="text-xs text-slate-500">
                Create external web links or internal page navigation
              </p>
            </div>
          </div>
          <button
            onClick={closeLinkModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Target Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Destination Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("external_url")}
                className={`p-2.5 rounded-lg border text-left transition flex items-center space-x-2 text-xs ${
                  targetType === "external_url"
                    ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>Web URL</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("internal_page")}
                className={`p-2.5 rounded-lg border text-left transition flex items-center space-x-2 text-xs ${
                  targetType === "internal_page"
                    ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Internal Page</span>
              </button>
            </div>
          </div>

          {targetType === "external_url" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Web Address (URL)
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Page
              </label>
              <select
                value={targetPage}
                onChange={(e) => setTargetPage(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {pageInfos.map((p) => (
                  <option key={p.pageNumber} value={p.pageNumber}>
                    Page {p.pageNumber} ({Math.round(p.dimensions.width)} × {Math.round(p.dimensions.height)} pt)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            {activeEditingLink ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg font-medium flex items-center space-x-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Link</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={closeLinkModal}
                className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Hyperlink</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
