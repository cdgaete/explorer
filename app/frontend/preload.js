const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  apiRequest: (options) => ipcRenderer.invoke('api-request', options),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  onBackendMessage: (callback) => ipcRenderer.on('backend-message', callback),
});

// Also expose fetch for direct API calls
contextBridge.exposeInMainWorld('backendAPI', {
  baseUrl: 'http://127.0.0.1:8000',
  
  async get(endpoint) {
    try {
      const res = await fetch(`http://127.0.0.1:8000${endpoint}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      console.error(`GET ${endpoint} failed:`, e);
      throw e;
    }
  },
  
  async post(endpoint, body) {
    try {
      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      console.error(`POST ${endpoint} failed:`, e);
      throw e;
    }
  },
  
  async uploadFile(endpoint, file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },
});
