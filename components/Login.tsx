import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { UserRole } from '../types';
import { ShieldCheck, ArrowLeft, Mail, Lock, Loader2, User as UserIcon, Briefcase, RefreshCw, X } from 'lucide-react';
import { LandingPage } from './LandingPage';

interface LoginProps {
    onLoginSuccess: (session: any) => void;
}

type AuthMode = 'login' | 'register' | 'verify';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<string>('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [verifySuccess, setVerifySuccess] = useState(false);

    const [showLanding, setShowLanding] = useState(true);

    // Clear pending email to avoid getting stuck in verification page on reload
    React.useEffect(() => {
        localStorage.removeItem('pending_verification_email');
    }, []);

    const roles = [
        { value: UserRole.TECNICO, label: 'Técnico Eletromidia' },
        { value: UserRole.LIDER, label: 'Líder Regional' },
        { value: UserRole.CHEFE, label: 'Chief of Operations' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const normalizedEmail = email.trim().toLowerCase();
            if (mode === 'login') {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });
                if (authError) throw authError;

                if (data.session && data.user) {
                    localStorage.setItem('active_portal', 'internal');
                    onLoginSuccess(data.session);
                }
            } else if (mode === 'register') {
                if (!role) throw new Error('Selecione sua função');

                // Garante sessão limpa antes de registrar novo usuário
                await supabase.auth.signOut();

                const { data, error: authError } = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password,
                    options: {
                        data: {
                            name,
                            role,
                            company_id: 'internal',
                            company_name: 'Eletromidia Sul',
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                        }
                    }
                });
                if (authError) throw authError;
                if (data.session) {
                    localStorage.setItem('active_portal', 'internal');
                    onLoginSuccess(data.session);
                } else if (data.user) {
                    localStorage.setItem('active_portal', 'internal');
                    setMode('login');
                    setError('Cadastro realizado com sucesso! Faça login com seu e-mail e senha.');
                }
            } else if (mode === 'verify') {
                const { data, error: verifyError } = await supabase.auth.verifyOtp({
                    email: normalizedEmail,
                    token: otp,
                    type: 'signup'
                });
                if (verifyError) throw verifyError;

                if (data.session) {
                    localStorage.setItem('active_portal', 'internal');
                    localStorage.removeItem('pending_verification_email');
                    setVerifySuccess(true);
                    onLoginSuccess(data.session);
                } else if (data.user) {
                    localStorage.removeItem('pending_verification_email');
                    setVerifySuccess(true);
                    setMode('login');
                    setError('Conta verificada com sucesso! Por favor, faça o login.');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao processar solicitação');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setResending(true);
        setError(null);
        setResendSuccess(false);

        const normalizedEmail = email.trim().toLowerCase();

        try {
            const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: normalizedEmail,
            });

            if (resendError) throw resendError;
            setResendSuccess(true);
            setOtp('');
            setTimeout(() => setResendSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message || 'Erro ao reenviar código');
        } finally {
            setResending(false);
        }
    };

    // Landing page - Filial Sul (sem portal de parceiros)
    if (showLanding && mode === 'login') {
        return <LandingPage onOpenLogin={() => setShowLanding(false)} />;
    }

    return (
        <div className="min-h-screen relative flex items-center justify-center p-6 font-sans transition-all duration-700 overflow-hidden bg-primary-50/30">

            {/* Dynamic Form Background */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse bg-primary-200/40"></div>
                <div className="absolute -bottom-[20%] right-[10%] w-[50%] h-[50%] rounded-full blur-[150px] bg-primary-100/30"></div>
            </div>

            <div className="relative z-10 max-w-md w-full rounded-[48px] shadow-2xl p-12 space-y-10 border transition-all duration-500 bg-white/90 backdrop-blur-2xl border-white shadow-primary-200/50">
                {/* Botão de fechar modal (voltar para landing page) */}
                <button 
                    onClick={() => {
                        setShowLanding(true);
                        setEmail('');
                        setPassword('');
                        setError(null);
                    }} 
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 rounded-full"
                >
                    <X size={20} />
                </button>

                {mode !== 'login' && (
                    <button
                        onClick={() => {
                            if (mode === 'verify') setMode('register');
                            else if (mode === 'register') setMode('login');
                        }}
                        className="group flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all text-slate-400 hover:text-primary"
                    >
                        <div className="p-2.5 rounded-xl transition-colors bg-slate-100 group-hover:bg-primary-100">
                            <ArrowLeft size={16} />
                        </div>
                        {mode === 'verify' ? 'Voltar para Cadastro' : 'Voltar para Login'}
                    </button>
                )}

                <div className="text-center space-y-4">
                    <div className="inline-flex p-6 rounded-[32px] shadow-2xl mb-2 transition-all hover:scale-110 hover:rotate-3 bg-primary text-white shadow-primary/30">
                        {mode === 'verify' ? <ShieldCheck size={40} className="animate-bounce" /> : <ShieldCheck size={40} />}
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter uppercase text-secondary">
                        {mode === 'login' ? 'Login' : (mode === 'register' ? 'Cadastro' : 'Verificar')}
                    </h1>
                    <p className="font-black uppercase text-[11px] tracking-[0.3em] text-primary">
                        {mode === 'verify' ? 'Insira o código enviado' : 'Eletromidia Filial Sul'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {mode === 'verify' ? (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-[0.3em] ml-2 text-slate-400">Código de 8 dígitos</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        required
                                        maxLength={8}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        className="w-full px-4 py-8 rounded-[24px] border border-dashed outline-none transition-all font-black text-2xl md:text-4xl text-center tracking-[0.1em] md:tracking-[0.2em] bg-primary-50 border-primary-200 text-primary focus:bg-white focus:border-primary ring-8 ring-transparent focus:ring-primary-50"
                                        placeholder="00000000"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest leading-relaxed">
                                Enviamos um código para<br /><span className="text-primary font-black">{email}</span>
                            </p>

                            {resendSuccess && (
                                <div className="p-4 rounded-[16px] bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em] text-center">
                                    ✓ Novo código enviado com sucesso!
                                </div>
                            )}

                            {verifySuccess && (
                                <div className="p-4 rounded-[16px] bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em] text-center animate-bounce">
                                    ✓ Verificado! Entrando...
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={resending}
                                className="w-full py-4 rounded-[16px] border border-dashed font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 border-slate-200 text-slate-400 hover:border-primary hover:text-primary hover:bg-primary-50 disabled:opacity-50"
                            >
                                {resending ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <RefreshCw size={16} />
                                )}
                                {resending ? 'Reenviando...' : 'Reenviar código'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {mode === 'register' && (
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] ml-2 text-slate-400">Nome Completo</label>
                                    <div className="relative group">
                                        <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full pl-14 pr-6 py-5 rounded-[24px] border outline-none transition-all font-bold bg-slate-100/50 border-transparent focus:bg-white focus:border-primary text-secondary ring-8 ring-transparent focus:ring-primary-50"
                                            placeholder="Nome do colaborador"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-[0.3em] ml-2 text-slate-400">E-mail corporativo</label>
                                <div className="relative group">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-14 pr-6 py-5 rounded-[24px] border outline-none transition-all font-bold bg-slate-100/50 border-transparent focus:bg-white focus:border-primary text-secondary ring-8 ring-transparent focus:ring-primary-50"
                                        placeholder="usuario@eletromidia.com.br"
                                    />
                                </div>
                            </div>

                            {mode === 'register' && (
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] ml-2 text-slate-400">Sua Função</label>
                                    <div className="relative group">
                                        <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                        <select
                                            required
                                            value={role}
                                            onChange={(e) => setRole(e.target.value)}
                                            className="w-full pl-14 pr-12 py-5 rounded-[24px] border outline-none transition-all font-bold appearance-none cursor-pointer bg-slate-100/50 border-transparent focus:bg-white focus:border-primary text-secondary ring-8 ring-transparent focus:ring-primary-50"
                                        >
                                            <option value="" disabled>Selecione um perfil</option>
                                            {roles.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-[0.3em] ml-2 text-slate-400">Senha de acesso</label>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-14 pr-6 py-5 rounded-[24px] border outline-none transition-all font-bold bg-slate-100/50 border-transparent focus:bg-white focus:border-primary text-secondary ring-8 ring-transparent focus:ring-primary-50"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {error && (
                        <div className={`p-5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] border flex items-center gap-4 animate-headShake ${error.includes('enviado')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${error.includes('enviado') ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-6 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 bg-primary text-white shadow-primary/25"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            mode === 'login' ? 'Entrar no Sistema' : (mode === 'register' ? 'Concluir Cadastro' : 'Confirmar Código')
                        )}
                    </button>
                </form>

                {mode !== 'verify' && (
                    <div className="text-center">
                        <button
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login');
                                setError(null);
                            }}
                            className="text-[10px] font-black uppercase tracking-[0.4em] transition-colors text-slate-400 hover:text-primary"
                        >
                            {mode === 'login' ? 'Novo por aqui? Solicite acesso' : 'Já possui conta? Faça o login'}
                        </button>
                    </div>
                )}
            </div>

            {/* Background Shape */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] -z-10 pointer-events-none opacity-20 bg-primary-200"></div>
        </div>
    );
};

export default Login;
