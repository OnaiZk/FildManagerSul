import { Absence } from '../types';

export type ShiftType = 'Diurno' | 'Noturno';
export type ShiftExportMode = 'consolidado' | 'separado' | 'diurno' | 'noturno';

export function normalizeShift(rawShift?: string | null): ShiftType {
    if (!rawShift) return 'Diurno';
    const clean = rawShift.toString().trim().toLowerCase();
    if (clean.includes('noturno') || clean.includes('noite') || clean.includes('madrugada')) {
        return 'Noturno';
    }
    return 'Diurno';
}

export function extractShiftFromNotes(notes?: string | null): { shift?: ShiftType; cleanNotes: string } {
    if (!notes) return { cleanNotes: '' };
    const match = notes.match(/^\[TURNO:\s*(Diurno|Noturno)\]\s*/i);
    if (match) {
        return {
            shift: normalizeShift(match[1]),
            cleanNotes: notes.replace(/^\[TURNO:\s*(Diurno|Noturno)\]\s*/i, '')
        };
    }
    return { cleanNotes: notes };
}

export function resolveUserShift(
    userIdOrName?: string | null,
    users?: Array<{ id?: string; name?: string; shift?: string }>
): ShiftType {
    if (!userIdOrName || !users || users.length === 0) return 'Diurno';
    const target = userIdOrName.trim().toLowerCase();
    const found = users.find(
        u =>
            (u.id && u.id.toLowerCase() === target) ||
            (u.name && u.name.trim().toLowerCase() === target)
    );
    return normalizeShift(found?.shift);
}

export function resolveAbsenceShift(
    absence: Absence,
    users?: Array<{ id?: string; name?: string; shift?: string }>
): ShiftType {
    if (absence.shift) {
        return normalizeShift(absence.shift);
    }
    const fromNotes = extractShiftFromNotes(absence.description);
    if (fromNotes.shift) {
        return fromNotes.shift;
    }
    if (users && users.length > 0) {
        const matchedUser = users.find(
            u =>
                (absence.employeeId && u.id === absence.employeeId) ||
                (absence.employeeName && u.name?.trim().toLowerCase() === absence.employeeName.trim().toLowerCase())
        );
        if (matchedUser?.shift) {
            return normalizeShift(matchedUser.shift);
        }
    }
    return 'Diurno';
}

export function resolveTimeOrUserShift(
    timeOrDate?: string | Date | null,
    userIdOrName?: string | null,
    users?: Array<{ id?: string; name?: string; shift?: string }>
): ShiftType {
    if (userIdOrName && users && users.length > 0) {
        const target = userIdOrName.trim().toLowerCase();
        const found = users.find(
            u =>
                (u.id && u.id.toLowerCase() === target) ||
                (u.name && u.name.trim().toLowerCase() === target)
        );
        if (found?.shift) {
            return normalizeShift(found.shift);
        }
    }

    if (timeOrDate) {
        if (typeof timeOrDate === 'string') {
            const hhmm = timeOrDate.match(/^(\d{1,2}):(\d{2})/);
            if (hhmm) {
                const hour = parseInt(hhmm[1], 10);
                if (hour >= 18 || hour < 6) return 'Noturno';
                return 'Diurno';
            }
            if (timeOrDate.includes('T')) {
                const d = new Date(timeOrDate);
                if (!isNaN(d.getTime())) {
                    const hour = d.getHours();
                    if (hour >= 18 || hour < 6) return 'Noturno';
                }
            }
        } else if (timeOrDate instanceof Date && !isNaN(timeOrDate.getTime())) {
            const hour = timeOrDate.getHours();
            if (hour >= 18 || hour < 6) return 'Noturno';
        }
    }

    return 'Diurno';
}
