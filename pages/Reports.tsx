import React, { useState } from 'react';
import { REPORTS } from '../constants';
import { Report } from '../types';
import { Modal } from '../components/Modal';

export const Reports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>(REPORTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReportType, setNewReportType] = useState('Geral');
  
  // Feedback state
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const generated: Report = {
      name: `Relatório ${newReportType} - Gerado Agora`,
      type: 'PDF',
      size: '1.5 MB',
      date: 'Hoje'
    };
    setReports([generated, ...reports]);
    setIsModalOpen(false);
  };

  const handleDownload = (fileName: string) => {
    setDownloading(fileName);
    setTimeout(() => setDownloading(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Central de Relatórios</h1>
          <p className="text-gray-500 dark:text-gray-400">Acesse documentos históricos e gere novas análises.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          <span className="material-symbols-outlined">add_chart</span>
          Gerar Novo Relatório
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Cards */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 flex flex-col items-center text-center cursor-pointer hover:shadow-md transition-all">
          <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-200 flex items-center justify-center mb-3">
             <span className="material-symbols-outlined">analytics</span>
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Geral</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Visão 360º da empresa</p>
        </div>
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50 flex flex-col items-center text-center cursor-pointer hover:shadow-md transition-all">
          <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-200 flex items-center justify-center mb-3">
             <span className="material-symbols-outlined">people</span>
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Funcionários</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Treinamentos e EPIs</p>
        </div>
        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/50 flex flex-col items-center text-center cursor-pointer hover:shadow-md transition-all">
          <div className="h-12 w-12 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-200 flex items-center justify-center mb-3">
             <span className="material-symbols-outlined">gavel</span>
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Legal</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Auditorias e NRs</p>
        </div>
        <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 flex flex-col items-center text-center cursor-pointer hover:shadow-md transition-all">
          <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-800 dark:text-orange-200 flex items-center justify-center mb-3">
             <span className="material-symbols-outlined">inventory_2</span>
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Incidentes</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Registros e CATs</p>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Arquivos Recentes</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {reports.map((report, idx) => (
            <div key={idx} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between group transition-colors animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                  <span className="material-symbols-outlined">description</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">{report.name}</h4>
                  <p className="text-xs text-gray-500">{report.date} • {report.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-bold ${report.type === 'PDF' ? 'bg-red-50 text-red-600' : report.type === 'XLSX' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  {report.type}
                </span>
                <button 
                  onClick={() => handleDownload(report.name)}
                  className="p-2 text-gray-400 hover:text-primary transition-colors relative"
                  title="Baixar Arquivo"
                >
                  <span className="material-symbols-outlined">download</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Download Toast Notification */}
        {downloading && (
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in z-20 whitespace-nowrap">
             <span className="material-symbols-outlined animate-bounce">downloading</span>
             <div className="flex flex-col">
                <span className="text-sm font-bold">Baixando arquivo...</span>
                <span className="text-xs opacity-80 truncate max-w-[200px]">{downloading}</span>
             </div>
           </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Gerar Novo Relatório">
        <form onSubmit={handleGenerate} className="space-y-4">
           <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
             <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
             <p className="text-sm text-blue-800 dark:text-blue-300">O processamento pode levar alguns instantes dependendo da quantidade de dados.</p>
           </div>
           
           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Relatório</label>
             <select 
               className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
               value={newReportType}
               onChange={(e) => setNewReportType(e.target.value)}
             >
               <option value="Geral">Visão Geral Completa</option>
               <option value="Conformidade">Auditoria de Conformidade (NRs)</option>
               <option value="Funcionários">Status de Treinamentos</option>
               <option value="Incidentes">Registro de Incidentes</option>
             </select>
           </div>

           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Formato</label>
             <div className="flex gap-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input type="radio" name="format" defaultChecked className="text-primary focus:ring-primary" />
                 <span className="text-sm text-gray-700 dark:text-gray-300">PDF</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input type="radio" name="format" className="text-primary focus:ring-primary" />
                 <span className="text-sm text-gray-700 dark:text-gray-300">Excel (XLSX)</span>
               </label>
             </div>
           </div>

           <div className="pt-4 flex justify-end gap-3">
             <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-surface-dark dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">Cancelar</button>
             <button type="submit" className="px-4 py-2 text-sm font-medium text-black bg-primary rounded-lg hover:bg-green-400">Gerar Agora</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};