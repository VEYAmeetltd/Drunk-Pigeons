// Advertising + admin API client. Uses the SAME ORIGIN as the loaded page on web so the
// HttpOnly SameSite=Strict admin session cookie is sent (the /api path is routed to the
// backend by the ingress on the same host). Falls back to env on native.
import { Platform } from 'react-native';

function base() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return window.location.origin.replace(/\/$/, '');
  }
  return (process.env.EXPO_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
}

export function apiUrl(path) {
  return `${base()}/api${path}`;
}

export const AdvertiseAPI = {
  async packages() {
    const res = await fetch(apiUrl('/advertise/packages'), { credentials: 'include' });
    if (!res.ok) throw new Error('packages');
    return res.json();
  },
  async submit(formData) {
    return fetch(apiUrl('/advertise/submit'), { method: 'POST', body: formData, credentials: 'include' });
  },
};

export const AdminAPI = {
  login: (username, password) =>
    fetch(apiUrl('/admin/login'), {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  logout: () => fetch(apiUrl('/admin/logout'), { method: 'POST', credentials: 'include' }),
  me: () => fetch(apiUrl('/admin/me'), { credentials: 'include' }),
  list: () => fetch(apiUrl('/admin/enquiries'), { credentials: 'include' }),
  setStatus: (id, status) =>
    fetch(apiUrl(`/admin/enquiries/${id}/status`), {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  artworkUrl: (id) => apiUrl(`/admin/enquiries/${id}/artwork`),
};
