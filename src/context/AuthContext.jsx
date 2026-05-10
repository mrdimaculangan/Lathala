import { createContext, useEffect, useState, useContext } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [dbId, setDbId] = useState(null);
    const [firstName, setFirstName] = useState(null);
    const [lastName, setLastName] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                fetchUserProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes (login, logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                setLoading(true);
                fetchUserProfile(session.user.id);
            } else {
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
            // Fetch the base user info
            const { data: userData, error: userError } = await supabase
                .from('Users')
                .select('user_id, role, first_name, last_name')
                .eq('user_id', userId)
                .single();

            if (userError) throw userError;

            if (userData) {
                let finalDbId = null;

                // IF they are a Researcher, fetch their integer ID from the Researcher table
                if (userData.role === 'Researcher') {
                    const { data: researcherData, error: researcherError } = await supabase
                        .from('Researcher')
                        .select('researcher_id')
                        .eq('user_id', userId)
                        .single();

                    if (researcherError) {
                        console.error("Could not find researcher profile:", researcherError);
                    } else if (researcherData) {
                        finalDbId = researcherData.researcher_id;
                    }
                }

                setDbId(finalDbId);
                setUserRole(userData.role);
                setFirstName(userData.first_name);
                setLastName(userData.last_name);
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        // Pass the new name variables down to the rest of the app
        <AuthContext.Provider value={{ session, userRole, firstName, lastName, dbId, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const UserAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('UserAuth hook was called outside of AuthContextProvider. Check your imports/casing!');
    }

    return context;
};