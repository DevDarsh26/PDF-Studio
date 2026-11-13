import "@testing-library/jest-dom";

// Mock HTMLCanvasElement.getContext and Path2D for Node/jsdom testing environment
if (typeof window !== "undefined") {
  if (typeof globalThis.Path2D === "undefined") {
    (globalThis as any).Path2D = class Path2D {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    };
  }

  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextType: string) {
    if (contextType === "2d") {
      const self = this;
      return {
        canvas: self,
        fillRect: () => {},
        clearRect: () => {},
        getImageData: (x: number, y: number, w: number, h: number) => ({
          data: new Array(w * h * 4).fill(0),
        }),
        putImageData: () => {},
        createImageData: () => [],
        setTransform: () => {},
        getTransform: () => ({
          a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
          m11: 1, m12: 0, m13: 0, m14: 0,
          m21: 0, m22: 1, m23: 0, m24: 0,
          m31: 0, m32: 0, m33: 1, m34: 0,
          m41: 0, m42: 0, m43: 0, m44: 1,
          is2D: true,
          isIdentity: true,
        }),
        resetTransform: () => {},
        drawImage: () => {},
        save: () => {},
        fillText: () => {},
        strokeText: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        bezierCurveTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        stroke: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        arc: () => {},
        fill: () => {},
        createPattern: () => null,
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        measureText: (text: string) => ({
          width: text.length * 8,
          actualBoundingBoxAscent: 10,
          actualBoundingBoxDescent: 2,
        }),
        transform: () => {},
        rect: () => {},
        clip: () => {},
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
