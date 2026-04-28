export class BrainOrchestrator {
  static normalizeToolMarkup(content: string): string {
    return content
      .replace(/\[(\/?(?:run|write_file|edit_file|diff|patch|read_file|create_directory|delete_path|list_files)\b)/g, '<$1')
      .replace(/(\/?)\](?=\s*<\/?(?:run|write_file|edit_file|diff|patch|read_file|create_directory|delete_path|list_files)|\s*$)/g, '$1>');
  }

  static stripToolMarkup(content: string): string {
    const normalized = this.normalizeToolMarkup(content);
    return normalized
      .replace(/<run>[\s\S]*?<\/run>/g, '')
      .replace(/<write_file[\s\S]*?<\/write_file>/g, '')
      .replace(/<edit_file[\s\S]*?<\/edit_file>/g, '')
      .replace(/<diff[\s\S]*?<\/diff>/g, '')
      .replace(/<patch[\s\S]*?<\/patch>/g, '')
      .replace(/<read_file\s+path="([^"]+)"\s*\/>/g, '')
      .replace(/<read_file[\s\S]*?<\/read_file>/g, '')
      .replace(/<create_directory\s+path="([^"]+)"\s*\/>/g, '')
      .replace(/<delete_path\s+path="([^"]+)"\s*\/>/g, '')
      .replace(/<list_files\s*\/>/g, '')
      .replace(/<list_files[^>]*>[\s\S]*?<\/list_files>/g, '')
      .replace(/\[\[CODE_BLOCK\]\][\s\S]*?\[\[CODE_END\]\]/g, '')
      .replace(/\[\[CODE_BLOCK\]\][\s\S]*?\[\[\/CODE_BLOCK\]\]/g, '')
      .replace(/\[\[CODE_BLOCK\]\][\s\S]*?\[\[END_CODE_BLOCK\]\]/g, '')
      .replace(/\[\[\/?CODE_BLOCK\]\]/g, '')
      .replace(/\[\[END_CODE_BLOCK\]\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  static summarizeTools(tools: any[]): string {
    if (!tools.length) return '';

    const summaries = tools.map((tool) => {
      switch (tool.type) {
        case 'terminal':
          return `Prepared terminal command: ${tool.payload}`;
        case 'write_file':
          return `Prepared file write for ${tool.payload.path}.`;
        case 'create_directory':
          return `Prepared directory creation for ${tool.payload}.`;
        case 'delete_path':
          return `Prepared delete operation for ${tool.payload}.`;
        case 'read_file':
          return `Prepared file read for ${tool.payload}.`;
        case 'list_files':
          return `Prepared workspace file listing.`;
        case 'patch':
          return `Prepared appended code changes for ${tool.payload.path}.`;
        case 'diff':
          return `Prepared surgical file edits for ${tool.payload.path}.`;
        case 'edit_file_ops':
          return `Prepared direct line edits for ${tool.payload.path}.`;
        default:
          return null;
      }
    }).filter(Boolean);

    return summaries.join('\n');
  }

  /**
   * Universal tool parser.
   * Supports:
   * <run>[cmd]</run>
   * <write_file path="[path]">[content]</write_file>
   * <create_directory path="[path]" />
   * <delete_path path="[path]" />
   * <read_file path="[path]" />
   * <list_files />
   * <edit_file path="[path]"><add_line position="3">text</add_line></edit_file>
   * <edit_file path="[path]"><remove_line position="2"></remove_line></edit_file>
   * <edit_file path="[path]"><delete_line position="2" /></edit_file>
   * <diff path="[path]">
   * <<<<<<< SEARCH
   * [old]
   * =======
   * [new]
   * >>>>>>> REPLACE
   * </diff>
   */
  static parseTools(content: string): any[] {
    const normalized = this.normalizeToolMarkup(content);
    const tools: any[] = [];

    const runMatches = normalized.matchAll(/<run>([\s\S]*?)<\/run>/g);
    for (const match of runMatches) {
      tools.push({ type: 'terminal', payload: match[1].trim() });
    }

    const writeMatches = normalized.matchAll(/<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/g);
    for (const match of writeMatches) {
      tools.push({ type: 'write_file', payload: { path: match[1], content: match[2] } });
    }

    const createDirectoryMatches = normalized.matchAll(/<create_directory\s+path="([^"]+)"\s*\/>/g);
    for (const match of createDirectoryMatches) {
      tools.push({ type: 'create_directory', payload: match[1] });
    }

    const deletePathMatches = normalized.matchAll(/<delete_path\s+path="([^"]+)"\s*\/>/g);
    for (const match of deletePathMatches) {
      tools.push({ type: 'delete_path', payload: match[1] });
    }

    const readMatches = normalized.matchAll(/<read_file\s+path="([^"]+)"\s*\/>/g);
    for (const match of readMatches) {
      tools.push({ type: 'read_file', payload: match[1] });
    }
    const readBlockMatches = normalized.matchAll(/<read_file\s+path="([^"]+)"[^>]*>[\s\S]*?<\/read_file>/g);
    for (const match of readBlockMatches) {
      tools.push({ type: 'read_file', payload: match[1] });
    }

    if (normalized.includes('<list_files />') || /<list_files(?:\s+[^>]*)?>[\s\S]*?<\/list_files>/.test(normalized)) {
      tools.push({ type: 'list_files', payload: null });
    }

    const editFileMatches = normalized.matchAll(/<edit_file\s+path="([^"]+)">([\s\S]*?)<\/edit_file>/g);
    for (const match of editFileMatches) {
      const filePath = match[1];
      const block = match[2];
      const operations: any[] = [];

      const addLineMatches = block.matchAll(/<add_line\s+position="([^"]+)">([\s\S]*?)<\/add_line>/g);
      for (const addMatch of addLineMatches) {
        operations.push({ type: 'add_line', position: parseInt(addMatch[1], 10), content: addMatch[2] });
      }

      const replaceLineMatches = block.matchAll(/<replace_line\s+position="([^"]+)">([\s\S]*?)<\/replace_line>/g);
      for (const replaceMatch of replaceLineMatches) {
        operations.push({ type: 'replace_line', position: parseInt(replaceMatch[1], 10), content: replaceMatch[2] });
      }

      const removeLineMatches = block.matchAll(/<remove_line\s+position="([^"]+)"\s*\/>/g);
      for (const removeMatch of removeLineMatches) {
        operations.push({ type: 'remove_line', position: parseInt(removeMatch[1], 10) });
      }

      const removeLineBlockMatches = block.matchAll(/<(?:remove_line|delete_line)\s+position="([^"]+)"\s*>([\s\S]*?)<\/(?:remove_line|delete_line)>/g);
      for (const removeMatch of removeLineBlockMatches) {
        operations.push({ type: 'remove_line', position: parseInt(removeMatch[1], 10) });
      }

      const deleteLineMatches = block.matchAll(/<delete_line\s+position="([^"]+)"\s*\/>/g);
      for (const deleteMatch of deleteLineMatches) {
        operations.push({ type: 'remove_line', position: parseInt(deleteMatch[1], 10) });
      }

      const appendMatches = block.matchAll(/<append>([\s\S]*?)<\/append>/g);
      for (const appendMatch of appendMatches) {
        operations.push({ type: 'append', content: appendMatch[1] });
      }

      if (operations.length > 0) {
        tools.push({ type: 'edit_file_ops', payload: { path: filePath, operations } });
      }
    }

    const patchMatches = normalized.matchAll(/<patch\s+path="([^"]+)">([\s\S]*?)<\/patch>/g);
    for (const match of patchMatches) {
      tools.push({ type: 'patch', payload: { path: match[1], content: match[2] } });
    }

    const diffMatches = normalized.matchAll(/<diff\s+path="([^"]+)">([\s\S]*?)<\/diff>/g);
    for (const match of diffMatches) {
      const path = match[1];
      const diffBlock = match[2];

      const srRegex = /<{3,}\s*SEARCH\s*\n([\s\S]*?)\n={3,}\s*\n([\s\S]*?)\n>{3,}\s*REPLACE/g;
      const srMatches = diffBlock.matchAll(srRegex);
      const changes = [];
      for (const srMatch of srMatches) {
        changes.push({ search: srMatch[1], replace: srMatch[2] });
      }

      if (changes.length > 0) {
        tools.push({ type: 'diff', payload: { path, changes } });
      }
    }

    return tools;
  }
}
