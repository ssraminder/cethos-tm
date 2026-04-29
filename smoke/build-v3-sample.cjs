/**
 * Build smoke/sample-v3-import.docx — a Word doc that exercises the V3
 * verbatim-preservation features:
 *   - Footnote reference (at the end of a sentence)
 *   - Bookmarks (start/end around a phrase)
 *   - Page-number field (in a paragraph)
 *   - Tab character (legitimate, not a placeholder)
 *
 * Drawings/images are skipped here because adding them requires a binary
 * payload; the V3 walker preserves them via verbatim XML so a real-world
 * doc with images will round-trip unchanged.
 */

const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  FootnoteReferenceRun,
  Bookmark,
  PageNumber,
  TabStopType,
  TabStopPosition,
  AlignmentType,
} = require("docx");

const doc = new Document({
  footnotes: {
    1: { children: [new Paragraph("Source: internal Q2 financials, audited 2026-04-15.")] },
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
          children: [new TextRun("V3 Round-trip Stress Test")],
        }),

        new Paragraph({
          children: [
            new TextRun("Revenue grew "),
            new TextRun({ text: "16.7%", bold: true }),
            new TextRun(" in Q2"),
            new FootnoteReferenceRun(1),
            new TextRun(", driven by enterprise contracts."),
          ],
        }),

        new Paragraph({
          children: [
            new Bookmark({
              id: "key-finding",
              children: [
                new TextRun("Customer satisfaction reached an all-time high of "),
                new TextRun({ text: "4.6 out of 5", italics: true }),
              ],
            }),
            new TextRun(" across the surveyed cohort."),
          ],
        }),

        new Paragraph({
          children: [
            new TextRun("Section "),
            new TextRun({
              children: [PageNumber.CURRENT],
            }),
            new TextRun(" of "),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
            }),
          ],
        }),

        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun("Approved by"),
            new TextRun("\tJane Doe, CFO"),
          ],
        }),
      ],
    },
  ],
});

const outPath = path.join(__dirname, "sample-v3-import.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${buf.length} bytes)`);
});
