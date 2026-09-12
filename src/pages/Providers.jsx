import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Languages, 
  Database, 
  Cpu, 
  Star, 
  Zap, 
  ShieldCheck, 
  Info, 
  X, 
  ExternalLink,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Send
} from 'lucide-react';
import { mockProviders } from '../data/mockData';

export default function Providers() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('price-low');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [demoNotice, setDemoNotice] = useState(null);

  // Category & Sorting filtering logic
  const filteredProviders = useMemo(() => {
    return mockProviders
      .filter((p) => selectedCategory === 'All' || p.service === selectedCategory)
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'quality-high') return b.quality - a.quality;
        if (sortBy === 'rating-high') return b.rating - a.rating;
        if (sortBy === 'speed-fast') return a.responseTimeMs - b.responseTimeMs;
        return 0;
      });
  }, [selectedCategory, sortBy]);

  const getServiceIcon = (service) => {
    switch (service) {
      case 'Translation': return Languages;
      case 'Storage': return Database;
      case 'Compute': return Cpu;
      default: return Users;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3E8C5A]"></span>
            <span>Available</span>
          </span>
        );
      case 'Busy':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E65100]"></span>
            <span>Busy</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            <span>Offline</span>
          </span>
        );
    }
  };

  const handleRequestServiceDemo = (provider) => {
    setDemoNotice(`Service request initiated for ${provider.name} (${provider.service}) — Frontend demo only.`);
    setTimeout(() => setDemoNotice(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* 1. Page Header & Explanatory Info Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#343434] tracking-tight">Service Providers</h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Choose from independent providers based on price, quality, and performance.
          </p>
        </div>

        {/* Informational Banner */}
        <div className="bg-[#E8F5E9] border border-[#C8E6C9] px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs text-[#2E7D32] max-w-lg shadow-xs">
          <ShieldCheck className="w-5 h-5 text-[#3E8C5A] shrink-0" />
          <p className="leading-tight">
            The AI agent autonomously selects & purchases services from independent providers via the AgentPay HTTP 402 payment flow.
          </p>
        </div>
      </div>

      {/* Demo Trigger Toast Notification */}
      {demoNotice && (
        <div className="p-3 bg-[#E3F2FD] border border-[#BBDEFB] text-[#1E3A8A] rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <span>💡 {demoNotice}</span>
          <button onClick={() => setDemoNotice(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Controls Bar: Category Filter Tabs & Sorting Select */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-5 shadow-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['All', 'Translation', 'Storage', 'Compute'].map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === category
                  ? 'bg-[#FAD2C0] text-[#343434] shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-[#FDF8F5] border border-[#E9D8CC]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center space-x-2 shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="py-2 px-3 bg-white border border-[#E9D8CC] rounded-2xl text-xs font-bold text-[#343434] focus:outline-none focus:border-[#FAD2C0] transition-all shadow-xs cursor-pointer"
          >
            <option value="price-low">Sort: Price (Low → High)</option>
            <option value="quality-high">Sort: Quality (High → Low)</option>
            <option value="rating-high">Sort: Rating (High → Low)</option>
            <option value="speed-fast">Sort: Speed (Fastest)</option>
          </select>
        </div>
      </div>

      {/* 3. Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProviders.map((provider) => {
          const ServiceIcon = getServiceIcon(provider.service);
          return (
            <div
              key={provider.id}
              onClick={() => setSelectedProvider(provider)}
              className="bg-[#FFF9F5] border border-[#E9D8CC] hover:border-[#FAD2C0] rounded-3xl p-6 shadow-card hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer space-y-4 group relative"
            >
              {/* Card Header: Icon, Title & Status */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB] group-hover:scale-105 transition-transform">
                      <ServiceIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-[#343434] group-hover:text-[#2563EB] transition-colors">
                        {provider.name}
                      </h3>
                      <span className="text-[11px] font-semibold text-gray-500">
                        {provider.service}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {getStatusBadge(provider.status)}
                </div>

                {/* Optional Signal Badges */}
                {provider.badge && (
                  <div className="mt-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase ${
                      provider.badge === 'LOWEST PRICE' 
                        ? 'bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]' 
                        : provider.badge === 'TOP QUALITY'
                        ? 'bg-[#E3F2FD] text-[#2563EB] border border-[#BBDEFB]'
                        : 'bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]'
                    }`}>
                      {provider.badge}
                    </span>
                  </div>
                )}

                {/* Description snippet */}
                <p className="text-xs text-gray-600 line-clamp-2 mt-3 leading-relaxed">
                  {provider.description}
                </p>
              </div>

              {/* Stats Key-Value Grid */}
              <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-2xl border border-[#E9D8CC] text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 block font-medium">Price</span>
                  <span className="font-extrabold text-[#343434]">
                    {provider.currency}{provider.price}
                  </span>
                  <span className="text-[9px] text-gray-400 block">/ req</span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block font-medium">Quality</span>
                  <span className="font-extrabold text-[#3E8C5A]">
                    {provider.qualityLabel}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block font-medium">Speed</span>
                  <span className="font-bold text-gray-700">
                    {provider.responseTime}
                  </span>
                </div>
              </div>

              {/* Card Footer Action */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1 text-amber-500 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{provider.rating}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProvider(provider);
                  }}
                  className="px-3.5 py-1.5 bg-white group-hover:bg-[#FAD2C0] border border-[#E9D8CC] group-hover:border-[#FAD2C0] text-[#343434] font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  View Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. PROVIDER DETAIL INSPECTION MODAL */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-[#343434]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E9D8CC] flex items-center justify-between bg-white">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB]">
                  {React.createElement(getServiceIcon(selectedProvider.service), { className: 'w-4 h-4' })}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#343434]">{selectedProvider.name}</h3>
                  <span className="text-[11px] font-bold text-[#3B82F6] bg-[#E3F2FD] px-2 py-0.5 rounded-full">
                    Independent Service Provider
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProvider(null)}
                className="p-1 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-[#FAD2C0]/30 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Description */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
                  PROVIDER OVERVIEW
                </span>
                <p className="text-xs text-gray-700 leading-relaxed bg-white p-3.5 rounded-2xl border border-[#E9D8CC]">
                  {selectedProvider.description}
                </p>
              </div>

              {/* Performance Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-4 rounded-2xl border border-[#E9D8CC]">
                <div>
                  <span className="text-gray-400 text-[10px] block font-medium">Price / Request</span>
                  <span className="font-extrabold text-sm text-[#343434]">
                    {selectedProvider.currency}{selectedProvider.price}.00
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 text-[10px] block font-medium">Quality Score</span>
                  <span className="font-extrabold text-sm text-[#3E8C5A]">
                    {selectedProvider.qualityLabel}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 text-[10px] block font-medium">Rating</span>
                  <span className="font-bold text-sm text-amber-600 flex items-center space-x-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{selectedProvider.rating}</span>
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 text-[10px] block font-medium">Response Time</span>
                  <span className="font-bold text-sm text-gray-700">
                    {selectedProvider.responseTime}
                  </span>
                </div>
              </div>

              {/* Technical Endpoint Information */}
              <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] space-y-2 text-xs">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
                  x402 PAYMENT ENDPOINT
                </span>
                <code className="font-mono text-[#2563EB] bg-[#FDF8F5] px-3 py-1.5 rounded-xl border border-[#E9D8CC] block truncate text-[11px]">
                  {selectedProvider.endpoint}
                </code>
                <p className="text-[10px] text-gray-500 font-serif italic pt-1">
                  Supports HTTP 402 Payment Required headers with Sepolia contract authorization.
                </p>
              </div>

              {/* Status Banner */}
              <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-[#E9D8CC] text-xs">
                <span className="text-gray-500 font-semibold">Availability Status:</span>
                {getStatusBadge(selectedProvider.status)}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 bg-[#FDF8F5] border-t border-[#E9D8CC] flex items-center justify-between">
              <button
                onClick={() => setSelectedProvider(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={() => {
                  handleRequestServiceDemo(selectedProvider);
                  setSelectedProvider(null);
                }}
                className="px-5 py-2.5 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Request Service</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
