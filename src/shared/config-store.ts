import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type ProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'mistral' | 'groq' | 'deepseek' | 'xai' | 'together' | 'perplexity';

export interface ProviderSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  allowedChatIds: string[];
  allowTerminalCommands: boolean;
}

export interface AppConfig {
  selectedProvider: ProviderId;
  autoDiscovery: boolean;
  brightness: number;
  ttsEnabled: boolean;
  tts_engine: 'piper' | 'system';
  language: string;
  voice: string;
  speed: number;
  volume: number;
  cliWorkspace: string;
  providers: Record<ProviderId, ProviderSettings>;
  telegram: TelegramConfig;
  ollamaUrl: string;
  ollamaModel: string;
  lmStudioUrl: string;
  lmStudioModel: string;
  jailbreak: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  selectedProvider: 'ollama',
  autoDiscovery: true,
  brightness: 1.0,
  ttsEnabled: false,
  tts_engine: 'piper',
  language: 'en_US',
  voice: 'en_US-ryan-medium',
  speed: 1.0,
  volume: 1.0,
  cliWorkspace: '',
  providers: {
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'llama3',
      apiKey: '',
      enabled: true,
    },
    lmstudio: {
      baseUrl: 'http://localhost:1234',
      model: 'local-model',
      apiKey: '',
      enabled: true,
    },
    openai: {
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
      apiKey: '',
      enabled: false,
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-sonnet-latest',
      apiKey: '',
      enabled: false,
    },
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-1.5-flash',
      apiKey: '',
      enabled: false,
    },
    openrouter: {
      baseUrl: 'https://openrouter.ai',
      model: 'openai/gpt-4o-mini',
      apiKey: '',
      enabled: false,
    },
    mistral: {
      baseUrl: 'https://api.mistral.ai',
      model: 'mistral-large-latest',
      apiKey: '',
      enabled: false,
    },
    groq: {
      baseUrl: 'https://api.groq.com/openai',
      model: 'llama-3.3-70b-versatile',
      apiKey: '',
      enabled: false,
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      apiKey: '',
      enabled: false,
    },
    xai: {
      baseUrl: 'https://api.x.ai',
      model: 'grok-2-latest',
      apiKey: '',
      enabled: false,
    },
    together: {
      baseUrl: 'https://api.together.xyz',
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      apiKey: '',
      enabled: false,
    },
    perplexity: {
      baseUrl: 'https://api.perplexity.ai',
      model: 'llama-3.1-sonar-large-128k-online',
      apiKey: '',
      enabled: false,
    },
  },
  telegram: {
    enabled: false,
    botToken: '',
    allowedChatIds: [],
    allowTerminalCommands: false,
  },
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
  lmStudioUrl: 'http://localhost:1234',
  lmStudioModel: 'local-model',
  jailbreak: false,
};

export function getDefaultConfigPath(): string {
  const appDataRoot = process.env.APPDATA || path.join(os.homedir(), '.config');
  return path.join(appDataRoot, 'Open Nexus', 'nexus-config.json');
}

function ensureConfigDir(configPath: string) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function migrateLegacyConfig(config: Partial<AppConfig>): AppConfig {
  const mergedProviders = {
    ...DEFAULT_CONFIG.providers,
    ...(config.providers || {}),
  };

  if (config.ollamaUrl) mergedProviders.ollama.baseUrl = config.ollamaUrl;
  if (config.ollamaModel) mergedProviders.ollama.model = config.ollamaModel;
  if (config.lmStudioUrl) mergedProviders.lmstudio.baseUrl = config.lmStudioUrl;
  if (config.lmStudioModel) mergedProviders.lmstudio.model = config.lmStudioModel;

  return {
    ...DEFAULT_CONFIG,
    ...config,
    providers: mergedProviders,
    telegram: {
      ...DEFAULT_CONFIG.telegram,
      ...(config.telegram || {}),
    },
    ollamaUrl: mergedProviders.ollama.baseUrl,
    ollamaModel: mergedProviders.ollama.model,
    lmStudioUrl: mergedProviders.lmstudio.baseUrl,
    lmStudioModel: mergedProviders.lmstudio.model,
  };
}

export function loadSharedConfig(configPath = getDefaultConfigPath()): AppConfig {
  ensureConfigDir(configPath);

  if (!fs.existsSync(configPath)) {
    saveSharedConfig(DEFAULT_CONFIG, configPath);
    return DEFAULT_CONFIG;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return migrateLegacyConfig(parsed);
  } catch (error) {
    console.error('Failed to load shared Nexus config, using defaults.', error);
    return DEFAULT_CONFIG;
  }
}

export function saveSharedConfig(config: AppConfig, configPath = getDefaultConfigPath()) {
  ensureConfigDir(configPath);
  const normalized = migrateLegacyConfig(config);
  fs.writeFileSync(configPath, JSON.stringify(normalized, null, 2), 'utf-8');
}
