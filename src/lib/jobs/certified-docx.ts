/**
 * Certified translation page for image jobs, as a Word document.
 *
 * Each source page becomes a bordered box whose entries sit roughly where
 * they are on the original (left, centre or right; top to bottom), so the
 * translation can be compared with the document line by line. The
 * translator's affidavit is a separate page added by the portal.
 *
 * This file is pure (data in, bytes out) so the layout can be rendered and
 * checked without a database; certified-export.ts loads the job and calls it.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { CETHOS_LOGO_WHITE_PNG_BASE64, CETHOS_LOGO_WHITE_PNG_HEIGHT, CETHOS_LOGO_WHITE_PNG_WIDTH } from "./cethos-logo";

const NAVY = "0C2340";
const TEAL_TEXT = "0E7490";
const BODY = "374151";
const RULE = "CBD5E1";
const SOFT = "F8FAFC";
const ALERT = "B91C1C";
const FONT = "Arial";
/** Usable width of a Letter page with 0.75in margins, in twentieths of a point. */
const CONTENT_WIDTH = 10080;
const NOT_TRANSLATED = "[not translated]";

export interface CertifiedField {
  seq: number;
  target: string;
  confirmed: boolean;
  page: number;
  box: [number, number, number, number];
  pageWidth: number;
  pageHeight: number;
}

export interface CertifiedData {
  reference: string;
  orderNumber: string | null;
  documentName: string;
  documentType: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  translator: string | null;
  reviser: string | null;
  /** Shown as the date of translation, already formatted. */
  dateLabel: string;
  fields: CertifiedField[];
}

type Column = 0 | 1 | 2;

/** Group a page's fields into visual rows (top to bottom) of three columns. */
export function layoutRows(fields: CertifiedField[]): Array<[CertifiedField[], CertifiedField[], CertifiedField[]]> {
  const sorted = [...fields].sort((a, b) => (a.box[1] + a.box[3]) / 2 - (b.box[1] + b.box[3]) / 2);
  const rows: Array<{ top: number; bottom: number; cells: [CertifiedField[], CertifiedField[], CertifiedField[]] }> = [];
  for (const f of sorted) {
    const mid = (f.box[1] + f.box[3]) / 2;
    const xMid = (f.box[0] + f.box[2]) / 2 / (f.pageWidth || 1);
    const col: Column = xMid < 0.34 ? 0 : xMid < 0.67 ? 1 : 2;
    const last = rows[rows.length - 1];
    if (last && mid >= last.top && mid <= last.bottom) {
      last.cells[col].push(f);
      last.top = Math.min(last.top, f.box[1]);
      last.bottom = Math.max(last.bottom, f.box[3]);
    } else {
      const cells: [CertifiedField[], CertifiedField[], CertifiedField[]] = [[], [], []];
      cells[col].push(f);
      rows.push({ top: f.box[1], bottom: f.box[3], cells });
    }
  }
  for (const r of rows) for (const c of r.cells) c.sort((a, b) => a.box[0] - b.box[0]);
  return rows.map((r) => r.cells);
}

function run(text: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}): TextRun {
  return new TextRun({ text, font: FONT, size: opts.size ?? 21, bold: opts.bold, italics: opts.italics, color: opts.color ?? BODY });
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
const THIN = { style: BorderStyle.SINGLE, size: 6, color: RULE };
const THIN_BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const BOX = { style: BorderStyle.SINGLE, size: 12, color: NAVY };

function headerBand(): Table {
  const logoWidth = 150;
  const logoHeight = Math.round((logoWidth * CETHOS_LOGO_WHITE_PNG_HEIGHT) / CETHOS_LOGO_WHITE_PNG_WIDTH);
  const shading = { type: ShadingType.CLEAR, color: "auto", fill: NAVY };
  const margins = { top: 220, bottom: 220, left: 300, right: 300 };
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [CONTENT_WIDTH / 2, CONTENT_WIDTH / 2],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading,
            margins,
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    type: "png",
                    data: Buffer.from(CETHOS_LOGO_WHITE_PNG_BASE64, "base64"),
                    transformation: { width: logoWidth, height: logoHeight },
                    altText: { title: "Cethos", description: "Cethos logo", name: "Cethos logo" },
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading,
            margins,
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "DRAFT TRANSLATION", font: FONT, size: 17, bold: true, color: "D1D5DB", characterSpacing: 30 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function detailsTable(d: CertifiedData, pageCount: number): Table {
  const label = (t: string) =>
    new TableCell({
      width: { size: 2100, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: SOFT },
      borders: THIN_BORDERS,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [run(t, { bold: true, color: NAVY, size: 19 })] })],
    });
  const value = (t: string) =>
    new TableCell({
      width: { size: 2940, type: WidthType.DXA },
      borders: THIN_BORDERS,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [run(t, { size: 19 })] })],
    });
  const row = (a: string, b: string, c: string, e: string) => new TableRow({ children: [label(a), value(b), label(c), value(e)] });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [2100, 2940, 2100, 2940],
    rows: [
      row("Document", d.documentType ? d.documentType.replace(/^(an?|the)\s+/i, "").replace(/^./, (c) => c.toUpperCase()) : d.documentName, "Order number", d.orderNumber ?? "[ORDER NUMBER]"),
      row("Source file", d.documentName, "Date of translation", d.dateLabel),
      row("Job reference", d.reference, "Source pages", String(pageCount)),
    ],
  });
}

function fieldParagraphs(fields: CertifiedField[]): Paragraph[] {
  if (fields.length === 0) return [new Paragraph({ children: [run("")] })];
  return fields.map((f) => {
    const text = f.target.trim();
    if (!text) return new Paragraph({ spacing: { after: 40 }, children: [run(NOT_TRANSLATED, { color: ALERT, italics: true })] });
    return new Paragraph({ spacing: { after: 40 }, children: [run(text, { color: f.confirmed ? BODY : ALERT })] });
  });
}

function pageBox(fields: CertifiedField[]): Table {
  const rows = layoutRows(fields);
  // The middle column is the widest: on ID documents it carries the entries.
  const widths = [2800, 4480, 2800];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    rows: rows.map(
      (cells, r) =>
        new TableRow({
          cantSplit: true,
          children: cells.map(
            (c, i) =>
              new TableCell({
                width: { size: widths[i], type: WidthType.DXA },
                // One navy box around the whole page, no lines inside it.
                borders: {
                  top: r === 0 ? BOX : NO_BORDER,
                  bottom: r === rows.length - 1 ? BOX : NO_BORDER,
                  left: i === 0 ? BOX : NO_BORDER,
                  right: i === 2 ? BOX : NO_BORDER,
                },
                margins: { top: 70, bottom: 70, left: 160, right: 160 },
                children: fieldParagraphs(c),
              }),
          ),
        }),
    ),
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({ spacing: { before: 280, after: 120 }, keepNext: true, children: [run(text, { bold: true, color: NAVY, size: 24 })] });
}

export async function buildCertifiedDocx(d: CertifiedData): Promise<Buffer> {
  const pages = [...new Set(d.fields.map((f) => f.page))].sort((a, b) => a - b);
  const unconfirmed = d.fields.filter((f) => !f.confirmed || !f.target.trim()).length;

  const body: Array<Paragraph | Table> = [
    headerBand(),
    new Paragraph({
      spacing: { before: 360, after: 60 },
      children: [new TextRun({ text: `${d.sourceLanguage} into ${d.targetLanguage}`.toUpperCase(), font: FONT, size: 17, bold: true, color: TEAL_TEXT, characterSpacing: 30 })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [run(d.documentType ? `Translation of ${d.documentType}` : "Translation of a document", { bold: true, color: NAVY, size: 42 })],
    }),
  ];

  if (unconfirmed > 0) {
    body.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          run(
            `DRAFT. ${unconfirmed} of ${d.fields.length} entries are not confirmed yet and are shown in red. Do not certify or deliver this copy.`,
            { bold: true, color: ALERT },
          ),
        ],
      }),
    );
  }

  body.push(detailsTable(d, pages.length));

  for (const p of pages) {
    body.push(heading(pages.length > 1 ? `Page ${p} of the original` : "The original document"));
    body.push(pageBox(d.fields.filter((f) => f.page === p)));
  }

  body.push(heading("Translator's notes"));
  const notes = [
    "Text in square brackets describes photographs, seals, signatures, stamps and codes that appear on the original.",
    "Names, numbers and identifiers are reproduced exactly as they appear on the original.",
    "Dates written in figures on the original follow the day/month/year order.",
    "The layout follows the original so that each entry can be compared with the document.",
  ];
  notes.forEach((n, i) => body.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 360, hanging: 360 }, children: [run(`${i + 1}.\t${n}`, { size: 19 })] })));

  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 8 } },
        children: [
          run("Translated by: ", { bold: true, color: NAVY, size: 17 }),
          run(d.translator ?? "[TRANSLATOR NAME]", { size: 17 }),
          run("     Checked by: ", { bold: true, color: NAVY, size: 17 }),
          run(d.reviser ?? "[REVISER NAME]", { size: 17 }),
        ],
      }),
      new Paragraph({ children: [run("Working draft for review. The certified translation is issued by Cethos through the portal.", { size: 17 })] }),
      new Paragraph({
        children: [
          run("Cethos · 421 7 Ave SW, Floor 30, Calgary AB, Canada · Page ", { size: 17 }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 17, color: BODY }),
          run(" of ", { size: 17 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 17, color: BODY }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: "Cethos",
    title: `Certified translation ${d.reference}`,
    styles: { default: { document: { run: { font: FONT, size: 21, color: BODY } } } },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        footers: { default: footer },
        children: body,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
