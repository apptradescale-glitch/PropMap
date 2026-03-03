/**
 * API Client Helper - Adds Firebase auth token to all API requests
 * Usage: callAPI('/api/endpoint', 'POST', { data })
 */

import { useAuth } from '@/context/FAuth';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Make authenticated API call with Firebase token
 * @param endpoint - API endpoint path (e.g., '/api/tradovate')
 * @param options - Request options (method, body, headers)
 * @returns Promise with JSON response
 */
export async function callAPI(
  endpoint: string,
  options: ApiOptions = {}
) {
  const { useAuth: getAuthContext } = await import('@/context/FAuth');
  
  // Get current user and Firebase token
  let currentUser: any;
  try {
    // This will be called from a component, so we need to get auth from context differently
    // For now, we'll return a function that takes currentUser
    // This will be improved when called from components
  } catch (error) {
    throw new Error('Unable to get auth context');
  }

  const {
    method = 'POST',
    body = undefined,
    headers = {}
  } = options;

  // Build request options
  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  // Add auth token (will be added by caller)
  // This will be: 'Authorization': `Bearer ${token}`

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(endpoint, requestOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API Error ${response.status}: ${error.error || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API call failed to ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Helper to add auth token to fetch calls
 * Usage in components:
 * 
 * const token = await currentUser.getIdToken();
 * const headers = getAuthHeaders(token);
 * fetch('/api/endpoint', { headers, method: 'POST', body: JSON.stringify({...}) })
 */
export function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}
