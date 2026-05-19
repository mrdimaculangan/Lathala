import { supabase } from '../supabaseClient';
import { LogOut } from 'lucide-react';
import { useEvaluatorNotifications } from '../context/EvaluatorNotificationContext';
import { useResearcherNotifications } from '../context/ResearcherNotificationContext';
import { useNavigate } from 'react-router-dom';

export default function Logout() {
    const navigate = useNavigate();

    const { clearNotifications: clearEvaluatorNotifications } = useEvaluatorNotifications();
    const { clearNotifications: clearResearcherNotifications } = useResearcherNotifications();

    const handleLogout = async () => {
        try {
            // Clear both notification types
            clearEvaluatorNotifications();
            clearResearcherNotifications();

            // Clear admin banner dismissal if it exists
            localStorage.removeItem('adminBannerDismissed');

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