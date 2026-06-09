import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, PlayCircle, Plus, FileSpreadsheet, Download, Smartphone, Star, CalendarDays, ArrowLeft, Loader2, RefreshCw, Mail, Lock, User as UserIcon, Briefcase, Play } from 'lucide-react';
// Assuming canvas-confetti is globally available from CDN
declare const confetti: any;

interface LandingPageProps {
    onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin }) => {
    const [activeSimScreen, setActiveSimScreen] = useState<'registro' | 'presenca' | 'feed' | 'excel'>('registro');
    const [toasts, setToasts] = useState<{ id: number, message: string }[]>([]);

    const addToast = (message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const handleSalvarSimulado = () => {
        addToast("Relatório diário salvo e sincronizado com sucesso! 🎉");
    };

    const handleDispararDopaminaConfetti = () => {
        try {
            if (typeof confetti === 'function') {
                const count = 200;
                const defaults = { origin: { y: 0.7 } };
                
                function fire(particleRatio: number, opts: any) {
                    confetti({
                        ...defaults,
                        ...opts,
                        particleCount: Math.floor(count * particleRatio)
                    });
                }
                
                fire(0.25, { spread: 26, startVelocity: 55 });
                fire(0.2, { spread: 60 });
                fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
                fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
                fire(0.1, { spread: 120, startVelocity: 45 });
            }
        } catch (e) {
            console.error("Confetti failed", e);
        }
        addToast("Planilha profissional Excel baixada no dispositivo!");
    };

    const handleSimularInstalacaoApp = () => {
        addToast("Atalho do app Eletromidia SUL adicionado à tela inicial! 📱");
    };

    return (
        <div className="landing-page-root relative min-h-screen selection:bg-primary selection:text-white bg-slate-50 text-secondary overflow-x-hidden">
            {/* Background Glow Effects */}
            <div className="landing-glow-bg top-[-10%] left-[-10%]"></div>
            <div className="landing-glow-bg top-[40%] right-[-10%]"></div>
            <div className="landing-glow-bg bottom-[-10%] left-[20%]"></div>

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-gray-100/80 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-extrabold tracking-tight flex items-center">
                            <span className="text-primary">Eletro</span><span className="text-secondary">midia</span>
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-primary-50 text-primary rounded-full tracking-wider uppercase">Filial Sul</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
                        <a href="#recursos" className="hover:text-primary transition-colors">Recursos</a>
                        <a href="#simulador" className="hover:text-primary transition-colors">Como funciona</a>
                        <a href="#aplicativo" className="hover:text-primary transition-colors">Modo App</a>
                        <a href="#sobre" className="hover:text-primary transition-colors">Diferenciais</a>
                    </nav>

                    <div className="flex items-center gap-4">
                        <button onClick={onOpenLogin} className="group relative px-6 py-2.5 text-sm font-bold text-white bg-secondary rounded-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-secondary/10 active:scale-95">
                            <span className="relative z-10">Acessar Sistema</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-primary to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </button>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32 flex flex-col items-center text-center z-10 landing-fade-in-up">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200/80 shadow-sm text-xs font-semibold text-slate-500 mb-8 animate-bounce">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        Operação Concessão SP • Sul
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-secondary max-w-4xl leading-[1.1] mb-6">
                        A gestão de campo mais <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">fluida e prazerosa</span> que você já viu.
                    </h1>

                    <p className="text-lg md:text-xl text-slate-500 max-w-2xl font-normal leading-relaxed mb-10">
                        Substitua de vez as velhas pranchetas de papel por uma plataforma digital de alto desempenho. Registre, monitore e exporte relatórios em tempo real de forma extremamente simples.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
                        <button onClick={onOpenLogin} className="w-full sm:w-auto px-8 py-4 bg-primary text-white text-base font-bold rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary-600 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
                            Iniciar Sessão <ArrowRight size={18} />
                        </button>
                        <a href="#simulador" className="w-full sm:w-auto px-8 py-4 bg-white text-secondary text-base font-bold rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 flex items-center justify-center gap-2">
                            Ver como funciona <PlayCircle size={18} className="text-primary" />
                        </a>
                    </div>

                    <div id="recursos" className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-6xl text-left mt-6">
                        {/* Card 1 */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-primary/30 transition-all duration-300 group hover:shadow-xl hover:shadow-primary/5">
                            <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-file-signature"></i>
                            </div>
                            <h3 className="font-bold text-lg text-secondary mb-2">Registro em 30s</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">Fim de turno rápido. Equipe, veículos, opecs e atividades salvas num piscar de olhos.</p>
                        </div>
                        {/* Card 2 */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-primary/30 transition-all duration-300 group hover:shadow-xl hover:shadow-primary/5">
                            <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-user-check"></i>
                            </div>
                            <h3 className="font-bold text-lg text-secondary mb-2">Controle de Presença</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">Gestão humanizada e direta. Faltas, atestados ou folgas consolidados de forma visual.</p>
                        </div>
                        {/* Card 3 */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-primary/30 transition-all duration-300 group hover:shadow-xl hover:shadow-primary/5">
                            <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-bolt"></i>
                            </div>
                            <h3 className="font-bold text-lg text-secondary mb-2">Live Feed ao Vivo</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">Olhos focados na rua. Gestores visualizam logs de produtividade assim que salvos pelo app.</p>
                        </div>
                        {/* Card 4 */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-primary/30 transition-all duration-300 group hover:shadow-xl hover:shadow-primary/5">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-file-excel"></i>
                            </div>
                            <h3 className="font-bold text-lg text-secondary mb-2">Exportação Inteligente</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">Relatórios diários e consolidados mensais prontos para envio à diretoria com 1 clique.</p>
                        </div>
                    </div>
                </section>

                {/* Simulator Section */}
                <section id="simulador" className="bg-slate-50/50 border-y border-gray-100 py-24 relative overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary-50 px-3 py-1 rounded-full">Explore a ferramenta</span>
                            <h2 className="text-3xl md:text-5xl font-extrabold text-secondary mt-4 mb-4">Sinta a experiência no celular</h2>
                            <p className="text-slate-500">Navegue pelas funções do aplicativo de campo clicando nas guias interativas abaixo.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                            {/* Simulator Tabs */}
                            <div className="lg:col-span-5 flex flex-col gap-4 order-2 lg:order-1">
                                <button onClick={() => setActiveSimScreen('registro')} className={`w-full text-left p-5 rounded-2xl transition-all duration-300 bg-white ${activeSimScreen === 'registro' ? 'border-2 border-primary shadow-md' : 'border border-gray-200 hover:border-gray-300'}`}>
                                    <div className="flex items-center gap-4">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${activeSimScreen === 'registro' ? 'bg-primary text-white' : 'bg-gray-100 text-slate-500'}`}>01</span>
                                        <div>
                                            <h4 className="font-bold text-secondary text-base">Registro Centralizado</h4>
                                            <p className="text-xs text-slate-500 mt-1">Líderes cadastram equipes, veículos, OPEC e atividades em lote rapidamente.</p>
                                        </div>
                                    </div>
                                </button>
                                
                                <button onClick={() => setActiveSimScreen('presenca')} className={`w-full text-left p-5 rounded-2xl transition-all duration-300 bg-white ${activeSimScreen === 'presenca' ? 'border-2 border-primary shadow-md' : 'border border-gray-200 hover:border-gray-300'}`}>
                                    <div className="flex items-center gap-4">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${activeSimScreen === 'presenca' ? 'bg-primary text-white' : 'bg-gray-100 text-slate-500'}`}>02</span>
                                        <div>
                                            <h4 className="font-bold text-secondary text-base">Presença e Ausência</h4>
                                            <p className="text-xs text-slate-500 mt-1">Gestão inteligente e humanizada de faltas, folgas e atestados médicos.</p>
                                        </div>
                                    </div>
                                </button>

                                <button onClick={() => setActiveSimScreen('feed')} className={`w-full text-left p-5 rounded-2xl transition-all duration-300 bg-white ${activeSimScreen === 'feed' ? 'border-2 border-primary shadow-md' : 'border border-gray-200 hover:border-gray-300'}`}>
                                    <div className="flex items-center gap-4">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${activeSimScreen === 'feed' ? 'bg-primary text-white' : 'bg-gray-100 text-slate-500'}`}>03</span>
                                        <div>
                                            <h4 className="font-bold text-secondary text-base">Live Feed do Gestor</h4>
                                            <p className="text-xs text-slate-500 mt-1">Visualização instantânea em tempo real de tudo que acontece no campo.</p>
                                        </div>
                                    </div>
                                </button>

                                <button onClick={() => setActiveSimScreen('excel')} className={`w-full text-left p-5 rounded-2xl transition-all duration-300 bg-white ${activeSimScreen === 'excel' ? 'border-2 border-primary shadow-md' : 'border border-gray-200 hover:border-gray-300'}`}>
                                    <div className="flex items-center gap-4">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${activeSimScreen === 'excel' ? 'bg-primary text-white' : 'bg-gray-100 text-slate-500'}`}>04</span>
                                        <div>
                                            <h4 className="font-bold text-secondary text-base">Relatórios Inteligentes</h4>
                                            <p className="text-xs text-slate-500 mt-1">Gere planilhas perfeitas do dia ou consolidado do mês direto para o Excel.</p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Phone Mockup */}
                            <div className="lg:col-span-7 flex justify-center order-1 lg:order-2">
                                <div className="relative w-[340px] h-[680px] bg-secondary rounded-[50px] p-4 shadow-2xl border-4 border-slate-800 flex flex-col landing-float-animation">
                                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-6 bg-secondary rounded-full z-30 flex items-center justify-center">
                                        <span className="w-2 h-2 bg-slate-800 rounded-full mr-2"></span>
                                        <span className="w-8 h-1 bg-slate-800 rounded-full"></span>
                                    </div>
                                    <div className="absolute -left-1.5 top-28 w-1 h-12 bg-slate-800 rounded-r"></div>
                                    <div className="absolute -left-1.5 top-44 w-1 h-16 bg-slate-800 rounded-r"></div>
                                    <div className="absolute -right-1.5 top-36 w-1 h-20 bg-slate-800 rounded-l"></div>

                                    <div className="w-full h-full bg-[#FAF9F6] rounded-[36px] overflow-hidden relative flex flex-col z-10 border border-slate-700/10">
                                        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-xs font-semibold text-slate-500 z-20">
                                            <span>13:52</span>
                                            <div className="flex items-center gap-1.5">
                                                <i className="fa-solid fa-signal"></i>
                                                <i className="fa-solid fa-wifi"></i>
                                                <i className="fa-solid fa-battery-full text-primary"></i>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col relative">
                                            {/* Screen: Registro */}
                                            <div className={`absolute inset-0 px-4 transition-all duration-300 flex flex-col gap-4 ${activeSimScreen === 'registro' ? 'opacity-100 translate-x-0 z-10 relative' : 'opacity-0 translate-x-10 z-0 hidden'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] uppercase font-bold text-primary tracking-widest">CONCESSÃO SP - SUL</span>
                                                    <span className="text-xs font-bold text-slate-800">Eletromidia</span>
                                                </div>
                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Registro de Expediente</h4>
                                                    <p className="text-[10px] text-slate-500">Selecione os recursos do dia</p>
                                                    
                                                    <label className="block text-[10px] font-bold text-slate-600 mt-3 mb-1">Equipe de Campo</label>
                                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs p-2 text-slate-700 font-medium outline-none">
                                                        <option>Equipe Alpha (4 Técnicos)</option>
                                                        <option>Equipe Beta (3 Técnicos)</option>
                                                    </select>

                                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Veículo</label>
                                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg text-[11px] p-2 text-slate-700 outline-none">
                                                                <option>Fiat Fiorino [ABC-1234]</option>
                                                                <option>Renault Kangoo [XYZ-9876]</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">OPEC Dispositivo</label>
                                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg text-[11px] p-2 text-slate-700 outline-none">
                                                                <option>Tablet Opec-01</option>
                                                                <option>Tablet Opec-02</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex-1">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="font-bold text-slate-800 text-sm">Tarefas do Dia</h4>
                                                        <span className="text-[10px] text-primary font-bold flex items-center gap-1 cursor-pointer hover:underline"><Plus size={10} /> Add</span>
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                                                            <span className="text-slate-700">Limpeza de Painel</span>
                                                            <div className="flex items-center gap-2">
                                                                <button className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded text-center text-xs text-slate-800">-</button>
                                                                <span className="font-bold px-1">12</span>
                                                                <button className="w-5 h-5 bg-primary text-white rounded text-center text-xs">+</button>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                                                            <span className="text-slate-700">Substituição Lâmpada</span>
                                                            <div className="flex items-center gap-2">
                                                                <button className="w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded text-center text-xs text-slate-800">-</button>
                                                                <span className="font-bold px-1">4</span>
                                                                <button className="w-5 h-5 bg-primary text-white rounded text-center text-xs">+</button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button onClick={handleSalvarSimulado} className="w-full py-2.5 bg-secondary hover:bg-slate-800 text-white font-bold rounded-xl text-xs mt-4 transition-transform active:scale-95 shadow-md">
                                                        Salvar Relatório Diário
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Screen: Presenca */}
                                            <div className={`absolute inset-0 px-4 transition-all duration-300 flex flex-col gap-4 ${activeSimScreen === 'presenca' ? 'opacity-100 translate-x-0 z-10 relative' : 'opacity-0 translate-x-10 z-0 hidden'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] uppercase font-bold text-primary tracking-widest font-sans">CONTROLE DE PESSOAL</span>
                                                    <span className="text-xs font-bold text-slate-800">Eletromidia</span>
                                                </div>

                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Presença e Ausência</h4>
                                                    <p className="text-[10px] text-slate-500">Gerencie a lista de presença hoje</p>
                                                </div>

                                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col gap-2">
                                                    <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-primary-50 text-primary font-bold text-xs flex items-center justify-center">JS</div>
                                                            <div>
                                                                <h5 className="text-xs font-bold text-slate-800">Juliano Silva</h5>
                                                                <span className="text-[9px] text-slate-500">Técnico Eletromidia</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] px-2.5 py-1 bg-green-50 text-green-600 rounded-full font-bold">Presente</span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center">RC</div>
                                                            <div>
                                                                <h5 className="text-xs font-bold text-slate-800">Roberto Costa</h5>
                                                                <span className="text-[9px] text-slate-500">Técnico Eletromidia</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] px-2.5 py-1 bg-green-50 text-green-600 rounded-full font-bold">Presente</span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
                                                        <div className="flex items-center gap-2 opacity-70">
                                                            <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 font-bold text-xs flex items-center justify-center">MN</div>
                                                            <div>
                                                                <h5 className="text-xs font-bold text-slate-800">Matheus Neto</h5>
                                                                <span className="text-[9px] text-red-500">Falta Justificada</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] px-2.5 py-1 bg-orange-100 text-orange-600 rounded-full font-bold">Atestado</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Screen: Feed */}
                                            <div className={`absolute inset-0 px-4 transition-all duration-300 flex flex-col gap-4 ${activeSimScreen === 'feed' ? 'opacity-100 translate-x-0 z-10 relative' : 'opacity-0 translate-x-10 z-0 hidden'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] uppercase font-bold text-green-600 tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Feed ao Vivo</span>
                                                    <span className="text-xs font-bold text-slate-800">Eletromidia</span>
                                                </div>

                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Painel Gerencial</h4>
                                                    <p className="text-[10px] text-slate-500">Atividades sendo finalizadas na rua</p>
                                                </div>

                                                <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                                                    <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-1 shadow-sm">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-bold text-primary">Equipe Alpha</span>
                                                            <span className="text-[9px] text-slate-500">Agora mesmo</span>
                                                        </div>
                                                        <p className="text-xs text-slate-700">Salvou relatório: <strong>14 manutenções</strong> finalizadas na Concessão Sul.</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-1 shadow-sm">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-bold text-secondary">Fiorino [ABC-1234]</span>
                                                            <span className="text-[9px] text-slate-500">Há 15 min</span>
                                                        </div>
                                                        <p className="text-xs text-slate-700">Vinculado à rota da Av. Engenheiro Luís Carlos Berrini.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Screen: Excel */}
                                            <div className={`absolute inset-0 px-4 transition-all duration-300 flex flex-col gap-4 ${activeSimScreen === 'excel' ? 'opacity-100 translate-x-0 z-10 relative' : 'opacity-0 translate-x-10 z-0 hidden'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">RELATÓRIOS EXCEL</span>
                                                    <span className="text-xs font-bold text-slate-800">Eletromidia</span>
                                                </div>

                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Exportação Profissional</h4>
                                                    <p className="text-[10px] text-slate-500">Sua diretoria sempre alinhada</p>
                                                </div>

                                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col justify-between">
                                                    <div className="flex flex-col gap-3">
                                                        <p className="text-xs text-slate-600 leading-relaxed">Clique para simular a criação de uma planilha profissional perfeita da operação.</p>
                                                        
                                                        <div className="border border-dashed border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-center gap-3">
                                                            <FileSpreadsheet className="text-emerald-600" size={24} />
                                                            <div className="text-left">
                                                                <h5 className="text-xs font-bold text-slate-800">Relatório_Diario_Sul.xlsx</h5>
                                                                <span className="text-[9px] text-slate-500">Resumo do dia + abs de produtividade</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button onClick={handleDispararDopaminaConfetti} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all duration-200 hover:shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                                        <Download size={14} /> Baixar Planilha Excel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Nav */}
                                        <div className="bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center text-slate-400 text-base z-20">
                                            <button className="hover:text-primary"><i className="fa-solid fa-house"></i></button>
                                            <button className="hover:text-primary"><i className="fa-solid fa-chart-line"></i></button>
                                            <button className="hover:text-primary text-primary"><i className="fa-solid fa-plus-circle text-2xl"></i></button>
                                            <button className="hover:text-primary"><i className="fa-solid fa-bell"></i></button>
                                            <button className="hover:text-primary"><i className="fa-solid fa-user-gear"></i></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* App Section */}
                <section id="aplicativo" className="py-24 max-w-7xl mx-auto px-6">
                    <div className="bg-gradient-to-r from-secondary to-slate-900 rounded-3xl p-8 md:p-16 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12 shadow-2xl">
                        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-primary/20 blur-3xl rounded-full"></div>

                        <div className="max-w-xl relative z-10">
                            <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">Instalação Facilitada</span>
                            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-6 mb-4">Também é Aplicativo (PWA)</h2>
                            <p className="text-slate-300 leading-relaxed mb-8">
                                Não gaste espaço do seu dispositivo com downloads demorados da Google Play ou App Store. Adicione nosso sistema como aplicativo direto na tela de início com apenas um clique pelo navegador e acesse de forma offline!
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <div className="flex items-center gap-3 bg-white/10 px-4 py-3 rounded-xl border border-white/10">
                                    <i className="fa-brands fa-android text-2xl text-primary"></i>
                                    <div className="text-left">
                                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Celular Android</span>
                                        <h4 className="text-xs font-bold">Compatível 100%</h4>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-white/10 px-4 py-3 rounded-xl border border-white/10">
                                    <i className="fa-brands fa-apple text-2xl text-primary"></i>
                                    <div className="text-left">
                                        <span className="text-[9px] uppercase tracking-wider text-slate-400">iPhone iOS</span>
                                        <h4 className="text-xs font-bold">Compatível 100%</h4>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full max-w-xs bg-white/10 border border-white/20 p-6 rounded-2xl relative z-10 flex flex-col gap-4 text-center">
                            <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg shadow-primary/30 text-white">
                                <Smartphone size={32} />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg">Instalar Eletromidia SUL</h4>
                                <p className="text-xs text-slate-300 mt-1">Gostaria de adicionar o atalho à sua tela inicial?</p>
                            </div>
                            <button onClick={handleSimularInstalacaoApp} className="py-3 bg-primary hover:bg-primary-600 transition-colors text-white font-bold rounded-xl text-sm mt-2 shadow-lg shadow-primary/10">
                                Instalar na Tela de Início
                            </button>
                        </div>
                    </div>
                </section>

                {/* Diferenciais Section */}
                <section id="sobre" className="py-24 bg-white border-t border-slate-50">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                        <div className="max-w-3xl mx-auto">
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-widest flex items-center justify-center gap-2 w-max mx-auto mb-6"><Star size={12} className="fill-green-600" /> O maior valor para gestão</span>
                            <h2 className="text-3xl md:text-5xl font-extrabold text-secondary mt-6 mb-6">Chega de digitar os mesmos dados dezenas de vezes</h2>
                            <p className="text-slate-500 text-base leading-relaxed mb-12">
                                Seu tempo é precioso demais. Nosso painel substitui as velhas planilhas manuais e as pranchetas físicas do campo por um fluxo inteligente onde tudo se consolida sozinho. O relatório diário e mensal geram planilhas profissionais estruturadas em abas com toda a produtividade pronta para enviar à diretoria.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                <div className="p-8 rounded-3xl border border-gray-100 hover:border-primary/10 bg-slate-50/50 transition-all">
                                    <span className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold mb-4"><i className="fa-solid fa-calendar-day"></i></span>
                                    <h4 className="font-bold text-secondary text-lg mb-2">Relatório Diário</h4>
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        Abas detalhadas de cada atividade, veículo que circulou no dia, técnicos presentes, faltas justificadas e o total de produtividade consolidado para análises de rotas feitas.
                                    </p>
                                </div>
                                <div className="p-8 rounded-3xl border border-gray-100 hover:border-primary/10 bg-slate-50/50 transition-all">
                                    <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-4"><CalendarDays size={20} /></span>
                                    <h4 className="font-bold text-secondary text-lg mb-2">Relatório Consolidado Mensal</h4>
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        Histórico que agrupa todos os dias de atividades do mês inteiro. Mostra o total de peças movimentadas, dias com operação ativa e total geral por técnico da filial sul.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Call to action */}
                <section className="bg-slate-50 border-t border-gray-100 py-24">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <div className="bg-white p-8 md:p-16 rounded-3xl border border-gray-200/80 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-primary"></div>

                            <div className="w-16 h-16 bg-primary-50 text-primary rounded-full flex items-center justify-center text-2xl mx-auto mb-6">
                                <ShieldCheck size={32} />
                            </div>

                            <h2 className="text-3xl font-extrabold text-secondary mb-4">Filial Sul • Gestão de Operações</h2>
                            <p className="text-slate-500 max-w-md mx-auto mb-8">
                                Seu painel digital pronto para substituir as velhas pranchetas de papel. Garanta produtividade com 100% de controle.
                            </p>

                            <button onClick={onOpenLogin} className="px-10 py-4 bg-secondary hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-secondary/10 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 text-base">
                                Acessar Sistema Principal
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="bg-secondary text-slate-400 py-12 border-t border-slate-800 text-sm">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-extrabold tracking-tight text-white">
                            <span className="text-primary">Eletro</span>midia
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">© 2026 Eletromidia S.A. • Filial Sul</span>
                    </div>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-primary transition-colors">Termos de Uso</a>
                        <a href="#" className="hover:text-primary transition-colors">Política de Privacidade</a>
                        <a href="#" className="hover:text-primary transition-colors">Suporte Interno</a>
                    </div>
                </div>
            </footer>

            {/* Toasts */}
            <div className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className="bg-secondary text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 font-semibold text-sm border border-slate-700 landing-toast-enter pointer-events-auto">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                            <i className="fa-solid fa-bell"></i>
                        </div>
                        {toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
};
