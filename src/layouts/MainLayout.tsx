import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Car,
  CheckCheck,
  ChevronDown,
  LogOut,
  Menu,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Button, ToastContainer } from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { formatDateTime } from '../utils/rentalCalculations';

export const MainLayout: React.FC = () => {
  const {
    currentUser,
    notifications,
    toasts,
    dismissToast,
    logout,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();

  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const userNotifications = currentUser
    ? notifications.filter(
        (n) =>
          n.userId === currentUser.id ||
          n.userId === 'ALL' ||
          (currentUser.role === 'ADMIN' && n.userId === 'ADMIN')
      )
    : [];
  const unreadCount = userNotifications.filter((n) => !n.read).length;

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-zinc-100 text-zinc-900'
        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F8F7] text-zinc-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to={currentUser ? '/dashboard' : '/'}
            className="flex items-center gap-2.5 shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-[#0F766E] text-white flex items-center justify-center">
              <Car className="w-4 h-4 stroke-[2]" />
            </div>
            <span className="text-base font-semibold tracking-tight text-zinc-900">
              VeloRent
            </span>
          </Link>

          {/* Zone 2: Primary Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/rent" className={navLinkClass}>
              Browse vehicles
            </NavLink>
            {currentUser && (
              <>
                <NavLink to="/bookings" className={navLinkClass}>
                  Bookings
                </NavLink>
                <NavLink to="/my-vehicles" className={navLinkClass}>
                  My fleet
                </NavLink>
                <NavLink to="/dashboard" className={navLinkClass}>
                  Overview
                </NavLink>
                {currentUser.role === 'ADMIN' && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                      }`
                    }
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </NavLink>
                )}
              </>
            )}
          </nav>

          {/* Zone 3: Actions & Account Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => navigate(currentUser ? '/list-vehicle' : '/login')}
            >
              List a vehicle
            </Button>

            {currentUser ? (
              <>
                {/* Notifications Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifOpen(!notifOpen);
                      setProfileMenuOpen(false);
                    }}
                    className="relative p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-[#0F766E] text-white text-[10px] font-semibold rounded flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setNotifOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-zinc-200 z-20 overflow-hidden">
                        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-900">
                            Notifications ({unreadCount} unread)
                          </span>
                          {unreadCount > 0 && (
                            <button
                              onClick={() => markAllNotificationsRead()}
                              className="text-xs text-[#0F766E] hover:underline font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                          {userNotifications.length === 0 ? (
                            <div className="p-6 text-center text-xs text-zinc-500">
                              No notifications yet.
                            </div>
                          ) : (
                            userNotifications.slice(0, 12).map((n) => (
                              <div
                                key={n.id}
                                onClick={() => {
                                  markNotificationRead(n.id);
                                  setNotifOpen(false);
                                  if (n.link) {
                                    navigate(n.link);
                                  }
                                }}
                                className={`p-3.5 hover:bg-zinc-50 transition-colors cursor-pointer ${
                                  !n.read ? 'bg-teal-50/30' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-semibold text-zinc-900">
                                    {n.title}
                                  </p>
                                  <span className="text-[11px] text-zinc-400 shrink-0">
                                    {formatDateTime(n.createdAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                                  {n.message}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Authenticated Account Menu */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setProfileMenuOpen(!profileMenuOpen);
                      setNotifOpen(false);
                    }}
                    className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-md bg-zinc-900 text-white font-semibold text-xs flex items-center justify-center">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-xs font-medium text-zinc-800 max-w-[110px] truncate">
                      {currentUser.name.split(' ')[0]}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </button>

                  {profileMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setProfileMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-zinc-200 z-20 py-1.5 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-zinc-100">
                          <p className="text-xs font-semibold text-zinc-900 truncate">
                            {currentUser.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                            {currentUser.email}
                          </p>
                        </div>

                        <div className="py-1">
                          <Link
                            to="/profile"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                            Account settings
                          </Link>
                        </div>

                        <div className="border-t border-zinc-100 pt-1">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50/60 cursor-pointer text-left"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Sign out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  Sign in
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/signup')}
                >
                  Create account
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-200 bg-white px-4 pt-2 pb-4 space-y-1">
            <NavLink
              to="/rent"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Browse vehicles
            </NavLink>
            <NavLink
              to={currentUser ? '/list-vehicle' : '/login'}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              List a vehicle
            </NavLink>
            {currentUser && (
              <>
                <NavLink
                  to="/bookings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Bookings
                </NavLink>
                <NavLink
                  to="/my-vehicles"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  My fleet
                </NavLink>
                <NavLink
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Overview
                </NavLink>
                {currentUser.role === 'ADMIN' && (
                  <NavLink
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-zinc-900 bg-zinc-100"
                  >
                    Admin operations
                  </NavLink>
                )}
              </>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Minimal Production Footer */}
      <footer className="bg-white border-t border-zinc-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-zinc-900 text-white flex items-center justify-center">
              <Car className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-semibold text-zinc-900">
              VeloRent
            </span>
            <span className="text-xs text-zinc-400">·</span>
            <span className="text-xs text-zinc-500">
              Self-drive vehicle rentals & fleet management
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-500">
            <Link to="/rent" className="hover:text-zinc-900 transition-colors">
              Browse vehicles
            </Link>
            <Link
              to={currentUser ? '/list-vehicle' : '/login'}
              className="hover:text-zinc-900 transition-colors"
            >
              Host a vehicle
            </Link>
            {currentUser && (
              <Link
                to="/bookings"
                className="hover:text-zinc-900 transition-colors"
              >
                Bookings
              </Link>
            )}
            <span className="text-zinc-400">
              © {new Date().getFullYear()} VeloRent
            </span>
          </div>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
