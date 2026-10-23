import { QR_ARTS, svgDocument } from "./qr-art";
import { buildQrMatrix } from "./qr-matrix";
import { QR_FORMATS, type QrDesign } from "./qr-presets";

const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Детерминированный «случайный» генератор — узор не прыгает между перерисовками. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, "")}…`;
  }
  return lines;
};

const hexLum = (hex: string): number => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Контраст кода и плашки по WCAG; ниже ~3 сканеры начинают ошибаться. */
export const qrContrast = (design: QrDesign): number => {
  const fg = design.qrColor === "gradient" ? [design.bgFrom, design.bgTo] : [design.qrColor];
  const bg = hexLum(design.plateColor);
  return Math.min(
    ...fg.map((c) => {
      const l = hexLum(c);
      return (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05);
    }),
  );
};

/** Рисует постер с QR-кодом. scale < 1 — для миниатюр шаблонов. */
export const renderQrPoster = async (
  canvas: HTMLCanvasElement,
  value: string,
  design: QrDesign,
  scale = 1,
  /** Свой размер вместо формата из дизайна — для карточек на листе A4. */
  size?: { w: number; h: number },
): Promise<void> => {
  const fmt = QR_FORMATS.find((f) => f.value === design.format) ?? QR_FORMATS[0];
  const W = Math.round((size?.w ?? fmt.w) * scale);
  const H = Math.round((size?.h ?? fmt.h) * scale);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const art = design.art ? QR_ARTS[design.art] : undefined;
  const ts = design.textScale ?? 1;
  const titleAbove = design.titlePosition === "above";

  // Надпись вне плашки (у мемной сцены подпись рисует сама сцена) — считаем
  // заранее, чтобы оставить ей место у края листа.
  const subFont = `600 ${Math.round(W * 0.045 * ts)}px ${FONT}`;
  ctx.font = subFont;
  const subLines = design.subtitle.trim() && !art ? wrapText(ctx, design.subtitle.trim(), W * 0.82, 2) : [];
  const subLh = W * 0.056 * ts;
  const subBg = design.subtitleBg ?? "none";
  const subPadX = subBg === "none" ? 0 : W * 0.035 * ts;
  const subPadY = subBg === "none" ? 0 : W * 0.018 * ts;
  const subGap = W * 0.04;
  const subH = subLines.length ? subLines.length * subLh + subPadY * 2 + subGap : 0;
  const subBelow = design.subtitlePosition === "below";
  // Запас под сцену растёт вместе с её подписью.
  const topMin = H * 0.04 + (subBelow ? 0 : subH) + (art?.reserveAbove ?? 0) * W * ts;
  const bottomMax = H - H * 0.04 - (subBelow ? subH : 0) - (art?.reserveBelow ?? 0) * W * ts;

  // Плашка: QR + название — считается заранее, от неё строится мемная сцена.
  // Не влезает между отступами — код уменьшается, пока не влезет: крупный
  // размер и длинное название не должны срезать код краем карточки.
  const plateFor = (qrSize: number) => {
    const pad = qrSize * 0.09;
    const titleFont = `700 ${Math.round(qrSize * 0.075 * ts)}px ${FONT}`;
    ctx.font = titleFont;
    const titleLines = design.title.trim() ? wrapText(ctx, design.title.trim(), qrSize + pad * 0.5, 3) : [];
    const lineH = qrSize * 0.095 * ts;
    const titleBlock = titleLines.length ? pad * 0.6 + titleLines.length * lineH : 0;
    return { qrSize, pad, titleFont, titleLines, lineH, titleBlock, plateW: qrSize + pad * 2, plateH: qrSize + pad * 2 + titleBlock };
  };
  let plate = plateFor(W * design.qrScale);
  for (let i = 0; i < 30 && plate.plateH > bottomMax - topMin && plate.qrSize > W * 0.2; i++) {
    plate = plateFor(plate.qrSize * 0.95);
  }
  const { qrSize, pad, titleFont, titleLines, lineH, titleBlock, plateW, plateH } = plate;
  const plateX = (W - plateW) / 2;
  // По центру (posY) стоит вся группа «плашка + надпись»: надпись снизу
  // поднимает код, сверху — опускает, без надписи код ровно на posY.
  const groupTop = design.posY * H - (plateH + subH) / 2;
  const plateY = Math.max(Math.min(groupTop + (subBelow ? 0 : subH), bottomMax - plateH), topMin);
  const geometry = { W, H, plate: { x: plateX, y: plateY, w: plateW, h: plateH }, subtitle: design.subtitle, textScale: ts };
  const svgImage = (body: string) =>
    loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDocument(W, H, body))}`).catch(() => undefined);

  const [cover, centerImg, artUnder, artOver] = await Promise.all([
    design.bgImage ? loadImage(design.bgImage).catch(() => undefined) : undefined,
    design.centerImage ? loadImage(design.centerImage).catch(() => undefined) : undefined,
    art ? svgImage(art.under(geometry)) : undefined,
    art?.over ? svgImage(art.over(geometry)) : undefined,
  ]);

  // Фон
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, design.bgFrom);
  bgGrad.addColorStop(1, design.bgTo);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  if (cover) {
    drawCover(ctx, cover, W, H);
    if (design.bgDim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${design.bgDim})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Мемная сцена под плашкой
  if (artUnder) ctx.drawImage(artUnder, 0, 0, W, H);

  // Узор
  if (!cover && !artUnder && design.pattern !== "none") {
    const rnd = seeded(42);
    const step = W / 7;
    ctx.save();
    ctx.globalAlpha = design.pattern === "emoji" ? 0.22 : 0.12;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(step * 0.42)}px ${FONT}`;
    ctx.fillStyle = design.textColor;
    for (let row = -1; row * step < H + step; row++) {
      for (let col = -1; col * step < W + step; col++) {
        const x = col * step + (row % 2 ? step / 2 : 0) + (rnd() - 0.5) * step * 0.3;
        const y = row * step + (rnd() - 0.5) * step * 0.3;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rnd() - 0.5) * 0.9);
        if (design.pattern === "emoji") ctx.fillText(design.patternEmoji || "✨", 0, 0);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, step * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.18)";
  ctx.shadowBlur = qrSize * 0.06;
  ctx.shadowOffsetY = qrSize * 0.015;
  ctx.fillStyle = design.plateColor;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, qrSize * 0.09);
  ctx.fill();
  ctx.restore();

  const qrX = plateX + pad;
  const qrY = plateY + pad + (titleAbove ? titleBlock : 0);
  const hasCenter = Boolean(centerImg || design.centerEmoji.trim());
  const matrix = buildQrMatrix(value, hasCenter ? "H" : "M");
  const n = matrix.length;
  const cell = qrSize / n;

  let fill: string | CanvasGradient = design.qrColor;
  if (design.qrColor === "gradient") {
    const g = ctx.createLinearGradient(qrX, qrY, qrX + qrSize, qrY + qrSize);
    g.addColorStop(0, design.bgFrom);
    g.addColorStop(1, design.bgTo);
    fill = g;
  }
  ctx.fillStyle = fill;

  const inEye = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  // Зона под эмодзи/логотип: уровень коррекции H выдерживает ~25% потерь, берём ~22% ширины.
  const hole = hasCenter ? Math.ceil(n * 0.22) | 1 : 0;
  const holeStart = (n - hole) / 2;
  const inHole = (x: number, y: number) =>
    hole > 0 && x >= holeStart && x < holeStart + hole && y >= holeStart && y < holeStart + hole;

  ctx.beginPath();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!matrix[y][x] || inEye(x, y) || inHole(x, y)) continue;
      const px = qrX + x * cell;
      const py = qrY + y * cell;
      if (design.dotStyle === "dots") {
        ctx.moveTo(px + cell * 0.92, py + cell / 2);
        ctx.arc(px + cell / 2, py + cell / 2, cell * 0.42, 0, Math.PI * 2);
      } else if (design.dotStyle === "rounded") {
        ctx.roundRect(px + cell * 0.04, py + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.35);
      } else {
        // +0.5px убирает просветы между соседними модулями
        ctx.rect(px, py, cell + 0.5, cell + 0.5);
      }
    }
  }
  ctx.fill();

  // «Глаза» — три угловых маркера
  const eye = (ex: number, ey: number) => {
    const ox = qrX + ex * cell;
    const oy = qrY + ey * cell;
    ctx.beginPath();
    if (design.eyeStyle === "circle") {
      ctx.arc(ox + 3.5 * cell, oy + 3.5 * cell, 3.5 * cell, 0, Math.PI * 2);
      ctx.arc(ox + 3.5 * cell, oy + 3.5 * cell, 2.5 * cell, 0, Math.PI * 2, true);
      ctx.moveTo(ox + 5 * cell, oy + 3.5 * cell);
      ctx.arc(ox + 3.5 * cell, oy + 3.5 * cell, 1.5 * cell, 0, Math.PI * 2);
    } else {
      const r = design.eyeStyle === "rounded" ? cell * 2 : 0;
      const ri = design.eyeStyle === "rounded" ? cell * 1.2 : 0;
      ctx.roundRect(ox, oy, 7 * cell, 7 * cell, r);
      ctx.roundRect(ox + cell, oy + cell, 5 * cell, 5 * cell, ri * 0.8);
      ctx.fill("evenodd");
      ctx.beginPath();
      ctx.roundRect(ox + 2 * cell, oy + 2 * cell, 3 * cell, 3 * cell, ri * 0.6);
    }
    ctx.fill("evenodd");
  };
  eye(0, 0);
  eye(n - 7, 0);
  eye(0, n - 7);

  // Центр: эмодзи или картинка
  if (hasCenter) {
    const size = hole * cell;
    const cx = qrX + holeStart * cell;
    const cy = qrY + holeStart * cell;
    if (centerImg) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx + cell * 0.4, cy + cell * 0.4, size - cell * 0.8, size - cell * 0.8, size * 0.2);
      ctx.clip();
      const s = Math.max((size - cell * 0.8) / centerImg.width, (size - cell * 0.8) / centerImg.height);
      ctx.drawImage(
        centerImg,
        cx + size / 2 - (centerImg.width * s) / 2,
        cy + size / 2 - (centerImg.height * s) / 2,
        centerImg.width * s,
        centerImg.height * s,
      );
      ctx.restore();
    } else {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.round(size * 0.78)}px ${FONT}`;
      ctx.fillText(design.centerEmoji.trim(), cx + size / 2, cy + size / 2 + size * 0.04);
    }
  }

  // Название на плашке
  if (titleLines.length) {
    ctx.fillStyle = design.qrColor === "gradient" ? fill : design.qrColor;
    if (design.qrColor === "gradient") {
      const g = ctx.createLinearGradient(plateX, 0, plateX + plateW, 0);
      g.addColorStop(0, design.bgFrom);
      g.addColorStop(1, design.bgTo);
      ctx.fillStyle = g;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = titleFont;
    const titleTop = titleAbove ? plateY + pad : qrY + qrSize + pad * 0.6;
    titleLines.forEach((line, i) => ctx.fillText(line, W / 2, titleTop + i * lineH));
  }

  // Мемная сцена поверх плашки — только по её полям, код не закрывает
  if (artOver) ctx.drawImage(artOver, 0, 0, W, H);

  // Надпись над или под плашкой, при желании — на подложке
  if (subLines.length) {
    ctx.font = subFont;
    const blockH = subLines.length * subLh + subPadY * 2;
    const top = subBelow ? plateY + plateH + subGap : plateY - subGap - blockH;
    if (subBg !== "none") {
      const boxW = Math.max(...subLines.map((l) => ctx.measureText(l).width)) + subPadX * 2;
      ctx.fillStyle = subBg === "light" ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.82)";
      ctx.beginPath();
      ctx.roundRect((W - boxW) / 2, top, boxW, blockH, Math.min(blockH / 2, W * 0.04));
      ctx.fill();
    }
    ctx.fillStyle = subBg === "light" ? "#0f172a" : subBg === "dark" ? "#ffffff" : cover ? "#ffffff" : design.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    subLines.forEach((line, i) => ctx.fillText(line, W / 2, top + subPadY + subLh * (i + 0.5)));
  }
};

/** Печать PNG через скрытый iframe — window.print() напечатал бы всю страницу. */
export const printImage = (dataUrl: string, title: string) => {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "absolute", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(`<html><head><title>${title.replace(/</g, "&lt;")}</title>
<style>@page{margin:0}html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center}
img{max-width:100%;max-height:100vh;object-fit:contain}</style></head>
<body><img src="${dataUrl}" onload="window.print()"/></body></html>`);
  doc.close();
  iframe.contentWindow!.onafterprint = () => iframe.remove();
};
