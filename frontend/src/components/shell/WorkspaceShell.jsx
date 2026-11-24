import { Outlet } from 'react-router-dom'
import FloatingDock from './FloatingDock'

export default function WorkspaceShell({ navItems, homePath }) {
  return (
    <div className="relative min-h-[100svh] w-full bg-[#f5f5f7]">
      <Outlet />
      <FloatingDock items={navItems} homePath={homePath} />
    </div>
  )
}