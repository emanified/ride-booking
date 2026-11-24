import WorkspaceShell from '../shell/WorkspaceShell'

const navItems = [
  { to: '/admin/dashboard', label: 'Overview', icon: '◆' },
  { to: '/admin/users', label: 'Users', icon: '◇' },
  { to: '/admin/trips', label: 'Trips', icon: '○' },
  { to: '/admin/vehicles', label: 'Vehicles', icon: '▢' },
  { to: '/admin/payments', label: 'Pay', icon: '□' },
]

export default function AdminLayout() {
  return <WorkspaceShell navItems={navItems} homePath="/admin/dashboard" />
}
