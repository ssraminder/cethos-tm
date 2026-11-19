/**
 * Renders a sample certified translation page from invented data, to check
 * the layout without a database.
 * Run: npx tsx scripts/sample-certified-docx.ts <output.docx> [draft]
 */
import { writeFileSync } from "node:fs";
import { buildCertifiedDocx, layoutRows, type CertifiedField } from "../src/lib/jobs/certified-docx";

const W = 1000;
const H = 630;
const f = (seq: number, page: number, box: [number, number, number, number], target: string, confirmed = true): CertifiedField => ({
  seq, page, box, target, confirmed, pageWidth: W, pageHeight: H,
});

const draft = process.argv[3] === "draft";
const fields: CertifiedField[] = [
  f(1, 1, [40, 30, 400, 80], "STATE OF VERACRUZ"),
  f(2, 1, [780, 30, 960, 80], "TYPE A"),
  f(3, 1, [50, 130, 290, 470], "[Photograph of holder]"),
  f(4, 1, [330, 130, 810, 195], "MARIANA LÓPEZ HERRERA"),
  f(5, 1, [330, 208, 850, 265], "CURP: LOHM900214MVZPRR08"),
  f(6, 1, [330, 277, 770, 334], "Date of birth: 14 February 1990"),
  f(7, 1, [330, 346, 770, 403], "Date of issue: 20 December 2023"),
  f(8, 1, [330, 415, 770, 472], draft ? "Date of expiry: 20 December 2026" : "Date of expiry: 20 December 2026", !draft),
  f(9, 1, [720, 346, 960, 472], "[Signature of holder]"),
  f(10, 1, [180, 530, 820, 600], draft ? "" : "DRIVER'S LICENCE", !draft),
  f(11, 2, [330, 40, 600, 90], "Sex: F"),
  f(12, 2, [330, 100, 600, 150], "Blood group: A+"),
  f(13, 2, [330, 160, 600, 210], "Restrictions: None"),
  f(14, 2, [330, 220, 600, 270], "Organ donor: Yes"),
  f(15, 2, [330, 280, 600, 330], "Licensed since: 18 December 2020"),
  f(16, 2, [330, 345, 900, 470], "Authorizes the holder to drive motor vehicles used for public passenger transport."),
  f(17, 2, [40, 400, 300, 470], "[Signature] Secretary of Public Security"),
  f(18, 2, [40, 520, 960, 600], "[Machine-readable lines, not translated]"),
];

// Layout sanity: the photo, name and signature rows land in the expected columns.
const rows = layoutRows(fields.filter((x) => x.page === 1));
const cols = rows.map((r) => r.map((c) => c.map((x) => x.seq).join("+") || "-").join(" | "));
console.log(cols.join("\n"));

buildCertifiedDocx({
  reference: "J-202611-K4TD",
  orderNumber: null,
  documentName: "licencia.pdf",
  documentType: "a driver's licence",
  sourceLanguage: "Spanish (Mexico)",
  targetLanguage: "English (Canada)",
  translator: null,
  reviser: null,
  dateLabel: "19 November 2026",
  fields,
}).then((buf) => {
  writeFileSync(process.argv[2], buf);
  console.log("wrote", process.argv[2], buf.length, "bytes");
});
