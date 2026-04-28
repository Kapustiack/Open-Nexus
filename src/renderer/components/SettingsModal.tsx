import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, RefreshCw, ChevronDown, Volume2, Globe, Mic, ChevronRight, Cpu, Radio } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onSave: (oUrl: string, oMod: string, lUrl: string, lMod: string, prov: any, bri: number, tts: boolean, engine: 'piper' | 'system', lang: string, voice: string, speed: number, vol: number, discovery: boolean, jail: boolean) => void;
  onSaveRawConfig?: (config: any) => void;
  initialConfig?: any;
  initialOllama: string;
  initialOllamaModel: string;
  initialLm: string;
  initialLmModel: string;
  initialProvider: any;
  initialBrightness: number;
  initialTtsEnabled: boolean;
  initialEngine: 'piper' | 'system';
  initialLanguage: string;
  initialVoice: string;
  initialSpeed: number;
  initialVolume: number;
  initialDiscovery: boolean;
  initialJailbreak: boolean;
}

const LANGUAGE_NAMES: Record<string, string> = {
  'en_US': 'English (US)', 'en_GB': 'English (UK)', 'ru_RU': 'Russian', 'uk_UA': 'Ukrainian', 'ar_JO': 'Arabic', 'zh_CN': 'Chinese', 'de_DE': 'German', 'fr_FR': 'French', 'es_ES': 'Spanish', 'it_IT': 'Italian'
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose, onSave, onSaveRawConfig, initialConfig, initialOllama, initialOllamaModel, initialLm, initialLmModel, initialProvider, initialBrightness, initialTtsEnabled, initialEngine, initialLanguage, initialVoice, initialSpeed, initialVolume, initialDiscovery, initialJailbreak
}) => {
  const providerOrder = ['ollama', 'lmstudio', 'openai', 'anthropic', 'gemini', 'openrouter', 'mistral', 'groq', 'deepseek', 'xai', 'together', 'perplexity'] as const;
  const providerLabels: Record<typeof providerOrder[number], string> = {
    ollama: 'Ollama',
    lmstudio: 'LM Studio',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini',
    openrouter: 'OpenRouter',
    mistral: 'Mistral AI',
    groq: 'Groq',
    deepseek: 'DeepSeek',
    xai: 'X.AI (Grok)',
    together: 'Together AI',
    perplexity: 'Perplexity',
  };
  const [ollamaUrl, setOllamaUrl] = useState(initialOllama);
  const [ollamaModel, setOllamaModel] = useState(initialOllamaModel);
  const [lmStudioUrl, setLmStudioUrl] = useState(initialLm);
  const [lmStudioModel, setLmStudioModel] = useState(initialLmModel);
  const [selectedProvider, setSelectedProvider] = useState<typeof providerOrder[number]>(initialProvider);
  const [providerConfigs, setProviderConfigs] = useState<any>(() => initialConfig?.providers || {
    ollama: { baseUrl: initialOllama, model: initialOllamaModel, apiKey: '', enabled: true },
    lmstudio: { baseUrl: initialLm, model: initialLmModel, apiKey: '', enabled: true },
    openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini', apiKey: '', enabled: false },
    anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-latest', apiKey: '', enabled: false },
    gemini: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-1.5-flash', apiKey: '', enabled: false },
    openrouter: { baseUrl: 'https://openrouter.ai', model: 'openai/gpt-4o-mini', apiKey: '', enabled: false },
    mistral: { baseUrl: 'https://api.mistral.ai', model: 'mistral-large-latest', apiKey: '', enabled: false },
    groq: { baseUrl: 'https://api.groq.com/openai', model: 'llama-3.3-70b-versatile', apiKey: '', enabled: false },
    deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: '', enabled: false },
    xai: { baseUrl: 'https://api.x.ai', model: 'grok-2-latest', apiKey: '', enabled: false },
    together: { baseUrl: 'https://api.together.xyz', model: 'mistralai/Mixtral-8x7B-Instruct-v0.1', apiKey: '', enabled: false },
    perplexity: { baseUrl: 'https://api.perplexity.ai', model: 'llama-3.1-sonar-large-128k-online', apiKey: '', enabled: false },
  });
  const [brightness, setBrightness] = useState(initialBrightness);
  const [autoDiscovery, setAutoDiscovery] = useState(initialDiscovery);
  const [jailbreak, setJailbreak] = useState(initialJailbreak);

  const [ttsEnabled, setTtsEnabled] = useState(initialTtsEnabled);
  const [ttsEngine, setTtsEngine] = useState<'piper' | 'system'>(initialEngine);
  const [language, setLanguage] = useState(initialLanguage);
  const [voice, setVoice] = useState(initialVoice);
  const [speed, setSpeed] = useState(initialSpeed);
  const [volume, setVolume] = useState(initialVolume);

  const [isAiPanelExpanded, setIsAiPanelExpanded] = useState(!initialDiscovery);
  const [isVoicePanelExpanded, setIsVoicePanelExpanded] = useState(false);
  const [isTelegramPanelExpanded, setIsTelegramPanelExpanded] = useState(false);
  
  const [telegramEnabled, setTelegramEnabled] = useState(initialConfig?.telegram?.enabled || false);
  const [telegramToken, setTelegramToken] = useState(initialConfig?.telegram?.botToken || '');
  const [telegramAllowedIds, setTelegramAllowedIds] = useState((initialConfig?.telegram?.allowedChatIds || []).join(', '));
  const [telegramAllowTerminal, setTelegramAllowTerminal] = useState(initialConfig?.telegram?.allowTerminalCommands || false);

  const [modelLists, setModelLists] = useState<Record<string, string[]>>({});
  const [availableVoices, setAvailableVoices] = useState<Record<string, string[]>>({});
  const [isDetecting, setIsDetecting] = useState(false);

  const detectModels = async (prov: typeof providerOrder[number], url: string, apiKey?: string) => {
    if (!url || url.length < 5) return;
    setIsDetecting(true);
    try {
      const models = await window.electron.fetchModels({ provider: prov, url, apiKey });
      setModelLists(prev => ({ ...prev, [prov]: models }));
    } catch (e) { console.error("Detection failed"); }
    finally { setIsDetecting(false); }
  };

  useEffect(() => {
    for (const provider of providerOrder) {
      const config = providerConfigs?.[provider];
      const url = config?.baseUrl;
      const apiKey = config?.apiKey;
      if (url) detectModels(provider, url, apiKey);
    }
  }, []);

  useEffect(() => {
    const loadVoices = async () => {
      const voices = await window.electron.getPiperVoices();
      setAvailableVoices(voices);
    };
    loadVoices();
  }, []);

  const updateProviderConfig = (provider: typeof providerOrder[number], patch: any) => {
    setProviderConfigs((prev: any) => ({ ...prev, [provider]: { ...(prev?.[provider] || {}), ...patch } }));
  };

  const selectedProviderConfig = providerConfigs?.[selectedProvider] || { baseUrl: '', model: '', apiKey: '', enabled: false };

  const handleSaveAll = () => {
    const mergedConfig = {
      ...(initialConfig || {}),
      providers: providerConfigs,
      selectedProvider,
      autoDiscovery,
      brightness,
      ttsEnabled,
      tts_engine: ttsEngine,
      language,
      voice,
      speed,
      volume,
      ollamaUrl: providerConfigs?.ollama?.baseUrl || ollamaUrl,
      ollamaModel: providerConfigs?.ollama?.model || ollamaModel,
      lmStudioUrl: providerConfigs?.lmstudio?.baseUrl || lmStudioUrl,
      lmStudioModel: providerConfigs?.lmstudio?.model || lmStudioModel,
      telegram: {
        enabled: telegramEnabled,
        botToken: telegramToken,
        allowedChatIds: telegramAllowedIds.split(',').map(s => s.trim()).filter(s => !!s),
        allowTerminalCommands: telegramAllowTerminal,
      }
    };

    if (onSaveRawConfig) onSaveRawConfig(mergedConfig);
    else onSave(
      mergedConfig.ollamaUrl,
      mergedConfig.ollamaModel,
      mergedConfig.lmStudioUrl,
      mergedConfig.lmStudioModel,
      selectedProvider,
      brightness,
      ttsEnabled,
      ttsEngine,
      language,
      voice,
      speed,
      volume,
      autoDiscovery,
      jailbreak
    );
  };

  const selectStyle = "w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] text-zinc-400 focus:outline-none appearance-none cursor-pointer hover:bg-black/60 transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      style={{ WebkitAppRegion: 'no-drag' } as any}
    >
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }}
        className="w-full max-w-sm bg-[#0D0D0F] border border-white/5 rounded-2xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-hide"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-500">Open Nexus Config</h2>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors"><X size={16} /></button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Auto Discovery Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <Radio size={14} className={autoDiscovery ? "text-indigo-400" : "text-zinc-600"} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Auto Discovery</span>
                <span className="text-[8px] text-zinc-600 uppercase tracking-tighter">Locate AI on standard ports</span>
              </div>
            </div>
            <button onClick={() => setAutoDiscovery(!autoDiscovery)} className={`w-8 h-4 rounded-full transition-all relative ${autoDiscovery ? 'bg-indigo-600' : 'bg-zinc-800'}`}>
              <motion.div animate={{ x: autoDiscovery ? 16 : 2 }} className="absolute top-1 w-2 h-2 bg-white rounded-full" />
            </button>
          </div>

          {/* Jailbreak Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <Sun size={14} className={jailbreak ? "text-red-400" : "text-zinc-600"} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Jailbreak Mode</span>
                <span className="text-[8px] text-zinc-600 uppercase tracking-tighter">Disable workspace boundary (Dangerous)</span>
              </div>
            </div>
            <button onClick={() => setJailbreak(!jailbreak)} className={`w-8 h-4 rounded-full transition-all relative ${jailbreak ? 'bg-red-600' : 'bg-zinc-800'}`}>
              <motion.div animate={{ x: jailbreak ? 16 : 2 }} className="absolute top-1 w-2 h-2 bg-white rounded-full" />
            </button>
          </div>

          <div className="space-y-2">
            <button onClick={() => setIsAiPanelExpanded(!isAiPanelExpanded)} className="w-full flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-3"><Cpu size={14} className="text-emerald-400" /><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Intelligence Core</span></div>
              <ChevronRight size={14} className={`text-zinc-600 transition-transform duration-300 ${isAiPanelExpanded ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
              {isAiPanelExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-4 space-y-5 bg-black/20 rounded-xl border border-white/5 mt-2">
                    <div className="relative">
                      <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value as any)} className={selectStyle}>
                        {providerOrder.map((provider) => <option key={provider} value={provider} className="bg-[#0D0D0F]">{providerLabels[provider]}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-2.5 text-zinc-600 pointer-events-none" />
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Host Endpoint</label>
                        <input type="text" value={selectedProviderConfig.baseUrl || ''} onChange={(e) => updateProviderConfig(selectedProvider, { baseUrl: e.target.value })} className="w-full bg-transparent border-b border-white/5 text-[10px] py-1 text-zinc-300 focus:outline-none focus:border-indigo-500/30 transition-colors" placeholder="http://localhost:..." />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">API Key</label>
                        <input type="password" value={selectedProviderConfig.apiKey || ''} onChange={(e) => updateProviderConfig(selectedProvider, { apiKey: e.target.value, enabled: true })} className="w-full bg-transparent border-b border-white/5 text-[10px] py-1 text-zinc-300 focus:outline-none focus:border-indigo-500/30 transition-colors" placeholder="Optional for local providers" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Model</label>
                        <div className="relative">
                          <select value={selectedProviderConfig.model || ''} onChange={(e) => updateProviderConfig(selectedProvider, { model: e.target.value, enabled: true })} className={selectStyle}>
                            <option value="">Select Model...</option>
                            {(modelLists[selectedProvider] || []).map(m => <option key={m} value={m} className="bg-[#0D0D0F]">{m}</option>)}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-2.5 text-zinc-600 pointer-events-none" />
                        </div>
                        <input type="text" value={selectedProviderConfig.model || ''} onChange={(e) => updateProviderConfig(selectedProvider, { model: e.target.value, enabled: true })} className="w-full bg-transparent border-b border-white/5 text-[10px] py-1 text-zinc-300 focus:outline-none focus:border-indigo-500/30 transition-colors" placeholder="Or type a custom model id" />
                        <button onClick={() => detectModels(selectedProvider, selectedProviderConfig.baseUrl || '', selectedProviderConfig.apiKey || '')} className="text-[9px] uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
                          {isDetecting ? 'Detecting Models...' : 'Refresh Model List'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <button onClick={() => setIsVoicePanelExpanded(!isVoicePanelExpanded)} className="w-full flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-3"><Volume2 size={14} className={ttsEnabled ? "text-indigo-400" : "text-zinc-600"} /><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Synthesis Engine</span></div>
              <ChevronRight size={14} className={`text-zinc-600 transition-transform duration-300 ${isVoicePanelExpanded ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
              {isVoicePanelExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-4 space-y-6 bg-black/20 rounded-xl border border-white/5 mt-2">
                    <div className="flex items-center justify-between"><span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Active Pipeline</span><button onClick={() => setTtsEnabled(!ttsEnabled)} className={`w-8 h-4 rounded-full transition-all relative ${ttsEnabled ? 'bg-indigo-600' : 'bg-zinc-800'}`}><motion.div animate={{ x: ttsEnabled ? 16 : 2 }} className="absolute top-1 w-2 h-2 bg-white rounded-full" /></button></div>
                    {ttsEnabled && (
                      <div className="space-y-4">
                        <div className="space-y-2"><div className="flex items-center gap-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest"><Globe size={10} /><span>Language</span></div><div className="relative"><select value={language} onChange={(e) => { setLanguage(e.target.value); setVoice(availableVoices[e.target.value]?.[0] || ''); }} className={selectStyle}>{Object.keys(availableVoices).map(lang => <option key={lang} value={lang} className="bg-[#0D0D0F]">{LANGUAGE_NAMES[lang] || lang}</option>)}</select><ChevronDown size={12} className="absolute right-3 top-2.5 text-zinc-600 pointer-events-none" /></div></div>
                        <div className="space-y-2"><div className="flex items-center gap-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest"><Mic size={10} /><span>Voice Profile</span></div><div className="relative"><select value={voice} onChange={(e) => setVoice(e.target.value)} className={selectStyle}>{(availableVoices[language] || []).map(v => <option key={v} value={v} className="bg-[#0D0D0F]">{v}</option>)}</select><ChevronDown size={12} className="absolute right-3 top-2.5 text-zinc-600 pointer-events-none" /></div></div>
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><div className="flex justify-between items-center text-[9px] font-bold text-zinc-600 uppercase"><span>Speed</span><span className="font-mono">{speed}x</span></div><input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div><div className="space-y-2"><div className="flex justify-between items-center text-[9px] font-bold text-zinc-600 uppercase"><span>Volume</span><span className="font-mono">{Math.round(volume * 100)}%</span></div><input type="range" min="0" max="1" step="0.1" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div></div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <button onClick={() => setIsTelegramPanelExpanded(!isTelegramPanelExpanded)} className="w-full flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-3"><Globe size={14} className={telegramEnabled ? "text-sky-400" : "text-zinc-600"} /><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Remote Access</span></div>
              <ChevronRight size={14} className={`text-zinc-600 transition-transform duration-300 ${isTelegramPanelExpanded ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
              {isTelegramPanelExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-4 space-y-6 bg-black/20 rounded-xl border border-white/5 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Telegram Bot</span>
                        <span className="text-[7px] text-zinc-600 uppercase">Control your PC via encrypted bot</span>
                      </div>
                      <button onClick={() => setTelegramEnabled(!telegramEnabled)} className={`w-8 h-4 rounded-full transition-all relative ${telegramEnabled ? 'bg-sky-600' : 'bg-zinc-800'}`}>
                        <motion.div animate={{ x: telegramEnabled ? 16 : 2 }} className="absolute top-1 w-2 h-2 bg-white rounded-full" />
                      </button>
                    </div>
                    {telegramEnabled && (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Bot API Token</label>
                          <input type="password" value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} className="w-full bg-transparent border-b border-white/5 text-[10px] py-1 text-zinc-300 focus:outline-none focus:border-sky-500/30 transition-colors" placeholder="BotFather Token" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Allowed Chat IDs</label>
                          <input type="text" value={telegramAllowedIds} onChange={(e) => setTelegramAllowedIds(e.target.value)} className="w-full bg-transparent border-b border-white/5 text-[10px] py-1 text-zinc-300 focus:outline-none focus:border-sky-500/30 transition-colors" placeholder="ID1, ID2 (Empty for all)" />
                          <p className="text-[7px] text-zinc-600 uppercase">Comma separated list of allowed chat IDs or usernames</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Allow Terminal</span>
                          <button onClick={() => setTelegramAllowTerminal(!telegramAllowTerminal)} className={`w-6 h-3 rounded-full transition-all relative ${telegramAllowTerminal ? 'bg-red-600' : 'bg-zinc-800'}`}>
                            <motion.div animate={{ x: telegramAllowTerminal ? 12 : 2 }} className="absolute top-0.5 w-2 h-2 bg-white rounded-full" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-4 space-y-4 border-t border-white/5">
            <div className="space-y-3">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sun size={12} className="text-zinc-600" /><label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Obsidian Luminance</label></div><span className="text-[10px] font-mono text-zinc-500">{Math.round((brightness - 1) * (100 / 1.5))}%</span></div>
              <input type="range" min="0" max="100" step="1" value={Math.round((brightness - 1) * (100 / 1.5))} onChange={(e) => setBrightness(1 + (parseInt(e.target.value) * (1.5 / 100)))} className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>
          </div>
        </div>

        <button onClick={handleSaveAll} className="mt-8 w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl border border-white/5 transition-all">Save Settings</button>
      </motion.div>
    </motion.div>
  );
};
