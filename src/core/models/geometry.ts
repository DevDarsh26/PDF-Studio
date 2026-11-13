/**
 * 2D Geometry and coordinate primitives for PDF layout
 */

export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 8-point quad for rotated or skewed bounding areas:
 * [ul_x, ul_y, ur_x, ur_y, ll_x, ll_y, lr_x, lr_y]
 */
export type Quad = [number, number, number, number, number, number, number, number];

/**
 * 6-element affine transformation matrix:
 * [scaleX, skewY, skewX, scaleY, translateX, translateY]
 */
export type TransformMatrix = [number, number, number, number, number, number];

export function rectToQuad(r: Rect): Quad {
  return [
    r.x, r.y,
    r.x + r.width, r.y,
    r.x, r.y + r.height,
    r.x + r.width, r.y + r.height,
  ];
}

export function quadToBoundingRect(q: Quad): Rect {
  const xs = [q[0], q[2], q[4], q[6]];
  const ys = [q[1], q[3], q[5], q[7]];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

