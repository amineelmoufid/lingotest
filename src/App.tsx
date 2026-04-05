/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Chat from './components/Chat';
import { LogIn, LogOut, GraduationCap, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-indigo-600">
          <GraduationCap size={28} />
          <h1 className="text-xl font-bold tracking-tight text-gray-900">LingoTest</h1>
        </div>
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              )}
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.displayName}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:block">Sign Out</span>
            </button>
          </div>
        ) : null}
      </header>

      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-hidden flex flex-col">
        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-8">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <GraduationCap size={40} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Test Your English Level</h2>
            <p className="text-gray-600 text-lg">
              Have a natural conversation with our AI assessor to discover your CEFR English proficiency level (A1-C2).
            </p>
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-3 bg-white border border-gray-300 text-gray-700 px-8 py-4 rounded-full font-medium hover:bg-gray-50 hover:shadow-sm transition-all w-full justify-center text-lg"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
              Sign in with Google
            </button>
          </div>
        ) : (
          <Chat />
        )}
      </main>
    </div>
  );
}

