import React, { useState } from 'react';
import { AppRole } from '../../types';

interface RoleSelectionScreenProps {
  onSelectRole: (role: AppRole) => void;
  onDriverLogin?: () => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onSelectRole,
  onDriverLogin
}) => {
  const [selectedRole, setSelectedRole] = useState<AppRole>('passenger');

  return (
    <div className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col justify-between items-center min-h-full h-full w-full px-6 py-8 font-sans antialiased select-none">
      {/* BEGIN: AppHeader */}
      <header className="flex flex-col items-center pt-4" data-purpose="app-branding">
        <div
          className="w-16 h-16 rounded-2xl bg-[#ea580c] flex items-center justify-center shadow-lg shadow-orange-500/20 mb-3"
          data-purpose="bus-logo-badge"
        >
          <svg
            className="w-9 h-9 text-white"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M8 6v6" />
            <path d="M15 6v6" />
            <path d="M2 12h19.6" />
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3" />
            <circle cx="7" cy="18" r="2" />
            <path d="M9 18h5" />
            <circle cx="17" cy="18" r="2" />
          </svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">CampusShuttle</h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium tracking-wide uppercase">
          COLLEGE TRANSIT TRACKER
        </p>
      </header>
      {/* END: AppHeader */}

      {/* BEGIN: RoleSelectionSection */}
      <main className="w-full max-w-xs flex flex-col items-center my-auto py-6" data-purpose="role-selection-area">
        <div className="grid grid-cols-2 gap-6 w-full place-items-center">
          {/* Option 1: Student / Passenger */}
          <button
            onClick={() => setSelectedRole('passenger')}
            className="group flex flex-col items-center text-center focus:outline-none transition-transform active:scale-95 w-full cursor-pointer"
            data-purpose="role-option-passenger"
            id="role-passenger"
            type="button"
          >
            <div className="relative mb-3">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-md transition-all ${
                  selectedRole === 'passenger'
                    ? 'bg-orange-50 ring-4 ring-[#ea580c] text-[#ea580c]'
                    : 'bg-slate-100 ring-2 ring-slate-200 text-slate-400 hover:ring-slate-300'
                }`}
              >
                <svg
                  className={`w-12 h-12 transition-colors ${
                    selectedRole === 'passenger' ? 'text-[#ea580c]' : 'text-slate-500'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    clipRule="evenodd"
                    d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                    fillRule="evenodd"
                  />
                </svg>
              </div>
              {selectedRole === 'passenger' && (
                <span className="absolute bottom-0 right-0 bg-[#ea580c] text-white rounded-full p-1 shadow">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path
                      clipRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      fillRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </div>
            <span className={`text-sm font-semibold ${selectedRole === 'passenger' ? 'text-slate-900 dark:text-white' : 'text-slate-600'}`}>
              Passenger
            </span>
            <span className="text-xs text-slate-400 mt-0.5">Student / Faculty</span>
          </button>

          {/* Option 2: Driver / Staff */}
          <button
            onClick={() => setSelectedRole('driver')}
            className={`group flex flex-col items-center text-center focus:outline-none transition-transform active:scale-95 w-full cursor-pointer ${
              selectedRole === 'driver' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
            }`}
            data-purpose="role-option-driver"
            id="role-driver"
            type="button"
          >
            <div className="relative mb-3">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  selectedRole === 'driver'
                    ? 'bg-orange-50 ring-4 ring-[#ea580c] text-[#ea580c] shadow-md'
                    : 'bg-slate-100 ring-2 ring-slate-200 text-slate-400 group-hover:ring-slate-300'
                }`}
              >
                <svg
                  className={`w-12 h-12 transition-colors ${
                    selectedRole === 'driver' ? 'text-[#ea580c]' : 'text-slate-500'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
                  <path
                    clipRule="evenodd"
                    d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-15 4.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
                    fillRule="evenodd"
                  />
                </svg>
              </div>
              {selectedRole === 'driver' && (
                <span className="absolute bottom-0 right-0 bg-[#ea580c] text-white rounded-full p-1 shadow">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path
                      clipRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      fillRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </div>
            <span
              className={`text-sm font-semibold ${
                selectedRole === 'driver' ? 'text-slate-900 dark:text-white' : 'text-slate-600'
              }`}
            >
              Bus Driver
            </span>
            <span className="text-xs text-slate-400 mt-0.5">Transit Operator</span>
          </button>
        </div>
      </main>
      {/* END: RoleSelectionSection */}

      {/* BEGIN: ActionFooter */}
      <footer className="w-full max-w-xs flex flex-col items-center pb-2" data-purpose="footer-actions">
        <button
          onClick={() => onSelectRole(selectedRole)}
          className="w-full py-3.5 px-6 rounded-full bg-[#ea580c] hover:bg-orange-600 active:bg-orange-700 text-white font-medium text-base shadow-md shadow-orange-500/25 transition-all text-center tracking-wide mb-6 cursor-pointer active:scale-98"
          id="btn-continue"
          type="button"
        >
          {selectedRole === 'passenger' ? 'Continue as Passenger' : 'Continue as Driver'}
        </button>

        <nav className="flex items-center justify-center space-x-4 text-xs font-medium text-slate-500" data-purpose="secondary-links">
          <button
            type="button"
            onClick={() => {
              setSelectedRole('driver');
              if (onDriverLogin) onDriverLogin();
              else onSelectRole('driver');
            }}
            className="hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            Driver Login
          </button>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <button
            type="button"
            onClick={() => setSelectedRole(prev => (prev === 'passenger' ? 'driver' : 'passenger'))}
            className="hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            Switch Account
          </button>
        </nav>
      </footer>
      {/* END: ActionFooter */}
    </div>
  );
};
