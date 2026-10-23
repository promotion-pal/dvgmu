import { useCallback, useEffect, useRef, useState } from "react";
import { libraryApi } from "@/features/library";
import type { ReaderKind } from "@/features/library";

/** Сохранение позиции не чаще раза в столько миллисекунд. */
const SAVE_EVERY = 2000;

/* Где читатель остановился: позиция приходит один раз при открытии, дальше
 * адаптер сообщает её при прокрутке, а мы пишем в api не чаще SAVE_EVERY и
 * обязательно — при уходе со страницы. */
export function useReaderProgress(kind: ReaderKind, refId: string | undefined) {
    const [initial, setInitial] = useState<string | null>();
    const [percent, setPercent] = useState(0);
    const pending = useRef<{ position: string; percent: number }>(undefined);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        if (!refId) return;
        let alive = true;
        libraryApi.progress(kind, refId).then(
            (list) => alive && (setInitial(list[0]?.position ?? null), setPercent(list[0]?.percent ?? 0)),
            () => alive && setInitial(null),
        );
        return () => {
            alive = false;
        };
    }, [kind, refId]);

    const flush = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = undefined;
        const p = pending.current;
        pending.current = undefined;
        if (p && refId) libraryApi.progressSave(kind, refId, p.position, p.percent).catch(() => {});
    }, [kind, refId]);

    const report = useCallback(
        (position: string, value: number) => {
            setPercent(value);
            pending.current = { position, percent: value };
            if (!timer.current) timer.current = setTimeout(flush, SAVE_EVERY);
        },
        [flush],
    );

    useEffect(() => {
        const onHide = () => document.visibilityState === "hidden" && flush();
        document.addEventListener("visibilitychange", onHide);
        return () => {
            document.removeEventListener("visibilitychange", onHide);
            flush();
        };
    }, [flush]);

    /** undefined — позиция ещё грузится; null — читатель здесь впервые. */
    return { initial, percent, report };
}

const FONT_KEY = "reader.font";
export const FONT_STEPS = [0.9, 1, 1.1, 1.25, 1.4] as const;

/** Размер шрифта читалки — у каждого свой, помнится в браузере. */
export function useReaderFont() {
    const [step, setStep] = useState(() => {
        try {
            const saved = Number(localStorage.getItem(FONT_KEY));
            return saved >= 0 && saved < FONT_STEPS.length ? saved : 1;
        } catch {
            return 1;
        }
    });
    const change = (delta: number) => {
        const next = Math.min(FONT_STEPS.length - 1, Math.max(0, step + delta));
        setStep(next);
        try {
            localStorage.setItem(FONT_KEY, String(next));
        } catch {
            /* без хранилища — просто не запомним */
        }
    };
    return { scale: FONT_STEPS[step], smaller: () => change(-1), larger: () => change(1), canSmaller: step > 0, canLarger: step < FONT_STEPS.length - 1 };
}
