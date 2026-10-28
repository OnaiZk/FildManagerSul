import React, { useMemo, useState } from 'react';
import { Task, TaskStatus, User, UserRole } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { FileSpreadsheet, TrendingUp, Users, Activity, Download, Calendar, Filter, Building2, ChevronDown, CheckCircle2, AlertCircle, Sun, Moon, X } from 'lucide-react';
import { createEletromidiaWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, saveWorkbook } from '../utils/excelExport';
import { resolveUserShift, ShiftExportMode } from '../utils/shiftUtils';

interface Props {
    tasks: Task[];
    users: User[];
    currentUser: User;
}

export const ReportsView: React.FC<Props> = ({ tasks, users, currentUser }) => {
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [shiftFilter, setShiftFilter] = useState<'all' | 'Diurno' | 'Noturno'>('all');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportShiftMode, setExportShiftMode] = useState<ShiftExportMode>('consolidado');
    const [isExporting, setIsExporting] = useState(false);

    const companies = useMemo(() => {
        const unique = Array.from(new Set(tasks.map(t => t.companyId)));
        return unique.map(id => ({
            id: id as string,
            name: id === 'internal' ? 'Eletromidia (Interno)' : (id as string).toUpperCase()
        }));
    }, [tasks]);

    const periodCompanyTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesMonth = t.scheduledDate.startsWith(selectedMonth);
            const matchesCompany = selectedCompany === 'all' || t.companyId === selectedCompany;
            return matchesMonth && matchesCompany;
        });
    }, [tasks, selectedMonth, selectedCompany]);

    const filteredTasks = useMemo(() => {
        return periodCompanyTasks.filter(t => {
            if (shiftFilter === 'all') return true;
            return resolveUserShift(t.technicianId, users) === shiftFilter;
        });
    }, [periodCompanyTasks, shiftFilter, users]);

    const stats = useMemo(() => {
        const total = filteredTasks.length;
        const completed = filteredTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        const sla = total > 0 ? (completed / total) * 100 : 0;
        const blocked = filteredTasks.filter(t => t.status === TaskStatus.BLOCKED).length;
        const pending = filteredTasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS).length;

        return { total, completed, sla, blocked, pending };
    }, [filteredTasks]);

    const performanceByCompany = useMemo(() => {
        const groups: Record<string, { name: string, total: number, completed: number }> = {};

        filteredTasks.forEach(t => {
            if (!groups[t.companyId]) {
                groups[t.companyId] = {
                    name: t.companyId === 'internal' ? 'Interno' : t.companyId.toUpperCase(),
                    total: 0,
                    completed: 0
                };
            }
            groups[t.companyId].total++;
            if (t.status === TaskStatus.COMPLETED) groups[t.companyId].completed++;
        });

        return Object.values(groups).map(g => ({
            name: g.name,
            sla: (g.completed / g.total) * 100,
            total: g.total
        })).sort((a, b) => b.sla - a.sla);
    }, [filteredTasks]);

    const techProductivity = useMemo(() => {
        const groups: Record<string, { name: string, completed: number }> = {};

        filteredTasks.forEach(t => {
            if (t.status === TaskStatus.COMPLETED) {
                if (!groups[t.technicianId]) {
                    const user = users.find(u => u.id === t.technicianId);
                    groups[t.technicianId] = { name: user?.name || '---', completed: 0 };
                }
                groups[t.technicianId].completed++;
            }
        });

        return Object.values(groups)
            .sort((a, b) => b.completed - a.completed)
            .slice(0, 5);
    }, [filteredTasks, users]);

    const populateTasksSheet = (ws: any, sRow: number, list: Task[]) => {
        const headers = ['Data', 'Turno', 'Ativo', 'Tipo', 'Serviço', 'Status', 'Técnico', 'Empresa'];
        const headerRow = ws.getRow(sRow);
        headerRow.values = headers;
        styleHeaderRow(headerRow);

        list.forEach(t => {
            const shift = resolveUserShift(t.technicianId, users);
            ws.addRow([
                t.scheduledDate,
                shift === 'Noturno' ? 'Noturno (Noite)' : 'Diurno (Dia)',
                t.assetId,
                t.asset?.type || '',
                t.serviceType,
                t.status,
                users.find(u => u.id === t.technicianId)?.name || '---',
                t.companyId === 'internal' ? 'Eletromidia' : t.companyId.toUpperCase()
            ]);
        });

        styleDataRows(ws, sRow);
        autoFitColumns(ws);
    };

    const buildPerformanceWorkbook = async (list: Task[], shiftLabel: string, includeShiftTabs: boolean) => {
        const { workbook, worksheet, startRow } = await createEletromidiaWorkbook(
            `Relatório Consolidado (${shiftLabel}) - ${selectedMonth}`,
            'Relatório'
        );

        populateTasksSheet(worksheet, startRow, list);

        if (includeShiftTabs) {
            const dList = list.filter(t => resolveUserShift(t.technicianId, users) === 'Diurno');
            const nList = list.filter(t => resolveUserShift(t.technicianId, users) === 'Noturno');

            const wsDia = workbook.addWorksheet('OS - Dia (Diurno)');
            populateTasksSheet(wsDia, 1, dList);

            const wsNoite = workbook.addWorksheet('OS - Noite (Noturno)');
            populateTasksSheet(wsNoite, 1, nList);
        }

        return workbook;
    };

    const handleExportFullReport = async (modeOverride?: ShiftExportMode) => {
        const mode = modeOverride || exportShiftMode;
        const diurnoTasks = periodCompanyTasks.filter(t => resolveUserShift(t.technicianId, users) === 'Diurno');
        const noturnoTasks = periodCompanyTasks.filter(t => resolveUserShift(t.technicianId, users) === 'Noturno');

        setIsExporting(true);
        try {
            if (mode === 'diurno') {
                const wb = await buildPerformanceWorkbook(diurnoTasks, 'Diurno (Dia)', false);
                await saveWorkbook(wb, `Relatorio_Consolidado_Dia_Diurno_${selectedMonth}`);
            } else if (mode === 'noturno') {
                const wb = await buildPerformanceWorkbook(noturnoTasks, 'Noturno (Noite)', false);
                await saveWorkbook(wb, `Relatorio_Consolidado_Noite_Noturno_${selectedMonth}`);
            } else if (mode === 'separado') {
                const wbDia = await buildPerformanceWorkbook(diurnoTasks, 'Diurno (Dia)', false);
                await saveWorkbook(wbDia, `Relatorio_Consolidado_Dia_Diurno_${selectedMonth}`);
                await new Promise(resolve => setTimeout(resolve, 350));
                const wbNoite = await buildPerformanceWorkbook(noturnoTasks, 'Noturno (Noite)', false);
                await saveWorkbook(wbNoite, `Relatorio_Consolidado_Noite_Noturno_${selectedMonth}`);
            } else {
                const wb = await buildPerformanceWorkbook(periodCompanyTasks, 'Consolidado (Dia e Noite)', true);
                await saveWorkbook(wb, `Relatorio_Consolidado_${selectedMonth}`);
            }
            setIsExportModalOpen(false);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            {/* Header com Filtros */}
            <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col xl:flex-row justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Performance Analytics</h2>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Visão holística da operação campo</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-100 text-xs font-black">
                        <button
                            onClick={() => setShiftFilter('all')}
                            className={`px-3 py-1.5 rounded-xl transition-all ${shiftFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setShiftFilter('Diurno')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${shiftFilter === 'Diurno' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <Sun size={13} /> Dia
                        </button>
                        <button
                            onClick={() => setShiftFilter('Noturno')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${shiftFilter === 'Noturno' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <Moon size={13} /> Noite
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                        <Calendar size={18} className="text-primary" />
                        <input
                            type="month"
                            className="bg-transparent border-none text-sm font-black text-slate-700 outline-none"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                        <Building2 size={18} className="text-primary" />
                        <select
                            className="bg-transparent border-none text-sm font-black text-slate-700 outline-none min-w-[150px]"
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                        >
                            <option value="all">Todas as Empresas</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
                    >
                        <FileSpreadsheet size={18} />
                        Exportar Excel (Dia / Noite)
                    </button>
                </div>
            </div>

            {/* KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard label="Volume Total" value={stats.total} icon={<Activity className="text-blue-500" />} color="blue" />
                <KPICard label="Concluídas" value={stats.completed} icon={<CheckCircleIcon size={20} className="text-green-500" />} color="green" />
                <KPICard label="SLA Global" value={`${stats.sla.toFixed(1)}%`} icon={<TrendingUp className="text-primary" />} color="orange" />
                <KPICard label="Bloqueios" value={stats.blocked} icon={<AlertCircleIcon size={20} className="text-red-500" />} color="red" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking de Parceiros */}
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <Building2 size={16} className="text-primary" /> Performance por Parceiro (SLA)
                    </h3>
                    <div className="space-y-6">
                        {performanceByCompany.map((pc, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{pc.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{pc.total} Ordens de Serviço</p>
                                    </div>
                                    <p className="text-sm font-black text-primary">{pc.sla.toFixed(1)}%</p>
                                </div>
                                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-1000"
                                        style={{ width: `${pc.sla}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Produtividade Técnica */}
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <Users size={16} className="text-primary" /> Top 5 Produtividade (Tecnicos)
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={techProductivity} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} width={100} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="completed" fill="#FF4F00" radius={[0, 8, 8, 0]} barSize={20}>
                                    {techProductivity.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={1 - index * 0.15} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {isExportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight">Exportar Relatório Consolidado</h3>
                                <p className="text-xs font-bold text-slate-400">Período: <span className="text-primary">{selectedMonth}</span></p>
                            </div>
                            <button
                                onClick={() => setIsExportModalOpen(false)}
                                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                                        <Sun size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Dia (Diurno)</p>
                                        <p className="text-xs font-black text-slate-800">
                                            {periodCompanyTasks.filter(t => resolveUserShift(t.technicianId, users) === 'Diurno').length} OS
                                        </p>
                                    </div>
                                </div>
                                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                                        <Moon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Noite (Noturno)</p>
                                        <p className="text-xs font-black text-slate-800">
                                            {periodCompanyTasks.filter(t => resolveUserShift(t.technicianId, users) === 'Noturno').length} OS
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Formato / Turno para Exportação</label>
                                {[
                                    { id: 'consolidado', title: 'Consolidado (Com Abas Dia e Noite)', desc: '1 arquivo com aba geral + aba Dia + aba Noite' },
                                    { id: 'separado', title: 'Arquivos Separados (Dia e Noite)', desc: 'Baixa 2 arquivos separados: 1 de Dia e 1 de Noite' },
                                    { id: 'diurno', title: 'Somente Turno Dia (Diurno)', desc: 'Apenas ordens de serviço do turno Diurno' },
                                    { id: 'noturno', title: 'Somente Turno Noite (Noturno)', desc: 'Apenas ordens de serviço do turno Noturno' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setExportShiftMode(opt.id as ShiftExportMode)}
                                        className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                                            exportShiftMode === opt.id
                                                ? 'bg-primary/5 border-primary text-slate-900 shadow-sm'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-800">{opt.title}</p>
                                            <p className="text-[10px] font-bold text-slate-400">{opt.desc}</p>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${exportShiftMode === opt.id ? 'border-primary' : 'border-slate-300'}`}>
                                            {exportShiftMode === opt.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => handleExportFullReport(exportShiftMode)}
                                disabled={isExporting}
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-600 text-white px-5 py-3.5 rounded-2xl font-black text-xs transition-all shadow-md disabled:opacity-50"
                            >
                                <FileSpreadsheet size={16} />
                                <span>{isExporting ? 'Gerando Excel...' : 'Gerar Excel (.XLSX)'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const KPICard = ({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        orange: 'bg-primary/5 text-primary',
        red: 'bg-red-50 text-red-600'
    };

    return (
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4 group hover:shadow-xl hover:shadow-slate-100 transition-all">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${colors[color as keyof typeof colors]}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
            </div>
        </div>
    );
};

const AlertCircleIcon = ({ size, className }: { size: number, className: string }) => (
    <AlertCircle size={size} className={className} />
);

const CheckCircleIcon = ({ size, className }: { size: number, className: string }) => (
    <CheckCircle2 size={size} className={className} />
);
