import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export const Settings: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    job_role: "",
    email: "",
    avatar_url: "",
    signature_url: "",
    cpf: ""
  });

  const [notifications, setNotifications] = useState({
    expiration: true,
    weeklyReport: false
  });

  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" });
  const [whiteLabel, setWhiteLabel] = useState({ brand_name: "", logo_url: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const getAuthToken = () => localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('auth_token');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFormData({
          name: data.name || "",
          job_role: data.job_role || "",
          email: data.email || "",
          avatar_url: data.avatar_url || "",
          signature_url: data.signature_url || "",
          cpf: data.cpf || ""
        });
        setNotifications({
          expiration: data.notif_expiration ?? true,
          weeklyReport: data.notif_weekly_report ?? false
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhiteLabel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/white-label`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWhiteLabel({
          brand_name: data.brand_name || "",
          logo_url: data.logo_url || ""
        });
        if (data.logo_url) localStorage.setItem('safeguard_brand_logo', data.logo_url);
        if (data.brand_name) localStorage.setItem('safeguard_brand_name', data.brand_name);
      }
    } catch (error) {
      console.error('Error fetching white label:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchWhiteLabel();
  }, []);

  const [signatureFile, setSignatureFile] = useState<File | null>(null);



  const handleSave = async () => {
    try {
      const uploadData = new FormData();
      uploadData.append('name', formData.name);
      uploadData.append('job_role', formData.job_role);
      uploadData.append('email', formData.email);
      uploadData.append('cpf', formData.cpf);
      uploadData.append('notif_expiration', String(notifications.expiration));
      uploadData.append('notif_weekly_report', String(notifications.weeklyReport));

      if (signatureFile) {
        uploadData.append('signature', signatureFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: uploadData
      });

      const responseData = await res.json();

      if (res.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
        fetchProfile();
      } else {
        alert('Erro ao salvar: ' + (responseData.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Erro de conexão');
    }
  };

  const handleSaveWhiteLabel = async () => {
    try {
      const uploadData = new FormData();
      uploadData.append('brand_name', whiteLabel.brand_name);
      if (logoFile) {
        uploadData.append('logo', logoFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/white-label`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: uploadData
      });

      if (res.ok) {
        const data = await res.json();
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
        localStorage.setItem('safeguard_brand_logo', data.logo_url);
        localStorage.setItem('safeguard_brand_name', data.brand_name);
        window.dispatchEvent(new Event('white-label-update'));
        fetchWhiteLabel();
      } else {
        alert('Erro ao salvar marca');
      }
    } catch (error) {
      console.error('Error saving white label:', error);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.new !== passwordData.confirm) return alert('Senhas não conferem');
    if (!passwordData.new) return alert('Senha não pode ser vazia');

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.current,
          newPassword: passwordData.new
        })
      });

      if (res.ok) {
        alert('Senha alterada com sucesso!');
        setShowPasswordModal(false);
        setPasswordData({ current: "", new: "", confirm: "" });
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao alterar senha');
      }
    } catch (error) {
      alert('Erro de conexão');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-gray-500 dark:text-gray-400">Gerencie suas preferências de conta e notificações.</p>
      </div>

      <div className="grid gap-8">
        {/* Profile Section */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 relative overflow-hidden">
          {isSaved && (
            <div className="absolute top-0 left-0 w-full bg-green-500 text-black text-xs font-bold text-center py-1 animate-fade-in z-10">
              Alterações salvas com sucesso!
            </div>
          )}
          <div className="flex items-center justify-between mb-6 mt-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person</span>
              Perfil do Usuário
            </h2>
            <button onClick={handleSave} className="bg-primary text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors">Salvar Alterações</button>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center gap-3">
              <div
                onClick={() => document.getElementById('avatar-upload')?.click()}
                className="h-24 w-24 rounded-full bg-gray-200 overflow-hidden relative group cursor-pointer border-2 border-transparent hover:border-primary transition-all shadow-md"
              >
                <img
                  src={formData.avatar_url ? `${API_BASE_URL}${formData.avatar_url}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=13ec6d&color=000`}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white">photo_camera</span>
                </div>
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const uploadData = new FormData();
                    uploadData.append('avatar', file);

                    try {
                      const res = await fetch(`${API_BASE_URL}/api/profile/avatar`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('authToken')}` },
                        body: uploadData
                      });

                      if (res.ok) {
                        const data = await res.json();
                        setFormData(prev => ({ ...prev, avatar_url: data.url }));
                        localStorage.setItem('safeguard_user_avatar', data.url);
                        window.dispatchEvent(new Event('user-profile-update'));
                        alert('Avatar atualizado com sucesso!');
                      } else {
                        alert('Erro ao enviar imagem');
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Erro de conexão ao enviar imagem');
                    }
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Clique para alterar</p>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo / Função</label>
                <input
                  type="text"
                  value={formData.job_role}
                  onChange={(e) => setFormData({ ...formData, job_role: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF (Para Assinatura)</label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">Este CPF aparecerá nos certificados abaixo da sua assinatura.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">notifications</span>
            Notificações
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Alertas de Vencimento</h3>
                <p className="text-xs text-gray-500">Receber e-mail quando treinamentos ou documentos estiverem para vencer.</p>
              </div>
              <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                <input
                  type="checkbox"
                  id="toggle1"
                  checked={notifications.expiration}
                  onChange={() => setNotifications({ ...notifications, expiration: !notifications.expiration })}
                  className={`toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-200 top-1 ${notifications.expiration ? 'right-1 border-primary' : 'left-1 border-gray-400'}`}
                />
                <label htmlFor="toggle1" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ${notifications.expiration ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}></label>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Relatórios Semanais</h3>
                <p className="text-xs text-gray-500">Resumo automático enviado toda segunda-feira.</p>
              </div>
              <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                <input
                  type="checkbox"
                  id="toggle2"
                  checked={notifications.weeklyReport}
                  onChange={() => setNotifications({ ...notifications, weeklyReport: !notifications.weeklyReport })}
                  className={`toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-200 top-1 ${notifications.weeklyReport ? 'right-1 border-primary' : 'left-1 border-gray-400'}`}
                />
                <label htmlFor="toggle2" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ${notifications.weeklyReport ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}></label>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">ink_pen</span>
            Assinatura Digital (Rubrica)
          </h2>

          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Faça upload da imagem da sua rubrica. Ela será inserida automaticamente nos certificados emitidos.
            </p>

            {formData.signature_url && (
              <div className="border rounded-lg p-4 flex justify-center bg-white dark:bg-gray-800">
                <img src={`${API_BASE_URL}${formData.signature_url}`} alt="Assinatura Atual" className="h-24 object-contain" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Selecione nova imagem</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-black hover:file:bg-primary-dark cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">lock</span>
            Segurança
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Senha de Acesso</p>
              <p className="text-xs text-gray-500">Proteja sua conta com uma senha forte.</p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Redefinir Senha
            </button>
          </div>
        </div>

        {/* White Label Section */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">brand_awareness</span>
              Personalização (White-label)
            </h2>
            <button onClick={handleSaveWhiteLabel} className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-all">Aplicar Minha Marca</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome da sua Marca/Consultoria</label>
                <input
                  type="text"
                  value={whiteLabel.brand_name}
                  onChange={(e) => setWhiteLabel({ ...whiteLabel, brand_name: e.target.value })}
                  placeholder="Ex: Leonidas Consultoria SST"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex gap-3">
                <span className="material-symbols-outlined text-blue-500 text-sm">info</span>
                <p className="text-[10px] text-blue-700 dark:text-blue-300">Este nome substituirá o "SafeGuard Pro" no topo do menu e na página de login para seus clientes.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Seu Logotipo (PNG/JPG)</label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-surface-dark overflow-hidden">
                  {whiteLabel.logo_url || logoFile ? (
                    <img 
                      src={logoFile ? URL.createObjectURL(logoFile) : `${API_BASE_URL}${whiteLabel.logo_url}`} 
                      className="max-h-full max-w-full object-contain" 
                    />
                  ) : (
                    <span className="material-symbols-outlined text-gray-400">image</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="block text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-100 dark:file:bg-gray-800 file:text-gray-700 dark:file:text-gray-300 hover:file:opacity-80 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-dark rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Alterar Senha</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha Atual</label>
                <input
                  type="password"
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={passwordData.new}
                  onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={passwordData.confirm}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasswordChange}
                className="flex-2 bg-primary text-black px-8 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                Confirmar Alteração
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};