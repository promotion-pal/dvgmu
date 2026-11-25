import { AlertTriangleIcon, InfoIcon, LightbulbIcon, StethoscopeIcon } from "lucide-react";
import type { CalloutTone } from "./blocks.types";

export const CALLOUT_TONES: Record<CalloutTone, { label: string; icon: typeof InfoIcon; className: string }> = {
    info: { label: "Справка", icon: InfoIcon, className: "border-sky-500/40 bg-sky-500/5 [&_svg]:text-sky-600" },
    important: { label: "Важно", icon: LightbulbIcon, className: "border-amber-500/50 bg-amber-500/5 [&_svg]:text-amber-600" },
    warning: { label: "Осторожно", icon: AlertTriangleIcon, className: "border-red-500/40 bg-red-500/5 [&_svg]:text-red-600" },
    clinical: { label: "Клиническая заметка", icon: StethoscopeIcon, className: "border-emerald-500/40 bg-emerald-500/5 [&_svg]:text-emerald-600" },
};

/** Ссылка на ролик → адрес встраивания для известных площадок. */
export function embedUrl(raw: string): string | undefined {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return undefined;
    }
    const host = url.hostname.replace(/^www\./, "");
    if (host === "rutube.ru") {
        const id = url.pathname.match(/\/video\/([\w-]+)/)?.[1];
        return id && `https://rutube.ru/play/embed/${id}`;
    }
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
        const id = url.searchParams.get("v");
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
    }
    if (host === "vk.com" || host === "vkvideo.ru") {
        const m = url.pathname.match(/video(-?\d+)_(\d+)/);
        return m ? `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}` : undefined;
    }
    return undefined;
}
