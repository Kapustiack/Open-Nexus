import { ipcMain } from 'electron';
import { loadConfig } from './config';
import { BrainOrchestrator } from './brain/CommandOrchestrator';
import { getCurrentWorkspacePath } from './workspace';
import { fetchProviderModels } from '../shared/provider-service';
import { chatWithNexus } from '../shared/nexus-agent';

ipcMain.handle('ai-chat', async (event, messages) => {
  return chatWithNexus(messages, getCurrentWorkspacePath() || 'Not selected', loadConfig());
});

ipcMain.handle('terminal-feedback', async (event, { output, history }) => {
  let statusInfo = "";
  const isSuccess = /\bSUCCESSFUL\b/i.test(output);
  const isFailure = /\bNAH\b/i.test(output);

  if (isSuccess) {
    statusInfo = "SUCCESS: The command worked. Tell the user it was successful in natural language. DO NOT copy-paste technical headers.";
  } else if (isFailure) {
    statusInfo = "FAILURE: The command failed. Tell the user it didn't work and provide a fix.";
  } else {
    statusInfo = "NEUTRAL: Check the output to see if the goal was achieved.";
  }

  const feedbackMsg = {
    role: 'user',
    content: `### TERMINAL FEEDBACK REPORT\n**SYSTEM STATUS**: ${statusInfo}\n\n**TERMINAL LOGS**:\n${output}\n\n**TASK**: Briefly explain to the user what happened in the terminal. If it was successful, mention any key details from the logs. If it failed, explain the error. NEVER output technical tags like [SYSTEM_STATUS].`
  };

  return chatWithNexus([...history, feedbackMsg], getCurrentWorkspacePath() || 'Not selected', loadConfig());
});

ipcMain.handle('fetch-models', async (event, { provider, url, apiKey }) => {
  const config = loadConfig();
  const selected = config.providers[provider as keyof typeof config.providers];
  if (selected) {
    selected.baseUrl = url;
    if (apiKey) selected.apiKey = apiKey;
  }
  return fetchProviderModels(config, provider);
});
