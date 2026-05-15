import { Link, NavLink } from 'react-router-dom';
import Logout from '../Logout';
import './AdminNavbar.css';
import { UserAuth } from '../../context/AuthContext';
import { Search, User, LayoutGrid, FileText, FilePlus2, Users, History, Settings, LogOut, Menu } from 'lucide-react';
import logoImg from '../../assets/logo.png';

export default function AdminNavbar() {

    const { firstName, lastName, session, userRole } = UserAuth();
    const displayName = firstName ? `${firstName} ${lastName}` : session?.user?.email;

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

                    {/* <div className='search-container'>
                        <Search size={18} className="search-icon-inside" />
                        <input type="text" placeholder='Search research, authors, etc...' />
                    </div> */}
                </section>

                <section className='navbar-group-right'>
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
                            <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
                                <Users size={22} className='sidebar-icon' />
                                <span className='sidebar-text'>User Management</span>
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