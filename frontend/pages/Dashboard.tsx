import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend } from 'recharts';
import { View } from '../types';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

interface DashboardProps {
  onChangeView: (view: View) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onChangeView }) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const userRole = localStorage.getItem('safeguard_user_type');
  const userCompanyId = localStorage.getItem('safeguard_company_id');

  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/companies`)
      .then(res => res.json())
      .then(data => {
        setCompanies(data);
        if (userCompanyId && userCompanyId !== 'null') {
          setSelectedCompanyId(userCompanyId);
        } else if (data.length > 0) {
          setSelectedCompanyId(data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    authFetch(`${API_BASE_URL}/api/stats?company_id=${selectedCompanyId}`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching dashboard stats:', err);
        setLoading(false);
      });
  }, [selectedCompanyId]);

  if (loading) return <div className="p-10 text-center animate-pulse text-gray-500">Carregando indicadores...</div>;
  if (!stats) return <div className="p-10 text-center text-gray-500">Selecione uma empresa para visualizar os indicadores.</div>;

  const COLORS = ['#13ec6d', '#ff9800', '#f44336', '#2196f3', '#9c27b0'];

  const metrics = [
    { label: 'Conformidade', value: `${stats.compliance_rate}%`, icon: 'verified', change: 'Média Auditorias', changeType: stats.compliance_rate > 80 ? 'positive' : 'neutral', view: View.AUDIT },
    { label: 'EPIs a Vencer', value: stats.expired_epis, icon: 'construction', change: 'Próximos 30 dias', changeType: stats.expired_epis > 0 ? 'negative' : 'positive', view: View.EPI_MANAGEMENT },
    { label: 'Treinamentos', value: stats.trainings_expiring, icon: 'school', change: 'Vencendo em breve', changeType: stats.trainings_expiring > 0 ? 'neutral' : 'positive', view: View.TRAININGS },
    { label: 'Ações Abertas', value: stats.open_actions, icon: 'report_problem', change: 'Pendências Críticas', changeType: stats.open_actions > 0 ? 'negative' : 'positive', view: View.RISKS },
  ];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">Painel de Indicadores</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Status de segurança e conformidade em tempo real.</p>
        </div>
        <div className="flex gap-4">
          {(userRole === 'admin' || userRole === 'technician') && companies.length > 1 && (
            <select
              className="rounded-lg border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-surface-dark dark:text-gray-200"
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(e.target.value)}
            >
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button
            onClick={() => onChangeView(View.AUDIT)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background-dark shadow-sm hover:bg-green-400 transition-all"
          >
            Vistoria Rápida
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((stat, index) => (
          <div
            key={index}
            onClick={() => stat.view && onChangeView(stat.view)}
            className="group relative overflow-hidden rounded-xl bg-surface-light p-6 shadow-sm border border-gray-100 dark:bg-surface-dark dark:border-gray-800 cursor-pointer hover:border-primary/50 transition-all active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">{stat.label}</p>
                <h3 className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{stat.value}</h3>
                <p className={`mt-1 flex items-center text-xs font-bold ${stat.changeType === 'negative' ? 'text-red-500' : stat.changeType === 'neutral' ? 'text-orange-500' : 'text-primary'}`}>
                  {stat.change}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.changeType === 'negative' ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : stat.changeType === 'neutral' ? 'bg-orange-50 text-orange-500 dark:bg-orange-900/20' : 'bg-primary/10 text-primary'}`}>
                <span className="material-symbols-outlined text-[24px] font-bold">{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Incident History chart */}
        <div className="rounded-xl bg-surface-light p-6 shadow-sm border border-gray-100 dark:bg-surface-dark dark:border-gray-800">
          <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500">history</span>
            Acidentes / Incidentes (6 meses)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.incident_history}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorInc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risks per type */}
        <div className="rounded-xl bg-surface-light p-6 shadow-sm border border-gray-100 dark:bg-surface-dark dark:border-gray-800">
          <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500">warning</span>
            Riscos por Categoria
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.risks_by_type}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis dataKey="risk_type" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#13ec6d" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Action Status Pie */}
        <div className="rounded-xl bg-surface-light p-6 shadow-sm border border-gray-100 dark:bg-surface-dark dark:border-gray-800 lg:col-span-1">
          <h3 className="font-bold text-gray-900 dark:text-white mb-6">Status dos Planos de Ação</h3>
          <div className="flex flex-col items-center justify-center h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.actions_by_status}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {stats.actions_by_status.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{stats.open_actions}</span>
              <span className="text-[10px] text-gray-500 uppercase font-black">Pendentes</span>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            {stats.actions_by_status.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="text-gray-600 dark:text-gray-400 capitalize">{item.status}</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info Card - Quick Actions & Insights */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-800 shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-2">Resumo Consultivo</h3>
              <p className="text-gray-400 text-sm mb-6">Baseado nos dados atuais, aqui estão os pontos de atenção para auditorias.</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group" onClick={() => onChangeView(View.TRAININGS)}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="material-symbols-outlined text-blue-400">school</span>
                    <span className="text-xs font-bold text-blue-400">{stats.trainings_expiring} alertas</span>
                  </div>
                  <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">Treinamentos a vencer</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group" onClick={() => onChangeView(View.EPI_MANAGEMENT)}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="material-symbols-outlined text-orange-400">construction</span>
                    <span className="text-xs font-bold text-orange-400">{stats.expired_epis} trocas</span>
                  </div>
                  <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">EPIs pendentes</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-10">
              <span className="material-symbols-outlined text-[160px]">monitoring</span>
            </div>
          </div>

          <div className="bg-primary/5 rounded-xl p-5 border border-primary/20 flex gap-4">
            <div className="h-10 w-10 shrink-0 bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">lightbulb</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Insight do Sistema</h4>
              <p className="text-xs text-gray-500 mt-1">O índice de conformidade em <strong>{stats.compliance_rate}%</strong> está {stats.compliance_rate > 90 ? 'excelente' : 'estável'} para o setor. {stats.open_actions > 5 ? 'Recomenda-se focar no fechamento das não conformidades críticas.' : ''}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};