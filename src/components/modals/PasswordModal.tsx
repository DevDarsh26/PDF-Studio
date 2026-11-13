"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";

export const PasswordModal: React.FC = () => {
  const { isPasswordRequired, errorMessage, submitPassword, cancelPasswordPrompt, isLoading } =
    useEditorStore();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (!isPasswordRequired) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    await submitPassword(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden text-gray-800 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Protected Document</h3>
              <p className="text-xs text-gray-500">
                This PDF is encrypted. Enter the password to view and edit.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter document password..."
                  autoFocus
                  required
                  className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={cancelPasswordPrompt}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Decrypting...</span>
                  </>
                ) : (
                  <span>Unlock PDF</span>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
          <span>Decrypted 100% locally in browser</span>
          <span className="text-gray-400">•</span>
          <span>Zero network transmission</span>
        </div>
      </div>
    </div>
  );
};
