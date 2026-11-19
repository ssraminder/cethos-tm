/**
 * Checks for src/lib/qa/field-rules.ts. Run: npx tsx scripts/test-field-rules.ts
 * The cases come from the November 2026 OCR bake-off (values are invented).
 */
import { fieldChecks, fieldKind, identifiers, letterDigitSuspects, sourceChecks, targetChecks } from "../src/lib/qa/field-rules";

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
}
const rules = (cs: Array<{ rule: string }>) => cs.map((c) => c.rule);

// Letter O / digit 0 confusion
check("zero between letters is suspect", letterDigitSuspects("CURP L0HM900214MVZPRR08"), ["L0HM900214MVZPRR08"]);
check("zero starting a name in a machine-readable line", letterDigitSuspects("TORRES<<0SMAR<0SIRIS<F<1220260"), ["TORRES<<0SMAR<0SIRIS<F<1220260"]);
check("letter O between digits is suspect", letterDigitSuspects("N° 8807O5300412"), ["8807O5300412"]);
check("clean identifier is not suspect", letterDigitSuspects("CURP LOHM900214MVZPRR08"), []);
check("plain number is not suspect", letterDigitSuspects("000 319 084"), []);
check("ordinary words are not suspect", letterDigitSuspects("PERMIS DE CONDUIRE République Française"), []);
check("licence class with a zero digit run is not suspect", letterDigitSuspects("A1808363"), []);

// Kinds
check("date kind", fieldKind("FECHA DE NACIMIENTO 14/02/1990"), "date");
check("number kind", fieldKind("NUMERO: 000 319 084"), "number");
check("text kind", fieldKind("ESTADO DE VERACRUZ"), "text");

// Identifiers
check("spaced digit groups join into one identifier", identifiers("NUMERO: 000 319 084"), ["000319084"]);
check("a date is not an identifier", identifiers("Né(e) le 14.07.1988 à Besançon"), []);

// Source checks
check("invalid date is flagged", rules(sourceChecks("FECHA DE EMISION 31/02/2023")), ["date_invalid"]);
check("valid date passes", rules(sourceChecks("FECHA DE EMISION 20/12/2023")), []);
check("month over 12 is flagged", rules(sourceChecks("NE(E) LE: 27-13-1995")), ["date_invalid"]);

// Target checks
check("no target, no target checks", rules(targetChecks("FECHA 14/02/1990", "")), []);
check("date in words matches", rules(targetChecks("FECHA DE NACIMIENTO 14/02/1990", "Date of birth: 14 February 1990")), []);
check("month-first words match", rules(targetChecks("FECHA 14/02/1990", "Date: February 14, 1990")), []);
check("ISO date matches", rules(targetChecks("FECHA 14/02/1990", "Date: 1990-02-14")), []);
check("numeric date kept as written matches", rules(targetChecks("NE(E) LE: 27-03-1995", "Born on: 27-03-1995")), []);
check("wrong month is flagged", rules(targetChecks("FECHA 14/02/1990", "Date of birth: 14 March 1990")), ["date_mismatch"]);
check("swapped day and month in words is flagged", rules(targetChecks("FECHA 05/02/1990", "Date: 2 May 1990")), ["date_mismatch"]);
check("missing date is flagged", rules(targetChecks("FECHA 14/02/1990", "Date of birth")), ["date_mismatch"]);
check("identifier copied exactly passes", rules(targetChecks("NUMERO: 000 319 084", "Number: 000 319 084")), []);
check("identifier with a changed digit is flagged", rules(targetChecks("NUMERO: 000 319 084", "Number: 000 319 034")), ["identifier_changed"]);
check("identifier dropped is flagged", rules(targetChecks("IDENTIFICADOR DE CONDUCTOR UA093FXYQ", "Driver ID")), ["identifier_changed"]);
check("two-digit year matches four-digit target", rules(targetChecks("28/11/23", "28 November 2023")), []);
check("text field has no checks", rules(fieldChecks("ESTADO DE VERACRUZ", "STATE OF VERACRUZ")), []);

console.log(failed === 0 ? "\nAll field-rule checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
