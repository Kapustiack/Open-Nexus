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
let offset = 0;

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
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
    });
  } catch (error: any) {
    console.error(`Failed to send message to ${chatId}:`, error.response?.data || error.message);
  }
}

async function handleMessage(chatId: string, text: string, username?: string) {
  if (!isAllowed(chatId, username)) {
    console.log(`Access denied for ${username || chatId}`);
    await sendMessage(chatId, 'This chat is not allowed to control Open Nexus. Use your Telegram numeric ID or @username in settings.');
    return;
  }

  console.log(`Processing message from ${username || chatId}: ${text}`);
  const history = getHistory(chatId);
  
  // Inject a system hint if history is fresh
  if (history.length === 0) {
    history.push({ 
      role: 'system', 
      content: 'You are Open Nexus, controlling this PC via Telegram. You have full access to the file system and terminal. If the user asks to open a program, run a command, or manage files, use your tools immediately. You are running in a secure, authorized environment.' 
    });
  }

  history.push({ role: 'user', content: text });
  
  try {
    const workspace = config.cliWorkspace || process.cwd();
    const response = await chatWithNexus(history, workspace, config);
    history.push({ role: 'assistant', content: response.content });
    await sendMessage(chatId, response.content);

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
        await sendMessage(chatId, followUp.content);
      }
    }
  } catch (error: any) {
    console.error('Error in handleMessage:', error);
    await sendMessage(chatId, `Error processing request: ${error.message || 'Unknown error'}`);
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
