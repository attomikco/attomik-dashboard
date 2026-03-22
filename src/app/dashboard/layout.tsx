import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main
        className="dashboard-main"
        style={{ marginLeft: 'var(--sidebar-w)', flex: 1, background: 'var(--paper)', minHeight: '100vh', transition: 'margin 0.25s' }}
      >
        {children}
      </main>
    </div>
  )
}
