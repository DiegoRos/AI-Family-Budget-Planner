import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  History, 
  UploadCloud, 
  Database, 
  Download,
  Menu,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'History', path: '/history', icon: History },
  { name: 'Upload', path: '/upload', icon: UploadCloud },
  { name: 'Data Editor', path: '/editor', icon: Database },
  { name: 'Export', path: '/export', icon: Download },
];

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen bg-[#fcfcfc] text-[#1a1a2e] font-sans">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-gray-100 bg-white">
        <div className="p-6">
          <h1 className="text-xl font-semibold tracking-tight text-[#334960]">Familia Budget</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150",
                location.pathname === item.path
                  ? "bg-gray-100 text-[#334960]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-[#334960]"
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile menu */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-4 focus:outline-none"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-white p-6">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-xl font-semibold text-[#334960]">Familia Budget</h1>
              <button onClick={() => setIsMobileMenuOpen(false)}><X /></button>
            </div>
            <nav className="space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-2 text-lg font-medium rounded-md",
                    location.pathname === item.path
                      ? "bg-gray-100 text-[#334960]"
                      : "text-gray-600"
                  )}
                >
                  <item.icon className="mr-3 h-6 w-6" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
