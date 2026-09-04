// Single source of truth for the (currently fixed) advertising packages, bundled with the
// app so the /advertise page renders INSTANTLY with no network fetch. Stable IDs here must
// match the backend allow-list in backend/advertising.py (PACKAGES). Do not duplicate these
// values in any other frontend file — import AD_PACKAGES from here.
export const AD_PACKAGES = [
  { id: 'test-flight', name: 'TEST FLIGHT', scope: 'One map', days: 7, price: '£25' },
  { id: 'city-run', name: 'CITY RUN', scope: 'All maps', days: 14, price: '£50' },
  { id: 'full-pigeon', name: 'FULL PIGEON', scope: 'All maps', days: 30, price: '£90' },
  { id: 'exclusive-14', name: 'EXCLUSIVE PIGEON', scope: 'Exclusive paid sponsor across all maps', days: 14, price: '£250' },
  { id: 'exclusive-30', name: 'EXCLUSIVE PIGEON', scope: 'Exclusive paid sponsor across all maps', days: 30, price: '£500' },
];
