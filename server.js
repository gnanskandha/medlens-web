const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS for local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve frontend static files
app.use(express.static(__dirname));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ai_available: false, ai_provider: 'none' });
});

// Analyze endpoint (safe mock that returns local-fallback signal)
app.post('/api/analyze', (req, res) => {
  // In a real deployment, this would call OpenAI/Claude
  // For hackathon submission, we return success:false so frontend falls back to deterministic regex
  res.json({ success: false, message: 'AI backend configured for external API integration. Using local deterministic extraction.' });
});

// Patient CRUD stubs
const patients = [];
app.post('/api/patients', (req, res) => {
  const p = { id: 'pat_' + Date.now(), ...req.body, created_at: new Date().toISOString() };
  patients.push(p);
  res.json(p);
});
app.get('/api/patients', (req, res) => res.json(patients));
app.get('/api/patients/:id', (req, res) => {
  const p = patients.find(x => x.id === req.params.id);
  p ? res.json(p) : res.status(404).json({ error: 'Not found' });
});
app.delete('/api/patients/:id', (req, res) => {
  const idx = patients.findIndex(x => x.id === req.params.id);
  if (idx >= 0) patients.splice(idx, 1);
  res.json({ deleted: true });
});
app.post('/api/patients/:id/reports', (req, res) => {
  res.json({ id: 'rep_' + Date.now(), ...req.body, created_at: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MedLens backend on http://localhost:${PORT}`));
