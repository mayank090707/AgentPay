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
 * Groups logs by request_id and builds a complete lifecycle record.
 * 
 * @param {Array} logs - Raw audit log items from /audit/logs
 * @returns {Array} List of UI transaction objects
 */
export function parseAuditLogsToTransactions(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  // Group logs by request_id
  const grouped = {};
  logs.forEach((log) => {
    const reqId = log.request_id || 'UNKNOWN';
    if (!grouped[reqId]) {
      grouped[reqId] = [];
    }
    grouped[reqId].push(log);
  });

  const transactions = [];

  Object.entries(grouped).forEach(([reqId, reqLogs]) => {
    // Sort logs chronologically
    reqLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let service = 'Unknown Service';
    let provider = 'Unknown Provider';
    let amount = 0;
    let amountEth = '0.00';
    let paymentTx = 'N/A';
    let deliveryStatus = 'Processing';
    let contentHash = 'N/A';
    let timestamp = reqLogs[0]?.timestamp ? new Date(reqLogs[0].timestamp).toLocaleTimeString() : 'N/A';
    let date = reqLogs[0]?.timestamp ? new Date(reqLogs[0].timestamp).toISOString().split('T')[0] : 'N/A';
    let error = null;

    reqLogs.forEach((log) => {
      const evt = log.event_type;
      const details = log.details || {};

      if (evt === 'QUOTE_CREATED') {
        service = details.service_type || details.service || service;
        provider = details.provider_id || details.provider || provider;
        amount = details.amount || amount;
        if (details.currency === 'ETH') {
          amountEth = `${amount} ETH`;
        }
      }

      if (evt === 'PAYMENT_VERIFIED' || evt === 'SMART_CONTRACT_AUTHORIZATION' || evt === 'PAYMENT_AUTHORIZED') {
        paymentTx = details.tx_hash || details.payment_tx || paymentTx;
        amount = details.amount || details.amountEth || amount;
        if (typeof amount === 'number') {
          amountEth = `${amount} ETH`;
        }
      }

      if (evt === 'SERVICE_DELIVERED' || evt === 'DELIVERY_RECORDED') {
        deliveryStatus = 'Delivered';
        contentHash = details.content_hash || details.hash || contentHash;
        if (details.tx_hash) paymentTx = details.tx_hash;
      }

      if (evt === 'BUDGET_EXCEEDED' || evt === 'PAYMENT_FAILED' || evt === 'PAYMENT_REJECTED') {
        deliveryStatus = 'Blocked';
        error = details.reason || details.error || details.message || 'Payment blocked by contract budget enforcement';
        paymentTx = details.tx_hash || '0x000...REJECTED';
        contentHash = 'N/A - Budget Exceeded';
      }
    });

    transactions.push({
      request_id: reqId,
      service: service.charAt(0).toUpperCase() + service.slice(1),
      provider: provider.charAt(0).toUpperCase() + provider.slice(1),
      amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
      amountEth: amountEth || `${amount} ETH`,
      payment_tx: paymentTx,
      delivery_status: deliveryStatus,
      content_hash: contentHash,
      timestamp,
      date,
      error,
      rawLogs: reqLogs,
    });
  });

  return transactions;
}
