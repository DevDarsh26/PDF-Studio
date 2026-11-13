"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Eye,
  Trash2,
  RefreshCw,
  Info,
  Type,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { TextEditOperation, EditStrategy } from "@/core/models/operations";
import {
  validateTextReplacement,
  TextScope,
} from "@/core/engine/text-validator";

export const TextEditModal: React.FC = () => {
  const {
    editingTokenId,
    closeTextEditor,
    currentStyleProfile,
    currentPageNumber,
    executeAddOperation,
  } = useEditorStore();

  const token = useMemo(() => {
    if (!editingTokenId || !currentStyleProfile) return null;
    return (
      currentStyleProfile.textTokens.find((t) => t.id === editingTokenId) ||
      null
    );
  }, [editingTokenId, currentStyleProfile]);

  const font = useMemo(() => {
    if (!token || !currentStyleProfile) return undefined;
    return currentStyleProfile.detectedFonts.get(token.fontId);
  }, [token, currentStyleProfile]);

  const [replacementText, setReplacementText] = useState("");
  const [userStrategy, setUserStrategy] = useState<EditStrategy | null>(null);

  // Initialize input when token changes
  useEffect(() => {
    if (token) {
      setReplacementText(token.text);
      setUserStrategy(null);
    }
  }, [token]);

  const validation = useMemo(() => {
    if (!token) return null;
    return validateTextReplacement(
      token.text,
      replacementText,
      token.rect,
      token.fontSize,
      font,
      {
        layoutBlocks: currentStyleProfile?.layoutBlocks,
        textTokens: currentStyleProfile?.textTokens,
      }
    );
  }, [token, replacementText, font, currentStyleProfile]);

  if (!editingTokenId || !token || !validation) return null;

  const activeStrategy = userStrategy || validation.recommendedStrategy;

  const handleApply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token) return;

    const op: TextEditOperation = {
      id: `text_edit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: "text_edit",
      pageNumber: currentPageNumber,
      timestamp: Date.now(),
      targetRect: token.rect,
      originalText: token.text,
      replacementText,
      fontFamily: font?.family || "Helvetica",
      fontSize: token.fontSize || 12,
      fontWeight: font?.isBold ? "bold" : "normal",
      fontStyle: font?.isItalic ? "italic" : "normal",
      fontColorHex: token.colorHex || "#000000",
      alignment: "left",
      opacity: 1.0,
      strategy: activeStrategy,
    };

    await executeAddOperation(op);
    closeTextEditor();
  };

  const handleDelete = async () => {
    if (!token) return;
    setReplacementText("");
    const op: TextEditOperation = {
      id: `text_delete_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: "text_edit",
      pageNumber: currentPageNumber,
      timestamp: Date.now(),
      targetRect: token.rect,
      originalText: token.text,
      replacementText: "",
      fontFamily: font?.family || "Helvetica",
      fontSize: token.fontSize || 12,
      fontWeight: font?.isBold ? "bold" : "normal",
      fontStyle: font?.isItalic ? "italic" : "normal",
      fontColorHex: token.colorHex || "#000000",
      alignment: "left",
      opacity: 1.0,
      strategy: validation.canUseNative
        ? EditStrategy.NativeStreamModification
        : EditStrategy.LocalReconstruction,
    };
    await executeAddOperation(op);
    closeTextEditor();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Type className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Modify Existing PDF Text
              </h3>
              <p className="text-xs text-slate-500">
                High-fidelity in-place text replacement & styling preservation
              </p>
            </div>
          </div>
          <button
            onClick={closeTextEditor}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 1. Target Text & Font Inspection */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-slate-500 uppercase tracking-wider text-[10px]">
                Original Text Token
              </span>
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-mono">
                  {font?.family || "Helvetica"} · {token.fontSize}pt
                </span>
                {font?.isSubset ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                    Subset Font
                  </span>
                ) : font?.isStandard14 ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Standard 14 Font
                  </span>
                ) : null}
              </div>
            </div>
            <div className="p-2 bg-white border border-slate-200 rounded font-serif text-slate-900 break-words select-text">
              &ldquo;{token.text}&rdquo;
            </div>
          </div>

          {/* 2. Replacement Input & Quick Scopes */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Replacement Text
              </label>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setReplacementText(token.text)}
                  className="px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 rounded border border-slate-200 flex items-center space-x-1 transition"
                  title="Revert to original"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReplacementText("")}
                  className="px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50 rounded border border-red-200 flex items-center space-x-1 transition"
                  title="Clear text (Delete token)"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            <textarea
              value={replacementText}
              onChange={(e) => setReplacementText(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Enter replacement text..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-sans"
            />

            {/* Scope Badge */}
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center space-x-1.5">
                <span>Detected Scope:</span>
                <span className="font-semibold capitalize px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 border border-slate-200">
                  {validation.scope} replacement
                </span>
              </div>
              <div className="text-[11px]">
                Chars: {replacementText.length} (Original: {token.text.length})
              </div>
            </div>
          </div>

          {/* 3. Strategy Selection Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Editing Strategy
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Strategy A */}
              <button
                type="button"
                onClick={() => setUserStrategy(EditStrategy.NativeStreamModification)}
                disabled={!validation.canUseNative}
                className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                  activeStrategy === EditStrategy.NativeStreamModification
                    ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600"
                    : !validation.canUseNative
                    ? "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center space-x-1.5 text-emerald-800 font-semibold text-xs mb-1">
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                  <span>Strategy A</span>
                </div>
                <div className="text-[11px] font-medium text-slate-900 leading-tight">
                  Native Modification
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Patches content stream operators directly.
                </div>
              </button>

              {/* Strategy B */}
              <button
                type="button"
                onClick={() => setUserStrategy(EditStrategy.LocalReconstruction)}
                className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                  activeStrategy === EditStrategy.LocalReconstruction
                    ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center space-x-1.5 text-blue-800 font-semibold text-xs mb-1">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Strategy B</span>
                </div>
                <div className="text-[11px] font-medium text-slate-900 leading-tight">
                  Local Reconstruction
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Suppresses token & reconstructs at baseline.
                </div>
              </button>

              {/* Strategy C */}
              <button
                type="button"
                onClick={() => setUserStrategy(EditStrategy.VisualOverlay)}
                className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                  activeStrategy === EditStrategy.VisualOverlay
                    ? "border-amber-600 bg-amber-50/50 ring-1 ring-amber-600"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center space-x-1.5 text-amber-800 font-semibold text-xs mb-1">
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>Strategy C</span>
                </div>
                <div className="text-[11px] font-medium text-slate-900 leading-tight">
                  Visual Overlay
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Last-resort background mask with text overlay.
                </div>
              </button>
            </div>
          </div>

          {/* 4. Pre-Validation Warnings and Notifications */}
          {validation.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 text-xs text-amber-900">
              <div className="flex items-center space-x-1.5 font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pre-Flight Validation Notices</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800">
                {validation.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 5. Metrics & Character Coverage Status */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Character Coverage
              </span>
              <div className="mt-1 flex items-center space-x-1.5">
                {validation.characterCoverage.isCovered ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-medium">
                      All glyphs available
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-amber-800 font-medium">
                      {validation.characterCoverage.missingChars.length} missing glyphs
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Width & Overflow
              </span>
              <div className="mt-1 flex items-center space-x-1.5">
                {validation.dimensionMetrics.isOverflowing ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="text-red-700 font-medium">
                      +{Math.round((validation.dimensionMetrics.overflowRatio - 1) * 100)}% wider
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-medium">
                      Fits within bounds ({Math.round(validation.dimensionMetrics.overflowRatio * 100)}%)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 flex items-center space-x-1.5 transition font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Element</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={closeTextEditor}
              className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleApply()}
              disabled={replacementText === token.text}
              className="px-5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-sm transition flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply Modification</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
