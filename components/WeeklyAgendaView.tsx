import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Plus,
    MessageSquare,
    Send,
    Users,
    Clock,
    Sparkles,
    Award,
    AlertTriangle,
    Megaphone,
    FileText,
    Trash2,
    Edit3,
    X,
    Check,
    Download,
    Filter,
    Search,
    BookOpen,
    Info,
    LayoutGrid,
    List
} from 'lucide-react';
import {
    User,
    UserRole,
    Team,
    AgendaCategory,
    LeaderAgendaEntry
} from '../types';
import {
    getLeaderAgendaEntries,
    saveLeaderAgendaEntry,
    deleteLeaderAgendaEntry,
    addLeaderAgendaComment,
    deleteLeaderAgendaComment,
    subscribeToLeaderAgenda,
    getTeams,
    getAllUsers
} from '../api/fieldManagerApi';
import {
    createEletromidiaWorkbook,
    styleDataRows,
    autoFitColumns,
    saveWorkbook
} from '../utils/excelExport';

interface WeeklyAgendaViewProps {
    currentUser: User;
}

interface CategoryConfig {
    id: AgendaCategory;
    label: string;
    shortLabel: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotColor: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    placeholderTitle: string;
    placeholderDesc: string;
}

export const AGENDA_CATEGORIES: Record<AgendaCategory, CategoryConfig> = {
    DDS: {
        id: 'DDS',
        label: 'DDS & Alinhamento',
        shortLabel: 'DDS',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200',
        dotColor: 'bg-blue-500',
        icon: Megaphone,
        placeholderTitle: 'Ex: DDS de segurança e saída das equipes',
        placeholderDesc: 'Ex: Hoje realizamos DDS sobre trabalho em altura e direção defensiva; a equipe saiu às 08:40.'
    },
    DESTAQUE_EQUIPE: {
        id: 'DESTAQUE_EQUIPE',
        label: 'Destaque de Equipe',
        shortLabel: 'Destaque',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        dotColor: 'bg-emerald-500',
        icon: Award,
        placeholderTitle: 'Ex: Equipe se destacou na rota de manutenção',
        placeholderDesc: 'Ex: Equipe entregou todas as preventivas com ótimo padrão fotográfico e apoiou outra rota no fim do turno.'
    },
    SAIDA_TARDIA: {
        id: 'SAIDA_TARDIA',
        label: 'Saída Tardia / Horário',
        shortLabel: 'Saída Tardia',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700',
        badgeBorder: 'border-amber-200',
        dotColor: 'bg-amber-500',
        icon: Clock,
        placeholderTitle: 'Ex: Saída mais tarde por carregamento ou DDS',
        placeholderDesc: 'Ex: Equipe saiu mais tarde da base devido à separação de peças no almoxarifado e alinhamento de rota.'
    },
    EVENTO: {
        id: 'EVENTO',
        label: 'Evento / Reunião',
        shortLabel: 'Evento',
        badgeBg: 'bg-purple-50',
        badgeText: 'text-purple-700',
        badgeBorder: 'border-purple-200',
        dotColor: 'bg-purple-500',
        icon: Sparkles,
        placeholderTitle: 'Ex: Treinamento técnico ou visita em campo',
        placeholderDesc: 'Ex: Participação em treinamento de painéis digitais / acompanhamento presencial em rota.'
    },
    OCORRENCIA: {
        id: 'OCORRENCIA',
        label: 'Ocorrência Operacional',
        shortLabel: 'Ocorrência',
        badgeBg: 'bg-rose-50',
        badgeText: 'text-rose-700',
        badgeBorder: 'border-rose-200',
        dotColor: 'bg-rose-500',
        icon: AlertTriangle,
        placeholderTitle: 'Ex: Intercorrência com veículo ou acesso bloqueado',
        placeholderDesc: 'Ex: Chuva forte no período da tarde impactou atendimento externo; rota reprogramada.'
    },
    GERAL: {
        id: 'GERAL',
        label: 'Anotação Geral',
        shortLabel: 'Geral',
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-700',
        badgeBorder: 'border-[#E6E8EC]',
        dotColor: 'bg-slate-500',
        icon: FileText,
        placeholderTitle: 'Ex: Observação importante do dia',
        placeholderDesc: 'Ex: Registro livre sobre a operação do dia.'
    }
};

interface QuickPreset {
    label: string;
    category: AgendaCategory;
    title: string;
    description: string;
}

const QUICK_PRESETS: QuickPreset[] = [
    {
        label: 'DDS + Equipe saiu mais tarde',
        category: 'DDS',
        title: 'DDS realizado e saída mais tarde para rota',
        description: 'Hoje teve DDS com as equipes antes da saída. As equipes saíram um pouco mais tarde da base devido ao alinhamento.'
    },
    {
        label: 'Equipe com ótimo desempenho',
        category: 'DESTAQUE_EQUIPE',
        title: 'Destaque positivo de equipe no dia',
        description: 'Equipe trabalhou muito bem hoje, cumprindo a rota com agilidade, organização e excelente qualidade de execução.'
    },
    {
        label: 'Saída tardia (Material / Veículo)',
        category: 'SAIDA_TARDIA',
        title: 'Saída mais tarde da base',
        description: 'Equipe saiu mais tarde aguardando liberação de material / conferência de veículo antes de iniciar o roteiro.'
    },
    {
        label: 'Evento / Reunião de alinhamento',
        category: 'EVENTO',
        title: 'Reunião / Evento com liderança e operação',
        description: 'Realizado alinhamento operacional sobre prioridades da semana e distribuição de rotas.'
    },
    {
        label: 'Intercorrência em campo',
        category: 'OCORRENCIA',
        title: 'Ocorrência durante o turno',
        description: 'Registrada intercorrência durante a execução em campo que exigiu ajuste no roteiro da equipe.'
    }
];

const WEEKDAY_NAMES = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo'
];

const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function toLocalISODate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMondayOfWeek(referenceDateStr: string): Date {
    const [y, m, d] = referenceDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    date.setDate(date.getDate() + diffToMonday);
    return date;
}

function getWeekDays(referenceDateStr: string): Array<{
    dateStr: string;
    dayNumber: string;
    monthShort: string;
    weekdayName: string;
    weekdayShort: string;
    isToday: boolean;
    isWeekend: boolean;
}> {
    const monday = getMondayOfWeek(referenceDateStr);
    const todayStr = toLocalISODate(new Date());

    return Array.from({ length: 7 }, (_, idx) => {
        const current = new Date(monday);
        current.setDate(monday.getDate() + idx);
        const dateStr = toLocalISODate(current);
        const dayNumber = String(current.getDate()).padStart(2, '0');
        const monthShort = current
            .toLocaleDateString('pt-BR', { month: 'short' })
            .replace('.', '');
        return {
            dateStr,
            dayNumber,
            monthShort,
            weekdayName: WEEKDAY_NAMES[idx],
            weekdayShort: WEEKDAY_SHORT[idx],
            isToday: dateStr === todayStr,
            isWeekend: idx >= 5
        };
    });
}

function formatRoleLabel(role?: UserRole | string): string {
    if (!role) return 'Liderança';
    if (role === UserRole.CHEFE || role === UserRole.PARCEIRO_CHEFE) return 'Chefe de Operações';
    if (role === UserRole.LIDER || role === UserRole.PARCEIRO_LIDER) return 'Líder de Campo';
    return String(role);
}

function formatDateTimeShort(isoString: string): string {
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '';
    }
}

export const WeeklyAgendaView: React.FC<WeeklyAgendaViewProps> = ({ currentUser }) => {
    const todayStr = useMemo(() => toLocalISODate(new Date()), []);
    const companyId = currentUser.companyId || 'internal';
    const isChief = currentUser.role === UserRole.CHEFE || currentUser.role === UserRole.PARCEIRO_CHEFE;

    // Navigation & View states
    const [referenceDate, setReferenceDate] = useState<string>(todayStr);
    const [viewMode, setViewMode] = useState<'week' | 'feed'>('week');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<AgendaCategory | 'ALL'>('ALL');
    const [selectedLeaderFilter, setSelectedLeaderFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Data states
    const [entries, setEntries] = useState<LeaderAgendaEntry[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companyUsers, setCompanyUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Modal / Editor states
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingEntry, setEditingEntry] = useState<LeaderAgendaEntry | null>(null);
    const [formDate, setFormDate] = useState<string>(todayStr);
    const [formTime, setFormTime] = useState<string>('');
    const [formCategory, setFormCategory] = useState<AgendaCategory>('DDS');
    const [formTitle, setFormTitle] = useState<string>('');
    const [formDescription, setFormDescription] = useState<string>('');
    const [formTeamIds, setFormTeamIds] = useState<string[]>([]);
    const [formTechIds, setFormTechIds] = useState<string[]>([]);
    const [formInitialComment, setFormInitialComment] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Comments states per entry
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
    const [submittingCommentFor, setSubmittingCommentFor] = useState<string | null>(null);
    const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

    // Compute current week days (Mon - Sun)
    const weekDays = useMemo(() => getWeekDays(referenceDate), [referenceDate]);
    const weekStartStr = weekDays[0].dateStr;
    const weekEndStr = weekDays[6].dateStr;

    const loadData = useCallback(async () => {
        try {
            const [fetchedEntries, fetchedTeams, fetchedUsers] = await Promise.all([
                getLeaderAgendaEntries(companyId),
                getTeams(companyId),
                getAllUsers(companyId)
            ]);
            setEntries(fetchedEntries);
            setTeams(fetchedTeams);
            setCompanyUsers(fetchedUsers);
        } catch (err) {
            console.error('Erro ao carregar Agenda Semanal:', err);
        } finally {
            setIsLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadData();
        const channel = subscribeToLeaderAgenda(companyId, () => {
            loadData();
        });
        return () => {
            channel.unsubscribe();
        };
    }, [companyId, loadData]);

    const technicians = useMemo(() => {
        return companyUsers.filter(
            u => u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO
        );
    }, [companyUsers]);

    // Filter entries for the selected week
    const weekEntries = useMemo(() => {
        return entries.filter(entry => {
            const inWeek = entry.date >= weekStartStr && entry.date <= weekEndStr;
            if (!inWeek) return false;

            if (selectedCategoryFilter !== 'ALL' && entry.category !== selectedCategoryFilter) {
                return false;
            }
            if (selectedLeaderFilter !== 'ALL' && entry.leaderId !== selectedLeaderFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = entry.title.toLowerCase().includes(q);
                const matchDesc = entry.description.toLowerCase().includes(q);
                const matchLeader = entry.leaderName.toLowerCase().includes(q);
                const matchTeams = (entry.teamNames || []).some(t => t.toLowerCase().includes(q));
                const matchTechs = (entry.technicianNames || []).some(t => t.toLowerCase().includes(q));
                const matchComments = (entry.comments || []).some(c => c.text.toLowerCase().includes(q));
                if (!matchTitle && !matchDesc && !matchLeader && !matchTeams && !matchTechs && !matchComments) {
                    return false;
                }
            }
            return true;
        });
    }, [entries, weekStartStr, weekEndStr, selectedCategoryFilter, selectedLeaderFilter, searchQuery]);

    // Group entries by date string (YYYY-MM-DD)
    const entriesByDate = useMemo(() => {
        const map: Record<string, LeaderAgendaEntry[]> = {};
        for (const day of weekDays) {
            map[day.dateStr] = [];
        }
        for (const entry of weekEntries) {
            if (!map[entry.date]) {
                map[entry.date] = [];
            }
            map[entry.date].push(entry);
        }
        // Sort each day's entries chronologically by time or creation
        Object.keys(map).forEach(dateKey => {
            map[dateKey].sort((a, b) => {
                const timeA = a.time || '23:59';
                const timeB = b.time || '23:59';
                if (timeA !== timeB) return timeA.localeCompare(timeB);
                return a.createdAt.localeCompare(b.createdAt);
            });
        });
        return map;
    }, [weekDays, weekEntries]);

    // Leaders list for filter dropdown
    const availableLeaders = useMemo(() => {
        const map = new Map<string, string>();
        entries.forEach(e => {
            if (e.leaderId && e.leaderName) {
                map.set(e.leaderId, e.leaderName);
            }
        });
        companyUsers
            .filter(
                u =>
                    u.role === UserRole.LIDER ||
                    u.role === UserRole.PARCEIRO_LIDER ||
                    u.role === UserRole.CHEFE ||
                    u.role === UserRole.PARCEIRO_CHEFE
            )
            .forEach(u => map.set(u.id, u.name));
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [entries, companyUsers]);

    // Week summary metrics
    const weekSummary = useMemo(() => {
        const total = weekEntries.length;
        const ddsCount = weekEntries.filter(e => e.category === 'DDS' || e.category === 'SAIDA_TARDIA').length;
        const highlightCount = weekEntries.filter(e => e.category === 'DESTAQUE_EQUIPE').length;
        const commentsCount = weekEntries.reduce((acc, e) => acc + (e.comments?.length || 0), 0);
        const daysWithNotes = new Set(weekEntries.map(e => e.date)).size;
        return { total, ddsCount, highlightCount, commentsCount, daysWithNotes };
    }, [weekEntries]);

    // Week navigation handlers
    const shiftWeek = (deltaWeeks: number) => {
        const monday = getMondayOfWeek(referenceDate);
        monday.setDate(monday.getDate() + deltaWeeks * 7);
        setReferenceDate(toLocalISODate(monday));
    };

    const goToCurrentWeek = () => {
        setReferenceDate(todayStr);
    };

    // Modal handlers
    const openCreateModal = (defaultDate?: string, preset?: QuickPreset) => {
        setEditingEntry(null);
        setFormDate(defaultDate || (referenceDate >= weekStartStr && referenceDate <= weekEndStr ? todayStr : weekStartStr));
        const nowTime = new Date().toTimeString().slice(0, 5);
        setFormTime(nowTime);
        setFormCategory(preset ? preset.category : 'DDS');
        setFormTitle(preset ? preset.title : '');
        setFormDescription(preset ? preset.description : '');
        setFormTeamIds([]);
        setFormTechIds([]);
        setFormInitialComment('');
        setIsModalOpen(true);
    };

    const openEditModal = (entry: LeaderAgendaEntry) => {
        setEditingEntry(entry);
        setFormDate(entry.date);
        setFormTime(entry.time || '');
        setFormCategory(entry.category);
        setFormTitle(entry.title);
        setFormDescription(entry.description);
        setFormTeamIds(entry.teamIds || []);
        setFormTechIds(entry.technicianIds || []);
        setFormInitialComment('');
        setIsModalOpen(true);
    };

    const applyPresetToForm = (preset: QuickPreset) => {
        setFormCategory(preset.category);
        setFormTitle(preset.title);
        setFormDescription(preset.description);
    };

    const toggleTeamSelection = (teamId: string) => {
        setFormTeamIds(prev =>
            prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
        );
    };

    const toggleTechSelection = (techId: string) => {
        setFormTechIds(prev =>
            prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]
        );
    };

    const handleSaveEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim() && !formDescription.trim()) return;

        setIsSaving(true);
        try {
            const selectedTeamNames = formTeamIds
                .map(id => teams.find(t => t.id === id)?.name)
                .filter((n): n is string => Boolean(n));

            const selectedTechNames = formTechIds
                .map(id => companyUsers.find(u => u.id === id)?.name)
                .filter((n): n is string => Boolean(n));

            const existingComments = editingEntry?.comments ? [...editingEntry.comments] : [];
            if (!editingEntry && formInitialComment.trim()) {
                existingComments.push({
                    id: `comment_${Date.now()}`,
                    authorId: currentUser.id,
                    authorName: currentUser.name,
                    authorRole: currentUser.role,
                    text: formInitialComment.trim(),
                    createdAt: new Date().toISOString()
                });
            }

            const finalTitle =
                formTitle.trim() ||
                AGENDA_CATEGORIES[formCategory].label;

            const saved = await saveLeaderAgendaEntry({
                id: editingEntry?.id,
                createdAt: editingEntry?.createdAt,
                date: formDate,
                time: formTime.trim() || undefined,
                leaderId: editingEntry ? editingEntry.leaderId : currentUser.id,
                leaderName: editingEntry ? editingEntry.leaderName : currentUser.name,
                leaderRole: editingEntry ? editingEntry.leaderRole : currentUser.role,
                companyId,
                category: formCategory,
                title: finalTitle,
                description: formDescription.trim() || finalTitle,
                teamIds: formTeamIds,
                teamNames: selectedTeamNames,
                technicianIds: formTechIds,
                technicianNames: selectedTechNames,
                comments: existingComments
            });

            setEntries(prev => {
                const idx = prev.findIndex(item => item.id === saved.id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = saved;
                    return updated;
                }
                return [saved, ...prev];
            });

            setIsModalOpen(false);
        } catch (err) {
            console.error('Erro ao salvar anotação na agenda:', err);
            alert('Não foi possível salvar o registro na agenda. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEntry = async (entry: LeaderAgendaEntry) => {
        if (!window.confirm(`Deseja realmente excluir o registro "${entry.title}"?`)) return;
        try {
            await deleteLeaderAgendaEntry(entry.id, companyId, currentUser.id);
            setEntries(prev => prev.filter(item => item.id !== entry.id));
        } catch (err) {
            console.error('Erro ao excluir registro da agenda:', err);
        }
    };

    const handleAddComment = async (entry: LeaderAgendaEntry) => {
        const text = (commentDrafts[entry.id] || '').trim();
        if (!text) return;

        setSubmittingCommentFor(entry.id);
        try {
            const newComment = await addLeaderAgendaComment(entry.id, companyId, {
                authorId: currentUser.id,
                authorName: currentUser.name,
                authorRole: currentUser.role,
                text
            });

            setEntries(prev =>
                prev.map(item => {
                    if (item.id !== entry.id) return item;
                    const existing = Array.isArray(item.comments) ? item.comments : [];
                    return {
                        ...item,
                        comments: [...existing, newComment]
                    };
                })
            );
            setCommentDrafts(prev => ({ ...prev, [entry.id]: '' }));
            setExpandedComments(prev => ({ ...prev, [entry.id]: true }));
        } catch (err) {
            console.error('Erro ao adicionar comentário:', err);
        } finally {
            setSubmittingCommentFor(null);
        }
    };

    const handleDeleteComment = async (entry: LeaderAgendaEntry, commentId: string) => {
        try {
            await deleteLeaderAgendaComment(entry.id, companyId, commentId, currentUser.id);
            setEntries(prev =>
                prev.map(item => {
                    if (item.id !== entry.id) return item;
                    return {
                        ...item,
                        comments: (item.comments || []).filter(c => c.id !== commentId)
                    };
                })
            );
        } catch (err) {
            console.error('Erro ao remover comentário:', err);
        }
    };

    const handleExportWeekExcel = async () => {
        const periodLabel = `${weekDays[0].dayNumber}/${weekDays[0].monthShort} a ${weekDays[6].dayNumber}/${weekDays[6].monthShort}`;
        const { workbook, worksheet, startRow } = await createEletromidiaWorkbook(
            `Diário Semanal dos Líderes (${periodLabel})`,
            'Agenda Semanal'
        );

        const headers = [
            'Data',
            'Dia da Semana',
            'Horário',
            'Categoria',
            'Líder Responsável',
            'Título / Resumo',
            'Descrição / O que aconteceu',
            'Equipes Envolvidas',
            'Técnicos Citados',
            'Comentários'
        ];

        worksheet.getRow(startRow).values = headers;

        let currentRow = startRow + 1;
        const sortedForExport = [...weekEntries].sort((a, b) => a.date.localeCompare(b.date));

        for (const entry of sortedForExport) {
            const dayObj = weekDays.find(d => d.dateStr === entry.date);
            const dateFormatted = entry.date.split('-').reverse().join('/');
            const commentsFormatted = (entry.comments || [])
                .map(c => `${c.authorName}: ${c.text}`)
                .join(' | ');

            worksheet.getRow(currentRow).values = [
                dateFormatted,
                dayObj?.weekdayName || '',
                entry.time || '-',
                AGENDA_CATEGORIES[entry.category]?.label || entry.category,
                entry.leaderName,
                entry.title,
                entry.description,
                (entry.teamNames || []).join(', ') || '-',
                (entry.technicianNames || []).join(', ') || '-',
                commentsFormatted || '-'
            ];
            currentRow++;
        }

        styleDataRows(worksheet, startRow);
        autoFitColumns(worksheet);
        await saveWorkbook(workbook, `agenda_semanal_lideres_${weekStartStr}_a_${weekEndStr}.xlsx`);
    };

    const renderEntryCard = (entry: LeaderAgendaEntry, showFullDate = false) => {
        const cat = AGENDA_CATEGORIES[entry.category] || AGENDA_CATEGORIES.GERAL;
        const CatIcon = cat.icon;
        const canModifyEntry = entry.leaderId === currentUser.id || isChief;
        const comments = entry.comments || [];
        const isCommentsOpen = expandedComments[entry.id] ?? comments.length > 0;
        const commentDraft = commentDrafts[entry.id] || '';

        return (
            <div
                key={entry.id}
                className="bg-white rounded-xl border border-[#E6E8EC]/90 p-4 shadow-sm hover:border-slate-300 transition-all"
            >
                {/* Top Meta Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cat.badgeBg} ${cat.badgeText} ${cat.badgeBorder}`}
                        >
                            <CatIcon size={12} />
                            {cat.label}
                        </span>

                        {entry.time && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 tabular-nums bg-slate-100 px-2 py-0.5 rounded-md">
                                <Clock size={11} />
                                {entry.time}
                            </span>
                        )}

                        {showFullDate && (
                            <span className="text-xs font-semibold text-slate-500 tabular-nums">
                                {entry.date.split('-').reverse().join('/')}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <span className="text-xs font-semibold text-slate-700">
                                {entry.leaderName}
                            </span>
                            <span className="hidden sm:inline-block text-[11px] text-slate-400 ml-1.5">
                                • {formatRoleLabel(entry.leaderRole)}
                            </span>
                        </div>

                        {canModifyEntry && (
                            <div className="flex items-center gap-1 pl-1 border-l border-[#E6E8EC]">
                                <button
                                    type="button"
                                    onClick={() => openEditModal(entry)}
                                    title="Editar registro"
                                    className="p-1.5 text-slate-400 hover:text-orange-600 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <Edit3 size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(entry)}
                                    title="Excluir registro"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Title & Description */}
                <h4 className="text-sm font-bold text-slate-900 mb-1 leading-snug">
                    {entry.title}
                </h4>
                <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                    {entry.description}
                </p>

                {/* Tagged Teams & Technicians */}
                {((entry.teamNames && entry.teamNames.length > 0) ||
                    (entry.technicianNames && entry.technicianNames.length > 0)) && (
                    <div className="mt-3 pt-2.5 border-t border-[#E6E8EC] flex flex-wrap items-center gap-1.5">
                        {entry.teamNames?.map((tName, idx) => (
                            <span
                                key={`team-${idx}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200/70"
                            >
                                <Users size={11} />
                                {tName}
                            </span>
                        ))}
                        {entry.technicianNames?.map((techName, idx) => (
                            <span
                                key={`tech-${idx}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700"
                            >
                                {techName}
                            </span>
                        ))}
                    </div>
                )}

                {/* Comments Section */}
                <div className="mt-3 pt-2.5 border-t border-[#E6E8EC]">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() =>
                                setExpandedComments(prev => ({
                                    ...prev,
                                    [entry.id]: !isCommentsOpen
                                }))
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <MessageSquare size={13} />
                            <span className="tabular-nums">
                                {comments.length === 0
                                    ? 'Adicionar comentário'
                                    : `${comments.length} ${comments.length === 1 ? 'comentário' : 'comentários'}`}
                            </span>
                        </button>
                    </div>

                    {isCommentsOpen && (
                        <div className="mt-2.5 space-y-2">
                            {comments.length > 0 && (
                                <div className="space-y-1.5">
                                    {comments.map(comment => {
                                        const canDeleteComment =
                                            comment.authorId === currentUser.id || isChief;
                                        return (
                                            <div
                                                key={comment.id}
                                                className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-[#E6E8EC]/60 flex items-start justify-between gap-2"
                                            >
                                                <div className="space-y-0.5 flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="font-bold text-slate-800">
                                                            {comment.authorName}
                                                        </span>
                                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600 font-medium">
                                                            {formatRoleLabel(comment.authorRole)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 tabular-nums">
                                                            {formatDateTimeShort(comment.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-700 break-words leading-relaxed">
                                                        {comment.text}
                                                    </p>
                                                </div>

                                                {canDeleteComment && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteComment(entry, comment.id)}
                                                        title="Remover comentário"
                                                        className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors shrink-0"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Inline Comment Input */}
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="text"
                                    value={commentDraft}
                                    onChange={e =>
                                        setCommentDrafts(prev => ({
                                            ...prev,
                                            [entry.id]: e.target.value
                                        }))
                                    }
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAddComment(entry);
                                        }
                                    }}
                                    placeholder="Escreva um comentário ou observação sobre este registro..."
                                    className="flex-1 text-xs bg-slate-50 border border-[#E6E8EC] rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                                />
                                <button
                                    type="button"
                                    disabled={!commentDraft.trim() || submittingCommentFor === entry.id}
                                    onClick={() => handleAddComment(entry)}
                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 transition-colors shrink-0"
                                >
                                    <Send size={12} />
                                    Comentar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-10">
            {/* Page Header */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                                <BookOpen className="text-orange-500 shrink-0" size={24} />
                                Diário Semanal dos Líderes
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Info size={12} />
                                Preenchimento livre e não obrigatório
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 max-w-3xl">
                            Espaço para registrar acontecimentos relevantes da semana — como <strong>DDS e saída mais tarde</strong>, <strong>equipes que tiveram ótimo desempenho</strong>, reuniões, alinhamentos ou observações de turno. Registre apenas quando houver algo a compartilhar.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={handleExportWeekExcel}
                            disabled={weekEntries.length === 0}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-[#E6E8EC] bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                        >
                            <Download size={15} />
                            Exportar Semana (.xlsx)
                        </button>

                        <button
                            type="button"
                            onClick={() => openCreateModal(todayStr)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition-colors"
                        >
                            <Plus size={18} />
                            Registrar na Agenda
                        </button>
                    </div>
                </div>

                {/* Quick Templates Bar */}
                <div className="mt-5 pt-4 border-t border-[#E6E8EC] flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 mr-1">
                        Registro rápido para hoje:
                    </span>
                    {QUICK_PRESETS.map((preset, idx) => {
                        const cat = AGENDA_CATEGORIES[preset.category];
                        const Icon = cat.icon;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => openCreateModal(todayStr, preset)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-[#E6E8EC]/80 transition-colors"
                            >
                                <Icon size={13} className="text-orange-500" />
                                {preset.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Week Controls & Filters Bar */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-4 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Week Navigator */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center rounded-xl border border-[#E6E8EC] bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => shiftWeek(-1)}
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-white transition-colors"
                                title="Semana anterior"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className="px-3 py-1 text-xs sm:text-sm font-bold text-slate-800 tabular-nums flex items-center gap-2">
                                <Calendar size={15} className="text-orange-500" />
                                <span>
                                    {weekDays[0].dayNumber} {weekDays[0].monthShort} — {weekDays[6].dayNumber} {weekDays[6].monthShort}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => shiftWeek(1)}
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-white transition-colors"
                                title="Próxima semana"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={goToCurrentWeek}
                            className="px-3 py-2 rounded-xl text-xs font-semibold border border-[#E6E8EC] text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            Semana Atual
                        </button>

                        <input
                            type="date"
                            value={referenceDate}
                            onChange={e => e.target.value && setReferenceDate(e.target.value)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium border border-[#E6E8EC] bg-white text-slate-700 tabular-nums"
                            title="Ir para uma data específica"
                        />
                    </div>

                    {/* Summary Counters & View Toggle */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-[#E6E8EC]/70 tabular-nums">
                            <span>
                                <strong className="text-slate-900">{weekSummary.total}</strong> registros na semana
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>
                                <strong className="text-emerald-600">{weekSummary.highlightCount}</strong> destaques
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>
                                <strong className="text-blue-600">{weekSummary.ddsCount}</strong> DDS / horários
                            </span>
                        </div>

                        <div className="inline-flex rounded-xl border border-[#E6E8EC] bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('week')}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    viewMode === 'week'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500'
                                }`}
                            >
                                <LayoutGrid size={14} />
                                Dias da Semana
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('feed')}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    viewMode === 'feed'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500'
                                }`}
                            >
                                <List size={14} />
                                Lista Contínua
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search & Category / Leader Filters */}
                <div className="pt-3 border-t border-[#E6E8EC] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Category Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                        <Filter size={14} className="text-slate-400 shrink-0 mr-1" />
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryFilter('ALL')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                                selectedCategoryFilter === 'ALL'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todas Categorias
                        </button>
                        {(Object.keys(AGENDA_CATEGORIES) as AgendaCategory[]).map(catKey => {
                            const cat = AGENDA_CATEGORIES[catKey];
                            const active = selectedCategoryFilter === catKey;
                            return (
                                <button
                                    key={catKey}
                                    type="button"
                                    onClick={() => setSelectedCategoryFilter(active ? 'ALL' : catKey)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                                        active
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${cat.dotColor}`} />
                                    {cat.shortLabel}
                                </button>
                            );
                        })}
                    </div>

                    {/* Leader Filter & Search */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <select
                            value={selectedLeaderFilter}
                            onChange={e => setSelectedLeaderFilter(e.target.value)}
                            className="text-xs bg-slate-50 border border-[#E6E8EC] rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-orange-500"
                        >
                            <option value="ALL">Todos os Líderes</option>
                            {availableLeaders.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </select>

                        <div className="relative flex-1 sm:w-60">
                            <Search
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar por equipe, DDS, líder..."
                                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-[#E6E8EC] rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div className="bg-white rounded-2xl border border-[#E6E8EC] p-12 text-center text-sm text-slate-500">
                    Carregando diário semanal...
                </div>
            ) : viewMode === 'week' ? (
                /* 7-Day Weekly Diary View */
                <div className="space-y-3">
                    {weekDays.map(day => {
                        const dayEntries = entriesByDate[day.dateStr] || [];
                        return (
                            <div
                                key={day.dateStr}
                                className={`rounded-2xl border transition-all ${
                                    day.isToday
                                        ? 'bg-orange-50/30 border-orange-300 shadow-sm'
                                        : 'bg-white border-[#E6E8EC]'
                                }`}
                            >
                                {/* Day Row Header */}
                                <div className="px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#E6E8EC]">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center tabular-nums border ${
                                                day.isToday
                                                    ? 'bg-orange-600 text-white border-orange-600 font-bold'
                                                    : day.isWeekend
                                                    ? 'bg-slate-100 text-slate-500 border-[#E6E8EC]'
                                                    : 'bg-slate-50 text-slate-800 border-[#E6E8EC]'
                                            }`}
                                        >
                                            <span className="text-[10px] uppercase leading-none opacity-80">
                                                {day.weekdayShort}
                                            </span>
                                            <span className="text-sm font-bold leading-tight mt-0.5">
                                                {day.dayNumber}
                                            </span>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                                    {day.weekdayName}
                                                </h3>
                                                {day.isToday && (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700">
                                                        Hoje
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-400 tabular-nums">
                                                    {day.dayNumber} de {day.monthShort}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {dayEntries.length === 0
                                                    ? 'Sem anotações — preenchimento opcional'
                                                    : `${dayEntries.length} ${
                                                          dayEntries.length === 1
                                                              ? 'registro lançado neste dia'
                                                              : 'registros lançados neste dia'
                                                      }`}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openCreateModal(day.dateStr)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-orange-600 text-slate-700 hover:text-white transition-colors"
                                    >
                                        <Plus size={14} />
                                        Anotar neste dia
                                    </button>
                                </div>

                                {/* Day Entries Content */}
                                {dayEntries.length > 0 ? (
                                    <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                                        {dayEntries.map(entry => renderEntryCard(entry, false))}
                                    </div>
                                ) : (
                                    <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                                        <span>
                                            Nenhum evento especial anotado neste dia (não é obrigatório preencher caso a operação tenha seguido a rotina normal).
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Continuous Feed View */
                <div className="space-y-3">
                    {weekEntries.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-[#E6E8EC] p-10 text-center space-y-3">
                            <p className="text-sm font-semibold text-slate-700">
                                Nenhuma anotação registrada nesta semana.
                            </p>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                O diário semanal não é obrigatório todos os dias. Quando houver DDS, equipe destaque, saída tardia ou qualquer evento importante, clique abaixo para deixar registrado.
                            </p>
                            <button
                                type="button"
                                onClick={() => openCreateModal(todayStr)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white transition-colors"
                            >
                                <Plus size={15} />
                                Criar Primeiro Registro da Semana
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {weekEntries.map(entry => renderEntryCard(entry, true))}
                        </div>
                    )}
                </div>
            )}

            {/* Create / Edit Entry Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl border border-[#E6E8EC] w-full max-w-2xl shadow-xl overflow-hidden my-8">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-[#E6E8EC] flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingEntry ? 'Editar Registro da Agenda' : 'Novo Registro no Diário Semanal'}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Registre DDS, saída tardia, equipes que foram destaque ou qualquer evento do dia.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEntry} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                            {/* Quick Presets inside Modal */}
                            {!editingEntry && (
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-slate-600">
                                        Modelos rápidos (opcional — clique para preencher):
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_PRESETS.map((preset, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => applyPresetToForm(preset)}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-[#E6E8EC] transition-colors"
                                            >
                                                + {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Date & Optional Time */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Data do Acontecimento *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formDate}
                                        onChange={e => setFormDate(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-[#E6E8EC] bg-slate-50 text-slate-900 tabular-nums focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Horário (Opcional — ex: saída da equipe)
                                    </label>
                                    <input
                                        type="time"
                                        value={formTime}
                                        onChange={e => setFormTime(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-[#E6E8EC] bg-slate-50 text-slate-900 tabular-nums focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            {/* Category Selector */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-2">
                                    Tipo de Registro *
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {(Object.keys(AGENDA_CATEGORIES) as AgendaCategory[]).map(catKey => {
                                        const cat = AGENDA_CATEGORIES[catKey];
                                        const Icon = cat.icon;
                                        const isSelected = formCategory === catKey;
                                        return (
                                            <button
                                                key={catKey}
                                                type="button"
                                                onClick={() => setFormCategory(catKey)}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-all ${
                                                    isSelected
                                                        ? `${cat.badgeBg} ${cat.badgeText} ${cat.badgeBorder} ring-2 ring-orange-500/30`
                                                        : 'bg-white text-slate-600 border-[#E6E8EC] hover:bg-slate-50'
                                                }`}
                                            >
                                                <Icon size={15} />
                                                <span className="truncate">{cat.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Título / Resumo Curto *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formTitle}
                                        onChange={e => setFormTitle(e.target.value)}
                                        placeholder={AGENDA_CATEGORIES[formCategory].placeholderTitle}
                                        className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-[#E6E8EC] bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Detalhes do que foi feito / Observações *
                                    </label>
                                    <textarea
                                        rows={4}
                                        required
                                        value={formDescription}
                                        onChange={e => setFormDescription(e.target.value)}
                                        placeholder={AGENDA_CATEGORIES[formCategory].placeholderDesc}
                                        className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-[#E6E8EC] bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            {/* Optional Team Selection */}
                            {teams.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Equipes envolvidas / citadas (Opcional)
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-[#E6E8EC]">
                                        {teams.map(team => {
                                            const active = formTeamIds.includes(team.id);
                                            return (
                                                <button
                                                    key={team.id}
                                                    type="button"
                                                    onClick={() => toggleTeamSelection(team.id)}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                                        active
                                                            ? 'bg-orange-600 text-white border-orange-600'
                                                            : 'bg-white text-slate-700 border-[#E6E8EC] hover:border-orange-400'
                                                    }`}
                                                >
                                                    {active && <Check size={12} />}
                                                    {team.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Optional Technician Selection */}
                            {technicians.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Técnicos de destaque / envolvidos (Opcional)
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-[#E6E8EC]">
                                        {technicians.map(tech => {
                                            const active = formTechIds.includes(tech.id);
                                            return (
                                                <button
                                                    key={tech.id}
                                                    type="button"
                                                    onClick={() => toggleTechSelection(tech.id)}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                                        active
                                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                                            : 'bg-white text-slate-700 border-[#E6E8EC] hover:border-emerald-400'
                                                    }`}
                                                >
                                                    {active && <Check size={12} />}
                                                    {tech.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Optional Initial Comment */}
                            {!editingEntry && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Comentário adicional (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formInitialComment}
                                        onChange={e => setFormInitialComment(e.target.value)}
                                        placeholder="Ex: Informado também ao coordenador do turno..."
                                        className="w-full px-3.5 py-2 rounded-xl text-xs border border-[#E6E8EC] bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            )}

                            {/* Modal Actions */}
                            <div className="pt-3 border-t border-[#E6E8EC] flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-sm disabled:opacity-50 transition-colors"
                                >
                                    <Check size={15} />
                                    {isSaving
                                        ? 'Salvando...'
                                        : editingEntry
                                        ? 'Salvar Alterações'
                                        : 'Salvar na Agenda'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
