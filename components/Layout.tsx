import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { View } from '../types';

interface LayoutProps {
  children: ReactNode;
  currentView: View;
  onChangeView: (view: View) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Initialize Theme
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDarkMode(true);
    }
  };

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = [
    { id: 1, text: 'Treinamento de NR-35 vencendo em breve', time: '10 min', type: 'warning' },
    { id: 2, text: 'Novo relatório mensal disponível', time: '1 hora', type: 'info' },
    { id: 3, text: 'Vistoria na Soluções Construção concluída', time: '2 horas', type: 'success' },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <Sidebar
        currentView={currentView}
        onChangeView={(view) => {
          onChangeView(view);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onLogout={onLogout}
      />

      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        {/* Mobile Header Trigger */}
        <div className="md:hidden flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 z-30">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-700 dark:text-white">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="font-bold text-gray-900 dark:text-white">SafeGuardPro</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined icon-filled">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-700 dark:text-white relative"
              >
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-background-dark"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Top Header (Desktop) */}
        <header className="hidden md:flex w-full px-8 pt-8 pb-4 justify-between items-end flex-wrap gap-4 z-10">
          <div className="flex flex-col gap-1">
            {/* Dynamic Header content could go here */}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
              title={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
              <span className="material-symbols-outlined icon-filled">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white transition-colors ${showNotifications ? 'bg-gray-100 dark:bg-white/10' : ''}`}
              >
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-background-dark"></span>
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-fade-in z-50">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 dark:text-white">Notificações</h3>
                    <span className="text-xs text-primary font-bold cursor-pointer hover:underline">Marcar lidas</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map(notif => (
                      <div key={notif.id} className="p-4 border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors flex gap-3">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${notif.type === 'warning' ? 'bg-orange-500' : notif.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                        <div>
                          <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{notif.text}</p>
                          <p className="text-xs text-gray-400 mt-1">{notif.time} atrás</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 text-center bg-gray-50 dark:bg-gray-800/30">
                    <button onClick={() => onChangeView(View.ALERTS)} className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Ver todas</button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-10 w-[1px] bg-gray-200 dark:bg-white/10"></div>
            <div className="text-right hidden sm:block">
              {/* Dynamic Location Display */}
              <LocationDisplay />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-12 pt-4 md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
};

// Sub-component to handle async location fetching locally
const LocationDisplay = () => {
  const [location, setLocation] = useState('Localizando...');
  const [weather, setWeather] = useState('...');

  // Helper to map WMO codes to text
  const getWeatherDescription = (code: number) => {
    if (code === 0) return 'Céu Limpo ☀️';
    if (code >= 1 && code <= 3) return 'Parcialmente Nublado ⛅';
    if (code >= 45 && code <= 48) return 'Neblina 🌫️';
    if (code >= 51 && code <= 55) return 'Chuvisco 🌧️';
    if (code >= 61 && code <= 65) return 'Chuva 🌧️';
    if (code >= 71 && code <= 77) return 'Neve ❄️';
    if (code >= 80 && code <= 82) return 'Pancadas de Chuva 🌦️';
    if (code >= 95) return 'Tempestade ⛈️';
    return 'Nublado ☁️';
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation('Localização não permitida');
      setWeather('--');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // 1. Get Precise Address (Nominatim - OpenStreetMap)
          // Requires identifying User-Agent to avoid blocking
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
          const geoData = await geoRes.json();

          const addr = geoData.address || {};
          // Hierarchy of precision: City -> Town -> Village -> Municipality -> Suburb
          const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || 'Local Desconhecido';
          // State usually in 'state' or 'region'
          const stateCode = addr.state_code || (addr.state ? addr.state.substring(0, 2).toUpperCase() : '');

          setLocation(`${city}${stateCode ? `, ${stateCode}` : ''}`);

          // 2. Get Real Weather + Apparent Temp (Open-Meteo)
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=apparent_temperature&timezone=auto`);
          const weatherData = await weatherRes.json();

          if (weatherData.current_weather) {
            const { temperature, weathercode, time } = weatherData.current_weather;
            const desc = getWeatherDescription(weathercode);

            // Find apparent temperature for current hour
            let displayTemp = temperature;
            if (weatherData.hourly && weatherData.hourly.time && weatherData.hourly.apparent_temperature) {
              // Open-Meteo returns ISO times e.g. "2023-10-10T14:00"
              // Find index of current hour
              const currentHourISO = time.substring(0, 13); // "YYYY-MM-DDTHH"
              const index = weatherData.hourly.time.findIndex((t: string) => t.startsWith(currentHourISO));
              if (index !== -1) {
                displayTemp = weatherData.hourly.apparent_temperature[index];
              }
            }

            // Display: "Parcialmente Nublado ⛅, 29°C"
            setWeather(`${desc}, ${Math.round(displayTemp)}°C`);
          }

        } catch (error) {
          console.error("Geo/Weather fetch failed", error);
          // Silent fail or keep loading state
          setLocation('Fortaleza, CE');
          setWeather('Ensolarado, 30°C');
        }
      },
      (error) => {
        console.warn("Geolocation access denied or failed", error);
        setLocation('Acesso à localização negado');
        setWeather('Verifique permissões');
      }
    );
  }, []);

  return (
    <>
      <p className="text-sm font-bold text-gray-900 dark:text-white">{location}</p>
      <p className="text-xs text-text-secondary">{weather}</p>
    </>
  );
};