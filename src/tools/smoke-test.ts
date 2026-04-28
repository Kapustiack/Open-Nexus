import * as fs from 'fs';
import * as path from 'path';
import { chatWithNexus } from '../shared/nexus-agent';
import { executeTools } from '../shared/local-tool-executor';
import { loadSharedConfig } from '../shared/config-store';

async function main() {
  const workspaceRoot = path.resolve(process.argv[2] || path.join(process.cwd(), 'tmp_cli_test'));
  if (fs.existsSync(workspaceRoot)) {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const samplePath = path.join(workspaceRoot, 'sample.txt');
  fs.writeFileSync(samplePath, 'alpha\nbeta', 'utf-8');
  const helloPath = path.join(workspaceRoot, 'hello.py');

  const config = loadSharedConfig();
  config.selectedProvider = 'lmstudio';
  config.providers.lmstudio.baseUrl = 'http://127.0.0.1:1234';
  config.providers.lmstudio.model = config.providers.lmstudio.model || 'qwen coder 2.5 uncensored';

  const knownFiles = new Set<string>();
  const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  const prompts = [
    'List files, read sample.txt, add a new third line "gamma" to sample.txt, create hello.py with print("hi from nexus"), run hello.py in the terminal, then delete hello.py. Use Nexus file tools for workspace changes and use terminal only for running the file.',
    'Read sample.txt and remove only the line "beta". Keep the rest of the file intact. Use partial file editing, not full replacement.',
  ];

  for (const prompt of prompts) {
    history.push({ role: 'user', content: prompt });

    for (let turn = 1; turn <= 6; turn++) {
      const response = await chatWithNexus(history, workspaceRoot, config);
      console.log(`TURN ${turn} RESPONSE:`);
      console.log(response.content);
      console.log(`TURN ${turn} TOOLS:`, JSON.stringify(response.tools, null, 2));

      history.push({ role: 'assistant', content: response.content });
      if (!response.tools.length) break;

      const toolResults = await executeTools(response.tools, {
        workspaceRoot,
        knownFiles,
        allowTerminal: true,
        recentMessages: history.map((message) => message.content),
        requestApproval: async () => true,
      });

      console.log(`TURN ${turn} TOOL RESULTS:`);
      console.log(toolResults);
      if (!toolResults.trim()) break;

      history.push({ role: 'user', content: `[SYSTEM: TOOL_RESULTS]\n${toolResults}` });
    }
  }

  const finalSample = fs.readFileSync(samplePath, 'utf-8');
  console.log('FINAL sample.txt:');
  console.log(finalSample);
  console.log('hello.py exists:', fs.existsSync(helloPath));
  console.log('sample has gamma:', finalSample.includes('gamma'));
  console.log('sample removed beta:', !finalSample.includes('beta'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
