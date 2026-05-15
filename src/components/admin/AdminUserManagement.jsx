import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { UserPlus, Trash2, RotateCcw } from 'lucide-react';
import Navbar from './AdminNavbar';
import AdminAddUser from './AdminAddUser';
import './AdminUserManagement.css';

export default function AdminUserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

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

    return (
        <div className='admin-layout'>
            <Navbar />
            <main className='admin-content'>
                <section className='header'>
                    <div className='header-left'>
                        <h1>User Management</h1>
                        <p>Manage users and perform administrative actions related to user accounts.</p>
                    </div>
                    <div className='header-right'>
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
                        <table className='user-table'>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Email</th>
                                    <th>Contact Number</th>
                                    <th>Occupation</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users && users.length > 0 ? (
                                    users.map((user, index) => (
                                        <tr key={user.user_id ?? index} className={user.deleted_at ? 'deleted-row' : ''}>
                                            <td>{`${user.first_name} ${user.last_name}`}</td>
                                            <td>
                                                <span className={`role-badge ${user.role?.toLowerCase()}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td>{user.email || 'N/A'}</td>
                                            <td>{user.contact_number || 'None'}</td>
                                            <td>{user.occupation || 'N/A'}</td>
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
                                        <td colSpan="6">No users found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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