export const DASHBOARD_BY_ROLE = {
  passenger: '/passenger/dashboard',
  driver: '/driver/dashboard',
  admin: '/admin/dashboard',
}

export function getDashboardPath(role) {
  return DASHBOARD_BY_ROLE[role] ?? '/login'
}
