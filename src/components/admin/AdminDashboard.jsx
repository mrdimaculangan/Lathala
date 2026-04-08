import { UserAuth } from '../../context/AuthContext';
import Logout from '../Logout';
import Navbar from './AdminNavbar';

export default function AdminDashboard() {
    const { session, userRole, firstName, lastName } = UserAuth();

    return (
        <Navbar />
    );
}