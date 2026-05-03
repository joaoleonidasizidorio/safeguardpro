import React, { useState, useCallback } from 'react';
import { useIdleTimer } from './utils/useIdleTimer';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Companies } from './pages/Companies';
import { Trainings } from './pages/Trainings';
import { Alerts } from './pages/Alerts';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Help } from './pages/Help';
import { Audit } from './pages/Audit';
import { Visits } from './pages/Visits';
import { InspectionForm } from './pages/InspectionForm';
import { Evidences } from './pages/Evidences';
import { RiskManagement } from './pages/RiskManagement';
import { EPIManagement } from './pages/EPIManagement';
import { LegalDocuments } from './pages/LegalDocuments';
import { IncidentManagement } from './pages/IncidentManagement';
import { Notifications } from './pages/Notifications';
import { Admin } from './pages/Admin';
import { Subscription } from './pages/Subscription';
import { ASOManagement } from './pages/ASOManagement';

import { View } from './types';

import { PortalLayout } from './components/PortalLayout';
import { PortalDashboard } from './pages/PortalDashboard';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('safeguard_auth') === 'true';
  });

  const [userType, setUserType] = useState<string | null>(() => {
    return localStorage.getItem('safeguard_user_type');
  });

  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);

  // Função de logout
  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setUserType(null);
    localStorage.removeItem('safeguard_auth');
    localStorage.removeItem('safeguard_user_type');
    localStorage.removeItem('safeguard_company_id');
    localStorage.removeItem('safeguard_user_name');
  }, []);

  // Logout por inatividade - 5 minutos (300000ms)
  const handleIdleLogout = useCallback(() => {
    console.log('⏰ Sessão expirada por inatividade');
    handleLogout();
    // Opcional: mostrar mensagem ao usuário
    alert('Sua sessão expirou por inatividade. Por favor, faça login novamente.');
  }, [handleLogout]);

  // Hook de inatividade - ativo apenas quando logado
  useIdleTimer({
    timeout: 5 * 60 * 1000, // 5 minutos em milissegundos
    onIdle: handleIdleLogout,
    enabled: isAuthenticated
  });

  const handleLogin = () => {
    setIsAuthenticated(true);
    // Refresh user type from storage set by Login component
    setUserType(localStorage.getItem('safeguard_user_type'));
    setCurrentView(View.DASHBOARD);
  };

  const renderContent = () => {
    // Company Portal Logic
    if (userType === 'company' || userType === 'client') {
      switch (currentView) {
        case View.DASHBOARD:
          return <PortalDashboard />;
        case View.REPORTS:
          return <Reports />; // Reuse existing for now
        case View.RISKS:
          return <RiskManagement />; // Reuse existing for now
        case View.SETTINGS:
          return <Settings />;
        default:
          return <PortalDashboard />;
      }
    }

    // Technician/Admin Logic (Existing)
    const isAdminOrTech = userType === 'admin' || userType === 'technician';

    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard onChangeView={setCurrentView} />;

      case View.COMPANIES:
      case View.VISITS:
      case View.ADMIN:
      case View.SUBSCRIPTION:
        // Guards for restricted roles
        if (!isAdminOrTech) return <Dashboard onChangeView={setCurrentView} />;

        if (currentView === View.COMPANIES) return <Companies />;
        if (currentView === View.VISITS) return <Visits />;
        if (currentView === View.ADMIN) return <Admin />;
        if (currentView === View.SUBSCRIPTION) return <Subscription />;
        return <Dashboard onChangeView={setCurrentView} />;

      case View.AUDIT:
        return <Audit onNavigateToInspection={(id) => {
          setSelectedInspectionId(id);
          setCurrentView(View.INSPECTION_FORM);
        }} />;

      case View.TRAININGS:
        return <Trainings />;
      case View.ALERTS:
        return <Alerts />;
      case View.INSPECTION_FORM:
        return selectedInspectionId ? (
          <InspectionForm
            inspectionId={selectedInspectionId}
            onBack={() => setCurrentView(View.AUDIT)}
          />
        ) : <Audit onNavigateToInspection={(id) => {
          setSelectedInspectionId(id);
          setCurrentView(View.INSPECTION_FORM);
        }} />;

      case View.EVIDENCES:
        return <Evidences />;

      case View.RISKS:
        return <RiskManagement />;

      case View.REPORTS:
        return <Reports />;

      case View.EPI_MANAGEMENT:
        return <EPIManagement />;

      case View.LEGAL_DOCUMENTS:
        return <LegalDocuments />;
      case View.INCIDENT_MANAGEMENT:
        return <IncidentManagement />;
      case View.NOTIFICATIONS:
        return <Notifications />;
      case View.SETTINGS:
        return <Settings />;
      case View.ASO_MANAGEMENT:
        return <ASOManagement />;
      case View.HELP:
        return <Help />;
      default:
        return <Dashboard onChangeView={setCurrentView} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Render Portal Layout for Company Users
  if (userType === 'company' || userType === 'client') {
    return (
      <PortalLayout
        currentView={currentView}
        onChangeView={setCurrentView}
        onLogout={handleLogout}
        companyName={localStorage.getItem('safeguard_user_name') || 'Empresa'}
      >
        {renderContent()}
      </PortalLayout>
    );
  }

  // Render Standard Layout for Technicians
  return (
    <Layout
      currentView={currentView}
      onChangeView={setCurrentView}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;