import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

export type QrLevel = "L" | "M" | "Q" | "H";

/** Матрица модулей QR (true — тёмный). qrcode.react не отдаёт матрицу наружу,
 * поэтому берём SVG без отступов и разбираем отрезки пути вида `M x y h n`. */
export const buildQrMatrix = (value: string, level: QrLevel): boolean[][] => {
  const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value, level, marginSize: 0 }));
  const size = Number(/viewBox="0 0 (\d+) /.exec(svg)?.[1] ?? 0);
  const matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const paths = [...svg.matchAll(/<path[^>]*d="([^"]+)"/g)];
  const fg = paths[paths.length - 1]?.[1] ?? "";
  for (const m of fg.matchAll(/M(\d+)[ ,](\d+)\s*h(\d+)/g)) {
    const [x, y, w] = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let i = 0; i < w; i++) matrix[y][x + i] = true;
  }
  return matrix;
};
