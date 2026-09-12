import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('alex@agentpay.io');
  const [password, setPassword] = useState('password123');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(email, password);
    navigate('/dashboard');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-black text-[#1E293B]">Welcome Back</h2>
        <p className="text-xs text-gray-500 mt-1">Sign in to your AgentPay account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#343434] mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@agentpay.io"
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#E9D8CC] rounded-xl text-xs text-[#343434] focus:outline-none focus:border-[#FAD2C0] focus:ring-2 focus:ring-[#FAD2C0]/40 transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-[#343434]">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-[#3B82F6] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#E9D8CC] rounded-xl text-xs text-[#343434] focus:outline-none focus:border-[#FAD2C0] focus:ring-2 focus:ring-[#FAD2C0]/40 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 px-4 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all mt-2 cursor-pointer"
        >
          <span>Sign In to Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Footer Link */}
      <div className="mt-6 pt-5 border-t border-[#E9D8CC] text-center text-xs text-gray-600">
        Don't have an account?{' '}
        <Link to="/signup" className="font-bold text-[#3B82F6] hover:underline">
          Create Account
        </Link>
      </div>
    </div>
  );
}
