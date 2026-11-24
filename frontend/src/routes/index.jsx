import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import { ImmersiveMapCanvas } from '../components/shell/AsymmetricWorkspace'
import PassengerLayout from '../components/layouts/PassengerLayout'
import DriverLayout from '../components/layouts/DriverLayout'
import AdminLayout from '../components/layouts/AdminLayout'
import Home from '../pages/Home'

import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'

import PassengerDashboard from '../pages/passenger/PassengerDashboard'
import BookRide from '../pages/passenger/BookRide'
import RideStatus from '../pages/passenger/RideStatus'
import RideHistory from '../pages/passenger/RideHistory'
import RateDriver from '../pages/passenger/RateDriver'
import PaymentPage from '../pages/passenger/PaymentPage'
import NotificationsPage from '../pages/Notifications'

import DriverDashboard from '../pages/driver/DriverDashboard'
import RideRequest from '../pages/driver/RideRequest'
import ActiveTrip from '../pages/driver/ActiveTrip'
import Earnings from '../pages/driver/Earnings'
import DriverRideHistory from '../pages/driver/RideHistory'
import VehicleManagement from '../pages/driver/VehicleManagement'

import AdminDashboard from '../pages/admin/AdminDashboard'
import ManageUsers from '../pages/admin/ManageUsers'
import ManageTrips from '../pages/admin/ManageTrips'
import ManagePayments from '../pages/admin/ManagePayments'
import VehicleApprovals from '../pages/admin/VehicleApprovals'

function UnauthorizedPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <ImmersiveMapCanvas label="Access denied" />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="bg-white/85 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 text-center max-w-sm">
          <h1 className="text-2xl font-bold text-zinc-900">Access denied</h1>
          <p className="text-zinc-500 mt-2 text-sm">You don&apos;t have permission to view this page.</p>
          <a href="/login" className="link-accent mt-6 inline-block">
            Back to login
          </a>
        </div>
      </div>
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/passenger" element={<ProtectedRoute roles={['passenger']} />}>
        <Route element={<PassengerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PassengerDashboard />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="book" element={<BookRide />} />
          <Route path="ride-status/:tripId" element={<RideStatus />} />
          <Route path="history" element={<RideHistory />} />
          <Route path="rate/:tripId" element={<RateDriver />} />
          <Route path="payment/:tripId" element={<PaymentPage />} />
        </Route>
      </Route>

      <Route path="/driver" element={<ProtectedRoute roles={['driver']} />}>
        <Route element={<DriverLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DriverDashboard />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="requests" element={<RideRequest />} />
          <Route path="active-trip/:tripId" element={<ActiveTrip />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="rides" element={<DriverRideHistory />} />
          <Route path="vehicle" element={<VehicleManagement />} />
        </Route>
      </Route>

      <Route path="/admin" element={<ProtectedRoute roles={['admin']} />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="trips" element={<ManageTrips />} />
          <Route path="payments" element={<ManagePayments />} />
          <Route path="vehicles" element={<VehicleApprovals />} />
        </Route>
      </Route>

      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
