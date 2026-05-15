import { supabase } from '../supabaseClient';
import { LogOut } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

export default function Logout() {
    const navigate = useNavigate();
    const { clearNotifications } = useNotifications(); // Add this

    const handleLogout = async () => {
        try {
            // Clear notifications first (optional but good for clean state)
            clearNotifications();
            
            // Tell Supabase to end the session
            const { error } = await supabase.auth.signOut();

            if (error) {
                console.error("Error signing out:", error.message);
            } else {
                // Redirect to login page after successful logout
                navigate('/login');
            }
        } catch (err) {
            console.error("Logout error:", err);
        }
    };

    return (
        <button className='sidebar-link logout-btn' onClick={handleLogout}>
            <LogOut size={22} className='sidebar-icon' />
            <span className='sidebar-text'>Log Out</span>
        </button>
    );
}