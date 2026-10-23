import type { ExportWordTableOptions, WordTableColumn } from "./word-export";

// A4 portrait with 3 cm / 1.5 cm side margins, in twips.
const PAGE_WIDTH = 11906;
const MARGIN_LEFT = 1701;
const MARGIN_RIGHT = 850;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const HEADER = [
    "{\\rtf1\\ansi\\ansicpg1251\\deff0\\uc1",
    "{\\fonttbl{\\f0\\froman\\fprq2\\fcharset204 Times New Roman;}}",
    "{\\colortbl;\\red241\\green245\\blue249;}",
    `\\paperw${PAGE_WIDTH}\\paperh16838\\margl${MARGIN_LEFT}\\margr${MARGIN_RIGHT}\\margt1134\\margb1134`,
    "",
].join("\n");

const BORDERS = "\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10";

/** Plain text as RTF: control characters escaped, everything past ASCII as \uN?. */
const rtfText = (value: string) => {
    let out = "";
    for (const char of value) {
        const code = char.codePointAt(0) ?? 0;
        if (char === "\\" || char === "{" || char === "}") out += `\\${char}`;
        else if (char === "\n") out += "\\line ";
        else if (code < 0x20) continue;
        else if (code < 0x80) out += char;
        else if (code <= 0xffff) out += `\\u${code > 0x7fff ? code - 0x10000 : code}?`;
        else {
            // Outside the BMP: as a UTF-16 surrogate pair.
            const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
            const low = ((code - 0x10000) % 0x400) + 0xdc00;
            out += `\\u${high - 0x10000}?\\u${low - 0x10000}?`;
        }
    }
    return out;
};

const tableRow = <T,>(cells: string[], columns: WordTableColumn<T>[], header: boolean) => {
    const total = columns.reduce((sum, column) => sum + (column.width ?? 1), 0);
    let edge = 0;
    const defs = columns
        .map((column) => {
            edge += Math.round((TABLE_WIDTH * (column.width ?? 1)) / total);
            return `${BORDERS}${header ? "\\clcbpat1" : ""}\\cellx${edge}`;
        })
        .join("");
    const body = cells.map((cell) => `\\pard\\intbl\\ql\\f0\\fs24 ${header ? `{\\b ${rtfText(cell)}}` : rtfText(cell)}\\cell`).join("");
    return `\\trowd\\trgaph108\\trleft0${header ? "\\trhdr" : ""}${defs}\n${body}\\row\n`;
};

/** Renders `rows` into a single-table Word 97 document (.doc, RTF inside —
 * Word and LibreOffice open it as a regular document) and downloads it. */
export async function exportDocTable<T>({ title, subtitle, fileName, columns, rows }: ExportWordTableOptions<T>) {
    let rtf = HEADER;
    if (title) rtf += `\\pard\\qc\\sa240\\f0\\fs28{\\b ${rtfText(title)}}\\par\n`;
    for (const line of subtitle ?? []) rtf += `\\pard\\ql\\sa120\\f0\\fs24 ${rtfText(line)}\\par\n`;
    if (title || subtitle?.length) rtf += "\\pard\\sa120\\par\n";

    rtf += tableRow(columns.map((column) => column.header), columns, true);
    for (const row of rows) rtf += tableRow(columns.map((column) => column.render(row)), columns, false);
    rtf += "\\pard\\par\n}\n";

    const url = URL.createObjectURL(new Blob([rtf], { type: "application/msword" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = fileName.endsWith(".doc") ? fileName : `${fileName}.doc`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
