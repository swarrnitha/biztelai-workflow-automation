const STORAGE_KEY = "biztelai_opsflow_records_v1";
const UPLOAD_KEY = "biztelai_opsflow_uploads_v1";

const schema = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "shift", label: "Shift", type: "select", options: ["A", "B", "C"], required: true },
  { key: "employeeNumber", label: "Employee Number", type: "text", required: true },
  { key: "operationCode", label: "Operation Code", type: "text", required: true },
  { key: "machineNumber", label: "Machine Number", type: "text", required: true },
  { key: "workOrderNumber", label: "Work Order Number", type: "text", required: true },
  { key: "quantityProduced", label: "Quantity Produced", type: "number", required: true },
  { key: "timeTaken", label: "Time Taken (hrs)", type: "number", required: true },
];

const sampleText = "Date 2026-06-04 Shift B Emp E1042 Operation OP-220 Machine MC-014 Work Order WO-78213 Quantity 1240 Time 6.5";

let currentFile = null;
let currentRecord = null;
let records = load(STORAGE_KEY, []);
let uploads = load(UPLOAD_KEY, []);
const demoRecords = [
  createRecord("batch-log-wo-78213.jpg", parseText(sampleText), "Reviewed", "OCR text parser"),
  createRecord("press-line-shift-a.pdf", parseText("Date 2026-06-03 Shift A Emp E1018 Op OP-110 Machine MC-006 WO WO-78194 Qty 880 Time 5.25"), "Needs review", "OCR text parser"),
  createRecord("assembly-note-low-confidence.png", parseText("Date 2026-06-02 Shift C Emp E1199 Operation OP-330 Machine M-18 Work Order WO-78194 Quantity 22000 Time 2"), "Needs review", "OCR text parser"),
];

const els = {
  fileInput: document.querySelector("#fileInput"),
  imagePreview: document.querySelector("#imagePreview"),
  pdfPreview: document.querySelector("#pdfPreview"),
  previewEmpty: document.querySelector("#previewEmpty"),
  uploadStatus: document.querySelector("#uploadStatus"),
  ocrText: document.querySelector("#ocrText"),
  sampleText: document.querySelector("#sampleText"),
  runExtraction: document.querySelector("#runExtraction"),
  reviewForm: document.querySelector("#reviewForm"),
  validationList: document.querySelector("#validationList"),
  recordState: document.querySelector("#recordState"),
  extractionNotes: document.querySelector("#extractionNotes"),
  saveRecord: document.querySelector("#saveRecord"),
  clearCurrent: document.querySelector("#clearCurrent"),
  kpis: document.querySelector("#kpis"),
  shiftChart: document.querySelector("#shiftChart"),
  machineChart: document.querySelector("#machineChart"),
  historyRows: document.querySelector("#historyRows"),
  uploadRows: document.querySelector("#uploadRows"),
  searchInput: document.querySelector("#searchInput"),
  seedDemo: document.querySelector("#seedDemo"),
  lastUpdated: document.querySelector("#lastUpdated"),
};

els.fileInput.addEventListener("change", handleFile);
els.sampleText.addEventListener("click", () => {
  els.ocrText.value = sampleText;
});
els.runExtraction.addEventListener("click", runExtraction);
els.saveRecord.addEventListener("click", saveReviewedRecord);
els.clearCurrent.addEventListener("click", clearCurrent);
els.searchInput.addEventListener("input", renderHistory);
els.seedDemo.addEventListener("click", seedDemoRecords);

refreshAllValidations();
renderReview();
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

function runExtraction() {
  const text = els.ocrText.value.trim();
  const parsed = text ? parseText(text) : generateFallback(currentFile?.name || "manual-entry.jpg");
  const source = text ? "OCR text parser" : "filename and document-shape fallback";
  const fileName = currentFile?.name || "manual-entry";
  currentRecord = createRecord(fileName, parsed, "Needs review", source);
  renderReview();
  location.hash = "#review";
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
    date: find(/\b(\d{4}-\d{2}-\d{2})\b/, /\b(\d{2}[/-]\d{2}[/-]\d{4})\b/),
    shift: find(/\bshift\s*[:#-]?\s*([ABC])\b/i),
    employeeNumber: find(/\b(?:emp|employee|employee no)\s*[:#-]?\s*([A-Z]?\d{3,6})\b/i),
    operationCode: find(/\b(?:operation|op)\s*[:#-]?\s*(OP[-\s]?\d{2,4})\b/i),
    machineNumber: find(/\b(?:machine|mc)\s*[:#-]?\s*((?:MC|M)[-\s]?\d{2,4})\b/i),
    workOrderNumber: find(/\b(?:work order|wo)\s*[:#-]?\s*(WO[-\s]?\d{4,8})\b/i),
    quantityProduced: find(/\b(?:quantity|qty|produced)\s*[:#-]?\s*(\d{1,6})\b/i),
    timeTaken: find(/\b(?:time|hours|hrs|taken)\s*[:#-]?\s*(\d+(?:\.\d+)?)\b/i),
  };

  return withConfidence(fields, text);
}

function generateFallback(name) {
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const fields = {
    date: `2026-06-${String((seed % 5) + 1).padStart(2, "0")}`,
    shift: ["A", "B", "C"][seed % 3],
    employeeNumber: `E${1000 + (seed % 850)}`,
    operationCode: `OP-${100 + (seed % 260)}`,
    machineNumber: `MC-${String((seed % 28) + 1).padStart(3, "0")}`,
    workOrderNumber: `WO-${78000 + (seed % 250)}`,
    quantityProduced: 400 + (seed % 1600),
    timeTaken: Number((3 + (seed % 50) / 10).toFixed(1)),
  };
  return withConfidence(fields, name, 58);
}

function withConfidence(fields, rawText, fallbackConfidence = 72) {
  const confidences = {};
  for (const field of schema) {
    const value = fields[field.key];
    confidences[field.key] = value ? confidenceFor(field.key, value, rawText, fallbackConfidence) : 28;
  }
  return { fields, confidences, rawText };
}

function confidenceFor(key, value, text, fallbackConfidence) {
  const normalized = String(value).replace(/\s/g, "-").toUpperCase();
  if (!value) return 25;
  if (key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return 95;
  if (key === "shift" && /^[ABC]$/.test(String(value).toUpperCase())) return 93;
  if (text.toUpperCase().includes(normalized)) return 88;
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
    shift: String(fields.shift || "").toUpperCase(),
    employeeNumber: String(fields.employeeNumber || "").toUpperCase(),
    operationCode: String(fields.operationCode || "").toUpperCase().replace(/\s/g, "-"),
    machineNumber: String(fields.machineNumber || "").toUpperCase().replace(/\s/g, "-"),
    workOrderNumber: String(fields.workOrderNumber || "").toUpperCase().replace(/\s/g, "-"),
    quantityProduced: fields.quantityProduced === "" ? "" : Number(fields.quantityProduced),
    timeTaken: fields.timeTaken === "" ? "" : Number(fields.timeTaken),
  };
}

function normalizeDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = String(value).match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function renderReview() {
  els.reviewForm.innerHTML = "";
  const record = currentRecord;
  if (!record) {
    schema.forEach((field) => els.reviewForm.appendChild(renderField(field, "", 0, false)));
    renderValidation([]);
    els.recordState.textContent = "Awaiting extraction";
    els.recordState.className = "pill warn";
    els.extractionNotes.textContent = "Upload a document and run extraction.";
    return;
  }

  record.validations = validate(record.fields, records.filter((item) => item.id !== record.id));
  schema.forEach((field) => {
    const invalid = record.validations.some((issue) => issue.field === field.key);
    els.reviewForm.appendChild(renderField(field, record.fields[field.key], record.confidences[field.key], invalid));
  });
  renderValidation(record.validations);
  const lowConfidenceCount = Object.values(record.confidences).filter((score) => score < 70).length;
  els.recordState.textContent = record.validations.length || lowConfidenceCount ? "Needs review" : "Ready to save";
  els.recordState.className = record.validations.length ? "pill error" : lowConfidenceCount ? "pill warn" : "pill";
  els.extractionNotes.textContent = `${record.source}. ${lowConfidenceCount} low-confidence field(s). Raw text length: ${record.rawText?.length || 0} characters.`;
}

function renderField(field, value, confidence, invalid) {
  const wrapper = document.createElement("div");
  wrapper.className = `field ${confidence && confidence < 70 ? "low" : ""} ${invalid ? "invalid" : ""}`;
  wrapper.innerHTML = `
    <div class="field-meta">
      <label for="${field.key}">${field.label}</label>
      <span class="confidence">${confidence || 0}%</span>
    </div>
  `;
  const input = field.type === "select" ? document.createElement("select") : document.createElement("input");
  input.id = field.key;
  input.dataset.key = field.key;
  input.type = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  if (field.type === "select") {
    ["", ...field.options].forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue || "Select";
      input.appendChild(option);
    });
  }
  input.value = value ?? "";
  input.addEventListener("input", updateCurrentFromForm);
  wrapper.appendChild(input);
  return wrapper;
}

function updateCurrentFromForm() {
  if (!currentRecord) return;
  for (const field of schema) {
    const input = document.querySelector(`#${field.key}`);
    currentRecord.fields[field.key] = field.type === "number" && input.value !== "" ? Number(input.value) : input.value;
    currentRecord.confidences[field.key] = Math.max(currentRecord.confidences[field.key] || 0, 82);
  }
  currentRecord.validations = validate(currentRecord.fields, records.filter((item) => item.id !== currentRecord.id));
  currentRecord.status = currentRecord.validations.length ? "Needs review" : "Reviewed";
  renderReview();
}

function validate(fields, existingRecords) {
  const issues = [];
  const requiredLabels = Object.fromEntries(schema.map((field) => [field.key, field.label]));
  for (const field of schema) {
    if (field.required && (fields[field.key] === "" || fields[field.key] === null || Number.isNaN(fields[field.key]))) {
      issues.push({ field: field.key, message: `${requiredLabels[field.key]} is mandatory.` });
    }
  }
  if (fields.shift && !["A", "B", "C"].includes(fields.shift)) issues.push({ field: "shift", message: "Shift must be A, B, or C." });
  if (fields.employeeNumber && !/^E?\d{3,6}$/.test(fields.employeeNumber)) issues.push({ field: "employeeNumber", message: "Employee number should look like E1042 or 1042." });
  if (fields.operationCode && !/^OP-\d{2,4}$/.test(fields.operationCode)) issues.push({ field: "operationCode", message: "Operation code should follow OP-123 format." });
  if (fields.machineNumber && !/^MC-\d{2,4}$/.test(fields.machineNumber)) issues.push({ field: "machineNumber", message: "Machine number should follow MC-014 format." });
  if (fields.workOrderNumber && !/^WO-\d{4,8}$/.test(fields.workOrderNumber)) issues.push({ field: "workOrderNumber", message: "Work order should follow WO-78213 format." });
  if (Number(fields.quantityProduced) <= 0) issues.push({ field: "quantityProduced", message: "Quantity must be greater than zero." });
  if (Number(fields.quantityProduced) > 10000) issues.push({ field: "quantityProduced", message: "Quantity is unusually high and needs supervisor review." });
  if (Number(fields.timeTaken) <= 0 || Number(fields.timeTaken) > 16) issues.push({ field: "timeTaken", message: "Time taken should be between 0 and 16 hours." });
  if (fields.workOrderNumber && existingRecords.some((record) => record.fields.workOrderNumber === fields.workOrderNumber)) {
    issues.push({ field: "workOrderNumber", message: "Duplicate work order number found in reviewed records." });
  }
  return issues;
}

function renderValidation(issues) {
  els.validationList.innerHTML = "";
  els.validationList.className = issues.length ? "validation-list" : "validation-list ok";
  if (!issues.length) {
    const item = document.createElement("li");
    item.textContent = "No validation exceptions.";
    els.validationList.appendChild(item);
    return;
  }
  issues.forEach((issue) => {
    const item = document.createElement("li");
    item.textContent = issue.message;
    els.validationList.appendChild(item);
  });
}

function saveReviewedRecord() {
  if (!currentRecord) return;
  currentRecord.validations = validate(currentRecord.fields, records.filter((item) => item.id !== currentRecord.id));
  currentRecord.status = currentRecord.validations.length ? "Needs review" : "Reviewed";
  const index = records.findIndex((record) => record.id === currentRecord.id);
  if (index >= 0) records[index] = currentRecord;
  else records.unshift(currentRecord);
  persist();
  renderDashboard();
  renderHistory();
  renderReview();
}

function clearCurrent() {
  currentRecord = null;
  currentFile = null;
  els.fileInput.value = "";
  els.ocrText.value = "";
  els.imagePreview.hidden = true;
  els.pdfPreview.hidden = true;
  els.previewEmpty.hidden = false;
  els.uploadStatus.textContent = "No active file";
  renderReview();
}

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
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
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
      currentRecord = structuredClone(records.find((record) => record.id === button.dataset.open));
      renderReview();
      location.hash = "#review";
    });
  });

  renderUploadHistory();
}

function renderUploadHistory() {
  els.uploadRows.innerHTML = uploads.length
    ? uploads.slice(0, 8).map((upload) => `
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

function seedDemoRecords() {
  const existingWorkOrders = new Set(records.map((record) => record.fields.workOrderNumber));
  const fresh = demoRecords.filter((record) => !existingWorkOrders.has(record.fields.workOrderNumber));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  localStorage.setItem(UPLOAD_KEY, JSON.stringify(uploads));
}
