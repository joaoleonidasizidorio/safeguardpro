import React, { useState } from 'react';
import { Modal } from '../components/Modal';

export const Help: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate sending logic
    setTimeout(() => {
        setIsModalOpen(false);
        setSupportForm({ subject: '', message: '' });
        alert("Mensagem enviada com sucesso! Nossa equipe entrará em contato em até 24h.");
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center py-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Como podemos ajudar?</h1>
        <div className="relative max-w-lg mx-auto mt-6">
          <input 
            type="text" 
            placeholder="Busque por dúvidas, tutoriais..." 
            className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark shadow-sm focus:ring-2 focus:ring-primary focus:outline-none dark:text-white"
          />
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-primary transition-colors cursor-pointer group">
          <span className="material-symbols-outlined text-4xl text-primary mb-4 group-hover:scale-110 transition-transform">menu_book</span>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Guia do Usuário</h3>
          <p className="text-sm text-gray-500">Documentação completa sobre todas as funcionalidades do sistema.</p>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-primary transition-colors cursor-pointer group">
           <span className="material-symbols-outlined text-4xl text-blue-500 mb-4 group-hover:scale-110 transition-transform">play_circle</span>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Tutoriais em Vídeo</h3>
          <p className="text-sm text-gray-500">Aprenda visualmente como realizar tarefas complexas.</p>
        </div>
        <div 
          onClick={() => setIsModalOpen(true)}
          className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-primary transition-colors cursor-pointer group"
        >
           <span className="material-symbols-outlined text-4xl text-purple-500 mb-4 group-hover:scale-110 transition-transform">support_agent</span>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Falar com Suporte</h3>
          <p className="text-sm text-gray-500">Entre em contato direto com nossa equipe especializada.</p>
        </div>
      </div>

      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Perguntas Frequentes</h2>
        
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <details className="group">
            <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-4 bg-gray-50 dark:bg-gray-800/30 group-open:bg-primary/10 transition-colors text-gray-900 dark:text-white">
              <span>Como exportar um relatório em PDF?</span>
              <span className="transition group-open:rotate-180 material-symbols-outlined">expand_more</span>
            </summary>
            <div className="text-gray-600 dark:text-gray-300 p-4 text-sm leading-relaxed border-t border-gray-100 dark:border-gray-800">
              Vá até a aba "Relatórios" no menu lateral. Selecione o relatório desejado e clique no ícone de download à direita da linha correspondente.
            </div>
          </details>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <details className="group">
            <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-4 bg-gray-50 dark:bg-gray-800/30 group-open:bg-primary/10 transition-colors text-gray-900 dark:text-white">
              <span>Como adicionar um novo funcionário?</span>
              <span className="transition group-open:rotate-180 material-symbols-outlined">expand_more</span>
            </summary>
            <div className="text-gray-600 dark:text-gray-300 p-4 text-sm leading-relaxed border-t border-gray-100 dark:border-gray-800">
              O cadastro de funcionários é feito através da aba "Empresas". Selecione a empresa do funcionário e clique em "Gerenciar Equipe" para adicionar novos membros.
            </div>
          </details>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <details className="group">
            <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-4 bg-gray-50 dark:bg-gray-800/30 group-open:bg-primary/10 transition-colors text-gray-900 dark:text-white">
              <span>O que fazer quando uma NR é atualizada?</span>
              <span className="transition group-open:rotate-180 material-symbols-outlined">expand_more</span>
            </summary>
            <div className="text-gray-600 dark:text-gray-300 p-4 text-sm leading-relaxed border-t border-gray-100 dark:border-gray-800">
              Nosso sistema é atualizado automaticamente com as novas normas. Você receberá uma notificação na aba "Alertas" caso alguma conformidade precise ser revista devido à mudança na lei.
            </div>
          </details>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Falar com Suporte">
         <form onSubmit={handleSendMessage} className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assunto</label>
             <select 
               className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white focus:ring-primary focus:border-primary"
               value={supportForm.subject}
               onChange={e => setSupportForm({...supportForm, subject: e.target.value})}
               required
             >
               <option value="">Selecione um assunto...</option>
               <option value="Dúvida Técnica">Dúvida Técnica</option>
               <option value="Problema no Sistema">Relatar Erro/Bug</option>
               <option value="Sugestão">Sugestão de Melhoria</option>
               <option value="Financeiro">Financeiro / Faturamento</option>
             </select>
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem</label>
             <textarea 
               className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white h-32 focus:ring-primary focus:border-primary"
               placeholder="Descreva detalhadamente como podemos te ajudar..."
               value={supportForm.message}
               onChange={e => setSupportForm({...supportForm, message: e.target.value})}
               required
             ></textarea>
           </div>
           <div className="pt-4 flex justify-end gap-3">
             <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-surface-dark dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">Cancelar</button>
             <button type="submit" className="px-4 py-2 text-sm font-medium text-black bg-primary rounded-lg hover:bg-green-400">Enviar Mensagem</button>
          </div>
         </form>
      </Modal>
    </div>
  );
};