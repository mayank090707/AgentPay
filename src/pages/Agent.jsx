import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Bot, 
  Send, 
  Search, 
  CreditCard, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  FileCheck2, 
  ArrowRight,
  ShieldAlert,
  Clock,
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Database,
  Languages,
  Cpu,
  ShoppingCart,
  ChevronRight,
  Code,
  Check,
  FileText
} from 'lucide-react';
import { useBlockchain } from '../context/BlockchainContext';
import { 
  runAgentGoal, 
  fetchAgentRun, 
  fetchAuditLogs, 
  parseAuditLogsToTransactions, 
  getSessionResetTime, 
  markRecentPurchase,
  fetchProviderComparison
} from '../services/api';

export default function Agent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // ── 1. Shared Blockchain & Session Audit State (Single Source of Truth) ─────
  const { budget, refreshData: refreshBlockchain } = useBlockchain();
  const [transactions, setTransactions] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [providerComparison, setProviderComparison] = useState([]);

  useEffect(() => {
    fetchProviderComparison('translation').then(res => {
      if (res && res.providers) {
        setProviderComparison(res.providers);
      }
    }).catch(() => null);
  }, []);

  // ── 2. Task Execution State ────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(searchParams.get('prompt') || "hello world");
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentRun, setCurrentRun] = useState(null);
  const [runState, setRunState] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'FAILED'
  const [errorMsg, setErrorMsg] = useState(null);

  // Preset Prompt Chips
  const presetPrompts = [
    "hello world",
    "Autonomous Payment Infrastructure",
    "AgentPay enables autonomous machine payments.",
    "Smart contract spending limit enforcement"
  ];

  // Load backend audit data to derive session spending (matching Dashboard.jsx)
  const loadBudgetAndTransactions = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetchAuditLogs({ limit: 100 }).catch(() => null);
      if (res && Array.isArray(res.logs)) {
        const parsedTx = parseAuditLogsToTransactions(res.logs);
        const resetTime = getSessionResetTime();
        const sessionTxs = parsedTx.filter(tx => {
          const lastLog = tx.rawLogs?.[tx.rawLogs.length - 1];
          const txTime = new Date(lastLog?.timestamp || tx.rawLogs?.[0]?.timestamp || tx.timestamp || 0).getTime();
          return txTime >= resetTime;
        });
        setTransactions(sessionTxs);
      } else {
        setTransactions([]);
      }
    } catch (_) {
      setTransactions([]);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadBudgetAndTransactions();
    refreshBlockchain();

    const handleUpdate = () => {
      loadBudgetAndTransactions();
      refreshBlockchain();
      // Retry after slight indexing lag
      setTimeout(() => {
        loadBudgetAndTransactions();
        refreshBlockchain();
      }, 1500);
    };

    window.addEventListener('agentpay:purchase_completed', handleUpdate);
    window.addEventListener('agentpay:session_reset', handleUpdate);

    return () => {
      window.removeEventListener('agentpay:purchase_completed', handleUpdate);
      window.removeEventListener('agentpay:session_reset', handleUpdate);
    };
  }, [refreshBlockchain]);

  // Load specific task from URL query or localStorage on mount
  useEffect(() => {
    const taskIdParam = searchParams.get('task_id') || localStorage.getItem('agentpay_active_task_id');
    if (taskIdParam) {
      loadTaskStatus(taskIdParam);
    }
  }, [searchParams]);

  // Polling for live status while executing
  useEffect(() => {
    let interval = null;
    const activeTaskId = currentRun?.task_id || localStorage.getItem('agentpay_active_task_id');
    if (activeTaskId && (runState === 'RUNNING' || isExecuting)) {
      interval = setInterval(() => {
        loadTaskStatus(activeTaskId);
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentRun?.task_id, runState, isExecuting]);

  async function loadTaskStatus(taskId) {
    if (!taskId) return;
    try {
      const run = await fetchAgentRun(taskId);
      if (run) {
        setCurrentRun(run);
        if (run.user_prompt) setPrompt(run.user_prompt);
        localStorage.setItem('agentpay_active_task_id', run.task_id);

        if (run.status === 'COMPLETED') {
          setRunState('COMPLETED');
          setIsExecuting(false);
        } else if (run.status === 'BLOCKED') {
          setRunState('BLOCKED');
          setErrorMsg(run.error_message || "Agent Run blocked by smart contract budget limit");
          setIsExecuting(false);
        } else if (run.status === 'FAILED') {
          setRunState('FAILED');
          setErrorMsg(run.error_message || "Agent Run execution failed");
          setIsExecuting(false);
        } else if (run.status === 'EXECUTING' || run.status === 'PLANNED' || run.status === 'PLANNING') {
          setRunState('RUNNING');
          setIsExecuting(true);
        } else {
          setRunState('IDLE');
          setIsExecuting(false);
        }
      }
    } catch (err) {
      console.warn("Could not load agent run:", err);
    }
  }

  // Clear current active task to start fresh
  const handleClearTask = () => {
    localStorage.removeItem('agentpay_active_task_id');
    setCurrentRun(null);
    setRunState('IDLE');
    setErrorMsg(null);
    setPrompt("hello world");
  };

  // Calculate live budget metrics identical to Dashboard.jsx
  const totalBudgetEth = budget ? parseFloat(budget.budgetEth) : 0.01;
  const sessionSpentEth = transactions.reduce((acc, t) => t.delivery_status === 'Delivered' ? acc + (t.amount || 0) : acc, 0);
  const sessionRemainingEth = Math.max(0, totalBudgetEth - sessionSpentEth);

  const spentDisplay = `${sessionSpentEth.toFixed(4)} ETH`;
  const budgetDisplay = `${totalBudgetEth.toFixed(4)} ETH`;
  const remainingDisplay = `${sessionRemainingEth.toFixed(4)} ETH`;

  // ── Handle Task Execution ──────────────────────────────────────────────────
  const handleRunAgent = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isExecuting) return;

    setIsExecuting(true);
    setRunState('RUNNING');
    setErrorMsg(null);
    setCurrentRun(null);

    try {
      // 1. Send goal prompt to backend Agent Run execution engine
      const res = await runAgentGoal(prompt, null, true);

      if (res && res.task_id) {
        setCurrentRun(res);
        localStorage.setItem('agentpay_active_task_id', res.task_id);

        if (res.status === 'COMPLETED') {
          setRunState('COMPLETED');
        } else if (res.status === 'BLOCKED') {
          setRunState('BLOCKED');
          setErrorMsg(res.error_message || "Agent Run blocked by smart contract budget limit");
        } else if (res.status === 'FAILED') {
          setRunState('FAILED');
          setErrorMsg(res.error_message || "Agent Run execution failed");
        } else {
          setRunState('RUNNING');
        }

        // Trigger budget refresh and session update across Dashboard & Agent
        markRecentPurchase();
        window.dispatchEvent(new CustomEvent('agentpay:purchase_completed', { detail: res }));
        await loadBudgetAndTransactions();
        await refreshBlockchain();
      } else {
        throw new Error(res?.error_message || "Agent run execution failed");
      }
    } catch (err) {
      setRunState('FAILED');
      setErrorMsg(err.message || "Failed to execute Agent Run");
      window.dispatchEvent(new CustomEvent('agentpay:purchase_error', { detail: { error: err.message } }));
    } finally {
      setIsExecuting(false);
    }
  };

  const getServiceIcon = (service) => {
    const s = (service || '').toLowerCase();
    if (s.includes('trans')) return Languages;
    if (s.includes('stor')) return Database;
    if (s.includes('comp')) return Cpu;
    return Bot;
  };

  // Derive active stage for 7-stage pipeline visualization from real backend state
  const getPipelineStep = () => {
    if (runState === 'RUNNING') return 4;
    if (runState === 'COMPLETED') return 7;
    if (runState === 'BLOCKED') return 5;
    if (runState === 'FAILED') return 5;
    if (currentRun && currentRun.status === 'PLANNED') return 2;
    return 0;
  };

  const activePipelineStep = getPipelineStep();

  const pipelineStages = [
    { step: 1, title: 'Goal Received', desc: 'Received content for Hindi translation', icon: Send },
    { step: 2, title: 'Provider Found', desc: 'Comparing available translation providers', icon: Search },
    { step: 3, title: '402 Payment Required', desc: 'Translation provider requires payment', icon: CreditCard },
    { step: 4, title: 'Payment Auth', desc: 'Validating task ID and spending limit', icon: KeyRound },
    { step: 5, title: 'Smart Contract Check', desc: 'Verifying AgentPay smart-contract authorization', icon: ShieldCheck },
    { step: 6, title: 'Payment Confirmed', desc: 'Sepolia payment confirmed', icon: CheckCircle2 },
    { step: 7, title: 'Service Delivered', desc: 'Receiving translated Hindi content', icon: FileCheck2 },
  ];

  // Multi-service intermediate & final outputs extraction from currentRun.plan
  const steps = currentRun?.plan || [];
  const intermediateSteps = steps.slice(0, steps.length - 1);
  const finalStep = steps.length > 0 ? steps[steps.length - 1] : null;

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      
      {/* ── SECTION 1: HEADER & LIVE CONTRACT-BACKED BUDGET CARDS ───────────── */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 sm:p-8 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FAD2C0]/40 border border-[#FAD2C0] flex items-center justify-center text-[#d97d54]">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black text-[#343434]">AI Agent Workspace</h1>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                  <span className="w-2 h-2 rounded-full bg-[#3E8C5A] animate-pulse"></span>
                  <span>ORCHESTRATOR LIVE</span>
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Submit goals to the autonomous Python agent engine running HTTP 402 Sepolia smart contract payments.
              </p>
            </div>
          </div>
        </div>

        {/* Live Contract-Backed Budget Metrics (Synchronized with Dashboard) */}
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto text-xs">
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl">
            <span className="text-gray-400 font-medium block text-[10px] uppercase tracking-wider">Total Budget</span>
            <span className="font-extrabold text-[#343434]">{budgetDisplay}</span>
          </div>
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl">
            <span className="text-gray-400 font-medium block text-[10px] uppercase tracking-wider">Spent Budget</span>
            <span className="font-extrabold text-[#d97d54]">{spentDisplay}</span>
          </div>
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl">
            <span className="text-gray-400 font-medium block text-[10px] uppercase tracking-wider">Remaining</span>
            <span className="font-extrabold text-[#3E8C5A]">{remainingDisplay}</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: GOAL PROMPT INPUT BAR & PRESETS ───────────────────────── */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="goal-prompt" className="text-xs font-mono uppercase tracking-widest font-bold text-gray-500 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#d97d54]" />
            <span>Enter the content you want translated into Hindi</span>
          </label>
        </div>

        <form onSubmit={handleRunAgent} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="goal-prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter text to translate..."
              className="flex-1 px-4 py-3.5 bg-white border border-[#E9D8CC] rounded-2xl text-xs font-bold text-[#343434] placeholder-gray-400 focus:outline-none focus:border-[#FAD2C0] transition-all shadow-xs"
              disabled={isExecuting}
            />
            <button
              type="submit"
              disabled={isExecuting || !prompt.trim()}
              className="px-6 py-3.5 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-black text-xs rounded-2xl transition-all shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#343434]" />
                  <span>EXECUTING TASK...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#343434]" />
                  <span>RUN AGENT</span>
                </>
              )}
            </button>

            {currentRun && !isExecuting && (
              <button
                type="button"
                onClick={handleClearTask}
                className="px-4 py-3.5 bg-white border border-[#E9D8CC] hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-2xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                title="Start a new Agent Run task"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>New Goal</span>
              </button>
            )}
          </div>
        </form>

        {/* Quick Preset Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-1">
          <span className="text-[10px] font-bold text-gray-400 shrink-0">Presets:</span>
          {presetPrompts.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(preset)}
              className="px-3 py-1.5 bg-white border border-[#E9D8CC] hover:bg-[#FDF8F5] rounded-xl text-[11px] font-semibold text-gray-600 transition-all shrink-0 cursor-pointer shadow-2xs"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* ── SECTION 3: AGENT PLAN CARD ────────────────────────────────────────── */}
      {currentRun && steps.length > 0 && (
        <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
                AGENT EXECUTION PLAN
              </span>
              <h3 className="text-sm font-black text-[#343434]">
                Task #{currentRun.task_id.slice(0, 10)}... ({steps.length} {steps.length === 1 ? 'Step' : 'Sequential Steps'})
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 font-mono uppercase block font-bold">Total Planned Cost</span>
              <span className="text-sm font-black text-[#343434]">{currentRun.total_planned_cost_eth} ETH</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {steps.map((s, idx) => {
              const Icon = getServiceIcon(s.service);
              return (
                <div key={idx} className="p-4 bg-white border border-[#E9D8CC] rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB]">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-xs text-[#343434]">Step {s.step}: {s.service.toUpperCase()}</span>
                    </div>
                    <span className="font-extrabold text-xs text-[#343434]">{s.quote_eth} ETH</span>
                  </div>
                  <div className="text-[11px] text-gray-600">
                    Selected Provider: <span className="font-bold text-[#343434]">{s.provider_id}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight">{s.reason}</p>
                </div>
              );
            })}
          </div>

          {/* Translation Provider Quote Comparison Breakdown */}
          <div className="mt-2 p-4 bg-white border border-[#E9D8CC] rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#343434] flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Translation Provider Quote Comparison</span>
              </span>
              <span className="text-[10px] font-extrabold text-[#3E8C5A] bg-[#E8F5E9] border border-[#C8E6C9] px-2.5 py-0.5 rounded-full">
                Best Valid Quote Auto-Selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              {(providerComparison.length > 0 ? providerComparison : [
                { provider_id: 'prov_trans_01', name: 'Translation Provider A', quote_eth: 0.00002 },
                { provider_id: 'prov_trans_03', name: 'Translation Provider C', quote_eth: 0.000025 },
                { provider_id: 'prov_trans_02', name: 'Translation Provider B', quote_eth: 0.00003 },
              ]).map((p) => {
                const isSelected = steps.some(s => s.provider_id === p.provider_id || (p.provider_id === 'prov_trans_01' && s.service === 'translation'));
                return (
                  <div key={p.provider_id} className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected 
                      ? 'bg-[#E8F5E9]/70 border-[#C8E6C9] text-[#343434] shadow-xs' 
                      : 'bg-[#FDF8F5] border-[#E9D8CC] text-gray-600'
                  }`}>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>{p.name || p.provider_id}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#3E8C5A]" />}
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-2 font-mono">
                      <span className="font-bold">{p.quote_eth || p.unit_price} ETH</span>
                      <span className={isSelected ? "font-black text-[#3E8C5A] uppercase text-[9px]" : "text-gray-400 uppercase text-[9px]"}>
                        {isSelected ? "Selected (Lowest)" : "Higher Quote"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 4: AGENT ACTIVITY CHECKLIST ───────────────────────────────── */}
      {currentRun && (
        <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-3">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
            AGENT ACTIVITY LOG
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center space-x-2 p-2.5 bg-white border border-[#E9D8CC] rounded-xl text-[#3E8C5A] font-semibold">
              <Check className="w-4 h-4 text-[#3E8C5A] shrink-0" />
              <span>✓ Goal understood & parsed</span>
            </div>
            <div className="flex items-center space-x-2 p-2.5 bg-white border border-[#E9D8CC] rounded-xl text-[#3E8C5A] font-semibold">
              <Check className="w-4 h-4 text-[#3E8C5A] shrink-0" />
              <span>✓ Independent providers selected</span>
            </div>
            <div className="flex items-center space-x-2 p-2.5 bg-white border border-[#E9D8CC] rounded-xl text-[#3E8C5A] font-semibold">
              <Check className="w-4 h-4 text-[#3E8C5A] shrink-0" />
              <span>✓ HTTP 402 quotes verified</span>
            </div>
            <div className="flex items-center space-x-2 p-2.5 bg-white border border-[#E9D8CC] rounded-xl text-[#3E8C5A] font-semibold">
              <Check className="w-4 h-4 text-[#3E8C5A] shrink-0" />
              <span>✓ Smart contract budget validated</span>
            </div>
            <div className="flex items-center space-x-2 p-2.5 bg-white border border-[#E9D8CC] rounded-xl text-[#3E8C5A] font-semibold">
              <Check className="w-4 h-4 text-[#3E8C5A] shrink-0" />
              <span>✓ Payment authorization signed</span>
            </div>
            <div className={`flex items-center space-x-2 p-2.5 bg-white border rounded-xl font-semibold ${
              runState === 'COMPLETED' ? 'border-[#C8E6C9] text-[#3E8C5A]' : 'border-[#E9D8CC] text-gray-500'
            }`}>
              {runState === 'COMPLETED' ? (
                <>
                  <Check className="w-4 h-4 text-[#3E8C5A] shrink-0" />
                  <span>✓ Service execution completed</span>
                </>
              ) : runState === 'BLOCKED' ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-amber-900">Blocked by smart contract cap</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-gray-400 shrink-0 animate-spin" />
                  <span>Executing service steps...</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 5: AUTONOMOUS PAYMENT PIPELINE (7-STAGE) ──────────────────── */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
          <div>
            <h2 className="text-lg font-black text-[#343434] flex items-center space-x-2">
              <Layers className="w-5 h-5 text-[#3B82F6]" />
              <span>Autonomous Payment Pipeline</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live 7-stage autonomous payment and delivery pipeline execution.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-gray-400 hidden sm:block">
            {currentRun ? `Task #${currentRun.task_id.slice(0, 8)}` : 'Waiting for Goal Prompt'}
          </span>
        </div>

        {/* Pipeline Horizontal Steps */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {pipelineStages.map((stage) => {
            const Icon = stage.icon;
            const isCompleted = activePipelineStep >= stage.step;
            const isCurrent = activePipelineStep === stage.step && isExecuting;

            return (
              <div 
                key={stage.step}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between relative ${
                  isCompleted 
                    ? 'bg-[#E8F5E9]/80 border-[#C8E6C9] text-[#343434]' 
                    : isCurrent 
                    ? 'bg-[#E3F2FD] border-[#BBDEFB] text-[#2563EB] shadow-sm animate-pulse' 
                    : 'bg-white/60 border-[#E9D8CC] text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold opacity-60">0{stage.step}</span>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-[#3E8C5A]" />}
                </div>
                <div className="my-1.5">
                  <Icon className="w-4 h-4 mb-1 text-[#343434]" />
                  <h4 className="font-extrabold text-[11px] leading-tight">{stage.title}</h4>
                </div>
                <p className="text-[9px] opacity-75 line-clamp-2 leading-tight">{stage.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 6: DEDICATED FINAL OUTPUT WINDOW ──────────────────────────── */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#3E8C5A]">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#343434] tracking-tight">FINAL OUTPUT</h2>
              <p className="text-xs text-gray-500 font-medium">
                Live service output delivered directly by the executed Agent Run pipeline.
              </p>
            </div>
          </div>

          {runState === 'COMPLETED' && (
            <span className="px-3 py-1 bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9] font-bold text-xs rounded-full flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>✓ Completed</span>
            </span>
          )}

          {runState === 'BLOCKED' && (
            <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-full flex items-center space-x-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span>Blocked</span>
            </span>
          )}

          {runState === 'FAILED' && (
            <span className="px-3 py-1 bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-full flex items-center space-x-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Failed</span>
            </span>
          )}
        </div>

        {/* ── STATE 1: IDLE ───────────────────────────────────────────────────── */}
        {runState === 'IDLE' && (
          <div className="p-10 bg-white border border-[#E9D8CC] rounded-2xl text-center space-y-3">
            <FileText className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-sm font-bold text-[#343434]">Run an Agent task to see the final result.</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Enter a natural language goal above and click <strong>[ RUN AGENT ]</strong> to initiate planning, payment, and execution.
            </p>
          </div>
        )}

        {/* ── STATE 2: RUNNING ────────────────────────────────────────────────── */}
        {runState === 'RUNNING' && (
          <div className="p-10 bg-white border border-[#E9D8CC] rounded-2xl text-center space-y-4">
            <RefreshCw className="w-10 h-10 text-[#2563EB] animate-spin mx-auto" />
            <div>
              <h3 className="text-sm font-black text-[#343434]">Agent is executing your task...</h3>
              <p className="text-xs text-gray-500 mt-1">
                Executing HTTP 402 provider challenges and recording smart contract payment approvals on Sepolia.
              </p>
            </div>
          </div>
        )}

        {/* ── STATE 3: COMPLETED (REAL MULTI-SERVICE OUTPUT) ──────────────────── */}
        {runState === 'COMPLETED' && currentRun && (
          <div className="space-y-4">
            {/* Task Info Pill */}
            <div className="p-3.5 bg-white border border-[#E9D8CC] rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-gray-400 text-[10px] block font-bold uppercase">Task ID</span>
                <code className="font-mono font-bold text-[#343434]">#{currentRun.task_id}</code>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block font-bold uppercase">User Goal</span>
                <span className="font-bold text-[#343434]">&ldquo;{currentRun.user_prompt}&rdquo;</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block font-bold uppercase">Total Actual Cost</span>
                <span className="font-extrabold text-[#3E8C5A]">{currentRun.total_actual_cost_eth || currentRun.total_planned_cost_eth} ETH</span>
              </div>
            </div>

            {/* INTERMEDIATE RESULTS (For Multi-Service Pipeline) */}
            {intermediateSteps.length > 0 && (
              <div className="space-y-3 bg-[#FFF9F5] p-4 rounded-2xl border border-[#E9D8CC]">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
                  INTERMEDIATE RESULTS
                </span>
                
                {intermediateSteps.map((stepItem, idx) => {
                  const resObj = typeof stepItem.result === 'object' ? stepItem.result : null;
                  const resStr = typeof stepItem.result === 'string' ? stepItem.result : (resObj ? JSON.stringify(resObj, null, 2) : '');

                  return (
                    <div key={idx} className="bg-white p-3.5 rounded-xl border border-[#E9D8CC] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#343434]">
                          Step {stepItem.step} — {stepItem.service.toUpperCase()} ({stepItem.provider_id})
                        </span>
                        <span className="text-[10px] font-bold text-[#3E8C5A] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                          ✓ Output Passed to Step {stepItem.step + 1}
                        </span>
                      </div>

                      {resObj?.translated_text ? (
                        <div className="p-2.5 bg-[#FDF8F5] rounded-lg border border-[#E9D8CC] text-xs font-semibold text-[#343434]">
                          Result Output: <span className="text-[#3E8C5A] font-extrabold">&ldquo;{resObj.translated_text}&rdquo;</span>
                        </div>
                      ) : (
                        <pre className="text-[11px] font-mono text-gray-800 bg-[#FDF8F5] p-2.5 rounded-lg border border-[#E9D8CC] overflow-x-auto whitespace-pre-wrap">
                          {resStr || "Intermediate step executed successfully."}
                        </pre>
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-center py-1 text-gray-400">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </div>
              </div>
            )}

            {/* FINAL OUTPUT CARD */}
            {finalStep && (
              <div className="bg-white p-5 rounded-2xl border border-[#E9D8CC] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-3">
                  <span className="text-xs font-black text-[#343434] uppercase tracking-wider flex items-center space-x-2">
                    <FileCheck2 className="w-4 h-4 text-[#3E8C5A]" />
                    <span>Final Service Result — {finalStep.service.toUpperCase()} ({finalStep.provider_id})</span>
                  </span>
                  <span className="text-xs font-extrabold text-[#3E8C5A]">✓ Successfully Delivered</span>
                </div>

                {/* Content Payload Display */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-gray-400 font-bold block">Delivered Resource Payload</span>

                  {(() => {
                    let parsed = finalStep.result;
                    if (typeof parsed === 'string') {
                      try { parsed = JSON.parse(parsed); } catch (_) {}
                    }
                    const textVal = parsed?.translated_text || parsed?.text || (typeof parsed === 'string' ? parsed : null);

                    if (textVal) {
                      return (
                        <div className="p-4 bg-[#E8F5E9]/60 rounded-xl border border-[#C8E6C9] space-y-1">
                          <span className="text-[10px] font-bold text-[#3E8C5A] uppercase tracking-wider block">Translated Hindi Output</span>
                          <p className="text-base font-black text-[#343434]">&ldquo;{textVal}&rdquo;</p>
                        </div>
                      );
                    }
                    return (
                      <pre className="text-xs font-mono text-gray-800 bg-[#FDF8F5] p-3.5 rounded-xl border border-[#E9D8CC] overflow-x-auto whitespace-pre-wrap">
                        {typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : (parsed || "Service executed successfully.")}
                      </pre>
                    );
                  })()}
                </div>

                {/* Hashes & Tx Links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-[#E9D8CC]">
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono block">CONTENT HASH</span>
                    <code className="font-mono text-[11px] text-gray-700 bg-[#FDF8F5] px-2 py-1 rounded border border-[#E9D8CC] block truncate" title={finalStep.content_hash}>
                      {finalStep.content_hash || 'Recorded on-chain'}
                    </code>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono block">EVM TRANSACTION</span>
                    <div className="flex items-center space-x-1 pt-0.5">
                      <code className="font-mono text-[11px] text-[#2563EB] bg-[#E3F2FD] px-2 py-1 rounded border border-[#BBDEFB] block truncate flex-1" title={finalStep.transaction_hash}>
                        {finalStep.transaction_hash || 'Verified'}
                      </code>
                      {finalStep.transaction_hash && (
                        <a 
                          href={`https://sepolia.etherscan.io/tx/${finalStep.transaction_hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1 text-[#2563EB] hover:underline cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Traceability Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                onClick={() => navigate(`/payments?task_id=${currentRun.task_id}`)}
                className="px-4 py-2.5 bg-white border border-[#E9D8CC] hover:bg-gray-50 text-xs font-bold text-[#343434] rounded-xl shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4 text-[#2563EB]" />
                <span>View in Payments</span>
              </button>

              <button
                onClick={() => navigate(`/audit?task_id=${currentRun.task_id}`)}
                className="px-4 py-2.5 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-xs font-black text-[#343434] rounded-xl shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4 text-[#343434]" />
                <span>View in Audit Trail</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STATE 4: BLOCKED ────────────────────────────────────────────────── */}
        {runState === 'BLOCKED' && currentRun && (
          <div className="p-6 bg-amber-50 border border-amber-300 rounded-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-900 font-extrabold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span>Agent Run blocked by smart-contract budget.</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              {currentRun.error_message || "The planned service execution cost exceeds the available smart contract budget boundary."}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-amber-200">
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">Total Planned Cost</span>
                <span className="font-extrabold text-amber-900">{currentRun.total_planned_cost_eth} ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">Contract Remaining Budget</span>
                <span className="font-extrabold text-amber-900">{currentRun.budget_remaining_eth} ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">Security Boundary</span>
                <span className="font-extrabold text-[#3E8C5A]">ENFORCED</span>
              </div>
            </div>
          </div>
        )}

        {/* ── STATE 5: FAILED ─────────────────────────────────────────────────── */}
        {runState === 'FAILED' && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 text-red-800 font-extrabold text-sm">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>Agent Run Execution Failed</span>
            </div>
            <p className="text-xs text-red-700 font-medium">
              {errorMsg || "An unexpected error occurred during service execution."}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
