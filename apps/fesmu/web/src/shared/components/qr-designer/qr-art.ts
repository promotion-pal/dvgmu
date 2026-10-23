/* Мемные сцены для шаблонов QR. Сцена рисуется вокруг плашки с кодом: её
 * геометрию даёт renderQrPoster, поэтому сцена подстраивается под формат и
 * размер кода. `under` — фон и персонажи под плашкой, `over` — то, что
 * держит плашку (палец, лапки, кулак), поверх неё, но только на её полях:
 * модули и угловые маркеры кода ничем не закрываются.
 *
 * Персонажи нарисованы с нуля по мотивам известных мемов — без реальных
 * людей и чужих мультперсонажей. */

export type QrArtId = "hand" | "paws" | "plz" | "sign" | "facepalm" | "doge" | "loading";

export interface QrArtGeometry {
  W: number;
  H: number;
  /** Плашка с кодом и названием. */
  plate: { x: number; y: number; w: number; h: number };
  /** Подпись из конструктора — сцена ставит её туда, где есть место. */
  subtitle: string;
  /** Множитель размера текста из конструктора (шутка сцены и подпись). */
  textScale?: number;
}

export interface QrArt {
  under: (g: QrArtGeometry) => string;
  over?: (g: QrArtGeometry) => string;
  /** Сколько места (в долях ширины) нужно сцене под плашкой — лапки и подпись;
   *  крупная плашка не опустится ниже, иначе подпись срежет край карточки. */
  reserveBelow?: number;
  /** То же над плашкой — для сцен с подписью сверху. */
  reserveAbove?: number;
}

const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

export const svgDocument = (W: number, H: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;

/** Строки текста по центру x, перенос по словам на глаз (ширина символа ≈ 0.55 кегля). */
const text = (value: string, x: number, y: number, size: number, maxWidth: number, style: string, anchor = "middle") => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const perLine = Math.max(4, Math.floor(maxWidth / (size * 0.55)));
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + word).length <= perLine) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines
    .slice(0, 3)
    .map((line, i) => `<text x="${x}" y="${y + i * size * 1.2}" font-size="${size}" text-anchor="${anchor}" font-family="${FONT}" ${style}>${esc(line)}</text>`)
    .join("");
};

/** Шутка сцены и подпись конструктора одним блоком, сверху вниз от y. */
const caption = (g: QrArtGeometry, joke: string, y: number, color: string, x = g.W / 2, maxWidth = g.W * 0.86, anchor = "middle") => {
  const size = g.W * 0.042 * (g.textScale ?? 1);
  const jokeLines = Math.min(3, Math.ceil((joke.length * size * 0.55) / maxWidth));
  return (
    text(joke, x, y, size, maxWidth, `font-weight="700" fill="${color}"`, anchor) +
    (g.subtitle.trim() ? text(g.subtitle, x, y + jokeLines * size * 1.2 + size * 0.3, size * 0.85, maxWidth, `font-weight="500" fill="${color}" opacity=".8"`, anchor) : "")
  );
};

const rect = (W: number, H: number, fill: string) => `<rect width="${W}" height="${H}" fill="${fill}"/>`;

/* ───────────── рука с карточкой ───────────── */

const hand: QrArt = {
  reserveAbove: 0.23,
  under: (g) => {
    const { W, H, plate: p } = g;
    const u = p.w;
    return (
      `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${W * 0.05}"/></filter></defs>` +
      rect(W, H, "#e0e7ff") +
      `<g filter="url(#b)"><circle cx="${W * 0.2}" cy="${H * 0.15}" r="${W * 0.3}" fill="#c7d2fe"/><circle cx="${W * 0.85}" cy="${H * 0.3}" r="${W * 0.28}" fill="#fbcfe8"/>` +
      `<circle cx="${W * 0.55}" cy="${H * 0.9}" r="${W * 0.35}" fill="#bae6fd"/>` +
      `<circle cx="${W / 2}" cy="${p.y + u * 0.1}" r="${u * 0.38}" fill="#f4a261" opacity=".45"/>` +
      `<ellipse cx="${W / 2}" cy="${p.y + p.h}" rx="${u * 0.8}" ry="${u * 0.7}" fill="#3f3a52" opacity=".3"/></g>` +
      caption(g, "Сканируй — не пожалеешь 😉", Math.max(W * 0.08, p.y - W * 0.19 * (g.textScale ?? 1)), "#312e81")
    );
  },
  // Ладонь из-за края листа, большой палец — на нижнем левом углу плашки.
  over: (g) => {
    const { plate: p } = g;
    const u = p.w;
    const cx = p.x + u * 0.025;
    const cy = p.y + p.h - u * 0.01;
    return (
      `<ellipse cx="${p.x - u * 0.12}" cy="${p.y + p.h + u * 0.3}" rx="${u * 0.24}" ry="${u * 0.34}" fill="#f2c4a8" transform="rotate(-25 ${p.x - u * 0.12} ${p.y + p.h + u * 0.3})"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${u * 0.05}" ry="${u * 0.1}" fill="#f5cdb4" stroke="#d9a084" stroke-width="${u * 0.006}" transform="rotate(-25 ${cx} ${cy})"/>` +
      `<ellipse cx="${cx + u * 0.012}" cy="${cy - u * 0.05}" rx="${u * 0.026}" ry="${u * 0.035}" fill="#fbe4d6" transform="rotate(-25 ${cx} ${cy})"/>`
    );
  },
};

/* ───────────── котик держит код в лапках ───────────── */

const paws: QrArt = {
  reserveBelow: 0.34,
  under: (g) => {
    const { W, H, plate: p } = g;
    const u = p.w;
    const cx = W / 2;
    const top = p.y;
    return (
      rect(W, H, "#ffffff") +
      `<path d="M${cx - u * 0.72} ${top - u * 0.38} L${cx - u * 0.5} ${top - u * 0.86} L${cx - u * 0.22} ${top - u * 0.44} Z M${cx + u * 0.72} ${top - u * 0.38} L${cx + u * 0.5} ${top - u * 0.86} L${cx + u * 0.22} ${top - u * 0.44} Z" fill="#e8b48a"/>` +
      `<path d="M${cx - u * 0.62} ${top - u * 0.42} L${cx - u * 0.5} ${top - u * 0.72} L${cx - u * 0.34} ${top - u * 0.46} Z M${cx + u * 0.62} ${top - u * 0.42} L${cx + u * 0.5} ${top - u * 0.72} L${cx + u * 0.34} ${top - u * 0.46} Z" fill="#f6c9c0"/>` +
      `<ellipse cx="${cx}" cy="${top + u * 0.05}" rx="${u * 0.8}" ry="${u * 0.6}" fill="#f1c9a2"/>` +
      `<circle cx="${cx - u * 0.32}" cy="${top - u * 0.2}" r="${u * 0.15}" fill="#141414"/><circle cx="${cx + u * 0.32}" cy="${top - u * 0.2}" r="${u * 0.15}" fill="#141414"/>` +
      `<circle cx="${cx - u * 0.27}" cy="${top - u * 0.26}" r="${u * 0.045}" fill="#fff"/><circle cx="${cx + u * 0.37}" cy="${top - u * 0.26}" r="${u * 0.045}" fill="#fff"/>` +
      `<path d="M${cx - u * 0.06} ${top - u * 0.06} Q${cx} ${top - u * 0.1} ${cx + u * 0.06} ${top - u * 0.06} Q${cx} ${top} ${cx - u * 0.06} ${top - u * 0.06} Z" fill="#e79aa3"/>` +
      `<path d="M${cx - u * 0.95} ${top - u * 0.02} L${cx - u * 0.55} ${top + u * 0.02} M${cx - u * 0.95} ${top + u * 0.08} L${cx - u * 0.55} ${top + u * 0.08} M${cx + u * 0.95} ${top - u * 0.02} L${cx + u * 0.55} ${top + u * 0.02} M${cx + u * 0.95} ${top + u * 0.08} L${cx + u * 0.55} ${top + u * 0.08}" stroke="#c9a385" stroke-width="${u * 0.01}" stroke-linecap="round"/>` +
      caption(g, "отсканируй, пожалуйста 🥺", p.y + p.h + u * 0.24, "#9a3412")
    );
  },
  // Синяя рамка и ладони под плашкой — заходят только на её нижнее поле.
  over: (g) => {
    const { plate: p } = g;
    const u = p.w;
    const bottom = p.y + p.h;
    const palm = (dx: number) =>
      `<ellipse cx="${p.x + u / 2 + dx}" cy="${bottom + u * 0.06}" rx="${u * 0.27}" ry="${u * 0.1}" fill="#f8d9c4" stroke="#e5b89c" stroke-width="${u * 0.007}"/>` +
      [-0.14, -0.04, 0.06, 0.16]
        .map((f) => `<path d="M${p.x + u / 2 + dx + u * f} ${bottom + u * 0.0} q${u * 0.01} ${u * 0.06} 0 ${u * 0.12}" stroke="#e5b89c" stroke-width="${u * 0.005}" fill="none"/>`)
        .join("");
    return (
      `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${u * 0.08}" fill="none" stroke="#1d4ed8" stroke-width="${u * 0.025}"/>` +
      palm(-u * 0.25) +
      palm(u * 0.25)
    );
  },
};

/* ───────────── котик просит plz со стопкой пятёрок ───────────── */

const plz: QrArt = {
  reserveBelow: 0.6,
  under: (g) => {
    const { W, H, plate: p } = g;
    const top = p.y + p.h + W * 0.04;
    const bottom = Math.min(H - W * 0.3, top + W * 0.32);
    const five = (x: number, y: number, rot: number, fill: string) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})"><rect width="${W * 0.16}" height="${W * 0.11}" rx="${W * 0.01}" fill="${fill}" stroke="#15803d" stroke-width="${W * 0.005}"/>` +
      `<text x="${W * 0.08}" y="${W * 0.085}" font-size="${W * 0.075}" font-weight="800" text-anchor="middle" fill="#15803d" font-family="${FONT}">5</text></g>`;
    const kx = W * 0.2;
    const ky = H - W * 0.12;
    return (
      rect(W, H, "#f4f4f5") +
      `<path d="M${W * 0.04} ${top + W * 0.06} Q${W * 0.04} ${top} ${W * 0.12} ${top} L${W * 0.88} ${top} Q${W * 0.96} ${top} ${W * 0.96} ${top + W * 0.06} L${W * 0.96} ${bottom - W * 0.06} Q${W * 0.96} ${bottom} ${W * 0.88} ${bottom} L${W * 0.32} ${bottom} L${kx} ${ky - W * 0.12} L${W * 0.24} ${bottom} L${W * 0.12} ${bottom} Q${W * 0.04} ${bottom} ${W * 0.04} ${bottom - W * 0.06} Z" fill="#fff" stroke="#111" stroke-width="${W * 0.008}"/>` +
      five(W * 0.16, top + W * 0.06, -8, "#bbf7d0") +
      five(W * 0.24, top + W * 0.09, 6, "#dcfce7") +
      `<text x="${W * 0.7}" y="${(top + bottom) / 2 + W * 0.045}" font-size="${W * 0.13}" font-weight="800" text-anchor="middle" fill="#111" font-family="${FONT}">plz</text>` +
      `<path d="M${kx - W * 0.15} ${ky - W * 0.02} L${kx - W * 0.11} ${ky - W * 0.13} L${kx - W * 0.05} ${ky - W * 0.06} Z M${kx + W * 0.15} ${ky - W * 0.02} L${kx + W * 0.11} ${ky - W * 0.13} L${kx + W * 0.05} ${ky - W * 0.06} Z" fill="#9ca3af"/>` +
      `<ellipse cx="${kx}" cy="${ky + W * 0.03}" rx="${W * 0.17}" ry="${W * 0.12}" fill="#a1a1aa"/><ellipse cx="${kx}" cy="${ky + W * 0.07}" rx="${W * 0.1}" ry="${W * 0.07}" fill="#f4f4f5"/>` +
      `<path d="M${kx - W * 0.08} ${ky + W * 0.02} q${W * 0.02} ${W * 0.015} ${W * 0.04} 0 M${kx + W * 0.04} ${ky + W * 0.02} q${W * 0.02} ${W * 0.015} ${W * 0.04} 0" stroke="#3f3f46" stroke-width="${W * 0.008}" fill="none" stroke-linecap="round"/>` +
      caption(g, "пожалуйста, ну очень надо", H - W * 0.17, "#18181b", W * 0.42, W * 0.54, "start")
    );
  },
};

/* ───────────── жёлтая рука держит табличку под водой ───────────── */

const sign: QrArt = {
  reserveBelow: 0.24,
  under: (g) => {
    const { W, H, plate: p } = g;
    const ring = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#bfeefa" stroke-width="${W * 0.012}" opacity=".7"/>`;
    return (
      `<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3e8"/><stop offset=".6" stop-color="#38a3d1"/><stop offset="1" stop-color="#1d6fa8"/></linearGradient></defs>` +
      rect(W, H, "url(#sea)") +
      ring(W * 0.12, H * 0.08, W * 0.07) +
      ring(W * 0.9, H * 0.25, W * 0.05) +
      ring(W * 0.08, H * 0.7, W * 0.055) +
      ring(W * 0.9, H * 0.88, W * 0.08) +
      ring(W * 0.8, H * 0.05, W * 0.03) +
      caption(g, "Тут QR. Отсканируй, пока не уплыл 🫧", p.y + p.h + W * 0.08, "#ecfeff")
    );
  },
  // Рука справа и кулак над верхним полем плашки.
  over: (g) => {
    const { W, plate: p } = g;
    const u = p.w;
    const fx = p.x + u * 0.62;
    const fy = p.y - u * 0.04;
    return (
      `<path d="M${fx + u * 0.1} ${fy - u * 0.02} C${fx + u * 0.4} ${fy - u * 0.08} ${W * 0.8} ${fy - u * 0.02} ${W + u * 0.05} ${fy + u * 0.08} L${W + u * 0.05} ${fy + u * 0.16} C${W * 0.8} ${fy + u * 0.07} ${fx + u * 0.4} ${fy + u * 0.03} ${fx + u * 0.12} ${fy + u * 0.06} Z" fill="#f5e23a" stroke="#c9b11c" stroke-width="${u * 0.008}"/>` +
      `<rect x="${fx - u * 0.12}" y="${fy - u * 0.07}" width="${u * 0.26}" height="${u * 0.15}" rx="${u * 0.06}" fill="#f5e23a" stroke="#c9b11c" stroke-width="${u * 0.009}"/>` +
      [-0.06, 0, 0.06]
        .map((f) => `<path d="M${fx + u * f} ${fy - u * 0.05} q${u * 0.02} ${u * 0.05} 0 ${u * 0.1}" stroke="#c9b11c" stroke-width="${u * 0.007}" fill="none"/>`)
        .join("")
    );
  },
};

/* ───────────── «когда тест начался, а QR ты так и не отсканировал» ───────────── */

const figure = (x: number, y: number, s: number, facepalm: boolean, opacity = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})" opacity="${opacity}">` +
  `<path d="M-70 140 C-66 90 -40 68 0 66 C40 68 66 90 70 140 Z" fill="#3b2f2a"/>` +
  `<path d="M-48 100 C-28 78 28 78 48 100 C38 86 22 76 0 76 C-22 76 -38 86 -48 100 Z" fill="#8a6a50"/>` +
  `<ellipse cx="0" cy="22" rx="38" ry="46" fill="#e9b99a"/>` +
  `<path d="M-38 14 C-40 -22 -14 -36 6 -30 C30 -30 44 -10 38 14 C30 -2 18 -10 0 -8 C-16 -8 -30 0 -38 14 Z" fill="#5a3a22"/>` +
  (facepalm
    ? `<path d="M-30 14 C-22 0 26 0 32 18 C34 32 26 40 16 44 L-14 44 C-26 38 -32 26 -30 14 Z" fill="#dda585" stroke="#b9805e" stroke-width="2"/>`
    : `<ellipse cx="-14" cy="22" rx="4" ry="3" fill="#2b2b2b"/><ellipse cx="14" cy="22" rx="4" ry="3" fill="#2b2b2b"/><path d="M-11 46 L11 46" stroke="#a8705a" stroke-width="3" stroke-linecap="round"/>`) +
  `</g>`;

const facepalm: QrArt = {
  reserveBelow: 0.3,
  under: (g) => {
    const { W, H, plate: p } = g;
    const u = p.w;
    const s = u / 260;
    const fy = p.y - u * 0.62;
    return (
      rect(W, H, "#e7efe2") +
      figure(W * 0.12, fy, s, true, 0.25) +
      figure(W * 0.88, fy, s, true, 0.25) +
      figure(W / 2, fy, s, false) +
      // Крышка ноутбука вокруг плашки: код как наклейка на ней.
      `<rect x="${p.x - u * 0.12}" y="${p.y - u * 0.08}" width="${p.w + u * 0.24}" height="${p.h + u * 0.14}" rx="${u * 0.04}" fill="#d4d4d8" stroke="#a1a1aa" stroke-width="${u * 0.01}"/>` +
      caption(g, "когда тест начался, а QR ты так и не отсканировал", p.y + p.h + u * 0.16, "#365314")
    );
  },
};

/* ───────────── much scan, very тест ───────────── */

const doge: QrArt = {
  reserveBelow: 0.22,
  under: (g) => {
    const { W, H, plate: p } = g;
    const u = p.w;
    const cx = W / 2;
    const cy = p.y - u * 0.33;
    const s = u * 0.5;
    // Слова фразы — столбиком, чтобы поместиться в поле сбоку от плашки.
    const word = (t: string, x: number, y: number, color: string, rot: number) => {
      const size = Math.min(W * 0.05, (p.x * 1.6) / Math.max(...t.split(" ").map((w) => w.length)));
      return t
        .split(" ")
        .map(
          (w, i) =>
            `<text x="${x}" y="${y + i * size * 1.1}" font-size="${size}" font-weight="700" fill="${color}" text-anchor="middle" font-family="'Comic Sans MS', 'Comic Neue', cursive" transform="rotate(${rot} ${x} ${y})">${esc(w)}</text>`,
        )
        .join("");
    };
    const side = p.x / 2;
    return (
      rect(W, H, "#fdf6e3") +
      `<path d="M${cx - s * 0.82} ${cy - s * 0.2} L${cx - s * 0.6} ${cy - s * 0.95} L${cx - s * 0.25} ${cy - s * 0.55} Z M${cx + s * 0.82} ${cy - s * 0.2} L${cx + s * 0.6} ${cy - s * 0.95} L${cx + s * 0.25} ${cy - s * 0.55} Z" fill="#d99a4e"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${s * 0.85}" ry="${s * 0.75}" fill="#e0a65a"/><ellipse cx="${cx}" cy="${cy + s * 0.32}" rx="${s * 0.58}" ry="${s * 0.42}" fill="#fbe8c8"/>` +
      `<ellipse cx="${cx - s * 0.36}" cy="${cy - s * 0.12}" rx="${s * 0.09}" ry="${s * 0.075}" fill="#2b1d0e"/><ellipse cx="${cx + s * 0.36}" cy="${cy - s * 0.12}" rx="${s * 0.09}" ry="${s * 0.075}" fill="#2b1d0e"/>` +
      `<ellipse cx="${cx}" cy="${cy + s * 0.18}" rx="${s * 0.15}" ry="${s * 0.1}" fill="#2b1d0e"/><path d="M${cx - s * 0.15} ${cy + s * 0.38} Q${cx} ${cy + s * 0.5} ${cx + s * 0.15} ${cy + s * 0.38}" stroke="#2b1d0e" stroke-width="${s * 0.04}" fill="none" stroke-linecap="round"/>` +
      word("much QR", W * 0.15, cy - s * 0.7, "#e11d48", -8) +
      word("wow", W * 0.85, cy - s * 0.6, "#2563eb", 10) +
      word("very тест", side, p.y + p.h * 0.25, "#16a34a", -6) +
      word("such знания", W - side, p.y + p.h * 0.18, "#9333ea", 6) +
      word("скань", side, p.y + p.h * 0.8, "#f59e0b", -10) +
      word("amaze", W - side, p.y + p.h * 0.75, "#0891b2", 8) +
      caption(g, "wow. такой QR. отсканируй", p.y + p.h + W * 0.08, "#78350f")
    );
  },
};

/* ───────────── загрузка знаний 99% ───────────── */

const loading: QrArt = {
  reserveBelow: 0.22,
  under: (g) => {
    const { W, H, plate: p } = g;
    const m = W * 0.05;
    const mono = "ui-monospace, Menlo, monospace";
    const line = (t: string, y: number, color: string) =>
      `<text x="${m * 2}" y="${y}" font-size="${W * 0.036}" fill="${color}" font-family="${mono}">${esc(t)}</text>`;
    const textTop = Math.max(m * 3.4, p.y - W * 0.28);
    const barW = W - m * 6;
    return (
      rect(W, H, "#0b1020") +
      `<rect x="${m}" y="${m}" width="${W - m * 2}" height="${H - m * 2}" rx="${W * 0.04}" fill="none" stroke="#334155" stroke-width="${W * 0.006}"/>` +
      `<path d="M${m} ${m + W * 0.04} Q${m} ${m} ${m + W * 0.04} ${m} L${W - m - W * 0.04} ${m} Q${W - m} ${m} ${W - m} ${m + W * 0.04} L${W - m} ${m * 2.3} L${m} ${m * 2.3} Z" fill="#1e293b"/>` +
      ["#ef4444", "#f59e0b", "#22c55e"].map((c, i) => `<circle cx="${m * 1.8 + i * W * 0.04}" cy="${m * 1.65}" r="${W * 0.012}" fill="${c}"/>`).join("") +
      `<text x="${m * 1.8 + W * 0.14}" y="${m * 1.65 + W * 0.012}" font-size="${W * 0.03}" fill="#94a3b8" font-family="${mono}">знания.exe</text>` +
      line("> загрузка знаний…", textTop, "#4ade80") +
      `<rect x="${m * 2}" y="${textTop + W * 0.03}" width="${barW}" height="${W * 0.035}" rx="${W * 0.006}" fill="none" stroke="#4ade80" stroke-width="${W * 0.004}"/>` +
      `<rect x="${m * 2 + W * 0.006}" y="${textTop + W * 0.036}" width="${(barW - W * 0.012) * 0.99}" height="${W * 0.023}" rx="${W * 0.004}" fill="#4ade80"/>` +
      `<text x="${W - m * 2}" y="${textTop + W * 0.03 + W * 0.03}" font-size="${W * 0.032}" fill="#4ade80" text-anchor="end" font-family="${mono}">99%</text>` +
      line("> осталось отсканировать QR ▌", textTop + W * 0.12, "#facc15") +
      caption(g, "знания загрузятся после сканирования", p.y + p.h + W * 0.08, "#e2e8f0")
    );
  },
};

export const QR_ARTS: Record<QrArtId, QrArt> = { hand, paws, plz, sign, facepalm, doge, loading };
