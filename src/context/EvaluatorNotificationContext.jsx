import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserAuth } from './AuthContext';

const EvaluatorNotificationContext = createContext();

export const useEvaluatorNotifications = () => {
    const context = useContext(EvaluatorNotificationContext);
    if (!context) {
        throw new Error('useEvaluatorNotifications must be used within EvaluatorNotificationProvider');
    }
    return context;
};

export const EvaluatorNotificationProvider = ({ children }) => {
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
            
            const { data: evaluatorData } = await supabase
                .from('Evaluator')
                .select('evaluator_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (!evaluatorData) {
                console.log('User is not an evaluator');
                setNotifications([]);
                setUnreadCount(0);
                setLoading(false);
                return;
            }

            console.log('🔍 Fetching evaluator notifications for user:', session.user.id);
            
            const { data, error } = await supabase
                .from('evaluator_notifications')
                .select(`
                    *,
                    Research ( title, research_files ( file_type ) )
                `)
                .eq('recipient_id', session.user.id)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error fetching evaluator notifications:', error);
            } else {
                console.log('✅ Fetched evaluator notifications:', data?.length, 'items');
                console.log('Full data:', data);
                setNotifications(data || []);
                setUnreadCount(data?.filter(n => !n.is_read).length || 0);
            }
        } catch (err) {
            console.error('❌ Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId) => {
        console.log('📖 markAsRead called with ID:', notificationId);
        console.log('📖 Type of ID:', typeof notificationId);
        
        if (!session?.user?.id) {
            console.error('❌ No session user ID');
            return;
        }

        // Optimistic update
        setNotifications(prev => prev.map(n =>
            n.notification_id === notificationId ? { ...n, is_read: true } : n
        ));

        const wasUnread = notifications.find(n => n.notification_id === notificationId && !n.is_read);
        if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            console.log('📖 Updating database - setting is_read = true for notification:', notificationId);
            
            const { data, error } = await supabase
                .from('evaluator_notifications')
                .update({ is_read: true })
                .eq('notification_id', notificationId)
                .select();

            if (error) {
                console.error('❌ Error marking as read:', error);
                console.error('Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                // Rollback
                setNotifications(prev => prev.map(n =>
                    n.notification_id === notificationId ? { ...n, is_read: false } : n
                ));
                if (wasUnread) setUnreadCount(prev => prev + 1);
            } else {
                console.log('✅ Successfully marked as read in database:', data);
            }
        } catch (err) {
            console.error('❌ Exception in markAsRead:', err);
        }
    };

    const markAllAsRead = async () => {
        console.log('📚 markAllAsRead called');
        
        if (!session?.user?.id) return;

        const unreadNotifications = notifications.filter(n => !n.is_read);
        if (unreadNotifications.length === 0) {
            console.log('No unread notifications');
            return;
        }

        const notificationIds = unreadNotifications.map(n => n.notification_id);
        console.log('📚 Marking these IDs as read:', notificationIds);

        try {
            const { data, error } = await supabase
                .from('evaluator_notifications')
                .update({ is_read: true })
                .in('notification_id', notificationIds)
                .select();

            if (error) {
                console.error('❌ Error marking all as read:', error);
                return;
            }

            console.log('✅ Successfully marked all as read:', data);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('❌ Exception in markAllAsRead:', err);
        }
    };

    const deleteNotification = async (notificationId) => {
        console.log('🗑️ deleteNotification called with ID:', notificationId);
        console.log('🗑️ Type of ID:', typeof notificationId);
        
        if (!session?.user?.id) {
            console.error('❌ No session user ID');
            return;
        }

        // Find the notification before removing it
        const deletedNotif = notifications.find(n => n.notification_id === notificationId);
        console.log('🗑️ Found notification to delete:', deletedNotif);
        
        // Optimistic update
        setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
        if (deletedNotif && !deletedNotif.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }

        try {
            console.log('🗑️ Updating database - setting is_deleted = true for notification:', notificationId);
            
            const { data, error } = await supabase
                .from('evaluator_notifications')
                .update({ is_deleted: true })
                .eq('notification_id', notificationId)
                .select();

            if (error) {
                console.error('❌ Error deleting notification:', error);
                console.error('Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                
                // Rollback
                if (deletedNotif) {
                    console.log('🔄 Rolling back - restoring notification');
                    setNotifications(prev => [deletedNotif, ...prev]);
                    if (!deletedNotif.is_read) setUnreadCount(prev => prev + 1);
                }
            } else {
                console.log('✅ Successfully marked as deleted in database:', data);
                
                // Verify the update
                const { data: verifyData, error: verifyError } = await supabase
                    .from('evaluator_notifications')
                    .select('notification_id, is_deleted')
                    .eq('notification_id', notificationId)
                    .single();
                
                if (verifyError) {
                    console.error('❌ Verification query failed:', verifyError);
                } else {
                    console.log('🔍 Verification - is_deleted status:', verifyData);
                }
            }
        } catch (err) {
            console.error('❌ Exception in deleteNotification:', err);
            // Rollback
            if (deletedNotif) {
                setNotifications(prev => [deletedNotif, ...prev]);
                if (!deletedNotif.is_read) setUnreadCount(prev => prev + 1);
            }
        }
    };

    const refreshNotifications = () => {
        console.log('🔄 Refreshing notifications...');
        fetchNotifications();
    };

    const clearNotifications = () => {
        console.log('🧹 Clearing notification state');
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
    };

    useEffect(() => {
        clearNotifications();

        if (!session?.user?.id) return;

        const setupEvaluatorNotifications = async () => {
            const { data: evaluatorData } = await supabase
                .from('Evaluator')
                .select('evaluator_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (!evaluatorData) {
                console.log('Not an evaluator, skipping notification setup');
                setLoading(false);
                return;
            }

            console.log('✅ Setting up evaluator notifications for user:', session.user.id);
            fetchNotifications();

            const channel = supabase
                .channel('evaluator-notifications')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'evaluator_notifications',
                    filter: `recipient_id=eq.${session.user.id}`
                }, (payload) => {
                    console.log('🔔 Real-time: New evaluator notification:', payload.new);
                    setNotifications(prev => {
                        // Check if notification already exists
                        const exists = prev.some(n => n.notification_id === payload.new.notification_id);
                        if (exists) {
                            console.log('⚠️ Notification already in state, skipping');
                            return prev;
                        }
                        return [payload.new, ...prev];
                    });
                    if (!payload.new.is_read) {
                        setUnreadCount(prev => prev + 1);
                    }
                })
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'evaluator_notifications',
                    filter: `recipient_id=eq.${session.user.id}`
                }, (payload) => {
                    console.log('🔄 Real-time: Evaluator notification updated:', payload.new);
                    
                    if (payload.new.is_deleted) {
                        console.log('🗑️ Real-time: Removing deleted notification');
                        setNotifications(prev => {
                            const filtered = prev.filter(n => n.notification_id !== payload.new.notification_id);
                            const removed = prev.find(n => n.notification_id === payload.new.notification_id);
                            if (removed && !removed.is_read) {
                                setUnreadCount(prev => Math.max(0, prev - 1));
                            }
                            return filtered;
                        });
                    } else {
                        setNotifications(prev => prev.map(n =>
                            n.notification_id === payload.new.notification_id ? payload.new : n
                        ));
                        // Update unread count if read status changed
                        if (payload.new.is_read) {
                            setUnreadCount(prev => Math.max(0, prev - 1));
                        }
                    }
                })
                .subscribe((status) => {
                    console.log('📡 Evaluator notification channel status:', status);
                });

            return () => {
                console.log('🧹 Cleaning up evaluator notification channel');
                supabase.removeChannel(channel);
            };
        };

        setupEvaluatorNotifications();
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
        <EvaluatorNotificationContext.Provider value={value}>
            {children}
        </EvaluatorNotificationContext.Provider>
    );
};