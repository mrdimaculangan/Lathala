import { Link, NavLink, useNavigate } from 'react-router-dom';
import Logout from '../Logout';
import './EvaluatorNavbar.css';
import { UserAuth } from '../../context/AuthContext';
import { useEvaluatorNotifications } from '../../context/EvaluatorNotificationContext';
import { Search, User, LayoutGrid, FileText, FilePlus2, Users, History, Settings, LogOut, Menu, Bell, Eye, CheckCircle, Trash2 } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { useState } from 'react';

export default function EvaluatorNavbar() {
    const navigate = useNavigate();
    const { firstName, lastName, session, userRole } = UserAuth();
    const { 
        notifications, 
        unreadCount, 
        loading, 
        markAsRead, 
        deleteNotification,
        refreshNotifications 
    } = useEvaluatorNotifications();

    const displayName = firstName ? `${firstName} ${lastName}` : session?.user?.email;
    const [showNotificationPopup, setShowNotificationPopup] = useState(false);
    const [activeTab, setActiveTab] = useState('recent');

    const handleMarkRead = async (e, notifId) => {
        e.stopPropagation();
        console.log('Calling markAsRead for:', notifId);
        await markAsRead(notifId);
    };

    const handleDelete = async (e, notifId) => {
        e.stopPropagation();
        console.log('Calling deleteNotification for:', notifId);
        await deleteNotification(notifId);
    };

    const handleView = async (notif) => {
        console.log('Viewing notification:', notif);
        if (!notif.is_read) {
            await markAsRead(notif.notification_id);
        }
        setShowNotificationPopup(false);
        navigate(`/evaluator-activity-log/${notif.log_id}`);
    };

    const displayedNotifications = activeTab === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications;

    return (
        <>
            <nav className='evaluator-nav'>
                <section className='navbar-group-left'>
                    <Link to="/evaluator-dashboard" className='logo-link'>
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

            <aside className='sidebar'>
                <div className='sidebar-wrapper'>
                    <ul className='sidebar-list main-nav-list'>
                        <li>
                            <NavLink to="/evaluator-dashboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <LayoutGrid size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/review-queue" className='sidebar-link'>
                                <FilePlus2 size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Review Queue</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/evaluator-activity-log" className='sidebar-link'>
                                <History size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Activity Log</span>
                            </NavLink>
                        </li>
                    </ul>
                    <div className='sidebar-divider'></div>
                    <ul className='sidebar-list'>
                        <li>
                            <NavLink to="/evaluator-profile" className='sidebar-link'>
                                <User size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Profile</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/settings" className='sidebar-link'>
                                <Settings size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Settings</span>
                            </NavLink>
                        </li>
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
                                            <div className="notification-icon">📄</div>
                                            <div className="notification-details">
                                                <p className="notification-message">
                                                    {notif.message || `A research paper requires your evaluation.`}{' '}
                                                    <span className="notif-link">View in Activity Log →</span>
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
                                                    onClick={(e) => handleMarkRead(e, notif.notification_id)} 
                                                    disabled={notif.is_read}
                                                >
                                                    <CheckCircle size={15} />
                                                </button>
                                                <button 
                                                    className="action-btn delete" 
                                                    title="Delete" 
                                                    onClick={(e) => handleDelete(e, notif.notification_id)}
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