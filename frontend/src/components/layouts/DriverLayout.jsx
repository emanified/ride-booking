import WorkspaceShell from '../shell/WorkspaceShell'

const navItems = [
  { to: '/driver/dashboard', label: 'Hub', icon: '◆' },
  { to: '/driver/requests', label: 'Requests', icon: '◇' },
  { to: '/driver/rides', label: 'Recent rides', icon: '▤' },
  { to: '/driver/vehicle', label: 'Vehicle', icon: '▢' },
  { to: '/driver/earnings', label: 'Earnings', icon: '○' },
]

export default function DriverLayout() {
  return <WorkspaceShell navItems={navItems} homePath="/driver/dashboard" />
}
