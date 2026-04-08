import { supabase } from '../supabaseClient';
import { LogOut } from 'lucide-react';

export default function Logout() {
    const handleLogout = async () => {
        // Tell Supabase to end the session
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Error signing out:", error.message);
        }

    };

    return (
        <button className='sidebar-link logout-btn' onClick={handleLogout}>
            <LogOut size={22} className='sidebar-icon' />
            <span className='sidebar-text'>Log Out</span>
        </button>
    );
}