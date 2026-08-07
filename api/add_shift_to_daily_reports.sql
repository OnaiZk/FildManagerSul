-- Migração: Adicionar coluna shift (Turno) na tabela daily_reports
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'Diurno';
