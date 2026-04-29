import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "./store/useAuthStore"

import AuthLayout from "./layouts/AuthLayout"
import Login from "./pages/auth/Login"
import Register from "./pages/auth/Register"

import MainLayout from "./layouts/MainLayout"
import Dashboard from "./pages/dashboard/Dashboard"
import Visitors from "./pages/visitors/Visitors"
import Payments from "./pages/payments/Payments"
import Vendors from "./pages/vendors/Vendors"
import Parking from "./pages/parking/Parking"
import Emergency from "./pages/emergency/Emergency"

import AdminLayout from "./layouts/AdminLayout"
import AdminDashboard from "./pages/admin/AdminDashboard"
import AdminInvoices from "./pages/admin/AdminInvoices"
import AdminUsers from "./pages/admin/AdminUsers"

import SecurityLayout from "./layouts/SecurityLayout"
import SecurityDashboard from "./pages/security/SecurityDashboard"

import VendorLayout from "./layouts/VendorLayout"
import VendorDashboard from "./pages/vendor/VendorDashboard"

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

// Role-Restricted Route Wrapper
const RoleProtectedRoute = ({ allowedRoles, children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}

// Redirect after login based on role
export const getRoleBasedPath = (role) => {
  switch (role) {
    case "admin":
    case "super_admin":
      return "/admin"
    case "security":
      return "/security"
    case "vendor":
      return "/vendor"
    default:
      return "/"
  }
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Resident Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="visitors" element={<Visitors />} />
          <Route path="payments" element={<Payments />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="parking" element={<Parking />} />
          <Route path="emergency" element={<Emergency />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <RoleProtectedRoute allowedRoles={["admin", "super_admin"]}>
              <AdminLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="invoices" element={<AdminInvoices />} />
        </Route>

        {/* Security Routes */}
        <Route
          path="/security"
          element={
            <RoleProtectedRoute allowedRoles={["security"]}>
              <SecurityLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<SecurityDashboard />} />
        </Route>

        {/* Vendor Routes */}
        <Route
          path="/vendor"
          element={
            <RoleProtectedRoute allowedRoles={["vendor"]}>
              <VendorLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<VendorDashboard />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
