import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import { AuthContextProvider } from "./context/AuthContext.jsx";
import { EvaluatorNotificationProvider } from './context/EvaluatorNotificationContext';
import { ResearcherNotificationProvider } from './context/ResearcherNotificationContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <AuthContextProvider>
        <EvaluatorNotificationProvider>
          <ResearcherNotificationProvider>
            <RouterProvider router={router} />
          </ResearcherNotificationProvider>
        </EvaluatorNotificationProvider>
      </AuthContextProvider>
    </>
  </StrictMode>,
)