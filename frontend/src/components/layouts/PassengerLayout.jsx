import WorkspaceShell from '../shell/WorkspaceShell'

const navItems = [
  { to: '/passenger/dashboard', label: 'Home', icon: '◆' },
  { to: '/passenger/book', label: 'Book', icon: '◇' },
  { to: '/passenger/history', label: 'History', icon: '○' },
]

export default function PassengerLayout() {
  return <WorkspaceShell navItems={navItems} homePath="/passenger/dashboard" />
}
