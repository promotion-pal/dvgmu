import type { FC } from "react";
import { cn } from "@/shared/lib/utils";

interface CommonImageProps {
    src: string;
    alt: string;
    /** The picture's own size in pixels: the browser keeps its place before it
     * loads, so the page doesn't jump (on a phone especially). */
    width?: number;
    height?: number;
    className?: string;
}

/** A picture that fits its container's width and never grows past its own size. */
export const CommonImage: FC<CommonImageProps> = ({ src, alt, width, height, className }) => (
    <img
        src={src}
        alt={alt}
        width={width || undefined}
        height={height || undefined}
        loading="lazy"
        decoding="async"
        className={cn("h-auto max-w-full rounded-lg border bg-muted/30 object-contain", className)}
    />
);
