import { supabase } from '../supabaseClient';

export default function Logout() {
    const handleLogout = async () => {
        // Tell Supabase to end the session
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Error signing out:", error.message);
        }

    };

    return (
        <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#e60000', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
        >
            Sign Out
        </button>
    );
}