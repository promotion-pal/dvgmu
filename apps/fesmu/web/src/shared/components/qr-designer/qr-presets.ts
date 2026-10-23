import type { QrArtId } from "./qr-art";

export type QrFormat = "a6" | "card" | "a4" | "square" | "story";
export type QrDotStyle = "square" | "rounded" | "dots";
export type QrEyeStyle = "square" | "rounded" | "circle";
export type QrPattern = "none" | "emoji" | "dots";
export type QrTitlePosition = "below" | "above";
export type QrSubtitlePosition = "above" | "below";
export type QrSubtitleBg = "none" | "light" | "dark";

export interface QrDesign {
  format: QrFormat;
  /** Фон: два цвета градиента (одинаковые — сплошной) или своя обложка. */
  bgFrom: string;
  bgTo: string;
  bgImage?: string;
  /** Затемнение обложки 0–0.7, чтобы текст читался. */
  bgDim: number;
  pattern: QrPattern;
  patternEmoji: string;
  /** Цвет кода; "gradient" — код окрашен градиентом фона, как в Telegram. */
  qrColor: string;
  plateColor: string;
  dotStyle: QrDotStyle;
  eyeStyle: QrEyeStyle;
  centerEmoji: string;
  centerImage?: string;
  title: string;
  subtitle: string;
  textColor: string;
  /** Ширина кода относительно ширины листа. */
  qrScale: number;
  /** Вертикальное положение центра плашки, 0–1. */
  posY: number;
  /** Множитель размера текста (название и надпись), 1 — как в шаблоне. */
  textScale?: number;
  /** Название в плашке — под кодом (по умолчанию) или над ним. */
  titlePosition?: QrTitlePosition;
  /** Надпись — над плашкой (по умолчанию) или под ней. */
  subtitlePosition?: QrSubtitlePosition;
  /** Подложка под надписью, чтобы читалась на пёстром фоне. */
  subtitleBg?: QrSubtitleBg;
  /** Мемная сцена вокруг плашки (qr-art.ts); она же ставит подпись. */
  art?: QrArtId;
}

export const QR_FORMATS: { value: QrFormat; label: string; w: number; h: number }[] = [
  { value: "a6", label: "A6", w: 1240, h: 1754 },
  { value: "card", label: "Табличка", w: 1000, h: 1300 },
  { value: "a4", label: "Лист A4", w: 1240, h: 1754 },
  { value: "square", label: "Наклейка", w: 1200, h: 1200 },
  { value: "story", label: "Экран 9:16", w: 1080, h: 1920 },
];

export interface QrPreset {
  id: string;
  label: string;
  design: Partial<QrDesign>;
  /** Мемный шаблон — в выборе идёт отдельной группой. */
  meme?: boolean;
}

/** Общее для мемных шаблонов: обычный чёрный код на белой плашке — сцена
 * сама по себе пёстрая, а код должен читаться с первого раза. */
const meme = (id: string, label: string, art: QrArtId, design: Partial<QrDesign>): QrPreset => ({
  id,
  label,
  meme: true,
  design: {
    art,
    pattern: "none",
    qrColor: "#0f172a",
    plateColor: "#ffffff",
    dotStyle: "square",
    eyeStyle: "square",
    centerEmoji: "",
    textColor: "#0f172a",
    ...design,
  },
});

/** Шаблоны оформления. `{emoji}` в patternEmoji/centerEmoji подставляется по типу опроса. */
export const QR_PRESETS: QrPreset[] = [
  {
    id: "classic",
    label: "Классика",
    design: { bgFrom: "#ffffff", bgTo: "#ffffff", pattern: "none", qrColor: "#0f172a", plateColor: "#ffffff", dotStyle: "square", eyeStyle: "square", centerEmoji: "", textColor: "#0f172a" },
  },
  {
    id: "brand",
    label: "Фирменный",
    design: { bgFrom: "#8b5cf6", bgTo: "#4f46e5", pattern: "emoji", patternEmoji: "{emoji}", qrColor: "gradient", plateColor: "#ffffff", dotStyle: "rounded", eyeStyle: "rounded", centerEmoji: "{emoji}", textColor: "#ffffff" },
  },
  {
    id: "mint",
    label: "Мята",
    design: { bgFrom: "#34d399", bgTo: "#0ea5e9", pattern: "emoji", patternEmoji: "🌿", qrColor: "gradient", plateColor: "#ffffff", dotStyle: "dots", eyeStyle: "circle", centerEmoji: "{emoji}", textColor: "#ffffff" },
  },
  {
    id: "sunset",
    label: "Закат",
    design: { bgFrom: "#fb923c", bgTo: "#db2777", pattern: "emoji", patternEmoji: "✨", qrColor: "gradient", plateColor: "#ffffff", dotStyle: "dots", eyeStyle: "rounded", centerEmoji: "{emoji}", textColor: "#ffffff" },
  },
  {
    id: "night",
    label: "Ночь",
    design: { bgFrom: "#0f172a", bgTo: "#312e81", pattern: "emoji", patternEmoji: "⭐", qrColor: "#1e1b4b", plateColor: "#ffffff", dotStyle: "rounded", eyeStyle: "circle", centerEmoji: "🌙", textColor: "#e0e7ff" },
  },
  {
    id: "sky",
    label: "Небо",
    design: { bgFrom: "#e0f2fe", bgTo: "#bae6fd", pattern: "emoji", patternEmoji: "☁️", qrColor: "#0369a1", plateColor: "#ffffff", dotStyle: "dots", eyeStyle: "rounded", centerEmoji: "{emoji}", textColor: "#0c4a6e" },
  },
  {
    id: "confetti",
    label: "Конфетти",
    design: { bgFrom: "#fef3c7", bgTo: "#fce7f3", pattern: "emoji", patternEmoji: "🎉", qrColor: "#be185d", plateColor: "#ffffff", dotStyle: "rounded", eyeStyle: "circle", centerEmoji: "🎉", textColor: "#831843" },
  },
  {
    id: "minimal",
    label: "Минимал",
    design: { bgFrom: "#f8fafc", bgTo: "#f1f5f9", pattern: "dots", qrColor: "#7c3aed", plateColor: "#ffffff", dotStyle: "dots", eyeStyle: "circle", centerEmoji: "", textColor: "#334155" },
  },
  meme("meme-hand", "Рука с карточкой", "hand", { bgFrom: "#e0e7ff", bgTo: "#bae6fd", qrScale: 0.5, posY: 0.56 }),
  meme("meme-paws", "Котик в лапках", "paws", { bgFrom: "#ffffff", bgTo: "#fbeee0", qrScale: 0.42, posY: 0.56 }),
  meme("meme-plz", "Котик просит plz", "plz", { bgFrom: "#f4f4f5", bgTo: "#e4e4e7", qrScale: 0.42, posY: 0.27 }),
  meme("meme-sign", "Табличка под водой", "sign", { bgFrom: "#7dd3e8", bgTo: "#1d6fa8", qrScale: 0.52, posY: 0.45 }),
  meme("meme-facepalm", "Не отсканировал", "facepalm", { bgFrom: "#e7efe2", bgTo: "#d9e5d1", qrScale: 0.4, posY: 0.58 }),
  meme("meme-doge", "Much scan", "doge", { bgFrom: "#fdf6e3", bgTo: "#fbe8c8", qrScale: 0.44, posY: 0.58 }),
  meme("meme-loading", "Загрузка знаний", "loading", { bgFrom: "#0b1020", bgTo: "#1e293b", qrScale: 0.48, posY: 0.6 }),
];

export const defaultDesign = (title: string, emoji: string, subtitle = "Отсканируйте камерой телефона", presetId = "brand"): QrDesign =>
  applyPreset(
    {
      format: "a6",
      bgFrom: "#ffffff",
      bgTo: "#ffffff",
      bgDim: 0.25,
      pattern: "none",
      patternEmoji: emoji,
      qrColor: "#0f172a",
      plateColor: "#ffffff",
      dotStyle: "square",
      eyeStyle: "square",
      centerEmoji: "",
      title,
      subtitle,
      textColor: "#0f172a",
      qrScale: 0.56,
      posY: 0.5,
    },
    QR_PRESETS.find((preset) => preset.id === presetId) ?? QR_PRESETS[1],
    emoji,
  );

export const applyPreset = (base: QrDesign, preset: QrPreset, emoji: string): QrDesign => {
  const sub = (v?: string) => v?.replaceAll("{emoji}", emoji);
  return {
    ...base,
    ...preset.design,
    bgImage: undefined,
    // Обычный шаблон снимает мемную сцену прежнего.
    art: preset.design.art,
    patternEmoji: sub(preset.design.patternEmoji) ?? base.patternEmoji,
    centerEmoji: sub(preset.design.centerEmoji) ?? base.centerEmoji,
  };
};
