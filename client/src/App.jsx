import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "./store/useAuthStore"
import { getMe, refreshSession } from "./api/auth"

const AuthLayout = lazy(() => import("./layouts/AuthLayout"))
const Login = lazy(() => import("./pages/auth/Login"))
const Register = lazy(() => import("./pages/auth/Register"))

const MainLayout = lazy(() => import("./layouts/MainLayout"))
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"))
const Visitors = lazy(() => import("./pages/visitors/Visitors"))
const Payments = lazy(() => import("./pages/payments/Payments"))
const Vendors = lazy(() => import("./pages/vendors/Vendors"))
const Parking = lazy(() => import("./pages/parking/Parking"))
const Emergency = lazy(() => import("./pages/emergency/Emergency"))

const AdminLayout = lazy(() => import("./layouts/AdminLayout"))
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"))
const AdminInvoices = lazy(() => import("./pages/admin/AdminInvoices"))
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"))
const AdminBuildings = lazy(() => import("./pages/admin/AdminBuildings"))
const AdminUnits = lazy(() => import("./pages/admin/AdminUnits"))
const AdminVendorRequests = lazy(() => import("./pages/admin/AdminVendorRequests"))
const AdminParking = lazy(() => import("./pages/admin/AdminParking"))

const SecurityLayout = lazy(() => import("./layouts/SecurityLayout"))
const SecurityDashboard = lazy(() => import("./pages/security/SecurityDashboard"))
const GuestVehicleParking = lazy(() => import("./pages/security/GuestVehicleParking"))

const VendorLayout = lazy(() => import("./layouts/VendorLayout"))
const VendorDashboard = lazy(() => import("./pages/vendor/VendorDashboard"))

const SuperAdminLayout = lazy(() => import("./layouts/SuperAdminLayout"))
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard"))
const MonetizationAnalytics = lazy(() => import("./pages/super-admin/MonetizationAnalytics"))

const ProfileSettings = lazy(() => import("./pages/profile/ProfileSettings"))
const LegalPage = lazy(() => import("./pages/legal/LegalPage"))
const PrivacyRequestInbox = lazy(() => import("./pages/super-admin/PrivacyRequestInbox"))
import LegalFooter from "./components/layout/LegalFooter"
import { getRoleBasedPath } from "./utils/rolePath"

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isAuthReady = useAuthStore((state) => state.isAuthReady)
  const user = useAuthStore((state) => state.user)
  if (!isAuthReady) return <div className="min-h-screen grid place-items-center text-sm text-gray-500">Checking session…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!['resident', 'tenant'].includes(user?.role)) return <Navigate to={getRoleBasedPath(user?.role)} replace />
  return children
}

// Role-Restricted Route Wrapper
const RoleProtectedRoute = ({ allowedRoles, children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isAuthReady = useAuthStore((state) => state.isAuthReady)
  const user = useAuthStore((state) => state.user)

  if (!isAuthReady) return <div className="min-h-screen grid place-items-center text-sm text-gray-500">Checking session…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user?.role)) return <Navigate to={getRoleBasedPath(user?.role)} replace />
  return children
}

function App() {
  const setUser = useAuthStore((state) => state.setUser)
  const setContext = useAuthStore((state) => state.setContext)
  const setToken = useAuthStore((state) => state.setToken)
  const setAuthReady = useAuthStore((state) => state.setAuthReady)
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)

  // Restore authentication only from the server-verified HttpOnly refresh
  // cookie, and remove profile/context data written by older app versions.
  useEffect(() => {
    let active = true
    try {
      ['user', 'accessToken', 'refreshToken', 'complex', 'building', 'unit', 'parking', 'roleContext']
        .forEach((key) => localStorage.removeItem(key))
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
    const hydrateSession = async () => {
      try {
        const refresh = await refreshSession()
        if (!refresh.success || !refresh.accessToken) {
          useAuthStore.getState().logout()
          return
        }
        if (!active) return
        setToken(refresh.accessToken)
        const res = await getMe()
        if (active && res.success) {
          setUser(res.data)
          setContext(res.complex || null, res.building || null, res.unit || null, res.parking || null, res.roleContext || null)
          setAuthenticated(true)
        }
      } catch {
        if (active) useAuthStore.getState().logout()
      } finally {
        if (active) setAuthReady(true)
      }
    }
    hydrateSession()
    return () => { active = false }
  }, [setUser, setContext, setToken, setAuthReady, setAuthenticated])

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-gray-500">Loading page…</div>}>
      <Routes>
        {/* Public legal disclosures and privacy-request portal */}
        <Route path="/privacy" element={<LegalPage page="privacy" />} />
        <Route path="/terms" element={<LegalPage page="terms" />} />
        <Route path="/cookies" element={<LegalPage page="cookies" />} />
        <Route path="/contact" element={<LegalPage page="contact" />} />
        <Route path="/data-requests" element={<LegalPage page="data-requests" />} />
        <Route path="/billing-policy" element={<LegalPage page="billing" />} />

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
          <Route path="profile" element={<ProfileSettings />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <RoleProtectedRoute allowedRoles={["admin"]}>
              <AdminLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="buildings" element={<AdminBuildings />} />
          <Route path="units" element={<AdminUnits />} />
          <Route path="parking" element={<AdminParking />} />
          <Route path="vendor-requests" element={<AdminVendorRequests />} />
          <Route path="profile" element={<ProfileSettings />} />
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
          <Route path="guest-parking" element={<GuestVehicleParking />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Route>

        <Route
          path="/vendor"
          element={
            <RoleProtectedRoute allowedRoles={["vendor"]}>
              <VendorLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<VendorDashboard />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Route>

        {/* Super Admin Routes */}
        <Route
          path="/super-admin"
          element={
            <RoleProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<SuperAdminDashboard />} />
          <Route path="monetization" element={<MonetizationAnalytics />} />
          <Route path="privacy-requests" element={<PrivacyRequestInbox />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <LegalFooter />
    </BrowserRouter>
  )
}

export default App
