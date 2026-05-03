import React, { useState, useEffect } from 'react';
import { Alert } from '../types';
import { Modal } from '../components/Modal';
import { API_BASE_URL } from '../config';

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'Todos' | 'Crítico' | 'Médio' | 'Baixo'>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [newAlert, setNewAlert] = useState({ title: '', type: 'Médio', description: '' });

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/risks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const mappedAlerts: Alert[] = data.map((risk: any) => ({
          id: risk.id,
          title: `${risk.risk_type} - ${risk.company_name || 'Empresa'}`,
          type: mapSeverityToType(risk.risk_level || risk.severity),
          description: risk.description,
          date: new Date(risk.created_at || Date.now()).toLocaleDateString('pt-BR'),
          status: mapStatus(risk.status)
        }));
        setAlerts(mappedAlerts);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const mapSeverityToType = (level: number | string): 'Baixo' | 'Médio' | 'Crítico' => {
    if (typeof level === 'string') return level as any;
    if (level >= 3) return 'Crítico';
    if (level === 2) return 'Médio';
    return 'Baixo';
  };

  const mapStatus = (status: string) => {
    // Map backend status to frontend status if needed
    if (status === 'Controlado' || status === 'Mitigado') return 'Resolvido';
    return status || 'Pendente';
  };

  const handleResolve = async (id: number) => {
    // Optimistic update
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, status: 'Resolvido' } : alert
    ));

    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_BASE_URL}/api/risks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Controlado' }) // Assuming 'Controlado' is the resolved status
      });
      fetchAlerts(); // Refresh to be sure
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    // NOTE: This simple UI doesn't allow selecting Company. 
    // For now, we just mock the add to UI or require more complex form. 
    // Given the user just wants to CLEAN the data, fetching is most important.
    // Implementing ADD properly would require a Company Selector.
    // For now, we will just close the modal.
    alert("Funcionalidade de adicionar risco simplificada. Use o módulo 'Gestão de Riscos' para adicionar riscos completos.");
    setIsModalOpen(false);
  };

  const handleViewDetails = (alert: Alert) => {
    setSelectedAlert(alert);
    setIsDetailsModalOpen(true);
  };

  const filteredAlerts = alerts.filter(alert => filter === 'Todos' || alert.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 id="DEBUG_ALERTS_H1" className="text-3xl font-black text-gray-900 dark:text-white">Não Conformidades (Atualizado)</h1>
          <p className="text-gray-500 dark:text-gray-400">Gerencie riscos e alertas de segurança em tempo real.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-red-600/20 transition-all"
        >
          <span className="material-symbols-outlined">report_problem</span>
          Reportar Risco
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined">error</span>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Riscos Críticos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {alerts.filter(a => a.type === 'Crítico' && a.status !== 'Resolvido').length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Em Análise</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {alerts.filter(a => a.status === 'Em Análise').length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Resolvidos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {alerts.filter(a => a.status === 'Resolvido').length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-surface-dark flex gap-4 items-center justify-between">
          <div className="flex gap-2 items-center">
            <span className="material-symbols-outlined text-gray-400">filter_list</span>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filtrar por Gravidade:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-transparent text-sm font-bold text-gray-900 dark:text-white border-none focus:ring-0 cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="Crítico">Crítico</option>
              <option value="Médio">Médio</option>
              <option value="Baixo">Baixo</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {filteredAlerts.length > 0 ? filteredAlerts.map((alert) => (
            <div key={alert.id} className={`p-6 transition-all flex flex-col md:flex-row gap-4 items-start md:items-center ${alert.status === 'Resolvido' ? 'opacity-60 bg-gray-50 dark:bg-black/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
              <div className={`shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${alert.status === 'Resolvido' ? 'bg-gray-200 text-gray-500 dark:bg-gray-800' :
                alert.type === 'Crítico' ? 'bg-red-100 text-red-600 dark:bg-red-900/20' :
                  alert.type === 'Médio' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20' :
                    'bg-blue-100 text-blue-600 dark:bg-blue-900/20'
                }`}>
                <span className="material-symbols-outlined">
                  {alert.status === 'Resolvido' ? 'check' : alert.type === 'Crítico' ? 'dangerous' : alert.type === 'Médio' ? 'warning' : 'info'}
                </span>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`text-base font-bold ${alert.status === 'Resolvido' ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>{alert.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${alert.type === 'Crítico' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                    alert.type === 'Médio' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    }`}>{alert.type}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{alert.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_today</span> {alert.date}</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">pending</span> {alert.status}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                {alert.status !== 'Resolvido' && (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className="flex-1 md:flex-none px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-green-400 shadow-sm"
                  >
                    Resolver
                  </button>
                )}
                <button
                  onClick={() => handleViewDetails(alert)}
                  className="flex-1 md:flex-none px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Detalhes
                </button>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              <p>Nenhum alerta encontrado para este filtro.</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Reportar Novo Risco">
        <form onSubmit={handleAddAlert} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título do Ocorrido</label>
            <input
              required
              type="text"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              value={newAlert.title}
              onChange={e => setNewAlert({ ...newAlert, title: e.target.value })}
              placeholder="Ex: Fiação exposta no setor B"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gravidade</label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              value={newAlert.type}
              onChange={e => setNewAlert({ ...newAlert, type: e.target.value })}
            >
              <option value="Baixo">Baixo</option>
              <option value="Médio">Médio</option>
              <option value="Crítico">Crítico</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição Detalhada</label>
            <textarea
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white h-24"
              value={newAlert.description}
              onChange={e => setNewAlert({ ...newAlert, description: e.target.value })}
              placeholder="Descreva o local e a situação..."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-surface-dark dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-black bg-primary rounded-lg hover:bg-green-400">Registrar Alerta</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes da Não Conformidade">
        {selectedAlert && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedAlert.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedAlert.date}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${selectedAlert.type === 'Crítico' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                selectedAlert.type === 'Médio' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                {selectedAlert.type}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descrição da Ocorrência</h4>
                <div className="bg-gray-50 dark:bg-background-dark p-4 rounded-lg border border-gray-100 dark:border-gray-800 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {selectedAlert.description}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status Atual</h4>
                  <p className={`text-sm font-bold ${selectedAlert.status === 'Resolvido' ? 'text-primary' : 'text-orange-500'}`}>{selectedAlert.status}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-6 py-2.5 bg-gray-900 text-white dark:bg-primary dark:text-black rounded-lg text-sm font-bold hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};