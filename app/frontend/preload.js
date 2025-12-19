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
    const res = await fetch(`http://127.0.0.1:8000${endpoint}`);
    return res.json();
  },
  
  async post(endpoint, body) {
    const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
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
