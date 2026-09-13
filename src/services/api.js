/**
 * AgentPay — Backend API Service Client
 * Connects Frontend to FastAPI Backend (localhost:8000)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Helper for making API requests with timeout and error handling.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMsg = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        }
      } catch (_) {
        // ignore json parse error
      }
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[API] Fetch failed for ${url}:`, error.message);
    throw error;
  }
}

/**
 * Checks health status of the FastAPI backend.
 * @returns {Promise<{ status: string }>}
 */
export async function checkBackendHealth() {
  return await apiFetch('/health');
}

/**
 * Submits a natural-language goal to the AI Agent Run engine for planning and execution (/agent/run).
 * @param {string} prompt - Natural-language task prompt
 * @param {number} [maxBudgetEth] - Optional maximum spending limit override
 * @param {boolean} [autoExecute=true] - Whether to automatically execute planned steps
 * @returns {Promise<object>}
 */
export async function runAgentGoal(prompt, maxBudgetEth = null, autoExecute = true, agentMode = 'translation') {
  return await apiFetch('/agent/run', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      max_budget_eth: maxBudgetEth,
      auto_execute: autoExecute,
      agent_mode: agentMode,
    }),
  });
}

/**
 * Triggers multi-step execution of a planned Agent Run by task ID (/agent/run/execute/{task_id}).
 * @param {string} taskId
 * @returns {Promise<object>}
 */
export async function executeAgentRun(taskId) {
  return await apiFetch(`/agent/run/execute/${encodeURIComponent(taskId)}`, {
    method: 'POST',
  });
}

/**
 * Fetches the current state and execution plan of an Agent Run by task ID (/agent/run/{task_id}).
 * @param {string} taskId
 * @returns {Promise<object>}
 */
export async function fetchAgentRun(taskId) {
  return await apiFetch(`/agent/run/${encodeURIComponent(taskId)}`);
}

/**
 * Queries audit trail log records from FastAPI (/audit/logs).
 * @param {object} [params]
 * @param {string} [params.requestId]
 * @param {string} [params.eventType]
 * @param {number} [params.limit=100]
 * @returns {Promise<{ total: number, logs: Array }>}
 */
export async function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.requestId) query.append('request_id', params.requestId);
  if (params.eventType) query.append('event_type', params.eventType);
  if (params.limit) query.append('limit', params.limit.toString());

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return await apiFetch(`/audit/logs${queryString}`);
}

/**
 * Cryptographic verification endpoint for a service request lifecycle (/audit/verify/{request_id}).
 * @param {string} requestId
 * @returns {Promise<object>}
 */
export async function fetchAuditVerification(requestId) {
  return await apiFetch(`/audit/verify/${encodeURIComponent(requestId)}`);
}

/**
 * Returns all registered service providers with their complete pricing catalogs (/providers).
 * @returns {Promise<{ total: number, providers: Array }>}
 */
export async function fetchProviders() {
  return await apiFetch('/providers');
}

/**
 * Compares all registered providers for the given service type (/providers/compare/{service_type}).
 * @param {string} serviceType - 'translation' | 'compute' | 'storage'
 * @param {object} [params] - sizing parameters
 * @returns {Promise<{ service_type: string, providers: Array }>}
 */
export async function fetchProviderComparison(serviceType, params = {}) {
  const query = new URLSearchParams();
  if (params.text) query.append('text', params.text);
  if (params.operation) query.append('operation', params.operation);
  if (params.matrix_size) query.append('matrix_size', params.matrix_size.toString());
  if (params.dimension) query.append('dimension', params.dimension.toString());
  if (params.value) query.append('value', params.value);

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return await apiFetch(`/providers/compare/${encodeURIComponent(serviceType)}${queryString}`);
}

/**
 * Retrieves signed delivery receipt for a completed service request (/receipts/{request_id}).
 * @param {string} requestId
 * @returns {Promise<object>}
 */
export async function fetchReceipt(requestId) {
  return await apiFetch(`/receipts/${encodeURIComponent(requestId)}`);
}

/**
 * Initiates real service purchase flow via backend & Sepolia smart contract (/services/purchase).
 * @param {object} purchaseData
 * @param {string} purchaseData.service_type - 'translation' | 'compute' | 'storage'
 * @param {string} [purchaseData.provider_id]
 * @param {object} [purchaseData.payload]
 * @param {string} [purchaseData.request_id]
 * @returns {Promise<object>}
 */
export async function purchaseService(purchaseData) {
  return await apiFetch('/services/purchase', {
    method: 'POST',
    body: JSON.stringify(purchaseData),
  });
}

/**
 * Parses raw audit log entries from FastAPI into UI transaction objects.
 * Groups logs by request_id/task_id and builds a complete lifecycle record.
 * 
 * @param {Array} logs - Raw audit log items from /audit/logs
 * @returns {Array} List of UI transaction objects
 */
export function parseAuditLogsToTransactions(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  // Group logs by request_id / task_id
  const grouped = {};
  logs.forEach((log) => {
    const reqId = log.request_id || log.details?.task_id || 'UNKNOWN';
    if (!grouped[reqId]) {
      grouped[reqId] = [];
    }
    grouped[reqId].push(log);
  });

  const transactions = [];

  const providerNameMap = {
    'alpha': 'Alpha Cloud',
    'alpha-cloud': 'Alpha Cloud',
    'beta': 'Beta Cloud',
    'beta-cloud': 'Beta Cloud',
    'gamma': 'Gamma Storage',
    'gamma-storage': 'Gamma Storage',
    'delta': 'Delta AI',
    'delta-ai': 'Delta AI',
  };

  Object.entries(grouped).forEach(([reqId, reqLogs]) => {
    // Sort logs chronologically
    reqLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let taskId = null;
    let stepNumber = null;
    let rawService = 'translation';
    let rawProvider = 'alpha';
    let amount = 0;
    let amountEth = '0.00 ETH';
    let paymentTx = 'N/A';
    let deliveryStatus = 'Processing';
    let contentHash = 'N/A';
    let serviceResult = null;
    let inputDependency = null;
    let firstTimestamp = reqLogs[0]?.timestamp;
    let timestamp = firstTimestamp ? new Date(firstTimestamp).toLocaleTimeString() : 'N/A';
    let date = firstTimestamp ? new Date(firstTimestamp).toISOString().split('T')[0] : 'N/A';
    let error = null;

    reqLogs.forEach((log) => {
      const evt = log.event_type;
      const details = log.details || {};

      if (details.task_id) taskId = details.task_id;
      if (details.step_number) stepNumber = details.step_number;
      if (details.input_dependency) inputDependency = details.input_dependency;

      if (details.service_type || details.service) {
        rawService = details.service_type || details.service;
      }

      if (details.provider_id || details.provider) {
        rawProvider = details.provider_id || details.provider;
      }

      if (details.amount) {
        amount = details.amount;
        amountEth = typeof details.amount === 'string' && details.amount.includes('ETH') 
          ? details.amount 
          : `${details.amount} ETH`;
      }

      if (evt === 'PAYMENT_VERIFIED' || evt === 'PAYMENT_CONFIRMED' || evt === 'SMART_CONTRACT_AUTHORIZATION' || evt === 'PAYMENT_AUTHORIZED') {
        if (details.tx_hash || details.payment_tx || details.transaction_hash) {
          paymentTx = details.tx_hash || details.payment_tx || details.transaction_hash;
        }
      }

      if (evt === 'SERVICE_DELIVERED' || evt === 'DELIVERY_RECORDED' || evt === 'AGENT_STEP_FULFILLED' || evt === 'TASK_COMPLETED') {
        deliveryStatus = 'Delivered';
        if (details.content_hash || details.hash) {
          contentHash = details.content_hash || details.hash;
        }
        if (details.tx_hash || details.transaction_hash) {
          paymentTx = details.tx_hash || details.transaction_hash;
        }
        if (details.output || details.result) {
          serviceResult = details.output || details.result;
        }
      }

      if (evt === 'BUDGET_EXCEEDED' || evt === 'AGENT_RUN_BLOCKED' || evt === 'PAYMENT_FAILED' || evt === 'PAYMENT_REJECTED' || evt === 'PAYMENT_VERIFICATION_FAILED') {
        deliveryStatus = 'Blocked';
        error = details.reason || details.error || details.error_message || details.message || 'Payment blocked by contract budget enforcement';
        paymentTx = details.tx_hash || details.transaction_hash || '0x000...REJECTED';
        contentHash = 'N/A - Budget Exceeded';
      }
    });

    const formattedProvider = providerNameMap[rawProvider.toLowerCase()] || 
      (rawProvider.charAt(0).toUpperCase() + rawProvider.slice(1));
    const formattedService = rawService.charAt(0).toUpperCase() + rawService.slice(1);

    transactions.push({
      request_id: reqId,
      task_id: taskId || reqId,
      step_number: stepNumber,
      service: formattedService,
      provider: formattedProvider,
      amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
      amountEth: amountEth || `${amount} ETH`,
      payment_tx: paymentTx,
      delivery_status: deliveryStatus,
      content_hash: contentHash,
      service_result: serviceResult,
      input_dependency: inputDependency,
      timestamp,
      date,
      error,
      rawLogs: reqLogs,
    });
  });

  // Sort transactions newest first
  transactions.sort((a, b) => {
    const timeA = new Date(a.rawLogs[a.rawLogs.length - 1]?.timestamp || 0).getTime();
    const timeB = new Date(b.rawLogs[b.rawLogs.length - 1]?.timestamp || 0).getTime();
    return timeB - timeA;
  });

  return transactions;
}

const SESSION_RESET_KEY = 'agentpay_session_reset_at';
const RECENT_PURCHASE_KEY = 'agentpay_recent_purchase_at';

export function getSessionResetTime() {
  const val = localStorage.getItem(SESSION_RESET_KEY);
  return val ? new Date(val).getTime() : 0;
}

export function resetSession() {
  const now = new Date().toISOString();
  localStorage.setItem(SESSION_RESET_KEY, now);
  window.dispatchEvent(new CustomEvent('agentpay:session_reset', { detail: { resetAt: now } }));
}

/**
 * Mark that a purchase/agent run just completed so Dashboard/Payments can detect it
 * on mount even if they weren't listening at the time the event fired.
 * The flag expires after 10 seconds to avoid stale state.
 */
export function markRecentPurchase() {
  localStorage.setItem(RECENT_PURCHASE_KEY, Date.now().toString());
}

/**
 * Returns true (and clears the flag) if a purchase was marked recently (< 10s).
 * Use this on component mount to detect "just purchased → navigated here".
 */
export function consumeRecentPurchase() {
  const val = localStorage.getItem(RECENT_PURCHASE_KEY);
  if (!val) return false;
  const age = Date.now() - parseInt(val, 10);
  localStorage.removeItem(RECENT_PURCHASE_KEY);
  return age < 10000; // 10 second window
}

/**
 * Triggers a real budget exceeded test on the backend / smart contract.
 * @returns {Promise<object>}
 */
export async function runBudgetExceededDemo() {
  return await apiFetch('/security-demo/budget-exceeded', {
    method: 'POST',
  });
}

/**
 * Triggers a real double payment / replay attack test on the backend / smart contract.
 * @returns {Promise<object>}
 */
export async function runDoublePaymentDemo() {
  return await apiFetch('/security-demo/double-payment', {
    method: 'POST',
  });
}

/**
 * Fetches live security summary metrics from backend & audit database.
 * @returns {Promise<object>}
 */
export async function fetchSecuritySummary() {
  return await apiFetch('/security-demo/summary');
}

/**
 * Fetches live kill switch status from backend.
 * @returns {Promise<object>}
 */
export async function fetchKillSwitchStatus() {
  return await apiFetch('/security-demo/kill-switch');
}

/**
 * Toggles emergency kill switch state on backend.
 * @param {boolean} active
 * @param {string} [reason]
 * @returns {Promise<object>}
 */
export async function toggleKillSwitch(active, reason) {
  return await apiFetch('/security-demo/kill-switch', {
    method: 'POST',
    body: JSON.stringify({ active, reason: reason || 'Emergency pause triggered by administrator' }),
  });
}
