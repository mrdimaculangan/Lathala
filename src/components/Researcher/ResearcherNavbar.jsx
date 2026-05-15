import { Link, NavLink, useNavigate } from 'react-router-dom';
import Logout from '../Logout';
import './ResearcherNavbar.css';
import { UserAuth } from '../../context/AuthContext';
import { Search, User, LayoutGrid, FileText, Users, History, Settings, Bell, Eye, CheckCircle, Trash2 } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';

export default function ResearcherNavbar() {
    const navigate = useNavigate();
    const { firstName, lastName, session, userRole, dbId } = UserAuth();
    const displayName = firstName ? `${firstName} ${lastName}` : session?.user?.email;

    const [showNotificationPopup, setShowNotificationPopup] = useState(false);
    const [activeTab, setActiveTab] = useState('recent');
    const [notifications, setNotifications] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(true);

    // Fetch notifications
    useEffect(() => {
        if (!dbId) return;

        async function fetchNotifications() {
            const { data, error } = await supabase
                .from('researcher_notifications')
                .select(`
                    *,
                    Research ( title, research_files ( file_type ) )
                `)
                .eq('recipient_id', session?.user?.id)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            if (!error) setNotifications(data || []);
            setLoadingNotifs(false);
        }

        fetchNotifications();

        // real-time: new notifications appear instantly
        const channel = supabase
            .channel('notifications-channel')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'researcher_notifications',
                filter: `recipient_id=eq.${session?.user?.id}`
            }, (payload) => {
                setNotifications(prev => [payload.new, ...prev]);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [dbId]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleMarkRead = async (e, notifId) => {
        e.stopPropagation();
        await supabase.from('researcher_notifications').update({ is_read: true }).eq('notification_id', notifId);
        setNotifications(prev => prev.map(n => n.notification_id === notifId ? { ...n, is_read: true } : n));
    };

    const handleDelete = async (e, notifId) => {
        e.stopPropagation();
        await supabase.from('researcher_notifications').update({ is_deleted: true }).eq('notification_id', notifId);
        setNotifications(prev => prev.filter(n => n.notification_id !== notifId));
    };

    // "View" = mark as read + navigate to activity log with that log's modal open
    const handleView = async (notif) => {
        if (!notif.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('notification_id', notif.notification_id);
            setNotifications(prev => prev.map(n => n.notification_id === notif.notification_id ? { ...n, is_read: true } : n));
        }
        setShowNotificationPopup(false);
        navigate(`/researcher-activity-log/${notif.log_id}`);
    };

    const displayedNotifications = activeTab === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications;

    const getFileType = (notif) => {
        return notif.Research?.research_files?.[0]?.file_type || 'Research';
    };

    const getTitle = (notif) => {
        return notif.Research?.title || 'your research';
    };

    return (
        <>
            <nav className='researcher-nav'>
                <section className='navbar-group-left'>
                    <Link to="/researcher-dashboard" className='logo-link'>
                        <figure className='logo-container'>
                            <img src={logoImg} alt="Lathala logo" />
                            <figcaption><h3>Lathala</h3></figcaption>
                        </figure>
                    </Link>
                    <div className='search-container'>
                        <Search size={18} className="search-icon-inside" />
                        <input type="text" placeholder='Search research, authors, etc...' />
                    </div>
                </section>

                <section className='navbar-group-right'>
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
                        <div className="avatar-placeholder"><User size={20} /></div>
                        <div className="user-info">
                            <span className='user-name'>{displayName}</span>
                            <span className='user-role'>{userRole}</span>
                        </div>
                    </aside>
                </section>
            </nav>

            <aside className='sidebar'>
                <div className='sidebar-wrapper'>
                    <ul className='sidebar-list main-nav-list'>
                        <li>
                            <NavLink to="/researcher-dashboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <LayoutGrid size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/researcher-activity-log" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <FileText size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Activity Log</span>
                            </NavLink>
                        </li>
                    </ul>
                    <div className='sidebar-divider'></div>
                    <ul className='sidebar-list'>
                        <li>
                            <NavLink to="/user-profile" className='sidebar-link'>
                                <Users size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Profile</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/settings" className='sidebar-link'>
                                <Settings size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Settings</span>
                            </NavLink>
                        </li>
                        <li><Logout /></li>
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
                            <button className={`tab-button ${activeTab === 'recent' ? 'active' : ''}`} onClick={() => setActiveTab('recent')}>
                                Recent
                            </button>
                            <button className={`tab-button ${activeTab === 'unread' ? 'active' : ''}`} onClick={() => setActiveTab('unread')}>
                                Unread {unreadCount > 0 && <span className="tab-unread-count">{unreadCount}</span>}
                            </button>
                        </div>

                        <div className="popup-content">
                            {loadingNotifs ? (
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
                                            <div className="notification-icon">📄</div>
                                            <div className="notification-details">
                                                <p className="notification-message">
                                                    {notif.message || `Your research has been evaluated.`}{' '}
                                                    <span className="notif-link">View in Activity Log →</span>
                                                </p>
                                                <span className="notification-time">
                                                    {new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="notification-actions" onClick={e => e.stopPropagation()}>
                                                <button className="action-btn view" title="View" onClick={() => handleView(notif)}>
                                                    <Eye size={15} />
                                                </button>
                                                <button className="action-btn read" title="Mark as Read" onClick={(e) => handleMarkRead(e, notif.notification_id)} disabled={notif.is_read}>
                                                    <CheckCircle size={15} />
                                                </button>
                                                <button className="action-btn delete" title="Delete" onClick={(e) => handleDelete(e, notif.notification_id)}>
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