# AI Workflow

## Tools Used

- Codex was used to read the assignment, design the prototype workflow, implement the static web app, and prepare submission documentation.

## How AI Helped

- Converted ambiguous assignment requirements into a concrete product workflow.
- Designed a pragmatic schema for manufacturing operational records.
- Implemented upload, preview, extraction, confidence, validation, dashboard, search, and history in a small client-side app.
- Added optional OpenRouter vision extraction so uploaded document images/PDFs can be converted into the same structured schema.
- Drafted README setup instructions and demo-video checklist.

## Prompting and Debugging Workflow

- Started from the assignment statement and extracted the core user journeys.
- Prioritized end-to-end usability over backend complexity.
- Used deterministic mock extraction as a fallback where real OCR is unavailable, while also adding an optional OpenRouter path for real AI extraction.
- Planned the validation rules around real operational failure modes: missing required fields, invalid codes, suspicious quantities, time ranges, and duplicate work orders.

## Manual Intervention

- A production implementation would still require selecting and integrating an OCR/LLM provider.
- Real sample documents should be tested to tune field parsing, validation thresholds, and confidence scoring.
- Deployment URL and demo video need to be created by the submitter after reviewing the local prototype.
