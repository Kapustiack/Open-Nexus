#!/usr/bin/env node
import axios from 'axios';
import { chatWithNexus } from '../shared/nexus-agent';
import { executeTools } from '../shared/local-tool-executor';
import { loadSharedConfig } from '../shared/config-store';

type HistoryMessage = { role: 'user' | 'assistant' | 'system'; content: string };

const config = loadSharedConfig();
const token = config.telegram.botToken;

if (!token) {
  console.error('Telegram bot token is not configured.');
  process.exit(1);
}

const histories = new Map<string, HistoryMessage[]>();
const knownFilesByChat = new Map<string, Set<string>>();
const processedUpdates = new Set<number>();
const processingChats = new Set<string>();
let offset = 0;

function stripToolsOnly(content: string): string {
  return content
    .replace(/<run>[\s\S]*?<\/run>/g, '')
    .replace(/<write_file[\s\S]*?<\/write_file>/g, '')
    .replace(/<edit_file[\s\S]*?<\/edit_file>/g, '')
    .replace(/<diff[\s\S]*?<\/diff>/g, '')
    .replace(/<patch[\s\S]*?<\/patch>/g, '')
    .replace(/<read_file[\s\S]*?<\/read_file>/g, '')
    .replace(/<create_directory[\s\S]*?\/>/g, '')
    .replace(/<delete_path[\s\S]*?\/>/g, '')
    .replace(/<list_files[\s\S]*?\/>/g, '')
    .replace(/\[(\/?(?:run|write_file|edit_file|diff|patch|read_file|create_directory|delete_path|list_files)\b)[^\]]*\]/g, '')
    .trim();
}

function getHistory(chatId: string) {
  if (!histories.has(chatId)) histories.set(chatId, []);
  return histories.get(chatId)!;
}

function getKnownFiles(chatId: string) {
  if (!knownFilesByChat.has(chatId)) knownFilesByChat.set(chatId, new Set<string>());
  return knownFilesByChat.get(chatId)!;
}

function isAllowed(chatId: string, username?: string) {
  if (config.telegram.allowedChatIds.length === 0) return true;

  return config.telegram.allowedChatIds.some(allowed => {
    const trimmed = allowed.trim();
    // Check ID match
    if (trimmed === chatId) return true;
    // Check Username match (case insensitive, with or without @)
    if (username && (trimmed.toLowerCase() === `@${username.toLowerCase()}` || trimmed.toLowerCase() === username.toLowerCase())) {
      return true;
    }
    return false;
  });
}

async function sendMessage(chatId: string, text: string) {
  if (!text || !text.trim()) return;

  try {
    // Split message if too long (Telegram limit ~4096)
    const chunks = text.match(/[\s\S]{1,4000}/g) || [];
    for (const chunk of chunks) {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
      });
    }
  } catch (error: any) {
    console.warn(`Markdown send failed, retrying as plain text...`);
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: text.substring(0, 4000),
      });
    } catch (e: any) {
      console.error(`Failed to send message to ${chatId}:`, e.message);
    }
  }
}

async function handleMessage(chatId: string, text: string, username?: string) {
  if (processingChats.has(chatId)) return;
  
  if (!isAllowed(chatId, username)) {
    console.log(`Access denied for ${username || chatId}`);
    await sendMessage(chatId, 'This chat is not allowed to control Open Nexus. Use your Telegram numeric ID or @username in settings.');
    return;
  }

  processingChats.add(chatId);
  console.log(`Processing message from ${username || chatId}: ${text}`);
  const history = getHistory(chatId);
  
  if (history.length === 0) {
    history.push({ 
      role: 'system', 
      content: 'You are Open Nexus. When asked for code, provide it directly in standard Markdown code blocks. Do not hide code in tools unless you are also writing it to a file. Ensure you respond in a way that is readable in a chat interface.' 
    });
  }

  history.push({ role: 'user', content: text });
  
  try {
    const workspace = config.cliWorkspace || process.cwd();
    const response = await chatWithNexus(history, workspace, config);
    history.push({ role: 'assistant', content: response.content });
    
    // Telegram gets the code blocks, but the app stays clean
    const telegramContent = stripToolsOnly(response.rawContent) || response.content;

    await sendMessage(chatId, telegramContent);

    if (response.tools.length) {
      const toolResults = await executeTools(response.tools, {
        workspaceRoot: workspace,
        knownFiles: getKnownFiles(chatId),
        allowTerminal: config.telegram.allowTerminalCommands,
        jailbreak: config.jailbreak, // Pass jailbreak mode
        recentMessages: history.map(m => m.content)
      });

      if (toolResults) {
        history.push({ role: 'user', content: `[SYSTEM: TOOL_RESULTS]\n${toolResults}` });
        const followUp = await chatWithNexus(history, workspace, config);
        history.push({ role: 'assistant', content: followUp.content });
        await sendMessage(chatId, stripToolsOnly(followUp.rawContent) || followUp.content);
      }
    }
  } catch (error: any) {
    console.error('Error in handleMessage:', error);
    await sendMessage(chatId, `Error processing request: ${error.message || 'Unknown error'}`);
  } finally {
    processingChats.delete(chatId);
  }
}

async function poll() {
  const response = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, {
    params: {
      timeout: 25,
      offset,
    },
  });

  for (const update of response.data.result || []) {
    if (processedUpdates.has(update.update_id)) continue;
    processedUpdates.add(update.update_id);
    
    // Keep the set small
    if (processedUpdates.size > 100) {
      const first = processedUpdates.values().next().value;
      if (first !== undefined) processedUpdates.delete(first);
    }

    offset = update.update_id + 1;
    const message = update.message;
    if (!message?.text) continue;
    await handleMessage(String(message.chat.id), message.text, message.from?.username);
  }
}

async function loop() {
  console.log('Open Nexus Telegram bot is running.');
  while (true) {
    try {
      await poll();
    } catch (error: any) {
      console.error(`Telegram poll error: ${error.message || error}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

loop();
