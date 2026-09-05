require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const Database = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Limit Middlewares
app.use(cors());
// Limit body payload to 10MB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files from current directory
app.use(express.static(path.join(__dirname)));

// --------------------------------------------------------------------------
// AI Provider Client (Non-Diagnostic Structured Extraction)
// --------------------------------------------------------------------------
const AI_CONFIG = {
  geminiKey: process.env.GEMINI_API_KEY || null,
  openaiKey: process.env.OPENAI_API_KEY || null,
  get isAvailable() {
    return Boolean(this.geminiKey || this.openaiKey);
  },
  get provider() {
    if (this.geminiKey) return 'Google Gemini';
    if (this.openaiKey) return 'OpenAI';
    return 'None (Local Deterministic Extraction)';
  }
};

const SYSTEM_EXTRACTION_PROMPT = `
You are MedLens AI, a specialized clinical entity extraction engine.
CRITICAL SAFETY BOUNDARIES:
1. You are strictly an information structuring and organization tool.
2. You MUST NOT diagnose illnesses or conditions.
3. You MUST NOT prescribe treatments, suggest medications, or recommend dosage alterations.
4. You MUST NOT invent, infer, or assume facts not explicitly stated in the source text.
5. You MUST NOT invent laboratory reference ranges. If a reference range is not explicitly documented in the source document for a test, set refRange to "Not provided in source".
6. Extract verbatim source snippets where applicable.

Extract the following JSON structure matching this exact schema:
{
  "patient": {
    "name": string or null,
    "age": string or null,
    "sex": string or null
  },
  "symptoms": [string],
  "conditions": [string],
  "allergies": [
    {
      "name": string,
      "reaction": string,
      "sourceText": string
    }
  ],
  "medications": [
    {
      "name": string,
      "dosage": string,
      "frequency": string,
      "sourceText": string
    }
  ],
  "labResults": [
    {
      "testName": string,
      "value": string,
      "unit": string,
      "refRange": string,
      "sourceText": string
    }
  ],
  "nextSteps": [
    {
      "text": string,
      "sourceText": string
    }
  ]
}
Return ONLY pure JSON without markdown or explanations.
`;

// Helper: Call Google Gemini REST API
function callGemini(apiKey, clinicalText) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_EXTRACTION_PROMPT },
            { text: `CLINICAL SOURCE DOCUMENT:\n"""\n${clinicalText}\n"""\nStructured JSON:` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 25000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const rawContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawContent) return reject(new Error('Empty Gemini response'));
            const structured = JSON.parse(rawContent);
            resolve(structured);
          } catch (e) {
            reject(new Error('Failed to parse Gemini JSON output: ' + e.message));
          }
        } else {
          reject(new Error(`Gemini API returned HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini API request timed out')); });
    req.write(postData);
    req.end();
  });
}

// Helper: Call OpenAI REST API
function callOpenAI(apiKey, clinicalText) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_EXTRACTION_PROMPT },
        { role: 'user', content: `CLINICAL SOURCE DOCUMENT:\n"""\n${clinicalText}\n"""` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 25000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const rawContent = parsed.choices?.[0]?.message?.content;
            if (!rawContent) return reject(new Error('Empty OpenAI response'));
            const structured = JSON.parse(rawContent);
            resolve(structured);
          } catch (e) {
            reject(new Error('Failed to parse OpenAI JSON output: ' + e.message));
          }
        } else {
          reject(new Error(`OpenAI API returned HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI API request timed out')); });
    req.write(postData);
    req.end();
  });
}

// --------------------------------------------------------------------------
// API ROUTES
// --------------------------------------------------------------------------

// Health & System Capability Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'MedLens Clinical Intelligence Backend',
    version: '2.0.0',
    ai_available: AI_CONFIG.isAvailable,
    ai_provider: AI_CONFIG.provider,
    persistent_storage: 'SQLite'
  });
});

// Real AI Extraction Endpoint with Deterministic Fallback Signaling
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, patientProfile } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Valid report text string is required' });
    }

    if (text.length > 500000) {
      return res.status(413).json({ error: 'Report text exceeds maximum allowed size (500KB)' });
    }

    // If AI credentials are not configured, signal client to use local extraction
    if (!AI_CONFIG.isAvailable) {
      return res.json({
        success: false,
        fallback: true,
        mode: 'Local Automated Extraction',
        message: 'No LLM API key configured. Executing client-side deterministic extraction.'
      });
    }

    let rawExtracted;
    if (AI_CONFIG.geminiKey) {
      rawExtracted = await callGemini(AI_CONFIG.geminiKey, text);
    } else if (AI_CONFIG.openaiKey) {
      rawExtracted = await callOpenAI(AI_CONFIG.openaiKey, text);
    }

    // Audit event without PHI
    Database.logAuditEvent('system', 'AI_ANALYSIS_COMPLETED', `Extracted with ${AI_CONFIG.provider}`);

    return res.json({
      success: true,
      mode: 'AI Extracted',
      provider: AI_CONFIG.provider,
      extracted: rawExtracted
    });

  } catch (err) {
    // Log non-PHI error code/type
    console.error('[MedLens AI] Analysis error:', err.message);
    return res.json({
      success: false,
      fallback: true,
      mode: 'Local Automated Extraction',
      message: `AI service error (${err.message}). Using local deterministic extraction fallback.`
    });
  }
});

// Patient CRUD Endpoints
app.get('/api/patients', (req, res) => {
  try {
    const patients = Database.getPatients();
    res.json(patients);
  } catch (err) {
    console.error('[MedLens API] getPatients error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve patients' });
  }
});

app.post('/api/patients', (req, res) => {
  try {
    const patientData = req.body;
    if (!patientData || typeof patientData !== 'object') {
      return res.status(400).json({ error: 'Valid patient object required' });
    }
    const saved = Database.savePatient(patientData);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[MedLens API] savePatient error:', err.message);
    res.status(500).json({ error: 'Failed to save patient' });
  }
});

app.get('/api/patients/:id', (req, res) => {
  try {
    const { id } = req.params;
    const patient = Database.getPatientById(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(patient);
  } catch (err) {
    console.error('[MedLens API] getPatientById error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve patient' });
  }
});

app.post('/api/patients/:id/reports', (req, res) => {
  try {
    const { id } = req.params;
    const reportData = req.body;
    if (!reportData || typeof reportData !== 'object') {
      return res.status(400).json({ error: 'Valid report payload required' });
    }
    const saved = Database.saveReport(id, reportData);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[MedLens API] saveReport error:', err.message);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

app.delete('/api/patients/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = Database.deletePatient(id);
    if (!success) {
      return res.status(404).json({ error: 'Patient not found or already deleted' });
    }
    res.json({ success: true, message: `Patient ${id} deleted` });
  } catch (err) {
    console.error('[MedLens API] deletePatient error:', err.message);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

// Global safe error handler
app.use((err, req, res, next) => {
  console.error('[MedLens Server Error]:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Express Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 MedLens Backend & Review Engine Running`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🤖 AI Status: ${AI_CONFIG.provider}`);
    console.log(`💾 Storage: SQLite (medlens.db)`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;
