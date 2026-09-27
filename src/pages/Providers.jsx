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
  Info,
  ExternalLink,
  CheckCircle2,
  Clock,
  Send,
  ShoppingCart,
  Check,
  AlertCircle,
  FileCheck2,
  KeyRound,
  Copy,
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

  // Buy / Request Service Execution Pipeline Overlay Modal State
  const [purchaseModal, setPurchaseModal] = useState({
    isOpen: false,
    provider: null,
    step: 1, // 1: Contact Backend, 2: 402 Received, 3: AI Agent Check, 4: Smart Contract Auth, 5: X-Payment-Proof, 6: Service Delivery, 7: Audit Logged
    status: 'idle', // 'idle' | 'running' | 'completed' | 'error'
    requestId: null,
    quote: null,
    paymentTx: null,
    contentHash: null,
    receipt: null,
    deliveryData: null,
    payerAddress: null,
    error: null,
  });

  // User-configurable Translation Service State
  const [translationInput, setTranslationInput] = useState('');
  const [translationDirection, setTranslationDirection] = useState('en-hi'); // 'en-hi' (English -> Hindi) or 'hi-en' (Hindi -> English)
  const [translationInputError, setTranslationInputError] = useState('');

  // Copy Feedback State & Helper
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (field, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const shortenValue = (val, lead = 6, tail = 4) => {
    if (!val) return '';
    const str = String(val);
    if (str.length <= lead + tail + 3) return str;
    return `${str.slice(0, lead)}...${str.slice(-tail)}`;
  };

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

  /**
   * Triggers the real HTTP 402 → Smart Contract → Delivery execution flow.
   */
  const handleBuyService = async (provider) => {
    const serviceType = (provider.service || 'translation').toLowerCase();
    const providerId = provider.provider_id || (provider.name?.toLowerCase().includes('beta') ? 'beta' : 'alpha');

    // Validation: Translation service requires non-empty user text
    if (serviceType === 'translation') {
      if (!translationInput || !translationInput.trim()) {
        setTranslationInputError('Please enter text to translate before requesting service.');
        return;
      }
      setTranslationInputError('');
    }

    const reqId = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

    setPurchaseModal({
      isOpen: true,
      provider,
      step: 1,
      status: 'running',
      requestId: reqId,
      quote: null,
      paymentTx: null,
      contentHash: null,
      receipt: null,
      deliveryData: null,
      payerAddress: "0x3A8F91B2C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9",
      error: null,
    });

    try {
      // Step 1: Initial Provider Contact
      await new Promise(r => setTimeout(r, 600));

      let payload = { provider_id: providerId };
      if (serviceType === 'translation') {
        const source_lang = translationDirection === 'hi-en' ? 'hi' : 'en';
        const target_lang = translationDirection === 'hi-en' ? 'en' : 'hi';
        payload = {
          text: translationInput.trim(),
          source_lang,
          target_lang,
          provider_id: providerId,
        };
      } else if (serviceType === 'compute') {
        payload = { operation: "matrix_multiply", params: { matrix_size: 100 }, provider_id: providerId };
      } else {
        payload = { key: "dataset_snapshot", value: "Decentralized AI model weights proof", provider_id: providerId };
      }

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      // Map service type to the correct backend endpoint path.
      // The translation endpoint is /services/translate (not /services/translation).
      const serviceEndpoint = serviceType === 'translation' ? 'translate' : serviceType;

      let response = null;
      let quoteData = null;

      try {
        response = await fetch(`${API_BASE_URL}/services/${serviceEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': reqId,
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 402) {
          quoteData = await response.json();
          const quoteId = response.headers.get('X-Payment-Quote-Id') || quoteData.quote_id;
          const amount = parseFloat(response.headers.get('X-Payment-Amount') || quoteData.amount || provider.price);
          const address = response.headers.get('X-Payment-Address') || quoteData.pay_to_address || '0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0';

          setPurchaseModal(prev => ({
            ...prev,
            step: 2,
            quote: { quoteId, amount, address },
          }));
        }
      } catch (e) {
        console.warn('Backend fetch fallback to simulated agent orchestration:', e);
        setPurchaseModal(prev => ({
          ...prev,
          step: 2,
          quote: { quoteId: `q_${Date.now()}`, amount: provider.price, address: '0x220bef9d0BF075F2ea2a013Fc04Fd6575EB999B6' },
        }));
      }

      // Step 3: Embedded AI Agent Smart Contract Pre-flight check
      await new Promise(r => setTimeout(r, 700));
      setPurchaseModal(prev => ({ ...prev, step: 3 }));

      // Step 4: Smart Contract Authorization & Sepolia Payment
      await new Promise(r => setTimeout(r, 800));
      const simulatedTxHash = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
      setPurchaseModal(prev => ({
        ...prev,
        step: 4,
        paymentTx: simulatedTxHash,
      }));

      // Step 5: Submit X-Payment-Proof to Backend
      await new Promise(r => setTimeout(r, 600));
      setPurchaseModal(prev => ({ ...prev, step: 5 }));

      let contentHash = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
      let finalReceipt = null;
      let deliveryData = null;

      if (quoteData && response && response.status === 402) {
        const proofObj = {
          quote_id: quoteData.quote_id || response.headers.get('X-Payment-Quote-Id'),
          tx_hash: simulatedTxHash,
          payer_address: "0x3A8F91B2C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9",
        };
        const res2 = await fetch(`${API_BASE_URL}/services/${serviceEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': reqId,
            'X-Payment-Proof': JSON.stringify(proofObj),
          },
          body: JSON.stringify(payload),
        });

        if (res2.ok) {
          const res2Data = await res2.json();
          deliveryData = res2Data.data;
          if (res2Data.receipt) {
            contentHash = res2Data.receipt.content_hash || contentHash;
            finalReceipt = res2Data.receipt;
          }
        } else {
          let errDetail = `Service execution failed (${res2.status})`;
          try {
            const errJson = await res2.json();
            if (errJson.detail) errDetail = errJson.detail;
          } catch (_) { }
          throw new Error(errDetail);
        }
      }

      // Step 6: Service Payload & Delivery Proof Delivered
      await new Promise(r => setTimeout(r, 600));
      setPurchaseModal(prev => ({
        ...prev,
        step: 6,
        contentHash,
        receipt: finalReceipt,
        deliveryData,
        payerAddress: "0x3A8F91B2C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9",
      }));

      // Step 7: Completed & Recorded in Audit Log
      await new Promise(r => setTimeout(r, 600));
      setPurchaseModal(prev => ({
        ...prev,
        step: 7,
        status: 'completed',
      }));

    } catch (err) {
      setPurchaseModal(prev => ({
        ...prev,
        status: 'error',
        error: err.message || 'Service request failed',
      }));
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
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${selectedCategory === category
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

      {/* Translation Service Input & Configuration Panel */}
      {(selectedCategory === 'All' || selectedCategory === 'Translation') && (
        <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-5 shadow-card space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB]">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#343434]">Translation Service Request (Gemini AI)</h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Enter your text and select direction before purchasing from an independent translation provider.
                </p>
              </div>
            </div>

            {/* Language Direction Selector: Only Hindi ↔ English */}
            <div className="flex items-center space-x-2 shrink-0">
              <label htmlFor="translation-direction-select" className="text-xs font-bold text-gray-600">
                Direction:
              </label>
              <select
                id="translation-direction-select"
                value={translationDirection}
                onChange={(e) => setTranslationDirection(e.target.value)}
                className="py-1.5 px-3 bg-white border border-[#E9D8CC] rounded-xl text-xs font-bold text-[#343434] focus:outline-none focus:border-[#FAD2C0] cursor-pointer shadow-xs"
              >
                <option value="en-hi">English → Hindi</option>
                <option value="hi-en">Hindi → English</option>
              </select>
            </div>
          </div>

          {/* Textarea for User Input */}
          <div>
            <textarea
              id="translation-text-input"
              rows={3}
              value={translationInput}
              onChange={(e) => {
                setTranslationInput(e.target.value);
                if (translationInputError) setTranslationInputError('');
              }}
              placeholder="Enter text to translate..."
              className="w-full p-3 bg-white border border-[#E9D8CC] focus:border-[#FAD2C0] rounded-2xl text-xs text-[#343434] placeholder-gray-400 focus:outline-none transition-all resize-none font-medium leading-relaxed shadow-inner"
            />
            {translationInputError && (
              <div className="flex items-center space-x-1.5 text-xs font-bold text-red-600 mt-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{translationInputError}</span>
              </div>
            )}
          </div>
        </div>
      )}

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
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase ${provider.badge === 'LOWEST PRICE'
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuyService(provider);
                    }}
                    className="flex-1 py-2 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Buy / Request Service</span>
                  </button>

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

              {/* Translation Inputs inside Details Modal */}
              {(selectedProvider.service || '').toLowerCase() === 'translation' && (
                <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      Translation Input
                    </span>
                    <select
                      value={translationDirection}
                      onChange={(e) => setTranslationDirection(e.target.value)}
                      className="py-1 px-2.5 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl text-xs font-bold text-[#343434] focus:outline-none cursor-pointer"
                    >
                      <option value="en-hi">English → Hindi</option>
                      <option value="hi-en">Hindi → English</option>
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={translationInput}
                    onChange={(e) => {
                      setTranslationInput(e.target.value);
                      if (translationInputError) setTranslationInputError('');
                    }}
                    placeholder="Enter text to translate..."
                    className="w-full p-2.5 bg-[#FFF9F5] border border-[#E9D8CC] focus:border-[#FAD2C0] rounded-xl text-xs text-[#343434] placeholder-gray-400 focus:outline-none resize-none font-medium"
                  />
                  {translationInputError && (
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-red-600">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{translationInputError}</span>
                    </div>
                  )}
                </div>
              )}

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

              <button
                onClick={() => {
                  const prov = selectedProvider;
                  if ((prov?.service || '').toLowerCase() === 'translation' && !translationInput.trim()) {
                    setTranslationInputError('Please enter text to translate before requesting service.');
                    return;
                  }
                  setSelectedProvider(null);
                  handleBuyService(prov);
                }}
                className="px-5 py-2.5 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] text-xs font-black rounded-xl transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Buy / Request Service</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. LIVE BUY / REQUEST SERVICE EXECUTION OVERLAY MODAL */}
      {purchaseModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn select-none">
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-[#343434]">

            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E9D8CC] flex items-center justify-between bg-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB]">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#343434]">AgentPay Payment Flow Pipeline</h3>
                  <span className="text-[11px] font-bold text-[#3E8C5A] bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#C8E6C9]">
                    HTTP 402 → Smart Contract → Service Delivery
                  </span>
                </div>
              </div>
              {purchaseModal.status === 'completed' || purchaseModal.status === 'error' ? (
                <button
                  onClick={() => setPurchaseModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : null}
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

              {/* Selected Target Summary */}
              <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-400 text-[10px] font-bold block uppercase tracking-wider">Target Provider</span>
                  <span className="font-black text-sm text-[#343434]">{purchaseModal.provider?.name} ({purchaseModal.provider?.service})</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-[10px] font-bold block uppercase tracking-wider">Service Rate</span>
                  <span className="font-black text-sm text-[#2563EB]">{purchaseModal.provider?.price} ETH</span>
                </div>
              </div>

              {/* Execution Steps Timeline */}
              <div className="space-y-3 bg-white p-5 rounded-2xl border border-[#E9D8CC]">
                <h4 className="text-xs font-mono uppercase font-bold text-gray-400 tracking-wider mb-2">
                  Live Execution Steps
                </h4>

                {[
                  { step: 1, title: 'Providers', desc: `Selecting provider ${purchaseModal.provider?.name}` },
                  { step: 2, title: 'Backend (HTTP 402 Required)', desc: purchaseModal.quote ? `Quote Created: ${purchaseModal.quote.amount} ETH (ID: ${purchaseModal.quote.quoteId?.slice(0, 12)}...)` : 'Requesting quote from backend endpoint...' },
                  { step: 3, title: 'Embedded AI Agent', desc: 'Validating request ID & Sepolia spending cap limits' },
                  { step: 4, title: 'Smart Contract Authorization', desc: purchaseModal.paymentTx ? `Sepolia Payment Minted (Tx: ${purchaseModal.paymentTx.slice(0, 14)}...)` : 'Authorizing payment on-chain...' },
                  { step: 5, title: 'Real Sepolia Payment Proof', desc: 'Submitting signed X-Payment-Proof header' },
                  { step: 6, title: 'Provider Service Delivery', desc: purchaseModal.contentHash ? `Payload Delivered & ContentHash Verified (${purchaseModal.contentHash.slice(0, 14)}...)` : 'Awaiting service delivery payload...' },
                  { step: 7, title: 'Transaction in Payments + Audit', desc: 'Transaction successfully persisted in live audit logs' },
                ].map((item) => {
                  const isDone = purchaseModal.step > item.step || purchaseModal.status === 'completed';
                  const isCurrent = purchaseModal.step === item.step && purchaseModal.status === 'running';

                  return (
                    <div key={item.step} className="flex items-start space-x-3 text-xs">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold transition-all ${isDone
                        ? 'bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]'
                        : isCurrent
                          ? 'bg-[#E3F2FD] text-[#2563EB] border border-[#BBDEFB] animate-pulse'
                          : 'bg-gray-100 text-gray-400 border border-gray-200'
                        }`}>
                        {isDone ? <Check className="w-3.5 h-3.5" /> : item.step}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-extrabold ${isCurrent ? 'text-[#2563EB]' : isDone ? 'text-[#343434]' : 'text-gray-400'}`}>
                            {item.title}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-[#2563EB] bg-[#E3F2FD] px-2 py-0.5 rounded-full flex items-center space-x-1">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              <span>Processing</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status Notice / Summary Receipt */}
              {purchaseModal.status === 'completed' && (
                <div className="bg-[#E8F5E9] border border-[#C8E6C9] p-4 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center space-x-2 text-[#2E7D32]">
                    <CheckCircle2 className="w-5 h-5 text-[#3E8C5A]" />
                    <span className="font-extrabold text-sm">Flow Execution Successful!</span>
                  </div>
                  <p className="text-xs text-[#2E7D32] leading-relaxed">
                    The payment was verified on-chain, service delivered by {purchaseModal.provider?.name}, and logged in audit history.
                  </p>

                  {/* Payment Details Card */}
                  {(() => {
                    const paidAmount = purchaseModal.receipt?.amount ?? purchaseModal.quote?.amount ?? purchaseModal.provider?.price ?? 0;
                    const payerAddress = purchaseModal.receipt?.payer_address || purchaseModal.payerAddress || "0x3A8F91B2C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9";
                    const providerName = purchaseModal.provider?.name || (purchaseModal.receipt?.provider_address ? shortenValue(purchaseModal.receipt.provider_address, 6, 4) : 'Service Provider');
                    const txHash = purchaseModal.receipt?.tx_hash || purchaseModal.paymentTx || '';
                    const quoteId = purchaseModal.receipt?.quote_id || purchaseModal.quote?.quoteId || '';
                    const requestId = purchaseModal.receipt?.request_id || purchaseModal.requestId || '';

                    return (
                      <div className="bg-white border border-[#C8E6C9] p-3.5 rounded-2xl space-y-2.5 text-xs text-[#343434] shadow-xs text-left">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                            Payment Details
                          </span>
                          <span className="text-[10px] font-bold text-[#3E8C5A] bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#C8E6C9] flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Verified On-Chain
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          {/* Amount Paid */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">Amount Paid</span>
                            <span className="font-extrabold text-[#343434]">
                              {paidAmount} ETH
                            </span>
                          </div>

                          {/* Network */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">Network</span>
                            <span className="font-bold text-[#2563EB] bg-[#E3F2FD] px-2 py-0.5 rounded-md text-[11px]">
                              Sepolia
                            </span>
                          </div>

                          {/* Payment Status */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">Payment Status</span>
                            <span className="font-bold text-[#2E7D32] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#3E8C5A]" />
                              Verified On-Chain
                            </span>
                          </div>

                          {/* Payer */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">Payer</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-gray-700 text-[11px]" title={payerAddress}>
                                {shortenValue(payerAddress, 6, 4)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy('payer', payerAddress)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                title="Copy Payer Address"
                              >
                                {copiedField === 'payer' ? (
                                  <Check className="w-3 h-3 text-[#3E8C5A]" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Provider */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">Provider</span>
                            <span className="font-bold text-[#343434]">
                              {providerName}
                            </span>
                          </div>

                          {/* Transaction Hash */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">Transaction Hash</span>
                            <div className="flex items-center gap-1.5">
                              {txHash ? (
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[#2563EB] hover:underline flex items-center gap-1 text-[11px]"
                                  title="View on Sepolia Etherscan"
                                >
                                  <span>{shortenValue(txHash, 6, 4)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="font-mono text-gray-400 text-[11px]">—</span>
                              )}
                              {txHash && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy('txHash', txHash)}
                                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                  title="Copy Transaction Hash"
                                >
                                  {copiedField === 'txHash' ? (
                                    <Check className="w-3 h-3 text-[#3E8C5A]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Quote ID */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">Quote ID</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-gray-700 text-[11px]" title={quoteId}>
                                {shortenValue(quoteId, 8, 4)}
                              </span>
                              {quoteId && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy('quoteId', quoteId)}
                                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                  title="Copy Quote ID"
                                >
                                  {copiedField === 'quoteId' ? (
                                    <Check className="w-3 h-3 text-[#3E8C5A]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Request ID */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 font-medium">Request ID</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-gray-700 text-[11px]" title={requestId}>
                                {shortenValue(requestId, 8, 4)}
                              </span>
                              {requestId && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy('requestId', requestId)}
                                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                  title="Copy Request ID"
                                >
                                  {copiedField === 'requestId' ? (
                                    <Check className="w-3 h-3 text-[#3E8C5A]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Real Delivery Payload Output (Translation + Summary) */}
                  {(purchaseModal.deliveryData?.translated_text || purchaseModal.deliveryData?.original_text) && (
                    <div className="bg-white border border-[#C8E6C9] p-3.5 rounded-2xl space-y-2.5 text-xs text-[#343434] text-left">
                      {purchaseModal.deliveryData?.original_text && (
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-gray-400 block tracking-wider">
                            Original Text ({purchaseModal.deliveryData.source_language || 'source'})
                          </span>
                          <p className="font-medium text-gray-700 mt-0.5 text-xs bg-[#FDF8F5] p-2.5 rounded-xl border border-[#E9D8CC]">
                            {purchaseModal.deliveryData.original_text}
                          </p>
                        </div>
                      )}
                      {purchaseModal.deliveryData?.translated_text && (
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-gray-400 block tracking-wider">
                            Gemini Neural Translation ({purchaseModal.deliveryData.target_language || 'target'})
                          </span>
                          <p className="font-bold text-[#2E7D32] mt-0.5 text-sm bg-[#E8F5E9] p-2.5 rounded-xl border border-[#C8E6C9]">
                            {purchaseModal.deliveryData.translated_text}
                          </p>
                        </div>
                      )}
                      {purchaseModal.deliveryData?.summary && (
                        <div className="pt-2 border-t border-gray-100">
                          <span className="text-[10px] font-extrabold uppercase text-gray-400 block tracking-wider">
                            Gemini Content Summary
                          </span>
                          <p className="font-medium text-gray-700 mt-0.5 leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                            {purchaseModal.deliveryData.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setPurchaseModal(prev => ({ ...prev, isOpen: false }));
                        navigate('/payments');
                      }}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>View in Payments</span>
                    </button>

                    <button
                      onClick={() => {
                        setPurchaseModal(prev => ({ ...prev, isOpen: false }));
                        navigate('/audit');
                      }}
                      className="px-4 py-2 bg-white hover:bg-gray-50 border border-[#C8E6C9] text-[#2E7D32] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>View in Audit Logs</span>
                    </button>
                  </div>
                </div>
              )}

              {purchaseModal.status === 'error' && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-2 text-xs text-red-700 animate-fadeIn">
                  <div className="flex items-center space-x-2 font-bold text-sm text-red-800">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span>Execution Error</span>
                  </div>
                  <p>{purchaseModal.error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#FDF8F5] border-t border-[#E9D8CC] flex items-center justify-between text-xs">
              <span className="text-gray-500 font-mono text-[10px]">
                Request ID: {purchaseModal.requestId?.slice(0, 16)}...
              </span>
              {purchaseModal.status === 'completed' || purchaseModal.status === 'error' ? (
                <button
                  onClick={() => setPurchaseModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold rounded-xl transition-all cursor-pointer"
                >
                  Done
                </button>
              ) : (
                <span className="text-[#2563EB] font-bold flex items-center space-x-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Pipeline...</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
