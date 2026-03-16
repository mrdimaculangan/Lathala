import { Navigate } from 'react-router-dom';
import { UserAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
    const { session, userRole, loading } = UserAuth();

    // Wait for Supabase to finish checking the user's status
    if (loading) {
        return <div>Loading...</div>;
    }

    // If they are not logged in at all, kick them back to login
    if (!session) {
        return <Navigate to="/login" replace />;
    }

    // If the route requires specific roles, and the user doesn't have one of them
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // Kick them to a generic dashboard or an "Unauthorized" page
        return <Navigate to="/dashboard" replace />;
    }

    // If they pass all checks, render the page they asked for!
    return children;
};