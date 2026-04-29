/**
 * Build smoke/sample-import.pptx exercising the round-trip features:
 *   - Title slide with bold/italic mixed text
 *   - Bullet slide
 *   - Slide with hyperlink
 *   - Slide with speaker notes
 *   - Slide with a table
 */
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");

async function main() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  // Slide 1 — Title
  const s1 = pptx.addSlide();
  s1.addText(
    [
      { text: "Acme Quarterly Report — ", options: { bold: true } },
      { text: "Q2 2026", options: { italic: true } },
    ],
    { x: 0.5, y: 1, w: 9, h: 1.5, fontSize: 32, fontFace: "Calibri" },
  );
  s1.addText("Strong growth across all segments.", {
    x: 0.5, y: 2.6, w: 9, h: 0.5, fontSize: 16, color: "666666",
  });
  s1.addNotes("Highlight the bold/italic title and remind the audience of FY27 targets.");

  // Slide 2 — Bullets
  const s2 = pptx.addSlide();
  s2.addText("Highlights", { x: 0.5, y: 0.4, fontSize: 28, bold: true });
  s2.addText(
    [
      { text: "Closed three enterprise deals worth $480K ACV", options: { bullet: true } },
      { text: "Shipped the new analytics dashboard ahead of schedule", options: { bullet: true } },
      { text: "Expanded support coverage to 24/5 with the Lisbon team", options: { bullet: true } },
    ],
    { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 18 },
  );

  // Slide 3 — Hyperlink
  const s3 = pptx.addSlide();
  s3.addText("Action Items", { x: 0.5, y: 0.4, fontSize: 28, bold: true });
  s3.addText(
    [
      { text: "Review the full dashboard at ", options: {} },
      {
        text: "example.com/dashboard",
        options: { hyperlink: { url: "https://example.com/dashboard" } },
      },
    ],
    { x: 0.5, y: 1.5, w: 9, h: 0.6, fontSize: 18 },
  );
  s3.addText(
    [
      { text: "1. Finalize FY27 hiring plan by July.", options: {} },
      { text: "\n2. Launch the partner referral program.", options: {} },
      { text: "\n3. Reduce ticket-resolution time from 14h to under 9h.", options: {} },
    ],
    { x: 0.5, y: 2.4, w: 9, h: 3, fontSize: 16 },
  );

  // Slide 4 — Table
  const s4 = pptx.addSlide();
  s4.addText("Key Metrics", { x: 0.5, y: 0.4, fontSize: 28, bold: true });
  s4.addTable(
    [
      [
        { text: "Metric", options: { bold: true, fill: { color: "D5E8F0" } } },
        { text: "Q1 2026", options: { bold: true, fill: { color: "D5E8F0" } } },
        { text: "Q2 2026", options: { bold: true, fill: { color: "D5E8F0" } } },
        { text: "Change", options: { bold: true, fill: { color: "D5E8F0" } } },
      ],
      ["Revenue", "$2.10M", "$2.45M", "+16.7%"],
      ["Active users", "18,420", "21,990", "+19.4%"],
      ["Churn rate", "4.2%", "3.6%", "-0.6 pp"],
    ],
    { x: 0.5, y: 1.5, w: 9, h: 3, fontSize: 14, border: { type: "solid", color: "CCCCCC" } },
  );

  const outPath = path.join(__dirname, "sample-import.pptx");
  await pptx.writeFile({ fileName: outPath });
  const size = fs.statSync(outPath).size;
  console.log(`Wrote ${outPath} (${size} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
