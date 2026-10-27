import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { User, UserRole, Task, Team } from './types';
import TechnicianView from './components/TechnicianView';
import LeaderView from './components/LeaderView';
import ChiefView from './components/ChiefView';
import EquipesView from './components/EquipesView';
import MapaView from './components/MapaView';
import OSView from './components/OSView';
import { TeamStatusView } from './components/TeamStatusView';
import Login from './components/Login';
import { ProfileSettings } from './components/ProfileSettings';
import { MeasurementView } from './components/MeasurementView';
import { EmployeesView } from './components/EmployeesView';
import { VehicleControlView } from './components/VehicleControlView';
import OpecManagementView from './components/OpecManagementView';
import { LeaderDashboardView } from './components/LeaderDashboardView';
import { ReportsView } from './components/ReportsView';
import { DailyReportView } from './components/DailyReportView';
import { WeeklyAgendaView } from './components/WeeklyAgendaView';
import { RouteControlView } from './components/RouteControlView';
import { HomeView } from './components/HomeView';
import { supabase } from './api/supabaseClient';
import { ThemeProvider, companyThemes } from './contexts/ThemeContext';
import {
  LogOut,
  LayoutDashboard,
  Users,
   X,
  Settings,
  Menu,
  Car,
  Smartphone,
  ListTodo,
  Home,
  BookOpen
} from 'lucide-react';
import { getTasksByUserId, getTeams, getAllUsers, createTeam, updateTeam, deleteTeam } from './api/fieldManagerApi';
import { useOfflineSync } from './hooks/useOfflineSync';

type Tab =
  | 'home'
  | 'leader_dashboard'
  | 'dashboard'
  | 'equipes'
  | 'mapa'
  | 'os'
  | 'monitoramento'
  | 'medicao'
  | 'funcionarios'
  | 'veiculos'
  | 'opec'
  | 'reports'
  | 'daily_report'
  | 'weekly_agenda'
  | 'route_control';

interface NavItemConfig {
  id: Tab;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Sliding capsule navbar refs & state
  const navTrackRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  // Background sync for offline evidence
  useOfflineSync(() => {});

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      if (params.get('type') === 'recovery' || params.get('access_token')) {
        setIsRecoveryMode(true);
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: { user } } = await supabase.auth.getUser();
        const meta = user?.user_metadata || {};
        const userCompanyId = meta.company_id || 'internal';
        const isUserInternal = userCompanyId === 'internal';
        const savedPortal = localStorage.getItem('active_portal');

        if (
          savedPortal &&
          ((savedPortal === 'internal' && !isUserInternal) ||
            (savedPortal === 'partner' && isUserInternal))
        ) {
          console.warn('Portal mismatch detected:', { savedPortal, isUserInternal });
          await supabase.auth.signOut();
          localStorage.removeItem('active_portal');
          setLoading(false);
          return;
        }

        currentUserIdRef.current = session.user.id;
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        currentUserIdRef.current = null;
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      if (currentUserIdRef.current !== session.user.id) {
        currentUserIdRef.current = session.user.id;
        fetchProfile(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile && !error) {
        const role = profile.role as UserRole;
        const isTech = role === UserRole.TECNICO || role === UserRole.PARCEIRO_TECNICO;
        setCurrentUser({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: role,
          companyId: profile.company_id,
          companyName: profile.company_name,
          avatar: profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}`,
        });
        setActiveTab(isTech ? 'dashboard' : 'home');
      } else if (!profile && !error) {
        // Profile row doesn't exist yet in this database — auto-create from auth user metadata (self-healing)
        console.warn('Profile not found in DB, attempting self-healing from auth metadata...');
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
          const meta = authUser.user_metadata || {};
          const fallbackName = meta.name || authUser.email?.split('@')[0] || 'Usuário';
          const fallbackRole = (meta.role as UserRole) || UserRole.TECNICO;
          const fallbackCompanyId = meta.company_id || 'internal';
          const fallbackCompanyName = meta.company_name || 'Eletromidia Sul';
          const fallbackAvatar = meta.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`;

          const { data: createdProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert({
              id: authUser.id,
              name: fallbackName,
              email: authUser.email || '',
              role: fallbackRole,
              company_id: fallbackCompanyId,
              company_name: fallbackCompanyName,
              avatar: fallbackAvatar,
            })
            .select('*')
            .single();

          if (createdProfile && !insertError) {
            const role = createdProfile.role as UserRole;
            const isTech = role === UserRole.TECNICO || role === UserRole.PARCEIRO_TECNICO;
            setCurrentUser({
              id: createdProfile.id,
              name: createdProfile.name,
              email: createdProfile.email,
              role: role,
              companyId: createdProfile.company_id,
              companyName: createdProfile.company_name,
              avatar: createdProfile.avatar,
            });
            setActiveTab(isTech ? 'dashboard' : 'home');
            return;
          } else {
            console.error('Failed to auto-create profile:', insertError);
          }
        }

        await supabase.auth.signOut();
        setCurrentUser(null);
      } else {
        console.error('Error fetching profile:', { userId, error });
        await supabase.auth.signOut();
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAllData();

      const tasksSubscription = supabase
        .channel('tasks-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          loadTasks();
        })
        .subscribe();

      const teamsSubscription = supabase
        .channel('teams-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
          loadTeams();
        })
        .subscribe();

      const profilesSubscription = supabase
        .channel('profiles-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          loadUsers();
        })
        .subscribe();

      return () => {
        tasksSubscription.unsubscribe();
        teamsSubscription.unsubscribe();
        profilesSubscription.unsubscribe();
      };
    }
  }, [currentUser]);

  const loadAllData = async () => {
    if (!currentUser) return;
    await Promise.all([loadTasks(), loadTeams(), loadUsers()]);
  };

  const loadTasks = async () => {
    if (!currentUser) return;
    const data = await getTasksByUserId(currentUser.id);
    setTasks(data);
  };

  const loadTeams = async () => {
    if (!currentUser) return;
    const data = await getTeams(currentUser.companyId);
    setTeams(data);
  };

  const loadUsers = async () => {
    if (!currentUser) return;
    const data = await getAllUsers(currentUser.companyId);
    setUsers(data);
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    try {
      setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
      const { error } = await supabase
        .from('tasks')
        .update({
          status: updatedTask.status,
          blocking_reason: updatedTask.blockingReason,
          not_performed_reason: updatedTask.notPerformedReason,
          started_at: updatedTask.startedAt?.toISOString(),
          completed_at: updatedTask.completedAt?.toISOString(),
        })
        .eq('id', updatedTask.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating task:', err);
      loadTasks();
    }
  };

  const handleCreateTask = async (newTaskPartial: Omit<Task, 'id'>) => {
    try {
      const dbTask = {
        id: `task_${Date.now()}`,
        asset_id: newTaskPartial.assetId,
        asset_json: newTaskPartial.asset,
        service_type: newTaskPartial.serviceType,
        status: newTaskPartial.status,
        technician_id: newTaskPartial.technicianId,
        leader_id: newTaskPartial.leaderId,
        company_id: newTaskPartial.companyId,
        scheduled_date: newTaskPartial.scheduledDate,
        description: newTaskPartial.description,
      };
      const { error } = await supabase.from('tasks').insert(dbTask);
      if (error) throw error;
      loadTasks();
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleCreateTeam = async (newTeamPartial: Omit<Team, 'id'>) => {
    try {
      await createTeam(newTeamPartial);
      loadTeams();
    } catch (err) {
      console.error('Error creating team:', err);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await deleteTeam(teamId);
      loadTeams();
    } catch (err) {
      console.error('Error deleting team:', err);
    }
  };

  const handleUpdateTeam = async (updatedTeam: Team) => {
    try {
      await updateTeam(updatedTeam.id, updatedTeam);
      loadTeams();
    } catch (err) {
      console.error('Error updating team:', err);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const isTechnician = useMemo(
    () => currentUser?.role === UserRole.TECNICO || currentUser?.role === UserRole.PARCEIRO_TECNICO,
    [currentUser]
  );

  const isPartner = currentUser ? currentUser.companyId !== 'internal' : false;

  const navItems: NavItemConfig[] = useMemo(() => {
    if (isTechnician) return [];
    const items: NavItemConfig[] = [
      { id: 'home', label: 'Início', icon: <Home size={15} /> },
      { id: 'leader_dashboard', label: 'Painel do Líder', shortLabel: 'Painel Líder', icon: <LayoutDashboard size={15} /> },
      { id: 'daily_report', label: 'Relatório Diário', icon: <ListTodo size={15} /> },
      { id: 'weekly_agenda', label: 'Diário Semanal', icon: <BookOpen size={15} /> },
      { id: 'funcionarios', label: 'Funcionários', icon: <Users size={15} /> },
    ];
    if (!isPartner) {
      items.push(
        { id: 'opec', label: 'Gestão de OPEC', shortLabel: 'OPEC', icon: <Smartphone size={15} /> },
        { id: 'veiculos', label: 'Controle de Frota', shortLabel: 'Frota', icon: <Car size={15} /> }
      );
    }
    return items;
  }, [isTechnician, isPartner]);

  const updatePillIndicator = useCallback(() => {
    const activeButton = tabRefs.current[activeTab];
    const track = navTrackRef.current;
    if (activeButton && track) {
      setPillStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
        opacity: 1,
      });
    } else {
      setPillStyle(prev => ({ ...prev, opacity: 0 }));
    }
  }, [activeTab]);

  useEffect(() => {
    updatePillIndicator();
    const timer = setTimeout(updatePillIndicator, 80);

    // Recalculate once custom fonts finish loading so pill width is 100% accurate
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        updatePillIndicator();
      });
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && navTrackRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updatePillIndicator();
      });
      resizeObserver.observe(navTrackRef.current);
    }

    window.addEventListener('resize', updatePillIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePillIndicator);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [updatePillIndicator, navItems, currentUser]);

  const visibleTasks = useMemo(() => {
    if (!currentUser) return [];
    let filtered = tasks;
    if (currentUser.role !== UserRole.CHEFE) {
      filtered = tasks.filter(t => t.companyId === currentUser.companyId);
    }
    if (isTechnician) {
      return filtered.filter(t => t.technicianId === currentUser.id);
    }
    return filtered;
  }, [tasks, currentUser, isTechnician]);

  const visibleTeams = useMemo(() => {
    if (!currentUser) return [];
    if (isTechnician) return [];
    if (currentUser.role === UserRole.CHEFE) return teams;
    return teams.filter(t => t.companyId === currentUser.companyId);
  }, [currentUser, isTechnician, teams]);

  const visibleUsers = useMemo(() => {
    if (!currentUser) return [];
    if (isTechnician) return users.filter(u => u.id === currentUser.id);
    if (currentUser.role === UserRole.CHEFE) return users;
    return users.filter(u => u.companyId === currentUser.companyId);
  }, [currentUser, isTechnician, users]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
        <div className="flex flex-col items-center gap-3.5">
          <div className="w-12 h-12 rounded-[12px] bg-[#FF4F00] shadow-sm flex items-center justify-center overflow-hidden">
            <img
              src="/eletromidia/eletromidia-app%20logo-512px.png"
              alt="Eletromidia"
              className="w-9 h-9 object-contain animate-pulse"
            />
          </div>
          <p className="text-[#525866] font-medium text-sm">Carregando ambiente operacional...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || isRecoveryMode) {
    return (
      <Login
        initialMode={isRecoveryMode ? 'reset' : 'login'}
        onResetComplete={() => setIsRecoveryMode(false)}
        onLoginSuccess={(session) => {
          setIsRecoveryMode(false);
          fetchProfile(session.user.id);
        }}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'equipes':
        return isTechnician ? null : (
          <EquipesView
            teams={visibleTeams}
            users={visibleUsers}
            onCreateTeam={handleCreateTeam}
            onDeleteTeam={handleDeleteTeam}
            onUpdateTeam={handleUpdateTeam}
          />
        );
      case 'monitoramento':
        return isTechnician ? null : <TeamStatusView currentUser={currentUser} />;
      case 'mapa':
        return isTechnician ? null : <MapaView tasks={visibleTasks} />;
      case 'os':
        return (
          <OSView
            tasks={visibleTasks}
            users={visibleUsers}
            currentUser={currentUser}
            onUpdateTask={handleUpdateTask}
            onCreateTask={handleCreateTask}
          />
        );
      case 'medicao':
        return <MeasurementView currentUser={currentUser} />;
      case 'funcionarios':
        return <EmployeesView currentUser={currentUser} />;
      case 'veiculos':
        return isPartner ? null : <VehicleControlView currentUser={currentUser} />;
      case 'opec':
        return isPartner ? null : <OpecManagementView currentUser={currentUser} />;
      case 'reports':
        return <ReportsView tasks={visibleTasks} users={visibleUsers} currentUser={currentUser} />;
      case 'leader_dashboard':
        return (
          <LeaderDashboardView
            currentUser={currentUser}
            onNavigateToReport={() => setActiveTab('daily_report')}
            onNavigateToAgenda={() => setActiveTab('weekly_agenda')}
          />
        );
      case 'weekly_agenda':
        return isTechnician ? null : <WeeklyAgendaView currentUser={currentUser} />;
      case 'daily_report':
        return <DailyReportView currentUser={currentUser} />;
      case 'route_control':
        return <RouteControlView currentUser={currentUser} />;
      case 'home':
        return (
          <HomeView
            currentUser={currentUser}
            setActiveTab={setActiveTab}
            isPartner={isPartner}
            usersCount={visibleUsers.length}
            teamsCount={visibleTeams.length}
          />
        );
      case 'dashboard':
      default: {
        const role = currentUser.role;
        if (role === UserRole.TECNICO || role === UserRole.PARCEIRO_TECNICO) {
          return <TechnicianView technician={currentUser} tasks={visibleTasks} onUpdateTask={handleUpdateTask} />;
        }
        if (role === UserRole.LIDER || role === UserRole.PARCEIRO_LIDER) {
          return (
            <LeaderView
              leader={currentUser}
              tasks={visibleTasks}
              users={visibleUsers}
              onUpdateTask={handleUpdateTask}
              onCreateTask={handleCreateTask}
            />
          );
        }
        return (
          <ChiefView
            chief={currentUser}
            tasks={visibleTasks}
            teams={visibleTeams}
            users={visibleUsers}
            onUpdateTask={handleUpdateTask}
            onCreateTask={handleCreateTask}
          />
        );
      }
    }
  };

  return (
    <ThemeProvider companyId={currentUser.companyId || 'internal'}>
      <div className="min-h-screen bg-[#F4F5F7] text-[#000000] flex flex-col font-sans">
        {/* Top Architectural Capsule Navbar — Aligned to 1600px Grid & 44px Control Axis */}
        <header className="sticky top-0 z-30 h-[68px] bg-white/95 backdrop-blur-xl border-b border-[#E6E8EC] shrink-0">
          <div className="w-full max-w-[1600px] h-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            {/* Left: Unified Brand & Concession Capsule (44px height) */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden w-11 h-11 rounded-full border border-[#E2E5EB] bg-[#ECEEF2]/70 flex items-center justify-center text-[#000000] hover:bg-[#ECEEF2] transition-colors"
                aria-label="Abrir navegação"
              >
                <Menu size={18} />
              </button>

              <button
                onClick={() => setActiveTab(isTechnician ? 'dashboard' : 'home')}
                className="h-11 px-3.5 rounded-full bg-[#ECEEF2]/60 hover:bg-[#ECEEF2] border border-[#E2E5EB] inline-flex items-center gap-2.5 transition-colors focus:outline-none"
                title="Voltar ao Início"
              >
                <img
                  src="/eletromidia/Eletromidia%20Horizontal%20(3).png"
                  alt="Eletromidia"
                  className="h-4 sm:h-[18px] w-auto object-contain block"
                />
                {isPartner && companyThemes[currentUser.companyId]?.logoUrl && (
                  <>
                    <span className="h-3.5 w-px bg-[#D0D5DD]" />
                    <img
                      src={companyThemes[currentUser.companyId].logoUrl}
                      alt={currentUser.companyName}
                      className="h-4 w-auto object-contain block"
                    />
                  </>
                )}
                <span className="hidden sm:block h-3.5 w-px bg-[#D0D5DD]" />
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#000000] leading-none whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-[#FF4F00] shrink-0" />
                  <span>Concessão SP - Sul</span>
                </span>
              </button>
            </div>

            {/* Center: Animated Sliding Capsule Navigation (44px height, zero clipping) */}
            {!isTechnician && navItems.length > 0 && (
              <nav
                ref={navTrackRef}
                aria-label="Navegação principal"
                className="hidden lg:inline-flex ooh-nav-track shrink-0"
              >
                {/* Animated Sliding Pill */}
                <div
                  className="ooh-nav-pill"
                  style={{
                    transform: `translateX(${pillStyle.left}px)`,
                    width: `${pillStyle.width}px`,
                    opacity: pillStyle.opacity,
                  }}
                />

                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        tabRefs.current[item.id] = el;
                      }}
                      onClick={() => setActiveTab(item.id)}
                      title={item.label}
                      className={`ooh-nav-btn relative z-10 h-9 px-3 xl:px-3.5 rounded-full inline-flex items-center justify-center gap-1.5 text-[13px] leading-none font-semibold transition-colors duration-200 whitespace-nowrap select-none ${
                        isActive
                          ? 'text-white'
                          : 'text-[#525866] hover:text-[#000000]'
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center shrink-0 transition-colors duration-200 ${
                          isActive ? 'text-[#FF4F00]' : 'text-[#7A818F]'
                        }`}
                      >
                        {item.icon}
                      </span>
                      {item.shortLabel ? (
                        <>
                          <span className="2xl:hidden leading-none">{item.shortLabel}</span>
                          <span className="hidden 2xl:inline leading-none">{item.label}</span>
                        </>
                      ) : (
                        <span className="leading-none">{item.label}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Right: User Profile Capsule & Logout (44px height) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="h-11 pl-1.5 pr-3.5 rounded-full bg-[#ECEEF2]/60 hover:bg-[#ECEEF2] border border-[#E2E5EB] inline-flex items-center gap-2.5 transition-colors group focus:outline-none"
                title="Configurações de Perfil"
              >
                <div className="relative shrink-0">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover border border-white shadow-xs block"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#3D7700] ring-2 ring-white" />
                </div>
                <div className="hidden md:flex flex-col items-start justify-center leading-none gap-1 max-w-[120px]">
                  <span className="text-xs font-bold text-[#000000] truncate w-full leading-none">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] font-semibold text-[#525866] truncate w-full leading-none uppercase">
                    {currentUser.role.replace('PARCEIRO_', '')}
                  </span>
                </div>
                <Settings
                  size={14}
                  className="hidden md:block text-[#7A818F] group-hover:text-[#000000] transition-colors shrink-0"
                />
              </button>

              <button
                onClick={logout}
                title="Sair do Sistema"
                className="w-11 h-11 rounded-full inline-flex items-center justify-center text-[#525866] hover:text-[#E11D48] hover:bg-rose-50 border border-[#E2E5EB] hover:border-rose-200 bg-[#ECEEF2]/60 transition-colors focus:outline-none shrink-0"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div key={activeTab} className="ooh-view-enter">
            {renderContent()}
          </div>
        </main>

        {/* Mobile Navigation Drawer Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Navigation Drawer */}
        <aside
          className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-white border-r border-[#E6E8EC] z-50 lg:hidden transition-transform duration-300 ease-out shadow-2xl flex flex-col ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-5 flex items-center justify-between border-b border-[#E6E8EC]">
            <div className="flex items-center gap-2.5">
              <img
                src="/eletromidia/Eletromidia%20Horizontal%20(3).png"
                alt="Eletromidia"
                className="h-5 w-auto"
              />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F4F5F7] border border-[#E6E8EC] text-[#525866]">
                SUL
              </span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-8 h-8 rounded-[12px] flex items-center justify-center text-[#525866] hover:text-[#000000] hover:bg-[#F4F5F7] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-[12px] text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-[#000000] text-white shadow-sm'
                      : 'text-[#525866] hover:bg-[#F4F5F7] hover:text-[#000000]'
                  }`}
                >
                  <span className={isActive ? 'text-[#FF4F00]' : 'text-[#868C98]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[#E6E8EC] space-y-3 bg-[#F4F5F7]/60">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsProfileModalOpen(true);
              }}
              className="flex items-center gap-3 w-full p-3 rounded-[16px] bg-white border border-[#E6E8EC] text-left"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover border border-[#E6E8EC]"
              />
              <div className="overflow-hidden flex-1">
                <p className="font-semibold text-sm text-[#000000] truncate">{currentUser.name}</p>
                <p className="text-xs text-[#525866] truncate">
                  {currentUser.role.replace('PARCEIRO_', '')} • {currentUser.companyName}
                </p>
              </div>
              <Settings size={16} className="text-[#868C98]" />
            </button>

            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-rose-600 hover:bg-rose-50 bg-white border border-[#E6E8EC] rounded-[12px] transition-all font-semibold text-xs"
            >
              <LogOut size={15} />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </aside>

        {/* Profile Settings Modal */}
        {isProfileModalOpen && (
          <ProfileSettings
            user={currentUser}
            onClose={() => setIsProfileModalOpen(false)}
            onUpdate={(updatedUser) => {
              setCurrentUser(updatedUser);
            }}
          />
        )}
      </div>
    </ThemeProvider>
  );
};

export default App;
