/**
 * Build a small sample DOCX for round-trip smoke testing in Cethos CAT.
 *
 * Run:  node smoke/build-sample-docx.cjs
 * Out:  smoke/sample-import.docx
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
  ShadingType,
  WidthType,
  LevelFormat,
  ExternalHyperlink,
  PageOrientation,
} = require("docx");

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

function cell(text, opts = {}) {
  return new TableCell({
    borders,
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shading
      ? { fill: opts.shading, type: ShadingType.CLEAR }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: opts.alignment ?? AlignmentType.LEFT,
        children: [new TextRun({ text, bold: !!opts.bold })],
      }),
    ],
  });
}

const COL_WIDTHS = [3360, 2000, 2000, 2000]; // 9360 total
const TABLE_WIDTH = COL_WIDTHS.reduce((a, b) => a + b, 0);

function row(cells, header = false) {
  return new TableRow({
    tableHeader: header,
    children: cells.map((text, i) =>
      cell(text, {
        width: COL_WIDTHS[i],
        bold: header,
        shading: header ? "D5E8F0" : undefined,
        alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
      }),
    ),
  });
}

const metricsTable = new Table({
  width: { size: TABLE_WIDTH, type: WidthType.DXA },
  columnWidths: COL_WIDTHS,
  rows: [
    row(["Metric", "Q1 2026", "Q2 2026", "Change"], true),
    row(["Revenue", "$2.10M", "$2.45M", "+16.7%"]),
    row(["Active users", "18,420", "21,990", "+19.4%"]),
    row(["Churn rate", "4.2%", "3.6%", "-0.6 pp"]),
    row(["Net retention", "108%", "112%", "+4 pp"]),
  ],
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } }, // 11pt
    paragraphStyles: [
      {
        id: "Title",
        name: "Title",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 36, bold: true, font: "Calibri" },
        paragraph: {
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 240 },
        },
      },
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 30, bold: true, font: "Calibri", color: "1F3864" },
        paragraph: {
          spacing: { before: 240, after: 120 },
          outlineLevel: 0,
        },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Calibri", color: "2E74B5" },
        paragraph: {
          spacing: { before: 200, after: 80 },
          outlineLevel: 1,
        },
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
      {
        reference: "actions",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
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
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          style: "Title",
          children: [new TextRun("Acme Quarterly Report — Q2 2026")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("Executive Summary")],
        }),

        new Paragraph({
          children: [
            new TextRun(
              "Acme delivered a strong Q2 with revenue and active-user growth both exceeding plan. ",
            ),
            new TextRun({ text: "Net retention crossed 110% for the first time", bold: true }),
            new TextRun(
              ", driven by upsell into the enterprise segment and lower than expected churn across the SMB book.",
            ),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun(
              "Operating margin held steady at 24% even after the marketing investment in March. ",
            ),
            new TextRun({
              text: "Customer satisfaction reached an all-time high",
              italics: true,
            }),
            new TextRun(
              ", with a CSAT score of 4.6 out of 5 across the surveyed cohort.",
            ),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Key Metrics")],
        }),

        metricsTable,

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Highlights")],
          spacing: { before: 200 },
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun(
              "Closed three enterprise deals worth a combined $480K in annual contract value.",
            ),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun(
              "Shipped the new analytics dashboard to general availability ahead of schedule.",
            ),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun(
              "Expanded support coverage to 24/5 with the new Lisbon team going live in May.",
            ),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Action Items")],
        }),
        new Paragraph({
          numbering: { reference: "actions", level: 0 },
          children: [new TextRun("Finalize the FY27 hiring plan by the end of July.")],
        }),
        new Paragraph({
          numbering: { reference: "actions", level: 0 },
          children: [
            new TextRun("Launch the partner referral program in two pilot regions."),
          ],
        }),
        new Paragraph({
          numbering: { reference: "actions", level: 0 },
          children: [
            new TextRun("Reduce average ticket-resolution time from 14 hours to under 9."),
          ],
        }),

        new Paragraph({
          children: [
            new TextRun("For the underlying numbers, "),
            new ExternalHyperlink({
              children: [
                new TextRun({ text: "see the full dashboard", style: "Hyperlink" }),
              ],
              link: "https://example.com/dashboard",
            }),
            new TextRun("."),
          ],
        }),

        new Paragraph({
          children: [
            new TextRun(
              "Overall, Q2 sets us up for a confident second half of the year. Thank you to every team that contributed.",
            ),
          ],
          spacing: { before: 120 },
        }),
      ],
    },
  ],
});

const outPath = path.join(__dirname, "sample-import.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${buf.length} bytes)`);
});
