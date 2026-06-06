# BiztelAI OpsFlow

AI-powered workflow automation prototype for digitizing handwritten or semi-structured manufacturing documents into reviewable operational records.

## Features

- Upload image or PDF documents.
- Preview uploaded files in the browser.
- Parse OCR/transcribed text into a structured manufacturing record.
- Deterministic fallback extraction for image-only handwritten documents so the workflow remains demoable without paid OCR credentials.
- Editable review form with field-level confidence scores.
- Validation rules for mandatory fields, shift values, machine/work-order formats, suspicious quantities, time ranges, and duplicate work orders.
- Save reviewed records to browser `localStorage`.
- Dashboard with upload count, reviewed records, validation failures, confidence, shift summaries, and machine quantity summaries.
- Searchable history with the ability to reopen processed records.

## Run Locally

No install is required.

Open `index.html` in a browser, or serve the folder with any static server:

```bash
npx serve .
```

Then open the shown local URL.

## Workflow

1. Upload an image or PDF.
2. Paste OCR/transcribed text if available, or click `Insert sample OCR text`.
3. Click `Run extraction`.
4. Review extracted fields and low-confidence indicators.
5. Correct invalid fields.
6. Save the reviewed record.
7. Use dashboard and history sections to inspect operational data.

## Extraction Approach

The prototype uses a client-side text parser for common operational document patterns:

- `Date`
- `Shift`
- `Emp` / `Employee`
- `Operation` / `OP`
- `Machine` / `MC`
- `Work Order` / `WO`
- `Quantity` / `Qty`
- `Time` / `Hours`

For handwritten/image-only files where browser JavaScript cannot directly OCR without a model or external service, the app generates a deterministic low-confidence extraction from the file name. This keeps the entire product flow testable while clearly flagging lower-confidence fields for manual review.

## Architecture

- `index.html`: application layout and workflow sections.
- `styles.css`: responsive operational UI styling.
- `app.js`: upload handling, preview, extraction, confidence scoring, validation, persistence, dashboard analytics, and history search.
- Browser `localStorage`: lightweight prototype persistence.

## Assumptions and Tradeoffs

- This is a working prototype, not a production OCR service.
- Real OCR/LLM extraction can be added behind the same schema by replacing `parseText` / `generateFallback` with an API call.
- Uploaded files are previewed locally and are not sent to a backend.
- Data persistence is browser-local to keep setup and hosting simple.
- Duplicate detection is performed on reviewed records by work order number.

## Deployment

This can be deployed to any static hosting provider such as Netlify, Vercel, GitHub Pages, or Cloudflare Pages.

## Demo Video Checklist

Cover these steps in the mandatory demo video:

1. Upload an image or PDF and show preview.
2. Insert or paste OCR text and run extraction.
3. Show confidence scores and validation exceptions.
4. Correct a field and save the reviewed record.
5. Open dashboard analytics.
6. Search history and reopen a prior record.
