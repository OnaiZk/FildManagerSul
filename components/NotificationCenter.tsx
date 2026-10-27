import React, { useState, useEffect } from 'react';
import { Bell, X, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../api/supabaseClient';
import { User } from '../types';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning';
    read: boolean;
    timestamp: Date;
}

interface Props {
    currentUser: User;
}

export const NotificationCenter: React.FC<Props> = ({ currentUser }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        setUnreadCount(notifications.filter(n => !n.read).length);
    }, [notifications]);

    useEffect(() => {
        if (!currentUser) return;

        const channel = supabase
            .channel('new-tasks-notification')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'tasks' },
                (payload) => {
                    const newTask = payload.new as any;
                    if (newTask.technician_id === currentUser.id) {
                        addNotification({
                            id: `notif_${Date.now()}`,
                            title: 'Nova OS Atribuída',
                            message: `Você recebeu uma nova tarefa: ${newTask.service_type} em ${newTask.asset_id}`,
                            type: 'info',
                            read: false,
                            timestamp: new Date()
                        });

                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification("Nova OS Atribuída", {
                                body: `Tarefa: ${newTask.service_type}`
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    const addNotification = (notif: Notification) => {
        setNotifications(prev => [notif, ...prev].slice(0, 20));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const removeNotification = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notificações"
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#525866] hover:text-[#141518] bg-[#F4F5F7] hover:bg-[#ECEEF2] border border-[#E6E8EC] transition-all"
            >
                <Bell size={16} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#FF4F00] text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white tabular-nums">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2.5 w-80 sm:w-96 ooh-card shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-5 py-3.5 bg-[#F4F5F7]/70 border-b border-[#E6E8EC] flex justify-between items-center">
                            <h3 className="font-display text-sm font-bold text-[#141518]">Notificações</h3>
                            {notifications.length > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs font-semibold text-[#FF4F00] hover:underline"
                                >
                                    Marcar como lidas
                                </button>
                            )}
                        </div>

                        <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E6E8EC]">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-10 h-10 bg-[#F4F5F7] rounded-full flex items-center justify-center mx-auto mb-2.5 text-[#868C98]">
                                        <Bell size={18} />
                                    </div>
                                    <p className="text-xs font-medium text-[#525866]">Nenhuma notificação pendente.</p>
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        className={`p-4 flex gap-3 hover:bg-[#F4F5F7]/60 transition-colors relative group ${!notif.read ? 'bg-[#FFF3EE]/40' : ''}`}
                                    >
                                        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                            notif.type === 'success'
                                                ? 'bg-teal-50 text-teal-600'
                                                : notif.type === 'warning'
                                                ? 'bg-amber-50 text-amber-600'
                                                : 'bg-sky-50 text-sky-600'
                                        }`}>
                                            {notif.type === 'success' ? <CheckCircle size={15} /> :
                                                notif.type === 'warning' ? <AlertTriangle size={15} /> : <Info size={15} />}
                                        </div>
                                        <div className="flex-1 pr-5">
                                            <p className="text-xs font-semibold text-[#141518] mb-0.5">{notif.title}</p>
                                            <p className="text-xs text-[#525866] leading-relaxed">{notif.message}</p>
                                            <p className="font-mono-code text-[10px] text-[#868C98] mt-1">
                                                {notif.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => removeNotification(notif.id, e)}
                                            className="absolute top-3.5 right-3.5 text-[#868C98] hover:text-[#141518] opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
