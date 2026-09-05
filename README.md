# MedLens — Clinical Intelligence & Record Review Engine

MedLens is a client-side medical record structuring and review tool designed to transform fragmented clinical notes, prescriptions, and diagnostic lab reports into structured, traceable clinical records.

> **Clinical Safety Notice**: MedLens is an information organization and clinical review tool. It does NOT provide medical diagnoses or prescriptive treatment directives.

---

## Key Features

- **100% Offline & Pure Client-Side**: Self-contained single-page architecture (`index.html`) using Vanilla HTML, CSS, and JavaScript. No external network dependencies, APIs, or CDN libraries.
- **Traceable Clinical Entity Extraction**: Extracts medications (dosage, frequency, status), allergies (with reported reactions), diagnostic lab results, and source-document instructions with direct source snippets.
- **Source-Grounded Reference Range Safety**: Evaluates lab values strictly against source-provided reference ranges. If missing, it explicitly marks `"Source Range Not Provided"` rather than hallucinating normal ranges.
- **Human-in-the-Loop Review**: Provides interactive `[Edit]` modals and `[✓ Verify]` status toggles for every parsed entity.
- **Cross-Record Conflict Detection**: Flags contradictions between patient intake declarations and medical documentation (e.g., "NKDA" vs. Sulfa allergy in text; discontinued medication usage).
- **Clarification Questions Engine**: Surfaces 3–5 targeted, non-diagnostic questions highlighting ambiguous dosages, ungrounded lab values, or missing information.
- **Three-Tier Quality Metrics**: Live computation of Record Completeness (%), Extraction Confidence (High/Med/Low), and Verification progress.
- **Privacy Mode**: One-click PHI de-identification (redacting patient names and ages) for HIPAA-safe screen sharing and export.
- **Built-in 25-Test Automated Suite**: In-browser test runner verifying extraction accuracy, boundary conditions, fuzz resilience, and XSS sanitization in < 100 ms.
- **6 Competition Demo Presets**: Instant load presets covering clean cardiology, diabetic abnormalities, allergy conflicts, missing reference ranges, dose escalation, and messy EHR notes.

---

## Getting Started

Simply open `index.html` in any modern web browser:
```bash
# Double click index.html or serve locally:
python -m http.server 8080
# Navigate to:
http://localhost:8080/index.html
```

---

## License
MIT License
