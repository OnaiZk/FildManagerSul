-- Migração: Adicionar coluna shift (Turno: Diurno / Noturno) na tabela daily_absences
ALTER TABLE daily_absences ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'Diurno';
