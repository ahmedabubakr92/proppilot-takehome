import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import ContactFormPage from './pages/ContactFormPage'
import { AuthProvider } from './lib/auth'
import LoginPage from "./pages/LoginPage"
import InboxPage from "./pages/InboxPage"
import ProtectedRoute from "./components/ProtectedRoute"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/c/:agencySlug" element={<ContactFormPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <InboxPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
