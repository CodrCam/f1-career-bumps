const productionApiBaseUrl = 'https://7w3x8cjchi.execute-api.us-west-2.amazonaws.com';

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD ? productionApiBaseUrl : '');

export const timingCheckApiBaseUrl = import.meta.env.VITE_TIMING_CHECK_API_URL
  || apiBaseUrl;
