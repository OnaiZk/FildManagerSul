import React, { useState, useEffect, useMemo } from 'react';
import { User, DailyReport, DailyActivity, Absence, Vehicle, OpecDevice, Team, UserRole, VehicleLog } from '../types';
import {
  getDailyReports,
  getAbsences,
  deleteAbsence,
  getVehicles,
  getOpecDevices,
  getTeams,
  getAllUsers,
  getVehicleLogs,
  deleteDailyReport
} from '../api/fieldManagerApi';
import { supabase } from '../api/supabaseClient';
import {
  Calendar,
  Clock,
  Car,
  Smartphone,
  Users,
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Trash2,
  Eye,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  UserX,
  Sparkles,
  ClipboardCheck,
  Building2,
  MapPin,
  FileText,
  Activity,
  AlertTriangle,
  Sun,
  Moon
} from 'lucide-react';
import { createEletromidiaWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, saveWorkbook } from '../utils/excelExport';
import { resolveAbsenceShift } from '../utils/shiftUtils';

interface LeaderDashboardViewProps {
  currentUser: User;
  onNavigateToReport?: () => void;
  onNavigateToAgenda?: () => void;
}

export const LeaderDashboardView: React.FC<LeaderDashboardViewProps> = ({ currentUser, onNavigateToReport, onNavigateToAgenda }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'reports' | 'absences' | 'vehicles' | 'teams'>('reports');
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'Diurno' | 'Noturno'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [allAbsences, setAllAbsences] = useState<Absence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleLogs, setVehicleLogs] = useState<VehicleLog[]>([]);
  const [opecDevices, setOpecDevices] = useState<OpecDevice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Modals
  const [selectedReportForDetails, setSelectedReportForDetails] = useState<DailyReport | null>(null);
  const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportShiftMode, setExportShiftMode] = useState<'consolidado' | 'separado' | 'diurno' | 'noturno'>('consolidado');

  const isToday = useMemo(() => {
    return selectedDate === new Date().toISOString().split('T')[0];
  }, [selectedDate]);

  useEffect(() => {
    loadAllData();
  }, [selectedDate, currentUser.companyId]);

  // Real-time subscriptions
  useEffect(() => {
    const reportsChannel = supabase
      .channel('dashboard-daily-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, () => {
        loadDailyReports();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_activities' }, () => {
        loadDailyReports();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_absences' }, () => {
        loadAbsences();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_control' }, () => {
        loadVehicleData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
    };
  }, [selectedDate, currentUser.companyId]);

  const loadAllData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      await Promise.all([
        loadDailyReports(),
        loadAbsences(),
        loadVehicleData(),
        loadAuxiliaryData()
      ]);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDailyReports = async () => {
    const data = await getDailyReports(currentUser.companyId, undefined, selectedDate);
    setDailyReports(data);
  };

  const loadAbsences = async () => {
    const data = await getAbsences(currentUser.companyId);
    setAllAbsences(data);
  };

  const loadVehicleData = async () => {
    const [vehData, logsData] = await Promise.all([
      getVehicles(currentUser.companyId),
      getVehicleLogs(currentUser.companyId)
    ]);
    setVehicles(vehData);
    setVehicleLogs(logsData);
  };

  const loadAuxiliaryData = async () => {
    const [usersData, opecData, teamsData] = await Promise.all([
      getAllUsers(currentUser.companyId),
      getOpecDevices(currentUser.companyId),
      getTeams(currentUser.companyId)
    ]);
    setUsers(usersData);
    setOpecDevices(opecData);
    setTeams(teamsData);
  };

  // Absences occurring on the selected date
  const dayAbsences = useMemo(() => {
    return allAbsences.filter(a => {
      const start = a.date;
      const end = a.endDate || a.date;
      return selectedDate >= start && selectedDate <= end;
    });
  }, [allAbsences, selectedDate]);

  // Total activities and items produced on the selected date
  const totalActivitiesCount = useMemo(() => {
    return dailyReports.reduce((acc, r) => acc + (r.activities?.length || 0), 0);
  }, [dailyReports]);

  const totalPiecesQuantity = useMemo(() => {
    return dailyReports.reduce((acc, r) => {
      return acc + (r.activities?.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0) || 0);
    }, 0);
  }, [dailyReports]);

  // Unique active technicians and collaborators with activity or attendance
  const activeTechniciansToday = useMemo(() => {
    const techSet = new Set<string>();
    dailyReports.forEach(r => {
      if (r.userId) techSet.add(r.userId);
      if (r.driverId) techSet.add(r.driverId);
      if (r.technicianIds && Array.isArray(r.technicianIds)) {
        r.technicianIds.forEach(tid => techSet.add(tid));
      }
      r.activities?.forEach(a => {
        if (a.technicianIds && Array.isArray(a.technicianIds)) {
          a.technicianIds.forEach(tid => techSet.add(tid));
        }
      });
    });
    return Array.from(techSet);
  }, [dailyReports]);

  // Vehicles in use for the selected date
  const activeVehiclesToday = useMemo(() => {
    const plates = new Set<string>();
    dailyReports.forEach(r => {
      if (r.carPlate) plates.add(r.carPlate);
      r.activities?.forEach(a => {
        if (a.carPlate) plates.add(a.carPlate);
      });
    });
    return Array.from(plates);
  }, [dailyReports]);

  // Filtered reports
  const filteredDailyReports = useMemo(() => {
    return dailyReports.filter(r => {
      const reportShift = r.shift === 'Noturno' ? 'Noturno' : 'Diurno';
      if (shiftFilter !== 'all' && reportShift !== shiftFilter) {
        return false;
      }

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const leader = users.find(u => u.id === r.userId)?.name || '';
      const driver = r.driverName || '';
      const plate = r.carPlate || '';
      const opec = opecDevices.find(o => o.id === r.opecId)?.assetCode || '';
      const notes = r.notes || '';
      const activities = r.activities?.map(a => `${a.activityType} ${a.assetCodes?.join(' ') || ''}`).join(' ') || '';

      return (
        leader.toLowerCase().includes(term) ||
        driver.toLowerCase().includes(term) ||
        plate.toLowerCase().includes(term) ||
        opec.toLowerCase().includes(term) ||
        notes.toLowerCase().includes(term) ||
        activities.toLowerCase().includes(term) ||
        reportShift.toLowerCase().includes(term)
      );
    });
  }, [dailyReports, searchTerm, shiftFilter, users, opecDevices]);

  // Filtered absences
  const filteredAbsences = useMemo(() => {
    return dayAbsences.filter(a => {
      const absShift = resolveAbsenceShift(a, users);
      if (shiftFilter !== 'all' && absShift !== shiftFilter) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const name = a.employeeName || '';
      const reason = a.reason || '';
      const desc = a.description || '';
      return (
        name.toLowerCase().includes(term) ||
        reason.toLowerCase().includes(term) ||
        desc.toLowerCase().includes(term) ||
        absShift.toLowerCase().includes(term)
      );
    });
  }, [dayAbsences, searchTerm, shiftFilter, users]);

  // Delete handlers
  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este relatório diário? As atividades vinculadas a ele também serão excluídas.')) {
      return;
    }
    try {
      await deleteDailyReport(reportId);
      await loadDailyReports();
    } catch (err) {
      console.error('Error deleting daily report:', err);
      alert('Erro ao excluir relatório diário.');
    }
  };

  const handleDeleteAbsence = async (absenceId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta falta/ausência?')) {
      return;
    }
    try {
      await deleteAbsence(absenceId);
      await loadAbsences();
    } catch (err) {
      console.error('Error deleting absence:', err);
      alert('Erro ao excluir falta.');
    }
  };

  // Quick Date Setters
  const setQuickDate = (type: 'today' | 'yesterday') => {
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const populateLeaderActivitiesSheet = (ws: any, headerRowIndex: number, reportsList: DailyReport[]) => {
    const headerRow = ws.getRow(headerRowIndex);
    headerRow.values = [
      'Data',
      'Turno',
      'Líder Responsável',
      'Veículo',
      'OPEC',
      'Motorista',
      'Técnicos Envolvidos',
      'Rota / Região',
      'Tipo de Atividade',
      'Quantidade',
      'Códigos de Ativos',
      'Observações'
    ];
    styleHeaderRow(headerRow);

    reportsList.forEach(r => {
      const leader = users.find(u => u.id === r.userId)?.name || 'Desconhecido';
      const fallbackCar = vehicles.find(v => v.plate === r.carPlate);
      const fallbackOpec = opecDevices.find(o => o.id === r.opecId);

      r.activities?.forEach(a => {
        const car = a.carPlate ? vehicles.find(v => v.plate === a.carPlate) : fallbackCar;
        const opec = a.opecId ? opecDevices.find(o => o.id === a.opecId) : fallbackOpec;
        const activityLeader = a.liderName || leader;

        const techNames = (a.technicianIds || r.technicianIds || [])
          .map(tid => users.find(u => u.id === tid)?.name || 'Técnico')
          .join(', ');

        ws.addRow([
          r.date,
          r.shift || 'Diurno',
          activityLeader,
          car ? `${car.model} (${car.plate})` : r.carPlate || 'N/A',
          opec ? opec.assetCode : 'N/A',
          r.driverName || 'N/A',
          techNames || 'Equipe',
          r.route || 'Matriz',
          a.activityType,
          a.quantity,
          a.assetCodes?.join(', ') || '',
          r.notes || ''
        ]);
      });
    });

    styleDataRows(ws, headerRowIndex);
    autoFitColumns(ws);
  };

  const populateLeaderAbsencesSheet = (ws: any, headerRowIndex: number, absencesList: Absence[]) => {
    const absHeader = ws.getRow(headerRowIndex);
    absHeader.values = ['Colaborador', 'Turno', 'Motivo', 'Data Início', 'Data Fim', 'Observações / Justificativa', 'Tem Comprovante'];
    styleHeaderRow(absHeader);

    absencesList.forEach(a => {
      const absShift = resolveAbsenceShift(a, users);
      ws.addRow([
        a.employeeName,
        absShift === 'Noturno' ? 'Noturno (Noite)' : 'Diurno (Dia)',
        a.reason,
        a.date,
        a.endDate || a.date,
        a.description || '',
        a.evidenceUrl ? 'SIM' : 'NÃO'
      ]);
    });

    styleDataRows(ws, headerRowIndex);
    autoFitColumns(ws);
  };

  const buildLeaderAbsencesOnlyWorkbook = async (
    absencesList: Absence[],
    shiftLabel: string,
    includeShiftTabs: boolean
  ) => {
    const { workbook, worksheet: wsAbsences, startRow } = await createEletromidiaWorkbook(
      `Relatório de Faltas e Ausências (${shiftLabel}) - ${selectedDate}`,
      'Faltas e Ausências'
    );

    populateLeaderAbsencesSheet(wsAbsences, startRow, absencesList);

    const diurnoAbs = absencesList.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
    const noturnoAbs = absencesList.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

    if (includeShiftTabs) {
      const wsAbsDia = workbook.addWorksheet('Faltas - Dia (Diurno)');
      populateLeaderAbsencesSheet(wsAbsDia, 1, diurnoAbs);

      const wsAbsNoite = workbook.addWorksheet('Faltas - Noite (Noturno)');
      populateLeaderAbsencesSheet(wsAbsNoite, 1, noturnoAbs);
    }

    const wsResumo = workbook.addWorksheet('Resumo de Faltas');
    const rHeader = wsResumo.getRow(1);
    rHeader.values = ['Indicador', 'Total'];
    styleHeaderRow(rHeader);
    [
      ['Data do Relatório', selectedDate],
      ['Turno Exportado', shiftLabel],
      ['Total de Faltas / Ausências', absencesList.length],
      ['Faltas - Dia (Diurno)', diurnoAbs.length],
      ['Faltas - Noite (Noturno)', noturnoAbs.length],
      ['Atestados', absencesList.filter(a => a.reason === 'Atestado').length],
      ['Faltas Injustificadas', absencesList.filter(a => a.reason === 'Falta Injustificada').length],
      ['Faltas Justificadas', absencesList.filter(a => a.reason === 'Falta Justificada').length]
    ].forEach(row => wsResumo.addRow(row));
    styleDataRows(wsResumo, 1);
    autoFitColumns(wsResumo);

    return workbook;
  };

  const handleExportAbsencesOnlyXLSX = async (modeOverride?: 'consolidado' | 'separado' | 'diurno' | 'noturno') => {
    const mode = modeOverride || exportShiftMode;
    if (dayAbsences.length === 0) {
      alert('Nenhuma falta ou ausência registrada nesta data para exportar.');
      return;
    }

    const diurnoAbsences = dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
    const noturnoAbsences = dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

    setIsExporting(true);
    try {
      if (mode === 'diurno') {
        const wb = await buildLeaderAbsencesOnlyWorkbook(diurnoAbsences, 'Diurno (Dia)', false);
        await saveWorkbook(wb, `Relatorio_Faltas_Dia_Diurno_${selectedDate}`);
      } else if (mode === 'noturno') {
        const wb = await buildLeaderAbsencesOnlyWorkbook(noturnoAbsences, 'Noturno (Noite)', false);
        await saveWorkbook(wb, `Relatorio_Faltas_Noite_Noturno_${selectedDate}`);
      } else if (mode === 'separado') {
        const wbDia = await buildLeaderAbsencesOnlyWorkbook(diurnoAbsences, 'Diurno (Dia)', false);
        await saveWorkbook(wbDia, `Relatorio_Faltas_Dia_Diurno_${selectedDate}`);
        await new Promise(resolve => setTimeout(resolve, 350));
        const wbNoite = await buildLeaderAbsencesOnlyWorkbook(noturnoAbsences, 'Noturno (Noite)', false);
        await saveWorkbook(wbNoite, `Relatorio_Faltas_Noite_Noturno_${selectedDate}`);
      } else {
        const wb = await buildLeaderAbsencesOnlyWorkbook(dayAbsences, 'Consolidado (Dia e Noite)', true);
        await saveWorkbook(wb, `Relatorio_Faltas_Consolidado_${selectedDate}`);
      }
      setIsExportModalOpen(false);
    } catch (err) {
      console.error('Error exporting absences XLSX:', err);
      alert('Erro ao exportar planilha de faltas.');
    } finally {
      setIsExporting(false);
    }
  };

  const buildLeaderWorkbook = async (
    reportsList: DailyReport[],
    absencesList: Absence[],
    shiftLabel: string,
    includeShiftTabs: boolean
  ) => {
    const { workbook, worksheet: wsActivities, startRow } = await createEletromidiaWorkbook(
      `Relatório Consolidado de Campo (${shiftLabel}) - ${selectedDate}`,
      'Atividades'
    );

    populateLeaderActivitiesSheet(wsActivities, startRow, reportsList);

    const diurnoList = reportsList.filter(r => (r.shift || 'Diurno') !== 'Noturno');
    const noturnoList = reportsList.filter(r => r.shift === 'Noturno');
    const diurnoAbs = absencesList.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
    const noturnoAbs = absencesList.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

    if (includeShiftTabs) {
      const wsDia = workbook.addWorksheet('Atividades - Dia (Diurno)');
      populateLeaderActivitiesSheet(wsDia, 1, diurnoList);

      const wsNoite = workbook.addWorksheet('Atividades - Noite (Noturno)');
      populateLeaderActivitiesSheet(wsNoite, 1, noturnoList);
    }

    // Sheet: Faltas e Ausências
    const wsAbsences = workbook.addWorksheet('Faltas e Ausências');
    populateLeaderAbsencesSheet(wsAbsences, 1, absencesList);

    if (includeShiftTabs) {
      const wsAbsDia = workbook.addWorksheet('Faltas - Dia (Diurno)');
      populateLeaderAbsencesSheet(wsAbsDia, 1, diurnoAbs);

      const wsAbsNoite = workbook.addWorksheet('Faltas - Noite (Noturno)');
      populateLeaderAbsencesSheet(wsAbsNoite, 1, noturnoAbs);
    }

    // Sheet: Resumo Geral
    const wsSummary = workbook.addWorksheet('Resumo do Dia');
    const sumHeader = wsSummary.getRow(1);
    sumHeader.values = ['Indicador', 'Total'];
    styleHeaderRow(sumHeader);

    const listActivitiesCount = reportsList.reduce((acc, r) => acc + (r.activities?.length || 0), 0);
    const listPiecesQuantity = reportsList.reduce((acc, r) => acc + (r.activities?.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0) || 0), 0);
    const diurnoActivitiesCount = diurnoList.reduce((acc, r) => acc + (r.activities?.length || 0), 0);
    const diurnoPiecesQuantity = diurnoList.reduce((acc, r) => acc + (r.activities?.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0) || 0), 0);
    const noturnoActivitiesCount = noturnoList.reduce((acc, r) => acc + (r.activities?.length || 0), 0);
    const noturnoPiecesQuantity = noturnoList.reduce((acc, r) => acc + (r.activities?.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0) || 0), 0);

    const summaryRows = [
      ['Data do Relatório', selectedDate],
      ['Turno Exportado', shiftLabel],
      ['Total de Relatórios Lançados', reportsList.length],
      ['Total de Atividades Registradas', listActivitiesCount],
      ['Total de Peças/Volumes Produzidos', listPiecesQuantity],
      ['Relatórios - Dia (Diurno)', diurnoList.length],
      ['Atividades - Dia (Diurno)', diurnoActivitiesCount],
      ['Peças/Volumes - Dia (Diurno)', diurnoPiecesQuantity],
      ['Relatórios - Noite (Noturno)', noturnoList.length],
      ['Atividades - Noite (Noturno)', noturnoActivitiesCount],
      ['Peças/Volumes - Noite (Noturno)', noturnoPiecesQuantity],
      ['Colaboradores Ativos no Dia', activeTechniciansToday.length],
      ['Faltas / Ausências Registradas (Total)', absencesList.length],
      ['Faltas / Ausências - Dia (Diurno)', diurnoAbs.length],
      ['Faltas / Ausências - Noite (Noturno)', noturnoAbs.length],
      ['Veículos em Operação', activeVehiclesToday.length]
    ];

    summaryRows.forEach(row => wsSummary.addRow(row));
    styleDataRows(wsSummary, 1);
    autoFitColumns(wsSummary);

    return workbook;
  };

  // Export Consolidated Excel
  const handleExportConsolidatedXLSX = async (modeOverride?: 'consolidado' | 'separado' | 'diurno' | 'noturno') => {
    const mode = modeOverride || exportShiftMode;
    if (dailyReports.length === 0 && dayAbsences.length === 0) {
      alert('Nenhum dado encontrado para a data selecionada para exportação.');
      return;
    }

    const diurnoReports = dailyReports.filter(r => (r.shift || 'Diurno') !== 'Noturno');
    const noturnoReports = dailyReports.filter(r => r.shift === 'Noturno');
    const diurnoAbsences = dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
    const noturnoAbsences = dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

    setIsExporting(true);
    try {
      if (mode === 'diurno') {
        if (diurnoReports.length === 0 && diurnoAbsences.length === 0) {
          alert('Nenhum relatório ou falta do turno Diurno (Dia) encontrado para esta data.');
          return;
        }
        const wb = await buildLeaderWorkbook(diurnoReports, diurnoAbsences, 'Diurno (Dia)', false);
        await saveWorkbook(wb, `Painel_Lider_Dia_Diurno_${selectedDate}`);
      } else if (mode === 'noturno') {
        if (noturnoReports.length === 0 && noturnoAbsences.length === 0) {
          alert('Nenhum relatório ou falta do turno Noturno (Noite) encontrado para esta data.');
          return;
        }
        const wb = await buildLeaderWorkbook(noturnoReports, noturnoAbsences, 'Noturno (Noite)', false);
        await saveWorkbook(wb, `Painel_Lider_Noite_Noturno_${selectedDate}`);
      } else if (mode === 'separado') {
        const wbDia = await buildLeaderWorkbook(diurnoReports, diurnoAbsences, 'Diurno (Dia)', false);
        await saveWorkbook(wbDia, `Painel_Lider_Dia_Diurno_${selectedDate}`);

        await new Promise(resolve => setTimeout(resolve, 350));

        const wbNoite = await buildLeaderWorkbook(noturnoReports, noturnoAbsences, 'Noturno (Noite)', false);
        await saveWorkbook(wbNoite, `Painel_Lider_Noite_Noturno_${selectedDate}`);
      } else {
        const wb = await buildLeaderWorkbook(dailyReports, dayAbsences, 'Consolidado (Dia e Noite)', true);
        await saveWorkbook(wb, `Painel_Lider_Consolidado_${selectedDate}`);
      }
      setIsExportModalOpen(false);
    } catch (err) {
      console.error('Error exporting consolidated XLSX:', err);
      alert('Erro ao exportar arquivo XLSX consolidado.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export CSV
  const downloadCSVForReports = (reportsList: DailyReport[], absencesList: Absence[], fileSuffix: string) => {
    const rows: string[][] = [
      ['Tipo', 'Data', 'Turno', 'Responsável', 'Veículo', 'OPEC', 'Detalhe / Atividade', 'Quantidade / Motivo', 'Observações']
    ];

    reportsList.forEach(r => {
      const leader = users.find(u => u.id === r.userId)?.name || 'Líder';
      r.activities?.forEach(a => {
        rows.push([
          'RELATÓRIO DIÁRIO',
          r.date,
          r.shift || 'Diurno',
          leader,
          a.carPlate || r.carPlate || 'N/A',
          a.opecId || r.opecId || 'N/A',
          `"${a.activityType} (${a.assetCodes?.join(', ') || 'S/N'})"`,
          String(a.quantity),
          `"${r.notes || ''}"`
        ]);
      });
    });

    absencesList.forEach(a => {
      const absShift = resolveAbsenceShift(a, users);
      rows.push([
        'FALTA / AUSÊNCIA',
        a.date,
        absShift,
        a.employeeName,
        'N/A',
        'N/A',
        a.reason,
        `Período: ${a.date} até ${a.endDate || a.date}`,
        `"${a.description || ''}"`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Painel_Lider_${fileSuffix}${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = async (modeOverride?: 'consolidado' | 'separado' | 'diurno' | 'noturno') => {
    const mode = modeOverride || exportShiftMode;
    if (dailyReports.length === 0 && dayAbsences.length === 0) {
      alert('Nenhum dado encontrado para exportar em CSV.');
      return;
    }

    const diurnoReports = dailyReports.filter(r => (r.shift || 'Diurno') !== 'Noturno');
    const noturnoReports = dailyReports.filter(r => r.shift === 'Noturno');
    const diurnoAbsences = dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Diurno');
    const noturnoAbsences = dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Noturno');

    if (mode === 'diurno') {
      downloadCSVForReports(diurnoReports, diurnoAbsences, 'Dia_Diurno_');
    } else if (mode === 'noturno') {
      downloadCSVForReports(noturnoReports, noturnoAbsences, 'Noite_Noturno_');
    } else if (mode === 'separado') {
      downloadCSVForReports(diurnoReports, diurnoAbsences, 'Dia_Diurno_');
      await new Promise(resolve => setTimeout(resolve, 350));
      downloadCSVForReports(noturnoReports, noturnoAbsences, 'Noite_Noturno_');
    } else {
      downloadCSVForReports(dailyReports, dayAbsences, '');
    }
    setIsExportModalOpen(false);
  };

  const getAbsenceBadgeColor = (reason: string) => {
    switch (reason) {
      case 'Falta Injustificada':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'Atestado':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'Day Off':
        return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'Banco de Horas':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'Férias':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'Falta Justificada':
        return 'bg-slate-100 text-slate-700 border-[#E6E8EC]';
      default:
        return 'bg-orange-50 text-orange-600 border-orange-200';
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12 animate-in fade-in duration-300">
      
      {/* 1. Header Area with Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-[20px] border border-[#E6E8EC] shadow-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Painel do Líder</h1>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-[11px] font-black uppercase rounded-full tracking-wider shadow-sm shadow-primary/20">
              <Building2 size={12} /> {currentUser.companyName || 'Gestão Eletromidia'}
            </span>
            {isToday && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ao Vivo
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs md:text-sm font-semibold">
            Acompanhamento em tempo real de faltas, presenças e relatórios diários de campo.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onNavigateToAgenda && (
            <button
              onClick={onNavigateToAgenda}
              className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-xs font-black px-4 py-3 rounded-2xl transition-all shadow-sm"
              title="Abrir Agenda / Diário Semanal dos Líderes"
            >
              <Calendar size={16} className="text-orange-600" />
              <span>Diário Semanal</span>
            </button>
          )}

          {onNavigateToReport && (
            <button
              onClick={onNavigateToReport}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black px-4 py-3 rounded-2xl transition-all shadow-sm"
              title="Ir para tela de lançamento"
            >
              <Plus size={16} className="text-primary" />
              <span>Novo Lançamento</span>
            </button>
          )}

          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isExporting}
            className="flex items-center gap-2 bg-primary hover:bg-primary-600 text-white text-xs font-black px-4 py-3 rounded-2xl transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            <span>{isExporting ? 'Gerando...' : 'Exportar Relatório (.XLSX / Dia e Noite)'}</span>
          </button>

          <button
            onClick={() => handleExportCSV(shiftFilter === 'Diurno' ? 'diurno' : shiftFilter === 'Noturno' ? 'noturno' : 'consolidado')}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-[#E6E8EC] text-slate-700 text-xs font-black px-3.5 py-3 rounded-2xl transition-all shadow-sm"
            title="Exportar arquivo CSV do dia selecionado"
          >
            <Download size={15} />
            <span>Exportar Dia ({selectedDate}) .CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Metric / KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total de Checklists / Relatórios */}
        <div className="bg-white rounded-[20px] p-6 border-2 border-primary/20 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Total de Relatórios Hoje</span>
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-primary flex items-center justify-center">
              <ClipboardCheck size={20} />
            </div>
          </div>
          <div>
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              {dailyReports.length}
            </div>
            <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-1.5">
              <span className="text-emerald-600 font-black">{dailyReports.length} finalizados</span>
              <span>•</span>
              <span className="text-slate-400">{activeVehiclesToday.length} em rota</span>
            </p>
          </div>
        </div>

        {/* Card 2: Faltas e Ausências */}
        <div className="bg-white rounded-[20px] p-6 border-2 border-amber-200 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Faltas e Ausências</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserX size={20} />
            </div>
          </div>
          <div>
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              {dayAbsences.length}
            </div>
            <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-1.5 truncate">
              {dayAbsences.length > 0 ? (
                <span className="text-amber-700 font-bold">
                  {dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Diurno').length} Dia • {dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Noturno').length} Noite
                </span>
              ) : (
                <span className="text-emerald-600 font-bold">100% de presença registrada</span>
              )}
            </p>
          </div>
        </div>

        {/* Card 3: Colaboradores em Campo */}
        <div className="bg-white rounded-[20px] p-6 border-2 border-emerald-200 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Equipe em Campo</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div>
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              {activeTechniciansToday.length}
            </div>
            <p className="text-xs font-bold text-emerald-600 mt-2">
              Técnicos e motoristas ativos hoje
            </p>
          </div>
        </div>

        {/* Card 4: Volume de Produção & Frota */}
        <div className="bg-white rounded-[20px] p-6 border-2 border-[#E6E8EC] shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Total de Produção</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity size={20} />
            </div>
          </div>
          <div>
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              {totalPiecesQuantity} <span className="text-sm text-slate-400 font-bold">itens</span>
            </div>
            <p className="text-xs font-bold text-slate-500 mt-2">
              {totalActivitiesCount} atividades • {activeVehiclesToday.length} carros ativos
            </p>
          </div>
        </div>

      </div>

      {/* 3. Navigation Tabs (Pills) */}
      <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'reports'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Relatórios Diários ({dailyReports.length})
        </button>

        <button
          onClick={() => setActiveTab('absences')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
            activeTab === 'absences'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Faltas e Ausências</span>
          {dayAbsences.length > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-black">
              {dayAbsences.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('vehicles')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'vehicles'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Veículos & Frota ({activeVehiclesToday.length})
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'teams'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Equipes & Perfis
        </button>
      </div>

      {/* 4. Main Section Container with Filter & Search */}
      <div className="ooh-card p-6 md:p-8 flex flex-col gap-6">
        
        {/* Section Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E6E8EC]">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {activeTab === 'reports' && 'Histórico de Relatórios Diários'}
              {activeTab === 'absences' && 'Registro de Faltas e Atestados do Dia'}
              {activeTab === 'vehicles' && 'Acompanhamento de Veículos e KM'}
              {activeTab === 'teams' && 'Resumo de Produtividade por Colaborador'}
            </h2>
            <p className="text-xs text-slate-400 font-semibold">
              Visualize todos os envios e registros sem necessidade de exportar relatórios.
            </p>
          </div>

          {/* Date Filter & Quick Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            
            {/* Shift Filter (Todos / Dia / Noite) */}
            {(activeTab === 'reports' || activeTab === 'absences') && (
              <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-[#E6E8EC] text-xs font-black">
                <button
                  onClick={() => setShiftFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${shiftFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setShiftFilter('Diurno')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${shiftFilter === 'Diurno' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Sun size={13} />
                  Dia
                </button>
                <button
                  onClick={() => setShiftFilter('Noturno')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${shiftFilter === 'Noturno' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Moon size={13} />
                  Noite
                </button>
              </div>
            )}

            {activeTab === 'absences' && (
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm transition-all"
              >
                <FileSpreadsheet size={14} />
                <span>Exportar Faltas (Dia / Noite)</span>
              </button>
            )}

            {/* Quick date switches */}
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-[#E6E8EC] text-xs font-black">
              <button
                onClick={() => setQuickDate('today')}
                className={`px-3 py-1.5 rounded-lg transition-all ${isToday ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Hoje
              </button>
              <button
                onClick={() => setQuickDate('yesterday')}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
              >
                Ontem
              </button>
            </div>

            {/* Date input */}
            <div className="flex items-center gap-2 bg-slate-50 border border-[#E6E8EC] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-slate-400" />
              <span className="text-xs font-black text-slate-500">Filtrar Data:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadAllData(true)}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-[#E6E8EC] rounded-xl text-slate-600 transition-colors"
              title="Atualizar dados ao vivo"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-primary' : ''} />
            </button>

          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'reports'
                ? 'Buscar por líder, técnico, placa do veículo, OPEC ou tipo de atividade...'
                : activeTab === 'absences'
                ? 'Buscar por nome do colaborador, motivo ou observação...'
                : 'Buscar...'
            }
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-[#E6E8EC] rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 5. TAB 1: RELATÓRIOS DIÁRIOS */}
        {activeTab === 'reports' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={24} className="animate-spin text-primary" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando relatórios...</span>
              </div>
            ) : filteredDailyReports.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                  <ClipboardCheck size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-700">Nenhum relatório diário encontrado</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Não há lançamentos de relatórios para a data <strong className="text-slate-600">{selectedDate}</strong>. Selecione outra data ou faça um novo lançamento.
                </p>
                {onNavigateToReport && (
                  <button
                    onClick={onNavigateToReport}
                    className="mt-2 text-xs font-black text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus size={14} /> Lançar relatório agora
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E8EC] text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Hora</th>
                    <th className="py-3 px-4">Líder / Responsável</th>
                    <th className="py-3 px-4">Veículo</th>
                    <th className="py-3 px-4">Aparelho (OPEC)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Região / Rota</th>
                    <th className="py-3 px-4">Atividades & Produção</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF0F3] text-xs font-semibold text-slate-700">
                  {filteredDailyReports.map((report) => {
                    const leader = users.find(u => u.id === report.userId);
                    const car = vehicles.find(v => v.plate === report.carPlate);
                    const opec = opecDevices.find(o => o.id === report.opecId);
                    const totalItems = report.activities?.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0) || 0;

                    return (
                      <tr key={report.id} className="hover:bg-slate-50/80 transition-colors group">
                        
                        {/* 1. Hora / Turno */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-slate-900 flex items-center gap-1">
                              <Clock size={12} className="text-slate-400" />
                              {report.date}
                            </span>
                            {(report.shift || 'Diurno') === 'Noturno' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-black uppercase w-fit">
                                <Moon size={10} /> Noturno
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-black uppercase w-fit">
                                <Sun size={10} /> Diurno
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Líder / Responsável */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={leader?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(leader?.name || 'Líder')}`}
                              alt=""
                              className="w-8 h-8 rounded-full border border-[#E6E8EC] object-cover shadow-sm"
                            />
                            <div className="flex flex-col">
                              <span className="font-black text-slate-900 truncate max-w-[150px]">{leader?.name || 'Líder Responsável'}</span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{leader?.email || ''}</span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Veículo */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {report.carPlate ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white font-mono-code tabular-nums text-[11px] font-bold rounded-lg w-fit shadow-sm">
                                <Car size={11} className="text-primary" /> {report.carPlate}
                              </span>
                              {car && <span className="text-[10px] text-slate-400 font-medium mt-0.5">{car.model}</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Sem Veículo</span>
                          )}
                        </td>

                        {/* 4. Aparelho OPEC */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {report.opecId ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold">
                              <Smartphone size={12} /> {opec ? opec.assetCode : report.opecId}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Não inf.</span>
                          )}
                        </td>

                        {/* 5. Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> FINALIZADO
                          </span>
                        </td>

                        {/* 6. Região / Rota */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-primary border border-orange-200 rounded-lg text-xs font-bold">
                            <MapPin size={11} /> {report.route || 'Matriz'}
                          </span>
                        </td>

                        {/* 7. Atividades & Produção */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1 max-w-xs">
                            <span className="font-black text-slate-900 text-xs">
                              {totalItems} itens <span className="text-slate-400 font-normal">({report.activities?.length || 0} atividades)</span>
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {report.activities?.slice(0, 2).map((act, idx) => (
                                <span key={idx} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold truncate max-w-[140px]">
                                  {act.quantity}x {act.activityType}
                                </span>
                              ))}
                              {(report.activities?.length || 0) > 2 && (
                                <span className="inline-block px-1 py-0.5 bg-slate-100 text-slate-400 rounded text-[10px] font-bold">
                                  +{(report.activities?.length || 0) - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 8. Ações */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedReportForDetails(report)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-xl font-black text-xs transition-all shadow-sm group-hover:bg-primary group-hover:text-white"
                            >
                              <Eye size={13} />
                              <span>Ver Detalhes</span>
                            </button>

                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir relatório diário"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 6. TAB 2: FALTAS E AUSÊNCIAS */}
        {activeTab === 'absences' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={24} className="animate-spin text-primary" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando faltas...</span>
              </div>
            ) : filteredAbsences.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-sm font-black text-slate-700">Nenhuma falta registrada para hoje</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Todos os colaboradores estão presentes ou nenhuma ocorrência foi lançada para <strong className="text-slate-600">{selectedDate}</strong>.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E8EC] text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Turno</th>
                    <th className="py-3 px-4">Motivo / Tipo</th>
                    <th className="py-3 px-4">Período</th>
                    <th className="py-3 px-4">Observações / Justificativa</th>
                    <th className="py-3 px-4 text-center">Comprovante</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF0F3] text-xs font-semibold text-slate-700">
                  {filteredAbsences.map((absence) => {
                    const employeeUser = users.find(u => u.id === absence.employeeId || u.name === absence.employeeName);
                    const absShift = resolveAbsenceShift(absence, users);
                    return (
                      <tr key={absence.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Colaborador */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={employeeUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(absence.employeeName)}`}
                              alt=""
                              className="w-9 h-9 rounded-full border border-[#E6E8EC] object-cover shadow-sm"
                            />
                            <div className="flex flex-col">
                              <span className="font-black text-slate-900">{absence.employeeName}</span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {employeeUser?.role?.replace('PARCEIRO_', '') || 'Técnico de Campo'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Turno */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {absShift === 'Noturno' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black uppercase">
                              <Moon size={11} /> Noite (Noturno)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase">
                              <Sun size={11} /> Dia (Diurno)
                            </span>
                          )}
                        </td>

                        {/* Motivo */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 border rounded-full text-xs font-black ${getAbsenceBadgeColor(absence.reason)}`}>
                            {absence.reason}
                          </span>
                        </td>

                        {/* Período */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-mono-code tabular-nums font-bold text-slate-900">
                              {absence.date}
                            </span>
                            {absence.endDate && absence.endDate !== absence.date && (
                              <span className="text-[10px] text-slate-400">
                                até {absence.endDate}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Observações */}
                        <td className="py-4 px-4 max-w-sm">
                          <p className="text-slate-600 font-medium line-clamp-2">
                            {absence.description || <span className="text-slate-400 italic">Sem observações</span>}
                          </p>
                        </td>

                        {/* Comprovante */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {absence.evidenceUrl ? (
                            <button
                              onClick={() => setSelectedEvidenceUrl(absence.evidenceUrl!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                              <FileText size={13} />
                              <span>Ver Atestado</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium italic">Sem anexo</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteAbsence(absence.id)}
                            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir falta"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 7. TAB 3: VEÍCULOS & FROTA */}
        {activeTab === 'vehicles' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={24} className="animate-spin text-primary" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando frota...</span>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="py-16 text-center text-slate-400">Nenhum veículo cadastrado na empresa.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E8EC] text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Veículo / Modelo</th>
                    <th className="py-3 px-4">Placa</th>
                    <th className="py-3 px-4">Status Hoje</th>
                    <th className="py-3 px-4">KM Atual</th>
                    <th className="py-3 px-4">Última Revisão</th>
                    <th className="py-3 px-4">Uso no Dia ({selectedDate})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF0F3] text-xs font-semibold text-slate-700">
                  {vehicles.map((v) => {
                    const isUsedToday = activeVehiclesToday.includes(v.plate);
                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 font-black text-slate-900">
                          <div className="flex items-center gap-2">
                            <Car size={16} className="text-slate-400" />
                            <span>{v.model}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono-code tabular-nums font-bold text-slate-900">
                          <span className="px-2 py-0.5 bg-slate-100 rounded border border-[#E6E8EC]">
                            {v.plate}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            v.status === 'Em Uso' || isUsedToday
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : v.status === 'Em Manutenção'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isUsedToday ? 'EM ROTA' : v.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono-code tabular-nums text-slate-600">
                          {v.currentKm ? `${v.currentKm.toLocaleString('pt-BR')} km` : 'N/A'}
                        </td>
                        <td className="py-4 px-4 font-mono-code tabular-nums text-slate-400">
                          {v.lastMaintenanceKm ? `${v.lastMaintenanceKm.toLocaleString('pt-BR')} km` : 'N/A'}
                        </td>
                        <td className="py-4 px-4">
                          {isUsedToday ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 size={13} /> Vinculado a relatórios hoje
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Sem saída registrada</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 8. TAB 4: EQUIPES & PERFIS */}
        {activeTab === 'teams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => {
              const absence = dayAbsences.find(a => a.employeeId === u.id || a.employeeName === u.name);
              const isWorkingToday = activeTechniciansToday.includes(u.id);

              return (
                <div key={u.id} className="bg-[#FAFbfc] border border-[#E6E8EC] rounded-2xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all shadow-sm">
                  <div className="flex items-start gap-3">
                    <img
                      src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`}
                      alt=""
                      className="w-11 h-11 rounded-2xl border-2 border-white shadow-sm object-cover"
                    />
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-black text-slate-900 text-sm truncate">{u.name}</span>
                      <span className="text-[10px] font-black uppercase text-primary tracking-wider">{u.role.replace('PARCEIRO_', '')}</span>
                      <span className="text-[10px] text-slate-400 truncate">{u.email}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E6E8EC] flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500">Status no Dia:</span>
                    {absence ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${getAbsenceBadgeColor(absence.reason)}`}>
                        {absence.reason}
                      </span>
                    ) : isWorkingToday ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Em Campo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">
                        Sem Lançamento
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 9. MODAL: DETALHES COMPLETOS DO RELATÓRIO DIÁRIO */}
      {selectedReportForDetails && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-[20px] max-w-3xl w-full border border-[#E6E8EC] shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 md:p-8 bg-slate-900 text-white flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-primary text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                    Relatório Diário Detalhado
                  </span>
                  {(selectedReportForDetails.shift || 'Diurno') === 'Noturno' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                      <Moon size={11} /> Noturno (Noite)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                      <Sun size={11} /> Diurno (Dia)
                    </span>
                  )}
                  <span className="text-slate-400 text-xs font-mono-code tabular-nums font-bold">{selectedReportForDetails.date}</span>
                </div>
                <h3 className="text-xl md:text-2xl font-black text-white mt-1">
                  Líder: {users.find(u => u.id === selectedReportForDetails.userId)?.name || 'Responsável'}
                </h3>
                <p className="text-slate-400 text-xs font-medium">
                  {users.find(u => u.id === selectedReportForDetails.userId)?.email}
                </p>
              </div>

              <button
                onClick={() => setSelectedReportForDetails(null)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 text-slate-700">
              
              {/* Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-[#E6E8EC] text-xs font-semibold">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Veículo</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1 font-mono-code tabular-nums">
                    <Car size={13} className="text-primary" />
                    {selectedReportForDetails.carPlate || 'Sem Veículo'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">OPEC</span>
                  <span className="font-bold text-purple-700 flex items-center gap-1">
                    <Smartphone size={13} />
                    {opecDevices.find(o => o.id === selectedReportForDetails.opecId)?.assetCode || selectedReportForDetails.opecId || 'Não inf.'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Motorista</span>
                  <span className="font-bold text-slate-900">
                    {selectedReportForDetails.driverName || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Região / Rota</span>
                  <span className="font-bold text-slate-900">
                    {selectedReportForDetails.route || 'Matriz'}
                  </span>
                </div>
              </div>

              {/* Activities List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity size={14} className="text-primary" /> Atividades Realizadas ({selectedReportForDetails.activities?.length || 0})
                </h4>

                <div className="space-y-2.5">
                  {selectedReportForDetails.activities?.map((act, i) => (
                    <div key={i} className="bg-white border border-[#E6E8EC] rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900">
                          {act.activityType}
                        </span>
                        <span className="px-2.5 py-1 bg-orange-50 text-primary border border-orange-200 rounded-lg text-xs font-black">
                          {act.quantity} {act.quantity === 1 ? 'unidade' : 'unidades'}
                        </span>
                      </div>

                      {/* Specific Technicians for this activity */}
                      {act.technicianIds && act.technicianIds.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[10px] font-bold text-slate-400">Técnicos:</span>
                          {act.technicianIds.map(tid => {
                            const tname = users.find(u => u.id === tid)?.name || 'Técnico';
                            return (
                              <span key={tid} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                                {tname}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Asset Codes */}
                      {act.assetCodes && act.assetCodes.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[10px] font-bold text-slate-400">Ativos / Abrigos:</span>
                          {act.assetCodes.map((code, cIdx) => (
                            <span key={cIdx} className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono-code tabular-nums text-[10px] font-bold rounded">
                              {code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedReportForDetails.notes && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block mb-1">Observações do Líder</span>
                  <p className="text-xs text-amber-900 font-medium whitespace-pre-wrap">
                    {selectedReportForDetails.notes}
                  </p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-[#E6E8EC] flex justify-end">
              <button
                onClick={() => setSelectedReportForDetails(null)}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-colors"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 10. MODAL: VISUALIZADOR DE ATESTADO / COMPROVANTE */}
      {selectedEvidenceUrl && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[20px] max-w-2xl w-full border border-[#E6E8EC] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={15} className="text-primary" /> Comprovante / Atestado Médico
              </span>
              <button onClick={() => setSelectedEvidenceUrl(null)} className="p-1 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-slate-100 max-h-[75vh] overflow-auto">
              <img
                src={selectedEvidenceUrl}
                alt="Comprovante"
                className="max-h-[65vh] w-auto rounded-xl shadow-md object-contain"
              />
            </div>
            <div className="p-4 bg-white flex justify-between items-center border-t border-[#E6E8EC]">
              <a
                href={selectedEvidenceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-black text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink size={14} /> Abrir em tamanho real
              </a>
              <button
                onClick={() => setSelectedEvidenceUrl(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. MODAL: OPÇÕES DE EXPORTAÇÃO (SEPARADO DIA E NOITE) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[20px] max-w-md w-full border border-[#E6E8EC] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#E6E8EC] flex items-center justify-between bg-[#FAFbfc]">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Exportar Relatório do Painel</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data selecionada: {selectedDate}</p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Resumo rápido de relatórios Dia vs Noite */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                    <Sun size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Dia (Diurno)</p>
                    <p className="text-xs font-black text-slate-800">
                      {dailyReports.filter(r => (r.shift || 'Diurno') !== 'Noturno').length} rel. • {dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Diurno').length} faltas
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
                      {dailyReports.filter(r => r.shift === 'Noturno').length} rel. • {dayAbsences.filter(a => resolveAbsenceShift(a, users) === 'Noturno').length} faltas
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2.5">Formato / Turno para Exportação</label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setExportShiftMode('consolidado')}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      exportShiftMode === 'consolidado'
                        ? 'bg-primary/5 border-primary text-slate-900 shadow-sm'
                        : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black text-slate-800">Consolidado (Com Abas Dia e Noite)</p>
                      <p className="text-[10px] font-bold text-slate-400">1 arquivo com aba geral + aba Dia + aba Noite</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${exportShiftMode === 'consolidado' ? 'border-primary' : 'border-slate-300'}`}>
                      {exportShiftMode === 'consolidado' && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportShiftMode('separado')}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      exportShiftMode === 'separado'
                        ? 'bg-primary/5 border-primary text-slate-900 shadow-sm'
                        : 'bg-slate-50 border-[#E6E8EC] text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black text-slate-800">Arquivos Separados (Dia e Noite)</p>
                      <p className="text-[10px] font-bold text-slate-400">Baixa 2 arquivos separados: 1 de Dia e 1 de Noite</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${exportShiftMode === 'separado' ? 'border-primary' : 'border-slate-300'}`}>
                      {exportShiftMode === 'separado' && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setExportShiftMode('diurno')}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 ${
                        exportShiftMode === 'diurno'
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
                      onClick={() => setExportShiftMode('noturno')}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 ${
                        exportShiftMode === 'noturno'
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

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleExportConsolidatedXLSX(exportShiftMode)}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-600 text-white px-5 py-3.5 rounded-2xl font-black text-xs transition-all shadow-md disabled:opacity-50"
                >
                  <FileSpreadsheet size={16} />
                  <span>
                    {isExporting
                      ? 'Gerando Excel...'
                      : exportShiftMode === 'separado'
                      ? 'Exportar Painel Completo (.XLSX) - Dia e Noite Separados'
                      : exportShiftMode === 'diurno'
                      ? 'Exportar Painel Completo (.XLSX) - Apenas Dia'
                      : exportShiftMode === 'noturno'
                      ? 'Exportar Painel Completo (.XLSX) - Apenas Noite'
                      : 'Exportar Painel Completo (.XLSX) Consolidado'}
                  </span>
                </button>

                <button
                  onClick={() => handleExportAbsencesOnlyXLSX(exportShiftMode)}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-2xl font-black text-xs transition-all shadow-sm disabled:opacity-50"
                >
                  <UserX size={15} />
                  <span>
                    {exportShiftMode === 'separado'
                      ? 'Exportar Só Relatório de Faltas (.XLSX) - Dia e Noite Separados'
                      : exportShiftMode === 'diurno'
                      ? 'Exportar Só Relatório de Faltas (.XLSX) - Apenas Dia'
                      : exportShiftMode === 'noturno'
                      ? 'Exportar Só Relatório de Faltas (.XLSX) - Apenas Noite'
                      : 'Exportar Só Relatório de Faltas (.XLSX) Consolidado'}
                  </span>
                </button>

                <button
                  onClick={() => handleExportCSV(exportShiftMode)}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-2xl font-black text-xs transition-all"
                >
                  <Download size={15} />
                  <span>Exportar em formato .CSV ({exportShiftMode === 'separado' ? 'Dia e Noite' : exportShiftMode})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
