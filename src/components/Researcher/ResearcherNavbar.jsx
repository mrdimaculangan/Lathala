import { Link, NavLink } from 'react-router-dom';
import Logout from '../Logout';
import './ResearcherNavbar.css';
import { UserAuth } from '../../context/AuthContext';
import { Search, User, LayoutGrid, FileText, FilePlus2, Users, History, Settings, LogOut, Menu, Bell } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { useState } from 'react';
import { Trash2, Eye, CheckCircle } from 'lucide-react';

export default function ResearcherNavbar() {
    const [showNotificationPopup, setShowNotificationPopup] = useState(false);
    const { firstName, lastName, session, userRole } = UserAuth();
    const displayName = firstName ? `${firstName} ${lastName}` : session?.user?.email;

    const toggleNotificationPopup = () => {
        setShowNotificationPopup(!showNotificationPopup);
    }

    const [activeTab, setActiveTab] = useState('recent');

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    }

    const NotificationActions = () => (
        <div className="notification-actions">
            <button className="action-btn view" title="View">
                <Eye size={16} />
            </button>
            <button className="action-btn read" title="Mark as Read">
                <CheckCircle size={16} />
            </button>
            <button className="action-btn delete" title="Delete">
                <Trash2 size={16} />
            </button>
        </div>
    );

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
                        onClick={toggleNotificationPopup}
                        aria-label="Notifications"
                    >
                        <Bell size={20} />
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
                            <NavLink to="/researcher-dashboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <LayoutGrid size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/user-profile" className='sidebar-link'>
                                <Users size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Profile</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/inventory" className='sidebar-link'>
                                <FileText size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Activity Log</span>
                            </NavLink>
                        </li>
                    </ul>
                    <div className='sidebar-divider'></div>
                    <ul className='sidebar-list'>
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


            {/*Notification Popup */}
           {showNotificationPopup && (
                <div className="notification-overlay" onClick={toggleNotificationPopup}>
                    <div className="notification-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="popup-header">
                            <button className="popup-close-button" onClick={toggleNotificationPopup}>✕</button>
                            <h3>Researcher Notifications</h3>
                        </div>
                        
                        <div className="notification-tabs">
                            <button 
                                className={`tab-button ${activeTab === 'recent' ? 'active' : ''}`}
                                onClick={() => handleTabChange('recent')}
                            >
                                Recent
                            </button>
                            <button 
                                className={`tab-button ${activeTab === 'unread' ? 'active' : ''}`}
                                onClick={() => handleTabChange('unread')}
                            >
                                Unread
                            </button>
                        </div>

                         <div className="popup-content">
                            {activeTab === 'recent' && (
                                <div className="tab-content active">
                                    <div className="notification-list">
                                        {/* Example Item 1 */}
                                        <div className="notification-item unread">
                                            <div className="notification-icon">📄</div>
                                            <div className="notification-details">
                                                <p className="notification-message">Your research paper has been reviewed</p>
                                                <span className="notification-time">2 minutes ago</span>
                                            </div>
                                            <NotificationActions />
                                        </div>

                                        {/* Example Item 2 */}
                                        <div className="notification-item">
                                            <div className="notification-icon">👥</div>
                                            <div className="notification-details">
                                                <p className="notification-message">New comment on your research</p>
                                                <span className="notification-time">1 hour ago</span>
                                            </div>
                                            <NotificationActions />
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {activeTab === 'unread' && (
                                <div className="tab-content active">
                                    <div className="notification-list">
                                        <div className="notification-item unread">
                                            <div className="notification-icon">📄</div>
                                            <div className="notification-details">
                                                <p className="notification-message">Your research paper has been reviewed</p>
                                                <span className="notification-time">2 minutes ago</span>
                                            </div>
                                            <NotificationActions />
                                        </div>
                                        {/* ... other unread items */}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}