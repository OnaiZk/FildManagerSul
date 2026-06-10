-- =====================================================
-- INSERIR VEÍCULOS DA FROTA SUL
-- Execute TUDO de uma vez no SQL Editor do Supabase
-- =====================================================

-- 1. Garantir que a tabela tenha as colunas extras (current_km, last_maintenance_km, maintenance_notes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'current_km') THEN
        ALTER TABLE vehicles ADD COLUMN current_km DOUBLE PRECISION DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'last_maintenance_km') THEN
        ALTER TABLE vehicles ADD COLUMN last_maintenance_km DOUBLE PRECISION DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'maintenance_notes') THEN
        ALTER TABLE vehicles ADD COLUMN maintenance_notes TEXT;
    END IF;
END $$;

-- 2. Desabilitar RLS temporariamente
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;

-- 3. Limpar veículos antigos com essas placas (evitar conflito UNIQUE)
DELETE FROM vehicles WHERE plate IN (
  'SUM-7F20','SVB-1B71','STB-6D91','SVO-8C70','SVJ-9I60',
  'SSW-2B60','STJ-1I20','SWY-1B71','STB-9D21','SVA-0B41',
  'SSW-2C62','STU-9C54','SUY-3F24','STK-5A97','TJP-8H85',
  'SVO-2E92','TLU-9B89','TKK-7E87','TCT-7A04'
);

-- 4. Inserir todos os 19 veículos
INSERT INTO vehicles (plate, brand, model, type, status, company_id, tag, current_km, last_maintenance_km) VALUES
('SUM-7F20', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '60', 0, 0),
('SVB-1B71', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '61', 0, 0),
('STB-6D91', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '62', 0, 0),
('SVO-8C70', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '63', 0, 0),
('SVJ-9I60', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '64', 0, 0),
('SSW-2B60', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '65', 0, 0),
('STJ-1I20', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '66', 0, 0),
('SWY-1B71', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '67', 0, 0),
('STB-9D21', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '68', 0, 0),
('SVA-0B41', 'Volkswagen', 'SAVEIRO', 'Utilitário', 'Disponível', 'internal', '69', 0, 0),
('SSW-2C62', 'Kia',        'BONGO',   'Utilitário', 'Disponível', 'internal', '71', 0, 0),
('STU-9C54', 'Fiat',       'FIORINO', 'Utilitário', 'Disponível', 'internal', '72', 0, 0),
('SUY-3F24', 'Fiat',       'FIORINO', 'Utilitário', 'Disponível', 'internal', '73', 0, 0),
('STK-5A97', 'Fiat',       'FIORINO', 'Utilitário', 'Disponível', 'internal', '74', 0, 0),
('TJP-8H85', 'Fiat',       'FIORINO', 'Utilitário', 'Disponível', 'internal', '75', 0, 0),
('SVO-2E92', 'Fiat',       'FIORINO', 'Utilitário', 'Disponível', 'internal', '76', 0, 0),
('TLU-9B89', 'Toyota',     'YARIS',   'Passeio',    'Disponível', 'internal', '77', 0, 0),
('TKK-7E87', 'Fiat',       'DUCATO',  'Van',        'Disponível', 'internal', '78', 0, 0),
('TCT-7A04', 'Fiat',       'DUCATO',  'Van',        'Disponível', 'internal', '79', 0, 0);

-- 5. Reativar RLS com políticas permissivas
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_vehicles" ON vehicles;
DROP POLICY IF EXISTS "allow_insert_vehicles" ON vehicles;
DROP POLICY IF EXISTS "allow_update_vehicles" ON vehicles;
DROP POLICY IF EXISTS "allow_delete_vehicles" ON vehicles;

CREATE POLICY "allow_select_vehicles" ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_vehicles" ON vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_update_vehicles" ON vehicles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "allow_delete_vehicles" ON vehicles FOR DELETE TO authenticated USING (true);

-- 6. Fazer o mesmo para vehicle_control (usado no relatório diário)
ALTER TABLE vehicle_control ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_vehicle_control" ON vehicle_control;
DROP POLICY IF EXISTS "allow_insert_vehicle_control" ON vehicle_control;
DROP POLICY IF EXISTS "allow_update_vehicle_control" ON vehicle_control;
DROP POLICY IF EXISTS "allow_delete_vehicle_control" ON vehicle_control;

CREATE POLICY "allow_select_vehicle_control" ON vehicle_control FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_vehicle_control" ON vehicle_control FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_update_vehicle_control" ON vehicle_control FOR UPDATE TO authenticated USING (true);
CREATE POLICY "allow_delete_vehicle_control" ON vehicle_control FOR DELETE TO authenticated USING (true);

-- 7. Verificar: deve mostrar 19 veículos
SELECT count(*) as total_veiculos FROM vehicles;
