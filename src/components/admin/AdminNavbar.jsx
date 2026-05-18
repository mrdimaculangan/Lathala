import { Link, NavLink } from 'react-router-dom';
import Logout from '../Logout';
import './AdminNavbar.css';
import { UserAuth } from '../../context/AuthContext';
import { Search, User, LayoutGrid, FileText, FilePlus2, Users, History, Settings, LogOut, Menu, Bell, Eye, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminNavbar() {
    const { firstName, lastName, session, userRole } = UserAuth();
    const displayName = firstName ? `${firstName} ${lastName}` : session?.user?.email;

    const [showNotificationPopup, setShowNotificationPopup] = useState(false);
    const [activeTab, setActiveTab] = useState('recent');
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // Pending alerts state
    const [pendingAlerts, setPendingAlerts] = useState({
        unassignedPapers: 0,
        pendingQueue: 0,
        showBanner: false
    });

    // Fetch notifications for admin
    const fetchNotifications = async () => {
        setLoading(true);
        try {
            // Fetch admin notifications from admin_notifications table
            const { data, error } = await supabase
                .from('admin_notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            setNotifications(data || []);
            setUnreadCount(data?.filter(n => !n.is_read).length || 0);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const createAdminNotification = async (message, type, link) => {
        try {
            const { error } = await supabase
                .from('admin_notifications')
                .insert({
                    message: message,
                    type: type,
                    link: link,
                    is_read: false,
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error creating notification:', error);
            } else {
                // Refresh notifications
                fetchNotifications();
            }
        } catch (error) {
            console.error('Error in createAdminNotification:', error);
        }
    };

    // Fetch pending alerts (unassigned papers)
    const fetchPendingAlerts = async () => {
        try {
            // Get all research
            const { data: allResearch } = await supabase
                .from('Research')
                .select('research_id');

            // Get queue papers
            const { data: queueData } = await supabase
                .from('Research_Queue')
                .select('research_id');

            // Get finalized papers (approved/rejected)
            const { data: evaluationsData } = await supabase
                .from('Evaluation_Research')
                .select('research_id, overall_recommendation');

            const queueIds = new Set(queueData?.map(q => q.research_id) || []);

            const finalizedIds = new Set(
                (evaluationsData || [])
                    .filter(e => {
                        const status = (e.overall_recommendation || '').toLowerCase();
                        return status === 'approved' || status === 'rejected';
                    })
                    .map(e => e.research_id)
            );

            // Unassigned = not in queue AND not finalized
            const unassigned = (allResearch || []).filter(r =>
                !queueIds.has(r.research_id) && !finalizedIds.has(r.research_id)
            );

            setPendingAlerts({
                unassignedPapers: unassigned.length,
                pendingQueue: queueData?.length || 0,
                showBanner: unassigned.length > 0
            });
        } catch (error) {
            console.error('Error fetching pending alerts:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        fetchPendingAlerts();

        // Refresh every 30 seconds
        const interval = setInterval(() => {
            fetchPendingAlerts();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const markAsRead = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('admin_notifications')
                .update({ is_read: true })
                .eq('notification_id', notificationId);

            if (error) throw error;

            setNotifications(prev =>
                prev.map(n =>
                    n.notification_id === notificationId
                        ? { ...n, is_read: true }
                        : n
                )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('admin_notifications')
                .delete()
                .eq('notification_id', notificationId);

            if (error) throw error;

            setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
            setUnreadCount(prev => {
                const deletedWasUnread = notifications.find(n => n.notification_id === notificationId && !n.is_read);
                return deletedWasUnread ? Math.max(0, prev - 1) : prev;
            });
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const handleView = async (notif) => {
        if (!notif.is_read) {
            await markAsRead(notif.notification_id);
        }
        setShowNotificationPopup(false);
        if (notif.link) {
            window.location.href = notif.link;
        }
    };

    const displayedNotifications = activeTab === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications;

    return (
        <>
            <nav className='admin-nav'>
                <section className='navbar-group-left'>
                    <Link to="/admin-dashboard" className='logo-link'>
                        <figure className='logo-container'>
                            <img src={logoImg} alt="Lathala logo" />
                            <figcaption><h3>Lathala</h3></figcaption>
                        </figure>
                    </Link>
                </section>

                <section className='navbar-group-right'>
                    {/* Notification Bell */}
                    <button
                        className='notification-button'
                        onClick={() => setShowNotificationPopup(!showNotificationPopup)}
                        aria-label="Notifications"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>

                    <aside className='user-profile'>
                        <div className="avatar-placeholder">
                            <User size={20} />
                        </div>

                        <div className="user-info">
                            <span className='user-name'>{displayName}</span>
                            <span className='user-role'>{userRole}</span>
                        </div>
                    </aside>
                </section>
            </nav>

            {/* PENDING ALERTS BANNER */}
            {pendingAlerts.showBanner && (
                <div className="admin-alert-banner">
                    <div className="alert-banner-content">
                        <AlertTriangle size={18} className="alert-icon" />
                        <div className="alert-messages">
                            {pendingAlerts.unassignedPapers > 0 && (
                                <span className="alert-message">
                                    {pendingAlerts.unassignedPapers} research paper(s) need evaluator assignment.
                                </span>
                            )}
                        </div>
                        <Link to="/admin/queue" className="alert-action-btn">
                            Go to Queue →
                        </Link>
                        <button
                            className="alert-close-btn"
                            onClick={() => setPendingAlerts(prev => ({ ...prev, showBanner: false }))}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <aside className='sidebar'>
                <div className='sidebar-wrapper'>
                    <ul className='sidebar-list main-nav-list'>
                        <li>
                            <NavLink to="/admin-dashboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <LayoutGrid size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/admin/inventory" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <FileText size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Master Inventory</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/admin/queue" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <FilePlus2 size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Evaluation Queue</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <Users size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>User Management</span>
                            </NavLink>
                        </li>
                    </ul>
                    <div className='sidebar-divider'></div>
                    <ul className='sidebar-list'>
                        <li>
                            <Logout />
                        </li>
                    </ul>
                </div>
            </aside>

            {/* NOTIFICATION POPUP */}
            {showNotificationPopup && (
                <div className="notification-overlay" onClick={() => setShowNotificationPopup(false)}>
                    <div className="notification-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="popup-header">
                            <button className="popup-close-button" onClick={() => setShowNotificationPopup(false)}>✕</button>
                            <h3>Notifications</h3>
                        </div>

                        <div className="notification-tabs">
                            <button
                                className={`tab-button ${activeTab === 'recent' ? 'active' : ''}`}
                                onClick={() => setActiveTab('recent')}
                            >
                                Recent ({notifications.length})
                            </button>
                            <button
                                className={`tab-button ${activeTab === 'unread' ? 'active' : ''}`}
                                onClick={() => setActiveTab('unread')}
                            >
                                Unread ({unreadCount})
                            </button>
                        </div>

                        <div className="popup-content">
                            {loading ? (
                                <p className="notif-empty">Loading...</p>
                            ) : displayedNotifications.length === 0 ? (
                                <p className="notif-empty">No notifications here.</p>
                            ) : (
                                <div className="notification-list">
                                    {displayedNotifications.map(notif => (
                                        <div
                                            key={notif.notification_id}
                                            className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                                            onClick={() => handleView(notif)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="notification-icon">
                                                {notif.type === 'assignment' ? '📋' : notif.type === 'user' ? '👤' : '📄'}
                                            </div>
                                            <div className="notification-details">
                                                <p className="notification-message">
                                                    {notif.message || 'System notification'}{' '}
                                                    {notif.link && <span className="notif-link">Click to view →</span>}
                                                </p>
                                                <span className="notification-time">
                                                    {new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="notification-actions" onClick={e => e.stopPropagation()}>
                                                <button
                                                    className="action-btn view"
                                                    title="View"
                                                    onClick={() => handleView(notif)}
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <button
                                                    className="action-btn read"
                                                    title="Mark as Read"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notif.notification_id);
                                                    }}
                                                    disabled={notif.is_read}
                                                >
                                                    <CheckCircle size={15} />
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    title="Delete"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotification(notif.notification_id);
                                                    }}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}