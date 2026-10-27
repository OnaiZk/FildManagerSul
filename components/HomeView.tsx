import React, { useState, useEffect } from 'react';
import { User } from '../types';
import {
  Sun,
  CloudRain,
  Cloud,
  CloudLightning,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Smartphone,
  Car,
  ListTodo,
  Users,
  LayoutDashboard,
  MapPin
} from 'lucide-react';

interface HomeViewProps {
  currentUser: User;
  setActiveTab: (tab: any) => void;
  isPartner: boolean;
  usersCount: number;
  teamsCount: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  setActiveTab,
  isPartner,
  usersCount,
  teamsCount,
}) => {
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<'centro' | 'sul' | 'leste' | 'oeste'>('sul');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(
        now.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const regionWeather = {
    centro: {
      label: 'Centro Expandido',
      temp: '22°C',
      cond: 'Céu limpo e estável',
      humidity: '54%',
      wind: '14 km/h',
      icon: <Sun className="text-amber-500" size={26} />,
      rec: 'Condições ideais para instalações externas, manutenção preventiva e limpeza de totens.',
    },
    sul: {
      label: 'Zona Sul',
      temp: '19°C',
      cond: 'Instabilidade leve',
      humidity: '78%',
      wind: '22 km/h',
      icon: <CloudRain className="text-sky-600" size={26} />,
      rec: 'Atenção redobrada em atividades em altura e aferição de painéis digitais energizados.',
    },
    leste: {
      label: 'Zona Leste',
      temp: '21°C',
      cond: 'Parcialmente nublado',
      humidity: '62%',
      wind: '16 km/h',
      icon: <Cloud className="text-[#525866]" size={26} />,
      rec: 'Operação normal sem restrições meteorológicas. Priorize rotas de vistoria programada.',
    },
    oeste: {
      label: 'Zona Oeste',
      temp: '20°C',
      cond: 'Nebulosidade variável',
      humidity: '68%',
      wind: '19 km/h',
      icon: <CloudLightning className="text-indigo-600" size={26} />,
      rec: 'Mantenha lonas de proteção e vedação de gabinetes prontas durante manutenções.',
    },
  };

  const currentWeather = regionWeather[selectedRegion];

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* 1. Architectural Welcome & Live Telemetry Header */}
      <section className="ooh-card p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <h1 className="font-display text-2xl sm:text-3xl md:text-[34px] font-bold text-[#141518] tracking-tight leading-tight">
              {getGreeting()}, {currentUser.name.split(' ')[0]}
            </h1>
            <p className="text-[#525866] text-sm sm:text-base leading-relaxed">
              Acompanhe a operação de campo da Concessão São Paulo - Filial Sul em tempo real. Gerencie frequência,
              alocação de equipes, frota e dispositivos OPEC em um único fluxo.
            </p>

            {/* Quick Action Capsules */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setActiveTab('leader_dashboard')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#141518] hover:bg-[#FF4F00] text-white text-xs font-semibold transition-colors shadow-xs"
              >
                <LayoutDashboard size={15} />
                <span>Abrir Painel do Líder</span>
              </button>
              <button
                onClick={() => setActiveTab('daily_report')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F4F5F7] hover:bg-[#ECEEF2] text-[#141518] border border-[#E6E8EC] text-xs font-semibold transition-colors"
              >
                <ListTodo size={15} className="text-[#525866]" />
                <span>Relatório Diário</span>
              </button>
              <button
                onClick={() => setActiveTab('weekly_agenda')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F4F5F7] hover:bg-[#ECEEF2] text-[#141518] border border-[#E6E8EC] text-xs font-semibold transition-colors"
              >
                <Calendar size={15} className="text-[#525866]" />
                <span>Diário Semanal</span>
              </button>
            </div>
          </div>

          {/* Live Clock & Shift Status */}
          <div className="flex items-center justify-between lg:justify-end gap-6 pt-5 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#E6E8EC] lg:pl-8 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-[#525866]">
                <Clock size={13} className="text-[#FF4F00]" />
                <span>Horário Oficial de Brasília</span>
              </div>
              <div className="font-mono-code text-3xl sm:text-4xl font-bold text-[#141518] tracking-tight tabular-nums">
                {time || '--:--:--'}
              </div>
              <p className="text-xs font-medium text-[#868C98] capitalize">{dateStr}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Key Operational Modules Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Painel do Líder */}
        <button
          onClick={() => setActiveTab('leader_dashboard')}
          className="ooh-card ooh-card-interactive p-6 flex flex-col justify-between text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-[#525866]">Monitoramento</span>
            <div className="w-10 h-10 rounded-xl bg-[#FFF3EE] text-[#FF4F00] flex items-center justify-center group-hover:bg-[#FF4F00] group-hover:text-white transition-colors">
              <LayoutDashboard size={19} />
            </div>
          </div>

          <div className="my-5">
            <div className="font-display text-2xl font-bold text-[#141518] tracking-tight">
              Painel do Líder
            </div>
            <p className="text-xs text-[#525866] mt-1">
              Indicadores de presença, ausências e distribuição por turno
            </p>
          </div>

          <div className="pt-3.5 border-t border-[#E6E8EC] flex items-center justify-between w-full text-xs font-semibold text-[#141518] group-hover:text-[#FF4F00] transition-colors">
            <span>Acessar indicadores</span>
            <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </button>

        {/* Card 2: Funcionários */}
        <button
          onClick={() => setActiveTab('funcionarios')}
          className="ooh-card ooh-card-interactive p-6 flex flex-col justify-between text-left group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-[#525866]">Efetivo Ativo</span>
            <div className="w-10 h-10 rounded-xl bg-[#F4F5F7] text-[#141518] flex items-center justify-center group-hover:bg-[#141518] group-hover:text-white transition-colors">
              <Users size={19} />
            </div>
          </div>

          <div className="my-5">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-[#141518] tabular-nums">
                {usersCount}
              </span>
              <span className="text-xs font-medium text-[#525866]">colaboradores</span>
            </div>
            <p className="text-xs text-[#525866] mt-1">
              Cadastro de equipes, cargos, escalas e líderes
            </p>
          </div>

          <div className="pt-3.5 border-t border-[#E6E8EC] flex items-center justify-between w-full text-xs font-semibold text-[#525866] group-hover:text-[#141518] transition-colors">
            <span>Gerenciar efetivo</span>
            <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </button>

        {/* Card 3: Controle de Frota */}
        {!isPartner ? (
          <button
            onClick={() => setActiveTab('veiculos')}
            className="ooh-card ooh-card-interactive p-6 flex flex-col justify-between text-left group"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-[#525866]">Frota Operacional</span>
              <div className="w-10 h-10 rounded-xl bg-[#F4F5F7] text-[#141518] flex items-center justify-center group-hover:bg-[#141518] group-hover:text-white transition-colors">
                <Car size={19} />
              </div>
            </div>

            <div className="my-5">
              <div className="font-display text-2xl font-bold text-[#141518] tracking-tight">
                Veículos & KM
              </div>
              <p className="text-xs text-[#525866] mt-1">
                Controle de saída, retorno, avarias e manutenção
              </p>
            </div>

            <div className="pt-3.5 border-t border-[#E6E8EC] flex items-center justify-between w-full text-xs font-semibold text-[#525866] group-hover:text-[#141518] transition-colors">
              <span>Abrir controle de frota</span>
              <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </button>
        ) : (
          <div className="ooh-card p-6 flex flex-col justify-between bg-[#F4F5F7]/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#868C98]">Frota Operacional</span>
              <Car size={18} className="text-[#868C98]" />
            </div>
            <div className="my-5">
              <div className="font-display text-lg font-bold text-[#525866]">Acesso Interno</div>
              <p className="text-xs text-[#868C98] mt-1">
                Módulo exclusivo para gestão direta da concessionária.
              </p>
            </div>
            <div className="pt-3.5 border-t border-[#E6E8EC] text-[11px] font-medium text-[#868C98]">
              Perfil Parceiro
            </div>
          </div>
        )}

        {/* Card 4: Gestão de OPEC */}
        {!isPartner ? (
          <button
            onClick={() => setActiveTab('opec')}
            className="ooh-card ooh-card-interactive p-6 flex flex-col justify-between text-left group"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-[#525866]">Equipamentos</span>
              <div className="w-10 h-10 rounded-xl bg-[#F4F5F7] text-[#141518] flex items-center justify-center group-hover:bg-[#141518] group-hover:text-white transition-colors">
                <Smartphone size={19} />
              </div>
            </div>

            <div className="my-5">
              <div className="font-display text-2xl font-bold text-[#141518] tracking-tight">
                Gestão de OPEC
              </div>
              <p className="text-xs text-[#525866] mt-1">
                Alocação de celulares, patrimônio e termos de guarda
              </p>
            </div>

            <div className="pt-3.5 border-t border-[#E6E8EC] flex items-center justify-between w-full text-xs font-semibold text-[#525866] group-hover:text-[#141518] transition-colors">
              <span>Ver dispositivos</span>
              <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </button>
        ) : (
          <div className="ooh-card p-6 flex flex-col justify-between bg-[#F4F5F7]/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#868C98]">Equipamentos</span>
              <Smartphone size={18} className="text-[#868C98]" />
            </div>
            <div className="my-5">
              <div className="font-display text-lg font-bold text-[#525866]">OPEC Filial Sul</div>
              <p className="text-xs text-[#868C98] mt-1">
                Inventário de dispositivos reservado à equipe interna.
              </p>
            </div>
            <div className="pt-3.5 border-t border-[#E6E8EC] text-[11px] font-medium text-[#868C98]">
              Perfil Parceiro
            </div>
          </div>
        )}
      </section>

      {/* 3. Field Conditions & Safety Protocol Matrix (No nested boxed cards) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Regional Weather & Field Advisory */}
        <div className="lg:col-span-7 ooh-card p-6 md:p-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E6E8EC]">
              <div>
                <h2 className="font-display text-lg font-bold text-[#141518]">
                  Condição Climática de Campo
                </h2>
                <p className="text-xs text-[#525866] mt-0.5">
                  Monitoramento meteorológico por macrozona de São Paulo
                </p>
              </div>

              {/* Capsule Region Switcher */}
              <div className="inline-flex p-1 rounded-full bg-[#F4F5F7] border border-[#E6E8EC] self-start">
                {(['centro', 'sul', 'leste', 'oeste'] as const).map((reg) => (
                  <button
                    key={reg}
                    onClick={() => setSelectedRegion(reg)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                      selectedRegion === reg
                        ? 'bg-[#141518] text-white shadow-xs'
                        : 'text-[#525866] hover:text-[#141518]'
                    }`}
                  >
                    {reg}
                  </button>
                ))}
              </div>
            </div>

            {/* Weather Readout Row */}
            <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#F4F5F7] flex items-center justify-center shrink-0">
                  {currentWeather.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-3xl font-bold text-[#141518] tabular-nums">
                      {currentWeather.temp}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F4F5F7] text-[#141518]">
                      {currentWeather.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#525866] mt-0.5">
                    {currentWeather.cond}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 sm:border-l border-[#E6E8EC] sm:pl-6">
                <div>
                  <span className="block text-[11px] font-medium text-[#868C98]">Umidade</span>
                  <span className="font-mono-code text-sm font-semibold text-[#141518] tabular-nums">
                    {currentWeather.humidity}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-[#868C98]">Vento</span>
                  <span className="font-mono-code text-sm font-semibold text-[#141518] tabular-nums">
                    {currentWeather.wind}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Recommendation Footer */}
          <div className="pt-4 border-t border-[#E6E8EC] flex items-start gap-3 text-xs">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
            <div className="text-[#525866] leading-relaxed">
              <strong className="font-semibold text-[#141518]">Recomendação operacional: </strong>
              {currentWeather.rec}
            </div>
          </div>
        </div>

        {/* Right: Field Safety Protocols */}
        <div className="lg:col-span-5 ooh-card p-6 md:p-7 flex flex-col justify-between">
          <div>
            <div className="pb-5 border-b border-[#E6E8EC]">
              <h2 className="font-display text-lg font-bold text-[#141518]">
                Protocolo de Segurança
              </h2>
              <p className="text-xs text-[#525866] mt-0.5">
                Diretrizes obrigatórias para equipes em via pública
              </p>
            </div>

            <div className="divide-y divide-[#E6E8EC]">
              <div className="py-4 flex items-start gap-3.5">
                <ShieldCheck className="text-teal-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <h3 className="text-xs font-semibold text-[#141518]">
                    Equipamento de Proteção Individual (EPI)
                  </h3>
                  <p className="text-xs text-[#525866] mt-1 leading-relaxed">
                    Uso contínuo de botas isolantes, luvas de proteção, óculos e capacete com jugular em todas as frentes.
                  </p>
                </div>
              </div>

              <div className="py-4 flex items-start gap-3.5">
                <MapPin className="text-[#FF4F00] shrink-0 mt-0.5" size={18} />
                <div>
                  <h3 className="text-xs font-semibold text-[#141518]">
                    Sinalização e Isolamento de Via
                  </h3>
                  <p className="text-xs text-[#525866] mt-1 leading-relaxed">
                    Implante cones refletivos imediatamente ao estacionar e mantenha o perímetro do abrigo ou totem isolado.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E6E8EC] flex items-center justify-between text-[11px] font-medium text-[#868C98]">
            <span>Filial Sul • Concessão Mobiliário Urbano SP</span>
            <span className="font-mono-code">v2.0</span>
          </div>
        </div>
      </section>
    </div>
  );
};
