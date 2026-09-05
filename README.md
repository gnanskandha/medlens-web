# 🏥 MedLens — Clinical Intelligence & Record Review Engine

> **Transforming fragmented medical records into structured, traceable, and safe clinical reviews — 100% locally in the browser.**

![Client-Side](https://img.shields.io/badge/Processing-100%25_Client--Side-blue)
![Privacy](https://img.shields.io/badge/PHI_Redaction-Enabled-green)
![Tests](https://img.shields.io/badge/Automated_Tests-35%2F35_Passing-brightgreen)
![Responsible_AI](https://img.shields.io/badge/Responsible_AI-Strict_Safety-orange)

## 🎯 Overview
**MedLens** is an AI-assisted, offline-first clinical intelligence engine built for the **PromptWars Hackathon**. It acts as a universal bridge between unstructured, messy real-world medical inputs (doctor notes, lab PDFs, handwritten prescriptions) and structured, reviewable clinical records. 

Unlike traditional AI wrappers that send sensitive Protected Health Information (PHI) to external LLM APIs, MedLens uses a **Deterministic Clinical Regex Engine** paired with local OCR/PDF parsing to extract, normalize, and verify medical data **without a single byte of data ever leaving the user's device.**

---

## ✨ Key Features

### 🧠 Intelligent Extraction & Normalization
* **Deterministic Parsing:** Extracts medications (with dose escalations), allergies, lab results, and care plans using advanced clinical regex.
* **Terminology Normalization:** Automatically maps aliases (e.g., `Hb` → `Hemoglobin`, `SGPT` → `ALT`) and rejects false positives (e.g., prevents `ESR mm/hr` from being parsed as a medication).
* **Multi-Modal Ingestion:** Paste raw text, upload `.txt`/`.md` files, or use integrated **PDF.js** and **Tesseract.js OCR** to extract text from scanned PDFs and images locally.

### 🛡️ Source-Grounded Safety & Responsible AI
* **Strict Reference Range Safety:** MedLens *never* invents reference ranges. If a lab value lacks a source-provided range, it is flagged as `Reference range not provided` to prevent unsafe clinical assumptions.
* **Inconsistency & Conflict Detection:** Automatically flags dangerous discrepancies (e.g., Patient intake form claims "No Known Drug Allergies", but the doctor's note documents "Allergic to Penicillin").
* **Non-Diagnostic Boundary:** Generates patient-friendly summaries that strictly organize facts without providing medical diagnoses or treatment recommendations.

### 📊 Longitudinal Tracking & Review
* **Factual Delta Comparison:** Compares current lab results and medication regimens against stored baselines (via LocalStorage/SQLite mock) to show objective factual differences (e.g., `HbA1c: 8.9% → 7.2% (-1.7%)`).
* **Human-in-the-Loop Verification:** Every extracted field includes a "Source Provenance" audit trail, allowing clinicians to view the exact source text snippet and manually verify or edit the field.

### 🔒 Enterprise-Grade Privacy & Security
* **Zero Data Leakage:** No external API calls, no backend servers, no database tracking. 
* **Privacy Mode (PHI Redaction):** One-click toggle to instantly redact patient names and ages (`[REDACTED NAME]`) for safe screen-sharing, teaching, and demos.
* **XSS & Injection Protection:** Rigorous HTML escaping and sanitization on all user inputs and document uploads.

---

## 🧪 The 35-Test In-Browser Harness
Most hackathon projects lack testing. MedLens includes a fully executable, **35-test automated suite** that runs directly in the browser memory. It validates:
* Medication dosage/frequency extraction & combo-drug handling
* False-positive rejection (ensuring lab units aren't parsed as drugs)
* Reference range math (`<`, `>`, `min-max`)
* Conflict detection logic
* XSS/HTML injection sanitization
* Privacy redaction safety
* FHIR R4 schema validation

*Click the **🧪 Tests (35)** button in the app header to run the suite live.*

---

## 📦 Export & Interoperability
Export the structured clinical record in multiple formats for downstream EHR integration or clinical handover:
* 📋 **Formatted Plain Text** (For quick emails/notes)
* 📄 **Markdown** (For Notion/Obsidian clinical wikis)
* 📊 **Structured JSON** (For custom API integrations)
* 🏥 **FHIR R4 JSON** (HL7 Fast Healthcare Interoperability Resources standard)
* 🖨️ **Print-Optimized PDF** (Clean CSS print stylesheet)

---

## 🚀 How to Run Locally

MedLens requires **zero installation** and **no build steps**. 

1. Clone the repository:
   ```bash
   git clone https://github.com/gnanskandha/medlens-engine.git
   cd medlens-engine
