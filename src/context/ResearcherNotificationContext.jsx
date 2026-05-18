import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserAuth } from './AuthContext';

const ResearcherNotificationContext = createContext();

export const useResearcherNotifications = () => {
    const context = useContext(ResearcherNotificationContext);
    if (!context) {
        throw new Error('useResearcherNotifications must be used within ResearcherNotificationProvider');
    }
    return context;
};

export const ResearcherNotificationProvider = ({ children }) => {
    const { session } = UserAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        if (!session?.user?.id) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            
            // Check if user is a researcher first
            const { data: researcherData } = await supabase
                .from('Researcher')
                .select('researcher_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

            // If not a researcher, don't fetch
            if (!researcherData) {
                console.log('User is not a researcher, skipping researcher notifications');
                setNotifications([]);
                setUnreadCount(0);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('researcher_notifications')
                .select(`
                    *,
                    Research ( title, research_files ( file_type ) )
                `)
                .eq('recipient_id', session.user.id)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching researcher notifications:', error);
            } else {
                console.log('Fetched researcher notifications:', data);
                setNotifications(data || []);
                setUnreadCount(data?.filter(n => !n.is_read).length || 0);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId) => {
        if (!session?.user?.id) return;

        // Optimistic update
        setNotifications(prev => prev.map(n =>
            n.notification_id === notificationId ? { ...n, is_read: true } : n
        ));

        const wasUnread = notifications.find(n => n.notification_id === notificationId && !n.is_read);
        if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            const { error } = await supabase
                .from('researcher_notifications')
                .update({ is_read: true })
                .eq('notification_id', notificationId);

            if (error) {
                console.error('Error marking as read:', error);
                // Rollback
                setNotifications(prev => prev.map(n =>
                    n.notification_id === notificationId ? { ...n, is_read: false } : n
                ));
                if (wasUnread) setUnreadCount(prev => prev + 1);
            }
        } catch (err) {
            console.error('Error in markAsRead:', err);
        }
    };

    const markAllAsRead = async () => {
        if (!session?.user?.id) return;

        const unreadNotifications = notifications.filter(n => !n.is_read);
        if (unreadNotifications.length === 0) return;

        const notificationIds = unreadNotifications.map(n => n.notification_id);

        try {
            const { error } = await supabase
                .from('researcher_notifications')
                .update({ is_read: true })
                .in('notification_id', notificationIds);

            if (error) {
                console.error('Error marking all as read:', error);
                return;
            }

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error in markAllAsRead:', err);
        }
    };

    const deleteNotification = async (notificationId) => {
        if (!session?.user?.id) return;

        const deletedNotif = notifications.find(n => n.notification_id === notificationId);
        
        // Optimistic update
        setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
        if (deletedNotif && !deletedNotif.is_read) setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            const { error } = await supabase
                .from('researcher_notifications')
                .update({ is_deleted: true })
                .eq('notification_id', notificationId);

            if (error) {
                console.error('Error deleting notification:', error);
                // Rollback
                if (deletedNotif) {
                    setNotifications(prev => [deletedNotif, ...prev]);
                    if (!deletedNotif.is_read) setUnreadCount(prev => prev + 1);
                }
            }
        } catch (err) {
            console.error('Error in deleteNotification:', err);
            // Rollback
            if (deletedNotif) {
                setNotifications(prev => [deletedNotif, ...prev]);
                if (!deletedNotif.is_read) setUnreadCount(prev => prev + 1);
            }
        }
    };

    const refreshNotifications = () => fetchNotifications();

    const clearNotifications = () => {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
    };

    useEffect(() => {
        clearNotifications();

        if (!session?.user?.id) return;

        // Only set up if user is a researcher
        const setupResearcherNotifications = async () => {
            const { data: researcherData } = await supabase
                .from('Researcher')
                .select('researcher_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (!researcherData) {
                console.log('Not a researcher, skipping notification setup');
                setLoading(false);
                return;
            }

            console.log('✅ Setting up researcher notifications for user:', session.user.id);
            fetchNotifications();

            // Set up real-time listener
            const channel = supabase
                .channel('researcher-notifications')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'researcher_notifications',
                    filter: `recipient_id=eq.${session.user.id}`
                }, (payload) => {
                    console.log('🔔 New researcher notification:', payload.new);
                    setNotifications(prev => [payload.new, ...prev]);
                    if (!payload.new.is_read) setUnreadCount(prev => prev + 1);
                })
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'researcher_notifications',
                    filter: `recipient_id=eq.${session.user.id}`
                }, (payload) => {
                    console.log('🔄 Researcher notification updated:', payload.new);
                    if (payload.new.is_deleted) {
                        setNotifications(prev => prev.filter(n => n.notification_id !== payload.new.notification_id));
                    } else {
                        setNotifications(prev => prev.map(n =>
                            n.notification_id === payload.new.notification_id ? payload.new : n
                        ));
                    }
                })
                .subscribe((status) => {
                    console.log('📡 Researcher notification channel status:', status);
                });

            return () => {
                console.log('🧹 Cleaning up researcher notification channel');
                supabase.removeChannel(channel);
            };
        };

        setupResearcherNotifications();
    }, [session?.user?.id]);

    const value = {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotifications,
        clearNotifications
    };

    return (
        <ResearcherNotificationContext.Provider value={value}>
            {children}
        </ResearcherNotificationContext.Provider>
    );
};