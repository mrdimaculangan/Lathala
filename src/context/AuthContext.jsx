import { createContext, useEffect, useState, useContext } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [firstName, setFirstName] = useState(null);
    const [lastName, setLastName] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchUserProfile(session.user.id);
            else setLoading(false);
        });

        // Listen for auth changes (login, logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                fetchUserProfile(session.user.id);
            } else {
                // Clear everything out when they log out
                setUserRole(null);
                setFirstName(null);
                setLastName(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Helper to fetch all the profile data at once
    const fetchUserProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role, first_name, last_name')
                .eq('id', userId)
                .single();

            if (data) {
                setUserRole(data.role);
                setFirstName(data.first_name);
                setLastName(data.last_name);
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        // Pass the new name variables down to the rest of the app
        <AuthContext.Provider value={{ session, userRole, firstName, lastName, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const UserAuth = () => {
    return useContext(AuthContext);
};