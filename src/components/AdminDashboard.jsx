import { UserAuth } from '../context/AuthContext';
import Logout from './Logout';

export default function AdminDashboard() {
    // We can now pull firstName and lastName right out of our context!
    const { session, userRole, firstName, lastName } = UserAuth();

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
            <h1>Admin Dashboard </h1>

            <div style={{ backgroundColor: '#f0f0f0', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                <p>
                    Welcome back, <strong>{firstName ? `${firstName}` : session?.user?.email}</strong>!
                </p>
                <p>System Role: <strong>{userRole}</strong></p>
            </div>

            <div style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                <h2>User Management</h2>
                <p>
                    <em>Note: User creation is currently handled manually via the Supabase Dashboard.</em>
                </p>
                <ul style={{ lineHeight: '1.6' }}>
                    <li>1. Create account in Supabase Authentication</li>
                    <li>2. Copy the User UID</li>
                    <li>3. Paste UID into the <code>profiles</code> table</li>
                    <li>4. Fill in the Role, First Name, and Last Name fields</li>
                </ul>
            </div>

            <Logout />
        </div>
    );
}