import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
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
                console.error('Error fetching notifications:', error);
            } else {
                console.log('Fetched notifications:', data);
                setNotifications(data || []);
                setUnreadCount(data?.filter(n => !n.is_read).length || 0);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Mark a single notification as read
    const markAsRead = async (notificationId) => {
        console.log('markAsRead called with ID:', notificationId);
        
        if (!session?.user?.id) return;
        
        // Optimistically update UI
        setNotifications(prev => prev.map(n =>
            n.notification_id === notificationId ? { ...n, is_read: true } : n
        ));
        
        const wasUnread = notifications.find(n => n.notification_id === notificationId && !n.is_read);
        if (wasUnread) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        
        try {
            const { error } = await supabase
                .from('researcher_notifications')
                .update({ is_read: true })
                .eq('notification_id', notificationId);

            if (error) {
                console.error('Error marking as read:', error);
                // Rollback on error
                setNotifications(prev => prev.map(n =>
                    n.notification_id === notificationId ? { ...n, is_read: false } : n
                ));
                if (wasUnread) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        } catch (err) {
            console.error('Error in markAsRead:', err);
        }
    };
    
    // Mark all notifications as read
    const markAllAsRead = async () => {
        console.log('markAllAsRead called');
        
        if (!session?.user?.id) return;
        
        const unreadNotifications = notifications.filter(n => !n.is_read);
        if (unreadNotifications.length === 0) return;

        const notificationIds = unreadNotifications.map(n => n.notification_id);
        console.log('Marking as read:', notificationIds);
        
        try {
            const { data, error } = await supabase
                .from('researcher_notifications')
                .update({ is_read: true })
                .in('notification_id', notificationIds)
                .select();

            if (error) {
                console.error('Error marking all as read:', error);
                return;
            }

            console.log('All marked as read successfully:', data);
            
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            
        } catch (err) {
            console.error('Error in markAllAsRead:', err);
        }
    };

   // Delete a notification
    const deleteNotification = async (notificationId) => {
        console.log('deleteNotification called with ID:', notificationId);
        
        if (!session?.user?.id) return;
        
        // Optimistically update UI FIRST for better UX
        const deletedNotif = notifications.find(n => n.notification_id === notificationId);
        setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
        if (deletedNotif && !deletedNotif.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        
        try {
            // Update database
            const { error } = await supabase
                .from('researcher_notifications')
                .update({ is_deleted: true })
                .eq('notification_id', notificationId);

            if (error) {
                // Rollback if database update fails
                console.error('Error deleting notification:', error);
                // Revert UI changes
                if (deletedNotif) {
                    setNotifications(prev => [deletedNotif, ...prev]);
                    if (!deletedNotif.is_read) {
                        setUnreadCount(prev => prev + 1);
                    }
                }
                return;
            }

            console.log('Notification marked as deleted successfully');
            
        } catch (err) {
            console.error('Error in deleteNotification:', err);
            // Rollback on error
            if (deletedNotif) {
                setNotifications(prev => [deletedNotif, ...prev]);
                if (!deletedNotif.is_read) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        }
    };

    const refreshNotifications = () => {
        fetchNotifications();
    };

    const clearNotifications = () => {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
    };

    useEffect(() => {
        clearNotifications();
        
        if (!session?.user?.id) {
            return;
        }

        fetchNotifications();

        const channel = supabase
            .channel('notifications-context')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'researcher_notifications',
                filter: `recipient_id=eq.${session.user.id}`
            }, (payload) => {
                console.log('New notification inserted:', payload.new);
                setNotifications(prev => [payload.new, ...prev]);
                if (!payload.new.is_read) {
                    setUnreadCount(prev => prev + 1);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'researcher_notifications',
                filter: `recipient_id=eq.${session.user.id}`
            }, (payload) => {
                console.log('Notification updated:', payload.new);
                if (payload.new.is_deleted) {
                    setNotifications(prev => prev.filter(n => n.notification_id !== payload.new.notification_id));
                } else {
                    setNotifications(prev => prev.map(n =>
                        n.notification_id === payload.new.notification_id ? payload.new : n
                    ));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};