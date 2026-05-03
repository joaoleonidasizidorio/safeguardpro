import { Company, Metric, Training, Alert, Report } from "./types";

export const COMPANIES: Company[] = [
  {
    id: "4920",
    name: "Soluções Construção Ltda",
    contact: "João Silva",
    email: "joao@solucoes.com.br",
    status: "active",
    lastVisit: "24 Out, 2023",
    nextVisit: "24 Nov, 2023",
    initials: "SC"
  },
  {
    id: "8832",
    name: "Logística Segura",
    contact: "Ana Souza",
    email: "ana@logistica.com.br",
    status: "irregular",
    lastVisit: "12 Set, 2023",
    nextVisit: "12 Out, 2023",
    initials: "LS"
  },
  {
    id: "2109",
    name: "Construtora Edifica Bem",
    contact: "Roberto Dias",
    email: "roberto@edificabem.com.br",
    status: "pending",
    lastVisit: "05 Ago, 2023",
    nextVisit: "05 Nov, 2023",
    initials: "CE"
  },
  {
    id: "5541",
    name: "Desenvolvedora Urbana",
    contact: "Emília Costa",
    email: "emilia@urbana.com.br",
    status: "active",
    lastVisit: "20 Out, 2023",
    nextVisit: "20 Jan, 2024",
    initials: "DU"
  },
  {
    id: "1234",
    name: "Transportes Metro",
    contact: "Miguel Verde",
    email: "miguel@metro.com.br",
    status: "irregular",
    lastVisit: "28 Set, 2023",
    nextVisit: "28 Out, 2023",
    initials: "TM"
  }
];

export const TRAININGS: Training[] = [
  {
    id: "TR-001",
    employeeName: "Carlos Mendes",
    role: "Eletricista",
    course: "NR-10 Básico",
    status: "valid",
    validity: "12 Dez, 2024",
    avatarUrl: "https://i.pravatar.cc/150?u=carlos"
  },
  {
    id: "TR-002",
    employeeName: "Fernanda Lima",
    role: "Op. de Empilhadeira",
    course: "NR-11 Transporte",
    status: "expiring",
    validity: "15 Nov, 2023",
    avatarUrl: "https://i.pravatar.cc/150?u=fernanda"
  },
  {
    id: "TR-003",
    employeeName: "Ricardo Gomes",
    role: "Mestre de Obras",
    course: "NR-35 Trabalho em Altura",
    status: "expired",
    validity: "01 Out, 2023",
    avatarUrl: "https://i.pravatar.cc/150?u=ricardo"
  },
  {
    id: "TR-004",
    employeeName: "Patrícia Alves",
    role: "Engenheira Civil",
    course: "CIPA",
    status: "valid",
    validity: "20 Ago, 2024",
    avatarUrl: "https://i.pravatar.cc/150?u=patricia"
  }
];

export const DASHBOARD_STATS: Metric[] = [
  { label: 'Empresas Ativas', value: '42', change: '+12%', changeType: 'positive', icon: 'domain', colorClass: 'bg-primary/10 text-primary' },
  { label: 'Treinamentos Vencidos', value: '8', change: '-2', changeType: 'positive', icon: 'school', colorClass: 'bg-red-50 text-red-500' },
  { label: 'Vistorias Pendentes', value: '5', change: 'Hoje', changeType: 'neutral', icon: 'pending_actions', colorClass: 'bg-orange-50 text-orange-500' },
  { label: 'Funcionários Ativos', value: '1,240', change: '+5%', changeType: 'positive', icon: 'groups', colorClass: 'bg-blue-50 text-blue-500' },
];

export const CHART_DATA = [
  { name: 'Jan', value: 40 },
  { name: 'Fev', value: 30 },
  { name: 'Mar', value: 45 },
  { name: 'Abr', value: 80 },
  { name: 'Mai', value: 65 },
  { name: 'Jun', value: 90 },
];

export const PIE_DATA = [
  { name: 'Concluídos', value: 65, fill: '#13ec6d' },
  { name: 'Em Andamento', value: 25, fill: '#f59e0b' },
  { name: 'Atrasados', value: 10, fill: '#ef4444' },
];

export const ALERTS: Alert[] = [
  { id: 1, type: 'Crítico', title: 'Extintores Vencidos - Galpão B', date: '24 Out, 2023', status: 'Pendente', description: '3 Extintores de CO2 encontraram-se vencidos durante a inspeção matinal.' },
  { id: 2, type: 'Médio', title: 'Sinalização Apagada - Corredor 4', date: '22 Out, 2023', status: 'Em Análise', description: 'Faixas de pedestre desgastadas, dificultando a visualização.' },
  { id: 3, type: 'Baixo', title: 'Lâmpada de Emergência Queimada', date: '20 Out, 2023', status: 'Resolvido', description: 'Substituição realizada pela equipe de manutenção.' },
  { id: 4, type: 'Crítico', title: 'Vazamento de Óleo - Máquina 02', date: '19 Out, 2023', status: 'Pendente', description: 'Risco de queda e contaminação. Área isolada.' },
];

export const REPORTS: Report[] = [
  { name: 'Relatório Mensal de Segurança - Out/2023', type: 'PDF', size: '2.4 MB', date: '01 Nov, 2023' },
  { name: 'Auditoria de Conformidade NR-10', type: 'XLSX', size: '1.1 MB', date: '28 Out, 2023' },
  { name: 'Controle de Entrega de EPIs', type: 'PDF', size: '856 KB', date: '15 Out, 2023' },
  { name: 'Indicadores de Acidentes Trimestral', type: 'PDF', size: '3.2 MB', date: '01 Out, 2023' },
  { name: 'Status de Treinamentos - Equipe Operacional', type: 'CSV', size: '450 KB', date: '25 Set, 2023' },
];