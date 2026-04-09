import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from "./components/Login.jsx";
import ResearcherDashboard from "./components/Researcher/ResearcherDashboard.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import EvaluatorDashboard from "./components/EvaluatorDashboard.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import ResearcherStudy from "./components/Researcher/ResearcherStudy.jsx";

export const router = createBrowserRouter([
    { path: "/", element: <Login /> },
    // Only Researchers can access this
    {
        path: "/researcher-dashboard",
        element: (
            <ProtectedRoute allowedRoles={['Researcher']}>
                <ResearcherDashboard />
            </ProtectedRoute>
        )
    },

    // Only Evaluators  can access this
    {
        path: "/evaluator-dashboard",
        element: (
            <ProtectedRoute allowedRoles={['Evaluator']}>
                <EvaluatorDashboard />
            </ProtectedRoute>
        )
    },

    // Only admin can access this
    {
        path: "/admin-dashboard",
        element: (
            <ProtectedRoute allowedRoles={['Admin']}>
                <AdminDashboard />
            </ProtectedRoute>
        )
    },
    {
        path: "*",
        element: <Login />
    },
    {
        path: "researcher-study",
        element: (
            <ProtectedRoute allowedRoles={['Researcher']}>
                <ResearcherStudy />
            </ProtectedRoute>
        )
    }
]);