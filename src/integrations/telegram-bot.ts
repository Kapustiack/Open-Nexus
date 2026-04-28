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

function isAllowed(chatId: string) {
  return config.telegram.allowedChatIds.length === 0 || config.telegram.allowedChatIds.includes(chatId);
}

async function sendMessage(chatId: string, text: string) {
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
  });
}

async function handleMessage(chatId: string, text: string) {
  if (!isAllowed(chatId)) {
    await sendMessage(chatId, 'This chat is not allowed to control Open Nexus.');
    return;
  }

  const history = getHistory(chatId);
  history.push({ role: 'user', content: text });
  const workspace = config.cliWorkspace || process.cwd();
  const response = await chatWithNexus(history, workspace, config);
  history.push({ role: 'assistant', content: response.content });
  await sendMessage(chatId, response.content);

  if (response.tools.length) {
    const toolResults = await executeTools(response.tools, {
      workspaceRoot: workspace,
      knownFiles: getKnownFiles(chatId),
      allowTerminal: config.telegram.allowTerminalCommands,
    });

    if (toolResults) {
      history.push({ role: 'user', content: `[SYSTEM: TOOL_RESULTS]\n${toolResults}` });
      const followUp = await chatWithNexus(history, workspace, config);
      history.push({ role: 'assistant', content: followUp.content });
      await sendMessage(chatId, followUp.content);
    }
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
    await handleMessage(String(message.chat.id), message.text);
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
