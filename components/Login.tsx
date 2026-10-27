import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import { UserRole } from '../types';
import { ArrowLeft, Mail, Lock, Loader2, User as UserIcon, Briefcase, RefreshCw, KeyRound } from 'lucide-react';

export type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

interface LoginProps {
    onLoginSuccess: (session: any) => void;
    initialMode?: AuthMode;
    onResetComplete?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, initialMode = 'login', onResetComplete }) => {
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<string>('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [verifySuccess, setVerifySuccess] = useState(false);
    const [isRecoverySession, setIsRecoverySession] = useState(false);

    useEffect(() => {
        if (initialMode) {
            setMode(initialMode);
        }
    }, [initialMode]);

    useEffect(() => {
        const savedEmail = localStorage.getItem('pending_verification_email');
        if (savedEmail && mode === 'verify') {
            setEmail(savedEmail);
            localStorage.setItem('active_portal', 'internal');
        }
        const savedRecoveryEmail = localStorage.getItem('pending_recovery_email');
        if (savedRecoveryEmail && (mode === 'forgot' || mode === 'reset')) {
            setEmail(savedRecoveryEmail);
        }
    }, [mode]);

    useEffect(() => {
        const checkRecoveryToken = async () => {
            const hash = window.location.hash;

            if (hash && hash.includes('error=')) {
                const params = new URLSearchParams(hash.replace(/^#/, ''));
                const errorCode = params.get('error_code');
                const errorDescription = params.get('error_description');
                if (errorCode === 'otp_expired') {
                    setError('O link de recuperaÃ§Ã£o expirou ou jÃ¡ foi utilizado. Solicite um novo e-mail abaixo.');
                } else if (errorDescription) {
                    setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
                }
                window.history.replaceState(null, '', window.location.pathname);
                return;
            }

            if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
                const params = new URLSearchParams(hash.replace(/^#/, ''));
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                const type = params.get('type');
                if (type === 'recovery' || accessToken) {
                    if (accessToken && refreshToken) {
                        try {
                            await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            });
                        } catch (err) {
                            console.error('Error setting recovery session:', err);
                        }
                    }
                    setIsRecoverySession(true);
                    setMode('reset');
                    setError(null);
                    setSuccessMessage('SessÃ£o de recuperaÃ§Ã£o validada. Defina sua nova senha abaixo.');
                }
            }
        };
        checkRecoveryToken();
    }, []);

    const roles = [
        { value: UserRole.TECNICO, label: 'TÃ©cnico Eletromidia' },
        { value: UserRole.LIDER, label: 'LÃ­der Regional (Requer Convite)' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const normalizedEmail = email.trim().toLowerCase();

            if (mode === 'login') {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });
                if (authError) throw authError;

                if (data.session && data.user) {
                    const userMeta = data.user.user_metadata || {};
                    const userCompanyId = userMeta.company_id || 'internal';
                    const isUserInternal = userCompanyId === 'internal';

                    if (!isUserInternal) {
                        await supabase.auth.signOut();
                        localStorage.removeItem('active_portal');
                        setLoading(false);
                        setError('Acesso negado. Apenas usuÃ¡rios internos podem acessar.');
                        return;
                    }

                    localStorage.setItem('active_portal', 'internal');
                    onLoginSuccess(data.session);
                }
            } else if (mode === 'register') {
                if (!role) throw new Error('Selecione sua funÃ§Ã£o');
                if (password.length < 8) {
                    throw new Error('A senha deve ter pelo menos 8 caracteres para sua seguranÃ§a.');
                }

                const sanitizedName = name.trim().replace(/[<>]/g, '');
                if (sanitizedName.length < 3) {
                    throw new Error('Informe seu nome completo vÃ¡lido.');
                }

                // Verifica convite prÃ©vio na tabela employee_invites ou domÃ­nio corporativo
                const { data: inviteData } = await supabase
                    .from('employee_invites')
                    .select('role, company_id')
                    .eq('email', normalizedEmail)
                    .maybeSingle();

                const isCorporateDomain = normalizedEmail.endsWith('@eletromidia.com.br');
                if (!isCorporateDomain && !inviteData) {
                    throw new Error('Cadastro restrito a e-mails corporativos (@eletromidia.com.br) ou colaboradores previamente convidados.');
                }

                // Impede auto-atribuiÃ§Ã£o de perfil elevado (CHEFE/LIDER) sem convite autorizado
                const approvedRole = inviteData?.role || UserRole.TECNICO;
                if (role !== UserRole.TECNICO && approvedRole !== role) {
                    throw new Error('Perfis de LideranÃ§a ou Chefia exigem autorizaÃ§Ã£o prÃ©via da administraÃ§Ã£o.');
                }

                await supabase.auth.signOut();

                const { data, error: authError } = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password,
                    options: {
                        data: {
                            name: sanitizedName,
                            role: approvedRole,
                            company_id: inviteData?.company_id || 'internal',
                            company_name: 'Eletromidia Sul',
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(sanitizedName)}&background=random`,
                        }
                    }
                });
                if (authError) throw authError;

                if (data.user || data.session) {
                    localStorage.setItem('pending_verification_email', normalizedEmail);
                    localStorage.setItem('active_portal', 'internal');
                    setMode('verify');
                    setError(null);
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
                    setSuccessMessage('Conta verificada com sucesso! FaÃ§a o login.');
                }
            } else if (mode === 'forgot') {
                if (!normalizedEmail) {
                    throw new Error('Informe seu e-mail corporativo.');
                }

                const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                    redirectTo: window.location.origin,
                });

                if (resetError) throw resetError;

                localStorage.setItem('pending_recovery_email', normalizedEmail);
                setMode('reset');
                setError(null);
                setSuccessMessage(`Enviamos as instruÃ§Ãµes para ${normalizedEmail}. Verifique sua caixa de entrada.`);
            } else if (mode === 'reset') {
                if (!password) {
                    throw new Error('Informe a nova senha.');
                }
                if (password.length < 6) {
                    throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
                }
                if (password !== confirmPassword) {
                    throw new Error('As senhas digitadas nÃ£o coincidem.');
                }

                if (otp.trim()) {
                    const { error: otpError } = await supabase.auth.verifyOtp({
                        email: normalizedEmail,
                        token: otp.trim(),
                        type: 'recovery'
                    });
                    if (otpError) throw otpError;
                } else if (!isRecoverySession) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                        throw new Error('Insira o cÃ³digo numÃ©rico (OTP) recebido no e-mail ou utilize o link enviado.');
                    }
                }

                const { error: updateError } = await supabase.auth.updateUser({
                    password: password
                });

                if (updateError) throw updateError;

                if (window.location.hash) {
                    window.history.replaceState(null, '', window.location.pathname);
                }
                localStorage.removeItem('pending_recovery_email');

                setPassword('');
                setConfirmPassword('');
                setOtp('');
                setIsRecoverySession(false);
                setSuccessMessage('Senha atualizada com sucesso! Entre com sua nova credencial.');
                setMode('login');

                if (onResetComplete) {
                    onResetComplete();
                }
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao processar solicitaÃ§Ã£o');
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
            setError(err.message || 'Erro ao reenviar cÃ³digo');
        } finally {
            setResending(false);
        }
    };

    const handleResendRecovery = async () => {
        setResending(true);
        setError(null);
        setResendSuccess(false);

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            setError('Informe seu e-mail corporativo para reenviar.');
            setResending(false);
            return;
        }

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: window.location.origin,
            });
            if (resetError) throw resetError;

            setResendSuccess(true);
            setOtp('');
            setTimeout(() => setResendSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message || 'Erro ao reenviar instruÃ§Ãµes');
        } finally {
            setResending(false);
        }
    };

    const getHeaderInfo = () => {
        switch (mode) {
            case 'login':
                return { title: 'Acesso Operacional', subtitle: 'Entre com suas credenciais corporativas' };
            case 'register':
                return { title: 'Criar Conta', subtitle: 'Cadastre seu perfil na operaÃ§Ã£o' };
            case 'verify':
                return { title: 'VerificaÃ§Ã£o', subtitle: 'Confirme o cÃ³digo enviado para seu e-mail' };
            case 'forgot':
                return { title: 'Recuperar Senha', subtitle: 'Informe seu e-mail corporativo' };
            case 'reset':
                return { title: 'Nova Senha', subtitle: 'Defina sua nova credencial de acesso' };
        }
    };

    const header = getHeaderInfo();

    return (
        <div className="min-h-screen bg-[#F4F5F7] flex flex-col lg:flex-row font-sans">
            {/* Left Architectural Branding Column */}
            <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 lg:p-20 bg-white border-b lg:border-b-0 lg:border-r border-[#E6E8EC]">
                <div>
                    <img
                        src="/eletromidia/Eletromidia%20Horizontal%20(3).png"
                        alt="Eletromidia"
                        className="h-7 w-auto object-contain"
                    />
                </div>

                <div className="my-12 lg:my-0 max-w-lg space-y-5">
                    <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-[#141518] tracking-tight leading-[1.02]">
                        OperaÃ§Ã£o ConcessÃ£o SÃ£o Paulo
                    </h1>
                    <p className="text-base text-[#525866] leading-relaxed">
                        Plataforma integrada para gestÃ£o de equipes em campo, controle de frequÃªncia diÃ¡ria,
                        alocaÃ§Ã£o de veÃ­culos e dispositivos OPEC.
                    </p>
                </div>

                <div className="flex items-center justify-between text-xs text-[#868C98] pt-6 border-t border-[#E6E8EC]">
                    <span>Eletromidia S.A. â€¢ OperaÃ§Ãµes Urbanas</span>
                    <span className="font-mono-code">SP-SUL</span>
                </div>
            </div>

            {/* Right Authentication Card Column */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-20">
                <div className="w-full max-w-md ooh-card p-8 sm:p-10">
                    {(mode === 'verify' || mode === 'forgot' || mode === 'reset') && (
                        <button
                            type="button"
                            onClick={() => {
                                setMode(mode === 'verify' ? 'register' : 'login');
                                setError(null);
                                setSuccessMessage(null);
                            }}
                            className="group inline-flex items-center gap-2 font-semibold text-xs text-[#525866] hover:text-[#141518] transition-colors mb-6"
                        >
                            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span>{mode === 'verify' ? 'Voltar ao cadastro' : 'Voltar ao login'}</span>
                        </button>
                    )}

                    <div className="mb-8">
                        <h2 className="font-display text-2xl font-bold text-[#141518]">
                            {header.title}
                        </h2>
                        <p className="text-sm text-[#525866] mt-1">
                            {header.subtitle}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'verify' ? (
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-[#525866]">CÃ³digo de VerificaÃ§Ã£o</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={8}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        className="w-full px-4 py-4 bg-[#F4F5F7] rounded-xl border border-[#E6E8EC] focus:border-[#FF4F00] focus:bg-white outline-none font-mono-code font-bold text-2xl text-center tracking-[0.25em] text-[#141518] transition-all"
                                        placeholder="00000000"
                                    />
                                </div>

                                <p className="text-xs text-center text-[#525866]">
                                    Enviado para <strong className="text-[#141518]">{email}</strong>
                                </p>

                                {resendSuccess && (
                                    <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold text-center">
                                        CÃ³digo reenviado com sucesso
                                    </div>
                                )}
                                {verifySuccess && (
                                    <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold text-center">
                                        Acesso liberado
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleResendCode}
                                    disabled={resending}
                                    className="w-full py-2 text-xs font-semibold text-[#525866] hover:text-[#FF4F00] transition-colors flex items-center justify-center gap-2"
                                >
                                    {resending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                                    <span>Reenviar cÃ³digo</span>
                                </button>
                            </div>
                        ) : mode === 'forgot' ? (
                            <div className="space-y-4">
                                <p className="text-xs text-[#525866] leading-relaxed">
                                    Informe o e-mail corporativo associado Ã  sua conta para receber o link e o cÃ³digo de redefiniÃ§Ã£o.
                                </p>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-[#525866]">E-mail Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="ooh-input w-full pl-10 pr-4"
                                            placeholder="usuario@eletromidia.com.br"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : mode === 'reset' ? (
                            <div className="space-y-4">
                                <p className="text-xs text-[#525866] leading-relaxed">
                                    {isRecoverySession
                                        ? 'SessÃ£o de recuperaÃ§Ã£o autorizada. Crie uma nova senha para sua conta.'
                                        : 'Insira o cÃ³digo numÃ©rico recebido por e-mail ou defina diretamente sua nova senha caso tenha acessado pelo link.'}
                                </p>

                                {!isRecoverySession && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-[#525866]">E-mail Corporativo</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="ooh-input w-full pl-10 pr-4"
                                                    placeholder="usuario@eletromidia.com.br"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-semibold text-[#525866]">CÃ³digo OTP</label>
                                                <span className="text-[11px] text-[#868C98]">Opcional se usou link</span>
                                            </div>
                                            <div className="relative">
                                                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                                <input
                                                    type="text"
                                                    maxLength={8}
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                                    className="ooh-input w-full pl-10 pr-4 font-mono-code"
                                                    placeholder="CÃ³digo numÃ©rico"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-[#525866]">Nova Senha</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="ooh-input w-full pl-10 pr-4"
                                            placeholder="MÃ­nimo 6 caracteres"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-[#525866]">Confirmar Nova Senha</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="ooh-input w-full pl-10 pr-4"
                                            placeholder="Repita a nova senha"
                                        />
                                    </div>
                                </div>

                                {!isRecoverySession && (
                                    <div className="pt-1">
                                        {resendSuccess && (
                                            <div className="p-3 mb-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold text-center">
                                                Novas instruÃ§Ãµes reenviadas
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleResendRecovery}
                                            disabled={resending}
                                            className="w-full py-2 text-xs font-semibold text-[#525866] hover:text-[#FF4F00] transition-colors flex items-center justify-center gap-2"
                                        >
                                            {resending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                                            <span>Reenviar e-mail de recuperaÃ§Ã£o</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {mode === 'register' && (
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-[#525866]">Nome Completo</label>
                                        <div className="relative">
                                            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="ooh-input w-full pl-10 pr-4"
                                                placeholder="Nome do colaborador"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-[#525866]">E-mail Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="ooh-input w-full pl-10 pr-4"
                                            placeholder="usuario@eletromidia.com.br"
                                        />
                                    </div>
                                </div>

                                {mode === 'register' && (
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-[#525866]">FunÃ§Ã£o Operacional</label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                            <select
                                                required
                                                value={role}
                                                onChange={(e) => setRole(e.target.value)}
                                                className="ooh-input w-full pl-10 pr-8 appearance-none cursor-pointer"
                                            >
                                                <option value="" disabled>Selecione um perfil</option>
                                                {roles.map(r => (
                                                    <option key={r.value} value={r.value}>{r.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-semibold text-[#525866]">Senha</label>
                                        {mode === 'login' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMode('forgot');
                                                    setError(null);
                                                    setSuccessMessage(null);
                                                }}
                                                className="text-xs font-medium text-[#525866] hover:text-[#FF4F00] transition-colors"
                                            >
                                                Esqueceu a senha?
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="ooh-input w-full pl-10 pr-4"
                                            placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                                {error}
                            </div>
                        )}

                        {successMessage && (
                            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-medium">
                                {successMessage}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 mt-2 rounded-xl font-semibold text-sm text-white bg-[#141518] hover:bg-[#FF4F00] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                mode === 'login' ? 'Entrar na Plataforma' :
                                mode === 'register' ? 'Criar Conta' :
                                mode === 'verify' ? 'Confirmar CÃ³digo' :
                                mode === 'forgot' ? 'Enviar InstruÃ§Ãµes' :
                                'Salvar Nova Senha'
                            )}
                        </button>
                    </form>

                    {mode !== 'verify' && mode !== 'forgot' && mode !== 'reset' && (
                        <div className="text-center mt-6 pt-5 border-t border-[#E6E8EC]">
                            <button
                                type="button"
                                onClick={() => {
                                    setMode(mode === 'login' ? 'register' : 'login');
                                    setError(null);
                                    setSuccessMessage(null);
                                }}
                                className="text-xs font-semibold text-[#525866] hover:text-[#141518] transition-colors"
                            >
                                {mode === 'login' ? 'Novo colaborador? Solicitar acesso' : 'JÃ¡ possui credencial? Fazer login'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;

