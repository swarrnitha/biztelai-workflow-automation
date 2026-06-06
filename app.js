const CONFIG = {
  storage: {
    recordsKey: "biztelai_opsflow_records_v2",
    uploadsKey: "biztelai_opsflow_uploads_v2",
  },

  shifts: ["I", "II", "III"],

  validation: {
    maxQuantity: 10000,
    maxTimeTakenHours: 24,
    employeePattern: /^[A-Z]{2}\d{4,6}$/,
    operationCodePattern: /^\d{4,6}$/,
    machineNumberPattern: /^MC-\d{2,4}$/,
    workOrderPattern: /^\d{4,8}$/,
  },

  confidence: {
    dateExact: 95,
    shiftExact: 93,
    textMatch: 88,
    manualEdit: 82,
    aiExtraction: 84,
    defaultFallback: 72,
    fallbackGenerated: 58,
    defaultMissing: 28,
    noValue: 25,
    unknownAiField: 65,
    lowThreshold: 70,
  },

  ai: {
    apiKey: localStorage.getItem("biztelai_openrouter_key") || "",
    defaultModel: "google/gemini-2.5-flash",
    temperature: 0.1,
    maxTokens: 4096,
  },

  display: {
    maxBarChartEntries: 6,
    maxRecentUploads: 8,
    gridEmptyRows: 10,
  },

  sampleText: "S.No 1 Date 20/4/26 Shift I Emp BT4710 Opn 856430 Machine MC-730 WO 165460 Qty 25 Time 4.0",

  demoRecords: [
    { file: "machine-shop-data-01.jpg", text: "S.No 1 Date 20/4/26 Shift I Emp BT4710 Opn 856430 Machine MC-730 WO 165460 Qty 25 Time 4.0", status: "Reviewed" },
    { file: "machine-shop-data-02.jpg", text: "S.No 2 Date 20/4/26 Shift II Emp BT4720 Opn 856460 Machine MC-780 WO 165470 Qty 37 Time 8.0", status: "Needs review" },
    { file: "machine-shop-data-03.jpg", text: "S.No 3 Date 20/4/26 Shift III Emp BT4720 Opn 856470 Machine MC-850 WO 601200 Qty 28 Time 7.5", status: "Needs review" },
  ],
};

const schema = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "shift", label: "Shift", type: "select", options: CONFIG.shifts, required: true },
  { key: "employeeNumber", label: "Emp. No", type: "text", required: true },
  { key: "operationCode", label: "Opn Code", type: "text", required: true },
  { key: "machineNumber", label: "Machine No.", type: "text", required: true },
  { key: "workOrderNumber", label: "Work Order No.", type: "text", required: true },
  { key: "quantityProduced", label: "Qty. Prod.", type: "number", required: true },
  { key: "timeTaken", label: "Time Taken (hrs)", type: "number", required: true },
];

let currentFile = null;
let currentBatchRecords = [];
let records = load(CONFIG.storage.recordsKey, []);
let uploads = load(CONFIG.storage.uploadsKey, []);
const demoRecords = CONFIG.demoRecords.map((demo) =>
  createRecord(demo.file, parseText(demo.text), demo.status, "OCR text parser"),
);

const els = {
  fileInput: document.querySelector("#fileInput"),
  imagePreview: document.querySelector("#imagePreview"),
  pdfPreview: document.querySelector("#pdfPreview"),
  previewEmpty: document.querySelector("#previewEmpty"),
  uploadStatus: document.querySelector("#uploadStatus"),
  runAiExtraction: document.querySelector("#runAiExtraction"),
  reviewBody: document.querySelector("#reviewBody"),
  validationList: document.querySelector("#validationList"),
  recordState: document.querySelector("#recordState"),
  extractionNotes: document.querySelector("#extractionNotes"),
  saveRecord: document.querySelector("#saveRecord"),
  exportExcel: document.querySelector("#exportExcel"),
  clearCurrent: document.querySelector("#clearCurrent"),
  kpis: document.querySelector("#kpis"),
  shiftChart: document.querySelector("#shiftChart"),
  machineChart: document.querySelector("#machineChart"),
  historyRows: document.querySelector("#historyRows"),
  uploadRows: document.querySelector("#uploadRows"),
  searchInput: document.querySelector("#searchInput"),
  lastUpdated: document.querySelector("#lastUpdated"),
};

els.fileInput.addEventListener("change", handleFile);
els.runAiExtraction.addEventListener("click", runOpenRouterExtraction);
els.saveRecord.addEventListener("click", saveAllRecords);
els.exportExcel.addEventListener("click", exportToExcel);
els.clearCurrent.addEventListener("click", clearCurrent);
els.searchInput.addEventListener("input", renderHistory);

refreshAllValidations();
renderReviewGrid();
renderDashboard();
renderHistory();

function handleFile(event) {
  const [file] = event.target.files;
  if (!file) return;

  currentFile = file;
  const objectUrl = URL.createObjectURL(file);
  els.previewEmpty.hidden = true;
  els.imagePreview.hidden = true;
  els.pdfPreview.hidden = true;

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    els.pdfPreview.src = objectUrl;
    els.pdfPreview.hidden = false;
  } else {
    els.imagePreview.src = objectUrl;
    els.imagePreview.hidden = false;
  }

  els.uploadStatus.textContent = `${file.name} ready`;
  uploads.unshift({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || "unknown",
    size: file.size,
    uploadedAt: new Date().toISOString(),
  });
  persist();
  renderHistory();
}

async function runOpenRouterExtraction() {
  if (!currentFile) {
    setExtractionMessage("Upload an image or PDF before running AI extraction.", true);
    return;
  }

  let apiKey = CONFIG.ai.apiKey;
  if (!apiKey) {
    apiKey = prompt("Enter your OpenRouter API key (stored in browser only):");
    if (!apiKey) return;
    localStorage.setItem("biztelai_openrouter_key", apiKey.trim());
    CONFIG.ai.apiKey = apiKey.trim();
  }

  const model = CONFIG.ai.defaultModel;
  els.runAiExtraction.disabled = true;
  els.runAiExtraction.textContent = "Extracting...";
  setExtractionMessage(`Calling OpenRouter ${model} for document extraction...`, false);

  try {
    const dataUrl = await fileToDataUrl(currentFile);
    const aiResult = await extractWithOpenRouter({
      apiKey,
      model,
      dataUrl,
      fileName: currentFile.name,
      mimeType: currentFile.type || "",
    });

    const rows = aiResult.rows || [];
    if (rows.length === 0) {
      throw new Error("No rows extracted from document.");
    }

    currentBatchRecords = rows.map((row, i) => {
      const extracted = withConfidence(row.fields, aiResult.rawText || "OpenRouter vision extraction", CONFIG.confidence.aiExtraction);
      if (row.confidence) {
        extracted.confidences = {
          ...extracted.confidences,
          ...normalizeConfidence(row.confidence),
        };
      }
      return createRecord(currentFile.name, extracted, "Needs review", `OpenRouter ${model} (row ${i + 1}/${rows.length})`);
    });

    setExtractionMessage(`Extracted ${rows.length} row(s) from document.`, false);
    renderReviewGrid();
    location.hash = "#review";
  } catch (error) {
    setExtractionMessage(`AI extraction failed: ${error.message}`, true);
  } finally {
    els.runAiExtraction.disabled = false;
    els.runAiExtraction.textContent = "Extract from image with AI";
  }
}

async function extractWithOpenRouter({ apiKey, model, dataUrl, fileName, mimeType }) {
  const prompt = `You are a manufacturing document OCR system. This is a handwritten "Machine shop data" log sheet with a table.

Extract ALL filled rows from the table. Each row has columns: S.No, Date, Shift, Emp. No, Opn Code, Machine No., Work Order No., Qty. Prod., Time taken (in hrs).

RESPOND WITH ONLY A SINGLE JSON OBJECT. No text before or after. No markdown fences.

{
  "rows": [
    {
      "fields": {
        "date": "YYYY-MM-DD",
        "shift": "I or II or III",
        "employeeNumber": "e.g. BT4710",
        "operationCode": "e.g. 856430",
        "machineNumber": "e.g. MC-730",
        "workOrderNumber": "e.g. 165460",
        "quantityProduced": 25,
        "timeTaken": 4.0
      },
      "confidence": {
        "date": 90,
        "shift": 95,
        "employeeNumber": 85,
        "operationCode": 80,
        "machineNumber": 90,
        "workOrderNumber": 85,
        "quantityProduced": 90,
        "timeTaken": 90
      }
    }
  ]
}

Rules:
- Extract every non-empty row from the table
- Shifts are Roman numerals: I, II, or III
- Employee numbers look like BT4710, BT4720
- Operation codes are plain numbers like 856430, 856460
- Machine numbers look like MC-730, MC-780, MC-850
- Work order numbers are plain numbers like 165460, 165470
- Date format in document is DD/M/YY (e.g. 20/4/26 means 2026-04-20). Convert to YYYY-MM-DD
- confidence values are integers 0-100
- If a field is unreadable, set it to empty string and confidence to 0
- quantityProduced and timeTaken are numbers, not strings
- File: ${fileName}`;

  const contentParts = [
    { type: "text", text: prompt },
  ];

  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    contentParts.push({
      type: "file",
      file: {
        filename: fileName,
        file_data: dataUrl,
      },
    });
  } else {
    contentParts.push({
      type: "image_url",
      image_url: { url: dataUrl },
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": location.origin,
      "X-Title": "BiztelAI OpsFlow",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: contentParts,
        },
      ],
      response_format: {
        type: "json_object",
      },
      plugins: [
        { id: "response-healing" },
      ],
      temperature: CONFIG.ai.temperature,
      max_tokens: CONFIG.ai.maxTokens,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenRouter returned HTTP ${response.status}`);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty response.");

  const parsed = parseJsonContent(content);

  if (parsed.rows && Array.isArray(parsed.rows)) {
    return {
      rows: parsed.rows.map((row) => ({
        fields: normalizeFields(row.fields || row),
        confidence: row.confidence || row.confidences || {},
      })),
      rawText: content,
    };
  }

  if (parsed.fields) {
    return {
      rows: [{
        fields: normalizeFields(parsed.fields),
        confidence: parsed.confidence || parsed.confidences || {},
      }],
      rawText: content,
    };
  }

  throw new Error("Model response did not include rows or fields.");
}

function parseJsonContent(content) {
  const text = Array.isArray(content)
    ? content.map((item) => item.text || "").join("\n")
    : String(content);
  const cleaned = text.replace(/```json|```/g, "").trim();

  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          start = -1;
        }
      }
    }
  }
  throw new Error("Model did not return valid JSON.");
}

function normalizeConfidence(confidence) {
  return Object.fromEntries(schema.map((field) => {
    const value = Number(confidence[field.key]);
    return [field.key, Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : CONFIG.confidence.unknownAiField];
  }));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read uploaded file."));
    reader.readAsDataURL(file);
  });
}

function setExtractionMessage(message, isError) {
  els.uploadStatus.textContent = message;
  els.uploadStatus.className = isError ? "pill error" : "pill warn";
}

function parseText(text) {
  const find = (...patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return "";
  };

  const fields = {
    date: find(/\b(\d{4}-\d{2}-\d{2})\b/, /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/),
    shift: find(/\bshift\s*[:#-]?\s*(III|II|I)\b/i),
    employeeNumber: find(/\b(?:emp|employee)\s*[.:#-]?\s*(?:no\.?\s*)?([A-Z]{2}\d{4,6})\b/i),
    operationCode: find(/\b(?:opn|operation|op)\s*[.:#-]?\s*(?:code\s*)?(\d{4,6})\b/i),
    machineNumber: find(/\b(?:machine|mc)\s*[.:#-]?\s*(?:no\.?\s*)?(MC[-\s]?\d{2,4})\b/i),
    workOrderNumber: find(/\b(?:work order|wo)\s*[.:#-]?\s*(?:no\.?\s*)?(\d{4,8})\b/i),
    quantityProduced: find(/\b(?:quantity|qty|produced)\s*[.:#-]?\s*(?:prod\.?\s*)?(\d{1,6})\b/i),
    timeTaken: find(/\b(?:time|hours|hrs|taken)\s*[.:#-]?\s*(\d+(?:\.\d+)?)\b/i),
  };

  return withConfidence(fields, text);
}

function generateFallback(name) {
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const fields = {
    date: new Date(Date.now() - ((seed % 5) * 86400000)).toISOString().slice(0, 10),
    shift: CONFIG.shifts[seed % CONFIG.shifts.length],
    employeeNumber: `BT${4700 + (seed % 100)}`,
    operationCode: `${856000 + (seed % 500)}`,
    machineNumber: `MC-${700 + (seed % 200)}`,
    workOrderNumber: `${165000 + (seed % 1000)}`,
    quantityProduced: 10 + (seed % 100),
    timeTaken: Number((2 + (seed % 80) / 10).toFixed(1)),
  };
  return withConfidence(fields, name, CONFIG.confidence.fallbackGenerated);
}

function withConfidence(fields, rawText, fallbackConfidence = CONFIG.confidence.defaultFallback) {
  const confidences = {};
  for (const field of schema) {
    const value = fields[field.key];
    confidences[field.key] = value ? confidenceFor(field.key, value, rawText, fallbackConfidence) : CONFIG.confidence.defaultMissing;
  }
  return { fields, confidences, rawText };
}

function confidenceFor(key, value, text, fallbackConfidence) {
  const normalized = String(value).replace(/\s/g, "-").toUpperCase();
  if (!value) return CONFIG.confidence.noValue;
  if (key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return CONFIG.confidence.dateExact;
  if (key === "shift" && CONFIG.shifts.includes(String(value).toUpperCase())) return CONFIG.confidence.shiftExact;
  if (text.toUpperCase().includes(normalized)) return CONFIG.confidence.textMatch;
  return fallbackConfidence;
}

function createRecord(documentName, extracted, status, source) {
  const normalizedFields = normalizeFields(extracted.fields);
  const validations = validate(normalizedFields, records);
  return {
    id: crypto.randomUUID(),
    documentName,
    uploadedAt: new Date().toISOString(),
    source,
    fields: normalizedFields,
    confidences: extracted.confidences,
    rawText: extracted.rawText,
    validations,
    status: validations.length ? "Needs review" : status,
  };
}

function normalizeFields(fields) {
  return {
    date: normalizeDate(fields.date),
    shift: normalizeShift(String(fields.shift || "").toUpperCase()),
    employeeNumber: String(fields.employeeNumber || "").toUpperCase(),
    operationCode: String(fields.operationCode || "").replace(/\s/g, ""),
    machineNumber: String(fields.machineNumber || "").toUpperCase().replace(/\s/g, "-"),
    workOrderNumber: String(fields.workOrderNumber || "").replace(/\s/g, ""),
    quantityProduced: fields.quantityProduced === "" ? "" : Number(fields.quantityProduced),
    timeTaken: fields.timeTaken === "" ? "" : Number(fields.timeTaken),
  };
}

function normalizeShift(value) {
  if (CONFIG.shifts.includes(value)) return value;
  if (/^1$/.test(value)) return "I";
  if (/^2$/.test(value)) return "II";
  if (/^3$/.test(value)) return "III";
  return value;
}

function normalizeDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const matchDMY4 = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (matchDMY4) return `${matchDMY4[3]}-${matchDMY4[2].padStart(2, "0")}-${matchDMY4[1].padStart(2, "0")}`;
  const matchDMY2 = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (matchDMY2) return `20${matchDMY2[3]}-${matchDMY2[2].padStart(2, "0")}-${matchDMY2[1].padStart(2, "0")}`;
  return value;
}

// --- Review Grid (table like original document) ---

function renderReviewGrid() {
  els.reviewBody.innerHTML = "";

  const totalRows = Math.max(currentBatchRecords.length, CONFIG.display.gridEmptyRows);
  let allIssues = [];

  for (let i = 0; i < totalRows; i++) {
    const record = currentBatchRecords[i] || null;
    const tr = document.createElement("tr");
    tr.dataset.rowIndex = i;

    const snoTd = document.createElement("td");
    snoTd.className = "sno-cell";
    snoTd.textContent = i + 1;
    tr.appendChild(snoTd);

    for (const field of schema) {
      const td = document.createElement("td");
      td.className = "grid-cell";

      if (record) {
        const value = record.fields[field.key];
        const conf = record.confidences[field.key] || 0;
        const hasIssue = record.validations.some((v) => v.field === field.key);

        if (conf < CONFIG.confidence.lowThreshold) td.classList.add("low-conf");
        if (hasIssue) td.classList.add("has-issue");

        const input = field.type === "select" ? document.createElement("select") : document.createElement("input");
        input.className = "grid-input";
        input.dataset.row = i;
        input.dataset.key = field.key;

        if (field.type === "select") {
          ["", ...field.options].forEach((opt) => {
            const option = document.createElement("option");
            option.value = opt;
            option.textContent = opt || "-";
            input.appendChild(option);
          });
          input.value = value ?? "";
        } else {
          input.type = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
          if (field.type === "number") input.step = "any";
          input.value = value ?? "";
        }

        input.addEventListener("change", handleGridEdit);
        td.appendChild(input);
      }

      tr.appendChild(td);
    }

    const actionTd = document.createElement("td");
    if (record) {
      const delBtn = document.createElement("button");
      delBtn.className = "secondary grid-del";
      delBtn.textContent = "x";
      delBtn.title = "Remove row";
      delBtn.addEventListener("click", () => {
        currentBatchRecords.splice(i, 1);
        renderReviewGrid();
      });
      actionTd.appendChild(delBtn);
    }
    tr.appendChild(actionTd);

    els.reviewBody.appendChild(tr);

    if (record) {
      allIssues = allIssues.concat(record.validations.map((v) => `Row ${i + 1}: ${v.message}`));
    }
  }

  renderValidation(allIssues);
  updateGridStatus();
}

function handleGridEdit(e) {
  const rowIdx = Number(e.target.dataset.row);
  const key = e.target.dataset.key;
  const record = currentBatchRecords[rowIdx];
  if (!record) return;

  const field = schema.find((f) => f.key === key);
  record.fields[key] = field.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value;
  record.confidences[key] = Math.max(record.confidences[key] || 0, CONFIG.confidence.manualEdit);
  record.validations = validate(record.fields, records.filter((r) => r.id !== record.id));
  record.status = record.validations.length ? "Needs review" : "Reviewed";

  renderReviewGrid();
}

function updateGridStatus() {
  if (currentBatchRecords.length === 0) {
    els.recordState.textContent = "Awaiting extraction";
    els.recordState.className = "pill warn";
    els.extractionNotes.textContent = "Upload a document and run extraction.";
    return;
  }

  const totalIssues = currentBatchRecords.reduce((sum, r) => sum + r.validations.length, 0);
  const totalLow = currentBatchRecords.reduce((sum, r) =>
    sum + Object.values(r.confidences).filter((c) => c < CONFIG.confidence.lowThreshold).length, 0);

  els.recordState.textContent = totalIssues
    ? `${currentBatchRecords.length} row(s) - ${totalIssues} issue(s)`
    : `${currentBatchRecords.length} row(s) - Ready`;
  els.recordState.className = totalIssues ? "pill error" : totalLow ? "pill warn" : "pill";
  els.extractionNotes.textContent = `${currentBatchRecords.length} row(s) extracted. ${totalLow} low-confidence field(s). ${totalIssues} validation issue(s).`;
}

function renderValidation(issues) {
  els.validationList.innerHTML = "";
  const messages = Array.isArray(issues) && issues.length ? issues : [];
  els.validationList.className = messages.length ? "validation-list" : "validation-list ok";
  if (!messages.length) {
    const item = document.createElement("li");
    item.textContent = "No validation exceptions.";
    els.validationList.appendChild(item);
    return;
  }
  messages.forEach((msg) => {
    const item = document.createElement("li");
    item.textContent = typeof msg === "string" ? msg : msg.message;
    els.validationList.appendChild(item);
  });
}

function saveAllRecords() {
  if (!currentBatchRecords.length) return;
  for (const batchRecord of currentBatchRecords) {
    batchRecord.validations = validate(batchRecord.fields, records.filter((r) => r.id !== batchRecord.id));
    batchRecord.status = batchRecord.validations.length ? "Needs review" : "Reviewed";
    const index = records.findIndex((r) => r.id === batchRecord.id);
    if (index >= 0) records[index] = batchRecord;
    else records.unshift(batchRecord);
  }
  persist();
  renderDashboard();
  renderHistory();
  setExtractionMessage(`Saved ${currentBatchRecords.length} row(s).`, false);
  renderReviewGrid();
}

function clearCurrent() {
  currentFile = null;
  currentBatchRecords = [];
  els.fileInput.value = "";
  els.imagePreview.hidden = true;
  els.pdfPreview.hidden = true;
  els.previewEmpty.hidden = false;
  els.uploadStatus.textContent = "No active file";
  renderReviewGrid();
}

// --- Excel Export ---

function exportToExcel() {
  const dataRecords = currentBatchRecords.length ? currentBatchRecords : records;
  if (!dataRecords.length) {
    setExtractionMessage("No records to export.", true);
    return;
  }

  const headers = ["S.No", ...schema.map((f) => f.label)];
  const rows = dataRecords.map((r, i) => [
    i + 1,
    r.fields.date,
    r.fields.shift,
    r.fields.employeeNumber,
    r.fields.operationCode,
    r.fields.machineNumber,
    r.fields.workOrderNumber,
    r.fields.quantityProduced,
    r.fields.timeTaken,
  ]);

  const escapeXml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const xmlRows = rows.map((row) =>
    "<Row>" + row.map((cell) => {
      const type = typeof cell === "number" ? "Number" : "String";
      return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
    }).join("") + "</Row>"
  ).join("\n    ");

  const headerRow = "<Row>" + headers.map((h) =>
    `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
  ).join("") + "</Row>";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#1B2A3D" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Machine Shop Data">
    <Table>
      <Column ss:Width="40"/>
      <Column ss:Width="90"/>
      <Column ss:Width="50"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      <Column ss:Width="90"/>
      <Column ss:Width="100"/>
      <Column ss:Width="70"/>
      <Column ss:Width="100"/>
    ${headerRow}
    ${xmlRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const timestamp = new Date().toISOString().slice(0, 10);
  a.download = `machine-shop-data-${timestamp}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Dashboard ---

function renderDashboard() {
  const totalUploads = uploads.length;
  const validationFailures = records.filter((record) => record.validations.length).length;
  const totalQuantity = records.reduce((sum, record) => sum + Number(record.fields.quantityProduced || 0), 0);
  const avgConfidence = records.length
    ? Math.round(records.reduce((sum, record) => sum + average(Object.values(record.confidences)), 0) / records.length)
    : 0;

  els.kpis.innerHTML = [
    ["Total uploads", totalUploads],
    ["Reviewed records", records.length],
    ["Validation failures", validationFailures],
    ["Quantity produced", totalQuantity],
    ["Avg confidence", `${avgConfidence}%`],
  ].map(([label, value]) => `<div class="kpi"><span>${label}</span><strong>${value}</strong></div>`).join("");

  renderBarChart(els.shiftChart, groupBy(records, (record) => record.fields.shift || "Unknown", (record) => Number(record.fields.quantityProduced || 0)));
  renderBarChart(els.machineChart, groupBy(records, (record) => record.fields.machineNumber || "Unknown", (record) => Number(record.fields.quantityProduced || 0)));
  els.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function renderBarChart(container, data) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, CONFIG.display.maxBarChartEntries);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  container.innerHTML = entries.length
    ? entries.map(([label, value]) => `
      <div class="bar-row">
        <span>${label}</span>
        <div class="bar"><span style="width:${Math.max(4, (value / max) * 100)}%"></span></div>
        <strong>${value}</strong>
      </div>
    `).join("")
    : `<p class="notes">No reviewed records yet.</p>`;
}

// --- History ---

function renderHistory() {
  const query = els.searchInput.value.trim().toLowerCase();
  const visible = records.filter((record) => {
    const haystack = [
      record.documentName,
      record.fields.date,
      record.fields.shift,
      record.fields.employeeNumber,
      record.fields.machineNumber,
      record.fields.workOrderNumber,
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  els.historyRows.innerHTML = visible.length
    ? visible.map((record) => `
      <tr>
        <td>${escapeHtml(record.documentName)}</td>
        <td>${escapeHtml(record.fields.date)}</td>
        <td>${escapeHtml(record.fields.shift)}</td>
        <td>${escapeHtml(record.fields.workOrderNumber)}</td>
        <td>${escapeHtml(record.fields.machineNumber)}</td>
        <td>${escapeHtml(record.fields.quantityProduced)}</td>
        <td><span class="pill ${record.validations.length ? "error" : ""}">${record.status}</span></td>
        <td><button class="secondary" data-open="${record.id}">Open</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="8">No records match the current search.</td></tr>`;

  els.historyRows.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      currentBatchRecords = [structuredClone(records.find((record) => record.id === button.dataset.open))];
      renderReviewGrid();
      location.hash = "#review";
    });
  });

  renderUploadHistory();
}

function renderUploadHistory() {
  els.uploadRows.innerHTML = uploads.length
    ? uploads.slice(0, CONFIG.display.maxRecentUploads).map((upload) => `
      <div class="upload-item">
        <strong>${escapeHtml(upload.name)}</strong>
        <span>${escapeHtml(upload.type || "unknown")}</span>
        <span>${new Date(upload.uploadedAt).toLocaleString()}</span>
      </div>
    `).join("")
    : `<p class="notes">No uploads yet.</p>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Demo & Utilities ---

function seedDemoRecords() {
  const existingIds = new Set(records.map((record) => record.id));
  const fresh = demoRecords.filter((record) => !existingIds.has(record.id));
  records = [...fresh, ...records];
  uploads = [
    ...fresh.map((record) => ({ id: crypto.randomUUID(), name: record.documentName, type: "demo", size: 0, uploadedAt: record.uploadedAt })),
    ...uploads,
  ];
  refreshAllValidations();
  persist();
  renderDashboard();
  renderHistory();
}

function refreshAllValidations() {
  records = records.map((record) => {
    const peers = records.filter((item) => item.id !== record.id);
    const validations = validate(record.fields, peers);
    return {
      ...record,
      validations,
      status: validations.length ? "Needs review" : record.status || "Reviewed",
    };
  });
}

function validate(fields, existingRecords) {
  const issues = [];
  const requiredLabels = Object.fromEntries(schema.map((field) => [field.key, field.label]));
  for (const field of schema) {
    if (field.required && (fields[field.key] === "" || fields[field.key] === null || Number.isNaN(fields[field.key]))) {
      issues.push({ field: field.key, message: `${requiredLabels[field.key]} is mandatory.` });
    }
  }
  if (fields.shift && !CONFIG.shifts.includes(fields.shift)) issues.push({ field: "shift", message: `Shift must be ${CONFIG.shifts.join(", ")}.` });
  if (fields.employeeNumber && !CONFIG.validation.employeePattern.test(fields.employeeNumber)) issues.push({ field: "employeeNumber", message: "Emp. No should look like BT4710." });
  if (fields.operationCode && !CONFIG.validation.operationCodePattern.test(fields.operationCode)) issues.push({ field: "operationCode", message: "Opn Code should be a number like 856430." });
  if (fields.machineNumber && !CONFIG.validation.machineNumberPattern.test(fields.machineNumber)) issues.push({ field: "machineNumber", message: "Machine No. should follow MC-730 format." });
  if (fields.workOrderNumber && !CONFIG.validation.workOrderPattern.test(fields.workOrderNumber)) issues.push({ field: "workOrderNumber", message: "Work Order No. should be a number like 165460." });
  if (Number(fields.quantityProduced) <= 0) issues.push({ field: "quantityProduced", message: "Quantity must be greater than zero." });
  if (Number(fields.quantityProduced) > CONFIG.validation.maxQuantity) issues.push({ field: "quantityProduced", message: `Quantity exceeds ${CONFIG.validation.maxQuantity} and needs supervisor review.` });
  if (Number(fields.timeTaken) <= 0 || Number(fields.timeTaken) > CONFIG.validation.maxTimeTakenHours) issues.push({ field: "timeTaken", message: `Time taken should be between 0 and ${CONFIG.validation.maxTimeTakenHours} hours.` });
  return issues;
}

function groupBy(items, keyFn, valueFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + valueFn(item);
    return acc;
  }, {});
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(CONFIG.storage.recordsKey, JSON.stringify(records));
  localStorage.setItem(CONFIG.storage.uploadsKey, JSON.stringify(uploads));
}
