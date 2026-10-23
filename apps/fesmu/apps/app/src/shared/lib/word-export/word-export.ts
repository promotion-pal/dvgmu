import {
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from "docx";

export interface WordTableColumn<T> {
    header: string;
    render: (row: T) => string;
    /** Relative width (default 1); used by the .doc export. */
    width?: number;
}

export interface ExportWordTableOptions<T> {
    title?: string;
    /** Plain lines under the title, e.g. the subject and dates. */
    subtitle?: string[];
    fileName: string;
    columns: WordTableColumn<T>[];
    rows: T[];
}

const buildHeaderRow = <T,>(columns: WordTableColumn<T>[]) =>
    new TableRow({
        tableHeader: true,
        children: columns.map(
            (column) =>
                new TableCell({
                    width: { size: 100 / columns.length, type: WidthType.PERCENTAGE },
                    shading: { fill: "F1F5F9" },
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: column.header, bold: true })],
                        }),
                    ],
                }),
        ),
    });

const buildDataRow = <T,>(row: T, columns: WordTableColumn<T>[]) =>
    new TableRow({
        children: columns.map(
            (column) =>
                new TableCell({
                    width: { size: 100 / columns.length, type: WidthType.PERCENTAGE },
                    children: [new Paragraph(column.render(row))],
                }),
        ),
    });

/** Renders `rows` into a single-table .docx and triggers a browser download.
 * Column-based so any list widget can reuse it, not just users. */
export async function exportWordTable<T>({ title, subtitle, fileName, columns, rows }: ExportWordTableOptions<T>) {
    const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [buildHeaderRow(columns), ...rows.map((row) => buildDataRow(row, columns))],
    });

    const children: (Paragraph | Table)[] = [];
    if (title) {
        children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
    }
    for (const line of subtitle ?? []) {
        children.push(new Paragraph({ text: line, spacing: { after: 120 } }));
    }
    children.push(table);

    const docxDocument = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(docxDocument);

    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
