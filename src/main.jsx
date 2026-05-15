import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import { AuthContextProvider } from "./context/AuthContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx"; // Fixed: comma to period

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <AuthContextProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </AuthContextProvider>
    </>
  </StrictMode>,
)