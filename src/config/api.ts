export const API_CONFIG = {
  N8N_WEBHOOK_URL: 'https://n8n-selfhosted-miqi.onrender.com/webhook/guruai',
  N8N_WEBHOOK_TEST_URL: 'https://n8n-selfhosted-miqi.onrender.com/webhook-test/guruai',
  ELEVENLABS_API_URL: 'https://api.elevenlabs.io/v1',
  ELEVENLABS_API_KEY: import.meta.env.VITE_ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID: import.meta.env.VITE_ELEVENLABS_VOICE_ID,
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}; 