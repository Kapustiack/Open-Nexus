#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { chatWithNexus } from '../shared/nexus-agent';
import { executeTools } from '../shared/local-tool-executor';
import { fetchProviderModels, resolveActiveProvider } from '../shared/provider-service';
import { getDefaultConfigPath, loadSharedConfig, saveSharedConfig, ProviderId, DEFAULT_CONFIG } from '../shared/config-store';
import { checkForUpdates } from '../shared/updater';

type HistoryMessage = { role: 'user' | 'assistant' | 'system'; content: string };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const config = loadSharedConfig();
let workspaceRoot = config.cliWorkspace && fs.existsSync(config.cliWorkspace) ? config.cliWorkspace : process.cwd();
const knownFiles = new Set<string>();
const history: HistoryMessage[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'nexus> ',
});

async function main() {
  // await checkForUpdates(true); // Check silently first, but it will print if update found
  await printHeader();
  rl.prompt();
}

async function printHeader() {
  const activeProvider = await resolveActiveProvider(config);
  console.log('Open Nexus Terminal');
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(`Provider:  ${activeProvider.toUpperCase()} ${activeProvider === config.selectedProvider ? '' : '(Auto-Discovered)'}`);
  console.log('Type /help for commands.\n');
}

function printDivider(label?: string) {
  const line = '='.repeat(60);
  console.log(label ? `\n${line}\n${label}\n${line}` : `\n${line}`);
}

function normalizeRelative(targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.join(workspaceRoot, targetPath);
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function confirm(question: string): Promise<boolean> {
  const answer = (await ask(`${question} [y/N] `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

function maskSecret(value: string) {
  if (!value) return '(not set)';
  if (value.length <= 6) return '******';
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

async function handleSlashCommand(input: string): Promise<boolean> {
  const [command, ...rest] = input.trim().split(' ');
  const value = rest.join(' ').trim();

  switch (command) {
    case '/help':
      console.log('/help - show commands');
      console.log('/settings - show current config summary');
      console.log('/providers - list supported providers');
      console.log('/provider <name> - switch provider');
      console.log('/model <name> - set model for current provider');
      console.log('/apikey <provider> <key> - save API key');
      console.log('/workspace <path> - set active workspace');
      console.log('/jailbreak <on|off> - toggle workspace boundary restriction');
      console.log('/autodiscovery <on|off> - toggle automatic local AI detection');
      console.log('/pwd - print current workspace');
      console.log('/files - list workspace files');
      console.log('/read <path> - read a file into terminal and memory');
      console.log('/remembered - list files already read in this chat');
      console.log('/history - show recent chat turns');
      console.log('/clear - clear terminal screen');
      console.log('/configpath - show config file path');
      console.log('/clearconfig - reset all settings to defaults');
      console.log('/models - fetch models for current provider');
      console.log('/telegram <toggle|token|allow|terminal|clear> - configure telegram bot');
      console.log('/exit - quit terminal mode');
      return true;

    case '/settings': {
      const activeProviderId = await resolveActiveProvider(config);
      const activeSettings = config.providers[activeProviderId];
      printDivider('ACTIVE STATUS');
      console.log(`Active Provider: ${activeProviderId.toUpperCase()} ${activeProviderId === config.selectedProvider ? '(Manual Selection)' : '(Auto-Discovered)'}`);
      console.log(`Active Model:    ${activeSettings.model || '(none)'}`);
      console.log(`Workspace:       ${workspaceRoot}`);
      console.log(`Auto-Discovery:  ${config.autoDiscovery ? 'ON' : 'OFF'}`);
      console.log(`Jailbreak:       ${config.jailbreak ? 'ON' : 'OFF'}`);
      console.log(`Telegram Bot:    ${config.telegram.enabled ? 'ON' : 'OFF'} (${config.telegram.botToken ? 'Token set' : 'No token'})`);
      if (config.telegram.enabled) {
        console.log(`   Allowed IDs:  ${config.telegram.allowedChatIds.join(', ') || '(all)'}`);
        console.log(`   Terminal:     ${config.telegram.allowTerminalCommands ? 'ALLOWED' : 'BLOCKED'}`);
      }
      
      printDivider('PROVIDER CONFIGURATIONS');
      for (const [provider, settings] of Object.entries(config.providers)) {
        const isSelected = provider === config.selectedProvider;
        const isActive = provider === activeProviderId;
        const marker = isActive ? '>>' : (isSelected ? ' >' : '  ');
        console.log(`${marker} ${provider.padEnd(12)}: model=${(settings.model || '(none)').padEnd(20)} key=${maskSecret(settings.apiKey)}`);
      }
      return true;
    }

    case '/providers':
      console.log(Object.keys(config.providers).join('\n'));
      return true;

    case '/provider':
      if (!value || !(value in config.providers)) {
        console.log(`Valid providers: ${Object.keys(config.providers).join(', ')}`);
        return true;
      }
      config.selectedProvider = value as ProviderId;
      saveSharedConfig(config);
      console.log(`Provider set to ${config.selectedProvider}.`);
      return true;

    case '/model':
      if (!value) {
        console.log('Usage: /model <model-name>');
        return true;
      }
      config.providers[config.selectedProvider].model = value;
      saveSharedConfig(config);
      console.log(`Model set to ${value}.`);
      return true;

    case '/apikey': {
      const [provider, ...keyParts] = rest;
      const apiKey = keyParts.join(' ').trim();
      if (!provider || !(provider in config.providers) || !apiKey) {
        console.log('Usage: /apikey <provider> <api-key>');
        return true;
      }
      config.providers[provider as ProviderId].apiKey = apiKey;
      config.providers[provider as ProviderId].enabled = true;
      saveSharedConfig(config);
      console.log(`Saved API key for ${provider}.`);
      return true;
    }

    case '/workspace':
      if (!value || !fs.existsSync(value)) {
        console.log('Usage: /workspace <existing-path>');
        return true;
      }
      workspaceRoot = path.resolve(value);
      config.cliWorkspace = workspaceRoot;
      saveSharedConfig(config);
      console.log(`Workspace set to ${workspaceRoot}.`);
      return true;
    
    case '/autodiscovery':
      if (value === 'on' || value === 'true') {
        config.autoDiscovery = true;
      } else if (value === 'off' || value === 'false') {
        config.autoDiscovery = false;
      } else {
        console.log('Usage: /autodiscovery <on|off>');
        return true;
      }
      saveSharedConfig(config);
      console.log(`Auto Discovery turned ${config.autoDiscovery ? 'ON' : 'OFF'}.`);
      return true;

    case '/jailbreak':
      if (value === 'on' || value === 'true') {
        config.jailbreak = true;
      } else if (value === 'off' || value === 'false') {
        config.jailbreak = false;
      } else {
        console.log('Usage: /jailbreak <on|off>');
        return true;
      }
      saveSharedConfig(config);
      console.log(`Jailbreak mode turned ${config.jailbreak ? 'ON' : 'OFF'}.`);
      return true;

    case '/telegram': {
      const [sub, ...args] = rest;
      const subValue = args.join(' ').trim();
      
      if (sub === 'toggle') {
        if (subValue === 'on' || subValue === 'true') config.telegram.enabled = true;
        else if (subValue === 'off' || subValue === 'false') config.telegram.enabled = false;
        else { console.log('Usage: /telegram toggle <on|off>'); return true; }
      } else if (sub === 'token') {
        if (!subValue) { console.log('Usage: /telegram token <bot-token>'); return true; }
        config.telegram.botToken = subValue;
        config.telegram.enabled = true;
      } else if (sub === 'allow') {
        config.telegram.allowedChatIds = subValue.split(',').map(s => s.trim()).filter(s => !!s);
      } else if (sub === 'terminal') {
        if (subValue === 'on' || subValue === 'true') config.telegram.allowTerminalCommands = true;
        else if (subValue === 'off' || subValue === 'false') config.telegram.allowTerminalCommands = false;
        else { console.log('Usage: /telegram terminal <on|off>'); return true; }
      } else if (sub === 'clear') {
        config.telegram = { enabled: false, botToken: '', allowedChatIds: [], allowTerminalCommands: false };
      } else {
        console.log('Usage: /telegram <toggle|token|allow|terminal|clear>');
        return true;
      }
      
      saveSharedConfig(config);
      console.log('Telegram configuration updated.');
      return true;
    }

    case '/pwd':
      console.log(workspaceRoot);
      return true;

    case '/files': {
      const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true })
        .filter((entry) => entry.name !== 'node_modules' && !entry.name.startsWith('.git'))
        .map((entry) => `${entry.isDirectory() ? 'DIR ' : 'FILE'} ${entry.name}`);
      console.log(entries.length ? entries.join('\n') : '(workspace empty)');
      return true;
    }

    case '/read': {
      if (!value) {
        console.log('Usage: /read <path>');
        return true;
      }
      const fullPath = normalizeRelative(value);
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        console.log(`File not found: ${fullPath}`);
        return true;
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      knownFiles.add(value);
      knownFiles.add(fullPath);
      printDivider(`READ ${fullPath}`);
      console.log(content);
      history.push({ role: 'user', content: `[MANUAL FILE READ: ${fullPath}]\n${content}` });
      return true;
    }

    case '/remembered':
      console.log(Array.from(knownFiles).join('\n') || '(none)');
      return true;

    case '/history': {
      const recent = history.slice(-12);
      if (!recent.length) {
        console.log('(no history yet)');
        return true;
      }
      for (const item of recent) {
        printDivider(item.role.toUpperCase());
        console.log(item.content);
      }
      return true;
    }

    case '/clear':
      console.clear();
      await printHeader();
      return true;

    case '/configpath':
      console.log(getDefaultConfigPath());
      return true;

    case '/models': {
      const models = await fetchProviderModels(config, config.selectedProvider);
      console.log(models.length ? models.join('\n') : 'No models found or provider does not expose model listing.');
      return true;
    }

    case '/clearconfig':
      if (await confirm('Are you sure you want to reset all settings to defaults? This will erase all API keys.')) {
        Object.assign(config, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
        saveSharedConfig(config);
        console.log('Configuration reset to defaults.');
      }
      return true;

    case '/exit':
      rl.close();
      return true;

    default:
      return false;
  }
}

async function processUserMessage(input: string, depth = 0): Promise<void> {
  history.push({ role: 'user', content: input });
  const response = await chatWithNexus(history, workspaceRoot, config);
  printDivider(`NEXUS (${response.provider})`);
  console.log(response.content);
  history.push({ role: 'assistant', content: response.content });

  if (response.tools.length && depth < 5) {
    printDivider('TOOL EXECUTION');
    const toolResults = await executeTools(response.tools, {
      workspaceRoot,
      knownFiles,
      allowTerminal: true,
      recentMessages: history.map((message) => message.content),
      requestApproval: confirm,
      jailbreak: config.jailbreak,
    });

    if (toolResults) {
      console.log(toolResults);
      await sleep(1000);
      
      const isFailure = /\[COMMAND EXIT [^0]\]|\[TOOL ERROR:/.test(toolResults);
      const statusInfo = isFailure 
        ? "FAILURE: The command failed or returned an error. Analyze the logs and provide a fix." 
        : "SUCCESS: The command finished. Briefly explain what happened.";

      const feedback = `### TERMINAL FEEDBACK REPORT\n**SYSTEM STATUS**: ${statusInfo}\n\n**LOGS**:\n${toolResults}\n\n**TASK**: Explain the outcome. If it failed, fix the error. DO NOT output technical tags like [SYSTEM_STATUS].`;
      
      await processUserMessage(feedback, depth + 1);
    }
  }
}

main();

rl.on('line', async (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }

  try {
    const handled = input.startsWith('/') ? await handleSlashCommand(input) : false;
    if (!handled) {
      await processUserMessage(input);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message || error}`);
  }

  rl.prompt();
});

rl.on('close', () => {
  console.log('\nNexus terminal closed.');
  process.exit(0);
});
