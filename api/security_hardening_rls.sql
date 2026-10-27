-- ============================================================================
-- OOH Ops — Eletromidia Field Manager
-- Consolidated Database & Storage Security Hardening Migration (RLS + Triggers)
-- Execute este script no SQL Editor do Supabase para blindar o banco de dados.
-- ============================================================================

-- 1. BLINDAGEM DE PROFILES (Impedir Escalonamento de Privilégio via UPDATE ou Signup)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;

-- Permite que o usuário atualize apenas nome/avatar, bloqueando alteração de role ou company_id
CREATE POLICY "profiles_update_own_safe" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
        AND company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
    );

-- Permite que apenas CHEFE interno gerencie perfis administrativos
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'CHEFE' AND p.company_id = 'internal'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'CHEFE' AND p.company_id = 'internal'
        )
    );

-- 2. TRIGGER DE NOVOS USUÁRIOS SEGURO (Valida employee_invites antes de conceder role elevada)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invite_role TEXT;
    v_invite_company_id TEXT;
    v_final_role TEXT;
    v_final_company_id TEXT;
BEGIN
    SELECT ei.role, ei.company_id
      INTO v_invite_role, v_invite_company_id
      FROM public.employee_invites ei
     WHERE LOWER(ei.email) = LOWER(new.email)
     LIMIT 1;

    -- Se houver convite pré-cadastrado pela liderança/chefia, usa o role do convite;
    -- caso contrário, força perfil 'TECNICO' (nunca confia em CHEFE/LIDER enviado pelo cliente).
    IF v_invite_role IS NOT NULL THEN
        v_final_role := v_invite_role;
        v_final_company_id := COALESCE(v_invite_company_id, 'internal');
    ELSE
        v_final_role := 'TECNICO';
        v_final_company_id := 'internal';
    END IF;

    INSERT INTO public.profiles (id, name, email, role, company_id, company_name, avatar)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        LOWER(new.email),
        v_final_role,
        v_final_company_id,
        COALESCE(new.raw_user_meta_data->>'company_name', 'Eletromidia'),
        COALESCE(new.raw_user_meta_data->>'avatar', 'https://ui-avatars.com/api/?name=' || COALESCE(new.raw_user_meta_data->>'name', 'User'))
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
END;
$$;

-- 3. ISOLAMENTO MULTI-EMPRESA EM DAILY REPORTS E DAILY ACTIVITIES
-- Corrige permissões onde PARCEIRO_CHEFE podia alterar relatórios de outras empresas
DROP POLICY IF EXISTS "daily_reports_update_v3" ON public.daily_reports;
CREATE POLICY "daily_reports_update_v3" ON public.daily_reports
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
              (p.role = 'CHEFE' AND p.company_id = 'internal')
              OR (p.role IN ('LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER') AND p.company_id = daily_reports.company_id)
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
              (p.role = 'CHEFE' AND p.company_id = 'internal')
              OR (p.role IN ('LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER') AND p.company_id = daily_reports.company_id)
          )
    )
);

DROP POLICY IF EXISTS "daily_activities_insert_v3" ON public.daily_activities;
CREATE POLICY "daily_activities_insert_v3" ON public.daily_activities
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.daily_reports dr
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE dr.id = report_id
          AND (
              (p.role = 'CHEFE' AND p.company_id = 'internal')
              OR (p.role IN ('LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER') AND dr.company_id = p.company_id)
          )
    )
);

DROP POLICY IF EXISTS "daily_activities_update_v3" ON public.daily_activities;
CREATE POLICY "daily_activities_update_v3" ON public.daily_activities
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.daily_reports dr
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE dr.id = report_id
          AND (
              (p.role = 'CHEFE' AND p.company_id = 'internal')
              OR (p.role IN ('LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER') AND dr.company_id = p.company_id)
          )
    )
);

DROP POLICY IF EXISTS "daily_activities_delete_v3" ON public.daily_activities;
CREATE POLICY "daily_activities_delete_v3" ON public.daily_activities
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.daily_reports dr
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE dr.id = report_id
          AND (
              (p.role = 'CHEFE' AND p.company_id = 'internal')
              OR (p.role IN ('LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER') AND dr.company_id = p.company_id)
          )
    )
);

-- 4. BLINDAGEM DE STORAGE BUCKETS (Limites de tamanho e tipos MIME permitidos)
UPDATE storage.buckets
   SET file_size_limit = 5242880, -- 5MB
       allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
 WHERE id = 'assets';

UPDATE storage.buckets
   SET file_size_limit = 2097152, -- 2MB
       allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
 WHERE id = 'avatars';

UPDATE storage.buckets
   SET file_size_limit = 5242880, -- 5MB
       allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
 WHERE id = 'absences';
