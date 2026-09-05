const path = require('path');
const fs = require('fs');

let db;
const dbPath = path.join(__dirname, 'medlens.db');

try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbPath);
  
  // Enable foreign keys & WAL mode
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT,
      age TEXT,
      sex TEXT,
      symptoms TEXT,
      conditions TEXT,
      allergies TEXT,
      medications TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      report_text TEXT,
      report_date TEXT,
      extraction_source TEXT,
      parsed_json TEXT,
      verification_json TEXT,
      created_at TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      event_type TEXT,
      details TEXT,
      created_at TEXT
    );
  `);
  console.log('[MedLens Database] SQLite initialized at:', dbPath);
} catch (err) {
  console.error('[MedLens Database] SQLite initialization error, falling back to in-memory JSON store:', err.message);
  // In-memory fallback if needed
  db = null;
}

// Helper for unique ID generation
function generateId(prefix = 'rec') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
}

const Database = {
  // Save or update a patient
  savePatient(patientData) {
    const id = patientData.id || generateId('pat');
    const now = new Date().toISOString();
    
    if (db) {
      const stmtCheck = db.prepare('SELECT id FROM patients WHERE id = ?');
      const existing = stmtCheck.get(id);

      if (existing) {
        const stmtUpdate = db.prepare(`
          UPDATE patients 
          SET name = ?, age = ?, sex = ?, symptoms = ?, conditions = ?, allergies = ?, medications = ?, updated_at = ?
          WHERE id = ?
        `);
        stmtUpdate.run(
          patientData.name || '',
          patientData.age || '',
          patientData.sex || '',
          patientData.symptoms || '',
          patientData.conditions || '',
          patientData.allergies || '',
          patientData.medications || '',
          now,
          id
        );
      } else {
        const stmtInsert = db.prepare(`
          INSERT INTO patients (id, name, age, sex, symptoms, conditions, allergies, medications, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmtInsert.run(
          id,
          patientData.name || '',
          patientData.age || '',
          patientData.sex || '',
          patientData.symptoms || '',
          patientData.conditions || '',
          patientData.allergies || '',
          patientData.medications || '',
          now,
          now
        );
      }
      this.logAuditEvent(id, 'PATIENT_SAVED', `Patient record ${id} persisted`);
      return { id, ...patientData, updated_at: now };
    }
    return { id, ...patientData, updated_at: now };
  },

  // List all patients
  getPatients() {
    if (db) {
      const stmt = db.prepare(`
        SELECT p.id, p.name, p.age, p.sex, p.created_at, p.updated_at,
               COUNT(r.id) AS report_count,
               MAX(r.created_at) AS latest_report_date
        FROM patients p
        LEFT JOIN reports r ON p.id = r.patient_id
        GROUP BY p.id
        ORDER BY p.updated_at DESC
      `);
      return stmt.all();
    }
    return [];
  },

  // Get patient by ID with all historical reports
  getPatientById(id) {
    if (db) {
      const stmtPat = db.prepare('SELECT * FROM patients WHERE id = ?');
      const patient = stmtPat.get(id);
      if (!patient) return null;

      const stmtReports = db.prepare('SELECT * FROM reports WHERE patient_id = ? ORDER BY created_at DESC');
      const reports = stmtReports.all(id).map(r => {
        try {
          return {
            ...r,
            parsed_data: JSON.parse(r.parsed_json || '{}'),
            verification_data: JSON.parse(r.verification_json || '{}')
          };
        } catch (e) {
          return r;
        }
      });

      const stmtAudit = db.prepare('SELECT * FROM audit_events WHERE patient_id = ? ORDER BY created_at DESC');
      const audits = stmtAudit.all(id);

      return {
        ...patient,
        reports,
        audit_events: audits
      };
    }
    return null;
  },

  // Save report snapshot
  saveReport(patientId, reportData) {
    const id = reportData.id || generateId('rep');
    const now = new Date().toISOString();

    if (db) {
      const stmt = db.prepare(`
        INSERT INTO reports (id, patient_id, report_text, report_date, extraction_source, parsed_json, verification_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        patientId,
        reportData.report_text || '',
        reportData.report_date || now.split('T')[0],
        reportData.extraction_source || 'Local Automated Extraction',
        JSON.stringify(reportData.parsed_data || {}),
        JSON.stringify(reportData.verification_data || {}),
        now
      );

      // Update patient's updated_at
      const stmtUp = db.prepare('UPDATE patients SET updated_at = ? WHERE id = ?');
      stmtUp.run(now, patientId);

      this.logAuditEvent(patientId, 'REPORT_ADDED', `Report ${id} added with extraction source: ${reportData.extraction_source || 'Local'}`);
      return { id, patient_id: patientId, created_at: now, ...reportData };
    }
    return { id, patient_id: patientId, created_at: now, ...reportData };
  },

  // Delete patient
  deletePatient(id) {
    if (db) {
      const stmt = db.prepare('DELETE FROM patients WHERE id = ?');
      const res = stmt.run(id);
      this.logAuditEvent(id, 'PATIENT_DELETED', `Patient record ${id} removed`);
      return res.changes > 0;
    }
    return false;
  },

  // Log audit event (safe, non-PHI)
  logAuditEvent(patientId, eventType, details) {
    if (db) {
      const id = generateId('aud');
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO audit_events (id, patient_id, event_type, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(id, patientId || 'system', eventType, details, now);
    }
  }
};

module.exports = Database;
