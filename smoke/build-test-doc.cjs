/**
 * Build smoke/test-doc.docx — a compact (~85 word) sample for manual
 * round-trip testing. Includes the formatting features the editor + Word
 * export should preserve: heading, bold, italic, hyperlink, bullet list,
 * a small 3x2 table.
 *
 * Run: node smoke/build-test-doc.cjs
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  LevelFormat,
  ExternalHyperlink,
} = require("docx");

const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text, opts = {}) {
  return new TableCell({
    borders,
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: !!opts.bold })],
      }),
    ],
  });
}

const COL_WIDTHS = [3120, 3120, 3120];

function row(cells, header = false) {
  return new TableRow({
    tableHeader: header,
    children: cells.map((t, i) =>
      cell(t, { width: COL_WIDTHS[i], bold: header, shading: header ? "D5E8F0" : undefined }),
    ),
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Calibri", color: "1F3864" },
        paragraph: { spacing: { before: 0, after: 120 }, outlineLevel: 0 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("Welcome to Cethos")],
        }),

        new Paragraph({
          children: [
            new TextRun("Our team turns complex content into "),
            new TextRun({ text: "polished translations", bold: true }),
            new TextRun(" that read "),
            new TextRun({ text: "naturally", italics: true }),
            new TextRun(" in every market. We work in over twenty languages."),
          ],
        }),

        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Certified by professional linguists.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Quality-checked with both rules and AI review.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Delivered on time, in your original file format.")],
        }),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: COL_WIDTHS,
          rows: [
            row(["Service", "Turnaround", "From"], true),
            row(["Standard", "3 days", "$0.12"]),
            row(["Express", "24 hours", "$0.18"]),
          ],
        }),

        new Paragraph({
          spacing: { before: 200 },
          children: [
            new TextRun("To get started, "),
            new ExternalHyperlink({
              children: [new TextRun({ text: "request a quote", style: "Hyperlink" })],
              link: "https://example.com/quote",
            }),
            new TextRun(" today."),
          ],
        }),
      ],
    },
  ],
});

const outPath = path.join(__dirname, "test-doc.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  // Word count check (rough): pull the body text by stripping tags.
  console.log(`Wrote ${outPath} (${buf.length} bytes)`);
});
