# AI Workflow

## What the App Does (Simple English)

This app takes a photo of a handwritten machine shop data sheet and converts it into digital data. Workers on the shop floor fill out paper log sheets with information like date, shift, employee number, machine number, quantity produced, etc. Instead of manually typing all that data into a computer, you just take a photo and the AI reads it for you.

## How the Workflow Works

### Step 1: Upload
The user uploads a photo or PDF of the handwritten log sheet.

### Step 2: AI Extraction
The app sends the image to Google Gemini 2.5 Flash (a vision AI model) through OpenRouter. The AI reads the handwriting and extracts all the rows from the table.

### Step 3: Review
The extracted data appears in an editable table grid that looks exactly like the original paper form. Fields with low confidence are highlighted so the user knows where to double-check.

### Step 4: Save or Export
The user can save the records to the browser, or export everything to an Excel file for further use.

## Tools Used

- **Claude Code (Opus 4.6)** was used to build the entire application: designing the schema, writing the extraction logic, building the UI, and preparing documentation.
- **Google Gemini 2.5 Flash** (via OpenRouter API) is used as the vision/OCR engine to read handwritten documents.

## How AI Helped in Development

1. Analyzed the actual handwritten document format to design the correct data schema (shifts as Roman numerals, BT-prefix employee numbers, plain-number operation codes, etc.).
2. Built a robust JSON parser that handles messy AI model output (trailing text, malformed responses).
3. Designed the multi-row extraction prompt so the AI extracts ALL rows from a single table image in one API call.
4. Created the editable table grid UI to match the original paper document layout.
5. Added Excel export using XML Spreadsheet format (works without any libraries).
6. Centralized all configurable values (validation patterns, confidence thresholds, AI settings) into a single CONFIG object for easy tuning.

## What Changed from the Original Prototype

| Before | After |
|---|---|
| Shifts were A, B, C | Shifts are I, II, III (Roman numerals) |
| Employee numbers like E1042 | Employee numbers like BT4710 |
| Operation codes like OP-123 | Plain numbers like 856430 |
| Work orders like WO-78213 | Plain numbers like 165460 |
| Single record extraction | Multi-row extraction from one image |
| Card-based review form | Table grid matching the original document |
| Manual OCR text paste | AI reads the image directly |
| No export feature | Export to Excel |
| API key pasted in UI | API key prompted once and saved in browser |
| Hardcoded magic numbers | All values in CONFIG object |

## Manual Steps Still Needed

- The user needs an OpenRouter API key (free tier available at openrouter.ai).
- Very messy handwriting may need manual correction in the review grid.
- For production use, the API key should be moved to a backend server instead of browser localStorage.
