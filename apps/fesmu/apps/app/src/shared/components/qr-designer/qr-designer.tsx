import type { FC } from "react";
import { useEffect, useState } from "react";
import { DownloadIcon, ImageIcon, PrinterIcon, RotateCcwIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  applyPreset,
  defaultDesign,
  QR_FORMATS,
  QR_PRESETS,
  type QrDesign,
} from "./qr-presets";
import { printImage, qrContrast, renderQrPoster } from "./qr-render";
import {
  DOT_OPTIONS,
  EYE_OPTIONS,
  Field,
  readFile,
  ScaleSlider,
  Segmented,
  SUBTITLE_BG_OPTIONS,
  SUBTITLE_POSITION_OPTIONS,
  TITLE_POSITION_OPTIONS,
} from "./qr-controls";

interface QrDesignerProps {
  /** Что кодируем — ссылка на опрос, тест и т.п. */
  value: string;
  /** Название на плашке под кодом. */
  title: string;
  /** Надпись над кодом (в мемных шаблонах — под шуткой). */
  subtitle?: string;
  /** Эмодзи по смыслу объекта (🧻, 🎓, 📝…) — подставляется в шаблоны. */
  emoji?: string;
  /** С какого шаблона начать (id из QR_PRESETS, например "classic" или "meme-paws"). */
  defaultPreset?: string;
  /** Имя скачиваемого PNG без расширения; по умолчанию — из названия. */
  fileName?: string;
}

/** Конструктор QR для печати: шаблоны в духе Telegram, своя обложка, форма
 * точек и «глаз», эмодзи или картинка в центре. Всё рисуется в браузере —
 * загруженные картинки никуда не отправляются. */
export const QrDesigner: FC<QrDesignerProps> = ({
  value,
  title,
  subtitle = "Отсканируйте камерой телефона",
  emoji = "📋",
  defaultPreset = "brand",
  fileName,
}) => {
  const [design, setDesign] = useState<QrDesign>(() => defaultDesign(title, emoji, subtitle, defaultPreset));
  const [presetId, setPresetId] = useState(defaultPreset);
  const [preview, setPreview] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [canvas] = useState(() => document.createElement("canvas"));

  const patch = (p: Partial<QrDesign>) => setDesign((d) => ({ ...d, ...p }));

  useEffect(() => {
    let cancelled = false;
    renderQrPoster(canvas, value, design).then(() => {
      if (!cancelled) setPreview(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [canvas, value, design]);

  // Миниатюры шаблонов — с текущими форматом и текстом, чтобы выбор был наглядным.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const preset of QR_PRESETS) {
        const c = document.createElement("canvas");
        await renderQrPoster(c, value, { ...applyPreset(design, preset, emoji), centerImage: design.centerImage }, 0.2);
        next[preset.id] = c.toDataURL("image/png");
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
    // Миниатюрам важны только формат и тексты — цвета у каждой свои.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, emoji, design.format, design.title, design.subtitle, design.centerImage]);

  const contrast = qrContrast(design);

  const presetGrid = (presets: typeof QR_PRESETS) => (
    <div className="grid grid-cols-4 gap-2">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => {
            setPresetId(preset.id);
            setDesign((d) => ({ ...applyPreset(d, preset, emoji), centerImage: d.centerImage }));
          }}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px] transition-colors",
            presetId === preset.id && !design.bgImage ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted",
          )}
        >
          {thumbs[preset.id] ? (
            <img src={thumbs[preset.id]} alt="" className="h-20 w-auto rounded" />
          ) : (
            <div className="h-20 w-14 animate-pulse rounded bg-muted" />
          )}
          {preset.label}
        </button>
      ))}
    </div>
  );

  const download = () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName ?? `qr-${title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) || "code"}`}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full justify-center rounded-xl bg-muted/50 p-4">
          {preview ? (
            <img src={preview} alt="QR-код для печати" className="max-h-[560px] w-auto max-w-full rounded-lg shadow-md" />
          ) : (
            <div className="flex h-[400px] items-center text-sm text-muted-foreground">Рисуем…</div>
          )}
        </div>
        {contrast < 3 && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <TriangleAlertIcon className="size-3.5" />
            Слабый контраст кода и плашки — телефон может не распознать. Сделайте код темнее.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={download} disabled={!preview}>
            <DownloadIcon className="size-4" /> Скачать PNG
          </Button>
          <Button variant="outline" onClick={() => printImage(preview, title)} disabled={!preview}>
            <PrinterIcon className="size-4" /> Печать
          </Button>
        </div>
        <a href={value} target="_blank" rel="noreferrer" className="break-all text-xs text-primary underline">
          {value}
        </a>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Field label="Шаблон">
          {presetGrid(QR_PRESETS.filter((preset) => !preset.meme))}
        </Field>
        <Field label="Мемы — код всегда чёрный на белом, чтобы читался с первого раза">
          {presetGrid(QR_PRESETS.filter((preset) => preset.meme))}
        </Field>

        <Field label="Своя обложка — QR встанет поверх картинки">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
              <ImageIcon className="size-3.5" />
              {design.bgImage ? "Заменить обложку" : "Загрузить обложку"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  // Своя обложка вместо мемной сцены — иначе сцена её закроет.
                  if (file) patch({ bgImage: await readFile(file), pattern: "none", art: undefined });
                  e.target.value = "";
                }}
              />
            </label>
            {design.bgImage && (
              <>
                <Button variant="ghost" size="sm" onClick={() => patch({ bgImage: undefined })}>
                  <XIcon className="size-3.5" /> Убрать
                </Button>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Затемнение
                  <input
                    type="range"
                    min={0}
                    max={0.7}
                    step={0.05}
                    value={design.bgDim}
                    onChange={(e) => patch({ bgDim: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
          </div>
        </Field>

        <Field label="Формат">
          <Segmented value={design.format} options={QR_FORMATS} onChange={(format) => patch({ format })} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Точки">
            <Segmented value={design.dotStyle} options={DOT_OPTIONS} onChange={(dotStyle) => patch({ dotStyle })} />
          </Field>
          <Field label="Угловые маркеры">
            <Segmented value={design.eyeStyle} options={EYE_OPTIONS} onChange={(eyeStyle) => patch({ eyeStyle })} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="В центре кода — эмодзи">
            <Input
              value={design.centerEmoji}
              placeholder="пусто — без значка"
              maxLength={8}
              onChange={(e) => patch({ centerEmoji: e.target.value, centerImage: undefined })}
            />
          </Field>
          <Field label="…или картинка (логотип)">
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
                <ImageIcon className="size-3.5" /> Загрузить
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) patch({ centerImage: await readFile(file) });
                    e.target.value = "";
                  }}
                />
              </label>
              {design.centerImage && (
                <Button variant="ghost" size="sm" onClick={() => patch({ centerImage: undefined })}>
                  <XIcon className="size-3.5" />
                </Button>
              )}
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Надпись">
            <Input value={design.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
          </Field>
          <Field label="Название объекта">
            <Input value={design.title} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Размер кода">
            <input
              type="range"
              min={0.35}
              max={0.9}
              step={0.01}
              value={design.qrScale}
              onChange={(e) => patch({ qrScale: Number(e.target.value) })}
            />
          </Field>
          <ScaleSlider label="Размер текста" value={design.textScale ?? 1} min={0.6} max={2.2} onChange={(textScale) => patch({ textScale })} />
          <Field label="Название объекта">
            <Segmented
              value={design.titlePosition ?? "below"}
              options={TITLE_POSITION_OPTIONS}
              onChange={(titlePosition) => patch({ titlePosition })}
            />
          </Field>
          <Field label="Надпись">
            <Segmented
              value={design.subtitlePosition ?? "above"}
              options={SUBTITLE_POSITION_OPTIONS}
              onChange={(subtitlePosition) => patch({ subtitlePosition })}
            />
          </Field>
          <Field label="Фон под надписью">
            <Segmented
              value={design.subtitleBg ?? "none"}
              options={SUBTITLE_BG_OPTIONS}
              onChange={(subtitleBg) => patch({ subtitleBg })}
            />
          </Field>
          <Field label="Положение по высоте">
            <input
              type="range"
              min={0.2}
              max={0.85}
              step={0.01}
              value={design.posY}
              onChange={(e) => patch({ posY: Number(e.target.value) })}
            />
          </Field>
        </div>

        <Field label="Цвета: фон (2 цвета градиента), код, плашка, текст">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {(
              [
                ["bgFrom", "Фон 1"],
                ["bgTo", "Фон 2"],
                ["qrColor", "Код"],
                ["plateColor", "Плашка"],
                ["textColor", "Текст"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={design[key] === "gradient" ? design.bgFrom : design[key]}
                  onChange={(e) => patch({ [key]: e.target.value })}
                  className="size-7 cursor-pointer rounded border"
                />
                {label}
              </label>
            ))}
            {design.qrColor !== "gradient" && (
              <button type="button" className="underline" onClick={() => patch({ qrColor: "gradient" })}>
                код градиентом
              </button>
            )}
          </div>
        </Field>

        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPresetId(defaultPreset);
              setDesign(defaultDesign(title, emoji, subtitle, defaultPreset));
            }}
          >
            <RotateCcwIcon className="size-3.5" /> Сбросить
          </Button>
        </div>
      </div>
    </div>
  );
};
