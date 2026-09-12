/**
 * Integration Placeholder Service for Person 2 (AI Agent) and Person 3 (Service Provider Backend)
 * 
 * Future implementation will replace mock fetches with actual REST/WebSocket API endpoints:
 * - GET  /api/v1/agent/status
 * - GET  /api/v1/agent/current-task
 * - GET  /api/v1/agent/activity
 * - POST /api/v1/agent/request-service
 * - GET  /api/v1/providers
 * - GET  /api/v1/security/events
 * - GET  /api/v1/user/profile
 * - PUT  /api/v1/user/profile
 */

import { 
  mockAgentDetails, 
  mockCurrentTask, 
  mockPipelineSteps, 
  mockAgentLogs,
  mockTransactions,
  mockProviders,
  mockSecurityState,
  mockSecurityEvents,
  mockSettings
} from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Fetch current status of the AI Agent
 * TODO: Replace mock return with Person 2 real API endpoint GET /api/v1/agent/status
 */
export async function getAgentStatus() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/agent/status`);
    // return await response.json();
    return mockAgentDetails;
  } catch (error) {
    console.error('Failed to fetch agent status:', error);
    return mockAgentDetails;
  }
}

/**
 * Fetch active task being executed by the AI Agent
 * TODO: Replace mock return with Person 2 real API endpoint GET /api/v1/agent/current-task
 */
export async function getCurrentTask() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/agent/current-task`);
    // return await response.json();
    return mockCurrentTask;
  } catch (error) {
    console.error('Failed to fetch current task:', error);
    return mockCurrentTask;
  }
}

/**
 * Fetch recent activity feed logs for the AI Agent
 * TODO: Replace mock return with Person 2 real API endpoint GET /api/v1/agent/activity
 */
export async function getAgentActivity() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/agent/activity`);
    // return await response.json();
    return mockAgentLogs;
  } catch (error) {
    console.error('Failed to fetch agent activity:', error);
    return mockAgentLogs;
  }
}

/**
 * Fetch 7-stage service execution pipeline definition
 * TODO: Replace mock return with WebSocket / SSE stream from Person 2 backend
 */
export async function getAgentPipeline() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/agent/pipeline`);
    // return await response.json();
    return mockPipelineSteps;
  } catch (error) {
    console.error('Failed to fetch agent pipeline:', error);
    return mockPipelineSteps;
  }
}

/**
 * Fetch list of active independent service providers
 * TODO: Replace with Person 3 Service Provider Backend GET /api/v1/providers
 */
export async function getProviders() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/providers`);
    // return await response.json();
    return mockProviders;
  } catch (error) {
    console.error('Failed to fetch providers:', error);
    return mockProviders;
  }
}

export async function fetchProviders() {
  return getProviders();
}

/**
 * Fetch security state metrics
 * TODO: Replace mock return with Person 1 smart contract getter + Person 2 security log API
 */
export async function getSecurityState() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/security/state`);
    // return await response.json();
    return mockSecurityState;
  } catch (error) {
    console.error('Failed to fetch security state:', error);
    return mockSecurityState;
  }
}

/**
 * Fetch security event logs
 * TODO: Replace mock return with Person 1 smart contract Event Logs / API GET /api/v1/security/events
 */
export async function getSecurityEvents() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/security/events`);
    // return await response.json();
    return mockSecurityEvents;
  } catch (error) {
    console.error('Failed to fetch security events:', error);
    return mockSecurityEvents;
  }
}

/**
 * Fetch user profile
 * TODO: Replace mock return with authentication/backend GET /api/v1/user/profile
 */
export async function getUserProfile() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/user/profile`);
    // return await response.json();
    return mockSettings.profile;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return mockSettings.profile;
  }
}

/**
 * Update user profile
 * TODO: Replace mock return with authentication/backend PUT /api/v1/user/profile
 */
export async function updateUserProfile(profileData) {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/user/profile`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(profileData)
    // });
    // return await response.json();
    return { success: true, profile: profileData };
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw error;
  }
}

/**
 * Fetch user notification preferences
 * TODO: Replace mock return with backend GET /api/v1/user/preferences
 */
export async function getUserPreferences() {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/user/preferences`);
    // return await response.json();
    return mockSettings.notificationPreferences;
  } catch (error) {
    console.error('Failed to fetch user preferences:', error);
    return mockSettings.notificationPreferences;
  }
}

/**
 * Update user notification preferences
 * TODO: Replace mock return with backend PUT /api/v1/user/preferences
 */
export async function updateUserPreferences(preferences) {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/user/preferences`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(preferences)
    // });
    // return await response.json();
    return { success: true, preferences };
  } catch (error) {
    console.error('Failed to update user preferences:', error);
    throw error;
  }
}

/**
 * Submit a service request to trigger x402 payment flow
 * TODO: Replace with Person 2 AI Agent trigger endpoint POST /api/v1/request-service
 */
export async function submitServiceRequest(serviceType, providerId, payload) {
  try {
    // const response = await fetch(`${API_BASE_URL}/api/v1/request-service`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ serviceType, providerId, payload })
    // });
    // return await response.json();
    return { success: true, requestId: 'A' + Math.floor(100 + Math.random() * 900) };
  } catch (error) {
    console.error('Failed to submit service request:', error);
    throw error;
  }
}
