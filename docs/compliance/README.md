# Compliance Change Log

This directory contains dated, signed records of material compliance-affecting changes to Quarterback Health's production systems, subprocessor configurations, and privacy controls.

## Purpose

- Provide counsel with an accurate timeline of compliance posture changes
- Support future SOC 2 Type I / Type II examinations as change-management and control evidence
- Support responses to data subject requests, regulatory inquiries, and breach investigations
- Provide an institutional memory that survives personnel changes

## Format

One file per change event, named `YYYY-MM-DD-short-slug.md`.

Each record includes:

1. Change ID, date, performer, approver
2. Summary
3. Business / regulatory justification
4. Inventory of before / after state for each affected setting
5. Verification results
6. Residual open items
7. Regulatory impact analysis
8. SOC 2 trust-services-criteria mapping
9. Evidence list (screenshots, commits, logs to retain)
10. Related documents
11. Sign-off table

## Evidence folder

Screenshots, export files, and other binary evidence live under `evidence/YYYY-MM-DD/` so that git text files stay small.

## Index

| Date | Record | Topic |
|---|---|---|
| 2026-04-22 | [GA4 / Cookiebot reconfiguration](2026-04-22-ga4-cookiebot-reconfiguration.md) | Moved Google Analytics 4 to service-provider-only configuration; installed Google Consent Mode v2 Advanced; verified Cookiebot consent gating |

## Adding a new record

1. Copy an existing record as a template
2. Assign a new Change ID (`QBH-COMP-YYYY-MM-DD-NNN`)
3. Fill in every field honestly; mark TBDs rather than deleting them
4. Save screenshots and exports under `evidence/YYYY-MM-DD/`
5. Add an entry to the index table above
6. Commit with a message like `compliance: record [short description] ([change ID])`

## Retention

Records in this directory should be retained for a minimum of six years, aligning with HIPAA's documentation retention requirement. Do not delete records; supersede them with follow-up records.
