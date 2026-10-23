import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { DownloadIcon, Loader2Icon, PrinterIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import {
  DOT_OPTIONS,
  EYE_OPTIONS,
  Field,
  ScaleSlider,
  Segmented,
  SUBTITLE_BG_OPTIONS,
  SUBTITLE_POSITION_OPTIONS,
  TITLE_POSITION_OPTIONS,
} from "./qr-controls";
import {
  defaultDesign,
  QR_PRESETS,
  type QrDesign,
  type QrDotStyle,
  type QrEyeStyle,
  type QrSubtitleBg,
  type QrSubtitlePosition,
  type QrTitlePosition,
} from "./qr-presets";
import { renderQrPoster } from "./qr-render";
import { perSheet, renderSheet, renderSheetsPdf, SHEET, SHEET_TILES, tileSpec, type SheetItem, type SheetTile } from "./qr-sheet";

export interface QrBatchItem {
  /** Уникальный ключ строки (id объекта). */
  key: string;
  /** Что кодируем — ссылка. */
  value: string;
  title: string;
  emoji?: string;
}

interface RowState {
  enabled: boolean;
  title: string;
  /** Пусто — общая надпись. */
  subtitle: string;
  /** Пусто — общий шаблон. */
  presetId: string;
}

const DEFAULT_SUBTITLE = "Отсканируйте камерой телефона";

/** Массовая выгрузка QR на листы A4: карточки (по умолчанию A6) кладутся
 * вплотную, без полей. Шаблон общий, текст и при желании шаблон — у каждой свой.
 * Всё рисуется в браузере, PDF собирается здесь же. */
export const QrBatchExport: FC<{ items: QrBatchItem[]; fileName?: string }> = ({ items, fileName = "qr-коды" }) => {
  const [presetId, setPresetId] = useState("brand");
  const [subtitle, setSubtitle] = useState(DEFAULT_SUBTITLE);
  const [dotStyle, setDotStyle] = useState<QrDotStyle | "">("");
  const [eyeStyle, setEyeStyle] = useState<QrEyeStyle | "">("");
  const [tile, setTile] = useState<SheetTile>("a6");
  const [cutLines, setCutLines] = useState(true);
  // Размер кода — множитель к шаблону (у мемных код меньше, чтобы влезла сцена).
  const [qrBoost, setQrBoost] = useState(1.3);
  const [textScale, setTextScale] = useState(1.3);
  const [titlePosition, setTitlePosition] = useState<QrTitlePosition>("below");
  const [subtitlePosition, setSubtitlePosition] = useState<QrSubtitlePosition>("above");
  const [subtitleBg, setSubtitleBg] = useState<QrSubtitleBg>("none");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [sheets, setSheets] = useState<string[]>([]);
  const [busy, setBusy] = useState<string>("");

  const rowOf = (item: QrBatchItem): RowState =>
    rows[item.key] ?? { enabled: true, title: item.title, subtitle: "", presetId: "" };
  const patchRow = (item: QrBatchItem, p: Partial<RowState>) =>
    setRows((r) => ({ ...r, [item.key]: { ...rowOf(item), ...p } }));

  const designFor = (item: QrBatchItem, row: RowState): QrDesign => {
    const d = defaultDesign(row.title, item.emoji ?? "📋", row.subtitle || subtitle, row.presetId || presetId);
    return {
      ...d,
      ...(dotStyle && { dotStyle }),
      ...(eyeStyle && { eyeStyle }),
      qrScale: Math.min(0.9, d.qrScale * qrBoost),
      textScale,
      titlePosition,
      subtitlePosition,
      subtitleBg,
    };
  };

  const sheetItems: SheetItem[] = useMemo(
    () =>
      items
        .map((item) => ({ item, row: rowOf(item) }))
        .filter(({ row }) => row.enabled)
        .map(({ item, row }) => ({ value: item.value, design: designFor(item, row) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, rows, presetId, subtitle, dotStyle, eyeStyle, qrBoost, textScale, titlePosition, subtitlePosition, subtitleBg],
  );

  const spec = tileSpec(tile);
  const sheetCount = Math.ceil(sheetItems.length / perSheet(tile));

  // Миниатюры шаблонов — на первом объекте, в пропорциях карточки.
  useEffect(() => {
    const first = items[0];
    if (!first) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      const c = document.createElement("canvas");
      for (const preset of QR_PRESETS) {
        await renderQrPoster(c, first.value, defaultDesign(first.title, first.emoji ?? "📋", subtitle, preset.id), 0.07, { w: 1240, h: 1754 });
        next[preset.id] = c.toDataURL("image/png");
        if (cancelled) return;
      }
      setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items, subtitle]);

  // Превью листов — в низком разрешении, с задержкой, чтобы не дёргать при наборе текста.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const n = perSheet(tile);
      const c = document.createElement("canvas");
      const out: string[] = [];
      for (let s = 0; s * n < sheetItems.length && s < 6; s++) {
        await renderSheet(c, sheetItems.slice(s * n, s * n + n), tile, { scale: 0.18, cutLines });
        if (cancelled) return;
        out.push(c.toDataURL("image/jpeg", 0.8));
      }
      setSheets(out);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sheetItems, tile, cutLines]);

  const makePdf = async () => {
    setBusy("Готовим листы…");
    try {
      return await renderSheetsPdf(sheetItems, tile, cutLines, (done, total) => setBusy(`Лист ${done} из ${total}…`));
    } finally {
      setBusy("");
    }
  };

  const download = async () => {
    const blob = await makePdf();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName}-${spec.value.toUpperCase()}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // Печать через PDF во вкладке: браузер печатает его 1:1, без своих полей и масштаба.
  const print = async () => {
    const blob = await makePdf();
    window.open(URL.createObjectURL(blob), "_blank");
  };

  const allEnabled = items.every((i) => rowOf(i).enabled);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Field label="Размер карточки — лист A4 заполняется целиком, без промежутков">
            <Segmented value={tile} options={SHEET_TILES} onChange={setTile} />
          </Field>

          <Field label="Общий шаблон">
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
              {QR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => setPresetId(preset.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md border p-1 text-[10px] leading-tight",
                    presetId === preset.id ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted",
                  )}
                >
                  {thumbs[preset.id] ? (
                    <img src={thumbs[preset.id]} alt="" className="h-16 w-auto rounded-sm" />
                  ) : (
                    <div className="h-16 w-11 animate-pulse rounded-sm bg-muted" />
                  )}
                  <span className="line-clamp-2 text-center">{preset.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Точки">
              <Segmented
                value={dotStyle || "preset"}
                options={[{ value: "preset", label: "Как в шаблоне" }, ...DOT_OPTIONS]}
                onChange={(v) => setDotStyle(v === "preset" ? "" : (v as QrDotStyle))}
              />
            </Field>
            <Field label="Угловые маркеры">
              <Segmented
                value={eyeStyle || "preset"}
                options={[{ value: "preset", label: "Как в шаблоне" }, ...EYE_OPTIONS]}
                onChange={(v) => setEyeStyle(v === "preset" ? "" : (v as QrEyeStyle))}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ScaleSlider label="Размер кода" value={qrBoost} min={0.7} max={1.6} onChange={setQrBoost} />
            <ScaleSlider label="Размер текста" value={textScale} min={0.6} max={2.2} onChange={setTextScale} />
            <Field label="Название объекта">
              <Segmented value={titlePosition} options={TITLE_POSITION_OPTIONS} onChange={setTitlePosition} />
            </Field>
            <Field label="Надпись">
              <Segmented value={subtitlePosition} options={SUBTITLE_POSITION_OPTIONS} onChange={setSubtitlePosition} />
            </Field>
            <Field label="Фон под надписью">
              <Segmented value={subtitleBg} options={SUBTITLE_BG_OPTIONS} onChange={setSubtitleBg} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Общая надпись над кодом">
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 pb-2 text-xs">
              <Switch checked={cutLines} onCheckedChange={setCutLines} />
              Линии реза
            </label>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            Листов A4: {sheetCount} · карточек: {sheetItems.length} · по {perSheet(tile)} на лист
          </p>
          <div className="flex flex-wrap gap-2 rounded-xl bg-muted/50 p-3">
            {sheets.length ? (
              sheets.map((src, i) => (
                <img key={i} src={src} alt={`Лист ${i + 1}`} className="h-56 w-auto rounded-sm bg-white shadow" />
              ))
            ) : (
              <div className="flex h-56 w-full items-center justify-center text-sm text-muted-foreground">
                {sheetItems.length ? "Рисуем листы…" : "Отметьте хотя бы один объект"}
              </div>
            )}
            {sheetCount > sheets.length && sheets.length > 0 && (
              <div className="flex h-56 items-center px-3 text-xs text-muted-foreground">
                ещё {sheetCount - sheets.length}…
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download} disabled={!sheetItems.length || Boolean(busy)}>
              {busy ? <Loader2Icon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
              {busy || "Скачать PDF"}
            </Button>
            <Button variant="outline" onClick={print} disabled={!sheetItems.length || Boolean(busy)}>
              <PrinterIcon className="size-4" /> Открыть для печати
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Печатайте в масштабе 100% («Фактический размер»). Лист {SHEET.mmW}×{SHEET.mmH} мм заполнен до края — если
            принтер не печатает без полей, по краю срежется 3–5 мм фона, код при этом не задевается.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 p-2">
                <Switch
                  checked={allEnabled}
                  onCheckedChange={(on) =>
                    setRows((r) => Object.fromEntries(items.map((i) => [i.key, { ...(r[i.key] ?? rowOf(i)), enabled: on }])))
                  }
                />
              </th>
              <th className="p-2 text-left font-medium">Название под кодом</th>
              <th className="p-2 text-left font-medium">Надпись над кодом</th>
              <th className="p-2 text-left font-medium">Шаблон</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const row = rowOf(item);
              return (
                <tr key={item.key} className={cn(!row.enabled && "opacity-50")}>
                  <td className="p-2">
                    <Switch checked={row.enabled} onCheckedChange={(enabled) => patchRow(item, { enabled })} />
                  </td>
                  <td className="p-2">
                    <Input value={row.title} onChange={(e) => patchRow(item, { title: e.target.value })} className="h-8 min-w-48" />
                  </td>
                  <td className="p-2">
                    <Input
                      value={row.subtitle}
                      placeholder={subtitle || "без надписи"}
                      onChange={(e) => patchRow(item, { subtitle: e.target.value })}
                      className="h-8 min-w-48"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={row.presetId}
                      onChange={(e) => patchRow(item, { presetId: e.target.value })}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="">Общий</option>
                      {QR_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
