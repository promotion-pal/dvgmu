import { renderQrPoster } from "./qr-render";
import type { QrDesign } from "./qr-presets";

/** Лист A4 при 300 dpi. */
export const SHEET = { w: 2480, h: 3508, mmW: 210, mmH: 297 };

export type SheetTile = "a4" | "a5" | "a6" | "a7" | "a8";

/** Как формат A(n) делит A4 без остатка: каждая следующая — половина
 * предыдущей. Нечётные шаги ложатся на лист боком, карточка поворачивается,
 * поэтому сама она всегда остаётся вертикальной. */
export const SHEET_TILES: { value: SheetTile; label: string; cols: number; rows: number; rotate: boolean }[] = [
  { value: "a6", label: "A6 · 4 на листе", cols: 2, rows: 2, rotate: false },
  { value: "a5", label: "A5 · 2 на листе", cols: 1, rows: 2, rotate: true },
  { value: "a4", label: "A4 · 1 на листе", cols: 1, rows: 1, rotate: false },
  { value: "a7", label: "A7 · 8 на листе", cols: 2, rows: 4, rotate: true },
  { value: "a8", label: "A8 · 16 на листе", cols: 4, rows: 4, rotate: false },
];

export const tileSpec = (tile: SheetTile) => SHEET_TILES.find((t) => t.value === tile) ?? SHEET_TILES[0];
export const perSheet = (tile: SheetTile) => tileSpec(tile).cols * tileSpec(tile).rows;

export interface SheetItem {
  value: string;
  design: QrDesign;
}

/** Рисует один лист A4, плотно заполненный карточками. */
export const renderSheet = async (
  canvas: HTMLCanvasElement,
  items: SheetItem[],
  tile: SheetTile,
  { scale = 1, cutLines = true }: { scale?: number; cutLines?: boolean } = {},
): Promise<void> => {
  const spec = tileSpec(tile);
  const W = Math.round(SHEET.w * scale);
  const H = Math.round(SHEET.h * scale);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const cellW = SHEET.w / spec.cols;
  const cellH = SHEET.h / spec.rows;
  // Карточка всегда вертикальная: при повороте меняем стороны местами.
  const poster = spec.rotate ? { w: cellH, h: cellW } : { w: cellW, h: cellH };

  const tileCanvas = document.createElement("canvas");
  for (let i = 0; i < items.length && i < spec.cols * spec.rows; i++) {
    const col = i % spec.cols;
    const row = Math.floor(i / spec.cols);
    await renderQrPoster(tileCanvas, items[i].value, items[i].design, scale, poster);
    const x = col * cellW * scale;
    const y = row * cellH * scale;
    ctx.save();
    ctx.translate(x + (cellW * scale) / 2, y + (cellH * scale) / 2);
    if (spec.rotate) ctx.rotate(-Math.PI / 2);
    ctx.drawImage(tileCanvas, -tileCanvas.width / 2, -tileCanvas.height / 2);
    ctx.restore();
  }

  if (cutLines && spec.cols * spec.rows > 1) {
    ctx.strokeStyle = "rgba(100,116,139,0.55)";
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.setLineDash([12 * scale, 10 * scale]);
    ctx.beginPath();
    for (let c = 1; c < spec.cols; c++) {
      ctx.moveTo(c * cellW * scale, 0);
      ctx.lineTo(c * cellW * scale, H);
    }
    for (let r = 1; r < spec.rows; r++) {
      ctx.moveTo(0, r * cellH * scale);
      ctx.lineTo(W, r * cellH * scale);
    }
    ctx.stroke();
  }
};

const canvasJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b))) : reject(new Error("toBlob"))),
      "image/jpeg",
      0.92,
    ),
  );

/** Минимальный PDF: по странице A4 на картинку JPEG во весь лист (DCTDecode). */
export const buildPdf = (pages: { jpeg: Uint8Array; w: number; h: number }[]): Blob => {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const pageW = (SHEET.mmW / 25.4) * 72;
  const pageH = (SHEET.mmH / 25.4) * 72;

  // 1 — каталог, 2 — дерево страниц, далее по 3 объекта на страницу.
  const pageIds = pages.map((_, i) => 3 + i * 3);
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const obj = (id: number, body: () => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body();
    push("\nendobj\n");
  };
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`));
  pages.forEach((page, i) => {
    const pid = pageIds[i];
    const content = `q ${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(pid, () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] ` +
          `/Resources << /XObject << /Im0 ${pid + 2} 0 R >> >> /Contents ${pid + 1} 0 R >>`,
      ),
    );
    obj(pid + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(pid + 2, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${page.w} /Height ${page.h} /ColorSpace /DeviceRGB ` +
          `/BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      );
      push(page.jpeg);
      push("\nendstream");
    });
  });
  const total = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let id = 1; id < total; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
};

/** Раскладывает карточки по листам и собирает PDF. onProgress — номер готового листа. */
export const renderSheetsPdf = async (
  items: SheetItem[],
  tile: SheetTile,
  cutLines: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> => {
  const n = perSheet(tile);
  const total = Math.ceil(items.length / n);
  const canvas = document.createElement("canvas");
  const pages: { jpeg: Uint8Array; w: number; h: number }[] = [];
  for (let s = 0; s < total; s++) {
    await renderSheet(canvas, items.slice(s * n, s * n + n), tile, { cutLines });
    pages.push({ jpeg: await canvasJpeg(canvas), w: canvas.width, h: canvas.height });
    onProgress?.(s + 1, total);
  }
  return buildPdf(pages);
};
