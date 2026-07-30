/**
 * Standalone unit test for the PDF export page-break math (no browser needed).
 * Run: npx tsx scripts/test-pdf-pagebreaks.ts
 */
import { computeBreakPoints, type GuardSpan } from "../src/lib/pdf/exportDocument";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${label}`);
}

function noBreakCutsASpan(breaks: number[], spans: GuardSpan[]): boolean {
  return breaks.every((b) => spans.every((s) => !(b > s.top + 0.5 && b < s.bottom - 0.5)));
}

function rowsSpans(count: number, rowHeight: number, gap = 0): GuardSpan[] {
  const spans: GuardSpan[] = [];
  let y = 0;
  for (let i = 0; i < count; i++) {
    spans.push({ top: y, bottom: y + rowHeight });
    y += rowHeight + gap;
  }
  return spans;
}

console.log("PDF page-break math tests\n");

// Content shorter than one page — single page, no breaks needed mid-content.
{
  const spans = rowsSpans(3, 20);
  const breaks = computeBreakPoints(spans, 100, 2000);
  assert(breaks.length === 1 && breaks[0] === 100, "short content stays on one page");
}

// Uniform rows exactly fitting page height — even slicing, still no row cut.
{
  const spans = rowsSpans(20, 50); // total height 1000
  const breaks = computeBreakPoints(spans, 1000, 1000);
  assert(breaks.length === 1, "content exactly one page tall produces one page");
}

// Rows that would straddle a naive fixed-height cut must get pushed to the row boundary.
{
  const rowHeight = 40;
  const spans = rowsSpans(30, rowHeight); // total height 1200
  const pageHeightPx = 500; // naive cut at 500 falls mid-row-13 (index 12: top 480, bottom 520)
  const breaks = computeBreakPoints(spans, 1200, pageHeightPx);
  assert(noBreakCutsASpan(breaks, spans), "no page break lands inside a table row");
  assert(breaks[breaks.length - 1] === 1200, "final break reaches the full content height");
  assert(breaks.length >= 3, `multi-page content produces multiple pages (got ${breaks.length})`);
}

// A very tall single guarded element (e.g. a huge signature block) taller than
// a full page must not stall pagination — forward progress is guaranteed.
{
  const spans: GuardSpan[] = [{ top: 0, bottom: 5000 }];
  const breaks = computeBreakPoints(spans, 6000, 1000);
  assert(breaks.every((b, i) => i === 0 || b > breaks[i - 1]!), "pagination always makes forward progress");
  assert(breaks[breaks.length - 1] === 6000, "oversized guarded span still reaches full content height");
}

// Totals/table mix: a table of rows followed by a total row near a page boundary.
{
  const rowHeight = 30;
  const tableSpans = rowsSpans(25, rowHeight); // 0..750
  const totalRow: GuardSpan = { top: 750, bottom: 790 };
  const spans = [...tableSpans, totalRow];
  const pageHeightPx = 770; // naive cut at 770 falls inside the total row (750-790)
  const breaks = computeBreakPoints(spans, 820, pageHeightPx);
  assert(noBreakCutsASpan(breaks, spans), "totals row is never split across a page boundary");
}

// Degenerate input: zero/negative page height must not loop forever.
{
  const spans = rowsSpans(5, 10);
  const breaks = computeBreakPoints(spans, 50, 0);
  assert(breaks.length === 1 && breaks[0] === 50, "zero page height falls back to a single page");
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("All page-break tests passed.");
