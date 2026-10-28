
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, DailyReport, DailyActivity, Team, UserRole, Absence, Vehicle, OpecDevice } from '../types';
import { ACTIVITY_TYPES } from '../api/activityTypes';
import { getTeams, getAllUsers, getDailyReportByTeamAndDate, upsertDailyReport, createAbsence, getAbsences, deleteAbsence, getVehicles, getOpecDevices, getDailyReports, getDailyReportsForMonth, subscribeToDailyActivities, deleteDailyActivity, updateDailyActivityQuantity } from '../api/fieldManagerApi';
import { supabase } from '../api/supabaseClient';
import { ClipboardList, Users, Calendar, Plus, Save, History, X, AlertCircle, Download, Trash2, Car, Smartphone, Search, CheckCircle, Edit2, Clock, Unlock, Lock, Sun, Moon } from 'lucide-react';
import { createEletromidiaWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, saveWorkbook } from '../utils/excelExport';
import { resolveAbsenceShift, resolveUserShift } from '../utils/shiftUtils';

const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getYesterdayDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
};

const formatDateBR = (isoDate: string) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
};

interface Props {
    currentUser: User;
}

export const DailyReportView: React.FC<Props> = ({ currentUser }) => {
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);
    const [date, setDate] = useState<string>(getLocalDateString());
    const [isRetroactive, setIsRetroactive] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [opecDevices, setOpecDevices] = useState<OpecDevice[]>([]);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<Partial<DailyReport> | null>(null);
    const [selectedActivities, setSelectedActivities] = useState<DailyActivity[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [allDayReports, setAllDayReports] = useState<DailyReport[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isTechModalOpen, setIsTechModalOpen] = useState(false);
    const [techSearch, setTechSearch] = useState('');
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [isOpecModalOpen, setIsOpecModalOpen] = useState(false);
    const [opecSearch, setOpecSearch] = useState('');
    const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isExportingMonth, setIsExportingMonth] = useState(false);
    const [monthExportMode, setMonthExportMode] = useState<'consolidado' | 'separado' | 'diurno' | 'noturno'>('consolidado');
    const [isDayExportModalOpen, setIsDayExportModalOpen] = useState(false);
    const [dayExportMode, setDayExportMode] = useState<'consolidado' | 'separado' | 'diurno' | 'noturno'>('consolidado');
    const [isExportingDay, setIsExportingDay] = useState(false);
    const [isEditingReport, setIsEditingReport] = useState(false);
    const isEditingRef = useRef(false);

    // Determina o turno padrão com base no horário atual de Brasília:
    // Diurno: Seg-Qui 07:30-18:30, Sex 07:30-17:30 | Demais horários: Noturno
    const defaultShift = useMemo((): 'Diurno' | 'Noturno' => {
        const now = new Date();
        const day = now.getDay(); // 0=Dom, 1=Seg ... 5=Sex, 6=Sab
        const minutes = now.getHours() * 60 + now.getMinutes();
        const startDiurno = 7 * 60 + 30; // 07:30 = 450min
        if (day >= 1 && day <= 4) {
            // Seg a Qui: 07:30 até 18:30 (1110min)
            return minutes >= startDiurno && minutes <= 18 * 60 + 30 ? 'Diurno' : 'Noturno';
        }
        if (day === 5) {
            // Sexta: 07:30 até 17:30 (1050min)
            return minutes >= startDiurno && minutes <= 17 * 60 + 30 ? 'Diurno' : 'Noturno';
        }
        return 'Noturno';
    }, []);

    const isToday = useMemo(() => {
        return date === getLocalDateString();
    }, [date]);

    const isChief = currentUser.role === UserRole.CHEFE || currentUser.role === UserRole.PARCEIRO_CHEFE;
    // REGRA 2: Chefes e Líderes veem visualização consolidada
    const isLeaderOrChief = [UserRole.LIDER, UserRole.CHEFE, UserRole.PARCEIRO_LIDER, UserRole.PARCEIRO_CHEFE].includes(currentUser.role);
    // Permissão de edição: hoje, chefe ou lançamento retroativo ativado
    const canEdit = isToday || isChief || isRetroactive;


    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (date && !isEditingRef.current) {
            loadReport();
        }
    }, [selectedTeam, selectedTechnicianIds, date]);

    // REGRA 4: Realtime subscription para Live Feed
    useEffect(() => {
        if (isLeaderOrChief && date) {
            const channel = subscribeToDailyActivities(currentUser.companyId, date, (payload) => {
                // Quando uma nova atividade é inserida, recarrega os relatórios (se não estiver editando)
                if (payload.eventType === 'INSERT' && !isEditingRef.current) {
                    loadReport();
                }
            });

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [currentUser.companyId, date, isLeaderOrChief]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [teamsData, usersData, vehiclesData, opecData] = await Promise.all([
                getTeams(currentUser.companyId),
                getAllUsers(currentUser.companyId),
                getVehicles(currentUser.companyId),
                getOpecDevices(currentUser.companyId)
            ]);
            setTeams(teamsData);
            setUsers(usersData);
            setVehicles(vehiclesData);
            setOpecDevices(opecData);

            // If user is a leader, pre-select their team
            const userTeam = teamsData.find(t => t.leaderId === currentUser.id);
            if (userTeam) {
                setSelectedTeam(userTeam.id);
                setSelectedTechnicianIds(userTeam.technicianIds);
            }
        } catch (err) {
            console.error('Error loading initial data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            // Only fetch specific report if a team is selected OR specific technicians are selected
            // This prevents auto-loading "custom" reports when just entering the screen
            const shouldFetchSpecificReport = selectedTeam || selectedTechnicianIds.length > 0;

            const [reportData, companyReports] = await Promise.all([
                shouldFetchSpecificReport ? getDailyReportByTeamAndDate(
                    selectedTeam ? selectedTeam : null,
                    date,
                    selectedTeam ? undefined : selectedTechnicianIds,
                    currentUser.id,
                    currentUser.companyId
                ) : Promise.resolve(null),
                getDailyReports(currentUser.companyId, undefined, date)
            ]);

            setAllDayReports(companyReports);

            if (reportData) {
                setReport(reportData);
                setSelectedActivities(reportData.activities);
                if (!selectedTeam && reportData.technicianIds) {
                    setSelectedTechnicianIds(reportData.technicianIds);
                }
            } else {
                setReport({
                    date,
                    shift: defaultShift,
                    teamId: selectedTeam || undefined,
                    technicianIds: selectedTeam ? undefined : selectedTechnicianIds,
                    userId: currentUser.id,
                    companyId: currentUser.companyId,
                    activities: []
                });
                setSelectedActivities([]);
            }

            // Load absences for this date and team/techs
            const allAbsences = await getAbsences(currentUser.companyId);
            const reportTechIds = selectedTeam
                ? (teams.find(t => t.id === selectedTeam)?.technicianIds || [])
                : selectedTechnicianIds;

            const dayAbsences = allAbsences.filter(a => {
                const isTechInReport = reportTechIds.includes(a.employeeId);
                if (!isTechInReport) return false;
                const start = a.date;
                const end = a.endDate || a.date;
                return date >= start && date <= end;
            });
            setAbsences(dayAbsences);

        } catch (err) {
            console.error('Error loading report:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddActivity = (activityType: string) => {
        if (!canEdit) {
            alert('Edição bloqueada para esta data. Ative a opção de lançamento retroativo para preencher.');
            return;
        }

        // Verify if technicians are selected
        const currentTechs = selectedTeam
            ? (teams.find(t => t.id === selectedTeam)?.technicianIds || [])
            : selectedTechnicianIds;

        if (currentTechs.length === 0) {
            alert('Selecione os técnicos ou equipe antes de adicionar uma atividade.');
            return;
        }

        setSelectedActivities(prev => [
            ...prev,
            {
                activityType,
                quantity: 1,
                technicianIds: currentTechs,
                carPlate: report?.carPlate,   // Captura veículo atual
                opecId: report?.opecId,       // Captura OPEC atual
            }
        ]);
    };

    const handleDeleteActivity = async (index: number) => {
        if (!canEdit) {
            alert('Edição bloqueada para esta data. Ative a opção de lançamento retroativo para editar.');
            return;
        }

        const activityToDelete = selectedActivities[index];
        
        if (window.confirm(`Tem certeza que deseja excluir a atividade "${activityToDelete.activityType}"?`)) {
            // Se a atividade já tem ID, ela está no banco de dados e precisa ser excluída lá também
            if (activityToDelete.id) {
                try {
                    await deleteDailyActivity(activityToDelete.id);
                } catch (error) {
                    console.error('Erro ao excluir atividade:', error);
                    alert('Erro ao excluir a atividade. Tente novamente.');
                    return; // Não remove do estado se falhou no banco
                }
            }
            
            // Remove do estado local
            setSelectedActivities(prev => prev.filter((_, i) => i !== index));
        }
    };

    // Quantity change now needs index because we can have multiple of same type
    const handleQuantityChange = (index: number, quantity: number) => {
        if (!canEdit) {
            alert('Edição bloqueada para esta data. Ative a opção de lançamento retroativo para editar.');
            return;
        }
        setSelectedActivities(prev => prev.map((a, i) =>
            i === index ? { ...a, quantity: Math.max(1, quantity) } : a
        ));
    };


    const resetForm = () => {
        setSelectedTeam('');
        setSelectedTechnicianIds([]);
        setSelectedActivities([]);
        setIsEditingReport(false);
        isEditingRef.current = false;
        setReport({
            date,
            shift: defaultShift,
            teamId: undefined,
            technicianIds: undefined,
            userId: currentUser.id,
            companyId: currentUser.companyId,
            activities: [],
            carPlate: undefined,
            opecId: undefined,
            driverId: undefined,
            driverName: undefined,
            route: '',
            notes: ''
        });
        setAbsences([]);
    };

    const handleEditReport = (reportToEdit: DailyReport) => {
        // Seta ref ANTES de mudar state para o useEffect não disparar loadReport
        isEditingRef.current = true;

        if (!isToday && !isChief) {
            setIsRetroactive(true);
        }

        // Carrega o relatório existente no formulário para edição
        setReport(reportToEdit);
        setSelectedActivities(reportToEdit.activities);
        setIsEditingReport(true);

        if (reportToEdit.teamId) {
            setSelectedTeam(reportToEdit.teamId);
            setSelectedTechnicianIds([]);
        } else if (reportToEdit.technicianIds && reportToEdit.technicianIds.length > 0) {
            setSelectedTeam('');
            setSelectedTechnicianIds(reportToEdit.technicianIds);
        }

        // Scroll para o topo para o usuário ver o formulário
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async () => {
        if (!selectedTeam && selectedTechnicianIds.length === 0 && selectedActivities.length === 0) {
            alert('Adicione atividades ou selecione técnicos.');
            return;
        }

        const hasExternalActivities = selectedActivities.some(a => a.activityType !== 'Interno' && a.activityType !== '{Interno}');
        if (hasExternalActivities && (!report?.carPlate || !report?.opecId)) {
            alert('Seleção obrigatória: Por favor, selecione o VEÍCULO e o OPEC antes de salvar o relatório.');
            return;
        }

        setIsSaving(true);
        try {
            // No longer merging all activity technicians into the main report.
            // Activities retain their specific technicianIds, and the main report 
            // retains whatever was explicitly selected in the top form (team or specific techs).
            const reportToSave: Omit<DailyReport, 'id'> = {
                date,
                shift: report?.shift || defaultShift,
                userId: currentUser.id,
                teamId: selectedTeam || undefined,
                technicianIds: selectedTeam ? undefined : (selectedTechnicianIds.length > 0 ? selectedTechnicianIds : undefined),
                companyId: currentUser.companyId,
                activities: selectedActivities,
                carPlate: report?.carPlate,
                opecId: report?.opecId,
                driverId: report?.driverId,
                driverName: report?.driverName,
                route: report?.route,
                notes: report?.notes
            };

            await upsertDailyReport(reportToSave, report?.id);

            const isRetroactiveSave = !isToday;
            alert(isRetroactiveSave
                ? `Relatório retroativo salvo com sucesso para o dia ${formatDateBR(date)}!`
                : 'Relatório salvo com sucesso!');

            // Fix: Reset form instead of reloading the same report ID
            // This allows saving multiple reports for different teams/techs in the same day without overwriting
            resetForm();

            // Refresh the list of all reports for the day to show the new one in "Other Reports"
            const dailyReports = await getDailyReports(currentUser.companyId, undefined, date);
            setAllDayReports(dailyReports);

        } catch (err) {
            console.error('Error saving report:', err);
            alert('Erro ao salvar relatório.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddAbsence = async (employeeId: string, reason: string) => {
        if (!canEdit) {
            alert('Edição de ausências bloqueada para esta data. Ative a opção de lançamento retroativo.');
            return;
        }
        const employee = users.find(u => u.id === employeeId);
        if (!employee) return;

        try {
            await createAbsence({
                employeeId,
                employeeName: employee.name,
                date,
                reason: reason as any,
                shift: report?.shift || resolveUserShift(employeeId, users),
                companyId: currentUser.companyId
            });
            loadReport();
        } catch (err) {
            console.error('Error recording absence:', err);
        }
    };

    const handleDeleteAbsence = async (id: string) => {
        if (!canEdit) {
            alert('Remoção de ausências bloqueada para esta data. Ative a opção de lançamento retroativo.');
            return;
        }
        if (!confirm('Tem certeza que deseja remover esta falta?')) return;

        try {
            await deleteAbsence(id);
            loadReport();
        } catch (err) {
            console.error('Error deleting absence:', err);
            alert('Erro ao remover falta.');
        }
    };

    const populateAbsencesWorksheet = (
        ws: any,
        headerRowIndex: number,
        absencesList: Absence[]
    ) => {
        const headerRow = ws.getRow(headerRowIndex);
        headerRow.values = ['Data', 'Turno', 'Colaborador', 'Cargo', 'Motivo', 'Período', 'Observações', 'Comprovante'];
        styleHeaderRow(headerRow);

        absencesList.forEach(a => {
            const emp = users.find(u => u.id === a.employeeId || u.name === a.employeeName);
            const absShift = resolveAbsenceShift(a, users);
            ws.addRow([
                a.date,
                absShift === 'Noturno' ? 'Noturno (Noite)' : 'Diurno (Dia)',
                a.employeeName,
                emp?.role?.replace('PARCEIRO_', '') || 'Técnico',
                a.reason,
                a.endDate && a.endDate !== a.date ? `${a.date} até ${a.endDate}` : a.date,
                a.description || '',
                a.evidenceUrl ? 'SIM' : 'NÃO'
            ]);
        });

        styleDataRows(ws, headerRowIndex);
        autoFitColumns(ws);
    };

    const populateActivitiesWorksheet = (
        ws: any,
        headerRowIndex: number,
        reportsList: DailyReport[],
        maxTechsCount: number
    ) => {
        const activitiesHeader = ['Data', 'Turno', 'Veículo', 'OPEC', 'Motorista'];
        const techHeaderCount = Math.max(maxTechsCount - 1, 3);
        for (let i = 2; i <= techHeaderCount + 1; i++) {
            activitiesHeader.push(`Técnico ${i}`);
        }
        activitiesHeader.push('Líder Responsável', 'Rota', 'Tipo de Atividade', 'Quantidade', 'Observações');

        const headerRow = ws.getRow(headerRowIndex);
        headerRow.values = activitiesHeader;
        styleHeaderRow(headerRow);

        reportsList.forEach((r) => {
            const fallbackCarInfo = vehicles.find(v => v.plate === r.carPlate);
            const fallbackOpecInfo = opecDevices.find(o => o.id === r.opecId);

            r.activities.forEach((a) => {
                const activityCarInfo = a.carPlate ? vehicles.find(v => v.plate === a.carPlate) : fallbackCarInfo;
                const activityOpecInfo = a.opecId ? opecDevices.find(o => o.id === a.opecId) : fallbackOpecInfo;

                const leaderName = a.liderName || users.find(u => u.id === r.userId)?.name || 'Desconhecido';
                const driverName = r.driverName || 'N/A';

                const rowData: (string | number)[] = [
                    r.date,
                    r.shift || 'Diurno',
                    activityCarInfo ? `${activityCarInfo.model} (${activityCarInfo.plate})` : '',
                    activityOpecInfo ? `${activityOpecInfo.assetCode}` : '',
                    driverName
                ];

                const techList: string[] = [];
                if (a.technicianIds && a.technicianIds.length > 0) {
                    a.technicianIds.forEach(tid => {
                        if (tid !== r.driverId) {
                            const techName = users.find(u => u.id === tid)?.name || 'Desconhecido';
                            techList.push(techName);
                        }
                    });
                } else {
                    techList.push('Equipe Completa');
                }

                for (let i = 0; i < techHeaderCount; i++) {
                    rowData.push(techList[i] || '');
                }

                rowData.push(
                    leaderName,
                    r.route || '',
                    a.activityType,
                    a.quantity,
                    r.notes || ''
                );

                ws.addRow(rowData);
            });
        });

        styleDataRows(ws, headerRowIndex);
        autoFitColumns(ws);
    };

    const buildDailyWorkbook = async (
        reportsList: DailyReport[],
        absencesList: Absence[],
        shiftTitle: string,
        teamName: string,
        includeShiftTabs: boolean
    ) => {
        const participantIds = new Set<string>();
        let maxTechs = 0;

        reportsList.forEach(r => {
            if (r.teamId) {
                const team = teams.find(t => t.id === r.teamId);
                team?.technicianIds.forEach(id => participantIds.add(id));
                if (team?.leaderId) participantIds.add(team.leaderId);
            }
            if (r.technicianIds) {
                r.technicianIds.forEach(id => participantIds.add(id));
            }
            r.activities.forEach(a => {
                a.technicianIds?.forEach(tid => participantIds.add(tid));
                maxTechs = Math.max(maxTechs, a.technicianIds?.length || 0);
            });
            if (r.userId) participantIds.add(r.userId);
        });

        const participants = users.filter(u => participantIds.has(u.id));
        const currentCarInfo = vehicles.find(v => v.plate === report?.carPlate);
        const currentOpecInfo = opecDevices.find(o => o.id === report?.opecId);

        const { workbook, worksheet: wsActivities, startRow } = await createEletromidiaWorkbook(
            `Relatório Diário (${shiftTitle}) - ${date}`,
            'Atividades'
        );

        // --- SHEET 1: ATIVIDADES ---
        populateActivitiesWorksheet(wsActivities, startRow, reportsList, maxTechs);

        // --- ABAS SEPARADAS POR TURNO (QUANDO CONSOLIDADO) ---
        const diurnoList = reportsList.filter(r => (r.shift || 'Diurno') !== 'Noturno');
        const noturnoList = reportsList.filter(r => r.shift === 'Noturno');
        const diurnoAbsList = absencesList.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
        const noturnoAbsList = absencesList.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

        if (includeShiftTabs) {
            const wsDiurno = workbook.addWorksheet('Atividades - Dia (Diurno)');
            populateActivitiesWorksheet(wsDiurno, 1, diurnoList, maxTechs);

            const wsNoturno = workbook.addWorksheet('Atividades - Noite (Noturno)');
            populateActivitiesWorksheet(wsNoturno, 1, noturnoList, maxTechs);
        }

        // --- SHEET: FALTAS E AUSÊNCIAS ---
        const wsAbsences = workbook.addWorksheet('Faltas e Ausências');
        populateAbsencesWorksheet(wsAbsences, 1, absencesList);

        if (includeShiftTabs) {
            const wsAbsDia = workbook.addWorksheet('Faltas - Dia (Diurno)');
            populateAbsencesWorksheet(wsAbsDia, 1, diurnoAbsList);

            const wsAbsNoite = workbook.addWorksheet('Faltas - Noite (Noturno)');
            populateAbsencesWorksheet(wsAbsNoite, 1, noturnoAbsList);
        }

        // --- SHEET: PARTICIPANTES ---
        const wsMembers = workbook.addWorksheet('Participantes');
        const membersHeader = ['Nome', 'Função', 'Turno(s)', 'Status'];
        const mHeaderRow = wsMembers.getRow(1);
        mHeaderRow.values = membersHeader;
        styleHeaderRow(mHeaderRow);

        participants.forEach(m => {
            const absence = absencesList.find(a => a.employeeId === m.id);
            const isDriver = reportsList.some(r => r.driverId === m.id);
            const memberShifts = new Set<string>();
            reportsList.forEach(r => {
                const inReport =
                    r.userId === m.id ||
                    r.driverId === m.id ||
                    r.technicianIds?.includes(m.id) ||
                    r.activities.some(a => a.technicianIds?.includes(m.id));
                if (inReport) {
                    memberShifts.add(r.shift || 'Diurno');
                }
            });

            wsMembers.addRow([
                m.name,
                m.role.replace('PARCEIRO_', '') + (isDriver ? ' (Motorista)' : ''),
                Array.from(memberShifts).join(' / ') || shiftTitle,
                absence ? `AUSENTE: ${absence.reason}` : 'PRESENTE'
            ]);
        });

        styleDataRows(wsMembers, 1);
        autoFitColumns(wsMembers);

        // --- SHEET: RESUMO ---
        const wsSummary = workbook.addWorksheet('Resumo');
        const summaryHeader = ['Campo', 'Valor'];
        const sHeaderRow = wsSummary.getRow(1);
        sHeaderRow.values = summaryHeader;
        styleHeaderRow(sHeaderRow);

        const diurnoActivitiesCount = diurnoList.reduce((acc, r) => acc + r.activities.length, 0);
        const diurnoQuantityCount = diurnoList.reduce((acc, r) => acc + r.activities.reduce((sum, a) => sum + a.quantity, 0), 0);
        const noturnoActivitiesCount = noturnoList.reduce((acc, r) => acc + r.activities.length, 0);
        const noturnoQuantityCount = noturnoList.reduce((acc, r) => acc + r.activities.reduce((sum, a) => sum + a.quantity, 0), 0);

        const summaryData: (string | number)[][] = [
            ['Data', date],
            ['Turno Exportado', shiftTitle],
            ['Equipe/Referência', teamName],
            ['Veículo (Principal)', currentCarInfo ? `${currentCarInfo.model} (${currentCarInfo.plate})` : 'N/A'],
            ['OPEC (Principal)', currentOpecInfo ? `${currentOpecInfo.assetCode} - ${currentOpecInfo.model}` : 'N/A'],
            ['Motorista da Equipe', report?.driverName || 'N/A'],
            ['Total de Lançamentos (Geral)', reportsList.reduce((acc, r) => acc + r.activities.length, 0)],
            ['Total de Peças/Qtd (Geral)', reportsList.reduce((acc, r) => acc + r.activities.reduce((sum, a) => sum + a.quantity, 0), 0)],
            ['Lançamentos - Dia (Diurno)', diurnoActivitiesCount],
            ['Peças/Qtd - Dia (Diurno)', diurnoQuantityCount],
            ['Lançamentos - Noite (Noturno)', noturnoActivitiesCount],
            ['Peças/Qtd - Noite (Noturno)', noturnoQuantityCount],
            ['Relatórios Consolidados', reportsList.length],
            ['Participantes Únicos', participants.length],
            ['Ausências Registradas (Total)', absencesList.length],
            ['Ausências - Dia (Diurno)', diurnoAbsList.length],
            ['Ausências - Noite (Noturno)', noturnoAbsList.length],
            ['Rota', report?.route || ''],
            ['Observação', report?.notes || '']
        ];

        summaryData.forEach(row => wsSummary.addRow(row));
        styleDataRows(wsSummary, 1);
        autoFitColumns(wsSummary);

        return workbook;
    };

    const handleExportExcel = async (modeOverride?: 'consolidado' | 'separado' | 'diurno' | 'noturno') => {
        const mode = modeOverride || dayExportMode;
        const teamName = selectedTeam
            ? teams.find(t => t.id === selectedTeam)?.name || 'Equipe'
            : 'Equipe Personalizada';
        const safeTeamName = teamName.replace(/\s/g, '_');

        const diurnoReports = allDayReports.filter(r => (r.shift || 'Diurno') !== 'Noturno');
        const noturnoReports = allDayReports.filter(r => r.shift === 'Noturno');
        const diurnoAbsences = absences.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
        const noturnoAbsences = absences.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

        setIsExportingDay(true);
        try {
            if (mode === 'diurno') {
                if (!diurnoReports.some(r => r.activities.length > 0) && diurnoAbsences.length === 0) {
                    alert('Nenhuma atividade ou falta registrada no turno Diurno (Dia) para esta data.');
                    return;
                }
                const wb = await buildDailyWorkbook(diurnoReports, diurnoAbsences, 'Diurno (Dia)', teamName, false);
                await saveWorkbook(wb, `Relatorio_Dia_Diurno_${date}_${safeTeamName}`);
            } else if (mode === 'noturno') {
                if (!noturnoReports.some(r => r.activities.length > 0) && noturnoAbsences.length === 0) {
                    alert('Nenhuma atividade ou falta registrada no turno Noturno (Noite) para esta data.');
                    return;
                }
                const wb = await buildDailyWorkbook(noturnoReports, noturnoAbsences, 'Noturno (Noite)', teamName, false);
                await saveWorkbook(wb, `Relatorio_Noite_Noturno_${date}_${safeTeamName}`);
            } else if (mode === 'separado') {
                const wbDia = await buildDailyWorkbook(diurnoReports, diurnoAbsences, 'Diurno (Dia)', teamName, false);
                await saveWorkbook(wbDia, `Relatorio_Dia_Diurno_${date}_${safeTeamName}`);

                await new Promise(resolve => setTimeout(resolve, 350));

                const wbNoite = await buildDailyWorkbook(noturnoReports, noturnoAbsences, 'Noturno (Noite)', teamName, false);
                await saveWorkbook(wbNoite, `Relatorio_Noite_Noturno_${date}_${safeTeamName}`);
            } else {
                const wb = await buildDailyWorkbook(allDayReports, absences, 'Consolidado (Dia e Noite)', teamName, true);
                await saveWorkbook(wb, `Relatorio_${date}_${safeTeamName}`);
            }
            setIsDayExportModalOpen(false);
        } catch (err) {
            console.error('Error exporting daily report:', err);
            alert('Erro ao exportar relatório diário.');
        } finally {
            setIsExportingDay(false);
        }
    };

    const buildMonthlyWorkbook = async (
        reportsList: DailyReport[],
        monthAbsences: Absence[],
        monthName: string,
        startDate: string,
        endDate: string,
        shiftLabel: string,
        includeShiftTabs: boolean
    ) => {
        const participantIds = new Set<string>();
        let maxTechs = 0;

        reportsList.forEach(r => {
            if (r.teamId) {
                const team = teams.find(t => t.id === r.teamId);
                team?.technicianIds.forEach(id => participantIds.add(id));
                if (team?.leaderId) participantIds.add(team.leaderId);
            }
            if (r.technicianIds) {
                r.technicianIds.forEach(id => participantIds.add(id));
            }
            r.activities.forEach(a => {
                a.technicianIds?.forEach(tid => participantIds.add(tid));
                maxTechs = Math.max(maxTechs, a.technicianIds?.length || 0);
            });
            if (r.userId) participantIds.add(r.userId);
        });

        const participants = users.filter(u => participantIds.has(u.id));

        const { workbook, worksheet: wsActivities, startRow } = await createEletromidiaWorkbook(
            `Relatório Mensal (${shiftLabel}) - ${monthName}/${selectedYear}`,
            'Atividades'
        );

        // --- SHEET 1: ATIVIDADES ---
        populateActivitiesWorksheet(wsActivities, startRow, reportsList, maxTechs);

        const diurnoList = reportsList.filter(r => (r.shift || 'Diurno') !== 'Noturno');
        const noturnoList = reportsList.filter(r => r.shift === 'Noturno');
        const diurnoMonthAbs = monthAbsences.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
        const noturnoMonthAbs = monthAbsences.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

        if (includeShiftTabs) {
            const wsDiurno = workbook.addWorksheet('Atividades - Dia (Diurno)');
            populateActivitiesWorksheet(wsDiurno, 1, diurnoList, maxTechs);

            const wsNoturno = workbook.addWorksheet('Atividades - Noite (Noturno)');
            populateActivitiesWorksheet(wsNoturno, 1, noturnoList, maxTechs);
        }

        // --- SHEET: FALTAS E AUSÊNCIAS ---
        const wsAbsences = workbook.addWorksheet('Faltas e Ausências');
        populateAbsencesWorksheet(wsAbsences, 1, monthAbsences);

        if (includeShiftTabs) {
            const wsAbsDia = workbook.addWorksheet('Faltas - Dia (Diurno)');
            populateAbsencesWorksheet(wsAbsDia, 1, diurnoMonthAbs);

            const wsAbsNoite = workbook.addWorksheet('Faltas - Noite (Noturno)');
            populateAbsencesWorksheet(wsAbsNoite, 1, noturnoMonthAbs);
        }

        // --- SHEET: RESUMO DIÁRIO ---
        const wsDailySummary = workbook.addWorksheet('Resumo Diário');
        const dailyHeader = [
            'Data',
            'Relatórios (Dia)',
            'Qtd Peças (Dia)',
            'Relatórios (Noite)',
            'Qtd Peças (Noite)',
            'Total Relatórios',
            'Total Lançamentos',
            'Total Quantidade',
            'Ausências (Dia)',
            'Ausências (Noite)',
            'Total Ausências'
        ];
        const dHeaderRow = wsDailySummary.getRow(1);
        dHeaderRow.values = dailyHeader;
        styleHeaderRow(dHeaderRow);

        const dailyData = new Map<string, {
            reportsDia: number;
            qtyDia: number;
            reportsNoite: number;
            qtyNoite: number;
            reports: number;
            activities: number;
            quantity: number;
            absencesDia: number;
            absencesNoite: number;
            absences: number;
        }>();

        reportsList.forEach(r => {
            const current = dailyData.get(r.date) || {
                reportsDia: 0,
                qtyDia: 0,
                reportsNoite: 0,
                qtyNoite: 0,
                reports: 0,
                activities: 0,
                quantity: 0,
                absencesDia: 0,
                absencesNoite: 0,
                absences: 0
            };
            const reportQty = r.activities.reduce((sum, a) => sum + a.quantity, 0);
            if (r.shift === 'Noturno') {
                current.reportsNoite += 1;
                current.qtyNoite += reportQty;
            } else {
                current.reportsDia += 1;
                current.qtyDia += reportQty;
            }
            current.reports += 1;
            current.activities += r.activities.length;
            current.quantity += reportQty;
            dailyData.set(r.date, current);
        });

        monthAbsences.forEach(a => {
            if (a.date >= startDate && a.date <= endDate) {
                const current = dailyData.get(a.date) || {
                    reportsDia: 0,
                    qtyDia: 0,
                    reportsNoite: 0,
                    qtyNoite: 0,
                    reports: 0,
                    activities: 0,
                    quantity: 0,
                    absencesDia: 0,
                    absencesNoite: 0,
                    absences: 0
                };
                if (resolveAbsenceShift(a, users) === 'Noturno') {
                    current.absencesNoite += 1;
                } else {
                    current.absencesDia += 1;
                }
                current.absences += 1;
                dailyData.set(a.date, current);
            }
        });

        Array.from(dailyData.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([d, data]) => {
                wsDailySummary.addRow([
                    d,
                    data.reportsDia,
                    data.qtyDia,
                    data.reportsNoite,
                    data.qtyNoite,
                    data.reports,
                    data.activities,
                    data.quantity,
                    data.absencesDia,
                    data.absencesNoite,
                    data.absences
                ]);
            });

        styleDataRows(wsDailySummary, 1);
        autoFitColumns(wsDailySummary);

        // --- SHEET: RESUMO MENSAL ---
        const wsSummary = workbook.addWorksheet('Resumo Mensal');
        const summaryHeader = ['Campo', 'Valor'];
        const sHeaderRow = wsSummary.getRow(1);
        sHeaderRow.values = summaryHeader;
        styleHeaderRow(sHeaderRow);

        const totalActivities = reportsList.reduce((acc, r) => acc + r.activities.length, 0);
        const totalQuantity = reportsList.reduce((acc, r) => acc + r.activities.reduce((sum, a) => sum + a.quantity, 0), 0);
        const diurnoActivities = diurnoList.reduce((acc, r) => acc + r.activities.length, 0);
        const diurnoQuantity = diurnoList.reduce((acc, r) => acc + r.activities.reduce((sum, a) => sum + a.quantity, 0), 0);
        const noturnoActivities = noturnoList.reduce((acc, r) => acc + r.activities.length, 0);
        const noturnoQuantity = noturnoList.reduce((acc, r) => acc + r.activities.reduce((sum, a) => sum + a.quantity, 0), 0);
        const uniqueDays = new Set(reportsList.map(r => r.date)).size;

        const summaryData = [
            ['Período', `${monthName}/${selectedYear}`],
            ['Turno Exportado', shiftLabel],
            ['Dias com Atividade', uniqueDays],
            ['Total de Relatórios (Geral)', reportsList.length],
            ['Total de Lançamentos (Geral)', totalActivities],
            ['Total de Peças/Quantidade (Geral)', totalQuantity],
            ['Relatórios - Dia (Diurno)', diurnoList.length],
            ['Lançamentos - Dia (Diurno)', diurnoActivities],
            ['Peças/Quantidade - Dia (Diurno)', diurnoQuantity],
            ['Relatórios - Noite (Noturno)', noturnoList.length],
            ['Lançamentos - Noite (Noturno)', noturnoActivities],
            ['Peças/Quantidade - Noite (Noturno)', noturnoQuantity],
            ['Participantes Únicos', participants.length],
            ['Total de Ausências (Geral)', monthAbsences.length],
            ['Ausências - Dia (Diurno)', diurnoMonthAbs.length],
            ['Ausências - Noite (Noturno)', noturnoMonthAbs.length]
        ];

        summaryData.forEach(row => wsSummary.addRow(row));
        styleDataRows(wsSummary, 1);
        autoFitColumns(wsSummary);

        return workbook;
    };

    const handleExportMonthlyExcel = async () => {
        setIsExportingMonth(true);
        try {
            // Fetch all reports for the selected month
            const monthReports = await getDailyReportsForMonth(currentUser.companyId, selectedYear, selectedMonth);

            const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
            const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            // Fetch absences for the month (with error handling in case table doesn't exist)
            let monthAbsences: Absence[] = [];
            try {
                const allAbsences = await getAbsences(currentUser.companyId);
                monthAbsences = allAbsences.filter(a => {
                    const start = a.date;
                    const end = a.endDate || a.date;
                    return start <= endDate && end >= startDate;
                });
            } catch (absenceError) {
                console.warn('Could not fetch absences, continuing without them:', absenceError);
            }

            if (monthReports.length === 0 && monthAbsences.length === 0) {
                alert('Nenhum relatório ou falta encontrado para o mês selecionado.');
                setIsExportingMonth(false);
                return;
            }

            // Month names in Portuguese
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const monthName = monthNames[selectedMonth - 1];

            const diurnoMonthReports = monthReports.filter(r => (r.shift || 'Diurno') !== 'Noturno');
            const noturnoMonthReports = monthReports.filter(r => r.shift === 'Noturno');
            const diurnoMonthAbsences = monthAbsences.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
            const noturnoMonthAbsences = monthAbsences.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

            if (monthExportMode === 'diurno') {
                if (diurnoMonthReports.length === 0 && diurnoMonthAbsences.length === 0) {
                    alert('Nenhum relatório ou falta do turno Diurno (Dia) encontrado para o mês selecionado.');
                    setIsExportingMonth(false);
                    return;
                }
                const wb = await buildMonthlyWorkbook(diurnoMonthReports, diurnoMonthAbsences, monthName, startDate, endDate, 'Diurno (Dia)', false);
                await saveWorkbook(wb, `Relatorio_Mensal_Dia_Diurno_${monthName}_${selectedYear}`);
            } else if (monthExportMode === 'noturno') {
                if (noturnoMonthReports.length === 0 && noturnoMonthAbsences.length === 0) {
                    alert('Nenhum relatório ou falta do turno Noturno (Noite) encontrado para o mês selecionado.');
                    setIsExportingMonth(false);
                    return;
                }
                const wb = await buildMonthlyWorkbook(noturnoMonthReports, noturnoMonthAbsences, monthName, startDate, endDate, 'Noturno (Noite)', false);
                await saveWorkbook(wb, `Relatorio_Mensal_Noite_Noturno_${monthName}_${selectedYear}`);
            } else if (monthExportMode === 'separado') {
                const wbDia = await buildMonthlyWorkbook(diurnoMonthReports, diurnoMonthAbsences, monthName, startDate, endDate, 'Diurno (Dia)', false);
                await saveWorkbook(wbDia, `Relatorio_Mensal_Dia_Diurno_${monthName}_${selectedYear}`);

                await new Promise(resolve => setTimeout(resolve, 350));

                const wbNoite = await buildMonthlyWorkbook(noturnoMonthReports, noturnoMonthAbsences, monthName, startDate, endDate, 'Noturno (Noite)', false);
                await saveWorkbook(wbNoite, `Relatorio_Mensal_Noite_Noturno_${monthName}_${selectedYear}`);
            } else {
                const wb = await buildMonthlyWorkbook(monthReports, monthAbsences, monthName, startDate, endDate, 'Consolidado (Dia e Noite)', true);
                await saveWorkbook(wb, `Relatorio_Mensal_${monthName}_${selectedYear}`);
            }

            setIsMonthModalOpen(false);
        } catch (err) {
            console.error('Error exporting monthly report:', err);
            alert('Erro ao exportar relatório mensal.');
        } finally {
            setIsExportingMonth(false);
        }
    };

    const teamMembers = useMemo(() => {
        if (selectedTeam) {
            const team = teams.find(t => t.id === selectedTeam);
            if (!team) return [];
            return users.filter(u => team.technicianIds.includes(u.id) || u.id === team.leaderId);
        } else {
            return users.filter(u => selectedTechnicianIds.includes(u.id));
        }
    }, [selectedTeam, selectedTechnicianIds, teams, users]);

    useEffect(() => {
        if (report?.driverId && teamMembers.length > 0) {
            const driverExists = teamMembers.some(m => m.id === report.driverId);
            if (!driverExists) {
                setReport(prev => ({
                    ...prev,
                    driverId: undefined,
                    driverName: undefined
                }));
            }
        }
    }, [teamMembers, report?.driverId]);

    const handleToggleTechnician = (techId: string) => {
        setSelectedTechnicianIds(prev => {
            if (prev.includes(techId)) {
                return prev.filter(id => id !== techId);
            } else {
                // Limit to maximum 4 team members
                if (prev.length >= 4) {
                    alert('Máximo de 4 membros de equipe permitidos no relatório diário.');
                    return prev;
                }
                return [...prev, techId];
            }
        });
        if (selectedTeam) setSelectedTeam('');
    };

    const hasActivitiesInDay = useMemo(() => {
        return allDayReports.some(r => r.activities && r.activities.length > 0);
    }, [allDayReports]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[20px] border border-[#E6E8EC] shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                        <ClipboardList className="text-primary" />
                        Relatório Diário
                    </h2>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Controle de atividades e presenças</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-[#E6E8EC]">
                        <Calendar size={18} className="text-slate-400 ml-2" />
                        <input
                            type="date"
                            value={date}
                            onChange={e => {
                                const newDate = e.target.value;
                                setDate(newDate);
                                if (newDate === getLocalDateString()) {
                                    setIsRetroactive(false);
                                }
                            }}
                            max={getLocalDateString()}
                            className="bg-transparent border-none font-black text-slate-700 outline-none p-1 text-sm"
                        />
                    </div>

                    {/* Botão de Atalho para Lançar Ontem */}
                    <button
                        type="button"
                        onClick={() => {
                            const yesterday = getYesterdayDateString();
                            setDate(yesterday);
                            setIsRetroactive(true);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl font-black text-xs transition-all border ${
                            date === getYesterdayDateString() && isRetroactive
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                        }`}
                        title="Preencher relatório referente ao dia de ontem com lançamento retroativo"
                    >
                        <Clock size={14} />
                        Ontem
                    </button>

                    {/* Toggle rápido de modo retroativo se estiver em data passada */}
                    {!isToday && !isChief && (
                        <button
                            type="button"
                            onClick={() => setIsRetroactive(!isRetroactive)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl font-black text-xs transition-all border ${
                                isRetroactive
                                    ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                                    : 'bg-slate-50 border-[#E6E8EC] text-slate-500 hover:border-slate-300'
                            }`}
                            title={isRetroactive ? 'Clique para bloquear edição retroativa' : 'Clique para habilitar edição retroativa'}
                        >
                            {isRetroactive ? <Unlock size={14} className="text-amber-600" /> : <Lock size={14} className="text-slate-400" />}
                            <span>{isRetroactive ? 'Retroativo Ativo' : 'Leitura'}</span>
                        </button>
                    )}

                    {/* Seletor de Turno: Diurno / Noturno */}
                    <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-[#E6E8EC]">
                        <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setReport(prev => ({ ...prev, shift: 'Diurno' }))}
                            title="Diurno: Seg-Qui 07:30 às 18:30 | Sex 07:30 às 17:30"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${(report?.shift || defaultShift) === 'Diurno'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                } disabled:opacity-50`}
                        >
                            <Sun size={14} />
                            Diurno
                        </button>
                        <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setReport(prev => ({ ...prev, shift: 'Noturno' }))}
                            title="Noturno: Após 18:30 (Seg-Qui) ou após 17:30 (Sex)"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${(report?.shift || defaultShift) === 'Noturno'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                } disabled:opacity-50`}
                        >
                            <Moon size={14} />
                            Noturno
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-[#E6E8EC]">
                        <Users size={18} className="text-slate-400 ml-2" />
                        <select
                            value={selectedTeam}
                            onChange={e => setSelectedTeam(e.target.value)}
                            className="bg-transparent border-none font-black text-slate-700 outline-none p-1 text-sm min-w-[150px]"
                        >
                            <option value="">Selecionar Equipe</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={() => { setSelectedTeam(''); setIsTechModalOpen(true); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-xs transition-all border ${!selectedTeam && selectedTechnicianIds.length > 0
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-slate-50 border-[#E6E8EC] text-slate-500 hover:border-slate-300'
                            }`}
                    >
                        <Plus size={14} />
                        {selectedTechnicianIds.length > 0 && !selectedTeam
                            ? `${selectedTechnicianIds.length} Técnicos`
                            : 'Personalizar'}
                    </button>

                    {teamMembers.length > 0 && (
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-[#E6E8EC] animate-in fade-in slide-in-from-top-1 duration-200">
                            <span className="text-[10px] font-black text-slate-400 uppercase ml-2">Motorista</span>
                            <select
                                value={report?.driverId || ''}
                                onChange={e => {
                                    const selectedId = e.target.value;
                                    const selectedName = users.find(u => u.id === selectedId)?.name || '';
                                    setReport(prev => ({
                                        ...prev,
                                        driverId: selectedId || undefined,
                                        driverName: selectedName || undefined
                                    }));
                                }}
                                disabled={!canEdit}
                                className="bg-transparent border-none font-black text-slate-700 outline-none p-1 text-sm min-w-[140px] disabled:opacity-50"
                            >
                                <option value="">Selecionar Motorista</option>
                                {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>

                    {/* Selections for Vehicle and OPEC */}
                    <button
                        onClick={() => setIsVehicleModalOpen(true)}
                        className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-[#E6E8EC] hover:border-[#E6E8EC] transition-all text-xs font-black text-slate-700 min-w-[150px] group"
                    >
                        <Car size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                        <span className="truncate">
                            {report?.carPlate
                                ? `${vehicles.find(v => v.plate === report.carPlate)?.tag || 'S/T'} - ${report.carPlate}`
                                : 'Selecionar Veículo'}
                        </span>
                    </button>

                    <button
                        onClick={() => setIsOpecModalOpen(true)}
                        className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-[#E6E8EC] hover:border-[#E6E8EC] transition-all text-xs font-black text-slate-700 min-w-[150px] group"
                    >
                        <Smartphone size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                        <span className="truncate">
                            {report?.opecId
                                ? opecDevices.find(d => d.id === report.opecId)?.assetCode || 'Selecionar OPEC'
                                : 'Selecionar OPEC'}
                        </span>
                    </button>

                    <div className="flex-1"></div>


                    <button
                        onClick={handleSave}
                        disabled={isSaving || !canEdit}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-primary-600 transition-all shadow-sm disabled:opacity-50 disabled:grayscale"
                    >
                        {isSaving ? <History className="animate-spin" /> : <Save size={18} />}
                        Salvar Relatório
                    </button>

                    <button
                        onClick={() => setIsDayExportModalOpen(true)}
                        disabled={!hasActivitiesInDay}
                        className="flex items-center gap-2 bg-slate-700 text-white px-4 py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 disabled:grayscale"
                    >
                        <Download size={18} />
                        Exportar Dia
                    </button>

                    <button
                        onClick={() => setIsMonthModalOpen(true)}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-lg"
                    >
                        <Calendar size={18} />
                        Exportar Mês
                    </button>
                </div>
            </div>

            {(!isToday && !isChief) && (
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 ${
                    isRetroactive
                        ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
                        : 'bg-orange-50 border-orange-200 text-orange-800'
                }`}>
                    <div className="flex items-center gap-3">
                        {isRetroactive ? (
                            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
                                <Clock size={20} />
                            </div>
                        ) : (
                            <div className="p-2 bg-orange-500 text-white rounded-xl shrink-0">
                                <AlertCircle size={20} />
                            </div>
                        )}
                        <div>
                            <p className="font-black text-sm">
                                {isRetroactive
                                    ? `Modo de Lançamento Retroativo Ativo (${formatDateBR(date)})`
                                    : `Modo Leitura: Data Anterior (${formatDateBR(date)})`}
                            </p>
                            <p className="text-xs font-semibold opacity-90 mt-0.5">
                                {isRetroactive
                                    ? 'A edição está liberada. Você pode selecionar equipe, motorista, adicionar atividades e faltas para esta data. Salve o relatório ao concluir.'
                                    : 'Esqueceu de preencher o relatório no dia anterior? Clique na opção ao lado para habilitar o preenchimento retroativo.'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsRetroactive(!isRetroactive)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shrink-0 ${
                            isRetroactive
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                                : 'bg-primary hover:bg-primary-600 text-white shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                    >
                        {isRetroactive ? <Lock size={15} /> : <Unlock size={15} />}
                        {isRetroactive ? 'Bloquear Edição' : 'Habilitar Lançamento Retroativo'}
                    </button>
                </div>
            )}

            {report?.id && !isEditingReport && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-2xl flex items-center gap-3 text-green-700 font-bold text-sm">
                    <ClipboardList size={20} />
                    Relatório salvo encontrado para {date}. Os dados foram carregados.
                </div>
            )}

            {isEditingReport && (
                <div className="bg-blue-50 border border-blue-300 p-4 rounded-2xl flex items-center justify-between text-blue-700 font-bold text-sm">
                    <div className="flex items-center gap-3">
                        <Edit2 size={20} />
                        Editando relatório existente. Altere os dados e clique em "Salvar Relatório".
                    </div>
                    <button
                        onClick={resetForm}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-xl text-xs font-black uppercase transition-colors"
                    >
                        Cancelar Edição
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Atividades */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-[20px] border border-[#E6E8EC] shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Plus size={16} className="text-primary" /> Atividades Realizadas
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                            {ACTIVITY_TYPES.map(type => {
                                const isSelected = selectedActivities.some(a => a.activityType === type);
                                return (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            if (isSelected) {
                                                // Toggle off: remove all instances of this type
                                                setSelectedActivities(prev => prev.filter(a => a.activityType !== type));
                                            } else {
                                                // Toggle on: add one instance
                                                handleAddActivity(type);
                                            }
                                        }}
                                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 group cursor-pointer select-none relative active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20 ${isSelected
                                            ? 'bg-orange-500 border-orange-600 shadow-md'
                                            : 'bg-slate-50 border-[#E6E8EC] hover:border-primary hover:bg-primary/5 hover:text-primary'
                                            }`}
                                    >
                                        <span className={`text-[11px] font-black uppercase leading-tight text-left ${isSelected ? 'text-white' : 'text-slate-600 group-hover:text-primary'}`}>
                                            {type}
                                        </span>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${isSelected
                                            ? 'bg-white/20 border border-white/40' // Orange state icon bg
                                            : 'bg-white border border-[#E6E8EC] group-hover:border-primary'
                                            }`}>
                                            {isSelected
                                                ? <CheckCircle size={14} className="text-white" /> // Show checkmark if selected
                                                : <Plus size={14} className="text-slate-400 group-hover:text-primary" />
                                            }
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Log de Atividades Adicionadas */}
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-t pt-6">
                            <ClipboardList size={16} /> Lançamentos do Dia
                        </h3>

                        <div className="space-y-3">
                            {selectedActivities.length === 0 ? (
                                <p className="text-center text-slate-400 text-xs py-8">Nenhuma atividade lançada ainda.</p>
                            ) : (
                                selectedActivities.map((activity, index) => {
                                    // Resolve Tech Names
                                    const techNames = activity.technicianIds?.map(tid => users.find(u => u.id === tid)?.name || 'Desconhecido').join(', ') || 'Equipe Completa';

                                    return (
                                        <div key={`edit-${index}`} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-[#E6E8EC] ring-2 ring-primary/10">
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase">Editando</span>
                                                        <span className="text-xs font-black uppercase text-slate-700">{activity.activityType}</span>
                                                    </div>
                                                    <button onClick={() => handleDeleteActivity(index)} className="text-red-400 hover:text-red-600 p-1">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-2 line-clamp-1">
                                                    {techNames}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Qtd:</span>
                                                    <input
                                                        type="number"
                                                        value={activity.quantity}
                                                        onChange={e => handleQuantityChange(index, parseInt(e.target.value))}
                                                        className="w-16 p-1 text-center font-black text-slate-700 bg-white border border-[#E6E8EC] rounded-lg text-xs outline-none focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Mostrar atividades de OUTROS relatórios do mesmo dia */}
                            {allDayReports.filter(r => r.id !== report?.id).length > 0 && (
                                <div className="mt-8 space-y-3 pt-6 border-t border-[#E6E8EC]">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Outros Lançamentos do Dia</h4>
                                    {allDayReports
                                        .filter(r => r.id !== report?.id)
                                        .map(otherReport => {
                                            const reporter = users.find(u => u.id === otherReport.userId);
                                            const team = teams.find(t => t.id === otherReport.teamId);
                                            const sourceName = team ? team.name : (reporter?.name || 'Desconhecido');

                                            return (
                                                <div key={`report-${otherReport.id}`} className="bg-[#FAFbfc] rounded-2xl border border-[#E6E8EC] overflow-hidden">
                                                    {/* Report Header with Edit Button */}
                                                    <div className="flex items-center justify-between p-3 bg-slate-100/50 border-b border-[#E6E8EC]">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full uppercase">{sourceName}</span>
                                                            <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${otherReport.shift === 'Noturno'
                                                                ? 'bg-indigo-100 text-indigo-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {otherReport.shift === 'Noturno' ? <Moon size={10} /> : <Sun size={10} />}
                                                                {otherReport.shift || 'Diurno'}
                                                            </span>
                                                            {otherReport.route && (
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Rota: {otherReport.route}</span>
                                                            )}
                                                        </div>
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => handleEditReport(otherReport)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all"
                                                            >
                                                                <Edit2 size={12} />
                                                                Editar
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Activities */}
                                                    <div className="p-3 space-y-2">
                                                        {otherReport.activities.map((activity, aIdx) => {
                                                            const techNames = activity.technicianIds?.map(tid => users.find(u => u.id === tid)?.name || 'Desconhecido').join(', ') || 'Equipe Completa';
                                                            return (
                                                                <div key={`view-${otherReport.id}-${aIdx}`} className="flex items-center gap-4 p-3 bg-white/60 rounded-xl">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className="text-xs font-black uppercase text-slate-500">{activity.activityType}</span>
                                                                        </div>
                                                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1 line-clamp-1">
                                                                            {techNames}
                                                                        </p>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Qtd: {activity.quantity}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Observação do relatório */}
                                                        {otherReport.notes && (
                                                            <div className="px-3 py-2 bg-amber-50/50 rounded-xl border border-amber-100">
                                                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Observação: </span>
                                                                <span className="text-[10px] font-bold text-amber-700">{otherReport.notes}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Equipe e Ausências */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[20px] border border-[#E6E8EC] shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            Membros da Equipe
                        </h3>

                        <div className="space-y-4">
                            {teamMembers.length === 0 ? (
                                <p className="text-center py-8 text-slate-400 text-xs italic">Nenhuma equipe selecionada.</p>
                            ) : teamMembers.map(member => {
                                const absence = absences.find(a => a.employeeId === member.id);
                                return (
                                    <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-[#E6E8EC]">
                                        <div className="flex items-center gap-3">
                                            <img src={member.avatar} alt="" className="w-8 h-8 rounded-xl" />
                                            <div>
                                                <p className="text-xs font-black text-slate-700 leading-none">{member.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                        {member.role.replace('PARCEIRO_', '')}
                                                    </p>
                                                    {report?.driverId === member.id && (
                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                                                            Motorista
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {absence ? (
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${absence.reason === 'Férias' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                                                    {absence.reason === 'Férias' ? 'EM FÉRIAS' : absence.reason === 'Afastamento' ? 'AFASTADO' : `AUSENTE: ${absence.reason}`}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteAbsence(absence.id!)}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Remover falta"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleAddAbsence(member.id, 'Falta Injustificada')}
                                                    disabled={!canEdit}
                                                    className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors disabled:opacity-40"
                                                    title="Marcar Falta"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[20px] border border-[#E6E8EC] shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Rota</h3>
                        <input
                            type="text"
                            value={report?.route || ''}
                            onChange={e => setReport(prev => ({ ...prev, route: e.target.value }))}
                            disabled={!canEdit}
                            placeholder="Digite a rota manualmente..."
                            className="w-full p-4 mb-6 bg-slate-50 border border-[#E6E8EC] rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                        />

                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Observação</h3>
                        <textarea
                            value={report?.notes || ''}
                            onChange={e => setReport(prev => ({ ...prev, notes: e.target.value }))}
                            disabled={!canEdit}
                            placeholder="Observações adicionais..."
                            className="w-full h-32 p-4 bg-slate-50 border border-[#E6E8EC] rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            {/* Modal de Seleção de Técnicos */}
            {isTechModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[20px] w-full max-w-md overflow-hidden shadow-2xl border border-[#E6E8EC] animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-[#E6E8EC] flex items-center justify-between bg-[#FAFbfc]">
                            <div>
                                <h3 className="text-lg font-bold font-display text-[#141518] tracking-tight">Selecionar Técnicos</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monte sua equipe do dia</p>
                            </div>
                            <button onClick={() => setIsTechModalOpen(false)} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="px-6 py-4 border-b border-[#E6E8EC] bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por nome..."
                                    value={techSearch}
                                    onChange={(e) => setTechSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-[#E6E8EC] rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                {techSearch && (
                                    <button
                                        onClick={() => setTechSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-lg text-slate-400"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            {selectedTechnicianIds.length > 0 && (
                                <button
                                    onClick={() => setSelectedTechnicianIds([])}
                                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs font-black uppercase tracking-wide hover:bg-red-100 transition-colors"
                                >
                                    <X size={14} />
                                    Desmarcar Todos ({selectedTechnicianIds.length})
                                </button>
                            )}
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                            {users
                                .filter(u => u.role === UserRole.TECNICO || u.role === UserRole.PARCEIRO_TECNICO || u.role === UserRole.LIDER || u.role === UserRole.PARCEIRO_LIDER)
                                .filter(u => u.name.toLowerCase().includes(techSearch.toLowerCase()))
                                .map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => handleToggleTechnician(user.id)}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${selectedTechnicianIds.includes(user.id)
                                            ? 'bg-primary/5 border-primary shadow-sm'
                                            : 'bg-slate-50 border-[#E6E8EC] hover:border-[#E6E8EC]'
                                            }`}
                                    >
                                        <img src={user.avatar} className="w-8 h-8 rounded-xl" alt="" />
                                        <div className="flex-1">
                                            <p className={`text-xs font-black ${selectedTechnicianIds.includes(user.id) ? 'text-primary' : 'text-slate-700'}`}>
                                                {user.name}
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                {user.role.replace('PARCEIRO_', '')}
                                            </p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedTechnicianIds.includes(user.id) ? 'bg-primary border-primary' : 'border-[#E6E8EC]'
                                            }`}>
                                            {selectedTechnicianIds.includes(user.id) && <Plus size={12} className="text-white rotate-45" />}
                                        </div>
                                    </div>
                                ))}
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-[#E6E8EC]">
                            <button
                                onClick={() => { setIsTechModalOpen(false); setTechSearch(''); }}
                                className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black text-sm hover:bg-slate-900 transition-all shadow-lg"
                            >
                                Confirmar Seleção
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Seleção de Veículo */}
            {isVehicleModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[20px] w-full max-w-md overflow-hidden shadow-2xl border border-[#E6E8EC] animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-[#E6E8EC] flex items-center justify-between bg-[#FAFbfc]">
                            <div>
                                <h3 className="text-lg font-bold font-display text-[#141518] tracking-tight">Selecionar Veículo</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolha o veículo utilizado hoje</p>
                            </div>
                            <button onClick={() => { setIsVehicleModalOpen(false); setVehicleSearch(''); }} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-4 border-b border-[#E6E8EC] bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por tag, modelo ou placa..."
                                    value={vehicleSearch}
                                    onChange={(e) => setVehicleSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-[#E6E8EC] rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                {vehicleSearch && (
                                    <button
                                        onClick={() => setVehicleSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-lg text-slate-400"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                            {vehicles
                                .filter(v =>
                                    (v.tag?.toLowerCase() || '').includes(vehicleSearch.toLowerCase()) ||
                                    v.model.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
                                    v.plate.toLowerCase().includes(vehicleSearch.toLowerCase())
                                )
                                .sort((a, b) => (a.tag || '').localeCompare(b.tag || ''))
                                .map(vehicle => (
                                    <div
                                        key={vehicle.id}
                                        onClick={() => {
                                            setReport(prev => ({ ...prev, carPlate: vehicle.plate }));
                                            setIsVehicleModalOpen(false);
                                            setVehicleSearch('');
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${report?.carPlate === vehicle.plate
                                            ? 'bg-primary/5 border-primary shadow-sm'
                                            : 'bg-slate-50 border-[#E6E8EC] hover:border-[#E6E8EC]'
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white border border-[#E6E8EC] flex items-center justify-center text-slate-400 shadow-sm">
                                            <Car size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-xs font-black ${report?.carPlate === vehicle.plate ? 'text-primary' : 'text-slate-700'}`}>
                                                {vehicle.tag ? `${vehicle.tag} - ` : ''}{vehicle.model} - {vehicle.plate}
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                {vehicle.status}
                                            </p>
                                        </div>
                                        {report?.carPlate === vehicle.plate && (
                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                <Plus size={12} className="text-white rotate-45" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Seleção de OPEC */}
            {isOpecModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[20px] w-full max-w-md overflow-hidden shadow-2xl border border-[#E6E8EC] animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-[#E6E8EC] flex items-center justify-between bg-[#FAFbfc]">
                            <div>
                                <h3 className="text-lg font-bold font-display text-[#141518] tracking-tight">Selecionar OPEC</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolha o dispositivo OPEC utilizado</p>
                            </div>
                            <button onClick={() => { setIsOpecModalOpen(false); setOpecSearch(''); }} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-4 border-b border-[#E6E8EC] bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por código ou modelo..."
                                    value={opecSearch}
                                    onChange={(e) => setOpecSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-[#E6E8EC] rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                {opecSearch && (
                                    <button
                                        onClick={() => setOpecSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-lg text-slate-400"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                            {opecDevices
                                .filter(d =>
                                    d.assetCode.toLowerCase().includes(opecSearch.toLowerCase()) ||
                                    d.model.toLowerCase().includes(opecSearch.toLowerCase())
                                )
                                .sort((a, b) => a.assetCode.localeCompare(b.assetCode))
                                .map(device => (
                                    <div
                                        key={device.id}
                                        onClick={() => {
                                            setReport(prev => ({ ...prev, opecId: device.id }));
                                            setIsOpecModalOpen(false);
                                            setOpecSearch('');
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${report?.opecId === device.id
                                            ? 'bg-primary/5 border-primary shadow-sm'
                                            : 'bg-slate-50 border-[#E6E8EC] hover:border-[#E6E8EC]'
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white border border-[#E6E8EC] flex items-center justify-center text-slate-400 shadow-sm">
                                            <Smartphone size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-xs font-black ${report?.opecId === device.id ? 'text-primary' : 'text-slate-700'}`}>
                                                {device.assetCode} - {device.model}
                                            </p>
                                        </div>
                                        {report?.opecId === device.id && (
                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                <Plus size={12} className="text-white rotate-45" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Exportação do Dia (Separado Dia e Noite) */}
            {isDayExportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[20px] w-full max-w-md overflow-hidden shadow-2xl border border-[#E6E8EC] animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-[#E6E8EC] flex items-center justify-between bg-[#FAFbfc]">
                            <div>
                                <h3 className="text-lg font-bold font-display text-[#141518] tracking-tight">Exportar Relatório Diário</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data: {formatDateBR(date)}</p>
                            </div>
                            <button onClick={() => setIsDayExportModalOpen(false)} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Resumo rápido de lançamentos por turno no dia */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                                        <Sun size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Turno Dia (Diurno)</p>
                                        <p className="text-xs font-black text-slate-800">
                                            {allDayReports.filter(r => (r.shift || 'Diurno') !== 'Noturno').reduce((acc, r) => acc + r.activities.length, 0)} lançamentos
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                                        <Moon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Turno Noite (Noturno)</p>
                                        <p className="text-xs font-black text-slate-800">
                                            {allDayReports.filter(r => r.shift === 'Noturno').reduce((acc, r) => acc + r.activities.length, 0)} lançamentos
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2.5">Formato / Turno para Exportação</label>
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setDayExportMode('consolidado')}
                                        className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                                            dayExportMode === 'consolidado'
                                                ? 'bg-primary/5 border-primary text-slate-900 shadow-sm'
                                                : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Consolidado (Com Abas Dia e Noite Separadas)</p>
                                            <p className="text-[10px] font-bold text-slate-400">1 arquivo Excel com aba geral + aba Dia + aba Noite</p>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${dayExportMode === 'consolidado' ? 'border-primary' : 'border-slate-300'}`}>
                                            {dayExportMode === 'consolidado' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setDayExportMode('separado')}
                                        className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                                            dayExportMode === 'separado'
                                                ? 'bg-primary/5 border-primary text-slate-900 shadow-sm'
                                                : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Arquivos Separados (Dia e Noite)</p>
                                            <p className="text-[10px] font-bold text-slate-400">Baixa 2 planilhas separadas: 1 de Dia (Diurno) e 1 de Noite (Noturno)</p>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${dayExportMode === 'separado' ? 'border-primary' : 'border-slate-300'}`}>
                                            {dayExportMode === 'separado' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                    </button>

                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setDayExportMode('diurno')}
                                            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 ${
                                                dayExportMode === 'diurno'
                                                    ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-sm'
                                                    : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            <Sun size={16} className="text-amber-500 shrink-0" />
                                            <div>
                                                <p className="text-xs font-black">Só Dia</p>
                                                <p className="text-[10px] font-bold text-slate-400">Apenas Diurno</p>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDayExportMode('noturno')}
                                            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 ${
                                                dayExportMode === 'noturno'
                                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm'
                                                    : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            <Moon size={16} className="text-indigo-600 shrink-0" />
                                            <div>
                                                <p className="text-xs font-black">Só Noite</p>
                                                <p className="text-[10px] font-bold text-slate-400">Apenas Noturno</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleExportExcel(dayExportMode)}
                                disabled={isExportingDay}
                                className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-slate-900 transition-all shadow-lg disabled:opacity-50"
                            >
                                {isExportingDay ? (
                                    <>
                                        <History className="animate-spin" size={18} />
                                        Gerando Relatório...
                                    </>
                                ) : (
                                    <>
                                        <Download size={18} />
                                        {dayExportMode === 'separado'
                                            ? 'Baixar Relatórios Dia e Noite'
                                            : dayExportMode === 'diurno'
                                                ? 'Baixar Relatório do Dia (Diurno)'
                                                : dayExportMode === 'noturno'
                                                    ? 'Baixar Relatório da Noite (Noturno)'
                                                    : 'Baixar Relatório Consolidado'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Seleção de Mês para Exportação */}
            {isMonthModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[20px] w-full max-w-md overflow-hidden shadow-2xl border border-[#E6E8EC] animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-[#E6E8EC] flex items-center justify-between bg-[#FAFbfc]">
                            <div>
                                <h3 className="text-lg font-bold font-display text-[#141518] tracking-tight">Exportar Relatório Mensal</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consolidado ou separado por turno (Dia / Noite)</p>
                            </div>
                            <button onClick={() => setIsMonthModalOpen(false)} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Mês</label>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                        className="w-full p-3 bg-slate-50 border border-[#E6E8EC] rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value={1}>Janeiro</option>
                                        <option value={2}>Fevereiro</option>
                                        <option value={3}>Março</option>
                                        <option value={4}>Abril</option>
                                        <option value={5}>Maio</option>
                                        <option value={6}>Junho</option>
                                        <option value={7}>Julho</option>
                                        <option value={8}>Agosto</option>
                                        <option value={9}>Setembro</option>
                                        <option value={10}>Outubro</option>
                                        <option value={11}>Novembro</option>
                                        <option value={12}>Dezembro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Ano</label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                        className="w-full p-3 bg-slate-50 border border-[#E6E8EC] rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2.5">Turno / Formato de Exportação</label>
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setMonthExportMode('consolidado')}
                                        className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                                            monthExportMode === 'consolidado'
                                                ? 'bg-emerald-50/70 border-emerald-500 text-slate-900 shadow-sm'
                                                : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Consolidado (Com Abas Dia e Noite)</p>
                                            <p className="text-[10px] font-bold text-slate-400">1 planilha com Atividades Geral, Aba Dia, Aba Noite e Resumos</p>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${monthExportMode === 'consolidado' ? 'border-emerald-600' : 'border-slate-300'}`}>
                                            {monthExportMode === 'consolidado' && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMonthExportMode('separado')}
                                        className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                                            monthExportMode === 'separado'
                                                ? 'bg-emerald-50/70 border-emerald-500 text-slate-900 shadow-sm'
                                                : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Arquivos Separados (Dia e Noite)</p>
                                            <p className="text-[10px] font-bold text-slate-400">Baixa 2 relatórios mensais separados: 1 de Dia e 1 de Noite</p>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${monthExportMode === 'separado' ? 'border-emerald-600' : 'border-slate-300'}`}>
                                            {monthExportMode === 'separado' && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                                        </div>
                                    </button>

                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setMonthExportMode('diurno')}
                                            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 ${
                                                monthExportMode === 'diurno'
                                                    ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-sm'
                                                    : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            <Sun size={16} className="text-amber-500 shrink-0" />
                                            <div>
                                                <p className="text-xs font-black">Só Dia</p>
                                                <p className="text-[10px] font-bold text-slate-400">Apenas Diurno</p>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setMonthExportMode('noturno')}
                                            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 ${
                                                monthExportMode === 'noturno'
                                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm'
                                                    : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            <Moon size={16} className="text-indigo-600 shrink-0" />
                                            <div>
                                                <p className="text-xs font-black">Só Noite</p>
                                                <p className="text-[10px] font-bold text-slate-400">Apenas Noturno</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleExportMonthlyExcel}
                                disabled={isExportingMonth}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50"
                            >
                                {isExportingMonth ? (
                                    <>
                                        <History className="animate-spin" size={18} />
                                        Gerando Relatório...
                                    </>
                                ) : (
                                    <>
                                        <Download size={18} />
                                        {monthExportMode === 'separado'
                                            ? 'Exportar Mês Separado (Dia e Noite)'
                                            : monthExportMode === 'diurno'
                                                ? 'Exportar Mês - Apenas Dia (Diurno)'
                                                : monthExportMode === 'noturno'
                                                    ? 'Exportar Mês - Apenas Noite (Noturno)'
                                                    : 'Exportar Relatório do Mês'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
