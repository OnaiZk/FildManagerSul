
import React, { useMemo, useState } from 'react';
import { User, Task, TaskStatus, Team, UserRole, AssetType, ServiceType, DailyReport } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapPin, TrendingUp, Shield, Activity, Download, Building2, Plus, Clock, Box } from 'lucide-react';
import SimpleModal from './SimpleModal';
import SearchableSelect from './SearchableSelect';
import { getAssets, getDailyReports } from '../api/fieldManagerApi';

import EvidenceAuditModal from './EvidenceAuditModal';

interface Props {
  chief: User;
  tasks: Task[];
  teams: Team[];
  users: User[];
  onUpdateTask: (task: Task) => void;
  onCreateTask?: (task: Omit<Task, 'id'>) => void;
}

const ChiefView: React.FC<Props> = ({ chief, tasks, teams, users, onCreateTask }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [isAssetLoading, setIsAssetLoading] = useState(false);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [todayReports, setTodayReports] = useState<DailyReport[]>([]);

  React.useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    getDailyReports(chief.companyId, undefined, today).then(setTodayReports);
  }, [chief.companyId]);

  // Form State
  const [assetType, setAssetType] = useState<AssetType>(AssetType.BUS_SHELTER);
  const [assetId, setAssetId] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.PREVENTIVE);
  const [technicianId, setTechnicianId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');

  React.useEffect(() => {
    if (isModalOpen) {
      setIsAssetLoading(true);
      getAssets().then(data => {
        setAssets(data);
        setIsAssetLoading(false);
      });
    }
  }, [isModalOpen]);

  const handleAssetChange = (code: string) => {
    setAssetId(code);
    const selected = assets.find(a => a.code === code);
    if (selected) {
      setAssetType(selected.type as AssetType);
      setAddress(selected.address);
    }
  };

  const filteredTasks = tasks;

  const slaRate = useMemo(() => {
    if (filteredTasks.length === 0) return 0;
    const completed = filteredTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    return (completed / filteredTasks.length) * 100;
  }, [filteredTasks]);

  const productivityData = useMemo(() => {
    // Generate last 7 days distribution
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });

    return last7Days.map(day => {
      const count = filteredTasks.filter(t =>
        t.status === TaskStatus.COMPLETED &&
        t.completedAt &&
        new Date(t.completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) === day
      ).length;
      return { day, value: count };
    });
  }, [filteredTasks]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Ativo', 'Tipo', 'Serviço', 'Status', 'Técnico', 'Empresa', 'Data'];
    const rows = filteredTasks.map(t => [
      t.id,
      t.assetId,
      t.asset?.type || '',
      t.serviceType,
      t.status,
      users.find(u => u.id === t.technicianId)?.name || 'N/A',
      t.companyId,
      t.scheduledDate
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_eletromidia_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isInternalChief = true;

  const teamActivities = useMemo(() => {
    return teams.map(team => {
      const report = todayReports.find(r => r.teamId === team.id);
      const activities = report?.activities || [];
      const totalItems = activities.reduce((sum, act) => sum + act.quantity, 0);
      
      const topActivities = activities
        .map(a => `${a.quantity}x ${a.activityType}`)
        .slice(0, 2)
        .join(', ');

      const leader = users.find(u => u.id === team.leaderId);

      return {
        id: team.id,
        name: team.name,
        leaderName: leader?.name || 'Sem Líder',
        totalItems,
        summary: topActivities || 'Nenhuma atividade registrada ainda'
      };
    });
  }, [teams, todayReports, users]);

  const availableTechnicians = useMemo(() => {
    if (isInternalChief) {
      // Chefe interno vê todos os técnicos (interno + parceiros)
      return users.filter(u => u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO);
    }
    // Chefe parceiro vê apenas técnicos da sua própria empresa
    return users.filter(u => (u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO) && u.companyId === chief.companyId);
  }, [users, isInternalChief, chief.companyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tech = users.find(u => u.id === technicianId);
    const asset = {
      id: assetId,
      code: assetId,
      type: assetType,
      location: { address, lat: -23.5505, lng: -46.6333 }, // Default to SP center if unknown
      companyId: tech?.companyId || chief.companyId
    };

    if (onCreateTask) {
      onCreateTask({
        assetId: assetId,
        asset: asset,
        serviceType,
        technicianId,
        leaderId: chief.id,
        companyId: tech?.companyId || chief.companyId,
        scheduledDate,
        description,
        status: TaskStatus.PENDING,
        evidence: []
      });
      setIsModalOpen(false);
      // Reset form
      setAssetId('');
      setTechnicianId('');
      setScheduledDate('');
      setDescription('');
      setAddress('');
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 md:p-8 rounded-2xl md:rounded-3xl border shadow-xl bg-white border-slate-200">
        <div>
          <h3 className="text-xl md:text-2xl font-black">Dashboard Executivo</h3>
          <p className="text-slate-500 font-bold text-[10px] md:text-sm mt-1 uppercase tracking-widest">
            Visão Geral da Operação Sul
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">

          {onCreateTask && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-primary text-white font-black rounded-xl md:rounded-2xl hover:bg-primary-600 transition-all shadow-lg shadow-primary/20 active:scale-95"
            >
              <Plus size={18} />
              <span className="text-xs md:text-sm">Nova OS</span>
            </button>
          )}



          <button
            onClick={handleExportCSV}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-slate-100 text-slate-600 font-black rounded-xl md:rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
            <Download size={18} />
            <span className="text-xs md:text-sm">SLA Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KPICard label="Volume OS" value={filteredTasks.length} subtitle="Escopo selecionado" trend="+12%" icon={<Activity className="text-primary" />} />
        <KPICard label="Em Andamento" value={filteredTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length} subtitle="Atividades agora" trend="Tempo Real" icon={<Clock className="text-blue-500 animate-pulse" />} />
        <KPICard label="Taxa SLA" value={`${slaRate.toFixed(1)}%`} subtitle="Média de conclusão" trend={slaRate > 80 ? "+5%" : "-2%"} icon={<TrendingUp className={slaRate > 80 ? "text-green-500" : "text-red-500"} />} />
        <KPICard label="Bloqueios" value={filteredTasks.filter(t => t.status === TaskStatus.BLOCKED).length} subtitle="Ações imediatas" trend="-2%" icon={<Shield className="text-red-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="font-black text-slate-800 text-sm md:text-lg mb-6 md:mb-8 uppercase tracking-widest text-[10px] md:text-xs border-l-4 border-primary pl-4">Curva de Entrega</h4>
          <div className="h-48 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productivityData}>
                <defs>
                  <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FA3A00" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#FA3A00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#FA3A00" strokeWidth={4} fillOpacity={1} fill="url(#colorOrange)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <h4 className="font-black text-slate-800 text-sm md:text-lg mb-6 md:mb-8 uppercase tracking-widest text-[10px] md:text-xs border-l-4 border-primary pl-4">
            Atividades das Equipes (Hoje)
          </h4>
          <div className="space-y-4 md:space-y-6 overflow-y-auto pr-2 flex-1">
            {teamActivities.map((team, idx) => (
              <div key={idx} className="flex items-center gap-3 md:gap-5 group p-4 border border-slate-100 rounded-2xl hover:border-primary/30 hover:bg-primary/5 transition-all">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 text-slate-500 rounded-xl md:rounded-2xl flex items-center justify-center font-black transition-all text-xs md:text-base group-hover:bg-primary group-hover:text-white">
                  {team.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs md:text-sm font-black text-slate-800">{team.name}</p>
                    <span className="text-[10px] md:text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {team.totalItems} Lançamentos
                    </span>
                  </div>
                  <p className="text-[10px] md:text-xs font-bold text-slate-400 mb-1">Líder: {team.leaderName}</p>
                  <p className="text-[10px] md:text-xs font-medium text-slate-500 line-clamp-1">{team.summary}</p>
                </div>
              </div>
            ))}
            {teamActivities.length === 0 && (
              <div className="text-center text-slate-400 py-8 text-sm font-bold">Nenhuma equipe cadastrada</div>
            )}
          </div>
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="mt-6 md:mt-8 py-3 md:py-4 w-full bg-slate-50 text-slate-600 text-xs md:text-sm font-black rounded-xl md:rounded-2xl hover:bg-primary hover:text-white transition-all shadow-sm uppercase tracking-widest"
          >
            Auditar Evidências
          </button>
        </div>
      </div>

      <SimpleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Ordem de Serviço (Executivo)">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Ativo</label>
              <select
                value={assetType} onChange={e => setAssetType(e.target.value as AssetType)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
              >
                {Object.values(AssetType).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID do Ativo</label>
              <SearchableSelect
                required
                value={assetId}
                onChange={handleAssetChange}
                isLoading={isAssetLoading}
                placeholder="Selecionar Ativo..."
                options={assets.map(a => ({
                  value: a.code,
                  label: a.code,
                  sublabel: a.city
                }))}
              />
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-4">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Detalhes Automáticos</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] text-slate-400 uppercase font-bold">Tipo</p>
                <p className="text-xs font-black text-slate-700">{assetType || '---'}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 uppercase font-bold">Endereço</p>
                <p className="text-xs font-black text-slate-700 truncate">{address || '---'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Serviço</label>
              <select
                value={serviceType} onChange={e => setServiceType(e.target.value as ServiceType)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
              >
                {Object.values(ServiceType).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Data Agendada</label>
              <input
                type="date" required value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Técnico Responsável</label>
            <select
              required value={technicianId} onChange={e => setTechnicianId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
            >
              <option value="">Selecione...</option>
              {availableTechnicians.map(t => <option key={t.id} value={t.id}>{t.name} ({t.companyName})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Endereço / Localização</label>
            <input
              type="text" required value={address} onChange={e => setAddress(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
              placeholder="Endereço da ocorrência"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Descrição</label>
            <textarea
              required value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs h-24 resize-none"
              placeholder="Descreva o serviço a ser realizado..."
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-primary-600 transition-all shadow-lg shadow-primary/20"
          >
            Criar Ordem de Serviço
          </button>
        </form>
      </SimpleModal>



      <EvidenceAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        tasks={tasks}
        users={users}
      />
    </div>
  );
};

const KPICard: React.FC<{ label: string, value: string | number, subtitle: string, trend: string, icon: React.ReactNode }> = ({ label, value, subtitle, trend, icon }) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
    <div className="flex justify-between items-start mb-6">
      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">{icon}</div>
      <span className="text-[10px] font-black px-2 py-1 bg-green-50 text-green-600 rounded-lg">{trend}</span>
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
    <h3 className="text-3xl font-black text-slate-900 mb-2">{value}</h3>
    <p className="text-xs text-slate-500 font-bold">{subtitle}</p>
  </div>
);

export default ChiefView;
