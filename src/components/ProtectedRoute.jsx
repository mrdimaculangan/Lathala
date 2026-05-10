import { Navigate } from 'react-router-dom';
import { UserAuth } from '../context/AuthContext.jsx';

export const ProtectedRoute = ({ children, allowedRoles }) => {
    const { session, userRole, loading } = UserAuth();

    console.log("User Role:", userRole, "Allowed:", allowedRoles);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20vh' }}>
                <p>Loading...</p>
            </div>
        );
    }

    // If they are not logged in at all, kick them back to login
    if (!session) {
        return <Navigate to="/login" replace />;
    }

    // If the route requires specific roles, and the user doesn't have one of them
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // Kick them to login
        return <Navigate to="/login" replace />;
    }

    return children;
};