#!/usr/bin/env npx tsx
import { DOCUMENT_CATALOG } from "../src/catalog/entries";
import { auditAllTemplates } from "../src/validation/template-compliance";

const issues = auditAllTemplates();

if (issues.length === 0) {
  console.log(`Template compliance: all ${DOCUMENT_CATALOG.length} forms passed.`);
  process.exit(0);
}

const byTemplate = new Map<string, typeof issues>();
for (const issue of issues) {
  const list = byTemplate.get(issue.templateId) ?? [];
  list.push(issue);
  byTemplate.set(issue.templateId, list);
}

console.error(`Template compliance: ${issues.length} issue(s) across ${byTemplate.size} template(s)\n`);
for (const [id, templateIssues] of byTemplate) {
  console.error(`${id}:`);
  for (const issue of templateIssues) {
    console.error(`  [${issue.rule}] ${issue.detail}`);
  }
}
process.exit(1);
