import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-black text-[#1E293B]">Reset Password</h2>
        <p className="text-xs text-gray-500 mt-1">Enter your registered email address to receive reset instructions.</p>
      </div>

      {submitted ? (
        <div className="p-5 bg-[#E8F5E9] border border-[#C8E6C9] rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-[#3E8C5A] mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-[#343434]">Reset Link Sent!</h3>
            <p className="text-xs text-gray-600 mt-1">
              If an account exists for <span className="font-semibold">{email}</span>, you will receive password recovery instructions.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#3E8C5A] hover:underline pt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      ) : (
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

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold text-xs rounded-xl shadow-xs transition-all mt-2 cursor-pointer"
          >
            Send Reset Instructions
          </button>

          <div className="pt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-gray-600 hover:text-[#343434]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
