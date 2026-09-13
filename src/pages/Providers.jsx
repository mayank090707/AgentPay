import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Languages, 
  Database, 
  Cpu, 
  Star, 
  ShieldCheck, 
  X, 
  ArrowUpDown, 
  RefreshCw, 
  Bot,
  Info
} from 'lucide-react';
import { fetchProviders } from '../services/api';
import { mockProviders } from '../data/mockData';

export default function Providers() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('price-low');
  const [selectedProvider, setSelectedProvider] = useState(null);

  // Live Backend State
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendLive, setIsBackendLive] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadProviders() {
      setIsLoading(true);
      try {
        const res = await fetchProviders();
        if (!isMounted) return;
        if (res && Array.isArray(res.providers) && res.providers.length > 0) {
          const formatted = [];
          res.providers.forEach((p, idx) => {
            const services = p.services || {};
            Object.keys(services).forEach((serviceKey) => {
              const sInfo = services[serviceKey];
              const serviceName = serviceKey.charAt(0).toUpperCase() + serviceKey.slice(1);
              const isCheaper = (p.provider_id === 'beta');
              formatted.push({
                id: `${p.provider_id || idx}_${serviceKey}`,
                provider_id: p.provider_id,
                name: p.name || 'Service Provider',
                service: serviceName,
                price: sInfo.price_per_unit,
                currency: 'ETH',
                unit: sInfo.unit,
                quality: p.provider_id === 'alpha' ? 98 : 94,
                qualityLabel: p.provider_id === 'alpha' ? '98%' : '94%',
                rating: p.provider_id === 'alpha' ? 4.9 : 4.6,
                responseTime: p.provider_id === 'alpha' ? '95ms' : '140ms',
                responseTimeMs: p.provider_id === 'alpha' ? 95 : 140,
                status: 'Available',
                badge: isCheaper ? 'LOWEST PRICE' : 'TOP QUALITY',
                description: p.description || `Registered independent ${serviceName} provider on AgentPay network.`,
                endpoint: `${p.base_url || 'http://localhost:8000'}/services/${serviceKey}?provider_id=${p.provider_id}`,
              });
            });
          });
          setProviders(formatted);
          setIsBackendLive(true);
        } else {
          setProviders(mockProviders);
          setIsBackendLive(false);
        }
      } catch (err) {
        if (isMounted) {
          setProviders(mockProviders);
          setIsBackendLive(false);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProviders();
    return () => {
      isMounted = false;
    };
  }, []);

  // Category & Sorting filtering logic
  const filteredProviders = useMemo(() => {
    return providers
      .filter((p) => selectedCategory === 'All' || p.service === selectedCategory)
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'quality-high') return (b.quality || 0) - (a.quality || 0);
        if (sortBy === 'rating-high') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'speed-fast') return (a.responseTimeMs || 0) - (b.responseTimeMs || 0);
        return 0;
      });
  }, [providers, selectedCategory, sortBy]);

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

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* 1. Page Header & Explanatory Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-[#343434] tracking-tight">Provider Directory</h1>
            {isBackendLive ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3E8C5A] animate-pulse"></span>
                <span>Live Provider Marketplace</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                <span>⚡ Demo Fallback Providers</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Independent service providers registered on the AgentPay network.
          </p>
        </div>

        {/* Informational Banner */}
        <div className="bg-[#E8F5E9] border border-[#C8E6C9] px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs text-[#2E7D32] max-w-xl shadow-xs">
          <Bot className="w-5 h-5 text-[#3E8C5A] shrink-0" />
          <p className="leading-tight font-medium">
            Providers are automatically discovered and purchased by the AI Agent when required by a task. Manual purchasing is disabled to enforce autonomous payment logic.
          </p>
        </div>
      </div>

      {/* 2. Catalog Control Bar (Filters & Sorting) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFF9F5] p-3 rounded-3xl border border-[#E9D8CC] shadow-card">
        
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
      {isLoading ? (
        <div className="py-12 text-center text-gray-400 space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto text-[#2563EB] animate-spin" />
          <p className="text-xs font-semibold">Loading provider catalog from backend...</p>
        </div>
      ) : (
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

                  {/* Signal Badges */}
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
                      {provider.price} {provider.currency || ''}
                    </span>
                    <span className="text-[9px] text-gray-400 block">/ req</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 block font-medium">Quality</span>
                    <span className="font-extrabold text-[#3E8C5A]">
                      {provider.qualityLabel || '98%'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-400 block font-medium">Speed</span>
                    <span className="font-bold text-gray-700">
                      {provider.responseTime || '90ms'}
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-2 flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 py-2 px-3 bg-gray-100 border border-gray-200 text-gray-500 font-bold text-[11px] rounded-xl flex items-center justify-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#3E8C5A]" />
                    <span>Agent Compatible</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProvider(provider);
                    }}
                    className="px-3 py-2 bg-white hover:bg-gray-50 border border-[#E9D8CC] text-gray-700 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                    {selectedProvider.price} {selectedProvider.currency || ''}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 text-[10px] block font-medium">Quality Score</span>
                  <span className="font-extrabold text-sm text-[#3E8C5A]">
                    {selectedProvider.qualityLabel || '98%'}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 text-[10px] block font-medium">Rating</span>
                  <span className="font-bold text-sm text-amber-600 flex items-center space-x-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{selectedProvider.rating || 4.8}</span>
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 text-[10px] block font-medium">Response Time</span>
                  <span className="font-bold text-sm text-gray-700">
                    {selectedProvider.responseTime || '90ms'}
                  </span>
                </div>
              </div>

              {/* Technical Endpoint Information */}
              <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] space-y-2 text-xs">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
                  HTTP 402 PAYMENT ENDPOINT
                </span>
                <code className="font-mono text-[#2563EB] bg-[#FDF8F5] px-3 py-1.5 rounded-xl border border-[#E9D8CC] block truncate text-[11px]">
                  {selectedProvider.endpoint}
                </code>
                <p className="text-[10px] text-gray-500 font-serif italic pt-1">
                  Supports HTTP 402 Payment Required headers with Sepolia smart contract authorization.
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
              <span className="text-[11px] text-gray-500 font-medium">
                Auto-purchased via AI Agent tasks
              </span>

              <button
                onClick={() => setSelectedProvider(null)}
                className="px-5 py-2.5 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
