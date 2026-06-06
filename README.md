# BiztelAI OpsFlow

AI-powered workflow automation for digitizing handwritten manufacturing shop-floor records into structured, validated operational data.

## What It Does

Upload a photo of a handwritten "Machine Shop Data" log sheet. The app uses Google Gemini (via OpenRouter) to read the handwriting, extract all rows from the table, and display them in an editable grid. You can review, correct, save, and export the data to Excel.

## Features

- Upload image or PDF of handwritten machine shop data sheets.
- AI-powered extraction using Google Gemini 2.5 Flash vision model.
- Extracts all rows from a single document in one go.
- Editable table grid that mirrors the original document layout (S.No, Date, Shift, Emp. No, Opn Code, Machine No., Work Order No., Qty. Prod., Time taken).
- Validation rules for field formats, quantity limits, and time ranges.
- Low-confidence fields highlighted for review.
- Export extracted data to Excel (.xls) with one click.
- Save reviewed records to browser localStorage.
- Dashboard with upload count, reviewed records, quantity totals, shift and machine charts.
- Searchable record history.

## How to Use

1. Open the app in a browser.
2. Upload a photo or PDF of a machine shop data sheet.
3. Click "Extract from image with AI".
4. On first use, you'll be asked for your OpenRouter API key (get one free at openrouter.ai). It's saved in your browser only.
5. The AI reads the document and fills the table grid with all extracted rows.
6. Review the data, fix any errors directly in the grid.
7. Click "Save all records" to save, or "Export to Excel" to download.
8. Check the Dashboard for analytics and History for past records.

## Document Format

The app is designed for handwritten machine shop log sheets with these columns:

| Column | Example | Format |
|---|---|---|
| S.No | 1, 2, 3 | Row number |
| Date | 20/4/26 | DD/M/YY |
| Shift | I, II, III | Roman numerals |
| Emp. No | BT4710 | 2 letters + 4-6 digits |
| Opn Code | 856430 | 4-6 digit number |
| Machine No. | MC-730 | MC- followed by digits |
| Work Order No. | 165460 | 4-8 digit number |
| Qty. Prod. | 25 | Number |
| Time taken (hrs) | 4.0 | Decimal hours |

## Run Locally

No install needed. Open `index.html` in a browser, or serve with any static server:

```bash
python3 -m http.server 8080
```

## Tech Stack

- Pure HTML, CSS, JavaScript (no frameworks, no build step).
- Google Gemini 2.5 Flash via OpenRouter API for vision/OCR.
- Browser localStorage for data persistence.
- XML Spreadsheet format for Excel export.

## Project Structure

```
biztelai-workflow-automation/
├── index.html          # App layout and UI sections
├── app.js              # All logic: extraction, validation, grid, export
├── styles.css          # Responsive styling
├── .env.example        # Example environment config
├── .env.local          # Your API key (gitignored, not committed)
├── .gitignore
├── .github/workflows/pages.yml  # Auto-deploy to GitHub Pages
├── README.md
└── AI_WORKFLOW.md      # How AI was used in development
```

## Configuration

All configurable values are in the `CONFIG` object at the top of `app.js`:

- **Shifts**: `["I", "II", "III"]`
- **Validation patterns**: Employee, operation code, machine, work order formats
- **Validation limits**: Max quantity (10,000), max time (24 hrs)
- **AI settings**: Model, temperature, max tokens
- **Display**: Chart entries, recent uploads count, grid rows

## Live Demo

GitHub Pages: https://swarrnitha.github.io/biztelai-workflow-automation/

Repository: https://github.com/swarrnitha/biztelai-workflow-automation
