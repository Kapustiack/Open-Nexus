import axios from 'axios';
import { AppConfig, ProviderId } from './config-store';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function trimBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function checkService(url: string, path: string): Promise<boolean> {
  try {
    const response = await axios.get(`${trimBaseUrl(url)}${path}`, { timeout: 1500 });
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

export async function resolveActiveProvider(config: AppConfig): Promise<ProviderId> {
  if (config.autoDiscovery) {
    const ollama = config.providers.ollama;
    const lmstudio = config.providers.lmstudio;

    if (ollama.enabled && await checkService(ollama.baseUrl, '/api/tags')) {
      return 'ollama';
    }

    if (lmstudio.enabled && await checkService(lmstudio.baseUrl, '/v1/models')) {
      return 'lmstudio';
    }
  }

  return config.selectedProvider;
}

function getSystemText(messages: ChatMessage[]): string {
  return messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
}

function getConversationMessages(messages: ChatMessage[]) {
  return messages.filter((message) => message.role !== 'system');
}

export async function chatWithProvider(config: AppConfig, provider: ProviderId, messages: ChatMessage[]): Promise<string> {
  let attempts = 0;
  const maxAttempts = 3;
  const backoff = 2000;

  while (attempts < maxAttempts) {
    try {
      const settings = config.providers[provider];
      const client = axios.create({ timeout: 300000 });
      const baseUrl = trimBaseUrl(settings.baseUrl);

      switch (provider) {
        case 'ollama': {
          const response = await client.post(`${baseUrl}/api/chat`, {
            model: settings.model || 'llama3',
            messages,
            stream: false,
          });
          return response.data.message.content;
        }

        case 'lmstudio': {
          const response = await client.post(`${baseUrl}/v1/chat/completions`, {
            model: settings.model || 'local-model',
            messages,
            temperature: 0.1,
            stream: false,
          });
          return response.data.choices[0].message.content;
        }

        case 'openai':
        case 'openrouter':
        case 'mistral':
        case 'groq':
        case 'deepseek':
        case 'xai':
        case 'together':
        case 'perplexity': {
          let endpoint = '/v1/chat/completions';
          if (provider === 'openrouter') {
            endpoint = '/api/v1/chat/completions';
          }
          const headers: any = { Authorization: `Bearer ${settings.apiKey}` };
          if (provider === 'openrouter') {
            headers['HTTP-Referer'] = 'https://github.com/Kapustiack/Open-Nexus';
            headers['X-Title'] = 'Open Nexus';
          }
          const response = await client.post(`${baseUrl}${endpoint}`, {
            model: settings.model || 'gpt-4o-mini',
            messages,
          }, { headers });
          return response.data.choices[0].message.content;
        }

        case 'anthropic': {
          const response = await client.post(`${baseUrl}/v1/messages`, {
            model: settings.model || 'claude-3-5-sonnet-latest',
            system: getSystemText(messages),
            max_tokens: 4096,
            messages: getConversationMessages(messages).map((message) => ({
              role: message.role === 'assistant' ? 'assistant' : 'user',
              content: message.content,
            })),
          }, {
            headers: {
              'x-api-key': settings.apiKey,
              'anthropic-version': '2023-06-01',
            },
          });
          return response.data.content.map((item: any) => item.text || '').join('\n').trim();
        }

        case 'gemini': {
          const response = await client.post(
            `${baseUrl}/v1beta/models/${encodeURIComponent(settings.model || 'gemini-1.5-flash')}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
            {
              contents: getConversationMessages(messages).map((message) => ({
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: message.content }],
              })),
              systemInstruction: {
                parts: [{ text: getSystemText(messages) }],
              },
            },
          );
          return response.data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('\n').trim() || '';
        }

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error: any) {
      if (error.response?.status === 429 && attempts < maxAttempts - 1) {
        console.warn(`[chatWithProvider] 429 detected for ${provider}. Retrying in ${backoff * (attempts + 1)}ms...`);
        attempts++;
        await new Promise(r => setTimeout(r, backoff * attempts));
        continue;
      }
      if (error.response) {
        console.error(`[chatWithProvider] Error from ${provider}: Status ${error.response.status}`, error.response.data);
      }
      throw error;
    }
  }
  throw new Error('Max retry attempts reached for 429 error.');
}

export async function fetchProviderModels(config: AppConfig, provider: ProviderId): Promise<string[]> {
  const settings = config.providers[provider];
  const baseUrl = trimBaseUrl(settings.baseUrl);

  try {
    switch (provider) {
      case 'ollama': {
        const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });
        return response.data.models.map((model: any) => model.name);
      }
      case 'lmstudio': {
        const response = await axios.get(`${baseUrl}/v1/models`, { timeout: 5000 });
        return response.data.data.map((model: any) => model.id);
      }
      case 'openai':
      case 'openrouter':
      case 'mistral':
      case 'groq':
      case 'deepseek':
      case 'xai':
      case 'together':
      case 'perplexity': {
        const endpoint = provider === 'openrouter' ? '/api/v1/models' : '/v1/models';
        const response = await axios.get(`${baseUrl}${endpoint}`, {
          timeout: 5000,
          headers: { Authorization: `Bearer ${settings.apiKey}` },
        });
        return response.data.data.map((model: any) => model.id);
      }
      case 'anthropic': {
        const response = await axios.get(`${baseUrl}/v1/models`, {
          timeout: 5000,
          headers: {
            'x-api-key': settings.apiKey,
            'anthropic-version': '2023-06-01',
          },
        });
        return response.data.data.map((model: any) => model.id);
      }
      case 'gemini': {
        const response = await axios.get(`${baseUrl}/v1beta/models`, {
          timeout: 5000,
          params: { key: settings.apiKey },
        });
        // Gemini returns models with names like "models/gemini-1.5-flash"
        return response.data.models
          .filter((model: any) => model.supportedGenerationMethods.includes('generateContent'))
          .map((model: any) => model.name.replace('models/', ''));
      }
      default:
        return [];
    }
  } catch (error: any) {
    console.error(`[fetchProviderModels] Error fetching models for ${provider}:`, error.message);
    if (error.response) {
      console.error(`[fetchProviderModels] Status: ${error.response.status}`, error.response.data);
    }
    return [];
  }
}
