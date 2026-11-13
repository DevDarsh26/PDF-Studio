"use client";

import React, { useRef, useState, useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import {
  AddTextOperation,
  AddShapeOperation,
  WhiteoutOperation,
  BlackoutOperation,
  TextEditOperation,
  EditOperation,
  EditStrategy,
} from "@/core/models/operations";
import { Point, Rect } from "@/core/models/geometry";

interface InteractiveOverlayProps {
  pageWidth: number; // in points
  pageHeight: number; // in points
  scale: number;
}

export const InteractiveOverlay: React.FC<InteractiveOverlayProps> = ({
  pageWidth,
  pageHeight,
  scale,
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
    executeAddOperation,
    executeUpdateElement,
    deleteSelected,
    activeFormatting,
    currentStyleProfile,
  } = useEditorStore();

  const svgRef = useRef<SVGSVGElement>(null);

  // Drawing state for shapes and whiteout
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);

  // Dragging / Resizing state for selected element
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null); // e.g. "se", "nw", etc.
  const [dragStartMouse, setDragStartMouse] = useState<Point | null>(null);
  const [initialOpState, setInitialOpState] = useState<any>(null);

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

  const getSvgCoordinates = (e: React.MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Delete key listener
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementId, deleteSelected]);

  // Operations on the current page
  const pageOperations = operations.filter(
    (op) => "pageNumber" in op && op.pageNumber === currentPageNumber
  );

  // Mouse Down handler
  const handleMouseDown = async (e: React.MouseEvent) => {
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

    if (activeTool === "add_text") {
      const newTextOp: AddTextOperation = {
        id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        pageNumber: currentPageNumber,
        timestamp: Date.now(),
        type: "add_text",
        position: pdfCoord,
        text: "Click to edit text",
        fontFamily: activeFormatting.fontFamily,
        fontSize: activeFormatting.fontSize,
        fontWeight: activeFormatting.fontWeight,
        fontStyle: activeFormatting.fontStyle,
        fontColorHex: activeFormatting.fontColorHex,
        alignment: activeFormatting.alignment,
        opacity: activeFormatting.opacity,
      };

      await executeAddOperation(newTextOp);
      setActiveTool("select");
      return;
    }

    // Tools that require drag: whiteout, blackout, shape_rect, shape_circle, shape_line, shape_arrow
    setIsDrawing(true);
    setStartPoint(pdfCoord);
    setCurrentPoint(pdfCoord);
  };

  // Mouse Move handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const screenCoord = getSvgCoordinates(e);
    const pdfCoord = screenToPdf(screenCoord.x, screenCoord.y);

    if (isDrawing) {
      setCurrentPoint(pdfCoord);
      return;
    }

    if (isDragging && selectedElementId && initialOpState && dragStartMouse) {
      const deltaX = pdfCoord.x - dragStartMouse.x;
      const deltaY = pdfCoord.y - dragStartMouse.y;

      if ("position" in initialOpState) {
        executeUpdateElement(selectedElementId, {
          position: {
            x: Math.round((initialOpState.position.x + deltaX) * 10) / 10,
            y: Math.round((initialOpState.position.y + deltaY) * 10) / 10,
          },
        });
      } else if ("rect" in initialOpState) {
        executeUpdateElement(selectedElementId, {
          rect: {
            ...initialOpState.rect,
            x: Math.round((initialOpState.rect.x + deltaX) * 10) / 10,
            y: Math.round((initialOpState.rect.y + deltaY) * 10) / 10,
          },
        });
      } else if ("targetRect" in initialOpState) {
        executeUpdateElement(selectedElementId, {
          targetRect: {
            ...initialOpState.targetRect,
            x: Math.round((initialOpState.targetRect.x + deltaX) * 10) / 10,
            y: Math.round((initialOpState.targetRect.y + deltaY) * 10) / 10,
          },
        });
      }
      return;
    }

    if (isResizing && selectedElementId && initialOpState && dragStartMouse) {
      const deltaX = pdfCoord.x - dragStartMouse.x;
      const deltaY = pdfCoord.y - dragStartMouse.y;

      if ("rect" in initialOpState) {
        const prev = initialOpState.rect;
        let newX = prev.x;
        let newY = prev.y;
        let newW = prev.width;
        let newH = prev.height;

        if (isResizing.includes("e")) newW = Math.max(10, prev.width + deltaX);
        if (isResizing.includes("s")) {
          newY = prev.y + deltaY;
          newH = Math.max(10, prev.height - deltaY);
        }
        if (isResizing.includes("w")) {
          newX = prev.x + deltaX;
          newW = Math.max(10, prev.width - deltaX);
        }
        if (isResizing.includes("n")) newH = Math.max(10, prev.height + deltaY);

        executeUpdateElement(selectedElementId, {
          rect: {
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10,
            width: Math.round(newW * 10) / 10,
            height: Math.round(newH * 10) / 10,
          },
        });
      }
    }
  };

  // Mouse Up handler
  const handleMouseUp = async () => {
    if (isDragging) {
      setIsDragging(false);
      setDragStartMouse(null);
      setInitialOpState(null);
      return;
    }

    if (isResizing) {
      setIsResizing(null);
      setDragStartMouse(null);
      setInitialOpState(null);
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
    if (activeTool !== "select") return;
    e.stopPropagation();
    selectElement(op.id);

    const screenCoord = getSvgCoordinates(e);
    const pdfCoord = screenToPdf(screenCoord.x, screenCoord.y);

    setIsDragging(true);
    setDragStartMouse(pdfCoord);
    setInitialOpState(JSON.parse(JSON.stringify(op)));
  };

  // Start resizing selected element
  const handleResizeHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
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
    if ("rect" in selectedOp) {
      const screenPos = pdfToScreen(selectedOp.rect.x, selectedOp.rect.y + selectedOp.rect.height);
      selectionBox = {
        x: screenPos.x,
        y: screenPos.y,
        width: selectedOp.rect.width * scale,
        height: selectedOp.rect.height * scale,
      };
    } else if ("position" in selectedOp && selectedOp.type === "add_text") {
      const screenPos = pdfToScreen(selectedOp.position.x, selectedOp.position.y);
      const estWidth = Math.max(60, selectedOp.text.length * selectedOp.fontSize * 0.55 * scale);
      const estHeight = selectedOp.fontSize * 1.3 * scale;
      selectionBox = {
        x: screenPos.x,
        y: screenPos.y - estHeight,
        width: estWidth,
        height: estHeight,
      };
    }
  }

  return (
    <svg
      ref={svgRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`absolute inset-0 z-10 w-full h-full select-none ${
        activeTool === "select"
          ? "cursor-default"
          : activeTool === "add_text"
          ? "cursor-text"
          : "cursor-crosshair"
      }`}
    >
      {/* 1. Extracted Text Tokens (Clickable in select mode for Style Matching, or in edit_text mode for modification) */}
      {(activeTool === "select" || activeTool === "edit_text") &&
        currentStyleProfile &&
        currentStyleProfile.textTokens.map((token) => {
          const screenPos = pdfToScreen(token.rect.x, token.rect.y + token.rect.height);
          const isSelected = selectedTokenId === token.id;
          const isEditTool = activeTool === "edit_text";
          return (
            <rect
              key={token.id}
              x={screenPos.x}
              y={screenPos.y}
              width={token.rect.width * scale}
              height={token.rect.height * scale}
              fill={isSelected ? "rgba(59, 130, 246, 0.2)" : isEditTool ? "rgba(16, 185, 129, 0.08)" : "transparent"}
              stroke={isSelected ? "#2563eb" : isEditTool ? "#10b981" : "transparent"}
              strokeWidth={isEditTool ? 1.5 : 1}
              strokeDasharray={isSelected || isEditTool ? "2 2" : undefined}
              className={`${
                isEditTool
                  ? "hover:fill-emerald-500/20 hover:stroke-emerald-600 cursor-text"
                  : "hover:fill-blue-500/10 hover:stroke-blue-400 cursor-pointer"
              } pointer-events-auto transition-colors`}
              onClick={(e) => {
                e.stopPropagation();
                selectToken(token.id);
                if (isEditTool) {
                  openTextEditorForToken(token.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                openTextEditorForToken(token.id);
              }}
            >
              <title>
                {isEditTool
                  ? `Click to modify: "${token.text}"`
                  : `Extracted text: "${token.text}" (${token.fontSize}pt)`}
              </title>
            </rect>
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
            return (
              <text
                key={op.id}
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
                onMouseDown={(e) => handleElementMouseDown(e, op)}
                className="cursor-move pointer-events-auto select-none"
              >
                {op.text}
              </text>
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
                className="cursor-move pointer-events-auto"
              />
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
                {/* Mask original content rectangle */}
                <rect
                  x={screenMask.x}
                  y={screenMask.y}
                  width={op.targetRect.width * scale}
                  height={op.targetRect.height * scale}
                  fill="#ffffff"
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

          default:
            return null;
        }
      })}

      {/* 3. Live Shape Drawing Preview */}
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
          <rect
            x={selectionBox.x}
            y={selectionBox.y}
            width={selectionBox.width}
            height={selectionBox.height}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          {/* 8 Transform Handles */}
          {/* NW */}
          <rect
            x={selectionBox.x - 4}
            y={selectionBox.y - 4}
            width={8}
            height={8}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={1.5}
            className="cursor-nwse-resize"
            onMouseDown={(e) => handleResizeHandleMouseDown(e, "nw")}
          />
          {/* NE */}
          <rect
            x={selectionBox.x + selectionBox.width - 4}
            y={selectionBox.y - 4}
            width={8}
            height={8}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={1.5}
            className="cursor-nesw-resize"
            onMouseDown={(e) => handleResizeHandleMouseDown(e, "ne")}
          />
          {/* SE */}
          <rect
            x={selectionBox.x + selectionBox.width - 4}
            y={selectionBox.y + selectionBox.height - 4}
            width={8}
            height={8}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={1.5}
            className="cursor-nwse-resize"
            onMouseDown={(e) => handleResizeHandleMouseDown(e, "se")}
          />
          {/* SW */}
          <rect
            x={selectionBox.x - 4}
            y={selectionBox.y + selectionBox.height - 4}
            width={8}
            height={8}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={1.5}
            className="cursor-nesw-resize"
            onMouseDown={(e) => handleResizeHandleMouseDown(e, "sw")}
          />
        </g>
      )}
    </svg>
  );
};
