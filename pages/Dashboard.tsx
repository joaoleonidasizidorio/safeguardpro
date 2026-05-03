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
      .then(res => {
        if (!res.ok) throw new Error('Falha ao buscar estatísticas');
        return res.json();
      })
      .then(data => {
        setStats(data || {
          compliance_rate: 0,
          risks_by_type: [],
          expired_epis: 0,
          trainings_expiring: 0,
          open_actions: 0,
          actions_by_status: [],
          incident_history: []
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching dashboard stats:', err);
        setLoading(false);
        setStats({
          compliance_rate: 0,
          risks_by_type: [],
          expired_epis: 0,
          trainings_expiring: 0,
          open_actions: 0,
          actions_by_status: [],
          incident_history: []
        });
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
              <BarChart data={stats?.risks_by_type || []}>
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
                  {stats?.actions_by_status?.map((entry: any, index: number) => (
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
          <div className="bg-gradient-to-br from-surface-dark to-black rounded-2xl p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Assistente SafeGuard</h3>
                  <p className="text-primary text-xs font-bold tracking-widest uppercase">Análise Proativa</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/15 transition-all cursor-pointer">
                  <div className="flex gap-4">
                    <span className="material-symbols-outlined text-orange-400">priority_high</span>
                    <div>
                      <h4 className="text-sm font-bold text-white">Renovação de EPIs Crítica</h4>
                      <p className="text-xs text-gray-400 mt-1">Existem {stats.expired_epis} itens vencidos que podem gerar multas em caso de fiscalização.</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/15 transition-all cursor-pointer">
                  <div className="flex gap-4">
                    <span className="material-symbols-outlined text-blue-400">calendar_month</span>
                    <div>
                      <h4 className="text-sm font-bold text-white">Próximo Vencimento de Treinamentos</h4>
                      <p className="text-xs text-gray-400 mt-1">{stats.trainings_expiring} colaboradores precisam de reciclagem de NR-35 até o próximo mês.</p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => onChangeView(View.ALERTS)}
                  className="w-full py-3 bg-primary text-background-dark font-black rounded-xl text-sm hover:scale-[1.02] transition-transform active:scale-95"
                >
                  GERAR RELATÓRIO DE IMPACTO
                </button>
              </div>
            </div>
            <div className="absolute -right-12 -bottom-12 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-[240px]">shield</span>
            </div>
          </div>

          <div className="glass rounded-xl p-5 border border-primary/20 flex gap-4 items-center">
            <div className="h-12 w-12 shrink-0 bg-primary/20 rounded-2xl flex items-center justify-center text-primary rotate-3">
              <span className="material-symbols-outlined text-3xl">psychology</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Dica do Especialista</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Manter a conformidade acima de <strong>90%</strong> reduz em até <strong>40%</strong> o custo com seguros ocupacionais e multas. 
                Sua taxa atual é de <span className="text-primary font-bold">{stats.compliance_rate}%</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};