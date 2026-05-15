import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from "./components/Login.jsx";
import ResearcherDashboard from "./components/Researcher/ResearcherDashboard.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import EvaluatorDashboard from "./components/Evaluator/EvaluatorDashboard.jsx";
import AdminDashboard from "./components/Admin/AdminDashboard.jsx";
import AdminUserManagement from "./components/Admin/AdminUserManagement.jsx";
import ResearcherAddStudy from "./components/Researcher/ResearcherAddStudy.jsx";
import ErrorPage from "./components/ErrorPage.jsx";
import EvaluateResearch from "./components/Evaluator/EvaluateResearch.jsx";
import ResearcherActivityLog from "./components/Researcher/ResearcherActivityLog.jsx";
import UserProfile from "./components/Researcher/UserProfile.jsx";
import EvaluatorUserProfile from "./components/Evaluator/UserProfile.jsx";


export const router = createBrowserRouter([
    { path: "/", element: <Login /> },
    { path: "/login", element: <Login /> },
    {
        path: "/researcher-dashboard",
        element: (
            <ProtectedRoute allowedRoles={['Researcher']}>
                <ResearcherDashboard />
            </ProtectedRoute>
        )
    },
    {
        path: "/researcher-activity-log",
        element: (
            <ProtectedRoute allowedRoles={['Researcher']}>
                <ResearcherActivityLog />
            </ProtectedRoute>
        )
    },
    // with openLogId param so notification can deep-link to a specific modal
    {
        path: "/researcher-activity-log/:openLogId",
        element: (
            <ProtectedRoute allowedRoles={['Researcher']}>
                <ResearcherActivityLog />
            </ProtectedRoute>
        )
    },
    {
        path: "/user-profile",
        element: (
            <ProtectedRoute allowedRoles={['Researcher']}>
                <UserProfile />
            </ProtectedRoute>
        )
    },
    {
        path: "/evaluator-dashboard",
        element: (
            <ProtectedRoute allowedRoles={['Evaluator']}>
                <EvaluatorDashboard />
            </ProtectedRoute>
        )
    },
    {
        path: "/evaluator-profile",
        element: (
            <ProtectedRoute allowedRoles={['Evaluator']}>
                <EvaluatorUserProfile />
            </ProtectedRoute>
        )
    },
    {
        path: "/evaluate-research/:researchId",
        element: (
            <ProtectedRoute allowedRoles={['Evaluator']}>
                <EvaluateResearch />
            </ProtectedRoute>
        )
    },
    {
        path: "/admin-dashboard",
        element: (
            <ProtectedRoute allowedRoles={['Admin']}>
                <AdminDashboard />
            </ProtectedRoute>
        )
    },
    {
        path: "/admin/users",
        element: (
            <ProtectedRoute allowedRoles={['Admin']}>
                <AdminUserManagement />
            </ProtectedRoute>
        )
    },
    {
        path: "/researcher-study",
        element: (
            <ProtectedRoute allowedRoles={['Researcher']}>
                <ResearcherAddStudy />
            </ProtectedRoute>
        )
    },
    {
        path: "*",
        element: <ErrorPage />
    },
]);