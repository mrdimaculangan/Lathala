import { Link, NavLink } from 'react-router-dom';
import Logout from '../Logout';
import './EvaluatorNavbar.css';
import { UserAuth } from '../../context/AuthContext';
import { Search, User, LayoutGrid, FileText, FilePlus2, Users, History, Settings, LogOut, Menu, Bell} from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { useState } from 'react';

export default function EvaluatorNavbar() {
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
                            <NavLink to="/evaluator-dashboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <LayoutGrid size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/inventory" className='sidebar-link'>
                                <FileText size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Research Inventory</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/review-queue" className='sidebar-link'>
                                <FilePlus2 size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>Review Queue</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/activity-log" className='sidebar-link'>
                                <History size={22} className='sidebar-icon' />
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
        </>
    );
}