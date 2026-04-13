import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { UserPlus } from 'lucide-react';
import Navbar from './AdminNavbar';
import './AdminUserManagement.css';

export default function AdminUserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        {
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
    }

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
                        <button className="add-user-button">
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
                                </tr>
                            </thead>
                            <tbody>
                                {users && users.length > 0 ? (users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{`${user.first_name} ${user.last_name}`}</td>
                                        <td>
                                            <span className={`role-badge ${user.role}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>{user.email || 'N/A'}</td>
                                        <td>{user.contact_number || 'None'}</td>
                                        <td>{user.occupation || 'N/A'}</td>
                                    </tr>
                                )))
                                    : (
                                        <tr>
                                            <td colSpan="6">No users found.</td>
                                        </tr>
                                    )}
                            </tbody>
                        </table>
                    )}
                </section>

            </main>
        </div>
    );
}