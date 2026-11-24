import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// A bounded timeout ensures actions like "Go Online" or "Book Ride" always
// resolve (success or error) instead of leaving a button stuck in a loading
// state forever if the backend hangs or is unreachable.
const api = axios.create({ baseURL: BASE_URL, timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// If a previously-valid session's token expires or is rejected mid-use, force
// a clean re-login instead of leaving every page stuck on a generic 401 error.
// Login/register requests are excluded so wrong-credentials errors still show
// their normal inline message instead of bouncing the user off the page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register')
    if (error.response?.status === 401 && localStorage.getItem('token') && !isAuthEndpoint) {
      localStorage.clear()
      delete api.defaults.headers.common.Authorization
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

export const register = (data) => api.post('/auth/register', data)
export const login = (data) => api.post('/auth/login', data)

export const bookRide = (data) => api.post('/passenger/book-ride', data)
export const getRideStatus = (tripId) => api.get(`/passenger/ride-status/${tripId}`)
export const getRideHistory = () => api.get('/passenger/ride-history')
export const rateDriver = (tripId, data) => api.post(`/passenger/rate-driver/${tripId}`, data)
export const cancelRide = (tripId, reason) => api.post(`/passenger/trips/${tripId}/cancel`, { reason })

export const getBroadcastRequests = () => api.get('/driver/broadcast-requests')
export const acceptBroadcastRequest = (tripId) => api.post(`/driver/broadcast-requests/${tripId}/accept`)
export const offerOnBroadcastRequest = (tripId, fare) => api.post(`/driver/broadcast-requests/${tripId}/offer`, { fare })
export const declineBroadcastRequest = (tripId) => api.post(`/driver/broadcast-requests/${tripId}/decline`)
export const getActiveTrip = (tripId) => api.get(`/driver/active-trip/${tripId}`)
export const updateTripStatus = (tripId, data) => api.patch(`/driver/update-status/${tripId}`, data)
export const getEarnings = () => api.get('/driver/earnings')
export const getDriverRideHistory = () => api.get('/driver/ride-history')
export const completeTrip = (tripId) => api.post(`/driver/trips/${tripId}/complete`)

// Phase 6: active trip location/status/events
export const updateDriverTripLocation = (tripId, data) => api.post(`/driver/trips/${tripId}/location`, data)
export const getDriverTripEvents = (tripId) => api.get(`/driver/trips/${tripId}/events`)
export const postDriverMessage = (tripId, data) => api.post(`/driver/trips/${tripId}/messages`, data)
export const getDriverMessages = (tripId) => api.get(`/driver/trips/${tripId}/messages`)
export const markDriverMessagesRead = (tripId) => api.post(`/driver/trips/${tripId}/messages/read`)
export const postPassengerMessage = (tripId, data) => api.post(`/passenger/trips/${tripId}/messages`, data)
export const getPassengerMessages = (tripId) => api.get(`/passenger/trips/${tripId}/messages`)
export const markPassengerMessagesRead = (tripId) => api.post(`/passenger/trips/${tripId}/messages/read`)
export const payTrip = (tripId) => api.post(`/passenger/trips/${tripId}/pay`)
export const acceptDriverOffer = (tripId, offerId) => api.post(`/passenger/trips/${tripId}/offers/${offerId}/accept`)
export const rejectDriverOffer = (tripId, offerId) => api.post(`/passenger/trips/${tripId}/offers/${offerId}/reject`)
export const getNotifications = () => api.get('/notifications')
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`)

// Phase 4: location & online/offline
export const goOnline = (data) => api.post('/driver/go-online', data)
export const goOffline = () => api.post('/driver/go-offline')
export const updateDriverLocation = (data) => api.post('/driver/location', data)
export const getDriverStatus = () => api.get('/driver/status')
export const getAssignedTrips = () => api.get('/driver/assigned-trips')

// Phase 3: driver vehicle management
export const getDriverVehicle = () => api.get('/driver/vehicle')
export const createDriverVehicle = (data) => api.post('/driver/vehicle', data)
export const updateDriverVehicle = (vehicleId, data) => api.put(`/driver/vehicle/${vehicleId}`, data)
export const deleteDriverVehicle = (vehicleId) => api.delete(`/driver/vehicle/${vehicleId}`)

export const getStats = () => api.get('/admin/stats')
export const getUsers = (params) => api.get('/admin/users', { params })
export const suspendUser = (userId, data) => api.patch(`/admin/suspend-user/${userId}`, data)
export const getTrips = (params) => api.get('/admin/trips', { params })
export const getPayments = () => api.get('/admin/payments')

// Phase 3: admin vehicle approvals
export const getAdminVehicles = (status) => api.get('/admin/vehicles', { params: status ? { status } : {} })
export const approveVehicle = (vehicleId) => api.put(`/admin/vehicles/${vehicleId}/approve`)
export const rejectVehicle = (vehicleId, reason) => api.put(`/admin/vehicles/${vehicleId}/reject`, { reason })

export default api
