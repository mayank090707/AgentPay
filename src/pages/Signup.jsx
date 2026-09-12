import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, ArrowRight } from 'lucide-react';

export default function Signup() {
  const [name, setName] = useState('Alex');
  const [email, setEmail] = useState('alex@agentpay.io');
  const [password, setPassword] = useState('password123');
  const [confirmPassword, setConfirmPassword] = useState('password123');
  const [agreed, setAgreed] = useState(true);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    login(email, password);
    navigate('/dashboard');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-2xl font-black text-[#1E293B]">Create Your Account</h2>
        <p className="text-xs text-gray-500 mt-1">
          Join AgentPay and take control of your AI agent's spending.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#343434] mb-1">Full Name</label>
          <div className="relative">
            <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Sharma"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E9D8CC] rounded-xl text-xs text-[#343434] focus:outline-none focus:border-[#FAD2C0] focus:ring-2 focus:ring-[#FAD2C0]/40 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#343434] mb-1">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@agentpay.io"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E9D8CC] rounded-xl text-xs text-[#343434] focus:outline-none focus:border-[#FAD2C0] focus:ring-2 focus:ring-[#FAD2C0]/40 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#343434] mb-1">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E9D8CC] rounded-xl text-xs text-[#343434] focus:outline-none focus:border-[#FAD2C0] focus:ring-2 focus:ring-[#FAD2C0]/40 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#343434] mb-1">Confirm Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E9D8CC] rounded-xl text-xs text-[#343434] focus:outline-none focus:border-[#FAD2C0] focus:ring-2 focus:ring-[#FAD2C0]/40 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-1">
          <input
            type="checkbox"
            id="terms"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="rounded border-[#E9D8CC] text-[#3E8C5A] focus:ring-[#FAD2C0]"
          />
          <label htmlFor="terms" className="text-[11px] text-gray-600">
            I agree to the Terms of Service & Smart Contract Policy
          </label>
        </div>

        <button
          type="submit"
          className="w-full py-3 px-4 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all mt-3 cursor-pointer"
        >
          <span>Create Account</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Footer Link */}
      <div className="mt-5 pt-4 border-t border-[#E9D8CC] text-center text-xs text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-[#3B82F6] hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}
