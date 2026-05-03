import React, { useState, useEffect } from 'react';
import { CreditCard, Package, CheckCircle, AlertTriangle, ArrowUpCircle, Users, Building, Calendar } from 'lucide-react';
import { authFetchJson } from '../utils/api';
import { API_BASE_URL } from '../config';

interface PlanLimits {
    companies: number;
    users: number;
    visits: number;
}

interface SubscriptionInfo {
    hasSubscription: boolean;
    plan?: {
        name: string;
        price: number;
        limits: PlanLimits;
    };
    usage?: PlanLimits;
    expires_at?: string;
}

export const Subscription: React.FC = () => {
    const [sub, setSub] = useState<SubscriptionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const fetchSubscription = async () => {
        try {
            const data = await authFetchJson<SubscriptionInfo>(`${API_BASE_URL}/api/subscription`);
            setSub(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscription();
    }, []);

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<{ id: number, name: string, price: number } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>('credit_card');
    const [paymentStep, setPaymentStep] = useState<'method' | 'processing' | 'pix_code' | 'success'>('method');
    const [pixCode, setPixCode] = useState<string>('');

    // Invoice History State
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    const fetchInvoices = async () => {
        setLoadingInvoices(true);
        try {
            const data = await authFetchJson<any[]>(`${API_BASE_URL}/api/invoices`);
            setInvoices(data);
        } catch (err: any) {
            console.error('Error fetching invoices:', err);
            setError('Erro ao carregar faturas');
        } finally {
            setLoadingInvoices(false);
        }
    };

    const openInvoiceModal = () => {
        setShowInvoiceModal(true);
        fetchInvoices();
    };

    const downloadInvoicePdf = (invoiceId: number) => {
        const token = localStorage.getItem('authToken');
        window.open(`${API_BASE_URL}/api/invoices/${invoiceId}/pdf?token=${token}`, '_blank');
    };

    const openPaymentModal = (planName: string, price: number) => {
        const planId = planName === 'Pro' ? 2 : planName === 'Enterprise' ? 3 : 1;
        setSelectedPlan({ id: planId, name: planName, price });
        setPaymentStep('method');
        setShowPaymentModal(true);
    };

    const handleCheckout = async () => {
        if (!selectedPlan) return;
        setPaymentStep('processing');
        setError(null);

        try {
            const res = await authFetchJson<any>(`${API_BASE_URL}/api/financial/checkout`, {
                method: 'POST',
                body: JSON.stringify({
                    plan_id: selectedPlan.id,
                    method: paymentMethod
                })
            });

            if (res.success) {
                if (paymentMethod === 'pix') {
                    setPixCode(res.qrCode);
                    setPaymentStep('pix_code');
                } else {
                    setPaymentStep('success');
                    setTimeout(() => {
                        setShowPaymentModal(false);
                        setMessage(`Assinatura ${selectedPlan.name} ativada com sucesso!`);
                        fetchSubscription();
                    }, 2000);
                }
            } else {
                setError('Falha no pagamento');
                setPaymentStep('method');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao processar pagamento');
            setPaymentStep('method');
        }
    };

    const copyPixCode = () => {
        navigator.clipboard.writeText(pixCode);
        alert('Código Pix copiado!');
    };

    const simulatePixPayment = async () => {
        setPaymentStep('success');
        setTimeout(() => {
            setShowPaymentModal(false);
            setMessage(`Pagamento Pix confirmado! Plano ${selectedPlan?.name} ativo.`);
            fetchSubscription();
        }, 2000);
    };

    if (loading && !sub) return <div className="p-8 text-center text-gray-500">Carregando plano e uso...</div>;

    const renderUsageBar = (label: string, used: number, limit: number, icon: React.ReactNode) => {
        const percentage = limit === -1 ? 0 : Math.min((used / limit) * 100, 100);
        const limitLabel = limit === -1 ? 'Ilimitado' : limit;
        const colorClass = percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500';

        return (
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 text-gray-700 font-medium">
                        {icon}
                        <span>{label}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                        {used} / {limitLabel}
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${colorClass}`}
                        style={{ width: `${limit === -1 ? 0 : percentage}%` }}
                    ></div>
                </div>
                {limit !== -1 && percentage > 90 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> Limite quase atingido. Considere um upgrade.
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <CreditCard className="text-blue-600" />
                    Plano e Assinatura
                </h1>
                <p className="text-gray-500">Gerencie seu plano e acompanhe o uso dos recursos do sistema.</p>
            </header>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3">
                    <AlertTriangle />
                    {error}
                </div>
            )}

            {message && (
                <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center gap-3">
                    <CheckCircle />
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Current Status Card */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white text-center">
                            <p className="text-blue-100 text-sm uppercase font-semibold tracking-wider mb-1">Seu Plano Atual</p>
                            <h2 className="text-3xl font-bold">{sub?.plan?.name || 'Carregando...'}</h2>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Status</span>
                                    <span className="font-semibold text-green-600 flex items-center gap-1">
                                        <CheckCircle size={16} /> Ativo
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Preço Mensal</span>
                                    <span className="font-semibold text-gray-800">
                                        R$ {sub?.plan?.price.toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Próximo Vencimento</span>
                                    <span className="font-semibold text-gray-800">
                                        {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '30/01/2026'}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={openInvoiceModal}
                                className="w-full mt-6 py-2 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Ver Histórico de Faturas
                            </button>
                        </div>
                    </div>
                </div>

                {/* Usage Card */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Package className="text-blue-500" />
                            Uso de Recursos
                        </h3>

                        {sub?.usage && sub.plan && (
                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                {renderUsageBar('Empresas Ativas', sub.usage.companies, sub.plan.limits.companies, <Building size={18} className="text-blue-500" />)}
                                {renderUsageBar('Usuários do Sistema', sub.usage.users, sub.plan.limits.users, <Users size={18} className="text-purple-500" />)}
                                {renderUsageBar('Visitas Técnicas (Mês)', sub.usage.visits, sub.plan.limits.visits, <Calendar size={18} className="text-orange-500" />)}
                            </div>
                        )}

                        <div className="mt-8 p-4 bg-blue-50 rounded-xl flex items-start gap-4">
                            <ArrowUpCircle className="text-blue-600 shrink-0" />
                            <div>
                                <h4 className="text-sm font-bold text-blue-900">Precisa de mais?</h4>
                                <p className="text-xs text-blue-700 mt-1">
                                    Aumente seus limites instantaneamente fazendo o upgrade do seu plano abaixo.
                                    Sem suspensão de serviço, ativação imediata.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upgrade Options */}
            <h3 className="text-xl font-bold text-gray-800 mt-12 mb-6">Planos Disponíveis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {/* Free Plan */}
                <div className={`rounded-2xl border p-6 flex flex-col ${sub?.plan?.name === 'Free' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                    <h4 className="font-bold text-gray-800 text-lg mb-1">Técnico (Free)</h4>
                    <p className="text-gray-500 text-sm mb-4">Para profissionais iniciantes.</p>
                    <div className="text-3xl font-bold text-gray-900 mb-6">R$ 0<span className="text-sm text-gray-400 font-normal">/mês</span></div>

                    <ul className="space-y-3 mb-8 flex-grow text-sm">
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> 1 Empresa</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> 1 Usuário</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> 5 Visitas p/ mês</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> Relatórios com Assinatura</li>
                    </ul>

                    {sub?.plan?.name === 'Free' ? (
                        <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-bold cursor-not-allowed">Seu Plano Atual</button>
                    ) : (
                        <button onClick={() => openPaymentModal('Free', 0)} className="w-full py-2 border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">Selecionar</button>
                    )}
                </div>

                {/* Pro Plan */}
                <div className={`rounded-2xl border p-6 flex flex-col relative ${sub?.plan?.name === 'Pro' ? 'border-blue-500 bg-blue-50/30 shadow-lg' : 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow'}`}>
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">Popular</div>
                    <h4 className="font-bold text-gray-800 text-lg mb-1">Consultoria (Pro)</h4>
                    <p className="text-gray-500 text-sm mb-4">Escala para pequenas consultorias.</p>
                    <div className="text-3xl font-bold text-gray-900 mb-6">R$ 99,90<span className="text-sm text-gray-400 font-normal">/mês</span></div>

                    <ul className="space-y-3 mb-8 flex-grow text-sm">
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> 10 Empresas</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> 5 Usuários</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> Visitas Ilimitadas</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> Dashboard Geo-localizado</li>
                    </ul>

                    {sub?.plan?.name === 'Pro' ? (
                        <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-bold cursor-not-allowed">Seu Plano Atual</button>
                    ) : (
                        <button onClick={() => openPaymentModal('Pro', 99.90)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">Fazer Upgrade</button>
                    )}
                </div>

                {/* Enterprise Plan */}
                <div className={`rounded-2xl border p-6 flex flex-col ${sub?.plan?.name === 'Enterprise' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow'}`}>
                    <h4 className="font-bold text-gray-800 text-lg mb-1">Enterprise</h4>
                    <p className="text-gray-500 text-sm mb-4">Poder total sem restrições.</p>
                    <div className="text-3xl font-bold text-gray-900 mb-6">R$ 499<span className="text-sm text-gray-400 font-normal">/mês</span></div>

                    <ul className="space-y-3 mb-8 flex-grow text-sm">
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> Empresas Ilimitadas</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> Usuários Ilimitados</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> Visitas Ilimitadas</li>
                        <li className="flex items-center gap-2 text-gray-600"><CheckCircle size={14} className="text-green-500" /> Suporte VIP 24/7</li>
                    </ul>

                    {sub?.plan?.name === 'Enterprise' ? (
                        <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-bold cursor-not-allowed">Seu Plano Atual</button>
                    ) : (
                        <button onClick={() => openPaymentModal('Enterprise', 499)} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-colors">Fazer Upgrade</button>
                    )}
                </div>
            </div>
            {/* Payment Modal */}
            {showPaymentModal && selectedPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-fade-in relative">
                        <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        {paymentStep === 'method' && (
                            <>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Checkout Seguro</h2>
                                <p className="text-gray-500 text-sm mb-6">Você está contratando o plano <strong className="text-gray-900">{selectedPlan.name}</strong> por <strong className="text-gray-900">R$ {selectedPlan.price.toFixed(2)}</strong>/mês.</p>

                                <div className="space-y-3 mb-6">
                                    <button
                                        onClick={() => setPaymentMethod('credit_card')}
                                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${paymentMethod === 'credit_card' ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <span className="material-symbols-outlined text-2xl">credit_card</span>
                                        <div className="text-left">
                                            <p className="font-bold text-sm">Cartão de Crédito</p>
                                            <p className="text-xs opacity-70">Aprovação imediata</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setPaymentMethod('pix')}
                                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${paymentMethod === 'pix' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <span className="material-symbols-outlined text-2xl">qr_code_2</span>
                                        <div className="text-left">
                                            <p className="font-bold text-sm">Pix</p>
                                            <p className="text-xs opacity-70">Liberação rápida</p>
                                        </div>
                                    </button>
                                </div>

                                <button onClick={handleCheckout} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-opacity-90 transition-all flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined">lock</span>
                                    Pagar R$ {selectedPlan.price.toFixed(2)}
                                </button>
                            </>
                        )}

                        {paymentStep === 'processing' && (
                            <div className="text-center py-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                <h3 className="text-lg font-bold text-gray-900">Processando...</h3>
                                <p className="text-gray-500 text-sm">Conectando com gateway de pagamento.</p>
                            </div>
                        )}

                        {paymentStep === 'pix_code' && (
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Escaneie o QR Code</h2>
                                <p className="text-gray-500 text-sm mb-6">Abra o app do seu banco e pague via Pix.</p>

                                <div className="bg-gray-100 p-4 rounded-xl mb-4 inline-block">
                                    {/* Mock QR Code Image or just text */}
                                    <span className="material-symbols-outlined text-[100px] text-gray-800">qr_code_2</span>
                                </div>

                                <div className="mb-6">
                                    <div className="flex gap-2">
                                        <input readOnly value={pixCode} className="w-full text-xs p-2 bg-gray-50 border rounded-lg text-gray-500 font-mono truncate" />
                                        <button onClick={copyPixCode} className="px-3 py-1 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300">
                                            <span className="material-symbols-outlined text-sm">content_copy</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">Copie e cole se preferir.</p>
                                </div>

                                <button onClick={simulatePixPayment} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all">
                                    Simular Pagamento Realizado
                                </button>
                            </div>
                        )}

                        {paymentStep === 'success' && (
                            <div className="text-center py-8">
                                <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl">check</span>
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Pagamento Confirmado!</h2>
                                <p className="text-gray-500 text-sm">Sua assinatura foi atualizada com sucesso.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Invoice History Modal */}
            {showInvoiceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 animate-fade-in relative max-h-[80vh] overflow-hidden flex flex-col">
                        <button onClick={() => setShowInvoiceModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-600">receipt_long</span>
                            Histórico de Faturas
                        </h2>

                        {loadingInvoices ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <span className="material-symbols-outlined text-4xl mb-2">receipt</span>
                                <p>Nenhuma fatura encontrada.</p>
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-1">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">Data</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">Plano</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">Valor</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                                            <th className="text-center py-3 px-4 font-semibold text-gray-600">PDF</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {invoices.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-gray-50">
                                                <td className="py-3 px-4 text-gray-700">
                                                    {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="py-3 px-4 text-gray-900 font-medium">{inv.plan_name}</td>
                                                <td className="py-3 px-4 text-gray-700">
                                                    R$ {parseFloat(inv.amount).toFixed(2).replace('.', ',')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                        {inv.status === 'paid' ? 'Pago' : inv.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={() => downloadInvoicePdf(inv.id)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Baixar PDF"
                                                    >
                                                        <span className="material-symbols-outlined">download</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
