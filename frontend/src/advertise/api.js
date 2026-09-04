// Advertising submission API client. Uses the same origin as the loaded page on web
// (falls back to env on native). There is no admin client here — enquiry review/
// moderation happens exclusively through the protected backend-to-backend integration
// API consumed by the INTIES Admin Dashboard, never from this app's frontend.
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
