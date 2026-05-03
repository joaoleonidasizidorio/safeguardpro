import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface LoginProps {
    onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loginType, setLoginType] = useState<'technician' | 'company'>('technician');

    useEffect(() => {
        if (document.documentElement.classList.contains('dark')) {
            setIsDarkMode(true);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isRegistering && password !== confirmPassword) {
            alert("As senhas não coincidem!");
            return;
        }

        setIsLoading(true);

        try {
            // New Unified Login Endpoint
            const baseUrl = API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Falha no login');
            }

            const data = await response.json();

            // Save complete auth data
            localStorage.setItem('safeguard_auth', 'true');
            localStorage.setItem('authToken', data.token); // Save Bearer token
            localStorage.setItem('safeguard_user_type', data.user.role); // 'admin', 'technician', 'client'
            localStorage.setItem('safeguard_user_id', data.user.id);
            if (data.user.avatar_url) {
                console.log('Avatar URL received on login:', data.user.avatar_url);
                localStorage.setItem('safeguard_user_avatar', data.user.avatar_url);
            } else {
                console.log('No Avatar URL received on login');
                localStorage.removeItem('safeguard_user_avatar');
            }

            // Force Sidebar update immediately after setting storage
            window.dispatchEvent(new Event('user-profile-update'));

            onLogin();

        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsRegistering(!isRegistering);
        setEmail('');
        setPassword('');
        setName('');
        setConfirmPassword('');
    };

    return (
        <div className="flex min-h-screen w-full bg-background-light dark:bg-background-dark transition-colors duration-300 font-sans text-text-main dark:text-white overflow-hidden relative">
            {/* Theme Toggle Absolute */}
            <button
                onClick={toggleTheme}
                className="absolute top-6 right-6 z-20 p-2 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
                title="Alternar Tema"
            >
                <span className="material-symbols-outlined icon-filled">
                    {isDarkMode ? 'light_mode' : 'dark_mode'}
                </span>
            </button>

            <div className="flex-1 flex flex-col lg:flex-row h-screen">
                {/* Left Side - Image/Hero */}
                <div className="relative w-full lg:w-5/12 xl:w-1/2 h-64 lg:h-auto bg-surface-dark flex-shrink-0 order-first">
                    <div
                        className="absolute inset-0 w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBgZEbUiUYW1qh_eTkecXiNFigygF6R95_MQruMM-Gk5zZf7DnHZBaS1HEobeSB3AICf9Zj7bMpgOKw47yFJESa7G2tAPrL-9VfSEv4Tyd5wxJpDLMesjB3rTCncqtQO5HNaQk50MuYZjM8Px2rkslZO0FpYB-l2YPyN5991jaQhV6EtHzl3gpFH7YUIwOF16B3JaPFt9dAgK2ahycQHb-g3zyt_S-rpA2soNuXHhe1misWXcHvID9uppGk2VE99iOoPTYt0GQTXyQ')" }}
                    ></div>
                    <div className="absolute inset-0 bg-background-dark/60 lg:bg-background-dark/40 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-background-dark/90"></div>
                    <div className="absolute bottom-0 left-0 p-8 lg:p-12 xl:p-16 text-white max-w-2xl">
                        <div className="mb-6 flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined text-4xl">security</span>
                        </div>
                        <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold leading-tight mb-4 tracking-tight">
                            Segurança não é apenas uma formalidade.
                        </h2>
                        <p className="text-lg text-gray-200 leading-relaxed opacity-90">
                            Acesse o portal profissional seguro para relatórios de inspeção, conformidade e gestão de equipes de SST.
                        </p>
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-24 overflow-y-auto bg-background-light dark:bg-background-dark relative">
                    {/* Mobile Logo */}
                    <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3 text-text-main dark:text-white">
                        <div className="size-8 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl">shield</span>
                        </div>
                        <span className="font-bold text-lg">SafeGuardPro</span>
                    </div>

                    <div className="w-full max-w-[480px]">
                        {/* Desktop Logo */}
                        <div className="hidden lg:flex flex-col mb-8">
                            <div className="flex items-center gap-3 text-text-main dark:text-white mb-6">
                                {localStorage.getItem('safeguard_brand_logo') ? (
                                    <img src={`${API_BASE_URL}${localStorage.getItem('safeguard_brand_logo')}`} alt="Logo" className="h-10 w-auto object-contain" />
                                ) : (
                                    <div className="size-10 text-primary flex items-center justify-center">
                                        <span className="material-symbols-outlined text-4xl">shield</span>
                                    </div>
                                )}
                                <h2 className="text-2xl font-bold tracking-[-0.015em]">{localStorage.getItem('safeguard_brand_name') || 'SafeGuardPro'}</h2>
                            </div>
                        </div>

                        <div className="mb-8 text-center lg:text-left">
                            <h1 className="text-3xl font-black text-text-main dark:text-white leading-tight mb-2">
                                {isRegistering ? 'Crie sua conta' : 'Bem-vindo(a)'}
                            </h1>
                            <p className="text-text-secondary dark:text-gray-400 font-normal">
                                {isRegistering
                                    ? 'Preencha os dados abaixo para começar.'
                                    : 'Insira suas credenciais para acessar o portal de segurança.'}
                            </p>
                        </div>

                        {!isRegistering && (
                            <div className="mb-8">
                                <div className="flex p-1 bg-gray-100 dark:bg-surface-dark rounded-lg">
                                    <button
                                        onClick={() => setLoginType('technician')}
                                        className={`flex-1 py-2 text-sm font-bold rounded shadow-sm transition-all ${loginType === 'technician' ? 'bg-white dark:bg-background-dark text-text-main dark:text-white' : 'text-text-secondary hover:text-text-main dark:text-gray-400 dark:hover:text-white'}`}
                                    >
                                        Técnico
                                    </button>
                                    <button
                                        onClick={() => setLoginType('company')}
                                        className={`flex-1 py-2 text-sm font-medium rounded transition-all ${loginType === 'company' ? 'bg-white dark:bg-background-dark text-text-main dark:text-white shadow-sm font-bold' : 'text-text-secondary hover:text-text-main dark:text-gray-400 dark:hover:text-white'}`}
                                    >
                                        Empresa
                                    </button>
                                </div>
                            </div>
                        )}

                        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                            {isRegistering && (
                                <div className="flex flex-col gap-2 animate-fade-in">
                                    <label className="text-text-main dark:text-gray-200 text-sm font-bold leading-normal">
                                        Nome Completo
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-secondary">
                                            <span className="material-symbols-outlined text-[20px]">badge</span>
                                        </div>
                                        <input
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="flex w-full rounded-lg text-text-main dark:text-white border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-surface-dark h-12 pl-11 pr-4 placeholder:text-text-secondary dark:placeholder:text-gray-500 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors focus:outline-none"
                                            placeholder="Digite seu nome completo"
                                            type="text"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-text-main dark:text-gray-200 text-sm font-bold leading-normal">
                                    E-mail {isRegistering ? '' : 'ou Usuário'}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-secondary">
                                        <span className="material-symbols-outlined text-[20px]">person</span>
                                    </div>
                                    <input
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="flex w-full rounded-lg text-text-main dark:text-white border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-surface-dark h-12 pl-11 pr-4 placeholder:text-text-secondary dark:placeholder:text-gray-500 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors focus:outline-none"
                                        placeholder={isRegistering ? "Digite seu e-mail" : "Digite seu e-mail ou ID"}
                                        type="text"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-text-main dark:text-gray-200 text-sm font-bold leading-normal">
                                        Senha
                                    </label>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-secondary">
                                        <span className="material-symbols-outlined text-[20px]">lock</span>
                                    </div>
                                    <input
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="flex w-full rounded-lg text-text-main dark:text-white border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-surface-dark h-12 pl-11 pr-11 placeholder:text-text-secondary dark:placeholder:text-gray-500 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors focus:outline-none"
                                        placeholder={isRegistering ? "Crie uma senha forte" : "Digite sua senha"}
                                        type={showPassword ? "text" : "password"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-secondary hover:text-text-main dark:hover:text-white transition-colors cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>

                            {isRegistering && (
                                <div className="flex flex-col gap-2 animate-fade-in">
                                    <label className="text-text-main dark:text-gray-200 text-sm font-bold leading-normal">
                                        Confirmar Senha
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-secondary">
                                            <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                                        </div>
                                        <input
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="flex w-full rounded-lg text-text-main dark:text-white border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-surface-dark h-12 pl-11 pr-11 placeholder:text-text-secondary dark:placeholder:text-gray-500 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors focus:outline-none"
                                            placeholder="Repita sua senha"
                                            type={showPassword ? "text" : "password"}
                                        />
                                    </div>
                                </div>
                            )}

                            {!isRegistering && (
                                <div className="flex items-center justify-between mt-1">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input className="peer h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-background-light dark:bg-surface-dark dark:border-gray-600 cursor-pointer" type="checkbox" />
                                        </div>
                                        <span className="text-sm text-text-main dark:text-gray-300 group-hover:text-primary transition-colors">Lembrar-me</span>
                                    </label>
                                    <a className="text-sm font-bold text-text-secondary hover:text-primary dark:text-primary dark:hover:text-green-400 transition-colors" href="#">
                                        Esqueceu a Senha?
                                    </a>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="mt-4 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-primary hover:bg-[#0fd660] text-text-main text-base font-bold leading-normal tracking-[0.015em] transition-colors shadow-sm active:scale-[0.99] disabled:opacity-70"
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-text-main" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        {isRegistering ? 'Criando conta...' : 'Entrando...'}
                                    </span>
                                ) : (
                                    <span className="truncate">{isRegistering ? 'Cadastrar' : 'Entrar'}</span>
                                )}
                            </button>

                            <div className="mt-4 text-center">
                                <p className="text-sm text-text-main dark:text-gray-400">
                                    {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
                                    <button
                                        type="button"
                                        onClick={toggleMode}
                                        className="font-bold text-primary hover:underline ml-1 focus:outline-none"
                                    >
                                        {isRegistering ? 'Faça Login' : 'Cadastre-se'}
                                    </button>
                                </p>
                            </div>
                        </form>

                        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap justify-center gap-6 text-xs text-text-secondary dark:text-gray-500">
                            <a className="hover:text-text-main dark:hover:text-gray-300 transition-colors" href="#">Política de Privacidade</a>
                            <a className="hover:text-text-main dark:hover:text-gray-300 transition-colors" href="#">Termos de Uso</a>
                            <a className="hover:text-text-main dark:hover:text-gray-300 transition-colors" href="#">Suporte</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};