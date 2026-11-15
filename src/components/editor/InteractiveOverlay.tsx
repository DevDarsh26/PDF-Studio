"use client";

import React, { useRef, useState, useEffect } from "react";
import { Copy, Edit3, Move, Trash2, Image as ImageIcon, RefreshCw } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import {
  AddTextOperation,
  AddShapeOperation,
  AddImageOperation,
  WhiteoutOperation,
  BlackoutOperation,
  RedactionOperation,
  AddHyperlinkOperation,
  TextEditOperation,
  AddDrawingOperation,
  EditOperation,
  EditStrategy,
} from "@/core/models/operations";
import { Point, Rect } from "@/core/models/geometry";
import { ImageInfo } from "@/core/models/style-profile";
import { useHistoryStore } from "@/store/history-store";
import { sliceCanvasImage } from "@/core/utils/image-extractor";

interface InteractiveOverlayProps {
  pageWidth: number; // in points
  pageHeight: number; // in points
  scale: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  isSpacePressed?: boolean;
}

export const InteractiveOverlay: React.FC<InteractiveOverlayProps> = ({
  pageWidth,
  pageHeight,
  scale,
  containerRef,
  isSpacePressed = false,
}) => {
  const {
    activeTool,
    setActiveTool,
    currentPageNumber,
    operations,
    selectedElementId,
    selectedTokenId,
    selectElement,
    selectToken,
    openTextEditorForToken,
    openAddLinkModal,
    openEditLinkModal,
    executeAddOperation,
    executeUpdateElement,
    updateOperationDirect,
    deleteSelected,
    duplicateSelected,
    copySelectedTextToClipboard,
    showToast,
    activeFormatting,
    currentStyleProfile,
  } = useEditorStore();

  const svgRef = useRef<SVGSVGElement>(null);

  // Overlay document panning state (Grab tool or Spacebar hold)
  const [isOverlayPanning, setIsOverlayPanning] = useState(false);
  const overlayPanStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  const isGrabMode = activeTool === "grab" || isSpacePressed;

  // Drawing state for shapes, marks, and whiteout
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [drawPoints, setDrawPoints] = useState<Point[]>([]);

  // Dragging / Resizing state for selected element
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null); // e.g. "se", "nw", etc.
  const [dragStartMouse, setDragStartMouse] = useState<Point | null>(null);
  const [initialOpState, setInitialOpState] = useState<any>(null);

  // Inline text editing for added text elements
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>("");

  const replaceImageInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElementId) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      executeUpdateElement(selectedElementId, {
        imageDataUrl: dataUrl,
        mimeType: file.type.includes("jpeg") ? "image/jpeg" : "image/png",
      });
      showToast("Logo / Image replaced successfully");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSelectExistingImage = async (img: ImageInfo) => {
    try {
      const canvas = typeof document !== "undefined"
        ? (document.getElementById("pdf-page-canvas") as HTMLCanvasElement | null)
        : null;

      const dataUrl = sliceCanvasImage(canvas, img.rect, pageHeight, pageWidth);
      const bgHex = currentStyleProfile?.inferredProperties?.pageBackgroundHex || "#ffffff";

      // 1. Mask original position with document background
      const maskOp: WhiteoutOperation = {
        id: `mask_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: "whiteout",
        pageNumber: currentPageNumber,
        rect: { ...img.rect },
        fillColorHex: bgHex,
        opacity: 1,
        timestamp: Date.now(),
      };
      await executeAddOperation(maskOp);

      // 2. Insert as interactive AddImageOperation at exact location
      const newImageOp: AddImageOperation = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: "add_image",
        pageNumber: currentPageNumber,
        imageDataUrl: dataUrl,
        mimeType: "image/png",
        rect: { ...img.rect },
        opacity: 1,
        rotation: 0,
        timestamp: Date.now() + 1,
      };
      await executeAddOperation(newImageOp);

      // 3. Immediately select the element for moving, resizing, or replacing
      selectElement(newImageOp.id);
      showToast("Logo / Image selected. You can now drag, resize, or replace it.");
    } catch {
      showToast("Failed to select image");
    }
  };

  // Convert Screen pixel coordinates to PDF point coordinates
  const screenToPdf = (screenX: number, screenY: number): Point => {
    return {
      x: Math.round((screenX / scale) * 10) / 10,
      y: Math.round((pageHeight - screenY / scale) * 10) / 10,
    };
  };

  // Convert PDF point coordinates to Screen pixel coordinates
  const pdfToScreen = (pdfX: number, pdfY: number): Point => {
    return {
      x: pdfX * scale,
      y: (pageHeight - pdfY) * scale,
    };
  };

  const generateSvgPath = (points: Point[]) => {
    if (!points || points.length === 0) return "";
    const first = pdfToScreen(points[0].x, points[0].y);
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < points.length; i++) {
      const pt = pdfToScreen(points[i].x, points[i].y);
      d += ` L ${pt.x} ${pt.y}`;
    }
    return d;
  };

  const getSvgCoordinates = (e: React.MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Keyboard listener: Delete, Backspace, Ctrl+C / Cmd+C copy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === "Escape") {
        selectElement(null);
        selectToken(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectedElementId) {
          e.preventDefault();
          duplicateSelected();
        }
      }
      // Arrow keys to nudge selected element position
      if (
        selectedElementId &&
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const op = operations.find((o) => o.id === selectedElementId);
        if (op) {
          let deltaX = 0;
          let deltaY = 0;
          if (e.key === "ArrowLeft") deltaX = -step;
          if (e.key === "ArrowRight") deltaX = step;
          if (e.key === "ArrowUp") deltaY = step; // higher PDF Y = screen up
          if (e.key === "ArrowDown") deltaY = -step; // lower PDF Y = screen down

          if ("position" in op) {
            executeUpdateElement(selectedElementId, {
              position: {
                x: Math.round((op.position.x + deltaX) * 10) / 10,
                y: Math.round((op.position.y + deltaY) * 10) / 10,
              },
            });
          } else if (
            op.type === "add_shape" &&
            (op.shapeType === "line" || op.shapeType === "arrow")
          ) {
            const p1 = op.startPoint || { x: op.rect.x, y: op.rect.y };
            const p2 = op.endPoint || {
              x: op.rect.x + op.rect.width,
              y: op.rect.y + op.rect.height,
            };
            executeUpdateElement(selectedElementId, {
              rect: {
                ...op.rect,
                x: Math.round((op.rect.x + deltaX) * 10) / 10,
                y: Math.round((op.rect.y + deltaY) * 10) / 10,
              },
              startPoint: {
                x: Math.round((p1.x + deltaX) * 10) / 10,
                y: Math.round((p1.y + deltaY) * 10) / 10,
              },
              endPoint: {
                x: Math.round((p2.x + deltaX) * 10) / 10,
                y: Math.round((p2.y + deltaY) * 10) / 10,
              },
            });
          } else if ("rect" in op) {
            executeUpdateElement(selectedElementId, {
              rect: {
                ...op.rect,
                x: Math.round((op.rect.x + deltaX) * 10) / 10,
                y: Math.round((op.rect.y + deltaY) * 10) / 10,
              },
            });
          } else if ("targetRect" in op) {
            executeUpdateElement(selectedElementId, {
              targetRect: {
                ...op.targetRect,
                x: Math.round((op.targetRect.x + deltaX) * 10) / 10,
                y: Math.round((op.targetRect.y + deltaY) * 10) / 10,
              },
            });
          } else if ("points" in op && Array.isArray((op as any).points)) {
            executeUpdateElement(selectedElementId, {
              points: (op as any).points.map((pt: Point) => ({
                x: Math.round((pt.x + deltaX) * 10) / 10,
                y: Math.round((pt.y + deltaY) * 10) / 10,
              })),
            });
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const hasSelection = typeof window !== "undefined" && window.getSelection()?.toString();
        if (!hasSelection && (selectedTokenId || selectedElementId)) {
          e.preventDefault();
          copySelectedTextToClipboard();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        const history = useHistoryStore.getState();
        if (history.state.canUndo) {
          history.undo();
          showToast("Undo");
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        const history = useHistoryStore.getState();
        if (history.state.canRedo) {
          history.redo();
          showToast("Redo");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedElementId,
    selectedTokenId,
    operations,
    deleteSelected,
    duplicateSelected,
    copySelectedTextToClipboard,
    executeUpdateElement,
    selectElement,
    selectToken,
  ]);

  // Operations on the current page
  const pageOperations = operations.filter(
    (op) => "pageNumber" in op && op.pageNumber === currentPageNumber
  );

  // Mouse Down handler
  const handleMouseDown = async (e: React.MouseEvent) => {
    if (isGrabMode) {
      const container = containerRef?.current;
      if (container) {
        overlayPanStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
        setIsOverlayPanning(true);
      }
      return;
    }

    const screenCoord = getSvgCoordinates(e);
    const pdfCoord = screenToPdf(screenCoord.x, screenCoord.y);

    if (activeTool === "select") {
      // Check if clicking outside any element
      if (e.target === svgRef.current) {
        selectElement(null);
        selectToken(null);
      }
      return;
    }

    if (activeTool === "draw" || activeTool === "highlight") {
      setIsDrawing(true);
      setDrawPoints([pdfCoord]);
      return;
    }

    if (activeTool === "add_text") {
      const opId = `text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newTextOp: AddTextOperation = {
        id: opId,
        pageNumber: currentPageNumber,
        timestamp: Date.now(),
        type: "add_text",
        position: pdfCoord,
        text: "New Text",
        fontFamily: activeFormatting.fontFamily,
        fontSize: activeFormatting.fontSize,
        fontWeight: activeFormatting.fontWeight,
        fontStyle: activeFormatting.fontStyle,
        fontColorHex: activeFormatting.fontColorHex,
        alignment: activeFormatting.alignment,
        opacity: activeFormatting.opacity,
      };

      await executeAddOperation(newTextOp);
      selectElement(opId);
      setEditingOpId(opId);
      setEditingTextValue("New Text");
      setActiveTool("select");
      return;
    }

    // Tools that require drag: whiteout, blackout, shape_rect, shape_circle, shape_line, shape_arrow
    setIsDrawing(true);
    setStartPoint(pdfCoord);
    setCurrentPoint(pdfCoord);
  };

  // Perform live element movement using lightweight updateOperationDirect
  const applyDragMovement = (pdfCoord: Point) => {
    if (!selectedElementId || !initialOpState || !dragStartMouse) return;
    const deltaX = pdfCoord.x - dragStartMouse.x;
    const deltaY = pdfCoord.y - dragStartMouse.y;

    if ("position" in initialOpState) {
      updateOperationDirect(selectedElementId, {
        position: {
          x: Math.round((initialOpState.position.x + deltaX) * 10) / 10,
          y: Math.round((initialOpState.position.y + deltaY) * 10) / 10,
        },
      });
    } else if (
      initialOpState.type === "add_shape" &&
      (initialOpState.shapeType === "line" || initialOpState.shapeType === "arrow")
    ) {
      const p1 = initialOpState.startPoint || { x: initialOpState.rect.x, y: initialOpState.rect.y };
      const p2 = initialOpState.endPoint || {
        x: initialOpState.rect.x + initialOpState.rect.width,
        y: initialOpState.rect.y + initialOpState.rect.height,
      };
      updateOperationDirect(selectedElementId, {
        rect: {
          ...initialOpState.rect,
          x: Math.round((initialOpState.rect.x + deltaX) * 10) / 10,
          y: Math.round((initialOpState.rect.y + deltaY) * 10) / 10,
        },
        startPoint: {
          x: Math.round((p1.x + deltaX) * 10) / 10,
          y: Math.round((p1.y + deltaY) * 10) / 10,
        },
        endPoint: {
          x: Math.round((p2.x + deltaX) * 10) / 10,
          y: Math.round((p2.y + deltaY) * 10) / 10,
        },
      });
    } else if ("rect" in initialOpState) {
      updateOperationDirect(selectedElementId, {
        rect: {
          ...initialOpState.rect,
          x: Math.round((initialOpState.rect.x + deltaX) * 10) / 10,
          y: Math.round((initialOpState.rect.y + deltaY) * 10) / 10,
        },
      });
    } else if ("targetRect" in initialOpState) {
      updateOperationDirect(selectedElementId, {
        targetRect: {
          ...initialOpState.targetRect,
          x: Math.round((initialOpState.targetRect.x + deltaX) * 10) / 10,
          y: Math.round((initialOpState.targetRect.y + deltaY) * 10) / 10,
        },
      });
    } else if ("points" in initialOpState && Array.isArray((initialOpState as any).points)) {
      const initialPoints = (initialOpState as any).points as Point[];
      updateOperationDirect(selectedElementId, {
        points: initialPoints.map((pt) => ({
          x: Math.round((pt.x + deltaX) * 10) / 10,
          y: Math.round((pt.y + deltaY) * 10) / 10,
        })),
      });
    }
  };

  // Perform live element resize using lightweight updateOperationDirect
  const applyResizeMovement = (pdfCoord: Point, handle: string) => {
    if (!selectedElementId || !initialOpState || !dragStartMouse) return;
    const deltaX = pdfCoord.x - dragStartMouse.x;
    const deltaY = pdfCoord.y - dragStartMouse.y;

    if (initialOpState.type === "add_text") {
      const prevSize = initialOpState.fontSize || 14;
      let scaleDelta = 0;
      if (handle.includes("e")) scaleDelta += deltaX;
      if (handle.includes("w")) scaleDelta -= deltaX;
      if (handle.includes("s")) scaleDelta -= deltaY;
      if (handle.includes("n")) scaleDelta += deltaY;

      const scaleFactor = Math.max(0.35, 1 + scaleDelta / 120);
      const newFontSize = Math.max(6, Math.min(120, Math.round(prevSize * scaleFactor)));
      updateOperationDirect(selectedElementId, {
        fontSize: newFontSize,
      });
      return;
    }

    if (
      initialOpState.type === "add_shape" &&
      (initialOpState.shapeType === "line" || initialOpState.shapeType === "arrow")
    ) {
      const p1 = initialOpState.startPoint || { x: initialOpState.rect.x, y: initialOpState.rect.y };
      const p2 = initialOpState.endPoint || {
        x: initialOpState.rect.x + initialOpState.rect.width,
        y: initialOpState.rect.y + initialOpState.rect.height,
      };
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const prevW = Math.max(10, maxX - minX);
      const prevH = Math.max(10, maxY - minY);

      let newMinX = minX;
      let newMinY = minY;
      let newW = prevW;
      let newH = prevH;

      if (handle.includes("e")) newW = Math.max(10, prevW + deltaX);
      if (handle.includes("w")) {
        const clampedW = Math.max(10, prevW - deltaX);
        newMinX = minX + (prevW - clampedW);
        newW = clampedW;
      }
      if (handle.includes("n")) newH = Math.max(10, prevH + deltaY);
      if (handle.includes("s")) {
        const clampedH = Math.max(10, prevH - deltaY);
        newMinY = minY + (prevH - clampedH);
        newH = clampedH;
      }

      const scaleX = newW / prevW;
      const scaleY = newH / prevH;

      const newP1 = {
        x: Math.round((newMinX + (p1.x - minX) * scaleX) * 10) / 10,
        y: Math.round((newMinY + (p1.y - minY) * scaleY) * 10) / 10,
      };
      const newP2 = {
        x: Math.round((newMinX + (p2.x - minX) * scaleX) * 10) / 10,
        y: Math.round((newMinY + (p2.y - minY) * scaleY) * 10) / 10,
      };

      updateOperationDirect(selectedElementId, {
        rect: {
          x: Math.min(newP1.x, newP2.x),
          y: Math.min(newP1.y, newP2.y),
          width: Math.max(5, Math.abs(newP2.x - newP1.x)),
          height: Math.max(5, Math.abs(newP2.y - newP1.y)),
        },
        startPoint: newP1,
        endPoint: newP2,
      });
      return;
    }

    if ("targetRect" in initialOpState) {
      const prev = initialOpState.targetRect;
      let newX = prev.x;
      let newY = prev.y;
      let newW = prev.width;
      let newH = prev.height;

      if (handle.includes("e")) newW = Math.max(10, prev.width + deltaX);
      if (handle.includes("w")) {
        const clampedW = Math.max(10, prev.width - deltaX);
        newX = prev.x + (prev.width - clampedW);
        newW = clampedW;
      }
      if (handle.includes("n")) newH = Math.max(10, prev.height + deltaY);
      if (handle.includes("s")) {
        const clampedH = Math.max(10, prev.height - deltaY);
        newY = prev.y + (prev.height - clampedH);
        newH = clampedH;
      }

      const ratio = newH / Math.max(1, prev.height);
      const prevSize = initialOpState.fontSize || 12;
      const newFontSize = Math.max(6, Math.min(100, Math.round(prevSize * ratio)));

      updateOperationDirect(selectedElementId, {
        targetRect: {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
        },
        fontSize: newFontSize,
      });
      return;
    }

    if (initialOpState.type === "freehand" && (initialOpState as any).points?.length > 0) {
      const pts = (initialOpState as any).points as Point[];
      let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const prevW = Math.max(1, maxX - minX);
      const prevH = Math.max(1, maxY - minY);
      let newMinX = minX;
      let newMinY = minY;
      let newW = prevW;
      let newH = prevH;

      if (handle.includes("e")) newW = Math.max(10, prevW + deltaX);
      if (handle.includes("w")) {
        const clampedW = Math.max(10, prevW - deltaX);
        newMinX = minX + (prevW - clampedW);
        newW = clampedW;
      }
      if (handle.includes("n")) newH = Math.max(10, prevH + deltaY);
      if (handle.includes("s")) {
        const clampedH = Math.max(10, prevH - deltaY);
        newMinY = minY + (prevH - clampedH);
        newH = clampedH;
      }

      const scaleX = newW / prevW;
      const scaleY = newH / prevH;

      updateOperationDirect(selectedElementId, {
        points: pts.map((p) => ({
          x: Math.round((newMinX + (p.x - minX) * scaleX) * 10) / 10,
          y: Math.round((newMinY + (p.y - minY) * scaleY) * 10) / 10,
        })),
      });
      return;
    }

    if ("rect" in initialOpState) {
      const prev = initialOpState.rect;
      let newX = prev.x;
      let newY = prev.y;
      let newW = prev.width;
      let newH = prev.height;

      if (handle.includes("e")) newW = Math.max(10, prev.width + deltaX);
      if (handle.includes("w")) {
        const clampedW = Math.max(10, prev.width - deltaX);
        newX = prev.x + (prev.width - clampedW);
        newW = clampedW;
      }
      if (handle.includes("n")) newH = Math.max(10, prev.height + deltaY);
      if (handle.includes("s")) {
        const clampedH = Math.max(10, prev.height - deltaY);
        newY = prev.y + (prev.height - clampedH);
        newH = clampedH;
      }

      updateOperationDirect(selectedElementId, {
        rect: {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
        },
      });
    }
  };

  // Commit completed drag or resize to history ledger as a single undoable step
  const commitDragOrResize = async () => {
    if (selectedElementId && initialOpState) {
      const finalOp = useEditorStore.getState().operations.find((o) => o.id === selectedElementId);
      if (finalOp) {
        const changes: Partial<EditOperation> = {};
        if ("position" in finalOp && JSON.stringify(finalOp.position) !== JSON.stringify(initialOpState.position)) {
          (changes as any).position = finalOp.position;
        }
        if ("rect" in finalOp && JSON.stringify(finalOp.rect) !== JSON.stringify(initialOpState.rect)) {
          (changes as any).rect = finalOp.rect;
        }
        if ("startPoint" in finalOp && JSON.stringify(finalOp.startPoint) !== JSON.stringify(initialOpState.startPoint)) {
          (changes as any).startPoint = finalOp.startPoint;
          (changes as any).endPoint = finalOp.endPoint;
        }
        if ("targetRect" in finalOp && JSON.stringify(finalOp.targetRect) !== JSON.stringify(initialOpState.targetRect)) {
          (changes as any).targetRect = finalOp.targetRect;
        }
        if ("points" in finalOp && JSON.stringify(finalOp.points) !== JSON.stringify(initialOpState.points)) {
          (changes as any).points = finalOp.points;
        }
        if ("fontSize" in finalOp && finalOp.fontSize !== initialOpState.fontSize) {
          (changes as any).fontSize = finalOp.fontSize;
        }

        if (Object.keys(changes).length > 0) {
          // Temporarily revert to initial state so executeUpdateElement records initial state for undo
          updateOperationDirect(selectedElementId, initialOpState);
          await executeUpdateElement(selectedElementId, changes);
        }
      }
    }

    setIsDragging(false);
    setIsResizing(null);
    setDragStartMouse(null);
    setInitialOpState(null);
  };

  // Global window listeners for foolproof drag-and-drop and resize tracking
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const pdfCoord = screenToPdf(screenX, screenY);

      if (isDragging) {
        applyDragMovement(pdfCoord);
      } else if (isResizing) {
        applyResizeMovement(pdfCoord, isResizing);
      }
    };

    const handleWindowPointerUp = () => {
      commitDragOrResize();
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [isDragging, isResizing, selectedElementId, initialOpState, dragStartMouse, scale, pageHeight]);

  // Window listeners for overlay document panning
  useEffect(() => {
    if (!isOverlayPanning) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!overlayPanStartRef.current || !containerRef?.current) return;
      const dx = e.clientX - overlayPanStartRef.current.x;
      const dy = e.clientY - overlayPanStartRef.current.y;
      containerRef.current.scrollLeft = overlayPanStartRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = overlayPanStartRef.current.scrollTop - dy;
    };

    const onPointerUp = () => {
      setIsOverlayPanning(false);
      overlayPanStartRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isOverlayPanning, containerRef]);

  // Mouse Move handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const screenCoord = getSvgCoordinates(e);
    const pdfCoord = screenToPdf(screenCoord.x, screenCoord.y);

    if (isDrawing) {
      if (activeTool === "draw" || activeTool === "highlight") {
        setDrawPoints((prev) => [...prev, pdfCoord]);
      } else {
        setCurrentPoint(pdfCoord);
      }
      return;
    }

    if (isDragging) {
      applyDragMovement(pdfCoord);
      return;
    }

    if (isResizing) {
      applyResizeMovement(pdfCoord, isResizing);
      return;
    }
  };

  // Mouse Up handler
  const handleMouseUp = async () => {
    if (isDragging || isResizing) {
      await commitDragOrResize();
      return;
    }

    if (isDrawing && (activeTool === "draw" || activeTool === "highlight")) {
      setIsDrawing(false);
      if (drawPoints.length > 1) {
        const isHighlight = activeTool === "highlight";
        const op: AddDrawingOperation = {
          id: `draw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          pageNumber: currentPageNumber,
          timestamp: Date.now(),
          type: "freehand",
          points: drawPoints,
          strokeColorHex: activeFormatting.strokeColorHex || (isHighlight ? "#facc15" : "#2563eb"),
          strokeWidth: isHighlight ? (activeFormatting.strokeWidth || 16) : (activeFormatting.strokeWidth || 3),
          opacity: isHighlight ? (activeFormatting.opacity ?? 0.4) : (activeFormatting.opacity ?? 1.0),
          isHighlighter: isHighlight,
        };
        await executeAddOperation(op);
      }
      setDrawPoints([]);
      return;
    }

    if (isDrawing && startPoint && currentPoint) {
      setIsDrawing(false);

      const minX = Math.min(startPoint.x, currentPoint.x);
      const maxX = Math.max(startPoint.x, currentPoint.x);
      const minY = Math.min(startPoint.y, currentPoint.y);
      const maxY = Math.max(startPoint.y, currentPoint.y);
      const width = Math.max(10, maxX - minX);
      const height = Math.max(10, maxY - minY);

      const id = `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const rect: Rect = { x: minX, y: minY, width, height };

      if (activeTool === "whiteout") {
        const op: WhiteoutOperation = {
          id,
          pageNumber: currentPageNumber,
          timestamp: Date.now(),
          type: "whiteout",
          rect,
          fillColorHex: "#ffffff",
          opacity: 1.0,
        };
        await executeAddOperation(op);
      } else if (activeTool === "blackout") {
        const op: BlackoutOperation = {
          id,
          pageNumber: currentPageNumber,
          timestamp: Date.now(),
          type: "blackout",
          rect,
          fillColorHex: "#000000",
          opacity: 1.0,
        };
        await executeAddOperation(op);
      } else if (activeTool === "redaction") {
        // Collect intersecting text tokens to permanently purge
        const intersectingText = currentStyleProfile?.textTokens
          .filter((t) => {
            const isOverlapX = t.rect.x < rect.x + rect.width && t.rect.x + t.rect.width > rect.x;
            const isOverlapY = t.rect.y < rect.y + rect.height && t.rect.y + t.rect.height > rect.y;
            return isOverlapX && isOverlapY;
          })
          .map((t) => t.text)
          .join(" ");

        const op: RedactionOperation = {
          id,
          pageNumber: currentPageNumber,
          timestamp: Date.now(),
          type: "redaction",
          rect,
          isPermanent: true,
          fillColorHex: "#000000",
          textToRedact: intersectingText || undefined,
        };
        await executeAddOperation(op);
      } else if (activeTool === "link") {
        openAddLinkModal(rect);
        setStartPoint(null);
        setCurrentPoint(null);
        setActiveTool("select");
        return;
      } else if (activeTool.startsWith("shape_")) {
        const shapeType = activeTool.replace("shape_", "") as
          | "rectangle"
          | "circle"
          | "line"
          | "arrow";

        const op: AddShapeOperation = {
          id,
          pageNumber: currentPageNumber,
          timestamp: Date.now(),
          type: "add_shape",
          shapeType,
          rect,
          startPoint: startPoint,
          endPoint: currentPoint,
          strokeColorHex: activeFormatting.strokeColorHex || "#2563eb",
          fillColorHex:
            shapeType === "rectangle" || shapeType === "circle"
              ? activeFormatting.fillColorHex
              : undefined,
          strokeWidth: activeFormatting.strokeWidth || 2,
          opacity: activeFormatting.opacity || 1.0,
        };
        await executeAddOperation(op);
      }

      setStartPoint(null);
      setCurrentPoint(null);
      setActiveTool("select");
    }
  };

  // Start dragging selected element
  const handleElementMouseDown = (e: React.MouseEvent, op: EditOperation) => {
    e.stopPropagation();
    e.preventDefault();

    // Holding Space is always reserved for panning. The Grab tool itself is
    // deliberately object-first: grab an element to position it, or drag an
    // empty part of the page to pan. This keeps the tool useful for layout
    // work without taking away the familiar hand-tool canvas navigation.
    if (isSpacePressed) {
      const container = containerRef?.current;
      if (container) {
        overlayPanStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
        setIsOverlayPanning(true);
      }
      return;
    }

    selectElement(op.id);
    if (activeTool !== "select") {
      setActiveTool("select");
    }

    const screenCoord = getSvgCoordinates(e);
    const pdfCoord = screenToPdf(screenCoord.x, screenCoord.y);

    setIsDragging(true);
    setDragStartMouse(pdfCoord);
    setInitialOpState(JSON.parse(JSON.stringify(op)));
  };

  // Start resizing selected element
  const handleResizeHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    const screenCoord = getSvgCoordinates(e);
    const pdfCoord = screenToPdf(screenCoord.x, screenCoord.y);

    const currentOp = operations.find((o) => o.id === selectedElementId);
    if (!currentOp) return;

    setIsResizing(handle);
    setDragStartMouse(pdfCoord);
    setInitialOpState(JSON.parse(JSON.stringify(currentOp)));
  };

  // Find selected operation for selection handles
  const selectedOp = operations.find((o) => o.id === selectedElementId);
  let selectionBox: Rect | null = null;
  if (selectedOp) {
    if (
      selectedOp.type === "add_shape" &&
      (selectedOp.shapeType === "line" || selectedOp.shapeType === "arrow")
    ) {
      const p1 = selectedOp.startPoint || { x: selectedOp.rect.x, y: selectedOp.rect.y };
      const p2 = selectedOp.endPoint || {
        x: selectedOp.rect.x + selectedOp.rect.width,
        y: selectedOp.rect.y + selectedOp.rect.height,
      };
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const screenTopLeft = pdfToScreen(minX, maxY);
      selectionBox = {
        x: screenTopLeft.x - 6,
        y: screenTopLeft.y - 6,
        width: Math.max(16, (maxX - minX) * scale + 12),
        height: Math.max(16, (maxY - minY) * scale + 12),
      };
    } else if ("position" in selectedOp && selectedOp.type === "add_text") {
      const screenPos = pdfToScreen(selectedOp.position.x, selectedOp.position.y);
      const estWidth = Math.max(50, selectedOp.text.length * selectedOp.fontSize * 0.58 * scale);
      const estHeight = selectedOp.fontSize * 1.35 * scale;
      let boxX = screenPos.x;
      if (selectedOp.alignment === "center") {
        boxX = screenPos.x - estWidth / 2;
      } else if (selectedOp.alignment === "right") {
        boxX = screenPos.x - estWidth;
      }
      selectionBox = {
        x: boxX - 4,
        y: screenPos.y - estHeight - 2,
        width: estWidth + 8,
        height: estHeight + 4,
      };
    } else if ("rect" in selectedOp) {
      const screenPos = pdfToScreen(selectedOp.rect.x, selectedOp.rect.y + selectedOp.rect.height);
      selectionBox = {
        x: screenPos.x - 2,
        y: screenPos.y - 2,
        width: Math.max(16, selectedOp.rect.width * scale + 4),
        height: Math.max(16, selectedOp.rect.height * scale + 4),
      };
    } else if ("targetRect" in selectedOp) {
      const screenPos = pdfToScreen(selectedOp.targetRect.x, selectedOp.targetRect.y + selectedOp.targetRect.height);
      selectionBox = {
        x: screenPos.x - 2,
        y: screenPos.y - 2,
        width: Math.max(16, selectedOp.targetRect.width * scale + 4),
        height: Math.max(16, selectedOp.targetRect.height * scale + 4),
      };
    } else if (selectedOp.type === "freehand" && (selectedOp as any).points?.length > 0) {
      const pts = (selectedOp as any).points as Point[];
      let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const screenTopLeft = pdfToScreen(minX, maxY);
      selectionBox = {
        x: screenTopLeft.x - 6,
        y: screenTopLeft.y - 6,
        width: Math.max(16, (maxX - minX) * scale + 12),
        height: Math.max(16, (maxY - minY) * scale + 12),
      };
    }
  }

  return (
    <>
      <svg
        ref={svgRef}
      // The viewport also listens for pointer events to pan the canvas. Keep
      // overlay interactions inside this layer so a drag/resize never starts
      // a competing canvas pan before its mouse handler can run.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={(e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          handleMouseDown({ clientX: t.clientX, clientY: t.clientY, target: e.target } as any);
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          handleMouseMove({ clientX: t.clientX, clientY: t.clientY } as any);
        }
      }}
      onTouchEnd={() => handleMouseUp()}
      className={`absolute inset-0 z-10 w-full h-full select-none ${
        isGrabMode
          ? isOverlayPanning
            ? "cursor-grabbing"
            : "cursor-grab"
          : isDragging
          ? "cursor-grabbing"
          : activeTool === "select"
          ? "cursor-default"
          : activeTool === "add_text"
          ? "cursor-text"
          : "cursor-crosshair"
      }`}
    >
      {/* 1. Extracted Text Tokens (Clickable in select mode, edit_text mode, or add_text mode) */}
      {(activeTool === "select" || activeTool === "edit_text" || activeTool === "add_text") &&
        currentStyleProfile &&
        currentStyleProfile.textTokens.map((token) => {
          const screenPos = pdfToScreen(token.rect.x, token.rect.y + token.rect.height);
          const isSelected = selectedTokenId === token.id;
          const isEditTool = activeTool === "edit_text" || activeTool === "add_text";
          const boxWidth = Math.max(token.rect.width * scale, 12);
          const boxHeight = Math.max(token.rect.height * scale, 12);

          return (
            <g
              key={token.id}
              onClick={(e) => {
                e.stopPropagation();
                selectToken(token.id);
                if (activeTool === "edit_text") {
                  openTextEditorForToken(token.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                openTextEditorForToken(token.id);
              }}
              className="cursor-pointer pointer-events-auto group"
            >
              {/* Invisible expanded hit area (min 20px) to guarantee clicks NEVER miss */}
              <rect
                x={screenPos.x - 4}
                y={screenPos.y - 4}
                width={Math.max(boxWidth + 8, 20)}
                height={Math.max(boxHeight + 8, 20)}
                fill="transparent"
                pointerEvents="all"
                className="cursor-text"
              />
              {/* Visual token boundary */}
              <rect
                x={screenPos.x}
                y={screenPos.y}
                width={boxWidth}
                height={boxHeight}
                pointerEvents="all"
                fill={isSelected ? "rgba(59, 130, 246, 0.25)" : isEditTool ? "rgba(16, 185, 129, 0.08)" : "transparent"}
                stroke={isSelected ? "#2563eb" : isEditTool ? "#10b981" : "transparent"}
                strokeWidth={isEditTool ? 1.5 : 1}
                strokeDasharray={isSelected || isEditTool ? "2 2" : undefined}
                className={`${
                  isEditTool
                    ? "group-hover:fill-emerald-500/25 group-hover:stroke-emerald-600 cursor-text"
                    : "group-hover:fill-blue-500/15 group-hover:stroke-blue-400 cursor-pointer"
                } transition-colors`}
              />
              <text
                x={screenPos.x}
                y={screenPos.y + boxHeight * 0.78}
                fontSize={token.fontSize * scale}
                fontFamily="sans-serif"
                fill="transparent"
                pointerEvents="none"
                className="select-none"
              >
                {token.text}
              </text>
              {isSelected && (
                <foreignObject
                  x={Math.max(4, screenPos.x)}
                  y={Math.max(4, screenPos.y - 28)}
                  width={140}
                  height={26}
                  className="overflow-visible pointer-events-auto"
                >
                  <div className="flex items-center space-x-1 bg-slate-900/90 text-white rounded-md px-1.5 py-0.5 shadow-md text-[10px] whitespace-nowrap">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await copySelectedTextToClipboard();
                      }}
                      className="flex items-center space-x-1 px-1.5 py-0.5 hover:bg-slate-700 rounded transition font-medium"
                      title="Copy text to clipboard"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openTextEditorForToken(token.id);
                      }}
                      className="flex items-center space-x-1 px-1.5 py-0.5 hover:bg-slate-700 rounded transition font-medium text-emerald-400"
                      title="Modify this text"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </foreignObject>
              )}
              <title>
                {isEditTool
                  ? `Click to modify: "${token.text}"`
                  : `Extracted text: "${token.text}" (${token.fontSize}pt) • Double-click to modify`}
              </title>
            </g>
          );
        })}

      {/* Extracted Hyperlinks (Clickable Link Regions) */}
      {currentStyleProfile &&
        currentStyleProfile.hyperlinks.map((link) => {
          const screenPos = pdfToScreen(link.rect.x, link.rect.y + link.rect.height);
          const isExt = link.targetType === "external_url";
          return (
            <g
              key={link.id}
              onClick={(e) => {
                e.stopPropagation();
                openEditLinkModal(link);
              }}
              className="cursor-pointer pointer-events-auto group"
            >
              {/* Clean link target rectangle: subtle transparent unless link tool active or hovered */}
              <rect
                x={screenPos.x}
                y={screenPos.y}
                width={link.rect.width * scale}
                height={link.rect.height * scale}
                fill={activeTool === "link" ? "rgba(37, 99, 235, 0.15)" : "transparent"}
                stroke={activeTool === "link" ? "#2563eb" : "transparent"}
                strokeWidth={1}
                strokeDasharray={activeTool === "link" ? "3 2" : undefined}
                className="group-hover:fill-blue-500/15 group-hover:stroke-blue-500/80 transition-all"
              />
              {/* Badge only visible when Link tool is active OR on hover */}
              <g className={activeTool === "link" ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}>
                <rect
                  x={screenPos.x}
                  y={Math.max(2, screenPos.y - 14)}
                  width={isExt ? 46 : 52}
                  height={13}
                  rx={3}
                  fill="#1d4ed8"
                />
                <text
                  x={screenPos.x + 4}
                  y={Math.max(11, screenPos.y - 4)}
                  fill="#ffffff"
                  fontSize={8.5}
                  fontWeight="600"
                  fontFamily="sans-serif"
                >
                  {isExt ? "URL ↗" : "Page →"}
                </text>
              </g>
              <title>
                {isExt
                  ? `External Link: ${link.target}`
                  : `Internal Link: Page ${link.target}`}
              </title>
            </g>
          );
        })}

      {/* Extracted Existing Logos & Images from PDF (Select, Move, Resize, Replace) */}
      {(activeTool === "select" || activeTool === "add_image") &&
        currentStyleProfile &&
        currentStyleProfile.images
          .filter((img) => img.pageNumber === currentPageNumber)
          .map((img) => {
            const alreadyConverted = pageOperations.some(
              (op) =>
                op.type === "add_image" &&
                Math.abs(op.rect.x - img.rect.x) < 5 &&
                Math.abs(op.rect.y - img.rect.y) < 5
            );
            if (alreadyConverted) return null;

            const screen = pdfToScreen(img.rect.x, img.rect.y + img.rect.height);
            return (
              <g
                key={img.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectExistingImage(img);
                }}
                className="cursor-pointer pointer-events-auto group"
              >
                {/* Generous hitbox for effortless logo selection */}
                <rect
                  x={screen.x - 4}
                  y={screen.y - 4}
                  width={Math.max(img.rect.width * scale + 8, 20)}
                  height={Math.max(img.rect.height * scale + 8, 20)}
                  fill="transparent"
                  pointerEvents="all"
                  className="cursor-pointer"
                />
                {/* Visual hover outline */}
                <rect
                  x={screen.x - 2}
                  y={screen.y - 2}
                  width={img.rect.width * scale + 4}
                  height={img.rect.height * scale + 4}
                  fill="transparent"
                  stroke="#2447f5"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
                {/* Floating "Logo / Image" badge on hover */}
                <foreignObject
                  x={Math.max(2, screen.x)}
                  y={Math.max(2, screen.y - 24)}
                  width={160}
                  height={22}
                  className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  <div className="inline-flex items-center space-x-1 px-2 py-0.5 bg-[#0d1b3d] text-[#ffd84d] rounded-md text-[10px] font-semibold shadow-md whitespace-nowrap">
                    <ImageIcon className="w-2.5 h-2.5 text-[#ffd84d]" />
                    <span>Logo / Image (Click to Edit)</span>
                  </div>
                </foreignObject>
                <title>Logo / Image — Click to select, move, resize or replace</title>
              </g>
            );
          })}

      {/* 2. Operations Rendered on Page */}
      {pageOperations.map((op) => {
        const isSelected = selectedElementId === op.id;

        switch (op.type) {
          case "whiteout": {
            const screen = pdfToScreen(op.rect.x, op.rect.y + op.rect.height);
            return (
              <rect
                key={op.id}
                x={screen.x}
                y={screen.y}
                width={op.rect.width * scale}
                height={op.rect.height * scale}
                fill={op.fillColorHex || "#ffffff"}
                opacity={op.opacity ?? 1.0}
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                className="cursor-move pointer-events-auto"
              />
            );
          }

          case "blackout": {
            const screen = pdfToScreen(op.rect.x, op.rect.y + op.rect.height);
            return (
              <rect
                key={op.id}
                x={screen.x}
                y={screen.y}
                width={op.rect.width * scale}
                height={op.rect.height * scale}
                fill="#000000"
                opacity={op.opacity ?? 1.0}
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                className="cursor-move pointer-events-auto"
              />
            );
          }

          case "add_text": {
            const screen = pdfToScreen(op.position.x, op.position.y);
            const isEditingThis = editingOpId === op.id;

            if (isEditingThis) {
              const estWidth = Math.max(140, op.text.length * op.fontSize * scale * 0.7 + 40);
              const estHeight = op.fontSize * 1.8 * scale;
              return (
                <foreignObject
                  key={op.id}
                  x={screen.x - 2}
                  y={screen.y - op.fontSize * scale - 4}
                  width={estWidth}
                  height={estHeight}
                  className="overflow-visible pointer-events-auto z-30"
                >
                  <input
                    type="text"
                    autoFocus
                    value={editingTextValue}
                    onChange={(e) => setEditingTextValue(e.target.value)}
                    onBlur={() => {
                      executeUpdateElement(op.id, { text: editingTextValue });
                      setEditingOpId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        executeUpdateElement(op.id, { text: editingTextValue });
                        setEditingOpId(null);
                      } else if (e.key === "Escape") {
                        setEditingOpId(null);
                      }
                    }}
                    style={{
                      fontSize: `${Math.max(12, op.fontSize * scale)}px`,
                      fontFamily: op.fontFamily,
                      color: op.fontColorHex,
                      fontWeight: op.fontWeight,
                      fontStyle: op.fontStyle,
                    }}
                    className="w-full bg-white/95 border-2 border-blue-500 rounded px-2 py-0.5 shadow-lg focus:outline-hidden text-slate-900"
                  />
                </foreignObject>
              );
            }

            const estTextW = Math.max(40, op.text.length * op.fontSize * 0.58 * scale);
            const estTextH = op.fontSize * 1.35 * scale;
            const bgX =
              op.alignment === "center"
                ? screen.x - estTextW / 2
                : op.alignment === "right"
                ? screen.x - estTextW
                : screen.x;

            return (
              <g
                key={op.id}
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingOpId(op.id);
                  setEditingTextValue(op.text);
                }}
                className="cursor-move pointer-events-auto select-none group"
              >
                {/* Generous transparent hit-surface so clicking text never misses */}
                <rect
                  x={bgX - 4}
                  y={screen.y - estTextH}
                  width={estTextW + 8}
                  height={estTextH + 4}
                  fill="transparent"
                />
                <text
                  x={screen.x}
                  y={screen.y}
                  fill={op.fontColorHex}
                  fontSize={op.fontSize * scale}
                  fontFamily={op.fontFamily}
                  fontWeight={op.fontWeight}
                  fontStyle={op.fontStyle}
                  textAnchor={
                    op.alignment === "center"
                      ? "middle"
                      : op.alignment === "right"
                      ? "end"
                      : "start"
                  }
                  opacity={op.opacity ?? 1.0}
                >
                  {op.text}
                </text>
              </g>
            );
          }

          case "add_image": {
            const screen = pdfToScreen(op.rect.x, op.rect.y + op.rect.height);
            return (
              <image
                key={op.id}
                href={op.imageDataUrl}
                x={screen.x}
                y={screen.y}
                width={op.rect.width * scale}
                height={op.rect.height * scale}
                opacity={op.opacity ?? 1.0}
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  selectElement(op.id);
                  replaceImageInputRef.current?.click();
                }}
                className="cursor-move pointer-events-auto"
              >
                <title>Double-click to replace image</title>
              </image>
            );
          }

          case "add_shape": {
            if (op.shapeType === "rectangle") {
              const screen = pdfToScreen(op.rect.x, op.rect.y + op.rect.height);
              return (
                <rect
                  key={op.id}
                  x={screen.x}
                  y={screen.y}
                  width={op.rect.width * scale}
                  height={op.rect.height * scale}
                  stroke={op.strokeColorHex}
                  strokeWidth={op.strokeWidth * scale}
                  fill={op.fillColorHex || "none"}
                  opacity={op.opacity ?? 1.0}
                  onMouseDown={(e) => handleElementMouseDown(e, op)}
                  className="cursor-move pointer-events-auto"
                />
              );
            } else if (op.shapeType === "circle") {
              const screen = pdfToScreen(op.rect.x, op.rect.y + op.rect.height);
              const rx = (op.rect.width * scale) / 2;
              const ry = (op.rect.height * scale) / 2;
              return (
                <ellipse
                  key={op.id}
                  cx={screen.x + rx}
                  cy={screen.y + ry}
                  rx={rx}
                  ry={ry}
                  stroke={op.strokeColorHex}
                  strokeWidth={op.strokeWidth * scale}
                  fill={op.fillColorHex || "none"}
                  opacity={op.opacity ?? 1.0}
                  onMouseDown={(e) => handleElementMouseDown(e, op)}
                  className="cursor-move pointer-events-auto"
                />
              );
            } else if (op.shapeType === "line" || op.shapeType === "arrow") {
              const startX = op.startPoint ? op.startPoint.x : op.rect.x;
              const startY = op.startPoint ? op.startPoint.y : op.rect.y;
              const endX = op.endPoint ? op.endPoint.x : op.rect.x + op.rect.width;
              const endY = op.endPoint ? op.endPoint.y : op.rect.y + op.rect.height;

              const sScreen = pdfToScreen(startX, startY);
              const eScreen = pdfToScreen(endX, endY);

              return (
                <g key={op.id} onMouseDown={(e) => handleElementMouseDown(e, op)}>
                  <line
                    x1={sScreen.x}
                    y1={sScreen.y}
                    x2={eScreen.x}
                    y2={eScreen.y}
                    stroke={op.strokeColorHex}
                    strokeWidth={op.strokeWidth * scale}
                    opacity={op.opacity ?? 1.0}
                    className="cursor-move pointer-events-auto"
                  />
                  {op.shapeType === "arrow" && (
                    <polygon
                      points={`${eScreen.x},${eScreen.y} ${eScreen.x - 10},${eScreen.y - 5} ${eScreen.x - 10},${eScreen.y + 5}`}
                      fill={op.strokeColorHex}
                    />
                  )}
                </g>
              );
            }
            return null;
          }

          case "text_edit": {
            const screenMask = pdfToScreen(op.targetRect.x, op.targetRect.y + op.targetRect.height);
            const screenText = pdfToScreen(op.targetRect.x, op.targetRect.y);
            const isNative = op.strategy === EditStrategy.NativeStreamModification;
            const isRecon = op.strategy === EditStrategy.LocalReconstruction;
            const badgeColor = isNative ? "#059669" : isRecon ? "#2563eb" : "#d97706";
            const badgeLabel = isNative ? "Native" : isRecon ? "Reconstructed" : "Overlay";

            return (
              <g
                key={op.id}
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                className="cursor-pointer pointer-events-auto group"
              >
                {/* Mask original content rectangle with matched background */}
                <rect
                  x={screenMask.x}
                  y={screenMask.y}
                  width={op.targetRect.width * scale}
                  height={op.targetRect.height * scale}
                  fill={op.backgroundColorHex || currentStyleProfile?.inferredProperties?.pageBackgroundHex || "#ffffff"}
                  opacity={op.opacity ?? 1.0}
                />
                {/* Replacement text */}
                <text
                  x={screenText.x}
                  y={screenText.y}
                  fill={op.fontColorHex}
                  fontSize={op.fontSize * scale}
                  fontFamily={op.fontFamily}
                  fontWeight={op.fontWeight}
                  fontStyle={op.fontStyle}
                  opacity={op.opacity ?? 1.0}
                >
                  {op.replacementText}
                </text>
                {/* Strategy border indicator when selected or hovered */}
                <rect
                  x={screenMask.x - 1}
                  y={screenMask.y - 1}
                  width={Math.max(op.targetRect.width * scale, op.replacementText.length * op.fontSize * 0.55 * scale) + 2}
                  height={op.targetRect.height * scale + 2}
                  fill="none"
                  stroke={isSelected ? badgeColor : "transparent"}
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  className="group-hover:stroke-slate-400"
                />
                {/* Strategy Badge Tag */}
                {isSelected && (
                  <g transform={`translate(${screenMask.x}, ${screenMask.y - 14})`}>
                    <rect
                      x={0}
                      y={0}
                      width={badgeLabel.length * 7 + 10}
                      height={13}
                      rx={2}
                      fill={badgeColor}
                    />
                    <text
                      x={5}
                      y={9}
                      fill="#ffffff"
                      fontSize={8}
                      fontWeight="bold"
                      fontFamily="sans-serif"
                    >
                      {badgeLabel}
                    </text>
                  </g>
                )}
              </g>
            );
          }

          case "redaction": {
            const screen = pdfToScreen(op.rect.x, op.rect.y + op.rect.height);
            return (
              <g
                key={op.id}
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                className="cursor-move pointer-events-auto group"
              >
                <rect
                  x={screen.x}
                  y={screen.y}
                  width={op.rect.width * scale}
                  height={op.rect.height * scale}
                  fill="#000000"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                />
                <rect
                  x={screen.x}
                  y={screen.y - 12}
                  width={56}
                  height={12}
                  rx={2}
                  fill="#dc2626"
                />
                <text
                  x={screen.x + 3}
                  y={screen.y - 3}
                  fill="#ffffff"
                  fontSize={8}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  REDACTED
                </text>
              </g>
            );
          }

          case "add_hyperlink": {
            const screen = pdfToScreen(op.rect.x, op.rect.y + op.rect.height);
            const isExt = op.targetType === "external_url";
            return (
              <g
                key={op.id}
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                className="cursor-move pointer-events-auto group"
              >
                <rect
                  x={screen.x}
                  y={screen.y}
                  width={op.rect.width * scale}
                  height={op.rect.height * scale}
                  fill="rgba(59, 130, 246, 0.15)"
                  stroke="#2563eb"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
                <rect
                  x={screen.x}
                  y={screen.y - 12}
                  width={isExt ? 40 : 45}
                  height={12}
                  rx={2}
                  fill="#2563eb"
                />
                <text
                  x={screen.x + 3}
                  y={screen.y - 3}
                  fill="#ffffff"
                  fontSize={8}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {isExt ? "URL ↗" : "Page →"}
                </text>
              </g>
            );
          }

          case "freehand": {
            const svgPath = generateSvgPath(op.points);
            const isHighlighter = Boolean(op.isHighlighter);
            return (
              <g
                key={op.id}
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                className="cursor-move pointer-events-auto"
              >
                <path
                  d={svgPath}
                  fill="none"
                  stroke={op.strokeColorHex}
                  strokeWidth={(op.strokeWidth || 3) * scale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={op.opacity ?? (isHighlighter ? 0.4 : 1.0)}
                  style={isHighlighter ? { mixBlendMode: "multiply" } : undefined}
                />
              </g>
            );
          }

          default:
            return null;
        }
      })}

      {/* 3. Live Shape & Drawing Preview */}
      {isDrawing && (activeTool === "draw" || activeTool === "highlight") && drawPoints.length > 0 && (
        <path
          d={generateSvgPath(drawPoints)}
          fill="none"
          stroke={activeFormatting.strokeColorHex || (activeTool === "highlight" ? "#facc15" : "#2563eb")}
          strokeWidth={(activeTool === "highlight" ? (activeFormatting.strokeWidth || 16) : (activeFormatting.strokeWidth || 3)) * scale}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={activeTool === "highlight" ? (activeFormatting.opacity ?? 0.4) : (activeFormatting.opacity ?? 1.0)}
          style={activeTool === "highlight" ? { mixBlendMode: "multiply" } : undefined}
        />
      )}
      {isDrawing && startPoint && currentPoint && (
        <>
          {activeTool === "whiteout" && (
            <rect
              x={Math.min(pdfToScreen(startPoint.x, 0).x, pdfToScreen(currentPoint.x, 0).x)}
              y={Math.min(pdfToScreen(0, startPoint.y).y, pdfToScreen(0, currentPoint.y).y)}
              width={Math.abs(startPoint.x - currentPoint.x) * scale}
              height={Math.abs(startPoint.y - currentPoint.y) * scale}
              fill="#ffffff"
              stroke="#94a3b8"
              strokeDasharray="4 4"
            />
          )}
          {activeTool === "blackout" && (
            <rect
              x={Math.min(pdfToScreen(startPoint.x, 0).x, pdfToScreen(currentPoint.x, 0).x)}
              y={Math.min(pdfToScreen(0, startPoint.y).y, pdfToScreen(0, currentPoint.y).y)}
              width={Math.abs(startPoint.x - currentPoint.x) * scale}
              height={Math.abs(startPoint.y - currentPoint.y) * scale}
              fill="#000000"
              stroke="#475569"
            />
          )}
          {activeTool === "redaction" && (
            <rect
              x={Math.min(pdfToScreen(startPoint.x, 0).x, pdfToScreen(currentPoint.x, 0).x)}
              y={Math.min(pdfToScreen(0, startPoint.y).y, pdfToScreen(0, currentPoint.y).y)}
              width={Math.abs(startPoint.x - currentPoint.x) * scale}
              height={Math.abs(startPoint.y - currentPoint.y) * scale}
              fill="rgba(220, 38, 38, 0.25)"
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
          {activeTool === "link" && (
            <rect
              x={Math.min(pdfToScreen(startPoint.x, 0).x, pdfToScreen(currentPoint.x, 0).x)}
              y={Math.min(pdfToScreen(0, startPoint.y).y, pdfToScreen(0, currentPoint.y).y)}
              width={Math.abs(startPoint.x - currentPoint.x) * scale}
              height={Math.abs(startPoint.y - currentPoint.y) * scale}
              fill="rgba(37, 99, 235, 0.15)"
              stroke="#2563eb"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          )}
          {activeTool === "shape_rect" && (
            <rect
              x={Math.min(pdfToScreen(startPoint.x, 0).x, pdfToScreen(currentPoint.x, 0).x)}
              y={Math.min(pdfToScreen(0, startPoint.y).y, pdfToScreen(0, currentPoint.y).y)}
              width={Math.abs(startPoint.x - currentPoint.x) * scale}
              height={Math.abs(startPoint.y - currentPoint.y) * scale}
              stroke={activeFormatting.strokeColorHex}
              strokeWidth={activeFormatting.strokeWidth || 2}
              fill={activeFormatting.fillColorHex || "none"}
              strokeDasharray="3 3"
            />
          )}
          {activeTool === "shape_circle" && (
            <ellipse
              cx={(pdfToScreen(startPoint.x, 0).x + pdfToScreen(currentPoint.x, 0).x) / 2}
              cy={(pdfToScreen(0, startPoint.y).y + pdfToScreen(0, currentPoint.y).y) / 2}
              rx={(Math.abs(startPoint.x - currentPoint.x) * scale) / 2}
              ry={(Math.abs(startPoint.y - currentPoint.y) * scale) / 2}
              stroke={activeFormatting.strokeColorHex}
              strokeWidth={activeFormatting.strokeWidth || 2}
              fill={activeFormatting.fillColorHex || "none"}
              strokeDasharray="3 3"
            />
          )}
          {(activeTool === "shape_line" || activeTool === "shape_arrow") && (
            <line
              x1={pdfToScreen(startPoint.x, startPoint.y).x}
              y1={pdfToScreen(startPoint.x, startPoint.y).y}
              x2={pdfToScreen(currentPoint.x, currentPoint.y).x}
              y2={pdfToScreen(currentPoint.x, currentPoint.y).y}
              stroke={activeFormatting.strokeColorHex}
              strokeWidth={activeFormatting.strokeWidth || 2}
              strokeDasharray="3 3"
            />
          )}
        </>
      )}

      {/* 4. Selection Bounding Box & Transform Handles */}
      {selectionBox && (
        <g className="pointer-events-auto">
          {/* Active transform surface - lets the user reposition from anywhere in the bounds. */}
          <rect
            x={selectionBox.x}
            y={selectionBox.y}
            width={selectionBox.width}
            height={selectionBox.height}
            fill="rgba(59, 130, 246, 0.06)"
            stroke="#2563eb"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            className="cursor-grab active:cursor-grabbing pointer-events-auto"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (selectedOp) {
                handleElementMouseDown(e, selectedOp);
              }
            }}
          />

          {/* Quick Floating Action Bar above selected element */}
          <foreignObject
            x={Math.max(4, selectionBox.x)}
            y={Math.max(4, selectionBox.y - 32)}
            width={Math.max(240, selectionBox.width)}
            height={28}
            className="overflow-visible pointer-events-auto z-40"
          >
            <div className="inline-flex items-center space-x-2 bg-[#0d1b3d] text-[#f4f1ea] px-3 py-1.5 rounded-full shadow-xl text-xs font-medium whitespace-nowrap border border-[#2a3a66]">
              <span className="text-[11px] text-[#ffd84d] font-semibold flex items-center space-x-1 pr-2 border-r border-[#2a3a66]">
                <Move className="w-3 h-3 text-[#ffd84d]" />
                <span>
                  {selectedOp && "rect" in selectedOp
                    ? `${Math.round(selectedOp.rect.width)} × ${Math.round(selectedOp.rect.height)} pt`
                    : selectedOp && "targetRect" in selectedOp
                    ? `${Math.round(selectedOp.targetRect.width)} × ${Math.round(selectedOp.targetRect.height)} pt`
                    : selectedOp && "fontSize" in selectedOp
                    ? `${selectedOp.fontSize} pt`
                    : "Element"}
                </span>
              </span>

              <span className="sr-only">Drag to position. Use any blue handle to resize.</span>

              {/* Replace Image / Logo */}
              {selectedOp && selectedOp.type === "add_image" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    replaceImageInputRef.current?.click();
                  }}
                  className="flex items-center space-x-1 px-2.5 py-0.5 bg-[#2447f5] hover:bg-blue-600 rounded-full transition text-white text-[11px] font-semibold shadow-xs"
                  title="Replace this logo or image with a new file"
                >
                  <RefreshCw className="w-3 h-3 text-[#ffd84d]" />
                  <span>Replace Image</span>
                </button>
              )}

              {/* Duplicate element */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateSelected();
                }}
                className="p-1 hover:bg-white/20 rounded transition text-[#f4f1ea]"
                title="Duplicate element (Ctrl+D)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              {/* Delete element */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSelected();
                }}
                className="p-1 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300"
                title="Delete element (Delete/Backspace)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </foreignObject>

          {/* 8 Crisp Transform Handles with generous 16x16 click/drag hitboxes */}
          {/* NW */}
          <g className="cursor-nwse-resize pointer-events-auto" onMouseDown={(e) => handleResizeHandleMouseDown(e, "nw")}>
            <rect x={selectionBox.x - 8} y={selectionBox.y - 8} width={16} height={16} fill="transparent" />
            <rect x={selectionBox.x - 5} y={selectionBox.y - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} className="shadow-xs" />
          </g>
          {/* NE */}
          <g className="cursor-nesw-resize pointer-events-auto" onMouseDown={(e) => handleResizeHandleMouseDown(e, "ne")}>
            <rect x={selectionBox.x + selectionBox.width - 8} y={selectionBox.y - 8} width={16} height={16} fill="transparent" />
            <rect x={selectionBox.x + selectionBox.width - 5} y={selectionBox.y - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} className="shadow-xs" />
          </g>
          {/* SE */}
          <g className="cursor-nwse-resize pointer-events-auto" onMouseDown={(e) => handleResizeHandleMouseDown(e, "se")}>
            <rect x={selectionBox.x + selectionBox.width - 8} y={selectionBox.y + selectionBox.height - 8} width={16} height={16} fill="transparent" />
            <rect x={selectionBox.x + selectionBox.width - 5} y={selectionBox.y + selectionBox.height - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} className="shadow-xs" />
          </g>
          {/* SW */}
          <g className="cursor-nesw-resize pointer-events-auto" onMouseDown={(e) => handleResizeHandleMouseDown(e, "sw")}>
            <rect x={selectionBox.x - 8} y={selectionBox.y + selectionBox.height - 8} width={16} height={16} fill="transparent" />
            <rect x={selectionBox.x - 5} y={selectionBox.y + selectionBox.height - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} className="shadow-xs" />
          </g>
          {/* N */}
          <g className="cursor-ns-resize pointer-events-auto" onMouseDown={(e) => handleResizeHandleMouseDown(e, "n")}>
            <rect x={selectionBox.x + selectionBox.width / 2 - 8} y={selectionBox.y - 8} width={16} height={16} fill="transparent" />
            <rect x={selectionBox.x + selectionBox.width / 2 - 5} y={selectionBox.y - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} className="shadow-xs" />
          </g>
          {/* S */}
          <g className="cursor-ns-resize pointer-events-auto" onMouseDown={(e) => handleResizeHandleMouseDown(e, "s")}>
            <rect x={selectionBox.x + selectionBox.width / 2 - 8} y={selectionBox.y + selectionBox.height - 8} width={16} height={16} fill="transparent" />
            <rect x={selectionBox.x + selectionBox.width / 2 - 5} y={selectionBox.y + selectionBox.height - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} className="shadow-xs" />
          </g>
          {/* E */}
          <g className="cursor-ew-resize pointer-events-auto" onMouseDown={(e) => handleResizeHandleMouseDown(e, "e")}>
            <rect x={selectionBox.x + selectionBox.width - 8} y={selectionBox.y + selectionBox.height / 2 - 8} width={16} height={16} fill="transparent" />
            <rect x={selectionBox.x + selectionBox.width - 5} y={selectionBox.y + selectionBox.height / 2 - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} className="shadow-xs" />
          </g>
          {/* W */}
          <g className="cursor-ew-resize pointer-events-auto" onMouseDown={(e) => handleResizeHandleMouseDown(e, "w")}>
            <rect x={selectionBox.x - 8} y={selectionBox.y + selectionBox.height / 2 - 8} width={16} height={16} fill="transparent" />
            <rect x={selectionBox.x - 5} y={selectionBox.y + selectionBox.height / 2 - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} className="shadow-xs" />
          </g>
        </g>
      )}
    </svg>

    {/* Hidden file input for replacing images/logos */}
    <input
      type="file"
      ref={replaceImageInputRef}
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      onChange={handleReplaceImageFile}
      className="hidden"
    />
  </>
  );
};
