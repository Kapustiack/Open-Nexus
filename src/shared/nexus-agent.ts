import * as fs from 'fs';
import * as path from 'path';
import { BrainOrchestrator } from '../main/brain/CommandOrchestrator';
import { SYSTEM_INTELLIGENCE } from '../main/brain/AI_Understanding/Intelligence';
import { AppConfig, loadSharedConfig } from './config-store';
import { chatWithProvider, ChatMessage, resolveActiveProvider } from './provider-service';

export interface NexusResponse {
  content: string;
  rawContent: string;
  tools: any[];
  provider: string;
}

function buildAutoFileContext(messages: ChatMessage[], workspaceRoot: string): ChatMessage[] {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  const mentionedPaths = Array.from(new Set(latestUserMessage.match(/[A-Za-z0-9_./\\-]+\.[A-Za-z0-9_]+/g) || []));
  const contextMessages: ChatMessage[] = [];

  for (const mentionedPath of mentionedPaths.slice(0, 3)) {
    const fullPath = path.isAbsolute(mentionedPath)
      ? path.normalize(mentionedPath)
      : path.normalize(path.join(workspaceRoot, mentionedPath));

    try {
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (!content.trim()) continue;

      contextMessages.push({
        role: 'system',
        content: `### AUTO FILE CONTEXT: ${mentionedPath}\nThis file currently exists in the active workspace. Use this exact content for precise edits.\n${content.slice(0, 12000)}`,
      });
    } catch {
    }
  }

  return contextMessages;
}

export async function chatWithNexus(messages: ChatMessage[], workspaceRoot: string, config?: AppConfig): Promise<NexusResponse> {
  const activeConfig = config || loadSharedConfig();
  const provider = await resolveActiveProvider(activeConfig);
  const autoFileContext = buildAutoFileContext(messages, workspaceRoot);

  const dynamicIntelligence = `
${SYSTEM_INTELLIGENCE}

### CURRENT ENVIRONMENT CONTEXT:
- ACTIVE WORKSPACE: ${workspaceRoot || 'Not selected'}
- OS: Windows
- MODE: Autonomous Recursive Orchestration

GUIDELINES:
- If you need to inspect the workspace first, use <list_files /> and then <read_file path="..." />.
- Never invent file content. Read before editing.
- Keep user-facing narration concise and natural. Put code and technical payloads only in tools or [[CODE_BLOCK]] blocks.
- If you prepare file edits, explain the goal briefly and let the diff preview show the exact change.
- Prefer native workspace tools for files and folders instead of terminal commands whenever possible.
`;

  const limitedHistory = messages.slice(-15);
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: dynamicIntelligence },
    ...buildAutoFileContext(limitedHistory, workspaceRoot),
    ...limitedHistory,
  ];

  try {
    const rawContent = await chatWithProvider(activeConfig, provider, fullMessages);
    const tools = BrainOrchestrator.parseTools(rawContent);
    const content = BrainOrchestrator.stripToolMarkup(rawContent) || BrainOrchestrator.summarizeTools(tools) || 'Action prepared.';
    return { content, rawContent, tools, provider };
  } catch (error: any) {
    const message = `System Error: Request Failed: ${error.message || error}`;
    return { content: message, rawContent: message, tools: [], provider };
  }
}
