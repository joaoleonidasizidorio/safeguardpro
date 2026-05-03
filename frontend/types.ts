export enum View {
  DASHBOARD = 'DASHBOARD',
  COMPANIES = 'COMPANIES',
  VISITS = 'VISITS',
  TRAININGS = 'TRAININGS',
  ALERTS = 'ALERTS',
  AUDIT = 'AUDIT',
  INSPECTION_FORM = 'INSPECTION_FORM',
  EVIDENCES = 'EVIDENCES',
  CHECKLISTS = 'CHECKLISTS',
  RISKS = 'RISKS',
  REPORTS = 'REPORTS',
  EPI_MANAGEMENT = 'EPI_MANAGEMENT',
  LEGAL_DOCUMENTS = 'legal_documents',
  INCIDENT_MANAGEMENT = 'incident_management',
  NOTIFICATIONS = 'notifications',
  ADMIN = 'admin',
  SETTINGS = 'SETTINGS',
  HELP = 'HELP',
  SUBSCRIPTION = 'SUBSCRIPTION',
  ASO_MANAGEMENT = 'ASO_MANAGEMENT'
}

export interface ChecklistItem {
  id: number;
  template_id: number;
  question: string;
  category: string;
}

export interface ChecklistTemplate {
  id: number;
  name: string;
  description: string | null;
  items?: ChecklistItem[];
  owner_id?: string;
}

export interface InspectionAnswer {
  id?: number;
  item_id: number;
  status: 'C' | 'NC' | 'NA';
  observation?: string;
  photo_url?: string;
  photo_after_url?: string;
  photo_date?: string;
  photo_lat?: number;
  photo_lon?: number;
}

export interface Inspection {
  id: number;
  company_id: string;
  sector_id?: number | null;
  template_id: number;
  status: string;
  auditor_id: string;
  date: string;
  technician_signature?: string;
  client_signature?: string;
  latitude?: number;
  longitude?: number;
  companyName?: string;
  sectorName?: string;
  templateName?: string;
  // Raw API response fields (snake_case)
  company_name?: string;
  sector_name?: string;
  template_name?: string;
  answers?: InspectionAnswer[];
}

export interface Visit {
  id: number;
  companyId: string;

  visitType: 'inspeção' | 'auditoria' | 'acompanhamento';
  scheduledAt: string;
  checkInAt?: string;
  checkOutAt?: string;
  status: 'Agendado' | 'Em Andamento' | 'Concluído';
  latitude?: number;
  longitude?: number;
  reportUrl?: string;
  companyName?: string; // Virtual field for UI
  sectorId?: number;
  sectorName?: string;
  unitName?: string;
}

export interface Company {
  id: string;
  name: string;
  contact: string;
  email: string;
  status: 'active' | 'inactive' | 'pending' | 'irregular';
  lastVisit: string;
  nextVisit: string;
  initials: string;
  cnae?: string;
  riskLevel?: number;
  legalRepresentative?: string;
}

export interface Unit {
  id: number;
  companyId: string;
  name: string;
  address: string;
  unitType: string;
}

export interface Sector {
  id: number;
  unitId: number;
  name: string;
}

export interface ServiceHistory {
  id: number;
  companyId: string;
  date: string;
  description: string;
  technician: string;
}

export interface Training {
  id: string;
  employeeName: string;
  role: string;
  course: string;
  status: 'valid' | 'expiring' | 'expired';
  validity: string;
  avatarUrl: string;
}

export interface Metric {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: string;
  colorClass: string;
}

export interface Alert {
  id: number;
  type: 'Crítico' | 'Médio' | 'Baixo';
  title: string;
  date: string;
  status: 'Pendente' | 'Em Análise' | 'Resolvido';
  description: string;
}

export interface Report {
  name: string;
  type: 'PDF' | 'XLSX' | 'CSV';
  size: string;
  date: string;
}

// Risk Management (PGR/GRO)
export type RiskType = 'fisico' | 'quimico' | 'biologico' | 'ergonomico' | 'acidente';
export type RiskStatus = 'aberto' | 'em_andamento' | 'resolvido';
export type ActionPlanStatus = 'pendente' | 'em_andamento' | 'concluído';

export interface Risk {
  id: number;
  company_id: string;
  sector_id?: number | null;
  risk_type: RiskType;
  description: string;
  source?: string;
  probability: number;
  severity: number;
  risk_level: number;
  status: RiskStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  company_name?: string;
  sector_name?: string;
  action_plans?: ActionPlan[];
}

export interface ActionPlan {
  id: number;
  risk_id: number;
  measure: string;
  responsible: string;
  deadline: string;
  status: ActionPlanStatus;
  notes?: string;
  created_at: string;
}

// PPE / EPI Types
export interface Employee {
  id: number;
  company_id: string;
  name: string;
  role: string;
  admission_date?: string;
  cpf?: string;
  status: string;
}

export interface EPI {
  id: number;
  company_id: string;
  name: string;
  ca_number: string;
  manufacturer?: string;
  validity_days?: number;
  stock_quantity: number;
  description?: string;
}

export interface EPIDelivery {
  id: number;
  employee_id: number;
  epi_id: number;
  delivery_date: string;
  quantity: number;
  reason: string;
  technician_signature?: string;
  employee_signature?: string;
  next_exchange_date?: string;
  // Joined
  employee_name?: string;
  epi_name?: string;
  ca_number?: string;
}