"use client";
/* IntentDraw | Regions used: None */
import React, { useState } from 'react';
import { Mail, Lock, LogIn } from 'lucide-react';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempt:', { email, password });
    // In a real app, you'd handle authentication here
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center overflow-hidden p-6">
      {/* Background glowing gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-tr from-purple-700 to-blue-600 rounded-full mix-blend-screen filter blur-[150px] opacity-70 animate-blob"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tl from-pink-600 to-red-500 rounded-full mix-blend-screen filter blur-[150px] opacity-70 animate-blob animation-delay-2000"></div>

      {/* Login Card */}
      <div
        className="relative z-10 w-full max-w-md p-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px]
                   flex flex-col items-center shadow-lg transition-all duration-300 ease-in-out
                   hover:border-white/30 hover:shadow-xl group"
      >
        <h2 className="text-4xl md:text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-300 tracking-tight text-center">
          Sign In
        </h2>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div>
            <label htmlFor="email" className="sr-only">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-white/70">
                <Mail size={20} />
              </span>
              <input
                type="email"
                id="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-12 py-3 bg-white/5 border border-white/10 rounded-2xl text-white
                           placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                           focus:border-transparent transition-colors duration-200 text-lg"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-white/70">
                <Lock size={20} />
              </span>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-12 py-3 bg-white/5 border border-white/10 rounded-2xl text-white
                           placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                           focus:border-transparent transition-colors duration-200 text-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-500
                       text-white font-bold text-lg rounded-2xl hover:from-purple-700 hover:to-blue-600
                       transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105
                       active:scale-95 shadow-lg focus:outline-none focus:ring-4 focus:ring-purple-500/40"
          >
            <LogIn size={20} /> Log In
          </button>
        </form>

        <p className="mt-6 text-sm text-white/70">
          Don't have an account?{' '}
          <a
            href="#"
            className="font-medium text-purple-400 hover:text-purple-300 transition-colors duration-200"
          >
            Sign Up
          </a>
        </p>
      </div>

      {/* Keyframe animations for background blobs */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 40px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}