const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skillsApi', {
  scan: (force) => ipcRenderer.invoke('skills:scan', !!force),
  detail: (id) => ipcRenderer.invoke('skills:detail', id),
  install: (payload) => ipcRenderer.invoke('skills:install', payload),
  installMany: (payload) => ipcRenderer.invoke('skills:install-many', payload),
  importSkills: () => ipcRenderer.invoke('skills:import'),
  remove: (payload) => ipcRenderer.invoke('skills:remove', payload),
  openFolder: (p) => ipcRenderer.invoke('skills:open-folder', p),
  reveal: (p) => ipcRenderer.invoke('skills:reveal', p),
  openFile: (p) => ipcRenderer.invoke('skills:open-file', p),
  copy: (text) => ipcRenderer.invoke('skills:copy', text),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  exportSettings: () => ipcRenderer.invoke('settings:export'),
  importSettings: () => ipcRenderer.invoke('settings:import'),
  addProject: () => ipcRenderer.invoke('project:add'),
  chooseDir: () => ipcRenderer.invoke('settings:choose-dir'),
  agents: () => ipcRenderer.invoke('agents:list'),
  enrich: () => ipcRenderer.invoke('skills:enrich'),
  onEnriched: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('skills:enriched', handler);
    return () => ipcRenderer.removeListener('skills:enriched', handler);
  },
  marketList: (payload) => ipcRenderer.invoke('market:list', payload),
  marketDescribe: (items) => ipcRenderer.invoke('market:describe', items),
  marketStars: (repos) => ipcRenderer.invoke('market:stars', repos),
  marketInstall: (payload) => ipcRenderer.invoke('market:install', payload),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  aiTest: (payload) => ipcRenderer.invoke('ai:test', payload),
  aiSave: (payload) => ipcRenderer.invoke('ai:save', payload),
  aiClear: () => ipcRenderer.invoke('ai:clear'),
  aiSummarizeLocal: (payload) => ipcRenderer.invoke('ai:summarize-local', payload),
  aiSummarizeMarket: (items) => ipcRenderer.invoke('ai:summarize-market', items),
  aiRecommend: (payload) => ipcRenderer.invoke('ai:recommend', payload),
  aiClearSummaries: () => ipcRenderer.invoke('ai:clear-summaries'),
  onAiProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('ai:progress', handler);
    return () => ipcRenderer.removeListener('ai:progress', handler);
  },
});
