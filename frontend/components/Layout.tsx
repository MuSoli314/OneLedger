import { Outlet, NavLink } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">
            📒 一笔
          </h1>
          <nav className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`
              }
            >
              记账
            </NavLink>
            <NavLink
              to="/categories"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`
              }
            >
              分类
            </NavLink>
          </nav>
        </div>
      </header>

      {/* 页面内容 */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        <Outlet />
      </main>
    </div>
  )
}
