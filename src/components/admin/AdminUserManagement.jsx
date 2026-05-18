import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { UserPlus, Trash2, RotateCcw, Search } from 'lucide-react';
import Navbar from './AdminNavbar';
import AdminAddUser from './AdminAddUser';
import './AdminUserManagement.css';

const ITEMS_PER_PAGE = 10;

export default function AdminUserManagement() {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Pagination and Filter states
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        document.body.classList.add('admin-fixed');
        document.documentElement.classList.add('admin-fixed');

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
            document.body.classList.remove('admin-fixed');
            document.documentElement.classList.remove('admin-fixed');
        };
    }, []);


    // Filter and search logic
    useEffect(() => {
        let result = [...users];

        if (filterRole !== 'all') {
            result = result.filter(u => u.role?.toLowerCase() === filterRole.toLowerCase());
        }

        if (searchTerm) {
            result = result.filter(u =>
                `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.contact_number?.includes(searchTerm)
            );
        }

        setFilteredUsers(result);
        setCurrentPage(1);
    }, [searchTerm, filterRole, users]);

    // Pagination derived data
    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    async function fetchUsers() {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('Users').select('*');
            if (error) {
                console.error('Error fetching users:', error);
                setUsers([]);
                return;
            }
            setUsers(data || []);
        } catch (error) {
            console.error('Unexpected error fetching users:', error);
        } finally {
            setLoading(false);
        }
    }

    const deleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to deactivate this user?')) return;

        try {
            const { error } = await supabase
                .from('Users')
                .update({ deleted_at: new Date().toISOString() })
                .eq('user_id', userId)
                .select();

            if (error) throw error;
            await fetchUsers();
        } catch (err) {
            console.error('Error deactivating user:', err);
            alert('Failed to deactivate user: ' + err.message);
        }
    };

    const reactivateUser = async (userId) => {
        if (!window.confirm('Reactivate this user?')) return;

        try {
            const { error } = await supabase
                .from('Users')
                .update({ deleted_at: null })
                .eq('user_id', userId)
                .select();

            if (error) throw error;
            await fetchUsers();
        } catch (err) {
            console.error('Error reactivating user:', err);
            alert('Failed to reactivate user: ' + err.message);
        }
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pages = [];
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            pages.push(i);
        }

        return (
            <div className="pagination">
                <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</button>
                <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>‹</button>
                {pages.map(page => (
                    <button
                        key={page}
                        className={`page-btn ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                    >
                        {page}
                    </button>
                ))}
                {totalPages > 5 && <span className="page-ellipsis">…</span>}
                {totalPages > 5 && (
                    <button className="page-btn" onClick={() => setCurrentPage(totalPages)}>
                        {totalPages}
                    </button>
                )}
                <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>›</button>
                <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</button>
            </div>
        );
    };

    return (
        <div className='admin-layout'>
            <Navbar />
            <main className='admin-content'>
                <section className='header'>
                    <div className='header-left'>
                        <h1>User Management</h1>
                        <p>Manage users and perform administrative actions related to user accounts.</p>
                    </div>
                    <div className='inventory-controls'>
                        <div className="search-wrapper">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by name, email, role, or contact..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="filter-wrapper">
                            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                                <option value="all">All Roles</option>
                                <option value="admin">Admin</option>
                                <option value="evaluator">Evaluator</option>
                                <option value="researcher">Researcher</option>
                            </select>
                        </div>
                        <button className="add-user-button" onClick={() => setShowAddModal(true)}>
                            <UserPlus size={20} />
                            <span>Add User</span>
                        </button>
                    </div>
                </section>

                <section className='table-container'>
                    {loading ? (
                        <p>Loading users...</p>
                    ) : (
                        <>
                            <table className='user-table'>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Role</th>
                                        <th>Email</th>
                                        <th>Contact Number</th>
                                        <th>Occupation</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers && paginatedUsers.length > 0 ? (
                                        paginatedUsers.map((user, index) => (
                                            <tr key={user.user_id ?? index} className={user.deleted_at ? 'deleted-row' : ''}>
                                                <td className="name-cell">{`${user.first_name} ${user.last_name}`}</td>
                                                <td>
                                                    <span className={`role-badge ${user.role?.toLowerCase()}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="email-cell">{user.email || 'N/A'}</td>
                                                <td className="contact-cell">{user.contact_number || 'None'}</td>
                                                <td className="occupation-cell">{user.occupation || 'N/A'}</td>
                                                <td>
                                                    {!user.deleted_at ? (
                                                        <span className="status-badge active">Active</span>
                                                    ) : (
                                                        <span className="status-badge inactive">Inactive</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="action-btns">
                                                        {!user.deleted_at ? (
                                                            <button
                                                                className="delete-btn"
                                                                onClick={() => deleteUser(user.user_id)}
                                                                title="Deactivate"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="reactivate-btn"
                                                                onClick={() => reactivateUser(user.user_id)}
                                                                title="Reactivate"
                                                            >
                                                                <RotateCcw size={15} />
                                                                <span>Reactivate</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                                                <div className="empty-state">
                                                    <p>No users found.</p>
                                                    <p className="empty-subtitle">
                                                        {searchTerm || filterRole !== 'all'
                                                            ? 'Try adjusting your search or filter criteria.'
                                                            : 'Click "Add User" to create a new account.'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>


                        </>
                    )}
                </section>
                <section>
                    {!loading && filteredUsers.length > 0 && (
                        <div className="pagination-wrapper">
                            <div className="pagination-info">
                                Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–
                                {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
                            </div>
                            {renderPagination()}
                        </div>
                    )}
                </section>
            </main>

            {showAddModal && (
                <AdminAddUser
                    onClose={() => setShowAddModal(false)}
                    onSuccess={fetchUsers}
                />
            )}
        </div>
    );
}