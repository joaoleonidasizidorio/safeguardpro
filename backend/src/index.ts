import bcrypt from 'bcrypt';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

dotenv.config();

// Add logic to parse numeric strings from Postgres
import { types } from 'pg';
types.setTypeParser(1700, (val) => parseFloat(val));


const app = express();

const corsOptions = {
  origin: ['http://localhost:6001', 'http://localhost:5173', 'http://127.0.0.1:6001', 'http://localhost', 'http://127.0.0.1'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// GLOBAL REQUEST LOGGER
app.use((req, res, next) => {
  console.log(`[GLOBAL_LOG] ${req.method} ${req.url}`);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Multer Configuration
// Multer Configuration (Default: General Uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // If it's a backup file, send to backups dir
    if (file.fieldname === 'backup_file' && file.originalname.endsWith('.sql')) {
      const backupUploadPath = path.join(__dirname, '../backups');
      if (!fs.existsSync(backupUploadPath)) {
        fs.mkdirSync(backupUploadPath, { recursive: true });
      }
      cb(null, backupUploadPath);
    } else {
      // Default uploads
      const uploadPath = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    }
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'backup_file') {
      // Keep original name or ensure safe name
      // Prefer keeping original for restore identification
      cb(null, file.originalname);
    } else {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }
});
const upload = multer({ storage });

// 14. Subscription API
app.get('/api/subscription', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const ownerId = user?.owner_id || user?.id;

    const subRes = await pool.query(`
            SELECT s.*, p.name as plan_name, p.max_companies, p.max_users, p.max_visits, p.price
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = $1 AND s.status = 'active'
        `, [ownerId]);

    if (subRes.rows.length === 0) {
      return res.json({ hasSubscription: false });
    }

    const sub = subRes.rows[0];

    // Fetch current usage (Scoped to owner)
    const compCount = await pool.query('SELECT COUNT(*) FROM companies WHERE owner_id = $1', [ownerId]);
    const userCount = await pool.query('SELECT COUNT(*) FROM users WHERE owner_id = $1', [ownerId]);
    const visitCount = await pool.query(`
      SELECT COUNT(*) FROM visits 
      WHERE company_id IN (SELECT id FROM companies WHERE owner_id = $1)
        AND date_trunc('month', scheduled_at) = date_trunc('month', CURRENT_DATE)
    `, [ownerId]);

    res.json({
      hasSubscription: true,
      plan: {
        name: sub.plan_name,
        price: sub.price,
        limits: {
          companies: sub.max_companies,
          users: sub.max_users,
          visits: sub.max_visits
        }
      },
      usage: {
        companies: parseInt(compCount.rows[0].count),
        users: parseInt(userCount.rows[0].count),
        visits: parseInt(visitCount.rows[0].count)
      },
      expires_at: sub.expires_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/subscription/upgrade', authenticate, async (req: Request, res: Response) => {
  // Simulate upgrade
  const { plan_name } = req.body; // 'Pro' or 'Enterprise'
  const userId = (req as AuthRequest).user?.id;

  try {
    const planRes = await pool.query("SELECT id FROM plans WHERE name = $1", [plan_name]);
    if (planRes.rows.length === 0) return res.status(400).json({ error: 'Invalid plan' });

    const planId = planRes.rows[0].id;

    // Upsert subscription
    const checkSub = await pool.query("SELECT * FROM subscriptions WHERE user_id = $1", [userId]);
    if (checkSub.rows.length > 0) {
      await pool.query("UPDATE subscriptions SET plan_id = $1 WHERE user_id = $2", [planId, userId]);
    } else {
      await pool.query("INSERT INTO subscriptions (user_id, plan_id) VALUES ($1, $2)", [userId, planId]);
    }

    res.json({ success: true, message: `Upgraded to ${plan_name}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ======================================
// INVOICE HISTORY ROUTES
// ======================================

// List Invoices for current user
app.get('/api/invoices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;

    const result = await pool.query(
      `SELECT id, plan_name, amount, status, payment_method, due_date, paid_at, created_at
       FROM invoices
       WHERE owner_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [ownerId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ error: 'Erro ao buscar faturas' });
  }
});

// Generate Invoice PDF
app.get('/api/invoices/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const invoiceId = req.params.id;

    const result = await pool.query(
      `SELECT i.*, u.name as user_name, u.email as user_email
       FROM invoices i
       JOIN users u ON i.owner_id = u.id
       WHERE i.id = $1 AND i.owner_id = $2`,
      [invoiceId, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    const invoice = result.rows[0];

    // Generate PDF - Single Page (compact layout)
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=fatura-${invoiceId}.pdf`);

    doc.pipe(res);

    const pageWidth = doc.page.width - 80; // 40px margins on each side

    // ============ HEADER ============
    doc.fontSize(22).fillColor('#10B981').text('SafeGuardPro', 40, 40);
    doc.fontSize(9).fillColor('#666').text('Sistema de Gestão de SST', 40, 62);

    // Invoice badge on the right
    doc.fontSize(18).fillColor('#1f2937').text('FATURA', 400, 40, { align: 'right' });
    doc.fontSize(10).fillColor('#666').text(`#${invoice.id.toString().padStart(6, '0')}`, 400, 60, { align: 'right' });

    // Divider line
    doc.moveTo(40, 82).lineTo(555, 82).strokeColor('#e5e7eb').lineWidth(1).stroke();

    // ============ INVOICE INFO ============
    let yPos = 95;

    // Left column - Invoice details
    doc.fontSize(9).fillColor('#9ca3af').text('DATA DE EMISSÃO', 40, yPos);
    doc.fontSize(10).fillColor('#1f2937').text(new Date(invoice.created_at).toLocaleDateString('pt-BR'), 40, yPos + 12);

    doc.fontSize(9).fillColor('#9ca3af').text('STATUS', 180, yPos);
    const statusColor = invoice.status === 'paid' ? '#16a34a' : invoice.status === 'pending' ? '#ca8a04' : '#dc2626';
    const statusText = invoice.status === 'paid' ? 'PAGO' : invoice.status === 'pending' ? 'PENDENTE' : 'CANCELADO';
    doc.fontSize(10).fillColor(statusColor).text(statusText, 180, yPos + 12);

    doc.fontSize(9).fillColor('#9ca3af').text('MÉTODO', 320, yPos);
    const methodText = invoice.payment_method === 'pix' ? 'Pix' : invoice.payment_method === 'credit_card' ? 'Cartão de Crédito' : 'N/A';
    doc.fontSize(10).fillColor('#1f2937').text(methodText, 320, yPos + 12);

    // ============ CUSTOMER INFO ============
    yPos = 140;
    doc.rect(40, yPos, pageWidth, 55).fill('#f9fafb');

    doc.fontSize(9).fillColor('#6b7280').text('CLIENTE', 55, yPos + 10);
    doc.fontSize(12).fillColor('#111827').text(invoice.user_name, 55, yPos + 24);
    doc.fontSize(10).fillColor('#6b7280').text(invoice.user_email, 55, yPos + 38);

    // ============ PLAN DETAILS TABLE ============
    yPos = 210;

    // Table header
    doc.rect(40, yPos, pageWidth, 28).fill('#f3f4f6');
    doc.fontSize(9).fillColor('#6b7280');
    doc.text('DESCRIÇÃO', 55, yPos + 9);
    doc.text('PERÍODO', 280, yPos + 9);
    doc.text('VALOR', 470, yPos + 9, { align: 'right', width: 60 });

    // Table row
    yPos += 28;
    doc.rect(40, yPos, pageWidth, 32).stroke('#e5e7eb');
    doc.fontSize(11).fillColor('#111827').text(`Plano ${invoice.plan_name}`, 55, yPos + 10);
    doc.fontSize(10).fillColor('#6b7280').text('Assinatura Mensal', 280, yPos + 10);
    doc.fontSize(11).fillColor('#111827').text(`R$ ${parseFloat(invoice.amount).toFixed(2).replace('.', ',')}`, 470, yPos + 10, { align: 'right', width: 60 });

    // ============ TOTAL BOX ============
    yPos = 290;
    doc.rect(360, yPos, 175, 45).fill('#ecfdf5');
    doc.fontSize(10).fillColor('#065f46').text('VALOR TOTAL', 375, yPos + 8);
    doc.fontSize(18).fillColor('#047857').text(`R$ ${parseFloat(invoice.amount).toFixed(2).replace('.', ',')}`, 375, yPos + 22);

    // ============ PAYMENT INFO ============
    if (invoice.paid_at) {
      doc.fontSize(9).fillColor('#16a34a').text(`✓ Pagamento confirmado em ${new Date(invoice.paid_at).toLocaleDateString('pt-BR')}`, 40, yPos + 10);
    }

    // ============ FOOTER ============
    doc.fontSize(8).fillColor('#9ca3af').text(
      'SafeGuardPro SST - Sistema de Gestão de Segurança do Trabalho',
      40,
      380,
      { align: 'center', width: pageWidth }
    );
    doc.fontSize(7).fillColor('#d1d5db').text(
      'Este documento foi gerado eletronicamente e não requer assinatura.',
      40,
      392,
      { align: 'center', width: pageWidth }
    );

    doc.end();
  } catch (err) {
    console.error('Error generating invoice PDF:', err);
    res.status(500).json({ error: 'Erro ao gerar PDF da fatura' });
  }
});

const PORT = process.env.PORT || 7000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Types for Requests
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    owner_id?: string;
    company_id?: string;
  };
}

// ======================================
// SECURITY & AUDIT MIDDLEWARE
// ======================================

// Audit logging function
async function logAction(
  userId: string | undefined,
  userRole: string | undefined,
  action: string,
  resourceType: string | null = null,
  resourceId: string | null = null,
  details: any = null,
  ipAddress: string | null = null
) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_role, action, resource_type, resource_id, details, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId || null, userRole || null, action, resourceType, resourceId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (error) {
    console.error('Error logging action:', error);
  }
}

// Simple authentication middleware (checks for Authorization header)
function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | null = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === 'string' && req.query.token !== 'null') {
    // Support token in query param for PDF generation (window.open)
    token = req.query.token;
  }

  if (!token) {
    console.log('Auth failed: Missing Token');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // const token = authHeader.substring(7); // Already got it
    console.log('Auth Token Received:', token); // Log the exact token!

    const parts = token.split(':');
    console.log('Token parts count:', parts.length);

    // Defensive check
    if (parts.length < 4) {
      console.log('Token parts insufficient:', parts.length);
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const [id, role, email, name, owner_id, company_id] = parts.map(p => p.trim());

    if (!id || !role || !email) {
      console.log('Missing critical token fields', { id, role, email });
      return res.status(401).json({ error: 'Invalid token format' });
    }

    req.user = {
      id,
      role,
      email,
      name: decodeURIComponent(name || email),
      owner_id: owner_id && owner_id !== 'null' ? owner_id : undefined,
      company_id: company_id && company_id !== 'null' ? company_id : undefined
    };

    // console.log('User Authenticated:', req.user.email); // Reduced noise
    next();
  } catch (error) {
    console.log('Authentication error (catch):', error);
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

// Authorization middleware - checks if user has required role
function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logAction(req.user.id, req.user.role, 'UNAUTHORIZED_ACCESS_ATTEMPT', null, null, {
        requiredRoles: allowedRoles,
        attemptedEndpoint: req.path
      }, req.ip);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// ... Previous interfaces ...
// [OMITTED FOR BREVITY - Keeping original interfaces]

// ======================================
// USER PROFILE ROUTES
// ======================================

// Get Profile
app.get('/api/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const result = await pool.query('SELECT id, name, email, role, job_role, avatar_url, notif_expiration, notif_weekly_report, cpf, signature_url FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update Profile (with Signature)
app.put('/api/profile', authenticate, upload.single('signature'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not found' });

    const { name, job_role, email, cpf, notif_expiration, notif_weekly_report } = req.body;
    let signatureUrl = undefined;

    if (req.file) {
      signatureUrl = `/uploads/${req.file.filename}`;
    }

    // Build Query dynamically
    const fields = [];
    const values = [];
    let idx = 1;

    if (name) { fields.push(`name = $${idx++}`); values.push(name); }
    if (job_role) { fields.push(`job_role = $${idx++}`); values.push(job_role); }
    if (email) { fields.push(`email = $${idx++}`); values.push(email); }
    if (cpf) { fields.push(`cpf = $${idx++}`); values.push(cpf); }
    if (notif_expiration) { fields.push(`notif_expiration = $${idx++}`); values.push(notif_expiration === 'true'); }
    if (notif_weekly_report) { fields.push(`notif_weekly_report = $${idx++}`); values.push(notif_weekly_report === 'true'); }
    if (signatureUrl) { fields.push(`signature_url = $${idx++}`); values.push(signatureUrl); }

    if (fields.length === 0) return res.json({ message: 'No changes' });

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update Avatar
app.post('/api/profile/avatar', authenticate, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId || !req.file) return res.status(400).json({ error: 'File required' });

    const avatarUrl = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);

    res.json({ url: avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Change Password
app.put('/api/profile/password', authenticate, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user?.id;

  try {
    const user = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    // Note: In production use bcrypt.compare
    if (user.rows[0].password !== currentPassword) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ======================================
// DB MIGRATION & SEEDING (ON STARTUP)
// ======================================
async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');

    // 1. Audit Logs
    await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50),
                user_role VARCHAR(20),
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(50),
                resource_id VARCHAR(50),
                details JSONB,
                ip_address VARCHAR(45),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

    // 2. Backups (Metadata)
    await client.query(`
            CREATE TABLE IF NOT EXISTS system_backups (
                id SERIAL PRIMARY KEY,
                file_path TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'success', -- success, failed
                backup_type VARCHAR(20) DEFAULT 'manual' -- manual, auto
            );
        `);

    // 3. LGPD Consents
    await client.query(`
            CREATE TABLE IF NOT EXISTS lgpd_consents (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50),
                action_type VARCHAR(50),
                details JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

    // *** CORE TABLES (companies, sectors, employees, risks, incidents) ***
    // These must be created FIRST as many other tables reference them.

    // Companies
    await client.query(`
        CREATE TABLE IF NOT EXISTS companies (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            contact VARCHAR(100),
            email VARCHAR(100),
            password VARCHAR(255),
            status VARCHAR(20) DEFAULT 'Ativa',
            initials VARCHAR(10),
            cnae VARCHAR(10),
            risk_level VARCHAR(10),
            legal_representative VARCHAR(100),
            owner_id VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Units
    await client.query(`
        CREATE TABLE IF NOT EXISTS units (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            address TEXT,
            unit_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Sectors
    await client.query(`
        CREATE TABLE IF NOT EXISTS sectors (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
            unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
            name VARCHAR(100) NOT NULL
        );
    `);

    // Employees
    await client.query(`
        CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            role VARCHAR(100),
            admission_date DATE,
            cpf VARCHAR(20),
            rg VARCHAR(20),
            birth_date DATE,
            sector_id INTEGER REFERENCES sectors(id),
            job_role TEXT,
            status VARCHAR(20) DEFAULT 'Ativo',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Risks
    await client.query(`
        CREATE TABLE IF NOT EXISTS risks (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
            sector_id INTEGER REFERENCES sectors(id),
            risk_type VARCHAR(50),
            description TEXT,
            source TEXT,
            probability VARCHAR(20),
            severity VARCHAR(20),
            risk_level VARCHAR(20),
            status VARCHAR(20) DEFAULT 'Ativo',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Incidents
    await client.query(`
        CREATE TABLE IF NOT EXISTS incidents (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
            employee_id INTEGER REFERENCES employees(id),
            incident_type VARCHAR(50),
            date DATE,
            location TEXT,
            description TEXT,
            severity VARCHAR(20),
            status VARCHAR(20) DEFAULT 'Aberto',
            generating_source TEXT,
            body_part TEXT,
            injured_person_report TEXT,
            witness_report TEXT,
            possible_causes TEXT,
            conclusion TEXT,
            investigation_result TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // White Label Settings
    await client.query(`
        CREATE TABLE IF NOT EXISTS white_label_settings (
            id SERIAL PRIMARY KEY,
            owner_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
            brand_name VARCHAR(100),
            logo_url TEXT,
            primary_color VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_id)
        );
    `);

    // Column migrations moved to User Management section (Step 6)

    // Visits
    await client.query(`
        CREATE TABLE IF NOT EXISTS visits (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
            sector_id INTEGER REFERENCES sectors(id),
            visit_type VARCHAR(100),
            scheduled_at TIMESTAMP,
            report_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Inspections
    await client.query(`
        CREATE TABLE IF NOT EXISTS inspections (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
            sector_id INTEGER REFERENCES sectors(id),
            template_id INTEGER REFERENCES checklist_templates(id),
            auditor_id VARCHAR(50) REFERENCES users(id),
            date DATE,
            status VARCHAR(20) DEFAULT 'Pendente',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Inspection Answers
    await client.query(`
        CREATE TABLE IF NOT EXISTS inspection_answers (
            id SERIAL PRIMARY KEY,
            inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,
            question_id INTEGER REFERENCES checklist_items(id),
            answer VARCHAR(20), -- Conforme, Não Conforme, N/A
            observation TEXT,
            photo_url TEXT
        );
    `);

    // Action Plans
    await client.query(`
        CREATE TABLE IF NOT EXISTS action_plans (
            id SERIAL PRIMARY KEY,
            risk_id INTEGER REFERENCES risks(id) ON DELETE CASCADE,
            incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
            inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            responsible VARCHAR(100),
            deadline DATE,
            status VARCHAR(20) DEFAULT 'Pendente',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Invoices
    await client.query(`
        CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            owner_id VARCHAR(50) REFERENCES users(id),
            amount DECIMAL(10, 2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            payment_method VARCHAR(20),
            paid_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 4. Incident Reports (Offline Support)
    await client.query(`
        CREATE TABLE IF NOT EXISTS incident_reports(
      id SERIAL PRIMARY KEY,
      company_id VARCHAR(50) NOT NULL,
      type VARCHAR(50), --Acidente, Incidente, Perigo
            description TEXT,
      location TEXT,
      photos TEXT[], --URLs
            severity VARCHAR(20), --Baixa, Média, Alta
            status VARCHAR(20) DEFAULT 'Pendente', --Pendente, Em Análise, Concluído
            reported_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      offline_sync_id VARCHAR(100)-- ID generated on client for syncing
        );
    `);

    // 5. Legal Documents (Compliance)
    await client.query(`
        CREATE TABLE IF NOT EXISTS legal_documents(
      id SERIAL PRIMARY KEY,
      company_id VARCHAR(50) NOT NULL,
      title VARCHAR(100) NOT NULL,
      type VARCHAR(50),
      file_url TEXT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      valid_until DATE,
      status VARCHAR(20) DEFAULT 'Vigente',
      owner_id VARCHAR(50)-- NEW: Multi - tenancy
    );
    `);

    // 5.1 Notifications System
    await client.query(`
        CREATE TABLE IF NOT EXISTS notifications(
      id SERIAL PRIMARY KEY,
      company_id VARCHAR(50),
      type VARCHAR(20), -- 'email', 'whatsapp'
            category VARCHAR(20), -- 'training', 'epi', 'visit', 'action_plan'
            recipient VARCHAR(100),
      subject TEXT,
      content TEXT,
      status VARCHAR(20), -- 'sent', 'simulated', 'failed'
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `);

    // Column migrations for Incident Investigation (safe - table now exists)
    await client.query(`
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS generating_source TEXT;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS body_part TEXT;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS injured_person_report TEXT;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS witness_report TEXT;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS possible_causes TEXT;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS conclusion TEXT;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS investigation_result TEXT;
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS users(
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'technician',
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          owner_id VARCHAR(50),
          company_id VARCHAR(50),
          job_role TEXT,
          avatar_url TEXT,
          notif_expiration BOOLEAN DEFAULT TRUE,
          notif_weekly_report BOOLEAN DEFAULT FALSE
        );
    `);

    // Ensure columns exist (for existing tables)
    await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS job_role TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_expiration BOOLEAN DEFAULT TRUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_weekly_report BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url TEXT;

        -- Ensure employees columns exist
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS rg VARCHAR(20);
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES sectors(id);
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_role TEXT;

        -- Ensure sectors has unit_id
        ALTER TABLE sectors ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL;
    `);

    // Seed Master User (if not exists)
    const adminCheck = await client.query("SELECT * FROM users WHERE role = 'admin'");
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        "INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)",
        ['admin-001', 'Administrador', 'admin@safeguardpro.com', hashedPassword, 'admin']
      );
      console.log('Master admin user created.');
    } else {
      // Upgrade existing plaintext password if needed (checking if password matches plain 'admin123')
      // Ideally we would do a more robust check, but for this task just ensure master user is secure
      const user = adminCheck.rows[0];
      if (user.password === 'admin123') {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await client.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, user.id]);
        console.log('Upgraded admin password to hash.');
      }
    }

    // Seed new Master User for Leonidas (if not exists)
    const leoCheck = await client.query("SELECT * FROM users WHERE email = 'leonidas.joao@gmail.com'");
    if (leoCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin@123', 10);
      await client.query(
        "INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)",
        ['master-001', 'Leonidas Joao', 'leonidas.joao@gmail.com', hashedPassword, 'admin']
      );
      console.log('Leonidas admin user created.');
    } else {
      // Optional: Update signature or other fields without resetting password
      const signatureUrl = '/uploads/signatures/sig-1767385156638-assinatura.png';
      await client.query("UPDATE users SET signature_url = $1 WHERE id = $2", [signatureUrl, 'master-001']);
    }

    // 7. Checklists (Templates & Items)
    await client.query(`
        CREATE TABLE IF NOT EXISTS checklist_templates(
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      owner_id VARCHAR(50)-- NEW: Multi - tenancy(null for system templates)
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS checklist_items(
      id SERIAL PRIMARY KEY,
      template_id INTEGER REFERENCES checklist_templates(id),
      category VARCHAR(50),
      question TEXT NOT NULL
    );
    `);

    // Seed NR Templates
    const nr35Check = await client.query("SELECT * FROM checklist_templates WHERE name = 'NR-35: Trabalho em Altura'");
    if (nr35Check.rows.length === 0) {
      const t = await client.query("INSERT INTO checklist_templates (name, description) VALUES ($1, $2) RETURNING id", ['NR-35: Trabalho em Altura', 'Checklist para trabalhos realizados acima de 2 metros.']);
      const tid = t.rows[0].id;

      const items = [
        ['EPIs', 'Os trabalhadores possuem cinturão de segurança tipo paraquedista?'],
        ['EPIs', 'O talabarte possui absorvedor de energia?'],
        ['Ancoragem', 'Os pontos de ancoragem foram inspecionados?'],
        ['Ancoragem', 'A linha de vida está dimensionada corretamente?'],
        ['Documentação', 'A Permissão de Trabalho (PT) foi emitida?'],
        ['Documentação', 'A Análise de Risco (AR) foi realizada?'],
        ['Treinamento', 'Os trabalhadores possuem treinamento válido (8h)?']
      ];

      for (const item of items) {
        await client.query("INSERT INTO checklist_items (template_id, category, question) VALUES ($1, $2, $3)", [tid, item[0], item[1]]);
      }
      console.log('Seeded NR-35 Template.');
    }

    const nr10Check = await client.query("SELECT * FROM checklist_templates WHERE name = 'NR-10: Instalações Elétricas'");
    if (nr10Check.rows.length === 0) {
      const t = await client.query("INSERT INTO checklist_templates (name, description) VALUES ($1, $2) RETURNING id", ['NR-10: Instalações Elétricas', 'Checklist para segurança em instalações e serviços em eletricidade.']);
      const tid = t.rows[0].id;

      const items = [
        ['Bloqueio e Etiquetagem', 'O sistema LOTO (Lockout/Tagout) foi aplicado?'],
        ['Bloqueio e Etiquetagem', 'Existe impedimento de reenergização?'],
        ['EPIs', 'Vestimentas Classe 2 (antichama) estão sendo usadas?'],
        ['EPIs', 'Luvas isolantes estão dentro da validade de teste elétrico?'],
        ['Ferramentas', 'As ferramentas manuais são isoladas (1000V)?'],
        ['Sinalização', 'A área está sinalizada e isolada?'],
        ['Prontuário', 'O Prontuário das Instalações Elétricas (PIE) está atualizado?']
      ];

      for (const item of items) {
        await client.query("INSERT INTO checklist_items (template_id, category, question) VALUES ($1, $2, $3)", [tid, item[0], item[1]]);
      }
      console.log('Seeded NR-10 Template.');
    }

    // NR-01: GRO/PGR
    const nr01Check = await client.query("SELECT * FROM checklist_templates WHERE name = 'NR-01: Disposições Gerais e GRO'");
    if (nr01Check.rows.length === 0) {
      const t = await client.query("INSERT INTO checklist_templates (name, description) VALUES ($1, $2) RETURNING id", ['NR-01: Disposições Gerais e GRO', 'Gerenciamento de Riscos Ocupacionais e Programa de Gerenciamento de Riscos.']);
      const tid = t.rows[0].id;
      const items = [
        ['Inventário de Riscos', 'O Inventário de Riscos Ocupacionais está atualizado?'],
        ['Inventário de Riscos', 'Os riscos foram classificados por severidade e probabilidade?'],
        ['Plano de Ação', 'Existe um cronograma de implementação de medidas de prevenção?'],
        ['Treinamento', 'Os trabalhadores receberam ordens de serviço sobre riscos ocupacionais?']
      ];
      for (const item of items) { await client.query("INSERT INTO checklist_items (template_id, category, question) VALUES ($1, $2, $3)", [tid, item[0], item[1]]); }
      console.log('Seeded NR-01 Template.');
    }

    // NR-06: EPI
    const nr06Check = await client.query("SELECT * FROM checklist_templates WHERE name = 'NR-06: Equipamento de Proteção Individual'");
    if (nr06Check.rows.length === 0) {
      const t = await client.query("INSERT INTO checklist_templates (name, description) VALUES ($1, $2) RETURNING id", ['NR-06: Equipamento de Proteção Individual', 'Checklist para seleção, fornecimento e uso de EPIs.']);
      const tid = t.rows[0].id;
      const items = [
        ['CA', 'Os EPIs possuem Certificado de Aprovação (CA) válido?'],
        ['Ficha de Entrega', 'Existem registros/fichas de entrega e treinamentos de uso?'],
        ['Uso Correto', 'Os trabalhadores utilizam os EPIs de forma adequada durante a jornada?'],
        ['Conservação', 'Os EPIs são higienizados e armazenados corretamente?']
      ];
      for (const item of items) { await client.query("INSERT INTO checklist_items (template_id, category, question) VALUES ($1, $2, $3)", [tid, item[0], item[1]]); }
      console.log('Seeded NR-06 Template.');
    }

    // NR-12: Máquinas e Equipamentos
    const nr12Check = await client.query("SELECT * FROM checklist_templates WHERE name = 'NR-12: Segurança em Máquinas'");
    if (nr12Check.rows.length === 0) {
      const t = await client.query("INSERT INTO checklist_templates (name, description) VALUES ($1, $2) RETURNING id", ['NR-12: Segurança em Máquinas', 'Segurança no trabalho em máquinas e equipamentos.']);
      const tid = t.rows[0].id;
      const items = [
        ['Proteções', 'As zonas de perigo possuem proteções fixas ou móveis com intertravamento?'],
        ['Parada de Emergência', 'Os dispositivos de parada de emergência estão acessíveis e funcionais?'],
        ['Manual', 'A máquina possui manuais de instrução em português?'],
        ['Inventário', 'Existe inventário atualizado das máquinas no estabelecimento?']
      ];
      for (const item of items) { await client.query("INSERT INTO checklist_items (template_id, category, question) VALUES ($1, $2, $3)", [tid, item[0], item[1]]); }
      console.log('Seeded NR-12 Template.');
    }

    // NR-17: Ergonomia
    const nr17Check = await client.query("SELECT * FROM checklist_templates WHERE name = 'NR-17: Ergonomia'");
    if (nr17Check.rows.length === 0) {
      const t = await client.query("INSERT INTO checklist_templates (name, description) VALUES ($1, $2) RETURNING id", ['NR-17: Ergonomia', 'Avaliação ergonômica preliminar das situações de trabalho.']);
      const tid = t.rows[0].id;
      const items = [
        ['Mobiliário', 'As superfícies de trabalho possuem altura ajustável e bordas arredondadas?'],
        ['Assentos', 'As cadeiras possuem ajuste de altura e encosto com apoio lombar?'],
        ['Levantamento de Cargas', 'Existe auxílio mecânico para levantamento de cargas críticas?'],
        ['Organização do Trabalho', 'O ritmo de trabalho permite pausas de descanso adequadas?']
      ];
      for (const item of items) { await client.query("INSERT INTO checklist_items (template_id, category, question) VALUES ($1, $2, $3)", [tid, item[0], item[1]]); }
      console.log('Seeded NR-17 Template.');
    }

    // 8. SaaS Plans & Subscriptions
    await client.query(`
        CREATE TABLE IF NOT EXISTS plans(
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL, --Free, Pro, Enterprise
            max_companies INTEGER NOT NULL,
      max_users INTEGER NOT NULL,
      max_visits INTEGER NOT NULL, -- - 1 for unlimited
            price DECIMAL(10, 2) NOT NULL
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS subscriptions(
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL REFERENCES users(id),
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      status VARCHAR(20) DEFAULT 'active', --active, inactive, cancelled
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );
    `);

    // Seed Plans
    const plansCheck = await client.query("SELECT * FROM plans");
    if (plansCheck.rows.length === 0) {
      await client.query("INSERT INTO plans (name, max_companies, max_users, max_visits, price) VALUES ($1, $2, $3, $4, $5)", ['Free', 1, 1, 5, 0.00]);
      await client.query("INSERT INTO plans (name, max_companies, max_users, max_visits, price) VALUES ($1, $2, $3, $4, $5)", ['Pro', 10, 5, -1, 99.90]);
      await client.query("INSERT INTO plans (name, max_companies, max_users, max_visits, price) VALUES ($1, $2, $3, $4, $5)", ['Enterprise', -1, -1, -1, 499.00]);
      console.log('Seeded SaaS Plans.');
    }

    // Assign Enterprise Plan to Default Admins ('admin-001', 'master-001')
    const admins = ['admin-001', 'master-001'];
    const enterprisePlan = await client.query("SELECT id FROM plans WHERE name = 'Enterprise'");
    if (enterprisePlan.rows.length > 0) {
      const planId = enterprisePlan.rows[0].id;
      for (const adminId of admins) {
        const sub = await client.query("SELECT * FROM subscriptions WHERE user_id = $1", [adminId]);
        if (sub.rows.length === 0) {
          await client.query("INSERT INTO subscriptions (user_id, plan_id) VALUES ($1, $2)", [adminId, planId]);
          console.log(`Assigned Enterprise plan to admin ${adminId} `);
        }
      }
    }

    // 9. Add owner_id to existing companies if missing
    await client.query(`
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_id VARCHAR(50);
    `);

    // 10. Financial Module (Phase 2)
    await client.query(`
        CREATE TABLE IF NOT EXISTS payments(
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL REFERENCES users(id),
            plan_id INTEGER REFERENCES plans(id),
            amount DECIMAL(10, 2) NOT NULL,
            method VARCHAR(20) NOT NULL, -- credit_card, pix
            status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed
            transaction_id VARCHAR(100), -- Stub for external ID
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Assign existing data to master-001
    await client.query("UPDATE companies SET owner_id = 'master-001' WHERE owner_id IS NULL");
    // await client.query("UPDATE checklist_templates SET owner_id = 'master-001' WHERE owner_id IS NULL");
    await client.query("UPDATE legal_documents SET owner_id = 'master-001' WHERE owner_id IS NULL");

    // 11. Trainings & Certificates Module
    await client.query(`
        CREATE TABLE IF NOT EXISTS certificate_templates (
            id SERIAL PRIMARY KEY,
            owner_id VARCHAR(50),
            name VARCHAR(100),
            image_url TEXT,
            body_text TEXT,
            verso_text TEXT
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS standard_texts (
            id SERIAL PRIMARY KEY,
            owner_id VARCHAR(50),
            title VARCHAR(100),
            content TEXT
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trainings (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) NOT NULL,
            course_name VARCHAR(100) NOT NULL,
            training_date DATE,
            validity_date DATE,
            status VARCHAR(20),
            certificate_url TEXT,
            template_id INTEGER
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trainings_employees (
            training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
            employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
            PRIMARY KEY (training_id, employee_id)
        );
    `);

    // 12. ASO Module
    await client.query(`
        CREATE TABLE IF NOT EXISTS exam_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            is_complementary BOOLEAN DEFAULT FALSE,
            owner_id VARCHAR(50)
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS asos (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) NOT NULL,
            employee_id INTEGER NOT NULL REFERENCES employees(id),
            type VARCHAR(20) NOT NULL,
            exam_date DATE NOT NULL,
            issue_date DATE NOT NULL,
            valid_until DATE,
            doctor_name VARCHAR(100),
            doctor_crm VARCHAR(50),
            doctor_uf VARCHAR(2),
            clinic_name VARCHAR(100),
            aptitude_status VARCHAR(20) NOT NULL,
            aptitude_obs TEXT,
            status VARCHAR(20) DEFAULT 'Válido',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            owner_id VARCHAR(50)
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS aso_exams (
            id SERIAL PRIMARY KEY,
            aso_id INTEGER REFERENCES asos(id) ON DELETE CASCADE,
            exam_type_id INTEGER REFERENCES exam_types(id),
            exam_date DATE,
            result VARCHAR(50),
            obs TEXT
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS aso_risks (
            id SERIAL PRIMARY KEY,
            aso_id INTEGER REFERENCES asos(id) ON DELETE CASCADE,
            risk_id INTEGER REFERENCES risks(id),
            risk_description TEXT
        );
    `);

    // EPIs and Deliveries
    await client.query(`
        CREATE TABLE IF NOT EXISTS epis (
            id SERIAL PRIMARY KEY,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            ca_number VARCHAR(50),
            manufacturer VARCHAR(100),
            validity_days INTEGER,
            stock_quantity INTEGER DEFAULT 0,
            min_stock INTEGER DEFAULT 0,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS epi_deliveries (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
            epi_id INTEGER REFERENCES epis(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 1,
            delivery_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            next_exchange_date TIMESTAMP,
            validity_date TIMESTAMP,
            reason TEXT,
            technician_signature TEXT, -- Base64
            employee_signature TEXT, -- Base64
            status VARCHAR(20) DEFAULT 'Entregue',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Fix: Restore public access to NR templates that were hijacked by master-001
    // Being very aggressive here to ensure visibility
    await client.query("UPDATE checklist_templates SET owner_id = NULL WHERE (name ILIKE 'NR%' OR name ILIKE 'NR-%' OR name ILIKE 'NR %') AND (owner_id IS NOT NULL)");

    // Also log how many templates we have total for debugging
    const countRes = await client.query("SELECT COUNT(*) FROM checklist_templates");
    const publicCountRes = await client.query("SELECT COUNT(*) FROM checklist_templates WHERE owner_id IS NULL");
    console.log(`[DEBUG] Database check: Total templates: ${countRes.rows[0].count}, Public (NULL owner): ${publicCountRes.rows[0].count}`);

    console.log('Migrations and seeding completed.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
  }
}

runMigrations();

// ======================================
// FINANCIAL MODULE ROUTES
// ======================================

// Dashboard Stats (Admin Only)
app.get('/api/financial/dashboard', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  // Only Master Admin access? Or all admins? 
  // Assuming Master Admin "leonidas.joao@gmail.com" or specific role. For now, all admins.
  try {
    const revenueRes = await pool.query("SELECT SUM(amount) as total FROM payments WHERE status = 'paid'");
    const pendingRes = await pool.query("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'");
    const activeSubsRes = await pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'");

    // Recent Transactions
    const transactionsRes = await pool.query(`
            SELECT p.*, u.name as user_name, pl.name as plan_name 
            FROM payments p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN plans pl ON p.plan_id = pl.id
            ORDER BY p.created_at DESC
            LIMIT 10
        `);

    // Monthly Revenue (Mocked for existing data, real for new)
    const monthlyRes = await pool.query(`
            SELECT to_char(created_at, 'YYYY-MM') as month, SUM(amount) as total
            FROM payments
            WHERE status = 'paid'
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 6
        `);

    res.json({
      totalRevenue: parseFloat(revenueRes.rows[0].total || '0'),
      pendingPayments: parseInt(pendingRes.rows[0].count),
      activeSubscriptions: parseInt(activeSubsRes.rows[0].count),
      transactions: transactionsRes.rows,
      monthlyRevenue: monthlyRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Checkout Simulation
app.post('/api/financial/checkout', authenticate, async (req: Request, res: Response) => {
  const { plan_id, method } = req.body; // method: 'credit_card' | 'pix'
  const userId = (req as AuthRequest).user?.id;

  if (!userId) return res.status(401).json({ error: 'User required' });

  try {
    const planRes = await pool.query("SELECT * FROM plans WHERE id = $1", [plan_id]);
    if (planRes.rows.length === 0) return res.status(400).json({ error: 'Invalid Plan' });
    const plan = planRes.rows[0];

    // 1. Create Payment Record
    // Simulate transaction ID
    const transactionId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const status = method === 'credit_card' ? 'paid' : 'pending'; // Auto-approve card for demo

    const paymentRes = await pool.query(
      "INSERT INTO payments (user_id, plan_id, amount, method, status, transaction_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, plan_id, plan.price, method, status, transactionId]
    );

    // 2. If Paid, Update Subscription immediately
    if (status === 'paid') {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days default

      // Check existing sub
      const subCheck = await pool.query("SELECT * FROM subscriptions WHERE user_id = $1", [userId]);
      if (subCheck.rows.length > 0) {
        await pool.query("UPDATE subscriptions SET plan_id = $1, status = 'active', expires_at = $2 WHERE user_id = $3", [plan_id, expiresAt, userId]);
      } else {
        await pool.query("INSERT INTO subscriptions (user_id, plan_id, status, expires_at) VALUES ($1, $2, 'active', $3)", [userId, plan_id, expiresAt]);
      }
    }

    // 3. Return Result
    // If Pix, return mock QRCode
    let qrCode = null;
    if (method === 'pix') {
      qrCode = "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5913SafeguardPro6008Brasilia62070503***63041D3D";
    }

    res.json({
      success: true,
      payment: paymentRes.rows[0],
      qrCode
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Mock Webhook (To approve Pix manually)
app.post('/api/financial/approve-pix/:id', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const paymentId = req.params.id;
    const paymentRes = await pool.query("UPDATE payments SET status = 'paid' WHERE id = $1 RETURNING *", [paymentId]);

    if (paymentRes.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

    const payment = paymentRes.rows[0];

    // Update Sub
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const userId = payment.user_id;
    const planId = payment.plan_id;

    const subCheck = await pool.query("SELECT * FROM subscriptions WHERE user_id = $1", [userId]);
    if (subCheck.rows.length > 0) {
      await pool.query("UPDATE subscriptions SET plan_id = $1, status = 'active', expires_at = $2 WHERE user_id = $3", [planId, expiresAt, userId]);
    } else {
      await pool.query("INSERT INTO subscriptions (user_id, plan_id, status, expires_at) VALUES ($1, $2, 'active', $3)", [userId, planId, expiresAt]);
    }

    res.json({ success: true, message: 'Payment approved and subscription activated.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error approving payment' });
  }
});

// ======================================
// SaaS LIMIT MIDDLEWARE
// ======================================

function checkPlanLimit(resource: 'companies' | 'users' | 'visits') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Auth required' });

      // Admins override limits (optional, but good for testing)
      // if (req.user.role === 'admin') return next(); // Commented out to test limits even as admin if needed. Or keep enabled.
      // Let's keep Master Admin unlimited, but "admin" role (Technician) restricted? 
      // Logic says technicians using the SaaS need limits. 
      // For simplicity: If role is 'admin' AND email is 'leonidas.joao@gmail.com' (Master), skip.
      if (req.user.email === 'leonidas.joao@gmail.com') return next();

      // 1. Get Subscription and Plan
      // If user has an owner_id, we check the owner's subscription.
      const subscriberId = req.user.owner_id || req.user.id;

      const subRes = await pool.query(`
            SELECT s.*, p.max_companies, p.max_users, p.max_visits 
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = $1 AND s.status = 'active'
      `, [subscriberId]);

      if (subRes.rows.length === 0) {
        // Check if user is 'admin' (technician) - if so, maybe they are valid but have no plan? 
        // Return 403.
        return res.status(403).json({ error: 'No active subscription found. Please contact support.' });
      }

      const plan = subRes.rows[0];
      let limit = 0;
      let currentUsage = 0;

      if (resource === 'companies') {
        limit = plan.max_companies;
        if (limit === -1) return next();
        // Scoped to current subscriber (owner or self)
        const count = await pool.query('SELECT COUNT(*) FROM companies WHERE owner_id = $1', [subscriberId]);
        currentUsage = parseInt(count.rows[0].count);
      }
      else if (resource === 'users') {
        limit = plan.max_users;
        if (limit === -1) return next();
        // Count users owned by this subscriber
        const count = await pool.query('SELECT COUNT(*) FROM users WHERE owner_id = $1', [subscriberId]);
        currentUsage = parseInt(count.rows[0].count);
      }
      else if (resource === 'visits') {
        limit = plan.max_visits;
        if (limit === -1) return next();
        // Count visits in companies owned by this subscriber
        const count = await pool.query(`
            SELECT COUNT(v.*) FROM visits v
            JOIN companies c ON v.company_id = c.id
            WHERE c.owner_id = $1 AND date_trunc('month', v.scheduled_at) = date_trunc('month', CURRENT_DATE)
      `, [subscriberId]);
        currentUsage = parseInt(count.rows[0].count);
      }

      if (currentUsage >= limit) {
        return res.status(403).json({
          error: `Limite do plano atingido para ${resource}.Limite: ${limit}, Atual: ${currentUsage}. Faça upgrade.`
        });
      }

      next();
    } catch (err) {
      console.error('Plan Check Error:', err);
      res.status(500).json({ error: 'Internal Server Error during plan check' });
    }
  };
}


// ======================================
// EXTERNAL SERVICES (Stubbed/Mocked)
// ======================================

// Nodemailer Setup (Using Ethereal for dev if no real credentials)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'test',
    pass: process.env.SMTP_PASS || 'test',
  },
});

// Twilio Setup (Conditional)
let twilioClient: any = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized');
  } catch (error) {
    console.warn('Twilio init failed, SMS will not work:', error);
  }
} else {
  console.warn('Twilio credentials missing or invalid. SMS disabled.');
}

// ======================================
// CONTROLLERS / ROUTES
// ======================================

// Helper to get safe owner_id for isolation
const getSafeOwnerId = (req: AuthRequest): string | undefined => {
  const user = req.user;
  if (!user) {
    console.log('[getSafeOwnerId] No user in request');
    return 'DENY_ALL'; // Return a string that matches nothing if not auth
  }

  // Master Admin Whitelist (can see everything)
  const masterEmails = ['leonidas.joao@gmail.com', 'admin@safeguardpro.com'];

  if (user.role === 'admin' && masterEmails.includes(user.email)) {
    console.log(`[getSafeOwnerId] User ${user.email} is Master Admin. Returning undefined (UNFILTERED).`);
    return undefined; // No filter (sees everything)
  }

  // For technicians and other non-master admins:
  // We use user.owner_id. If owner_id is NULL (orphan technician), we use their own user.id
  // so they only see data THEY own (which should be none if they are meant to be linked).
  const safeOwner = user.owner_id || user.id;
  console.log(`[getSafeOwnerId] Profile: ${user.role}, User: ${user.email}, OwnerID Applied: ${safeOwner}`);
  return safeOwner;
};

// ======================================
// USER MANAGEMENT ROUTES
// ======================================

// Get All Users
app.get('/api/users', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    let query = 'SELECT id, name, email, role, active, created_at FROM users';
    let params: any[] = [];

    // Master Admin sees all, subscribers see their team
    if ((req as AuthRequest).user?.email !== 'leonidas.joao@gmail.com') {
      // Assuming technicians created by this subscriber are linked (we'll need a way to link them, 
      // for now we'll allow seeing all users if you are an admin but not master, or we can add owner_id to users too)
      // For MVP isolation:
      query += ' ORDER BY name ASC';
    } else {
      query += ' ORDER BY name ASC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create User
// Create User with Optional Plan
app.post('/api/users', authenticate, requireRole(['admin']), checkPlanLimit('users'), async (req: Request, res: Response) => {
  const { name, email, password, role, active, plan_id, trial_days } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user exists
    const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Validate Plan if provided
    let selectedPlanId = null;
    if (plan_id) {
      const planRes = await client.query('SELECT id FROM plans WHERE id = $1', [plan_id]);
      if (planRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid plan_id' });
      }
      selectedPlanId = planRes.rows[0].id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = `user-${Date.now()}`;

    // Create User
    const result = await client.query(
      'INSERT INTO users (id, name, email, password, role, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, active, created_at',
      [id, name, email, hashedPassword, role, active !== undefined ? active : true]
    );

    // Create Subscription if plan selected
    if (selectedPlanId) {
      const days = trial_days ? parseInt(trial_days) : 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      await client.query(
        "INSERT INTO subscriptions (user_id, plan_id, status, expires_at) VALUES ($1, $2, 'active', $3)",
        [id, selectedPlanId, expiresAt]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// Update User
app.put('/api/users/:id', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  const { name, email, password, role, active } = req.body;
  const { id } = req.params;

  try {
    let query = 'UPDATE users SET name = $1, email = $2, role = $3, active = $4';
    let params = [name, email, role, active];
    let paramIndex = 5;

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = $${paramIndex} `;
      params.push(hashedPassword);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex} RETURNING id, name, email, role, active, created_at`;
    params.push(id);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete User
app.delete('/api/users/:id', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    // Prevent deleting self (optional but good practice)
    if ((req as AuthRequest).user?.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const userId = req.params.id;
    console.log(`[DELETE USER] Attempting to delete user: ${userId}`);

    // Remove dependencies first to avoid FK constraint violations
    // Using try/catch for each to handle tables that may not exist

    // 1. Payments (references user_id, must be deleted before subscriptions)
    try {
      await pool.query('DELETE FROM payments WHERE user_id = $1', [userId]);
      console.log('[DELETE USER] Deleted payments');
    } catch (e: any) {
      console.log('[DELETE USER] payments cleanup skipped:', e.message);
    }

    // 2. Certificate templates (FK without ON DELETE CASCADE)
    try {
      await pool.query('DELETE FROM certificate_templates WHERE owner_id = $1', [userId]);
      console.log('[DELETE USER] Deleted certificate_templates');
    } catch (e: any) {
      console.log('[DELETE USER] certificate_templates cleanup skipped:', e.message);
    }

    // 3. Invoices (may not exist in all deployments)
    try {
      await pool.query('DELETE FROM invoices WHERE owner_id = $1', [userId]);
      console.log('[DELETE USER] Deleted invoices');
    } catch (e: any) {
      console.log('[DELETE USER] invoices cleanup skipped:', e.message);
    }

    // 4. Subscriptions (may not exist in all deployments)
    try {
      await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
      console.log('[DELETE USER] Deleted subscriptions');
    } catch (e: any) {
      console.log('[DELETE USER] subscriptions cleanup skipped:', e.message);
    }

    // 5. Checklist templates owned by this user
    try {
      await pool.query('DELETE FROM checklist_templates WHERE owner_id = $1', [userId]);
      console.log('[DELETE USER] Deleted checklist_templates');
    } catch (e: any) {
      console.log('[DELETE USER] checklist_templates cleanup skipped:', e.message);
    }

    // 6. Companies owned by this user (if user is an owner/technician)
    try {
      await pool.query('DELETE FROM companies WHERE owner_id = $1', [userId]);
      console.log('[DELETE USER] Deleted companies');
    } catch (e: any) {
      console.log('[DELETE USER] companies cleanup skipped:', e.message);
    }

    // Now delete the user
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[DELETE USER] Successfully deleted user: ${userId}`);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Login Endpoint (Unified)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  console.log('[LOGIN] Attempt for email:', email);

  try {
    // 1. Check System Users (Admins, Technicians)
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    console.log('[LOGIN] Users found:', userRes.rows.length);

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];

      console.log('[LOGIN] User found:', user.email, 'Password in DB length:', user.password?.length);
      console.log('[LOGIN] Password provided:', password);

      // Check password (bcrypt)
      // Fallback for legacy plain text passwords during migration
      const bcryptMatch = await bcrypt.compare(password, user.password);
      const plainMatch = user.password === password;
      const match = bcryptMatch || plainMatch;

      console.log('[LOGIN] bcrypt match:', bcryptMatch, 'plain match:', plainMatch, 'final match:', match);

      if (match) {
        if (!user.active) return res.status(403).json({ error: 'Usuário inativo.' });

        // Create simplified token including new fields
        const token = `${user.id}:${user.role}:${user.email}:${encodeURIComponent(user.name)}:${user.owner_id || 'null'}:${user.company_id || 'null'}`;

        await logAction(user.id, user.role, 'LOGIN_SUCCESS', 'auth', null, null, req.ip);

        return res.json({
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            owner_id: user.owner_id,
            company_id: user.company_id,
            avatar_url: user.avatar_url
          }
        });
      }
    }

    // 2. Check Company Users (Clients)
    const compRes = await pool.query('SELECT * FROM companies WHERE email = $1 AND password = $2', [email, password]);
    if (compRes.rows.length > 0) {
      const company = compRes.rows[0];
      // Company passwords are assumed to be plain text for now as per original code, or we can migrate them too.
      // For now, keeping as is for companies since they might be separate.

      // Add 'null' placeholders for owner_id and company_id in client token for compatibility
      const token = `${company.id}: client:${company.email}:${encodeURIComponent(company.name)}: null:${company.id} `;
      await logAction(company.id, 'client', 'LOGIN_SUCCESS', 'auth', null, null, req.ip);

      return res.json({
        success: true,
        token,
        user: { id: company.id, name: company.name, email: company.email, role: 'client', company_id: company.id }
      });
    }

    await logAction(undefined, undefined, 'LOGIN_FAILED', 'auth', null, { email }, req.ip);
    res.status(401).json({ error: 'Credenciais inválidas.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

interface CompanyBody {
  id: string;
  name: string;
  contact: string;
  email: string;
  status: string;
  initials: string;
  cnae: string;
  risk_level: number;
  legal_representative: string;
}

interface UnitBody {
  id?: number;
  company_id: string;
  name: string;
  address: string;
  unit_type: string;
}

interface HistoryBody {
  id?: number;
  company_id: string;
  date: string;
  description: string;
  technician: string;
}

interface VisitBody {
  company_id: string;
  sector_id?: number | null;
  visit_type: string;
  scheduled_at: string;
  report_url?: string;
}

interface InspectionBody {
  company_id: string;
  sector_id?: number;
  template_id: number;
  auditor_id: string;
  date: string;
  status: string;
  technician_signature?: string;
  client_signature?: string;
  latitude?: number;
  longitude?: number;
  answers?: {
    item_id: number;
    status: string;
    observation?: string;
    photo_url?: string;
    photo_after_url?: string;
    photo_date?: string;
    photo_lat?: number;
    photo_lon?: number;
  }[];
}

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Company Auth Endpoint
app.post('/api/auth/company', async (req: Request, res: Response) => {
  const { login, password } = req.body;
  try {
    // Try to find company by email or ID (or Name just in case, but ID/Email is better)
    // Here assuming 'login' can be ID or Email
    const result = await pool.query(
      'SELECT * FROM companies WHERE (email = $1 OR id = $1) AND password = $2',
      [login, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Company Portal Dashboard Data
app.get('/api/company/:id/dashboard', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // 1. Company Info
    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
    if (companyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // 2. Recent Visits
    const visitsRes = await pool.query('SELECT * FROM visits WHERE company_id = $1 ORDER BY scheduled_at DESC LIMIT 5', [id]);

    // 3. Outstanding Action Plans (Risks)
    const risksRes = await pool.query(`
        SELECT r.description as risk_desc, ap.*
      FROM risks r
        JOIN action_plans ap ON ap.risk_id = r.id
        WHERE r.company_id = $1 AND ap.status != 'Concluído'
        ORDER BY ap.deadline ASC LIMIT 5
      `, [id]);

    // 4. Pending Inspections
    // (Assuming pending inspections are visited with status 'Agendado' or 'Em Andamento')
    const inspectionsRes = await pool.query('SELECT * FROM inspections WHERE company_id = $1 AND status != \'Concluído\'', [id]);

    res.json({
      company: companyRes.rows[0],
      recentVisits: visitsRes.rows,
      pendingActions: risksRes.rows,
      openInspections: inspectionsRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Companies
app.get('/api/companies', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const ownerId = getSafeOwnerId(req as AuthRequest);

    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = 'SELECT * FROM companies';
    const params: any[] = [];

    if (user?.role === 'client' && user?.company_id) {
      query = 'SELECT * FROM companies WHERE id = $1';
      params.push(user.company_id);
    } else if (ownerId) {
      query = 'SELECT * FROM companies WHERE owner_id = $1';
      params.push(ownerId);
    }

    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/companies] Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/api/companies', authenticate, requireRole(['admin', 'technician']), checkPlanLimit('companies'), async (req: Request, res: Response) => {
  const { id, name, contact, email, status, initials, cnae, risk_level, legal_representative }: CompanyBody = req.body;

  // DATA ISOLATION: 
  // Force owner_id to be the current user's ID.
  const owner_id = (req as AuthRequest).user?.id;

  try {
    const result = await pool.query(
      'INSERT INTO companies (id, name, contact, email, status, initials, cnae, risk_level, legal_representative, owner_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [id, name, contact, email, status, initials, cnae, risk_level, legal_representative, owner_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/companies/:id', authenticate, requireRole(['admin', 'technician']), async (req: Request, res: Response) => {
  const { name, contact, email, status, initials, cnae, risk_level, legal_representative }: CompanyBody = req.body;
  try {
    const result = await pool.query(
      'UPDATE companies SET name = $1, contact = $2, email = $3, status = $4, initials = $5, cnae = $6, risk_level = $7, legal_representative = $8 WHERE id = $9 RETURNING *',
      [name, contact, email, status, initials, cnae, risk_level, legal_representative, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/companies/:id', authenticate, requireRole(['admin', 'technician']), async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- PPE (EPI) Management ---

// White Label Settings API
app.get('/api/white-label', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const ownerId = user?.owner_id || user?.id;

    const result = await pool.query('SELECT * FROM white_label_settings WHERE owner_id = $1', [ownerId]);
    if (result.rows.length === 0) {
      return res.json({ brand_name: 'SafeGuard Pro', logo_url: null });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/white-label', authenticate, upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const ownerId = user?.owner_id || user?.id;
    const { brand_name, primary_color } = req.body;
    let logo_url = req.body.logo_url;

    if (req.file) {
      logo_url = `/uploads/${req.file.filename}`;
    }

    const result = await pool.query(`
      INSERT INTO white_label_settings (owner_id, brand_name, logo_url, primary_color)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (owner_id) DO UPDATE SET
        brand_name = EXCLUDED.brand_name,
        logo_url = COALESCE(EXCLUDED.logo_url, white_label_settings.logo_url),
        primary_color = EXCLUDED.primary_color
      RETURNING *
    `, [ownerId, brand_name, logo_url, primary_color]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 1. Employees
app.get('/api/employees', authenticate, async (req: Request, res: Response) => {
  const { company_id } = req.query;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = `
      SELECT e.* 
      FROM employees e
      JOIN companies c ON e.company_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (company_id) {
      query += ` AND e.company_id = $${pIdx++}`;
      params.push(company_id);
    }

    if (ownerId) {
      query += ` AND c.owner_id = $${pIdx++}`;
      params.push(ownerId);
    }

    query += ' ORDER BY e.name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/employees', authenticate, async (req: Request, res: Response) => {
  const { company_id, name, role, admission_date, cpf } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO employees (company_id, name, role, admission_date, cpf) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [company_id, name, role, admission_date, cpf]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/employees/:id', authenticate, async (req: Request, res: Response) => {
  const { name, role, admission_date, cpf, status } = req.body;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE employees SET name = $1, role = $2, admission_date = $3, cpf = $4, status = $5 WHERE id = $6 RETURNING *',
      [name, role, admission_date, cpf, status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. EPIs (Inventory)
app.get('/api/epis', authenticate, async (req: Request, res: Response) => {
  const { company_id } = req.query;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = `
      SELECT e.* 
      FROM epis e
      JOIN companies c ON e.company_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (company_id) {
      query += ` AND e.company_id = $${pIdx++}`;
      params.push(company_id);
    }

    if (ownerId) {
      query += ` AND c.owner_id = $${pIdx++}`;
      params.push(ownerId);
    }

    query += ' ORDER BY e.name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/epis', authenticate, async (req: Request, res: Response) => {
  const { company_id, name, ca_number, manufacturer, validity_days, stock_quantity, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO epis (company_id, name, ca_number, manufacturer, validity_days, stock_quantity, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [company_id, name, ca_number, manufacturer, validity_days, stock_quantity, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/epis/:id', authenticate, async (req: Request, res: Response) => {
  const { name, ca_number, manufacturer, validity_days, stock_quantity, description } = req.body;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE epis SET name = $1, ca_number = $2, manufacturer = $3, validity_days = $4, stock_quantity = $5, description = $6 WHERE id = $7 RETURNING *',
      [name, ca_number, manufacturer, validity_days, stock_quantity, description, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/epis/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Optional: Check if there are deliveries associated before deleting
    await pool.query('DELETE FROM epis WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Deliveries
app.get('/api/epi-deliveries', authenticate, async (req: Request, res: Response) => {
  const { company_id } = req.query;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    // Join with Employee and EPI names for easier display
    const result = await pool.query(`
            SELECT d.*, e.name as employee_name, epi.name as epi_name, epi.ca_number 
            FROM epi_deliveries d
            JOIN employees e ON d.employee_id = e.id
            JOIN epis epi ON d.epi_id = epi.id
            JOIN companies c ON e.company_id = c.id
            WHERE e.company_id = $1 ${ownerId ? 'AND c.owner_id = $2' : ''}
            ORDER BY d.delivery_date DESC
      `, ownerId ? [company_id, ownerId] : [company_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/epi-deliveries', authenticate, async (req: Request, res: Response) => {
  const { employee_id, epi_id, quantity, reason, technician_signature, employee_signature } = req.body;

  // Start transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get EPI validity to calculate next exchange
    const epiRes = await client.query('SELECT validity_days, stock_quantity FROM epis WHERE id = $1', [epi_id]);
    if (epiRes.rows.length === 0) throw new Error('EPI not found');

    const epi = epiRes.rows[0];

    // Check Stock
    if (epi.stock_quantity < quantity) {
      throw new Error('Estoque insuficiente');
    }

    // Calculate Next Exchange
    let nextExchange = null;
    if (epi.validity_days) {
      const date = new Date();
      date.setDate(date.getDate() + epi.validity_days);
      nextExchange = date.toISOString();
    }

    // 2. Insert Delivery
    const deliveryRes = await client.query(
      'INSERT INTO epi_deliveries (employee_id, epi_id, quantity, reason, technician_signature, employee_signature, next_exchange_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [employee_id, epi_id, quantity, reason, technician_signature, employee_signature, nextExchange]
    );

    // 3. Decrement Stock
    await client.query('UPDATE epis SET stock_quantity = stock_quantity - $1 WHERE id = $2', [quantity, epi_id]);

    await client.query('COMMIT');
    res.status(201).json(deliveryRes.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// Sectors consolidated

// Sectors
app.get('/api/sectors', authenticate, async (req: Request, res: Response) => {
  const { company_id } = req.query;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = `
      SELECT s.* 
      FROM sectors s
      JOIN companies c ON s.company_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (company_id) {
      query += ` AND s.company_id = $${pIdx++}`;
      params.push(company_id);
    }

    if (ownerId) {
      query += ` AND c.owner_id = $${pIdx++}`;
      params.push(ownerId);
    }

    // Role-based restriction for clients
    if ((req as AuthRequest).user?.role === 'client') {
      const clientId = (req as AuthRequest).user?.company_id;
      if (clientId) {
        query += ` AND s.company_id = $${pIdx++}`;
        params.push(clientId);
      }
    }

    query += ' ORDER BY s.name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Units
app.get('/api/companies/:id/units', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = 'SELECT u.* FROM units u JOIN companies c ON u.company_id = c.id WHERE u.company_id = $1';
    const params: any[] = [id];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/units/:id/sectors', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = 'SELECT s.* FROM sectors s JOIN units u ON s.unit_id = u.id JOIN companies c ON u.company_id = c.id WHERE s.unit_id = $1';
    const params: any[] = [id];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ======================================
// TRAININGS & CERTIFICATES ROUTES
// ======================================

// Standard Texts
app.get('/api/standard-texts', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    // Allow access to system texts (owner_id IS NULL) + user texts
    const result = await pool.query(
      'SELECT * FROM standard_texts WHERE owner_id = $1 OR owner_id IS NULL ORDER BY title',
      [ownerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/standard-texts', authenticate, async (req: Request, res: Response) => {
  const { title, content } = req.body;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Unauthorized' });

    const result = await pool.query(
      'INSERT INTO standard_texts (owner_id, title, content) VALUES ($1, $2, $3) RETURNING *',
      [ownerId, title, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/standard-texts/:id', authenticate, async (req: Request, res: Response) => {
  const { title, content } = req.body;
  const { id } = req.params;
  try {
    // Security check: ensure owner owns this text (or is admin editing system text?)
    // For simplicity assuming user edits their own text
    const result = await pool.query(
      'UPDATE standard_texts SET title = $1, content = $2 WHERE id = $3 RETURNING *',
      [title, content, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/standard-texts/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM standard_texts WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Certificate Templates
app.get('/api/certificate-templates', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    const result = await pool.query(
      `SELECT * FROM certificate_templates WHERE 1=1 ${ownerId ? 'AND (owner_id = $1 OR owner_id IS NULL)' : ''} ORDER BY id DESC`,
      ownerId ? [ownerId] : []
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/certificate-templates', authenticate, upload.single('background'), async (req: Request, res: Response) => {
  const { name, body_text, verso_text } = req.body;
  const ownerId = getSafeOwnerId(req as AuthRequest);

  if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Unauthorized' });

  try {
    let imageUrl = '';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const result = await pool.query(
      'INSERT INTO certificate_templates (owner_id, name, image_url, body_text, verso_text) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [ownerId, name, imageUrl, body_text, verso_text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/certificate-templates/:id', authenticate, async (req: Request, res: Response) => {
  // NOTE: Does not handle image update here for simplicity, only text fields
  const { name, body_text, verso_text } = req.body;
  try {
    const result = await pool.query(
      'UPDATE certificate_templates SET name = $1, body_text = $2, verso_text = $3 WHERE id = $4 RETURNING *',
      [name, body_text, verso_text, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/certificate-templates/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM certificate_templates WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Trainings
app.get('/api/trainings', authenticate, async (req: Request, res: Response) => {
  const { company_id } = req.query;
  if (!company_id) return res.json([]);

  try {
    // We need to list trainings. Since a training can have multiple employees, we might return one row per employee
    // OR one row per training with a list of employees.
    // The frontend expects a list where each item is a "RealTraining" which seems to be 1 employee per row 
    // given the interface `employee_id: number` and `employee_name: string`.
    // So we join `trainings_employees`

    const ownerId = getSafeOwnerId(req as AuthRequest);
    const result = await pool.query(`
            SELECT t.*, 
                   e.id as employee_id, e.name as employee_name, e.role as employee_role,
                   ct.name as template_name
            FROM trainings t
            JOIN trainings_employees te ON t.id = te.training_id
            JOIN employees e ON te.employee_id = e.id
            JOIN companies c ON t.company_id = c.id
            LEFT JOIN certificate_templates ct ON t.template_id = ct.id
            WHERE t.company_id = $1 ${ownerId ? 'AND c.owner_id = $2' : ''}
            ORDER BY t.training_date DESC
        `, ownerId ? [company_id, ownerId] : [company_id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/trainings', authenticate, async (req: Request, res: Response) => {
  const { company_id, course_name, training_date, validity_date, status, employee_ids, template_id, certificate_url } = req.body;

  // employee_ids is array of numbers
  if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
    return res.status(400).json({ error: 'Select at least one employee' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create Training Record
    const insertRes = await client.query(`
            INSERT INTO trainings (company_id, course_name, training_date, validity_date, status, certificate_url, template_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [company_id, course_name, training_date, validity_date, status, certificate_url, template_id]);

    const trainingId = insertRes.rows[0].id;

    // 2. Link Employees
    for (const empId of employee_ids) {
      await client.query(`
                INSERT INTO trainings_employees (training_id, employee_id)
                VALUES ($1, $2)
            `, [trainingId, empId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, id: trainingId });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

app.post('/api/trainings/upload', authenticate, upload.single('certificate'), (req: Request, res: Response) => {
  if (req.file) {
    res.json({ url: `/uploads/${req.file.filename}` });
  } else {
    res.status(400).json({ error: 'No file uploaded' });
  }
});

app.delete('/api/trainings/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM trainings WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// Generate PDF



app.post('/api/units', authenticate, async (req: Request, res: Response) => {
  const { company_id, name, address, unit_type }: UnitBody = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO units (company_id, name, address, unit_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [company_id, name, address, unit_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/units/:id', authenticate, async (req: Request, res: Response) => {
  const { name, address, unit_type }: UnitBody = req.body;
  try {
    const result = await pool.query(
      'UPDATE units SET name = $1, address = $2, unit_type = $3 WHERE id = $4 RETURNING *',
      [name, address, unit_type, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/units/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM units WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// History
app.get('/api/companies/:id/history', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = 'SELECT h.* FROM service_history h JOIN companies c ON h.company_id = c.id WHERE h.company_id = $1';
    const params: any[] = [id];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    query += ' ORDER BY h.date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/service-history', authenticate, async (req: Request, res: Response) => {
  const { company_id, date, description, technician }: HistoryBody = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO service_history (company_id, date, description, technician) VALUES ($1, $2, $3, $4) RETURNING *',
      [company_id, date, description, technician]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/service-history/:id', authenticate, async (req: Request, res: Response) => {
  const { date, description, technician }: HistoryBody = req.body;
  try {
    const result = await pool.query(
      'UPDATE service_history SET date = $1, description = $2, technician = $3 WHERE id = $4 RETURNING *',
      [date, description, technician, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.delete('/api/service-history/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM service_history WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Visits Endpoints
app.get('/api/visits', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    let query = `
      SELECT
      v.*,
      c.name as company_name,
      s.name as sector_name,
      u.name as unit_name
      FROM visits v 
      JOIN companies c ON v.company_id = c.id
      LEFT JOIN sectors s ON v.sector_id = s.id
      LEFT JOIN units u ON s.unit_id = u.id
    `;

    const params: any[] = [];
    if (ownerId && ownerId !== 'DENY_ALL') {
      query += ' WHERE c.owner_id = $1';
      params.push(ownerId);
    } else if (ownerId === 'DENY_ALL') {
      return res.json([]);
    }

    query += ' ORDER BY v.scheduled_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/visits', authenticate, checkPlanLimit('visits'), async (req: Request, res: Response) => {
  const { company_id, sector_id, visit_type, scheduled_at }: VisitBody = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO visits (company_id, sector_id, visit_type, scheduled_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [company_id, sector_id || null, visit_type, scheduled_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/visits/:id', authenticate, async (req: Request, res: Response) => {
  const { visit_type, scheduled_at, report_url, sector_id }: VisitBody = req.body;
  try {
    const result = await pool.query(
      'UPDATE visits SET visit_type = $1, scheduled_at = $2, report_url = $3, sector_id = $4 WHERE id = $5 RETURNING *',
      [visit_type, scheduled_at, report_url, sector_id || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/visits/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM visits WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/api/visits/:id/check-in', authenticate, async (req: Request, res: Response) => {
  const { latitude, longitude } = req.body;
  try {
    const result = await pool.query(
      'UPDATE visits SET check_in_at = NOW(), status = $1, latitude = $2, longitude = $3 WHERE id = $4 RETURNING *',
      ['Em Andamento', latitude, longitude, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/api/visits/:id/check-out', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'UPDATE visits SET check_out_at = NOW(), status = $1 WHERE id = $2 RETURNING *',
      ['Concluído', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Checklist Templates
app.get('/api/checklist-templates', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    // Show system templates (owner_id IS NULL) + user's own templates
    // If ownerId is undefined (Master), show all.
    let query = `SELECT * FROM checklist_templates WHERE 1=1 `;
    const params: any[] = [];

    if (ownerId) {
      query += ` AND (owner_id IS NULL OR owner_id = $1) `;
      params.push(ownerId);
    }

    query += ` ORDER BY name ASC`;

    const templatesRes = await pool.query(query, params);
    const itemsRes = await pool.query('SELECT * FROM checklist_items ORDER BY id ASC');

    const templates = templatesRes.rows.map(t => ({
      ...t,
      items: itemsRes.rows.filter(i => i.template_id === t.id)
    }));

    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/checklist-templates', authenticate, async (req: Request, res: Response) => {
  const { name, description } = req.body;
  const ownerId = (req as AuthRequest).user?.id; // Creator is owner

  try {
    const result = await pool.query(
      'INSERT INTO checklist_templates (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, ownerId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/checklist-templates/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const userId = (req as AuthRequest).user?.id;

  try {
    // Check ownership
    const check = await pool.query('SELECT owner_id FROM checklist_templates WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    // Allow edit only if owner matches user. System templates (null) cannot be edited by technicians.
    // Master admin can edit anything (check role).
    const isMaster = (req as AuthRequest).user?.role === 'admin' && ['leonidas.joao@gmail.com', 'admin@safeguardpro.com'].includes((req as AuthRequest).user?.email || '');

    if (!isMaster && check.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: 'PermissÃ£o negada. VocÃª nÃ£o pode editar este modelo.' });
    }

    const result = await pool.query(
      'UPDATE checklist_templates SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/checklist-templates/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;

  try {
    // Check ownership
    const check = await pool.query('SELECT owner_id FROM checklist_templates WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const isMaster = (req as AuthRequest).user?.role === 'admin' && ['leonidas.joao@gmail.com', 'admin@safeguardpro.com'].includes((req as AuthRequest).user?.email || '');

    if (!isMaster && check.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: 'PermissÃ£o negada. VocÃª nÃ£o pode excluir este modelo.' });
    }

    await pool.query('DELETE FROM checklist_templates WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Checklist Items
app.post('/api/checklist-items', async (req: Request, res: Response) => {
  const { template_id, question, category } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO checklist_items (template_id, question, category) VALUES ($1, $2, $3) RETURNING *',
      [template_id, question, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/checklist-items/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM checklist_items WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Inspections
app.get('/api/inspections', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    let query = `
    SELECT
    i.*,
      c.name as company_name,
      t.name as template_name,
      s.name as sector_name,
      (
        SELECT json_agg(a.*) 
                    FROM inspection_answers a 
                    WHERE a.inspection_id = i.id
                ) as answers
            FROM inspections i
            JOIN companies c ON i.company_id = c.id
            JOIN checklist_templates t ON i.template_id = t.id
            LEFT JOIN sectors s ON i.sector_id = s.id
    `;
    const params: any[] = [];
    if (ownerId) {
      query += ' WHERE c.owner_id = $1';
      params.push(ownerId);
    }

    query += ' ORDER BY i.date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/inspections/:id', async (req: Request, res: Response) => {
  try {
    const inspectionRes = await pool.query(`
             SELECT i.*, c.name as company_name, t.name as template_name, s.name as sector_name
            FROM inspections i
            JOIN companies c ON i.company_id = c.id
            JOIN checklist_templates t ON i.template_id = t.id
            LEFT JOIN sectors s ON i.sector_id = s.id
            WHERE i.id = $1
      `, [req.params.id]);

    if (inspectionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const answersRes = await pool.query('SELECT * FROM inspection_answers WHERE inspection_id = $1', [req.params.id]);

    res.json({
      ...inspectionRes.rows[0],
      answers: answersRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/inspections', authenticate, async (req: Request, res: Response) => {
  const { company_id, template_id, auditor_id, date, status, answers }: InspectionBody = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const inspectionRes = await client.query(
      'INSERT INTO inspections (company_id, sector_id, template_id, auditor_id, date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [company_id, req.body.sector_id || null, template_id, auditor_id, date, status]
    );
    const inspectionId = inspectionRes.rows[0].id;

    if (answers && answers.length > 0) {
      for (const ans of answers) {
        await client.query(
          'INSERT INTO inspection_answers (inspection_id, item_id, status, observation, photo_url, photo_after_url, photo_date, photo_lat, photo_lon) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [inspectionId, ans.item_id, ans.status, ans.observation, ans.photo_url, ans.photo_after_url, ans.photo_date, ans.photo_lat, ans.photo_lon]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(inspectionRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

app.put('/api/inspections/:id', async (req: Request, res: Response) => {
  const { status, technician_signature, client_signature, latitude, longitude, answers }: InspectionBody = req.body;
  const { id } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check current status
    const currentRes = await client.query('SELECT status FROM inspections WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (currentRes.rows[0].status === 'Concluído') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Inspection already completed and cannot be modified.' });
    }

    let query = 'UPDATE inspections SET status = $1, technician_signature = $2, client_signature = $3, latitude = $4, longitude = $5';
    const params = [status, technician_signature, client_signature, latitude, longitude];

    if (status === 'Concluído') {
      query += ', completed_at = NOW()';
    }

    query += ' WHERE id = $' + (params.length + 1) + ' RETURNING *';
    params.push(String(id)); // params are indexed from 1, so push id last

    const inspectionRes = await client.query(query, params);

    // Update answers (Delete all simple strategy)
    if (answers && answers.length > 0) {
      await client.query('DELETE FROM inspection_answers WHERE inspection_id = $1', [id]);
      for (const ans of answers) {
        await client.query(
          'INSERT INTO inspection_answers (inspection_id, item_id, status, observation, photo_url, photo_after_url, photo_date, photo_lat, photo_lon) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [id, ans.item_id, ans.status, ans.observation, ans.photo_url, ans.photo_after_url, ans.photo_date, ans.photo_lat, ans.photo_lon]
        );
      }
    }

    await client.query('COMMIT');
    res.json(inspectionRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// =====================
// RISK MANAGEMENT APIs
// =====================

interface RiskBody {
  company_id: string;
  sector_id?: number | null;
  risk_type: string;
  description: string;
  source?: string;
  probability: number;
  severity: number;
  status?: string;
}

interface ActionPlanBody {
  measure: string;
  responsible: string;
  deadline: string;
  status?: string;
  notes?: string;
}

// GET all risks (with filters)
app.get('/api/risks', authenticate, async (req: Request, res: Response) => {
  const { company_id, status, risk_type } = req.query;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = `
      SELECT r.*, c.name as company_name, s.name as sector_name,
      (SELECT json_agg(ap.*) FROM action_plans ap WHERE ap.risk_id = r.id) as action_plans
      FROM risks r
      JOIN companies c ON r.company_id = c.id
      LEFT JOIN sectors s ON r.sector_id = s.id
      WHERE 1 = 1
      `;
    const params: any[] = [];
    let paramIndex = 1;

    if (ownerId) {
      query += ` AND c.owner_id = $${paramIndex++} `;
      params.push(ownerId);
    }

    if (company_id) {
      query += ` AND r.company_id = $${paramIndex++} `;
      params.push(company_id);
    }
    if (status) {
      query += ` AND r.status = $${paramIndex++} `;
      params.push(status);
    }
    if (risk_type) {
      query += ` AND r.risk_type = $${paramIndex++} `;
      params.push(risk_type);
    }

    query += ' ORDER BY r.risk_level DESC, r.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET single risk
app.get('/api/risks/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(401).json({ error: 'Unauthorized' });

    let query = `
      SELECT r.*, c.name as company_name, s.name as sector_name
      FROM risks r
      JOIN companies c ON r.company_id = c.id
      LEFT JOIN sectors s ON r.sector_id = s.id
      WHERE r.id = $1
    `;
    const params: any[] = [req.params.id];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    const riskRes = await pool.query(query, params);

    if (riskRes.rows.length === 0) {
      return res.status(404).json({ error: 'Risk not found or Access Denied' });
    }

    const actionsRes = await pool.query('SELECT * FROM action_plans WHERE risk_id = $1 ORDER BY deadline ASC', [req.params.id]);

    res.json({
      ...riskRes.rows[0],
      action_plans: actionsRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST new risk
app.post('/api/risks', authenticate, async (req: Request, res: Response) => {
  const { company_id, sector_id, risk_type, description, source, probability, severity, status }: RiskBody = req.body;
  try {
    const risk_level = probability * severity;
    const result = await pool.query(
      `INSERT INTO risks(company_id, sector_id, risk_type, description, source, probability, severity, risk_level, status)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING * `,
      [company_id, sector_id || null, risk_type, description, source, probability, severity, risk_level, status || 'aberto']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update risk
app.put('/api/risks/:id', authenticate, async (req: Request, res: Response) => {
  const { sector_id, risk_type, description, source, probability, severity, status }: RiskBody = req.body;
  try {
    // Fetch current risk to avoid NaN when fields are missing (partial update)
    const currentRes = await pool.query('SELECT * FROM risks WHERE id = $1', [req.params.id]);
    if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Risk not found' });
    const current = currentRes.rows[0];

    // Use current values if body is missing them
    const final_prob = probability !== undefined ? probability : current.probability;
    const final_sev = severity !== undefined ? severity : current.severity;
    const risk_level = (final_prob || 0) * (final_sev || 0);

    const result = await pool.query(
      `UPDATE risks SET sector_id = $1, risk_type = $2, description = $3, source = $4,
      probability = $5, severity = $6, risk_level = $7, status = $8
       WHERE id = $9 RETURNING * `,
      [
        sector_id !== undefined ? sector_id : current.sector_id,
        risk_type || current.risk_type,
        description || current.description,
        source || current.source,
        final_prob,
        final_sev,
        risk_level,
        status || current.status,
        req.params.id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating risk:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE risk
app.delete('/api/risks/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM risks WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST action plan to risk
app.post('/api/risks/:id/actions', authenticate, async (req: Request, res: Response) => {
  const { measure, responsible, deadline, status, notes }: ActionPlanBody = req.body;
  const { id } = req.params;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    // Verify ownership of the risk
    if (ownerId) {
      const riskCheck = await pool.query(
        'SELECT 1 FROM risks r JOIN companies c ON r.company_id = c.id WHERE r.id = $1 AND c.owner_id = $2',
        [id, ownerId]
      );
      if (riskCheck.rows.length === 0) return res.status(403).json({ error: 'Permission Denied' });
    }

    const result = await pool.query(
      'INSERT INTO action_plans (risk_id, measure, responsible, deadline, status, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, measure, responsible, deadline, status || 'pendente', notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update action plan
app.put('/api/actions/:id', authenticate, async (req: Request, res: Response) => {
  const { measure, responsible, deadline, status, notes }: ActionPlanBody = req.body;
  const { id } = req.params;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    // Verify ownership of the parent risk/incident
    if (ownerId) {
      const check = await pool.query(`
        SELECT 1 FROM action_plans ap
        LEFT JOIN risks r ON ap.risk_id = r.id
        LEFT JOIN incidents i ON ap.incident_id = i.id
        LEFT JOIN companies c1 ON r.company_id = c1.id
        LEFT JOIN companies c2 ON i.company_id = c2.id
        WHERE ap.id = $1 AND (c1.owner_id = $2 OR c2.owner_id = $2)
      `, [id, ownerId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Permission Denied' });
    }

    const result = await pool.query(
      'UPDATE action_plans SET measure = $1, responsible = $2, deadline = $3, status = $4, notes = $5 WHERE id = $6 RETURNING *',
      [measure, responsible, deadline, status, notes, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE action plan
app.delete('/api/actions/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    if (ownerId) {
      const check = await pool.query(`
        SELECT 1 FROM action_plans ap
        LEFT JOIN risks r ON ap.risk_id = r.id
        LEFT JOIN incidents i ON ap.incident_id = i.id
        LEFT JOIN companies c1 ON r.company_id = c1.id
        LEFT JOIN companies c2 ON i.company_id = c2.id
        WHERE ap.id = $1 AND (c1.owner_id = $2 OR c2.owner_id = $2)
      `, [id, ownerId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Permission Denied' });
    }

    await pool.query('DELETE FROM action_plans WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================
// PDF REPORT GENERATION
// =====================

// Helper: Add header to PDF
const addPdfHeader = (doc: PDFKit.PDFDocument, title: string) => {
  // Brand Header Bar
  doc.rect(0, 0, 612, 40).fill('#13ec6d');
  doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('SAFEGUARDPRO SST', 50, 15);
  doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('PLATAFORMA DE GESTÃO DE SEGURANÇA', 400, 18, { align: 'right' });

  doc.moveDown(4);
  doc.fillColor('black').fontSize(22).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica').text(`Emissão: ${new Date().toLocaleString('pt-BR')} `, { align: 'center' });

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(562, doc.y).lineWidth(1).strokeColor('#e0e0e0').stroke();
  doc.moveDown(2);
};

// Helper: Add footer to PDF
const addPdfFooter = (doc: PDFKit.PDFDocument, pageNum: number) => {
  doc.fontSize(8).text(`Página ${pageNum} - Documento gerado automaticamente pelo SafeguardPro SST`, 50, doc.page.height - 50, { align: 'center' });
};

// Visit Report PDF
app.get('/api/reports/visit/:id/pdf', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    let query = `
      SELECT v.*, c.name as company_name, s.name as sector_name
      FROM visits v
      JOIN companies c ON v.company_id = c.id
      LEFT JOIN sectors s ON v.sector_id = s.id
      WHERE v.id = $1
      `;
    const params: any[] = [req.params.id];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = result.rows[0];
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename = relatorio - visita - ${visit.id}.pdf`);
    doc.pipe(res);

    addPdfHeader(doc, 'RELATÓRIO DE VISITA TÉCNICA');

    doc.fontSize(12).font('Helvetica-Bold').text('Informações da Visita');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Empresa: ${visit.company_name} `);
    doc.text(`Setor: ${visit.sector_name || 'N/A'} `);
    doc.text(`Tipo: ${visit.visit_type} `);
    doc.text(`Data Agendada: ${new Date(visit.scheduled_at).toLocaleString('pt-BR')} `);
    doc.text(`Status: ${visit.status} `);
    doc.moveDown();

    if (visit.check_in_at) {
      doc.text(`Check -in: ${new Date(visit.check_in_at).toLocaleString('pt-BR')} `);
    }
    if (visit.check_out_at) {
      doc.text(`Check - out: ${new Date(visit.check_out_at).toLocaleString('pt-BR')} `);
      const duration = (new Date(visit.check_out_at).getTime() - new Date(visit.check_in_at).getTime()) / 60000;
      doc.text(`Duração: ${Math.round(duration)} minutos`);
    }
    if (visit.latitude && visit.longitude) {
      doc.moveDown();
      doc.text(`Localização GPS: ${visit.latitude}, ${visit.longitude} `);
    }

    addPdfFooter(doc, 1);
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF' });
  }
});

// Inspection Report PDF
app.get('/api/reports/inspection/:id/pdf', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    let query = `
      SELECT i.*, c.name as company_name, t.name as template_name, s.name as sector_name
      FROM inspections i
      JOIN companies c ON i.company_id = c.id
      JOIN checklist_templates t ON i.template_id = t.id
      LEFT JOIN sectors s ON i.sector_id = s.id
      WHERE i.id = $1
      `;
    const params: any[] = [req.params.id];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    const insResult = await pool.query(query, params);

    if (insResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const inspection = insResult.rows[0];

    const answersResult = await pool.query(`
      SELECT a.*, ci.question, ci.category
      FROM inspection_answers a
      JOIN checklist_items ci ON a.item_id = ci.id
      WHERE a.inspection_id = $1
      `, [req.params.id]);

    const doc = new PDFDocument({ margin: 50 });

    // Enhanced Inspection Report PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename = relatorio - inspecao - ${inspection.id}.pdf`);
    doc.pipe(res);

    addPdfHeader(doc, 'RELATÓRIO TÉCNICO DE INSPEÇÃO');

    // 1. Identification Section
    doc.rect(50, 110, 500, 90).stroke();
    doc.fontSize(10).font('Helvetica-Bold').text('IDENTIFICAÇÃO', 60, 120);

    doc.fontSize(9).font('Helvetica');
    doc.text(`Empresa Solicitante: `, 60, 140).font('Helvetica-Bold').text(inspection.company_name, 160, 140);
    doc.font('Helvetica').text(`Checklist Aplicado: `, 60, 155).font('Helvetica-Bold').text(inspection.template_name, 160, 155);
    doc.font('Helvetica').text(`Data da Inspeção: `, 60, 170).font('Helvetica-Bold').text(new Date(inspection.date).toLocaleDateString('pt-BR'), 160, 170);
    doc.font('Helvetica').text(`Status: `, 350, 140).font('Helvetica-Bold').text(inspection.status, 400, 140);
    doc.font('Helvetica').text(`ID Auditor: `, 350, 155).font('Helvetica-Bold').text(inspection.auditor_id, 400, 155);

    if (inspection.latitude && inspection.longitude) {
      doc.font('Helvetica').text(`Geolocalização: `, 350, 170).font('Helvetica-Bold').text(`${inspection.latitude}, ${inspection.longitude} `, 425, 170);
    }
    doc.moveDown(4);

    // 2. Checklist Items
    doc.fontSize(12).font('Helvetica-Bold').text('ITENS DO CHECKLIST E EVIDÊNCIAS');
    doc.moveDown(0.5);

    let currentCategory = '';

    for (const ans of answersResult.rows) {
      // Category Header
      if (ans.category !== currentCategory) {
        doc.moveDown(0.5);
        doc.fillColor('#e0e0e0').rect(50, doc.y, 500, 20).fill().stroke();
        doc.fillColor('black').fontSize(11).font('Helvetica-Bold').text(ans.category || 'Geral', 60, doc.y - 15);
        currentCategory = ans.category;
        doc.moveDown(0.5);
      }

      // Keep together to avoid breaking item header and content
      const startY = doc.y;

      // Status Icon/Text
      const statusColor = ans.status === 'C' ? 'green' : ans.status === 'NC' ? 'red' : 'gray';
      const statusLabel = ans.status === 'C' ? 'CONFORME' : ans.status === 'NC' ? 'NÃO CONFORME' : 'NÃO APLICÁVEL';

      doc.fontSize(8).font('Helvetica-Bold').fillColor(statusColor).text(`[${statusLabel} ]`, 60, doc.y);
      doc.fontSize(10).font('Helvetica').fillColor('black').text(ans.question, 140, doc.y - 10);

      if (ans.observation) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#555').text(`Observação: ${ans.observation} `, 140);
        doc.fillColor('black');
      }

      // Photos (Evidences)
      if (ans.photo_url || ans.photo_after_url) {
        doc.moveDown(0.5);
        const yPos = doc.y;
        let xPos = 140;

        // Helper to process image (base64 or url)
        const processImage = (imgData: string) => {
          try {
            if (imgData.startsWith('data:image')) {
              return imgData; // doc.image handles data URI
            }
            // If it's a relative path, resolve it (simplified for demo)
            if (!imgData.startsWith('http')) return path.join(__dirname, '..', imgData);
            return imgData;
          } catch (e) { return null; }
        };

        if (ans.photo_url) {
          try {
            const img = processImage(ans.photo_url);
            if (img) doc.image(img, xPos, yPos, { width: 150, height: 100 });
            doc.fontSize(8).text('Evidência', xPos, yPos + 105);
            xPos += 160;
          } catch (e) { console.error('Error adding image pdf', e); }
        }
        if (ans.photo_after_url) {
          try {
            const img = processImage(ans.photo_after_url);
            if (img) doc.image(img, xPos, yPos, { width: 150, height: 100 });
            doc.fontSize(8).text('Correção', xPos, yPos + 105);
          } catch (e) { console.error('Error adding image pdf', e); }
        }
        doc.moveDown(8); // Space for photos
      } else {
        doc.moveDown(0.5);
      }

      doc.lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#eee').stroke();
      doc.moveDown(0.5);
    }

    // 3. Signatures Section
    doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').text('VALIDAÇÃO E ASSINATURAS');
    doc.moveDown(2);

    const sigY = doc.y;

    // Technician Signature
    if (inspection.technician_signature) {
      try {
        doc.text('Auditor / Técnico Responsável', 50, sigY);
        doc.image(inspection.technician_signature, 50, sigY + 20, { width: 200 });
        doc.fontSize(8).text(`Assinado digitalmente em: ${new Date().toLocaleString()} `, 50, sigY + 100);
      } catch (e) { doc.text('(Erro na imagem da assinatura)', 50, sigY + 40); }
    } else {
      doc.text('__________________________________', 50, sigY + 50);
      doc.text('Auditor / Técnico Responsável', 50, sigY + 65);
    }

    // Client Signature
    if (inspection.client_signature) {
      try {
        doc.text('Cliente / Responsável Local', 300, sigY);
        doc.image(inspection.client_signature, 300, sigY + 20, { width: 200 });
        doc.fontSize(8).text(`Assinado digitalmente em: ${new Date().toLocaleString()} `, 300, sigY + 100);
      } catch (e) { doc.text('(Erro na imagem da assinatura)', 300, sigY + 40); }
    } else {
      doc.text('__________________________________', 300, sigY + 50);
      doc.text('Cliente / Responsável Local', 300, sigY + 65);
    }

    doc.moveDown(10);
    doc.fontSize(8).fillColor('gray').text('Este documento foi gerado eletronicamente pelo sistema SafeGuardPro SST e possui validade jurídica conforme MP 2.200-2/2001.', { align: 'center' });

    addPdfFooter(doc, 1);
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF' });
  }
});

// Photo Evidence Report PDF
app.get('/api/reports/evidence/:inspectionId/pdf', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    let query = `
      SELECT i.*, c.name as company_name
      FROM inspections i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = $1
      `;
    const params: any[] = [req.params.inspectionId];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    const insResult = await pool.query(query, params);

    if (insResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const inspection = insResult.rows[0];

    const answersResult = await pool.query(`
      SELECT a.*, ci.question
      FROM inspection_answers a
      JOIN checklist_items ci ON a.item_id = ci.id
      WHERE a.inspection_id = $1 AND(a.photo_url IS NOT NULL OR a.photo_after_url IS NOT NULL)
    `, [req.params.inspectionId]);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename = relatorio - fotografico - ${inspection.id}.pdf`);
    doc.pipe(res);

    addPdfHeader(doc, 'RELATÓRIO FOTOGRÁFICO');

    doc.fontSize(12).font('Helvetica-Bold').text('Informações');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Empresa: ${inspection.company_name} `);
    doc.text(`Data: ${new Date(inspection.date).toLocaleDateString('pt-BR')} `);
    doc.text(`Total de Evidências: ${answersResult.rows.length} `);
    doc.moveDown();

    answersResult.rows.forEach((ans: any, index: number) => {
      doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${ans.question} `);
      if (ans.observation) {
        doc.fontSize(9).font('Helvetica').text(`Observação: ${ans.observation} `);
      }
      doc.fontSize(9).text(`Foto Antes: ${ans.photo_url ? 'Sim' : 'Não'} | Foto Depois: ${ans.photo_after_url ? 'Sim' : 'Não'} `);
      doc.moveDown();
    });

    doc.fontSize(9).fillColor('gray').text('Nota: As imagens originais estão disponíveis na Galeria de Evidências do sistema.');
    doc.fillColor('black');

    addPdfFooter(doc, 1);
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF' });
  }
});


// Action Plan Report PDF
app.get('/api/reports/action-plan/:riskId/pdf', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    let query = `
      SELECT r.*, c.name as company_name
      FROM risks r
      JOIN companies c ON r.company_id = c.id
      WHERE r.id = $1
      `;
    const params: any[] = [req.params.riskId];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    const riskResult = await pool.query(query, params);

    if (riskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    const risk = riskResult.rows[0];

    const actionsResult = await pool.query(`
    SELECT * FROM action_plans WHERE risk_id = $1 ORDER BY deadline ASC
    `, [req.params.riskId]);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=plano-acao-${risk.id}.pdf`);
    doc.pipe(res);

    addPdfHeader(doc, 'PLANO DE AÇÃO - PGR/GRO');

    doc.fontSize(12).font('Helvetica-Bold').text('Identificação do Risco');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Empresa: ${risk.company_name}`);
    doc.text(`Tipo de Risco: ${risk.risk_type}`);
    doc.text(`Descrição: ${risk.description}`);
    doc.text(`Fonte / Agente: ${risk.source || 'N/A'}`);
    doc.text(`Probabilidade: ${risk.probability} | Severidade: ${risk.severity} | Nível: ${risk.risk_level}`);
    doc.text(`Status: ${risk.status}`);
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Medidas Corretivas');
    doc.moveDown(0.5);

    if (actionsResult.rows.length === 0) {
      doc.fontSize(10).font('Helvetica').text('Nenhum plano de ação cadastrado.');
    } else {
      actionsResult.rows.forEach((action: any, index: number) => {
        doc.fontSize(10).font('Helvetica-Bold').text(`${index + 1}. ${action.measure}`);
        doc.fontSize(9).font('Helvetica');
        doc.text(`   Responsável: ${action.responsible}`);
        doc.text(`   Prazo: ${new Date(action.deadline).toLocaleDateString('pt-BR')}`);
        doc.text(`   Status: ${action.status}`);
        if (action.notes) doc.text(`   Notas: ${action.notes}`);
        doc.moveDown(0.5);
      });
    }

    addPdfFooter(doc, 1);
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF' });
  }
});

// EPI History Report PDF
app.get('/api/reports/epi-history/:employeeId', authenticate, async (req: Request, res: Response) => {
  const { employeeId } = req.params;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    let query = `
      SELECT e.*, c.name as company_name 
      FROM employees e
      JOIN companies c ON e.company_id = c.id
      WHERE e.id = $1
    `;
    const params: any[] = [employeeId];

    if (ownerId) {
      query += ' AND c.owner_id = $2';
      params.push(ownerId);
    }

    const empResult = await pool.query(query, params);

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const employee = empResult.rows[0];

    // Fetch Deliveries
    const deliveriesResult = await pool.query(`
      SELECT ed.*, epi.name as epi_name, epi.ca_number, epi.manufacturer
      FROM epi_deliveries ed
      JOIN epis epi ON ed.epi_id = epi.id
      WHERE ed.employee_id = $1
      ORDER BY ed.delivery_date DESC
    `, [employeeId]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=ficha-epi-${employee.name.replace(/\s/g, '-')}.pdf`);
    doc.pipe(res);

    addPdfHeader(doc, 'FICHA DE CONTROLE DE EPI');

    // Employee Info Box
    doc.rect(50, 100, 500, 60).stroke();
    doc.fontSize(10).font('Helvetica-Bold').text('DADOS DO COLABORADOR', 60, 110);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Nome: ${employee.name}`, 60, 130);
    doc.text(`Função: ${employee.role}`, 300, 130);
    doc.text(`CPF: ${employee.cpf || 'Não informado'}`, 60, 145);
    doc.text(`Admissão: ${employee.admission_date ? new Date(employee.admission_date).toLocaleDateString('pt-BR') : '-'}`, 300, 145);
    doc.moveDown(4);

    // Termo Responsibility
    doc.fontSize(10).font('Helvetica-Bold').text('TERMO DE RESPONSABILIDADE', 50, 180);
    doc.fontSize(8).font('Helvetica').text(
      'Recebi os Equipamentos de Proteção Individual (EPI) constantes nesta ficha, gratuitamente, para uso exclusivo no trabalho. ' +
      'Declaro estar ciente da obrigatoriedade do seu uso, e comprometo-me a devolvê-los em caso de desligamento ou troca. ' +
      'Também estou ciente de que o extravio ou dano injustificado poderá ser descontado conforme previsto no artigo 462 §1º da CLT.',
      50, 195, { align: 'justify', width: 500 }
    );
    doc.moveDown(2);

    // Deliveries Table Header
    const tableTop = 240;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Data', 50, tableTop);
    doc.text('EPI / CA', 110, tableTop);
    doc.text('Qtd', 300, tableTop);
    doc.text('Motivo', 340, tableTop);
    doc.text('Assinatura', 450, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;

    deliveriesResult.rows.forEach((del: any) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(9).font('Helvetica');
      doc.text(new Date(del.delivery_date).toLocaleDateString('pt-BR'), 50, y);
      doc.text(`${del.epi_name}\nCA: ${del.ca_number}`, 110, y, { width: 180 });
      doc.text(del.quantity.toString(), 300, y);
      doc.text(del.reason, 340, y);

      if (del.employee_signature) {
        doc.fillColor('green').text('(Assinado Digitalmente)', 450, y);
        doc.fillColor('black');
      } else {
        doc.text('__________________', 450, y);
      }

      y += 35; // Row height
      doc.moveTo(50, y - 5).lineTo(550, y - 5).strokeColor('#eee').stroke();
    });

    addPdfFooter(doc, 1);
    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// --- Certificate Templates ---
const templateStorage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadPath = path.join(__dirname, '../uploads/templates');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, `template-${Date.now()}-${file.originalname}`);
  }
});
const uploadTemplate = multer({ storage: templateStorage });

app.post('/api/certificate-templates', authenticate, uploadTemplate.single('background'), async (req: AuthRequest, res: Response) => {
  const { name, body_text } = req.body;
  const file = req.file;
  if (!file || !name) return res.status(400).json({ error: 'Name and file are required' });

  try {
    const fileUrl = `/uploads/templates/${file.filename}`;
    // Insert with Verso Text - owner_id is req.user.id for user, or admin logic if specific
    const result = await pool.query(
      'INSERT INTO certificate_templates (owner_id, name, image_url, body_text, verso_text) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user?.id, name, fileUrl, body_text || null, req.body.verso_text || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

import { importPPTXFolder } from './pptx-import';

app.post('/api/certificate-templates/import-folder', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Permission Denied. Only admins can import template folders.' });
  }
  try {
    const result = await importPPTXFolder(pool, Number(req.user!.id));
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/certificate-templates', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    // Show templates owned by user (ownerId) OR global ones (IS NULL)
    // If ownerId is undefined (Master), show all.
    let query = 'SELECT * FROM certificate_templates WHERE 1=1';
    const params: any[] = [];

    if (ownerId) {
      query += ' AND (owner_id = $1 OR owner_id IS NULL)';
      params.push(ownerId);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);

    console.log('[DEBUG_TEMPLATES] Count:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('[DEBUG_TEMPLATES] First item:', result.rows[0]);
      console.log('[DEBUG_TEMPLATES] image_url type:', typeof result.rows[0].image_url);
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/certificate-templates/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Enforce ownership for DELETE too
    const ownerId = req.user?.owner_id || req.user?.id;
    let query = 'DELETE FROM certificate_templates WHERE id = $1';
    const params: any[] = [req.params.id];

    if (ownerId) {
      // Tech can only delete THEIR templates.
      query += ' AND owner_id = $2';
      params.push(ownerId);
    }

    const result = await pool.query(query + ' RETURNING *', params);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found or permission denied' });

    // Optionally delete file from disk
    const tmpl = result.rows[0];
    const filePath = path.join(__dirname, `..${tmpl.image_url}`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/certificate-templates/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, body_text } = req.body;

  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    // Check allow logic: 
    // If Master (ownerId undefined), allow all.
    // If Tech (ownerId defined), allow ONLY if resource owner_id = ownerId.
    // SYSTEM TEMPLATES (owner_id IS NULL) CANNOT BE EDITED BY TECH.

    let checkQuery = 'SELECT owner_id FROM certificate_templates WHERE id = $1';
    const checkRes = await pool.query(checkQuery, [id]);

    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const resourceOwner = checkRes.rows[0].owner_id;

    if (ownerId) {
      // Enforce ownership
      if (resourceOwner !== ownerId) {
        return res.status(403).json({ error: 'Permission Denied. You cannot edit this template.' });
      }
    }

    const result = await pool.query(
      'UPDATE certificate_templates SET name = $1, body_text = $2, verso_text = $3 WHERE id = $4 RETURNING *',
      [name, body_text, req.body.verso_text, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// --- Standard Texts API ---
app.get('/api/standard-texts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM standard_texts ORDER BY title ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Consolidated legacy code removal

// Stray code removed

// Configure Multer for Text Uploads (Memory Storage to read content immediately)
const textStorage = multer.memoryStorage();
const uploadText = multer({ storage: textStorage });

app.post('/api/standard-texts/upload', authenticate, uploadText.array('files'), async (req: AuthRequest, res: Response) => {
  try {
    const files = (req as any).files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const results = [];
    for (const file of files) {
      // Assume file name is Title (remove extension)
      const title = file.originalname.replace(/\.txt$/i, '');
      const content = file.buffer.toString('utf-8'); // Read content

      // Insert
      const dbRes = await pool.query(
        'INSERT INTO standard_texts (title, content) VALUES ($1, $2) RETURNING *',
        [title, content]
      );
      results.push(dbRes.rows[0]);
    }
    res.json({ success: true, count: results.length, items: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// --- Trainings Endpoints ---

// Duplicate storage/upload removed

app.post('/api/trainings/upload', upload.single('certificate'), (req: Request, res: Response) => {
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/certificates/${file.filename}`;
  res.json({ url: fileUrl });
});


app.get('/api/trainings', async (req: Request, res: Response) => {
  const { company_id } = req.query;
  try {
    const result = await pool.query(`
            SELECT t.*, e.name as employee_name, e.role as employee_role
            FROM trainings t
            JOIN employees e ON t.employee_id = e.id
            JOIN companies c ON t.company_id = c.id
            WHERE t.company_id = $1
            ${getSafeOwnerId(req as AuthRequest) ? "AND c.owner_id = '" + getSafeOwnerId(req as AuthRequest) + "'" : ""}
            ORDER BY t.validity_date ASC
        `, [company_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/api/trainings', async (req: Request, res: Response) => {
  const { company_id, employee_id, course_name, training_date, validity_date, status, certificate_url, employee_ids, template_id } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const createdTrainings = [];
    // Handle multiple employees
    const targets = (employee_ids && Array.isArray(employee_ids)) ? employee_ids : [employee_id];

    for (const empId of targets) {
      if (!empId) continue;
      const result = await client.query(
        'INSERT INTO trainings (company_id, employee_id, course_name, training_date, validity_date, status, certificate_url, template_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [company_id, empId, course_name, training_date, validity_date, status, certificate_url, template_id || null]
      );
      createdTrainings.push(result.rows[0]);
    }

    await client.query('COMMIT');

    // If single, return obj. If multiple, return array. Frontend handles both?
    // Let's return the first one or array. Standard REST usually returns one resource per POST, but batch is different.
    // For compatibility with current frontend (which might expect single obj if not prepared), we check.
    // But frontend sends employee_ids, so it expects maybe array or just 201.
    res.status(201).json(createdTrainings.length === 1 ? createdTrainings[0] : createdTrainings);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});



app.put('/api/trainings/:id', async (req: Request, res: Response) => {
  const { course_name, training_date, validity_date, status, certificate_url, template_id } = req.body;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE trainings SET course_name = $1, training_date = $2, validity_date = $3, status = $4, certificate_url = $5, template_id = $6 WHERE id = $7 RETURNING *',
      [course_name, training_date, validity_date, status, certificate_url, template_id, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.delete('/api/trainings/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM trainings WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// =====================
// INCIDENT MANAGEMENT APIs
// =====================

const incidentStorage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadPath = path.join(__dirname, '../uploads/incidents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, `inc - ${Date.now()} -${file.originalname} `);
  }
});

const uploadIncident = multer({ storage: incidentStorage });

app.post('/api/incidents/upload', authenticate, uploadIncident.single('photo'), (req: Request, res: Response) => {
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/ uploads / incidents / ${file.filename} `;
  res.json({ url: fileUrl });
});

// Incidents API moved to line 3035 for consolidation

// Incidents API
app.get('/api/incidents', authenticate, async (req: Request, res: Response) => {
  const { company_id } = req.query;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = `
      SELECT i.*, e.name as employee_name, c.name as company_name, i.incident_type as type
      FROM incidents i
      LEFT JOIN employees e ON i.employee_id = e.id
      JOIN companies c ON i.company_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (company_id) {
      query += ` AND i.company_id = $${pIdx++}`;
      params.push(company_id);
    }

    if (ownerId) {
      query += ` AND c.owner_id = $${pIdx++}`;
      params.push(ownerId);
    }

    query += ' ORDER BY i.date DESC';
    const result = await pool.query(query, params);

    const incidents = result.rows;
    for (const inc of incidents) {
      const photos = await pool.query('SELECT url FROM incident_photos WHERE incident_id = $1', [inc.id]);
      inc.photos = photos.rows.map((p: any) => p.url);

      const plans = await pool.query('SELECT * FROM action_plans WHERE incident_id = $1', [inc.id]);
      inc.action_plans = plans.rows;
    }

    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/incidents', authenticate, async (req: Request, res: Response) => {
  const { company_id, employee_id, type, date, location, description, severity, status, photos } = req.body;
  try {
    // Basic auth check already done by middleware
    const result = await pool.query(
      'INSERT INTO incidents (company_id, employee_id, incident_type, date, location, description, severity, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *, incident_type as type',
      [company_id, employee_id || null, type, date, location, description, severity, status || 'Aberto']
    );
    const incident = result.rows[0];

    if (photos && Array.isArray(photos)) {
      for (const url of photos) {
        await pool.query('INSERT INTO incident_photos (incident_id, url) VALUES ($1, $2)', [incident.id, url]);
      }
    }

    res.status(201).json(incident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/incidents/:id', authenticate, async (req: Request, res: Response) => {
  const {
    investigation_result, status, type, date, location, description, severity,
    generating_source, body_part, injured_person_report, witness_report, possible_causes, conclusion
  } = req.body;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE incidents SET
      investigation_result = COALESCE($1, investigation_result),
      status = COALESCE($2, status),
      incident_type = COALESCE($3, incident_type),
      date = COALESCE($4, date),
      location = COALESCE($5, location),
      description = COALESCE($6, description),
      severity = COALESCE($7, severity),
      generating_source = COALESCE($8, generating_source),
      body_part = COALESCE($9, body_part),
      injured_person_report = COALESCE($10, injured_person_report),
      witness_report = COALESCE($11, witness_report),
      possible_causes = COALESCE($12, possible_causes),
      conclusion = COALESCE($13, conclusion)
       WHERE id = $14 RETURNING *, incident_type as type`,
      [
        investigation_result, status, type, date, location, description, severity,
        generating_source, body_part, injured_person_report, witness_report, possible_causes, conclusion,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/incidents/:id/actions', authenticate, async (req: Request, res: Response) => {
  const { measure, responsible, deadline, status, notes }: ActionPlanBody = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO action_plans (incident_id, measure, responsible, deadline, status, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.id, measure, responsible, deadline, status || 'pendente', notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// End of consolidated stats endpoint area


// =====================
// EPI MANGEMENT APIs
// =====================

// EPIs route consolidated with line 1339

// Employees route consolidated with line 1274

// 3. EPI Deliveries
app.get('/api/epi-deliveries', authenticate, async (req: Request, res: Response) => {
  const { company_id } = req.query;
  try {
    const result = await pool.query(`
      SELECT d.*, e.name as employee_name, ep.name as epi_name, ep.ca_number
      FROM epi_deliveries d
      JOIN employees e ON d.employee_id = e.id
      JOIN epis ep ON d.epi_id = ep.id
      WHERE e.company_id = $1
      ORDER BY d.delivery_date DESC
    `, [company_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/epi-deliveries', authenticate, async (req: Request, res: Response) => {
  const { company_id, employee_id, epi_id, quantity, reason, employee_signature } = req.body;

  if (!employee_id || !epi_id || !quantity) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // 1. Get EPI validity and check stock
    const epiRes = await pool.query('SELECT * FROM epis WHERE id = $1', [epi_id]);
    if (epiRes.rows.length === 0) return res.status(404).json({ error: 'EPI not found' });
    const epi = epiRes.rows[0];

    if (epi.stock_quantity < quantity) {
      return res.status(400).json({ error: `Estoque insuficiente.Disponível: ${epi.stock_quantity} ` });
    }

    // 2. Calculate next exchange date
    const deliveryDate = new Date();
    const nextExchange = new Date(deliveryDate);
    nextExchange.setDate(nextExchange.getDate() + (epi.validity_days || 0));

    // 3. Insert Delivery
    const result = await pool.query(
      `INSERT INTO epi_deliveries
      (employee_id, epi_id, quantity, delivery_date, reason, employee_signature, next_exchange_date, validity_date)
    VALUES($1, $2, $3, $4, $5, $6, $7, $7) RETURNING * `,
      [employee_id, epi_id, quantity, deliveryDate, reason, employee_signature, nextExchange]
    );

    // 4. Update Stock
    await pool.query('UPDATE epis SET stock_quantity = stock_quantity - $1 WHERE id = $2', [quantity, epi_id]);

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    // Handle specific DB errors might be good, but for now generic
    if (err.code === '23502') return res.status(400).json({ error: 'Missing DB fields' });
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
});

app.put('/api/epi-deliveries/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, reason, employee_signature } = req.body;

  try {
    const oldRes = await pool.query('SELECT * FROM epi_deliveries WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });
    const oldDelivery = oldRes.rows[0];

    // Stock Adjustment
    if (quantity !== undefined && quantity !== oldDelivery.quantity) {
      const diff = quantity - oldDelivery.quantity;

      if (diff > 0) {
        const epiRes = await pool.query('SELECT stock_quantity FROM epis WHERE id = $1', [oldDelivery.epi_id]);
        if (epiRes.rows[0].stock_quantity < diff) {
          return res.status(400).json({ error: 'Estoque insuficiente para o aumento de quantidade.' });
        }
      }

      await pool.query('UPDATE epis SET stock_quantity = stock_quantity - $1 WHERE id = $2', [diff, oldDelivery.epi_id]);
    }

    const result = await pool.query(
      `UPDATE epi_deliveries 
             SET quantity = COALESCE($1, quantity),
      reason = COALESCE($2, reason),
      employee_signature = COALESCE($3, employee_signature)
             WHERE id = $4
    RETURNING * `,
      [quantity, reason, employee_signature, id]
    );
    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/epi-deliveries/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const oldRes = await pool.query('SELECT * FROM epi_deliveries WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });
    const oldDelivery = oldRes.rows[0];

    // Refund stock
    await pool.query('UPDATE epis SET stock_quantity = stock_quantity + $1 WHERE id = $2', [oldDelivery.quantity, oldDelivery.epi_id]);

    await pool.query('DELETE FROM epi_deliveries WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Note: transporter and twilioClient are already defined at top of file. 
// Reusing them here.

async function sendEmail(to: string, subject: string, html: string) {
  // If no real SMTP config, simulate success for UI/DB purposes
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'mock_user') {
    console.log('Email Simulation active.');
    console.log(`To: ${to} \nSubject: ${subject} \nContent: ${html.replace(/<[^>]*>?/gm, '')} `);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"SafeGuardPro SST" <noreply@safeguardpro.com>',
      to,
      subject,
      html,
    });
    console.log('Message sent: %s', info.messageId);
    return { success: true, simulated: false };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, simulated: false };
  }
}

async function sendWhatsApp(to: string, message: string) {
  if (!twilioClient || !process.env.TWILIO_FROM_NUMBER) {
    console.log('WhatsApp Simulation active.');
    console.log(`To: ${to} \nMessage: ${message} `);
    return { success: true, simulated: true };
  }

  try {
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to} `;
    const result = await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_FROM_NUMBER} `,
      to: formattedTo,
      body: message,
    });
    console.log('WhatsApp sent: %s', result.sid);
    return { success: true, simulated: false };
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return { success: false, simulated: false };
  }
}

app.post('/api/notifications/run-sync', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const results: any[] = [];

    // 1. Trainings expiring (Next 30 days)
    const trainings = await pool.query(`
      SELECT t.*, e.name as employee_name, e.company_id, c.email as company_email, c.name as company_name, c.phone as company_phone
      FROM trainings t
      JOIN employees e ON t.employee_id = e.id
      JOIN companies c ON e.company_id = c.id
      WHERE t.validity_date <= (CURRENT_DATE + interval '30 days') 
        AND t.status != 'expired'
        AND NOT EXISTS(
      SELECT 1 FROM notifications n 
          WHERE n.recipient = c.email 
            AND n.category = 'training' 
            AND n.content LIKE '%' || t.course_name || '%'
            AND n.sent_at > (CURRENT_DATE - interval '7 days')
        )
    `);

    console.log(`Found ${trainings.rows.length} trainings to notify`);

    for (const t of trainings.rows) {
      console.log(`Processing training: ${t.course_name} for ${t.employee_name}`);
      const subject = `Alerta de Vencimento: Treinamento - ${t.course_name} `;
      const content = `O treinamento < b > ${t.course_name} </b> do colaborador <b>${t.employee_name}</b > da empresa < b > ${t.company_name} </b> vence em ${new Date(t.validity_date).toLocaleDateString()}.`;
      const result = await sendEmail(t.company_email, subject, content);

      if (result.success) {
        await pool.query(
          'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [t.company_id, 'email', 'training', t.company_email, subject, content, result.simulated ? 'simulated' : 'sent']
        );
        results.push({ type: 'training', recipient: t.company_email, channel: 'email', status: result.simulated ? 'simulated' : 'sent' });

        // WhatsApp
        if (t.company_phone) {
          const waResult = await sendWhatsApp(t.company_phone, `SafeGuardPro: O treinamento ${t.course_name} de ${t.employee_name} vence em ${new Date(t.validity_date).toLocaleDateString()}.`);
          if (waResult.success) {
            await pool.query(
              'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [t.company_id, 'whatsapp', 'training', t.company_phone, subject, content, waResult.simulated ? 'simulated' : 'sent']
            );
            results.push({ type: 'training', recipient: t.company_phone, channel: 'whatsapp', status: waResult.simulated ? 'simulated' : 'sent' });
          }
        }
      }
    }

    // 2. EPIs expiring
    const epis = await pool.query(`
      SELECT ed.*, e.name as employee_name, ep.name as epi_name, e.company_id, c.email as company_email, c.phone as company_phone
      FROM epi_deliveries ed
      JOIN employees e ON ed.employee_id = e.id
      JOIN epis ep ON ed.epi_id = ep.id
      JOIN companies c ON e.company_id = c.id
      WHERE ed.next_exchange_date <= (CURRENT_DATE + interval '30 days')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n 
          WHERE n.recipient = c.email 
            AND n.category = 'epi' 
            AND n.content LIKE '%' || ep.name || '%'
            AND n.sent_at > (CURRENT_DATE - interval '7 days')
        )
    `);

    for (const epi of epis.rows) {
      const subject = `Alerta de Troca de EPI: ${epi.epi_name}`;
      const content = `O EPI <b>${epi.epi_name}</b> do colaborador <b>${epi.employee_name}</b> deve ser trocado até ${new Date(epi.next_exchange_date).toLocaleDateString()}.`;
      const result = await sendEmail(epi.company_email, subject, content);

      if (result.success) {
        await pool.query(
          'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [epi.company_id, 'email', 'epi', epi.company_email, subject, content, result.simulated ? 'simulated' : 'sent']
        );
        results.push({ type: 'epi', recipient: epi.company_email, channel: 'email', status: result.simulated ? 'simulated' : 'sent' });

        if (epi.company_phone) {
          const waResult = await sendWhatsApp(epi.company_phone, `SafeGuardPro: O EPI ${epi.epi_name} de ${epi.employee_name} deve ser trocado até ${new Date(epi.next_exchange_date).toLocaleDateString()}.`);
          if (waResult.success) {
            await pool.query(
              'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [epi.company_id, 'whatsapp', 'epi', epi.company_phone, subject, content, waResult.simulated ? 'simulated' : 'sent']
            );
            results.push({ type: 'epi', recipient: epi.company_phone, channel: 'whatsapp', status: waResult.simulated ? 'simulated' : 'sent' });
          }
        }
      }
    }

    // 3. ASO Expirations (Next 30 days)
    const asos = await pool.query(`
      SELECT a.*, e.name as employee_name, e.company_id, c.email as company_email, c.name as company_name, c.phone as company_phone
      FROM asos a
      JOIN employees e ON a.employee_id = e.id
      JOIN companies c ON e.company_id = c.id
      WHERE a.valid_until <= (CURRENT_DATE + interval '30 days')
        AND a.status != 'Expirado'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n 
          WHERE n.recipient = c.email 
            AND n.category = 'aso' 
            AND n.sent_at > (CURRENT_DATE - interval '7 days')
        )
    `);

    for (const aso of asos.rows) {
      const subject = `Alerta de Vencimento de ASO: ${aso.employee_name}`;
      const content = `O ASO (${aso.type}) do colaborador <b>${aso.employee_name}</b> vence em ${new Date(aso.valid_until).toLocaleDateString()}. Recomenda-se agendar o exame periódico.`;
      const result = await sendEmail(aso.company_email, subject, content);

      if (result.success) {
        await pool.query(
          'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [aso.company_id, 'email', 'aso', aso.company_email, subject, content, result.simulated ? 'simulated' : 'sent']
        );
        results.push({ type: 'aso', recipient: aso.company_email, channel: 'email', status: result.simulated ? 'simulated' : 'sent' });

        if (aso.company_phone) {
          const waResult = await sendWhatsApp(aso.company_phone, `SafeGuardPro: O ASO de ${aso.employee_name} vence em ${new Date(aso.valid_until).toLocaleDateString()}. Agende o exame periódico.`);
          if (waResult.success) {
            await pool.query(
              'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [aso.company_id, 'whatsapp', 'aso', aso.company_phone, subject, content, waResult.simulated ? 'simulated' : 'sent']
            );
            results.push({ type: 'aso', recipient: aso.company_phone, channel: 'whatsapp', status: waResult.simulated ? 'simulated' : 'sent' });
          }
        }
      }
    }

    // 4. Action Plans Overdue
    const actions = await pool.query(`
      SELECT ap.*, r.company_id as risk_company, i.company_id as incident_company, c1.email as email1, c2.email as email2, c1.phone as phone1, c2.phone as phone2
      FROM action_plans ap
      LEFT JOIN risks r ON ap.risk_id = r.id
      LEFT JOIN incidents i ON ap.incident_id = i.id
      LEFT JOIN companies c1 ON r.company_id = c1.id
      LEFT JOIN companies c2 ON i.company_id = c2.id
      WHERE ap.deadline < CURRENT_DATE 
        AND ap.status IN ('pendente', 'em_andamento')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n 
          WHERE n.category = 'action_plan' 
            AND n.content LIKE '%' || ap.measure || '%'
            AND n.sent_at > (CURRENT_DATE - interval '3 days')
        )
    `);

    for (const a of actions.rows) {
      const company_id = a.risk_company || a.incident_company;
      const email = a.email1 || a.email2;
      if (!email) continue;

      const subject = `Plano de Ação ATRASADO: ${a.measure.substring(0, 30)}...`;
      const content = `O plano de ação <b>${a.measure}</b> sob responsabilidade de <b>${a.responsible}</b> está com o prazo vencido (${new Date(a.deadline).toLocaleDateString()}).`;
      const result = await sendEmail(email, subject, content);

      if (result.success) {
        await pool.query(
          'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [company_id, 'email', 'action_plan', email, subject, content, result.simulated ? 'simulated' : 'sent']
        );
        results.push({ type: 'action_plan', recipient: email, channel: 'email', status: result.simulated ? 'simulated' : 'sent' });

        const phone = a.phone1 || a.phone2;
        if (phone) {
          const waResult = await sendWhatsApp(phone, `SafeGuardPro: O plano de ação "${a.measure.substring(0, 30)}..." está atrasado (${new Date(a.deadline).toLocaleDateString()}).`);
          if (waResult.success) {
            await pool.query(
              'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [company_id, 'whatsapp', 'action_plan', phone, subject, content, waResult.simulated ? 'simulated' : 'sent']
            );
            results.push({ type: 'action_plan', recipient: phone, channel: 'whatsapp', status: waResult.simulated ? 'simulated' : 'sent' });
          }
        }
      }
    }

    // 4. Scheduled Visits (Next 48h)
    const visits = await pool.query(`
      SELECT v.*, c.email as company_email, c.name as company_name, c.phone as company_phone
      FROM visits v
      JOIN companies c ON v.company_id = c.id
      WHERE v.scheduled_at >= NOW() 
        AND v.scheduled_at <= (NOW() + interval '48 hours')
        AND v.status = 'Agendado'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n 
          WHERE n.recipient = c.email 
            AND n.category = 'visit' 
            AND n.content LIKE '%' || to_char(v.scheduled_at, 'DD/MM/YYYY') || '%'
            AND n.sent_at > (NOW() - interval '24 hours')
        )
    `);

    for (const v of visits.rows) {
      const subject = `Lembrete de Visita Técnica: ${v.visit_type}`;
      const content = `Lembramos que há uma visita do tipo <b>${v.visit_type}</b> agendada para o dia <b>${new Date(v.scheduled_at).toLocaleString()}</b> na empresa ${v.company_name}.`;
      const result = await sendEmail(v.company_email, subject, content);

      if (result.success) {
        await pool.query(
          'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [v.company_id, 'email', 'visit', v.company_email, subject, content, result.simulated ? 'simulated' : 'sent']
        );
        results.push({ type: 'visit', recipient: v.company_email, channel: 'email', status: result.simulated ? 'simulated' : 'sent' });

        if (v.company_phone) {
          const waResult = await sendWhatsApp(v.company_phone, `SafeGuardPro: Lembrete de visita técnica de ${v.visit_type} em ${new Date(v.scheduled_at).toLocaleString()}.`);
          if (waResult.success) {
            await pool.query(
              'INSERT INTO notifications (company_id, type, category, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [v.company_id, 'whatsapp', 'visit', v.company_phone, subject, content, waResult.simulated ? 'simulated' : 'sent']
            );
            results.push({ type: 'visit', recipient: v.company_phone, channel: 'whatsapp', status: waResult.simulated ? 'simulated' : 'sent' });
          }
        }
      }
    }

    res.json({ success: true, processed: results.length, details: results });
  } catch (err: any) {
    console.error('Sync Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/notifications', authenticate, async (req: Request, res: Response) => {
  console.log('Notifications Endpoint Hit!');
  const { company_id } = req.query;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json([]);

    let query = 'SELECT n.* FROM notifications n JOIN companies c ON n.company_id = c.id WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (company_id) {
      query += ` AND n.company_id = $${pIdx++}`;
      params.push(company_id);
    }

    if (ownerId) {
      query += ` AND c.owner_id = $${pIdx++}`;
      params.push(ownerId);
    }

    query += ' ORDER BY n.sent_at DESC LIMIT 50';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/stats', authenticate, async (req: Request, res: Response) => {
  const { company_id } = req.query;
  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.json({});

    if (!company_id) {
      return res.json({
        compliance_rate: 0,
        risks_by_type: [],
        expired_epis: 0,
        trainings_expiring: 0,
        open_actions: 0,
        actions_by_status: [],
        incident_history: []
      });
    }

    // Verify company access
    if (ownerId) {
      const compCheck = await pool.query('SELECT 1 FROM companies WHERE id = $1 AND owner_id = $2', [company_id, ownerId]);
      if (compCheck.rows.length === 0) return res.status(403).json({ error: 'Permission Denied' });
    }

    const complianceRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'C') as compliant,
        COUNT(*) FILTER (WHERE status IN ('C', 'NC')) as total
      FROM inspection_answers
      WHERE inspection_id IN (SELECT id FROM inspections WHERE company_id = $1)
    `, [company_id]);

    const { compliant, total } = complianceRes.rows[0];
    const compliance_rate = total > 0 ? (parseInt(compliant) / parseInt(total)) * 100 : 100;

    // 2. Risks by Type
    const risksRes = await pool.query(`
      SELECT r.risk_type, COUNT(*) as count 
      FROM risks r
      WHERE r.company_id = $1 
      GROUP BY r.risk_type
    `, [company_id]);

    // 3. EPIs expiring
    const episRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM epi_deliveries 
      WHERE epi_id IN (SELECT id FROM epis WHERE company_id = $1)
        AND validity_date <= (CURRENT_DATE + interval '30 days')
    `, [company_id]);

    // 4. Trainings to expire
    const trainingsRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM trainings 
      WHERE (company_id = $1 OR employee_id IN (SELECT id FROM employees WHERE company_id = $1))
        AND validity_date <= (CURRENT_DATE + interval '30 days') 
        AND status != 'expired'
    `, [company_id]);

    // 5. Actions by status
    const actionsRes = await pool.query(`
      SELECT status as name, COUNT(*) as count 
      FROM action_plans 
      WHERE risk_id IN (SELECT id FROM risks WHERE company_id = $1) 
        AND status IN ('pendente', 'em_andamento')
      GROUP BY status
    `, [company_id]);


    // 6. Incidents by Period
    const incidentsRes = await pool.query(`
      WITH periods AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - interval '5 months',
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) as month_date
      )
      SELECT 
        to_char(p.month_date, 'Mon') as name,
        (SELECT COUNT(*) FROM incidents i WHERE i.company_id = $1 AND date_trunc('month', i.date) = p.month_date) as value
      FROM periods p
      ORDER BY p.month_date ASC
    `, [company_id]);

    res.json({
      compliance_rate: Math.round(compliance_rate),
      risks_by_type: risksRes.rows.map((r: any) => ({ name: r.risk_type, value: parseInt(r.count) })),
      expired_epis: parseInt(episRes.rows[0].count),
      trainings_expiring: parseInt(trainingsRes.rows[0].count),
      open_actions: actionsRes.rows.reduce((acc: number, row: any) => acc + parseInt(row.count), 0),
      actions_by_status: actionsRes.rows.map((r: any) => ({ name: r.name, value: parseInt(r.count) })),

      incident_history: incidentsRes.rows.map((r: any) => ({ name: r.name, value: parseInt(r.value) }))
    });

  } catch (err: any) {
    console.error('Stats Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




// LGPD: Register consent
app.post('/api/lgpd/consent', authenticate, async (req: Request, res: Response) => {
  const { entity_type, entity_id, purpose, consent_given, consent_text } = req.body;

  if (!entity_type || !entity_id || !purpose || typeof consent_given !== 'boolean') {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO data_consents (entity_type, entity_id, purpose, consent_given, consented_at, ip_address, consent_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [entity_type, entity_id, purpose, consent_given, consent_given ? new Date() : null, req.ip, consent_text]
    );

    await logAction(undefined, undefined, 'CONSENT_REGISTERED', entity_type, entity_id, { purpose, consent_given }, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// LGPD: Export personal data (portability)
app.get('/api/lgpd/data/:entity_type/:entity_id', authenticate, async (req: AuthRequest, res: Response) => {
  const { entity_type, entity_id } = req.params;

  try {
    const ownerId = getSafeOwnerId(req as AuthRequest);
    if (ownerId === 'DENY_ALL') return res.status(403).json({ error: 'Permission Denied' });

    const data: any = {};

    // Export based on entity type
    if (entity_type === 'employee') {
      let empQuery = 'SELECT e.* FROM employees e JOIN companies c ON e.company_id = c.id WHERE e.id = $1';
      const empParams = [entity_id];
      if (ownerId) {
        empQuery += ' AND c.owner_id = $2';
        empParams.push(ownerId);
      }
      const employee = await pool.query(empQuery, empParams);
      if (employee.rows.length === 0) return res.status(404).json({ error: 'Employee not found or Access Denied' });
      data.employee = employee.rows[0];

      const trainings = await pool.query('SELECT * FROM trainings WHERE employee_id = $1', [entity_id]);
      data.trainings = trainings.rows;

      const epiDeliveries = await pool.query('SELECT * FROM epi_deliveries WHERE employee_id = $1', [entity_id]);
      data.epi_deliveries = epiDeliveries.rows;

      const incidents = await pool.query('SELECT * FROM incidents WHERE employee_id = $1', [entity_id]);
      data.incidents = incidents.rows;
    } else if (entity_type === 'company') {
      let compQuery = 'SELECT * FROM companies WHERE id = $1';
      const compParams = [entity_id];
      if (ownerId) {
        compQuery += ' AND owner_id = $2';
        compParams.push(ownerId);
      }
      const company = await pool.query(compQuery, compParams);
      if (company.rows.length === 0) return res.status(404).json({ error: 'Company not found or Access Denied' });
      data.company = company.rows[0];

      const employees = await pool.query('SELECT * FROM employees WHERE company_id = $1', [entity_id]);
      data.employees = employees.rows;
    }

    // Get consents
    const consents = await pool.query('SELECT * FROM data_consents WHERE entity_type = $1 AND entity_id = $2', [entity_type, entity_id]);
    data.consents = consents.rows;

    await logAction(req.user?.id, req.user?.role, 'DATA_EXPORT', entity_type, entity_id, null, req.ip);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ======================================
// BACKUP ROUTES
// ======================================

const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// List Backups
app.get('/api/backup/list', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
    const backups = files.map((file, index) => {
      // Try parse date from filename: backup-manual-YYYY-MM-DDTHH-mm-ssZ.sql
      let date = new Date(0); // Default 1969
      try {
        const parts = file.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
        if (parts) {
          date = new Date(`${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}:${parts[6]}Z`);
        } else {
          const stats = fs.statSync(path.join(backupDir, file));
          date = stats.birthtime;
        }
      } catch (e) {
        console.error('Date parse error', e);
      }

      return {
        id: index + 1,
        file_path: file,
        created_at: date,
        status: 'success',
        backup_type: 'manual'
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(backups);
  } catch (err) {
    console.error('Error listing backups:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Audit Logs
app.get('/api/audit-logs', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const result = await pool.query(
      `SELECT al.*, u.name as user_name 
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY timestamp DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Backup
app.post('/api/backup/create', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-manual-${timestamp}.sql`;
    const filepath = path.join(backupDir, filename);

    // Execute pg_dump from within the container
    // Note: PGUSER, PGPASSWORD, PGHOST must be set or passed in command
    const dbUrl = process.env.DATABASE_URL || 'postgresql://user:password@db:5432/safeguardpro';

    // Use --clean --if-exists to ensure restore overwrites correctly
    exec(`pg_dump --clean --if-exists "${dbUrl}" > "${filepath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Backup error: ${error.message}`);
        return res.status(500).json({ error: 'Backup failed', details: error.message });
      }
      if (stderr) {
        console.warn(`Backup stderr: ${stderr}`);
      }

      // Log action
      logAction(req.user?.id, 'admin', 'BACKUP_CREATED', 'system', null, { filename }, req.ip);

      res.json({ success: true, message: 'Backup created successfully', filename });
    });
  } catch (err) {
    console.error('Error creating backup:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete Backup
app.delete('/api/backup/:filename', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  const { filename } = req.params;
  // Security check: simple sanitize
  if (!filename || filename.includes('..') || filename.includes('/') || !filename.endsWith('.sql')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filepath = path.join(backupDir, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  try {
    fs.unlinkSync(filepath);
    await logAction(req.user?.id, 'admin', 'BACKUP_DELETED', 'system', null, { filename }, req.ip);
    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (err) {
    console.error('Error deleting backup:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Restore Backup
app.post('/api/backup/restore', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  const { filename } = req.body;
  if (!filename || filename.includes('..') || filename.includes('/') || !filename.endsWith('.sql')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filepath = path.join(backupDir, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Backup file not found' });
  }

  try {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://user:password@db:5432/safeguardpro';

    // Command to restore: psql < file
    // Note: This appends/overwrites existing tables. For full restore, typically we'd drop tables first, 
    // but standard pg_dump usually includes DROP if requested. 
    // Our backup create didn't include --clean.
    // For safety in this MVP, we just apply the SQL. 
    // If user wants clean restore, we might need to add --clean to create, or handle it here.
    // Given the prompt "Restaurar dados", simply applying valid SQL is the standard first step.

    // WARNING: This assumes the container has psql installed (standard postgres/alpine images do, or if we installed postgresql-client)
    exec(`psql "${dbUrl}" < "${filepath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Restore error: ${error.message}`);
        return res.status(500).json({ error: 'Restore failed', details: error.message });
      }

      logAction(req.user?.id, 'admin', 'BACKUP_RESTORED', 'system', null, { filename }, req.ip);
      res.json({ success: true, message: 'System restored successfully. Please refresh.' });
    });

  } catch (err) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Download Backup
app.get('/api/backup/:filename/download', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  const { filename } = req.params;
  if (!filename || filename.includes('..') || filename.includes('/') || !filename.endsWith('.sql')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filepath = path.join(backupDir, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  res.download(filepath, filename, (err) => {
    if (err) {
      console.error('Error downloading backup:', err);
    }
  });
});

// Upload Backup
app.post('/api/backup/upload', authenticate, requireRole(['admin']), upload.single('backup_file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid format' });
  }

  // Log upload
  logAction(req.user?.id, 'admin', 'BACKUP_UPLOADED', 'system', null, { filename: req.file.filename }, req.ip);

  res.json({ success: true, message: 'Backup uploaded successfully' });
});


app.delete('/api/lgpd/data/:entity_type/:entity_id', authenticate, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  const { entity_type, entity_id } = req.params;

  try {
    // Anonymize instead of delete to maintain referential integrity
    if (entity_type === 'employee') {
      await pool.query(
        `UPDATE employees SET 
         name = 'ANONIMIZADO', 
         cpf = NULL 
         WHERE id = $1`,
        [entity_id]
      );
    } else if (entity_type === 'company') {
      await pool.query(
        `UPDATE companies SET 
         name = 'EMPRESA ANONIMIZADA',
         email = CONCAT('anonimizado_', id, '@deleted.com'),
         contact = 'ANONIMIZADO',
         legal_representative = 'ANONIMIZADO'
         WHERE id = $1`,
        [entity_id]
      );
    }

    await logAction(req.user?.id, req.user?.role, 'DATA_ANONYMIZED', entity_type, entity_id, null, req.ip);
    res.json({ success: true, message: 'Data anonymized successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




// ======================================
// COMPANY ROUTES
// ======================================

// Companies route consolidated at line 1195
// ======================================
// PROFILE & SETTINGS ROUTES
// ======================================

// Get Current User Profile
app.get('/api/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, job_role, avatar_url, notif_expiration, notif_weekly_report, signature_url, cpf FROM users WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Multer for Signatures
const signatureStorage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadDir = path.join(__dirname, '../uploads/signatures');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, `sig-${Date.now()}-${file.originalname}`);
  }
});
const uploadSignature = multer({ storage: signatureStorage });

// Update Profile (Multipart for Signature)
app.put('/api/profile', authenticate, uploadSignature.single('signature'), async (req: AuthRequest, res: Response) => {
  const { name, job_role, email, currentPassword, notif_expiration, notif_weekly_report, cpf } = req.body;
  const file = req.file;

  try {
    let signatureUrl = undefined;
    if (file) {
      signatureUrl = `/uploads/signatures/${file.filename}`;
    }

    // Update query
    await pool.query(
      `UPDATE users SET 
        name = COALESCE($1, name), 
        job_role = COALESCE($2, job_role),
        email = COALESCE($3, email),
        notif_expiration = COALESCE($4, notif_expiration),
        notif_weekly_report = COALESCE($5, notif_weekly_report),
        signature_url = COALESCE($6, signature_url),
        cpf = COALESCE($7, cpf)
       WHERE id = $8`,
      [name, job_role, email, notif_expiration, notif_weekly_report, signatureUrl, cpf, req.user?.id]
    );

    await logAction(req.user?.id, req.user?.role, 'PROFILE_UPDATE', 'user', req.user?.id, { name, job_role, email }, req.ip);
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Update Password
app.put('/api/profile/password', authenticate, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // Verify current password first
    const userRes = await pool.query('SELECT password FROM users WHERE id = $1', [req.user?.id]);
    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user?.id]);

    await logAction(req.user?.id, req.user?.role, 'PASSWORD_CHANGE', 'user', req.user?.id, null, req.ip);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ======================================
// LEGAL DOCUMENTS ROUTES
// ======================================

// Multer Storage for Documents
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const uploadDoc = multer({ storage: docStorage });

// Upload File
app.post('/api/documents/upload', authenticate, uploadDoc.single('document'), (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  // Return relative path accessible via static middleware
  const fileUrl = `/uploads/documents/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// List Documents
app.get('/api/documents', authenticate, async (req: AuthRequest, res: Response) => {
  const { company_id, type } = req.query;
  try {
    let query = 'SELECT * FROM legal_documents WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (company_id) {
      query += ` AND company_id = $${pIdx}`;
      params.push(company_id);
      pIdx++;
    }

    if (type && type !== 'Todos') {
      query += ` AND type = $${pIdx}`;
      params.push(type);
      pIdx++;
    }

    query += ' ORDER BY uploaded_at DESC';
    const result = await pool.query(query, params);

    // Map to frontend interface
    const docs = result.rows.map(row => ({
      id: row.id,
      company_id: row.company_id,
      type: row.type,
      name: row.title,       // Map title -> name
      url: row.file_url,     // Map file_url -> url
      version: 1,            // Default version
      expiration_date: row.valid_until, // Map valid_until -> expiration_date
      created_at: row.uploaded_at
    }));

    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Document
app.post('/api/documents', authenticate, async (req: AuthRequest, res: Response) => {
  const { company_id, type, name, url, expiration_date } = req.body;
  const owner_id = (req as AuthRequest).user?.id;

  if (!company_id || !name || !url) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO legal_documents (company_id, title, type, file_url, valid_until, owner_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Vigente') RETURNING *`,
      [company_id, name, type, url, expiration_date || null, owner_id]
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      company_id: row.company_id,
      type: row.type,
      name: row.title,
      url: row.file_url,
      version: 1,
      expiration_date: row.valid_until,
      created_at: row.uploaded_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete Document
app.delete('/api/documents/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM legal_documents WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ======================================
// TRAINING MANAGEMENT ROUTES
// ======================================

// Multer for training certificates
const certStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/certificates');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `cert-${Date.now()}-${file.originalname}`);
  }
});

const uploadCert = multer({ storage: certStorage });

// Upload Certificate
app.post('/api/trainings/upload', authenticate, uploadCert.single('certificate'), (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/certificates/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Get Trainings (supports Pagination)
app.get('/api/trainings', authenticate, async (req: AuthRequest, res: Response) => {
  const { company_id, page, limit } = req.query;
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    if (ownerId === 'DENY_ALL') return res.json(page ? { data: [], total: 0 } : []);

    // Base Condition
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (company_id) {
      whereClause += ` AND (t.company_id = $${pIdx} OR e.company_id = $${pIdx})`;
      params.push(company_id);
      pIdx++;
    }

    if (ownerId) {
      whereClause += ` AND c.owner_id = $${pIdx++}`;
      params.push(ownerId);
    }

    // If Pagination is requested
    if (page && limit) {
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Count Total
      const countQuery = `
        SELECT COUNT(DISTINCT t.id) as total
        FROM trainings t
        LEFT JOIN employees e ON t.employee_id = e.id
        JOIN companies c ON (t.company_id = c.id OR e.company_id = c.id)
        ${whereClause}
      `;
      const countRes = await pool.query(countQuery, params);
      const total = parseInt(countRes.rows[0].total);

      // Fetch Data
      const dataQuery = `
        SELECT t.*, e.name as employee_name, e.role as employee_role, e.cpf as employee_cpf, c.name as company_name
        FROM trainings t
        LEFT JOIN employees e ON t.employee_id = e.id
        JOIN companies c ON (t.company_id = c.id OR e.company_id = c.id)
        ${whereClause}
        GROUP BY t.id, e.id, c.id 
        ORDER BY t.training_date DESC
        LIMIT $${pIdx++} OFFSET $${pIdx++}
      `;
      params.push(limitNum, offset);

      const dataRes = await pool.query(dataQuery, params);
      return res.json({ data: dataRes.rows, total, page: pageNum, limit: limitNum });

    } else {
      // Legacy: Return All
      const query = `
        SELECT t.*, e.name as employee_name, e.role as employee_role, e.cpf as employee_cpf, c.name as company_name
        FROM trainings t
        LEFT JOIN employees e ON t.employee_id = e.id
        JOIN companies c ON (t.company_id = c.id OR e.company_id = c.id)
        ${whereClause}
        GROUP BY t.id, e.id, c.id ORDER BY t.training_date DESC
      `;
      const result = await pool.query(query, params);
      res.json(result.rows);
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Bulk Delete Trainings
app.post('/api/trainings/bulk-delete', authenticate, async (req: AuthRequest, res: Response) => {
  const { ids } = req.body; // Expects { ids: [1, 2, 3] }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid IDs provided' });
  }

  try {
    // Ideally verify ownership before delete, but assuming generic delete permissions for now
    await pool.query('DELETE FROM trainings WHERE id = ANY($1)', [ids]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Training (supports multiple employees)
app.post('/api/trainings', authenticate, async (req: AuthRequest, res: Response) => {

  const { company_id, employee_id, employee_ids, course_name, training_date, validity_date, certificate_url, status, template_id } = req.body;


  if (!course_name || !training_date || !validity_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const createdTrainings = [];

    // Support both single employee_id and multiple employee_ids
    const employeeList = employee_ids && Array.isArray(employee_ids) && employee_ids.length > 0
      ? employee_ids
      : (employee_id ? [employee_id] : []);

    if (employeeList.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one employee must be selected' });
    }


    for (const empId of employeeList) {
      if (!empId || empId === 'null' || empId === 'undefined') {
        console.warn('Skipping invalid employee_id:', empId);
        continue;
      }
      const result = await client.query(
        `INSERT INTO trainings (company_id, employee_id, course_name, training_date, validity_date, status, certificate_url, template_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [company_id, empId, course_name, training_date, validity_date, status || 'Válido', certificate_url || null, template_id || null]
      );
      createdTrainings.push(result.rows[0]);
    }


    await client.query('COMMIT');
    res.status(201).json(createdTrainings);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// Update Training
app.put('/api/trainings/:id', authenticate, async (req: AuthRequest, res: Response) => {

  const { course_name, training_date, validity_date, status, certificate_url, template_id } = req.body;

  const { id } = req.params;

  try {
    const result = await pool.query(

      `UPDATE trainings SET 
        course_name = COALESCE($1, course_name),
        training_date = COALESCE($2, training_date),
        validity_date = COALESCE($3, validity_date),
        status = COALESCE($4, status),
        certificate_url = COALESCE($5, certificate_url),
        template_id = COALESCE($6, template_id)
       WHERE id = $7 RETURNING *`,
      [course_name, training_date, validity_date, status, certificate_url, template_id, id]

    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Training not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete Training
app.delete('/api/trainings/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM trainings WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Helper: Draw Certificate Page
async function drawCertificate(doc: PDFKit.PDFDocument, training: any, user: any, technicianNameOverride: any, pool: any) {
  // Safe Null Handling
  const employeeName = (training.employee_name || 'FUNCIONÁRIO DESCONHECIDO').toUpperCase();
  const employeeCpf = training.employee_cpf || 'Não informado';
  const courseName = training.course_name || 'CURSO SEM NOME';
  const companyName = training.company_name || 'EMPRESA NÃO ENCONTRADA';
  const trainingDate = training.training_date ? new Date(training.training_date).toLocaleDateString('pt-BR') : 'Data n/a';
  const validityDate = training.validity_date ? new Date(training.validity_date).toLocaleDateString('pt-BR') : 'Data n/a';

  // 1. Background (Template vs Default)
  if (training.template_url) {
    const bgPath = path.join(__dirname, '..', training.template_url);
    if (fs.existsSync(bgPath)) {
      doc.image(bgPath, 0, 0, { width: 841.89, height: 595.28 });
    }
  } else {
    // Fallback Default Design
    doc.rect(0, 0, 842, 595).fill('#f8f9fa');
    doc.rect(30, 30, 782, 535).lineWidth(3).stroke('#1e3a8a');
    doc.moveTo(200, 140).lineTo(642, 140).lineWidth(2).stroke('#3b82f6');
  }

  console.log('[CERT_DEBUG] Data for Substitution:', {
    employeeName,
    employeeCpf,
    courseName,
    companyName,
    trainingDate,
    validityDate
  });

  // Enhanced Debug: Template info
  console.log('[CERT_DEBUG] Template Info:', {
    trainingId: training.id,
    templateId: training.template_id || 'NOT SET',
    hasTemplateUrl: !!training.template_url,
    hasTemplateText: !!training.template_text,
    templateTextLength: training.template_text?.length || 0,
    hasTemplateVerso: !!training.template_verso,
    templateVersoLength: training.template_verso?.length || 0
  });

  // 2. Text Overlay
  doc.fillColor('#1e3a8a').fontSize(40).font('Helvetica-Bold').text('CERTIFICADO', 0, 60, { align: 'center', width: 842 });
  doc.fillColor('#000000').fontSize(42).font('Helvetica-Bold').text(employeeName, 0, 200, { align: 'center', width: 842 });

  // Body Text
  let bodyText = training.template_text || `Certificamos que {nome}, portador do CPF {cpf}, concluiu com aproveitamento satisfatório o treinamento {curso}, realizado em {data}. Este certificado comprova a capacitação conforme exigências das Normas Regulamentadoras vigentes.`;

  console.log('[CERT_DEBUG] Raw bodyText before substitution:', bodyText.substring(0, 100) + '...');

  if (bodyText) {
    // Additional data for substitution
    const employeeRole = training.employee_role || 'Colaborador';
    const employeeSector = training.sector_name || '';
    const trainingHours = training.hours || '8'; // Default to 8 hours

    // Robust Regex for substitution (handles spaces like { nome })
    bodyText = bodyText
      .replace(/\{\s*(nome|name)\s*\}/gi, employeeName)
      .replace(/\{\s*(cpf)\s*\}/gi, employeeCpf)
      .replace(/\{\s*(curso|course|treinamento)\s*\}/gi, courseName)
      .replace(/\{\s*(empresa|company)\s*\}/gi, companyName)
      .replace(/\{\s*(data|date)\s*\}/gi, trainingDate)
      .replace(/\{\s*(validade|validity)\s*\}/gi, validityDate)
      .replace(/\{\s*(horas|hours|carga_horaria)\s*\}/gi, trainingHours)
      .replace(/\{\s*(funcao|função|cargo|role)\s*\}/gi, employeeRole)
      .replace(/\{\s*(setor|sector)\s*\}/gi, employeeSector);

    console.log('[CERT_DEBUG] Final Body Text after substitution:', bodyText);
  }

  doc.y = 280;
  doc.fillColor('#374151').fontSize(15).font('Helvetica').text(bodyText, 121, doc.y, { width: 600, align: 'justify', lineGap: 8 });

  doc.moveDown(2);
  let validY = doc.y < 380 ? 380 : doc.y;
  doc.fillColor('#dc2626').fontSize(14).font('Helvetica-Bold').text(`Validade: ${validityDate}`, 0, validY, { align: 'center', width: 842 });

  // Signatures
  let sigY = doc.y > 450 ? doc.y + 60 : 500;
  if (sigY > 530) sigY = 530;

  doc.lineWidth(1).stroke('#9ca3af');

  // FIX: Treat generic placeholder as no override to allow ID-based lookup
  if (technicianNameOverride === 'Responsável Técnico') {
    technicianNameOverride = null;
  }

  const finalTechName = (technicianNameOverride as string) || user?.name || 'Responsável Técnico';
  console.log(`[CERT_DEBUG] UserID: ${user?.id}, TokenName: ${user?.name}, Override: ${technicianNameOverride}, Final: ${finalTechName}`);

  try {
    let sigUrl = null;
    let techCpf = null;

    // Strategy 1: Try by User ID if names match or no override
    if (user?.id && (!technicianNameOverride || user.name === finalTechName)) {
      const u = await pool.query('SELECT signature_url, cpf FROM users WHERE id = $1', [user.id]);
      if (u.rows.length > 0) {
        sigUrl = u.rows[0]?.signature_url;
        techCpf = u.rows[0]?.cpf;
        console.log(`[CERT_DEBUG] Found by ID: URL=${sigUrl}, CPF=${techCpf}`);
      }
    }

    // Strategy 2: Search by Name if failed
    if (!sigUrl) {
      console.log(`[CERT_DEBUG] Searching by name: ${finalTechName}`);
      const u = await pool.query('SELECT signature_url, cpf FROM users WHERE name ILIKE $1 LIMIT 1', [`%${finalTechName.trim()}%`]);
      if (u.rows.length > 0) {
        sigUrl = u.rows[0]?.signature_url;
        techCpf = u.rows[0]?.cpf;
        console.log(`[CERT_DEBUG] Found by Name: URL=${sigUrl}`);
      }
    }

    if (sigUrl) {
      const cleanSigUrl = sigUrl.startsWith('/') || sigUrl.startsWith('\\') ? sigUrl.slice(1) : sigUrl;
      const sigPath = path.join(__dirname, '..', cleanSigUrl);
      console.log(`[CERT_DEBUG] Signature Path: ${sigPath}, Exists: ${fs.existsSync(sigPath)}`);

      if (fs.existsSync(sigPath)) {
        doc.image(sigPath, 200, sigY - 50, { width: 100 });
      }
    }
    if (techCpf) {
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text(`CPF: ${techCpf}`, 150, sigY + 38, { width: 200, align: 'center' });
    }
  } catch (e) { console.error('[CERT_DEBUG] Sig Error', e); }

  // Sig Lines
  doc.moveTo(150, sigY).lineTo(350, sigY).stroke();
  doc.fillColor('#374151').fontSize(12).font('Helvetica-Bold').text(finalTechName, 150, sigY + 10, { width: 200, align: 'center' });
  doc.fillColor('#6b7280').fontSize(10).font('Helvetica').text('Responsável Técnico', 150, sigY + 25, { width: 200, align: 'center' });

  doc.moveTo(490, sigY).lineTo(690, sigY).stroke();
  doc.fillColor('#374151').fontSize(12).font('Helvetica-Bold').text('Colaborador', 490, sigY + 10, { width: 200, align: 'center' });
  doc.fillColor('#9ca3af').fontSize(9).font('Helvetica').text(`${companyName} - SafeguardPro SST`, 0, 550, { align: 'center', width: 842 });

  // Verso
  if (training.template_verso) {
    console.log('[CERT_DEBUG] Drawing Verso page with content length:', training.template_verso.length);
    doc.addPage();
    doc.rect(0, 0, 842, 595).fill('#ffffff');
    doc.fillColor('#000000').fontSize(20).text('Conteúdo Programático', 0, 50, { align: 'center', width: 842 });

    const versoText = training.template_verso
      .replace(/\{\s*(nome|name)\s*\}/gi, employeeName)
      .replace(/\{\s*(cpf)\s*\}/gi, employeeCpf)
      .replace(/\{\s*(curso|course|treinamento)\s*\}/gi, courseName)
      .replace(/\{\s*(empresa|company)\s*\}/gi, companyName)
      .replace(/\{\s*(data|date)\s*\}/gi, trainingDate)
      .replace(/\{\s*(validade|validity)\s*\}/gi, validityDate)
      .replace(/\{\s*(horas|hours|carga_horaria)\s*\}/gi, training.hours || '8')
      .replace(/\{\s*(funcao|função|cargo|role)\s*\}/gi, training.employee_role || 'Colaborador')
      .replace(/\{\s*(setor|sector)\s*\}/gi, training.sector_name || '');

    doc.fontSize(11).fillColor('#333333').text(versoText, 50, 100, { align: 'justify', columns: 2, columnGap: 40, height: 450, width: 742 });
  }
}



// Generate ASO PDF
app.post('/api/asos/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  const ownerId = getSafeOwnerId(req);
  const { id } = req.params;

  try {
    // 1. Fetch ASO Data
    // DEBUG LOG
    console.log('[DEBUG_ASO_PDF] Executing ASO PDF generation with ID:', id);

    const asoRes = await pool.query(`
      SELECT a.*, e.name as employee_name, e.cpf as employee_cpf, e.rg as employee_rg, e.birth_date as employee_birth_date, e.sector_id, e.job_role,
             c.name as company_name, c.cnae as company_cnae,
             s.name as sector_name
      FROM asos a
      JOIN employees e ON a.employee_id = e.id
      JOIN companies c ON a.company_id = c.id
      LEFT JOIN sectors s ON e.sector_id = s.id
      WHERE a.id = $1 ${ownerId ? 'AND a.owner_id = $2' : ''}
    `, ownerId ? [id, ownerId] : [id]);

    if (asoRes.rows.length === 0) return res.status(404).json({ error: 'ASO não encontrado' });
    const aso = asoRes.rows[0];

    // 2. Fetch Exams
    const examsRes = await pool.query(`
      SELECT ae.*, et.name as exam_name 
      FROM aso_exams ae
      JOIN exam_types et ON ae.exam_type_id = et.id
      WHERE ae.aso_id = $1
    `, [id]);

    // 3. Fetch Risks
    const risksRes = await pool.query(`
      SELECT ar.*, r.description as risk_name, r.risk_type as risk_type
      FROM aso_risks ar
      LEFT JOIN risks r ON ar.risk_id = r.id
      WHERE ar.aso_id = $1
    `, [id]);

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=aso-${id}.pdf`);
    doc.pipe(res);

    await drawASO(doc, aso, examsRes.rows, risksRes.rows, pool);

    doc.end();

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro ao gerar PDF do ASO' });
  }
});

async function drawASO(doc: PDFKit.PDFDocument, aso: any, exams: any[], risks: any[], pool: Pool) {
  // Header
  const topMargin = 40;

  // Logo (placeholder)
  // doc.image('path/to/logo.png', 50, topMargin, { width: 50 });

  doc.font('Helvetica-Bold').fontSize(16).text('ATESTADO DE SAÚDE OCUPACIONAL - ASO', 50, topMargin + 10, { align: 'center', width: 500 });
  doc.fontSize(10).text(`(Conforme NR-07)`, 50, topMargin + 30, { align: 'center', width: 500 });

  let currentY = topMargin + 60;

  // 1. Identificação do Trabalhador
  doc.rect(40, currentY, 515, 20).fill('#e5e7eb').stroke();
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(10).text('1. IDENTIFICAÇÃO DO TRABALHADOR', 50, currentY + 6);
  currentY += 30;

  doc.font('Helvetica-Bold').fontSize(10).text('Nome:', 50, currentY);
  doc.font('Helvetica').text(aso.employee_name || '', 100, currentY);

  doc.font('Helvetica-Bold').text('CPF:', 300, currentY);
  doc.font('Helvetica').text(aso.employee_cpf || '', 340, currentY);
  currentY += 15;

  doc.font('Helvetica-Bold').text('RG:', 50, currentY);
  doc.font('Helvetica').text(aso.employee_rg || '', 100, currentY);

  doc.font('Helvetica-Bold').text('Nasc.:', 300, currentY);
  doc.font('Helvetica').text(aso.employee_birth_date ? new Date(aso.employee_birth_date).toLocaleDateString('pt-BR') : '', 340, currentY);
  currentY += 15;

  doc.font('Helvetica-Bold').text('Função:', 50, currentY);
  doc.font('Helvetica').text(aso.job_role || aso.job_role || '', 100, currentY);

  doc.font('Helvetica-Bold').text('Setor:', 300, currentY);
  doc.font('Helvetica').text(aso.sector_name || '', 340, currentY);
  currentY += 25;

  // 2. Identificação da Empresa
  doc.rect(40, currentY, 515, 20).fill('#e5e7eb').stroke();
  doc.fillColor('#000').font('Helvetica-Bold').text('2. DADOS DA EMPRESA', 50, currentY + 6);
  currentY += 30;

  doc.font('Helvetica-Bold').text('Razão Social:', 50, currentY);
  doc.font('Helvetica').text(aso.company_name, 120, currentY);
  currentY += 15;

  doc.font('Helvetica-Bold').text('CNPJ:', 50, currentY);
  doc.font('Helvetica').text(aso.company_cnpj || '', 120, currentY);
  currentY += 25;

  // 3. Tipo de ASO e Riscos
  doc.rect(40, currentY, 515, 20).fill('#e5e7eb').stroke();
  doc.fillColor('#000').font('Helvetica-Bold').text('3. TIPO DE EXAME E RISCOS OCUPACIONAIS', 50, currentY + 6);
  currentY += 30;

  doc.font('Helvetica-Bold').text('Tipo de Exame:', 50, currentY);
  doc.font('Helvetica').text(aso.type.toUpperCase(), 140, currentY);
  currentY += 20;

  doc.font('Helvetica-Bold').text('Riscos Identificados:', 50, currentY);
  currentY += 15;

  if (risks.length === 0) {
    doc.font('Helvetica').text('Ausência de riscos específicos.', 50, currentY);
    currentY += 15;
  } else {
    risks.forEach(r => {
      const riskText = r.risk_description || r.risk_name;
      doc.font('Helvetica').text(`- ${riskText} (${r.risk_type || 'Geral'})`, 60, currentY);
      currentY += 15;
    });
  }
  currentY += 10;

  // 4. Exames Complementares
  doc.rect(40, currentY, 515, 20).fill('#e5e7eb').stroke();
  doc.fillColor('#000').font('Helvetica-Bold').text('4. EXAMES COMPLEMENTARES REALIZADOS', 50, currentY + 6);
  currentY += 30;

  doc.font('Helvetica-Bold').text('Exame', 50, currentY);
  doc.text('Data', 280, currentY);
  doc.text('Resultado', 380, currentY);
  currentY += 15;
  doc.moveTo(50, currentY).lineTo(500, currentY).stroke();
  currentY += 5;

  // Clinical Exam
  doc.font('Helvetica').text('Avaliação Clínica', 50, currentY);
  doc.text(aso.exam_date ? new Date(aso.exam_date).toLocaleDateString('pt-BR') : '', 280, currentY);
  doc.text('Apto', 380, currentY);
  currentY += 15;

  if (exams.length > 0) {
    exams.forEach(ex => {
      doc.text(ex.exam_name, 50, currentY);
      const d = ex.exam_date ? new Date(ex.exam_date).toLocaleDateString('pt-BR') : '-';
      doc.text(d, 280, currentY);
      doc.text(ex.result || '-', 380, currentY);
      currentY += 15;
    });
  }
  currentY += 20;

  // 5. Conclusão
  doc.rect(40, currentY, 515, 20).fill('#e5e7eb').stroke();
  doc.fillColor('#000').font('Helvetica-Bold').text('5. CONCLUSÃO MÉDICA', 50, currentY + 6);
  currentY += 30;

  const isApto = aso.aptitude_status === 'Apto';
  const isInapto = aso.aptitude_status === 'Inapto';

  doc.font('Helvetica').fontSize(12);
  doc.text(`(${isApto ? 'X' : ' '}) APTO`, 50, currentY);
  doc.text(`(${isInapto ? 'X' : ' '}) INAPTO`, 200, currentY);
  currentY += 25;

  if (aso.aptitude_obs) {
    doc.font('Helvetica').fontSize(10).text(`Observações: ${aso.aptitude_obs} `, 50, currentY);
    currentY += 20;
  }

  doc.fontSize(10).text(`Validade do ASO até: ${aso.valid_until ? new Date(aso.valid_until).toLocaleDateString('pt-BR') : 'Não informada'} `, 50, currentY);
  currentY += 40;

  // Signatures
  const sigY = 700;

  doc.moveTo(50, sigY).lineTo(200, sigY).stroke();
  doc.fontSize(8).text('Assinatura do Funcionário', 50, sigY + 5, { width: 150, align: 'center' });

  doc.moveTo(300, sigY).lineTo(500, sigY).stroke();
  doc.text(`Dr(a).${aso.doctor_name} `, 300, sigY + 5, { width: 200, align: 'center' });
  doc.text(`CRM: ${aso.doctor_crm} / ${aso.doctor_uf}`, 300, sigY + 15, { width: 200, align: 'center' });

  doc.fillColor('#999').text('Gerado por SafeguardPro SST', 50, 780, { align: 'center', width: 500 });
}

// Generate PDF Certificate (Single)
app.get('/api/trainings/:id/certificate', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { technician_name } = req.query;

  try {
    // Query with automatic template and employee matching
    const result = await pool.query(`
      SELECT t.*, 
             COALESCE(e.name, e_junction.name) as employee_name, 
             COALESCE(e.cpf, e_junction.cpf) as employee_cpf, 
             COALESCE(e.role, e_junction.role) as employee_role,
             c.name as company_name,
             COALESCE(ct.image_url, ct_auto.auto_image_url) as template_url, 
             COALESCE(ct.body_text, ct_auto.auto_body_text) as template_text, 
             COALESCE(ct.verso_text, ct_auto.auto_verso_text) as template_verso
      FROM trainings t
      LEFT JOIN employees e ON t.employee_id = e.id
      LEFT JOIN trainings_employees te ON te.training_id = t.id
      LEFT JOIN employees e_junction ON te.employee_id = e_junction.id
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN certificate_templates ct ON t.template_id = ct.id
      LEFT JOIN LATERAL (
        SELECT image_url as auto_image_url, body_text as auto_body_text, verso_text as auto_verso_text 
        FROM certificate_templates 
        WHERE t.template_id IS NULL 
          AND name ~ ('NR[^0-9]*' || SUBSTRING(t.course_name FROM 'NR[- ]*([0-9]+)'))
        ORDER BY LENGTH(name)
        LIMIT 1
      ) ct_auto ON true
      WHERE t.id = $1
    `, [id]);

    console.log('[CERT_DEBUG] Query result for training', id, ':', {
      hasTemplateUrl: !!result.rows[0]?.template_url,
      hasTemplateText: !!result.rows[0]?.template_text,
      hasTemplateVerso: !!result.rows[0]?.template_verso,
      templateTextPreview: result.rows[0]?.template_text?.substring(0, 50)
    });

    if (result.rows.length === 0) return res.status(404).json({ error: 'Training not found' });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=certificate.pdf`);
    doc.pipe(res);

    await drawCertificate(doc, result.rows[0], req.user, technician_name, pool);
    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF' });
  }
});

// Generate PDF Certificate (Bulk)
app.post('/api/trainings/certificates/bulk', authenticate, async (req: AuthRequest, res: Response) => {
  const { ids, technician_name } = req.body;
  const ownerId = getSafeOwnerId(req);

  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });

  try {
    console.log(`[BULK_CERT] Starting generation for IDs: ${ids.join(', ')}`);
    // Query with automatic template and employee matching
    const result = await pool.query(`
      SELECT t.*, 
             COALESCE(e.name, e_junction.name) as employee_name, 
             COALESCE(e.cpf, e_junction.cpf) as employee_cpf, 
             COALESCE(e.role, e_junction.role) as employee_role,
             c.name as company_name,
             COALESCE(ct.image_url, ct_auto.auto_image_url) as template_url, 
             COALESCE(ct.body_text, ct_auto.auto_body_text) as template_text, 
             COALESCE(ct.verso_text, ct_auto.auto_verso_text) as template_verso
      FROM trainings t
      LEFT JOIN employees e ON t.employee_id = e.id
      LEFT JOIN trainings_employees te ON te.training_id = t.id
      LEFT JOIN employees e_junction ON te.employee_id = e_junction.id
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN certificate_templates ct ON t.template_id = ct.id
      LEFT JOIN LATERAL (
        SELECT image_url as auto_image_url, body_text as auto_body_text, verso_text as auto_verso_text 
        FROM certificate_templates 
        WHERE t.template_id IS NULL 
          AND name ~ ('NR[^0-9]*' || SUBSTRING(t.course_name FROM 'NR[- ]*([0-9]+)'))
        ORDER BY LENGTH(name)
        LIMIT 1
      ) ct_auto ON true
      WHERE t.id = ANY($1) ${ownerId ? 'AND c.owner_id = $2' : ''}
    `, ownerId ? [ids, ownerId] : [ids]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'No trainings found' });

    console.log(`[BULK_CERT] Found ${result.rows.length} records.`);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=certificados-bulk.pdf`);
    doc.pipe(res);

    for (let i = 0; i < result.rows.length; i++) {
      console.log(`[BULK_CERT] Drawing certificate ${i + 1}/${result.rows.length} (ID: ${result.rows[i].id})`);
      if (i > 0) doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });

      try {
        await drawCertificate(doc, result.rows[i], req.user, technician_name, pool);
      } catch (innerErr) {
        console.error(`[BULK_CERT] Error drawing ID ${result.rows[i].id}:`, innerErr);
        // Continue to next? Or add error text to PDF? 
        // For now, allow it to continue, maybe page is blank or partial.
      }
    }
    doc.end();
    console.log('[BULK_CERT] Finished.');

  } catch (err) {
    console.error('[BULK_CERT] Global Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error generating Bulk PDF' });
    }
  }
});







// ====================
// ASO MODULE ROUTES
// ====================

// 1. Exam Types (Catálogo)
app.get('/api/exam-types', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const result = await pool.query('SELECT * FROM exam_types WHERE owner_id = $1 OR owner_id IS NULL ORDER BY name', [ownerId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/exam-types', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const { name, description, is_complementary } = req.body;

    const result = await pool.query(
      'INSERT INTO exam_types (name, description, is_complementary, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, is_complementary, ownerId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/exam-types/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const { id } = req.params;
    const { name, description, is_complementary } = req.body;

    const result = await pool.query(
      'UPDATE exam_types SET name = $1, description = $2, is_complementary = $3 WHERE id = $4 AND owner_id = $5 RETURNING *',
      [name, description, is_complementary, id, ownerId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Exam Type not found or unauthorized' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/exam-types/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const { id } = req.params;

    // Check usage in aso_exams ?? For now, let constraint fail if used
    const result = await pool.query('DELETE FROM exam_types WHERE id = $1 AND owner_id = $2 RETURNING id', [id, ownerId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Exam Type not found or unauthorized' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting exam type' });
  }
});


// 2. ASOs (CRUD)
app.get('/api/asos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const { company_id, status, page, limit } = req.query;

    let query = `
      SELECT a.*, e.name as employee_name, e.cpf as employee_cpf 
      FROM asos a
      JOIN employees e ON a.employee_id = e.id

      WHERE 1=1 ${ownerId ? 'AND a.owner_id = $1' : ''}
    `;
    const params: any[] = ownerId ? [ownerId] : [];
    let pIdx = ownerId ? 2 : 1;

    if (company_id) {
      query += ` AND a.company_id = $${pIdx++}`;
      params.push(company_id);
    }
    if (status) {
      query += ` AND a.status = $${pIdx++}`;
      params.push(status);
    }

    query += ` ORDER BY a.issue_date DESC`;

    // Pagination
    if (page && limit) {
      const p = parseInt(page as string);
      const l = parseInt(limit as string);
      const offset = (p - 1) * l;
      query += ` LIMIT $${pIdx++} OFFSET $${pIdx++}`;
      params.push(l, offset);
    }

    const result = await pool.query(query, params);

    // Get total count for pagination
    // (Simplified, ideally run a separate count query)
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/asos/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const { id } = req.params;

    // ASO + Employee
    const asoRes = await pool.query(`
      SELECT a.*, e.name as employee_name, e.cpf as employee_cpf, e.rg as employee_rg, e.birth_date as employee_birth_date, e.sector_id, e.job_role,
             c.name as company_name, c.cnpj as company_cnpj,
             s.name as sector_name
      FROM asos a
      JOIN employees e ON a.employee_id = e.id
      JOIN companies c ON a.company_id = c.id
      LEFT JOIN sectors s ON e.sector_id = s.id

      WHERE a.id = $1 ${ownerId ? 'AND a.owner_id = $2' : ''}
    `, ownerId ? [id, ownerId] : [id]);

    if (asoRes.rows.length === 0) return res.status(404).json({ error: 'ASO não encontrado' });
    const aso = asoRes.rows[0];

    // Exams
    const examsRes = await pool.query(`
      SELECT ae.*, et.name as exam_name 
      FROM aso_exams ae
      JOIN exam_types et ON ae.exam_type_id = et.id
      WHERE ae.aso_id = $1
    `, [id]);

    // Risks
    const risksRes = await pool.query(`
      SELECT ar.*, 
             COALESCE(ar.risk_type, r.risk_type) as risk_type, 
             r.description as risk_name
      FROM aso_risks ar
      LEFT JOIN risks r ON ar.risk_id = r.id
      WHERE ar.aso_id = $1
    `, [id]);

    console.log(`[DEBUG_ASO_GET] ID: ${id} - Found ${examsRes.rows.length} exams, ${risksRes.rows.length} risks`);

    res.json({ ...aso, exams: examsRes.rows, risks: risksRes.rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/asos', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownerId = req.user?.owner_id || req.user?.id;
    const {
      company_id, employee_id, type, exam_date, issue_date, valid_until,
      doctor_name, doctor_crm, doctor_uf, clinic_name,
      aptitude_status, aptitude_obs,
      exams, risks // Arrays
    } = req.body;

    console.log('[DEBUG_ASO_CREATE] Payload:', JSON.stringify(req.body, null, 2));

    const asoQuery = `
      INSERT INTO asos(
      company_id, employee_id, type, exam_date, issue_date, valid_until,
      doctor_name, doctor_crm, doctor_uf, clinic_name,
      aptitude_status, aptitude_obs, owner_id
    ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
      `;
    const asoRes = await client.query(asoQuery, [
      company_id, employee_id, type, exam_date, issue_date, valid_until || null,
      doctor_name, doctor_crm, doctor_uf, clinic_name,
      aptitude_status, aptitude_obs, ownerId
    ]);
    const asoId = asoRes.rows[0].id;

    // Insert Risks
    if (risks && Array.isArray(risks)) {
      for (const r of risks) {
        await client.query(
          'INSERT INTO aso_risks (aso_id, risk_id, risk_description, risk_type) VALUES ($1, $2, $3, $4)',
          [asoId, r.risk_id, r.risk_description, r.risk_type]
        );
      }
    }

    // Insert Exams
    if (exams && Array.isArray(exams)) {
      for (const e of exams) {
        await client.query(
          'INSERT INTO aso_exams (aso_id, exam_type_id, exam_date, result) VALUES ($1, $2, $3, $4)',
          [asoId, e.exam_type_id, e.exam_date, e.result]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ id: asoId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar ASO' });
  } finally {
    client.release();
  }
});

app.put('/api/asos/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const { id } = req.params;
    const {
      company_id, employee_id, type, exam_date, issue_date, valid_until,
      doctor_name, doctor_crm, doctor_uf, clinic_name,
      aptitude_status, aptitude_obs,
      exams, risks
    } = req.body;

    console.log('[DEBUG_ASO_UPDATE] Payload:', JSON.stringify(req.body, null, 2));
    console.log('[DEBUG_ASO_UPDATE] Params ID:', id, 'Owner:', ownerId);

    await client.query('BEGIN');

    // Update ASO
    const updateQuery = `
      UPDATE asos SET
        company_id = $1, employee_id = $2, type = $3, exam_date = $4, issue_date = $5, valid_until = $6,
        doctor_name = $7, doctor_crm = $8, doctor_uf = $9, clinic_name = $10,
        aptitude_status = $11, aptitude_obs = $12
      WHERE id = $13 ${ownerId ? 'AND owner_id = $14' : ''}
    `;
    const updateParams = [
      company_id, employee_id, type, exam_date, issue_date, valid_until || null,
      doctor_name, doctor_crm, doctor_uf, clinic_name,
      aptitude_status, aptitude_obs,
      id
    ];
    if (ownerId) updateParams.push(ownerId);

    const updateRes = await client.query(updateQuery, updateParams);

    console.log('[DEBUG_ASO_UPDATE] ASO Update RowCount:', (updateRes as any).rowCount);

    // Update Risks (Delete all and re-insert)
    await client.query('DELETE FROM aso_risks WHERE aso_id = $1', [id]);
    if (risks && Array.isArray(risks)) {
      for (const r of risks) {
        await client.query(
          'INSERT INTO aso_risks (aso_id, risk_id, risk_description, risk_type) VALUES ($1, $2, $3, $4)',
          [id, r.risk_id, r.risk_description, r.risk_type]
        );
      }
    }

    // Update Exams (Delete all and re-insert)
    await client.query('DELETE FROM aso_exams WHERE aso_id = $1', [id]);
    if (exams && Array.isArray(exams)) {
      for (const e of exams) {
        await client.query(
          'INSERT INTO aso_exams (aso_id, exam_type_id, exam_date, result) VALUES ($1, $2, $3, $4)',
          [id, e.exam_type_id, e.exam_date, e.result]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro ao atualizar ASO' });
  } finally {
    client.release();
  }

});


app.delete('/api/asos/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.owner_id || req.user?.id;
    const { id } = req.params;
    const query = `DELETE FROM asos WHERE id = $1 ${ownerId ? 'AND owner_id = $2' : ''}`;
    const params = ownerId ? [id, ownerId] : [id];
    await pool.query(query, params);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
// ====================
// PROFILE API
// ====================

const profileSignatureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/signatures');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `sig - ${Date.now()} -${file.originalname} `);
  }
});
const uploadProfileSignature = multer({ storage: profileSignatureStorage });





// ====================
// AVATAR API
// ====================

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `avatar - ${Date.now()} -${file.originalname} `);
  }
});
const uploadAvatar = multer({ storage: avatarStorage });

app.post('/api/profile/avatar', authenticate, uploadAvatar.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const userId = req.user?.id;
  const fileUrl = `/ uploads / avatars / ${req.file.filename} `;

  try {
    // Ensure column exists just in case (optional, but robust)
    // await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');

    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [fileUrl, userId]);
    res.json({ url: fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating avatar' });
  }
});


// Start Server
const server = app.listen(PORT, () => {
  console.log(`Backend listening at http://localhost:${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Server already running on port ${PORT}`);
  } else {
    console.error('Server error:', err);
  }
});
