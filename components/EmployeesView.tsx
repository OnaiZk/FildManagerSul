import React, { useState, useEffect } from 'react';
import { User, Employee, UserRole, Absence } from '../types';
import { getEmployees, bulkCreateEmployees, deleteEmployeeInvite, createAbsence, getAbsences, deleteAbsence, bulkDeleteInvites, uploadAbsenceEvidence } from '../api/fieldManagerApi';
import { Users, Upload, Search, Download, Trash2, Mail, CheckCircle2, Clock, AlertCircle, CalendarOff, Plus, ChevronUp, ChevronDown, Filter, Eye, FileText, RotateCcw, Sun, Moon, FileSpreadsheet } from 'lucide-react';
import readXlsxFile from 'read-excel-file';
import { createEletromidiaWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, saveWorkbook } from '../utils/excelExport';
import { resolveAbsenceShift, normalizeShift, ShiftExportMode } from '../utils/shiftUtils';

interface EmployeesViewProps {
    currentUser: User;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ currentUser }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importStats, setImportStats] = useState<{ total: number; success: number } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [absences, setAbsences] = useState<Absence[]>([]);
    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [selectedEmployeeForAbsence, setSelectedEmployeeForAbsence] = useState<Employee | null>(null);
    const [absenceForm, setAbsenceForm] = useState<{ date: string; endDate?: string; reason: string; shift: 'Diurno' | 'Noturno'; description: string; evidenceFile: File | null; evidenceUrl: string }>({
        date: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: 'Falta Injustificada',
        shift: 'Diurno',
        description: '',
        evidenceFile: null,
        evidenceUrl: ''
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState({
        role: '',
        originalStatus: '',
        shift: '',
        leaderName: ''
    });
    const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
    const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState<string | null>(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
    const [reportExportMode, setReportExportMode] = useState<ShiftExportMode>('consolidado');
    const [isExportingReport, setIsExportingReport] = useState(false);

    const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
    const [addEmployeeForm, setAddEmployeeForm] = useState({
        name: '',
        email: '',
        code: '',
        role: 'TECNICO',
        shift: '',
        leaderName: ''
    });
    const [addingEmployee, setAddingEmployee] = useState(false);

    useEffect(() => {
        loadEmployees();
        loadAbsences();
    }, [currentUser]);

    const loadAbsences = async () => {
        try {
            const data = await getAbsences(currentUser.companyId);
            setAbsences(data);
        } catch (err) {
            console.error('Error loading absences:', err);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Only select pending employees for deletion safety
            const pendingIds = filteredEmployees.filter(emp => emp.status === 'PENDING').map(emp => emp.id);
            setSelectedIds(pendingIds);
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectEmployee = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} convites selecionados ? `)) return;

        setIsDeletingBulk(true);
        try {
            await bulkDeleteInvites(selectedIds);
            alert(`${selectedIds.length} convites excluídos com sucesso!`);
            setSelectedIds([]);
            loadEmployees();
        } catch (err) {
            console.error('Error bulk deleting:', err);
            alert('Erro ao excluir convites.');
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const handleOpenAbsenceModal = (employee: Employee) => {
        setSelectedEmployeeForAbsence(employee);
        setAbsenceForm({
            date: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            reason: 'Falta Injustificada',
            shift: normalizeShift(employee.shift),
            description: '',
            evidenceFile: null,
            evidenceUrl: ''
        });
        setIsAbsenceModalOpen(true);
    };

    const handleAbsenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAbsenceForm(prev => ({ ...prev, evidenceFile: file }));
        }
    };

    const handleSubmitAbsence = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeForAbsence) return;

        setLoading(true);
        try {
            let evidenceUrl = '';
            if (absenceForm.evidenceFile) {
                evidenceUrl = await uploadAbsenceEvidence(absenceForm.evidenceFile);
            }

            // Regra: se o funcionário está pendente, o ID dele é do convite, não do auth.users.
            // O backend espera employee_id UUID referencing auth.users.
            // Para funcionários pendentes, enviamos como nulo para evitar erro de FK, 
            // mas o employee_name e company_id garantem a rastreabilidade.
            const employeeId = selectedEmployeeForAbsence.status === 'ACTIVE' ? selectedEmployeeForAbsence.id : undefined;

            await createAbsence({
                employeeId,
                employeeName: selectedEmployeeForAbsence.name,
                date: absenceForm.date,
                endDate: (absenceForm.reason === 'Férias' || absenceForm.reason === 'Afastamento') ? absenceForm.endDate : absenceForm.date,
                reason: absenceForm.reason as any,
                shift: absenceForm.shift,
                description: absenceForm.description,
                companyId: currentUser.companyId,
                evidenceUrl: evidenceUrl
            });
            alert('Ausência registrada com sucesso!');
            setIsAbsenceModalOpen(false);
            loadAbsences();
        } catch (err: any) {
            console.error('Error creating absence:', err);
            if (err.code === '23505') {
                alert('Erro: Já existe uma ausência registrada para este colaborador neste período.');
            } else {
                alert('Erro ao registrar ausência: ' + (err.message || 'Erro desconhecido'));
            }
        } finally {
            setLoading(false);
        }
    };


    const getEmployeeActiveAbsence = (employee: Employee) => {
        const today = new Date().toISOString().split('T')[0];
        return absences.find(a => {
            const matchesId = a.employeeId && a.employeeId === employee.id;
            const matchesName = (!a.employeeId || a.employeeId === null) && a.employeeName === employee.name;
            if (!matchesId && !matchesName) return false;

            const start = a.date;
            const end = a.endDate || a.date;
            return today >= start && today <= end;
        });
    };

    const handleRemoveAbsence = async (employee: Employee) => {
        const activeAbsence = getEmployeeActiveAbsence(employee);
        if (!activeAbsence) return;

        if (!confirm(`Deseja remover o status de ausência (${activeAbsence.reason}) de ${employee.name} e retorná-lo ao trabalho?`)) return;

        setLoading(true);
        try {
            await deleteAbsence(activeAbsence.id);
            alert(`${employee.name} retornou ao status normal de trabalho.`);
            await loadAbsences();
        } catch (err: any) {
            console.error('Error removing absence:', err);
            alert('Erro ao remover ausência: ' + (err.message || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    const loadEmployees = async () => {
        setLoading(true);
        try {
            const data = await getEmployees(currentUser.companyId);
            setEmployees(data);
        } catch (err) {
            console.error('Error loading employees:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteInvite = async (inviteId: string) => {
        if (!confirm('Tem certeza que deseja remover este convite?')) return;
        try {
            await deleteEmployeeInvite(inviteId);
            loadEmployees();
        } catch (err) {
            console.error('Error deleting invite:', err);
            alert('Erro ao remover convite.');
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ['Turno', 'Cadastro', 'Lider', 'Nome', 'Cargo', 'Status', 'Empresa'];
        const rows = [
            ['DIA', '12345', 'Maria Supervisor', 'Joao Silva', 'Técnico', 'ativo', 'Interno'],
            ['NOITE', '67890', 'Jose Chefe', 'Pedro Souza', 'Líder', 'ativo - adm', 'Interno']
        ];

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "modelo_funcionarios.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const periodAbsences = absences.filter(a => {
        const [year, month] = a.date.split('-');
        return parseInt(month, 10) === reportMonth && parseInt(year, 10) === reportYear;
    });
    const diurnoPeriodAbsences = periodAbsences.filter(a => resolveAbsenceShift(a, employees) === 'Diurno');
    const noturnoPeriodAbsences = periodAbsences.filter(a => resolveAbsenceShift(a, employees) === 'Noturno');

    const populateAbsencesSheet = (ws: any, sRow: number, list: Absence[]) => {
        const headers = [
            'Data', 'Turno', 'Funcionário', 'Matrícula/ID', 'Cargo',
            'Líder', 'Motivo', 'Observação', 'Possui Comprovante', 'URL Comprovante'
        ];
        const headerRow = ws.getRow(sRow);
        headerRow.values = headers;
        styleHeaderRow(headerRow);

        const formatPtBr = (dStr: string) => {
            const [y, m, d] = dStr.split('-');
            return `${d}/${m}/${y}`;
        };

        list.forEach(a => {
            const employee = employees.find(e => e.id === a.employeeId || e.name.toLowerCase() === a.employeeName?.toLowerCase());
            const resolvedShift = resolveAbsenceShift(a, employees);
            const dateStr = a.endDate && a.endDate !== a.date
                ? `${formatPtBr(a.date)} - ${formatPtBr(a.endDate)}`
                : formatPtBr(a.date);

            ws.addRow([
                dateStr,
                resolvedShift === 'Noturno' ? 'Noturno (Noite)' : 'Diurno (Dia)',
                a.employeeName,
                employee?.code || '-',
                employee?.role.replace('PARCEIRO_', '').replace('_', ' ') || '-',
                employee?.leaderName || '-',
                a.reason,
                a.description || '-',
                a.evidenceUrl ? 'SIM' : 'NÃO',
                a.evidenceUrl || '-'
            ]);
        });

        styleDataRows(ws, sRow);
        autoFitColumns(ws);
    };

    const buildAbsencesWorkbook = async (list: Absence[], titleLabel: string, includeShiftTabs: boolean) => {
        const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, reportMonth - 1));
        const { workbook, worksheet, startRow } = await createEletromidiaWorkbook(
            `Relatório de Faltas e Ausências (${titleLabel}) - ${monthName} / ${reportYear}`,
            'Ausências'
        );

        populateAbsencesSheet(worksheet, startRow, list);

        if (includeShiftTabs) {
            const dList = list.filter(a => resolveAbsenceShift(a, employees) === 'Diurno');
            const nList = list.filter(a => resolveAbsenceShift(a, employees) === 'Noturno');

            const wsDia = workbook.addWorksheet('Faltas - Dia (Diurno)');
            populateAbsencesSheet(wsDia, 1, dList);

            const wsNoite = workbook.addWorksheet('Faltas - Noite (Noturno)');
            populateAbsencesSheet(wsNoite, 1, nList);
        }

        // Aba Resumo de Faltas
        const wsResumo = workbook.addWorksheet('Resumo de Faltas');
        const rHeader = wsResumo.getRow(1);
        rHeader.values = ['Indicador / Motivo', 'Dia (Diurno)', 'Noite (Noturno)', 'Total'];
        styleHeaderRow(rHeader);

        const dTotal = list.filter(a => resolveAbsenceShift(a, employees) === 'Diurno').length;
        const nTotal = list.filter(a => resolveAbsenceShift(a, employees) === 'Noturno').length;
        wsResumo.addRow(['Total Geral de Ausências', dTotal, nTotal, list.length]);

        const reasons = ['Falta Injustificada', 'Falta Justificada', 'Atestado', 'Day Off', 'Banco de Horas', 'Férias', 'Afastamento', 'Outros'];
        reasons.forEach(reason => {
            const rDia = list.filter(a => a.reason === reason && resolveAbsenceShift(a, employees) === 'Diurno').length;
            const rNoite = list.filter(a => a.reason === reason && resolveAbsenceShift(a, employees) === 'Noturno').length;
            if (rDia + rNoite > 0) {
                wsResumo.addRow([reason, rDia, rNoite, rDia + rNoite]);
            }
        });

        styleDataRows(wsResumo, 1);
        autoFitColumns(wsResumo);

        return workbook;
    };

    const handleExportAbsences = async () => {
        if (periodAbsences.length === 0) {
            alert('Nenhuma ausência encontrada para o período selecionado.');
            return;
        }

        setIsExportingReport(true);
        try {
            const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, reportMonth - 1));

            if (reportExportMode === 'consolidado') {
                const wb = await buildAbsencesWorkbook(periodAbsences, 'Consolidado Dia e Noite', true);
                await saveWorkbook(wb, `Relatorio_Faltas_Consolidado_${monthName}_${reportYear}`);
            } else if (reportExportMode === 'separado') {
                const wbDia = await buildAbsencesWorkbook(diurnoPeriodAbsences, 'Turno Dia - Diurno', false);
                await saveWorkbook(wbDia, `Relatorio_Faltas_Dia_Diurno_${monthName}_${reportYear}`);

                const wbNoite = await buildAbsencesWorkbook(noturnoPeriodAbsences, 'Turno Noite - Noturno', false);
                await saveWorkbook(wbNoite, `Relatorio_Faltas_Noite_Noturno_${monthName}_${reportYear}`);
            } else if (reportExportMode === 'diurno') {
                const wbDia = await buildAbsencesWorkbook(diurnoPeriodAbsences, 'Turno Dia - Diurno', false);
                await saveWorkbook(wbDia, `Relatorio_Faltas_Dia_Diurno_${monthName}_${reportYear}`);
            } else if (reportExportMode === 'noturno') {
                const wbNoite = await buildAbsencesWorkbook(noturnoPeriodAbsences, 'Turno Noite - Noturno', false);
                await saveWorkbook(wbNoite, `Relatorio_Faltas_Noite_Noturno_${monthName}_${reportYear}`);
            }

            setIsReportModalOpen(false);
        } catch (err) {
            console.error('Erro ao exportar ausências:', err);
            alert('Erro ao exportar planilha de ausências.');
        } finally {
            setIsExportingReport(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setErrorMessage(null);
        setImportStats(null);

        try {
            const rows = await readXlsxFile(file);
            if (rows.length === 0) throw new Error('Arquivo vazio');

            // Find headers
            const headers = rows[0].map(h => h?.toString().toLowerCase().trim());
            const colMap = {
                name: headers.findIndex(h => h === 'nome' || h === 'funcionario' || h === 'colaborador' || h === 'nome do colaborador'),
                email: headers.findIndex(h => h === 'email' || h === 'e-mail'),
                role: headers.findIndex(h => h === 'cargo' || h === 'funcao'),
                code: headers.findIndex(h => h === 'cadastro' || h === 'matricula' || h === 'id'),
                shift: headers.findIndex(h => h === 'turno'),
                leader: headers.findIndex(h => h === 'lider' || h === 'liderança' || h === 'lideranca'),
                status: headers.findIndex(h => h === 'status')
            };

            const dataRows = rows.slice(1);
            const newEmployees: Omit<Employee, 'id' | 'status' | 'avatar'>[] = [];

            for (const row of dataRows) {
                const name = colMap.name !== -1 ? row[colMap.name]?.toString() : null;
                // Use email column if exists, otherwise generate from Name
                let email = colMap.email !== -1 ? row[colMap.email]?.toString() : null;
                const code = colMap.code !== -1 ? row[colMap.code]?.toString() : null;
                const roleInput = colMap.role !== -1 ? row[colMap.role]?.toString()?.toUpperCase() : '';
                const shift = colMap.shift !== -1 ? row[colMap.shift]?.toString() : undefined;
                const leaderName = colMap.leader !== -1 ? row[colMap.leader]?.toString() : undefined;
                const rawStatus = colMap.status !== -1 ? row[colMap.status]?.toString() : undefined;

                // Generate email if missing: firstname.lastname@eletromidia.com.br
                if (!email && name) {
                    const cleanName = name.trim().toLowerCase().replace(/\s+/g, ' ');
                    const parts = cleanName.split(' ');
                    if (parts.length > 1) {
                        const first = parts[0];
                        const last = parts[parts.length - 1];
                        email = `${first}.${last}@eletromidia.com.br`;
                    } else {
                        email = `${parts[0]}@eletromidia.com.br`;
                    }
                }

                if (!name) continue;

                // Map Role
                let role: UserRole = UserRole.TECNICO;
                if (roleInput?.includes('LIDER') || roleInput?.includes('LÍDER') || roleInput?.includes('SUPERVISOR') || roleInput?.includes('COORDENADOR')) role = UserRole.LIDER;
                if (roleInput?.includes('CHEFE') || roleInput?.includes('GERENTE')) role = UserRole.CHEFE;

                // Adjust for partners
                if (currentUser.companyId !== 'internal') {
                    if (role === UserRole.TECNICO) role = UserRole.PARCEIRO_TECNICO;
                    if (role === UserRole.LIDER) role = UserRole.PARCEIRO_LIDER;
                    if (role === UserRole.CHEFE) role = UserRole.PARCEIRO_CHEFE;
                }

                newEmployees.push({
                    name,
                    email: email!,
                    role,
                    companyId: currentUser.companyId,
                    companyName: currentUser.companyName,
                    shift,
                    code,
                    leaderName,
                    originalStatus: rawStatus
                });
            }

            if (newEmployees.length === 0) {
                setErrorMessage('Nenhum funcionário válido encontrado.');
                setImporting(false);
                return;
            }

            await bulkCreateEmployees(newEmployees);
            setImportStats({ total: newEmployees.length, success: newEmployees.length });
            loadEmployees();
            setTimeout(() => {
                // Keep modal open
            }, 1000);

        } catch (err: any) {
            console.error('Import error:', err);
            setErrorMessage(err.message || 'Erro ao processar arquivo.');
        } finally {
            setImporting(false);
        }
    };

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleAddSingleEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addEmployeeForm.name.trim()) return;

        setAddingEmployee(true);
        try {
            // Generate email if not provided
            let email = addEmployeeForm.email.trim();
            if (!email) {
                const cleanName = addEmployeeForm.name.trim().toLowerCase().replace(/\s+/g, ' ');
                const parts = cleanName.split(' ');
                if (parts.length > 1) {
                    const first = parts[0];
                    const last = parts[parts.length - 1];
                    email = `${first}.${last}@eletromidia.com.br`;
                } else {
                    email = `${parts[0]}@eletromidia.com.br`;
                }
            }

            // Map role
            let role: UserRole = addEmployeeForm.role as UserRole;
            if (currentUser.companyId !== 'internal') {
                if (role === UserRole.TECNICO) role = UserRole.PARCEIRO_TECNICO;
                if (role === UserRole.LIDER) role = UserRole.PARCEIRO_LIDER;
                if (role === UserRole.CHEFE) role = UserRole.PARCEIRO_CHEFE;
            }

            const newEmployee = {
                name: addEmployeeForm.name.trim(),
                email,
                role,
                companyId: currentUser.companyId,
                companyName: currentUser.companyName,
                shift: addEmployeeForm.shift || undefined,
                code: addEmployeeForm.code || undefined,
                leaderName: addEmployeeForm.leaderName || undefined
            };

            await bulkCreateEmployees([newEmployee]);
            alert('Funcionário adicionado com sucesso!');
            setIsAddEmployeeModalOpen(false);
            setAddEmployeeForm({ name: '', email: '', code: '', role: 'TECNICO', shift: '', leaderName: '' });
            loadEmployees();
        } catch (err) {
            console.error('Error adding employee:', err);
            alert('Erro ao adicionar funcionário.');
        } finally {
            setAddingEmployee(false);
        }
    };

    const filteredEmployees = employees.filter(employee => {
        const matchesSearch =
            employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (employee.code && employee.code.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesRole = !filters.role || employee.role === filters.role;
        const matchesStatus = !filters.originalStatus || employee.originalStatus === filters.originalStatus;
        const matchesShift = !filters.shift || employee.shift === filters.shift;
        const matchesLeader = !filters.leaderName || employee.leaderName === filters.leaderName;

        return matchesSearch && matchesRole && matchesStatus && matchesShift && matchesLeader;
    }).sort((a, b) => {
        if (!sortConfig) return 0;

        let aValue: any = (a as any)[sortConfig.key] || '';
        let bValue: any = (b as any)[sortConfig.key] || '';

        // Special case for Name column (it's nested in a UI sense, but data-wise it's flat)
        if (sortConfig.key === 'name') {
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="ooh-card p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold font-display text-[#141518] tracking-tight">Gestão de Funcionários</h2>
                    <p className="text-[#5E636E] text-sm font-medium mt-1">Visualize e gerencie o quadro técnico, escalas de turno e ausências</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-2 bg-white border border-[#E6E8EC] text-[#141518] hover:bg-[#F8F9FA] px-4 py-2.5 rounded-xl font-semibold text-xs transition-all"
                    >
                        <FileText size={15} className="text-[#5E636E]" /> Relatórios RH
                    </button>
                    <button
                        onClick={() => setIsAddEmployeeModalOpen(true)}
                        className="flex items-center gap-2 bg-[#141518] hover:bg-[#23252A] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm"
                    >
                        <Plus size={15} className="text-[#FF4F00]" /> Adicionar Colaborador
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 bg-[#FF4F00] hover:bg-[#E04400] text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm"
                    >
                        <Upload size={15} /> Importar Excel
                    </button>
                </div>
            </div>

            <div className="ooh-card overflow-hidden">
                <div className="p-4 md:p-5 border-b border-[#E6E8EC] bg-[#FAFbfc] flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8F96A3]" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, e-mail ou matrícula..."
                            className="ooh-input pl-10 pr-10 py-2.5 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8F96A3] hover:text-[#141518]"
                            >
                                <AlertCircle size={14} className="rotate-45" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${isFilterBarOpen || Object.values(filters).some(v => v !== '')
                            ? 'bg-[#FFF5F2] border-[#FF4F00]/30 text-[#FF4F00]'
                            : 'bg-white border-[#E6E8EC] text-[#5E636E] hover:bg-[#F8F9FA] hover:text-[#141518]'
                            }`}
                    >
                        <Filter size={15} className={Object.values(filters).some(v => v !== '') ? 'animate-pulse' : ''} />
                        Filtros {Object.values(filters).filter(v => v !== '').length > 0 && `(${Object.values(filters).filter(v => v !== '').length})`}
                    </button>

                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={isDeletingBulk}
                            className="flex items-center gap-2 bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border border-[#FECACA]"
                        >
                            <Trash2 size={15} /> Excluir ({selectedIds.length})
                        </button>
                    )}

                    <div className="px-3 py-1.5 rounded-full bg-[#ECEEF2] text-xs font-semibold text-[#5E636E] font-mono-code">
                        Total: {filteredEmployees.length}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#E6E8EC] bg-[#FAFbfc]">
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-[#D0D5DD] text-[#FF4F00] focus:ring-[#FF4F00]"
                                        onChange={handleSelectAll}
                                        checked={selectedIds.length > 0 && selectedIds.length === filteredEmployees.filter(e => e.status === 'PENDING').length}
                                    />
                                </th>
                                {[
                                    { key: 'shift', label: 'Turno' },
                                    { key: 'code', label: 'Matrícula' },
                                    { key: 'leaderName', label: 'Líder' },
                                    { key: 'name', label: 'Colaborador' },
                                    { key: 'role', label: 'Cargo' },
                                    { key: 'originalStatus', label: 'Status' }
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        className="p-4 text-[11px] font-semibold uppercase tracking-wider text-[#5E636E] cursor-pointer hover:text-[#141518] transition-colors group"
                                        onClick={() => requestSort(col.key)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            <div className={`transition-opacity ${sortConfig?.key === col.key ? 'opacity-100 text-[#FF4F00]' : 'opacity-0 group-hover:opacity-40'}`}>
                                                {sortConfig?.key === col.key && sortConfig.direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-4 text-[11px] font-semibold uppercase tracking-wider text-[#5E636E] text-right">Ações</th>
                            </tr>

                            {isFilterBarOpen && (
                                <tr className="bg-[#F8F9FA] border-b border-[#E6E8EC] animate-in slide-in-from-top-2">
                                    <td className="p-2.5"></td>
                                    <td className="p-2.5">
                                        <select
                                            value={filters.shift}
                                            onChange={(e) => setFilters(prev => ({ ...prev, shift: e.target.value }))}
                                            className="w-full p-1.5 bg-white border border-[#E6E8EC] rounded-lg text-xs font-medium text-[#141518] focus:ring-1 focus:ring-[#FF4F00]"
                                        >
                                            <option value="">Todos</option>
                                            {Array.from(new Set(employees.map(e => e.shift).filter(Boolean))).map(s => <option key={s} value={s!}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2.5"></td>
                                    <td className="p-2.5">
                                        <select
                                            value={filters.leaderName}
                                            onChange={(e) => setFilters(prev => ({ ...prev, leaderName: e.target.value }))}
                                            className="w-full p-1.5 bg-white border border-[#E6E8EC] rounded-lg text-xs font-medium text-[#141518] focus:ring-1 focus:ring-[#FF4F00]"
                                        >
                                            <option value="">Todos</option>
                                            {Array.from(new Set(employees.map(e => e.leaderName).filter(Boolean))).map(l => <option key={l} value={l!}>{l}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2.5"></td>
                                    <td className="p-2.5">
                                        <select
                                            value={filters.role}
                                            onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                                            className="w-full p-1.5 bg-white border border-[#E6E8EC] rounded-lg text-xs font-medium text-[#141518] focus:ring-1 focus:ring-[#FF4F00]"
                                        >
                                            <option value="">Todos</option>
                                            {Array.from(new Set(employees.map(e => e.role))).sort().map(r => (
                                                <option key={r} value={r}>{(r as string).replace('PARCEIRO_', '').replace('_', ' ')}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2.5">
                                        <select
                                            value={filters.originalStatus}
                                            onChange={(e) => setFilters(prev => ({ ...prev, originalStatus: e.target.value }))}
                                            className="w-full p-1.5 bg-white border border-[#E6E8EC] rounded-lg text-xs font-medium text-[#141518] focus:ring-1 focus:ring-[#FF4F00]"
                                        >
                                            <option value="">Todos</option>
                                            {Array.from(new Set(employees.map(e => e.originalStatus).filter(Boolean))).map(s => <option key={s} value={s!}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2.5 text-right">
                                        <button
                                            onClick={() => {
                                                setFilters({ role: '', originalStatus: '', shift: '', leaderName: '' });
                                                setSortConfig(null);
                                            }}
                                            className="text-xs font-semibold text-[#5E636E] hover:text-[#DC2626] px-2 py-1"
                                        >
                                            Limpar
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-[#EEF0F3]">
                            {loading ? (
                                <tr><td colSpan={8} className="p-10 text-center text-[#8F96A3] text-sm">Carregando quadro de funcionários...</td></tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr><td colSpan={8} className="p-10 text-center text-[#8F96A3] text-sm">Nenhum funcionário encontrado</td></tr>
                            ) : (
                                filteredEmployees.map(employee => (
                                    <tr key={employee.id} className={`group hover:bg-[#F8F9FA] transition-colors ${selectedIds.includes(employee.id) ? 'bg-[#FFF5F2]' : ''}`}>
                                        <td className="p-4">
                                            {employee.status === 'PENDING' ? (
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-[#D0D5DD] text-[#FF4F00] focus:ring-[#FF4F00]"
                                                    checked={selectedIds.includes(employee.id)}
                                                    onChange={() => handleSelectEmployee(employee.id)}
                                                />
                                            ) : (
                                                <div className="w-4" />
                                            )}
                                        </td>
                                        <td className="p-4 text-xs font-medium text-[#5E636E]">{employee.shift || '-'}</td>
                                        <td className="p-4 text-xs font-mono-code font-medium text-[#141518]">{employee.code || '-'}</td>
                                        <td className="p-4 text-xs font-medium text-[#5E636E]">{employee.leaderName || '-'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img src={employee.avatar} alt={employee.name} className="w-9 h-9 rounded-full bg-[#ECEEF2] object-cover border border-[#E6E8EC]" />
                                                    {(() => {
                                                        const activeAbsence = getEmployeeActiveAbsence(employee);
                                                        if (activeAbsence) {
                                                            const colorClass = activeAbsence.reason === 'Férias' ? 'bg-blue-500' : activeAbsence.reason === 'Afastamento' ? 'bg-orange-500' : 'bg-red-500';
                                                            return <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${colorClass} border-2 border-white rounded-full`} title={activeAbsence.reason} />;
                                                        }
                                                        if (employee.status === 'ACTIVE') {
                                                            return <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title="Ativo" />;
                                                        }
                                                        return <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 border-2 border-white rounded-full animate-pulse" title="Convite Pendente" />;
                                                    })()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-[#141518] text-sm block">{employee.name}</span>
                                                        {(() => {
                                                            const a = getEmployeeActiveAbsence(employee);
                                                            if (!a) return null;
                                                            return (
                                                                <div key={a.id} className="flex items-center gap-1">
                                                                    <span className="bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] rounded-full text-[10px] font-semibold px-2 py-0.5">
                                                                        {a.reason === 'Férias' ? 'Em Férias' : a.reason === 'Afastamento' ? 'Afastado' : 'Ausente'}
                                                                    </span>
                                                                    {a.evidenceUrl && (
                                                                        <button
                                                                            onClick={() => setSelectedEvidenceUrl(a.evidenceUrl!)}
                                                                            className="p-0.5 text-[#DC2626] hover:text-[#991B1B] transition-colors"
                                                                            title="Ver comprovante"
                                                                        >
                                                                            <Eye size={13} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <span className="text-xs text-[#8F96A3] block">{employee.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-[11px] font-semibold text-[#141518] px-2.5 py-1 bg-[#F4F5F7] border border-[#E6E8EC] rounded-lg">
                                                {employee.role.replace('PARCEIRO_', '').replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs font-medium text-[#5E636E]">
                                            {(() => {
                                                const activeAbsence = getEmployeeActiveAbsence(employee);
                                                if (activeAbsence) {
                                                    const colorClass = activeAbsence.reason === 'Férias' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]';
                                                    return (
                                                        <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${colorClass}`}>
                                                            {activeAbsence.reason}
                                                        </span>
                                                    );
                                                }
                                                if (employee.originalStatus) {
                                                    return (
                                                        <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${employee.originalStatus.includes('afastado') ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' : 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'}`}>
                                                            {employee.originalStatus}
                                                        </span>
                                                    );
                                                }
                                                return <span className="text-[#8F96A3]">-</span>;
                                            })()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {(() => {
                                                    const activeAbsence = getEmployeeActiveAbsence(employee);
                                                    if (activeAbsence) {
                                                        return (
                                                            <button
                                                                onClick={() => handleRemoveAbsence(employee)}
                                                                className="p-2 text-[#059669] hover:text-[#047857] hover:bg-[#ECFDF5] rounded-xl transition-all"
                                                                title={`Retornar ao trabalho (Remover ${activeAbsence.reason})`}
                                                            >
                                                                <RotateCcw size={16} />
                                                            </button>
                                                        );
                                                    }
                                                    return (
                                                        <button
                                                            onClick={() => handleOpenAbsenceModal(employee)}
                                                            className="p-2 text-[#5E636E] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl transition-all"
                                                            title="Registrar Ausência"
                                                        >
                                                            <CalendarOff size={16} />
                                                        </button>
                                                    );
                                                })()}
                                                {employee.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleDeleteInvite(employee.id)}
                                                        className="p-2 text-[#5E636E] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl transition-all"
                                                        title="Remover convite"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isImportModalOpen && (
                <div className="fixed inset-0 bg-[#141518]/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="ooh-card shadow-2xl p-7 max-w-md w-full relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsImportModalOpen(false)}
                            className="absolute top-5 right-5 p-2 text-[#8F96A3] hover:text-[#141518] hover:bg-[#F4F5F7] rounded-xl"
                        >
                            <AlertCircle size={18} className="rotate-45" />
                        </button>

                        <h3 className="text-xl font-bold font-display text-[#141518] mb-1.5">Importar Funcionários</h3>
                        <p className="text-[#5E636E] text-sm mb-6">Selecione uma planilha Excel contendo as colunas: <strong>Turno, Cadastro, Lider, Nome, Cargo, Status</strong>.</p>

                        <div className="border-2 border-dashed border-[#D0D5DD] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#FF4F00] hover:bg-[#FFF5F2]/50 transition-all text-center group cursor-pointer relative">
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={importing}
                            />
                            <div className="w-12 h-12 bg-[#FFF5F2] text-[#FF4F00] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Upload size={22} />
                            </div>
                            <div>
                                <p className="font-semibold text-[#141518] text-sm">Clique para selecionar o arquivo</p>
                                <p className="text-xs text-[#8F96A3] mt-0.5">Formato suportado: .xlsx</p>
                            </div>
                        </div>

                        {importing && (
                            <div className="mt-6 flex flex-col items-center gap-2 text-center animate-in fade-in">
                                <div className="w-7 h-7 border-3 border-[#FF4F00] border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-xs font-semibold text-[#FF4F00]">Processando planilha...</p>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="mt-5 p-3.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-xl text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={16} /> {errorMessage}
                            </div>
                        )}

                        {importStats && (
                            <div className="mt-5 p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] rounded-xl text-xs font-semibold flex items-center gap-2">
                                <CheckCircle2 size={18} />
                                <span>Sucesso! {importStats.success} funcionários importados.</span>
                            </div>
                        )}

                        <div className="mt-6 pt-4 border-t border-[#E6E8EC] flex justify-between items-center">
                            <button
                                onClick={handleDownloadTemplate}
                                className="text-[#FF4F00] text-xs font-semibold hover:underline"
                            >
                                Baixar Planilha Modelo
                            </button>
                            <button
                                onClick={() => setIsImportModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-[#F4F5F7] text-xs font-semibold text-[#5E636E] hover:text-[#141518]"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isAbsenceModalOpen && (
                <div className="fixed inset-0 bg-[#141518]/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="ooh-card shadow-2xl p-7 max-w-md w-full relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsAbsenceModalOpen(false)}
                            className="absolute top-5 right-5 p-2 text-[#8F96A3] hover:text-[#141518] hover:bg-[#F4F5F7] rounded-xl"
                        >
                            <AlertCircle size={18} className="rotate-45" />
                        </button>

                        <h3 className="text-xl font-bold font-display text-[#141518] mb-1">Registrar Ausência</h3>
                        <p className="text-[#5E636E] text-sm mb-6">Colaborador: <strong className="text-[#141518]">{selectedEmployeeForAbsence?.name}</strong></p>

                        <form onSubmit={handleSubmitAbsence} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Motivo da Ausência</label>
                                    <select
                                        required
                                        className="ooh-input py-2.5 text-sm font-medium"
                                        value={absenceForm.reason}
                                        onChange={e => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                                    >
                                        <option value="Falta Injustificada">Falta Injustificada</option>
                                        <option value="Falta Justificada">Falta Justificada</option>
                                        <option value="Day Off">Day Off</option>
                                        <option value="Atestado">Atestado</option>
                                        <option value="Banco de Horas">Banco de Horas</option>
                                        <option value="Férias">Férias</option>
                                        <option value="Afastamento">Afastamento</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Turno da Falta / Ausência</label>
                                    <div className="grid grid-cols-2 gap-1.5 bg-[#F4F5F7] p-1 rounded-xl border border-[#E4E7EC]">
                                        <button
                                            type="button"
                                            onClick={() => setAbsenceForm({ ...absenceForm, shift: 'Diurno' })}
                                            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                                absenceForm.shift === 'Diurno'
                                                    ? 'bg-amber-500 text-white shadow-sm'
                                                    : 'text-[#5E636E] hover:text-[#141518]'
                                            }`}
                                        >
                                            <Sun size={13} /> Dia
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAbsenceForm({ ...absenceForm, shift: 'Noturno' })}
                                            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                                absenceForm.shift === 'Noturno'
                                                    ? 'bg-indigo-900 text-white shadow-sm'
                                                    : 'text-[#5E636E] hover:text-[#141518]'
                                            }`}
                                        >
                                            <Moon size={13} /> Noite
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">
                                        {(absenceForm.reason === 'Férias' || absenceForm.reason === 'Afastamento') ? 'Data Início' : 'Data'}
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className="ooh-input py-2.5 text-sm font-mono-code"
                                        value={absenceForm.date}
                                        onChange={e => setAbsenceForm({ ...absenceForm, date: e.target.value })}
                                    />
                                </div>
                                {(absenceForm.reason === 'Férias' || absenceForm.reason === 'Afastamento') && (
                                    <div className="animate-in slide-in-from-left-2">
                                        <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Data Fim</label>
                                        <input
                                            type="date"
                                            required
                                            className="ooh-input py-2.5 text-sm font-mono-code"
                                            value={absenceForm.endDate}
                                            onChange={e => setAbsenceForm({ ...absenceForm, endDate: e.target.value })}
                                            min={absenceForm.date}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Comprovante (Imagem/PDF)</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleAbsenceFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="w-full bg-[#F8F9FA] border border-[#D0D5DD] border-dashed rounded-xl p-3.5 flex items-center justify-center gap-2 text-[#5E636E] hover:bg-[#F4F5F7] transition-colors">
                                        <Upload size={15} />
                                        <span className="text-xs font-semibold">
                                            {absenceForm.evidenceFile ? absenceForm.evidenceFile.name : 'Anexar conversa ou atestado'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Observação (Opcional)</label>
                                <textarea
                                    className="ooh-input p-3 text-sm resize-none h-24"
                                    value={absenceForm.description}
                                    onChange={e => setAbsenceForm({ ...absenceForm, description: e.target.value })}
                                    placeholder="Detalhes adicionais..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold py-3 rounded-xl shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                {loading ? 'Registrando...' : 'Confirmar Ausência'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {selectedEvidenceUrl && (
                <div className="fixed inset-0 bg-[#141518]/60 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="ooh-card shadow-2xl p-5 max-w-2xl w-full relative">
                        <button
                            onClick={() => setSelectedEvidenceUrl(null)}
                            className="absolute top-3 right-3 p-2 bg-white text-[#5E636E] hover:text-[#141518] rounded-xl shadow-sm z-10"
                        >
                            <AlertCircle size={18} className="rotate-45" />
                        </button>

                        <div className="relative rounded-xl overflow-hidden bg-[#F4F5F7] flex items-center justify-center min-h-[300px]">
                            {selectedEvidenceUrl.toLowerCase().endsWith('.pdf') ? (
                                <iframe src={selectedEvidenceUrl} className="w-full h-[70vh]" />
                            ) : (
                                <img src={selectedEvidenceUrl} alt="Evidência" className="max-w-full max-h-[80vh] object-contain" />
                            )}
                        </div>

                        <div className="mt-4 flex justify-between items-center px-1">
                            <span className="text-xs font-semibold text-[#5E636E]">Comprovante de Ausência</span>
                            <a
                                href={selectedEvidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-[#141518] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#23252A] transition-all"
                            >
                                <Download size={14} /> Abrir Original
                            </a>
                        </div>
                    </div>
                </div>
            )}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-[#141518]/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="ooh-card shadow-2xl p-7 max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsReportModalOpen(false)}
                            className="absolute top-5 right-5 p-2 text-[#8F96A3] hover:text-[#141518] hover:bg-[#F4F5F7] rounded-xl"
                        >
                            <AlertCircle size={18} className="rotate-45" />
                        </button>

                        <h3 className="text-xl font-bold font-display text-[#141518] mb-1.5">Exportar Relatório de Faltas / RH</h3>
                        <p className="text-[#5E636E] text-sm mb-5">Selecione o período e o modo de separação por turno (Dia e Noite) para exportar as ausências.</p>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Mês</label>
                                    <select
                                        value={reportMonth}
                                        onChange={(e) => setReportMonth(parseInt(e.target.value))}
                                        className="ooh-input py-2.5 text-sm font-medium capitalize"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, i))}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Ano</label>
                                    <select
                                        value={reportYear}
                                        onChange={(e) => setReportYear(parseInt(e.target.value))}
                                        className="ooh-input py-2.5 text-sm font-mono-code font-medium"
                                    >
                                        {[2024, 2025, 2026].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Resumo rápido do período por turno */}
                            <div className="grid grid-cols-3 gap-2.5 bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EC]">
                                <div className="text-center">
                                    <p className="text-[10px] font-bold uppercase text-[#5E636E]">Total Faltas</p>
                                    <p className="text-lg font-black text-[#141518]">{periodAbsences.length}</p>
                                </div>
                                <div className="text-center border-x border-[#E4E7EC]">
                                    <p className="text-[10px] font-bold uppercase text-amber-700 flex items-center justify-center gap-1"><Sun size={11} /> Dia (Diurno)</p>
                                    <p className="text-lg font-black text-amber-600">{diurnoPeriodAbsences.length}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-bold uppercase text-indigo-800 flex items-center justify-center gap-1"><Moon size={11} /> Noite (Noturno)</p>
                                    <p className="text-lg font-black text-indigo-700">{noturnoPeriodAbsences.length}</p>
                                </div>
                            </div>

                            {/* Opções de Separação de Turno */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-[#5E636E] block mb-2">Modo de Exportação (Dia / Noite)</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setReportExportMode('consolidado')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            reportExportMode === 'consolidado'
                                                ? 'border-[#FF4F00] bg-orange-50/70 ring-1 ring-[#FF4F00]'
                                                : 'border-[#E4E7EC] hover:border-[#D0D5DD] bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 font-bold text-xs text-[#141518] mb-0.5">
                                            <FileSpreadsheet size={15} className="text-[#FF4F00]" />
                                            Consolidado (Abas Dia/Noite)
                                        </div>
                                        <p className="text-[11px] text-[#5E636E]">1 arquivo com aba Geral + abas separadas Dia e Noite</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setReportExportMode('separado')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            reportExportMode === 'separado'
                                                ? 'border-[#FF4F00] bg-orange-50/70 ring-1 ring-[#FF4F00]'
                                                : 'border-[#E4E7EC] hover:border-[#D0D5DD] bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 font-bold text-xs text-[#141518] mb-0.5">
                                            <Download size={15} className="text-[#FF4F00]" />
                                            Arquivos Separados (Dia + Noite)
                                        </div>
                                        <p className="text-[11px] text-[#5E636E]">Baixa 2 arquivos Excel: 1 só Dia e 1 só Noite</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setReportExportMode('diurno')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            reportExportMode === 'diurno'
                                                ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500'
                                                : 'border-[#E4E7EC] hover:border-[#D0D5DD] bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 font-bold text-xs text-amber-800 mb-0.5">
                                            <Sun size={15} className="text-amber-500" />
                                            Somente Turno Dia (Diurno)
                                        </div>
                                        <p className="text-[11px] text-[#5E636E]">Exporta apenas faltas do turno Diurno ({diurnoPeriodAbsences.length})</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setReportExportMode('noturno')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            reportExportMode === 'noturno'
                                                ? 'border-indigo-700 bg-indigo-50/70 ring-1 ring-indigo-700'
                                                : 'border-[#E4E7EC] hover:border-[#D0D5DD] bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 font-bold text-xs text-indigo-900 mb-0.5">
                                            <Moon size={15} className="text-indigo-700" />
                                            Somente Turno Noite (Noturno)
                                        </div>
                                        <p className="text-[11px] text-[#5E636E]">Exporta apenas faltas do turno Noturno ({noturnoPeriodAbsences.length})</p>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleExportAbsences}
                                disabled={isExportingReport}
                                className="w-full bg-[#141518] hover:bg-[#23252A] text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                            >
                                <Download size={17} className="text-[#FF4F00]" />
                                {isExportingReport ? 'Gerando Relatório...' : 'Gerar Excel de Faltas / Ausências'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isAddEmployeeModalOpen && (
                <div className="fixed inset-0 bg-[#141518]/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="ooh-card shadow-2xl p-7 max-w-md w-full relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsAddEmployeeModalOpen(false)}
                            className="absolute top-5 right-5 p-2 text-[#8F96A3] hover:text-[#141518] hover:bg-[#F4F5F7] rounded-xl"
                        >
                            <AlertCircle size={18} className="rotate-45" />
                        </button>

                        <h3 className="text-xl font-bold font-display text-[#141518] mb-1.5">Adicionar Colaborador</h3>
                        <p className="text-[#5E636E] text-sm mb-6">Preencha os dados abaixo. Apenas o <strong>nome</strong> é obrigatório.</p>

                        <form onSubmit={handleAddSingleEmployee} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">
                                    Nome Completo <span className="text-[#DC2626]">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="ooh-input py-2.5 text-sm"
                                    value={addEmployeeForm.name}
                                    onChange={e => setAddEmployeeForm({ ...addEmployeeForm, name: e.target.value })}
                                    placeholder="Nome completo do colaborador"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">E-mail (Opcional)</label>
                                <input
                                    type="email"
                                    className="ooh-input py-2.5 text-sm"
                                    value={addEmployeeForm.email}
                                    onChange={e => setAddEmployeeForm({ ...addEmployeeForm, email: e.target.value })}
                                    placeholder="Gerado automaticamente se vazio"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Matrícula (Opcional)</label>
                                    <input
                                        type="text"
                                        className="ooh-input py-2.5 text-sm font-mono-code"
                                        value={addEmployeeForm.code}
                                        onChange={e => setAddEmployeeForm({ ...addEmployeeForm, code: e.target.value })}
                                        placeholder="Ex: 10492"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Turno (Opcional)</label>
                                    <select
                                        className="ooh-input py-2.5 text-sm"
                                        value={addEmployeeForm.shift}
                                        onChange={e => setAddEmployeeForm({ ...addEmployeeForm, shift: e.target.value })}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="DIA">DIA</option>
                                        <option value="NOITE">NOITE</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Cargo</label>
                                    <select
                                        className="ooh-input py-2.5 text-sm"
                                        value={addEmployeeForm.role}
                                        onChange={e => setAddEmployeeForm({ ...addEmployeeForm, role: e.target.value })}
                                    >
                                        <option value="TECNICO">Técnico</option>
                                        <option value="LIDER">Líder</option>
                                        <option value="CHEFE">Chefe</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-[#5E636E] block mb-1.5">Líder Responsável</label>
                                    <input
                                        type="text"
                                        className="ooh-input py-2.5 text-sm"
                                        value={addEmployeeForm.leaderName}
                                        onChange={e => setAddEmployeeForm({ ...addEmployeeForm, leaderName: e.target.value })}
                                        placeholder="Nome do líder"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={addingEmployee || !addEmployeeForm.name.trim()}
                                className="w-full bg-[#FF4F00] hover:bg-[#E04400] text-white font-semibold py-3 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-2"
                            >
                                {addingEmployee ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Adicionando...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={18} /> Cadastrar Colaborador
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
