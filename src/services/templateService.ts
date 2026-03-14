import * as vscode from 'vscode';
import { CodeTemplate } from '../models/models';

const STORAGE_KEY = 'codingtestkit.codeTemplates';

// --- State ---

let globalState: vscode.Memento;

export function initTemplateService(context: vscode.ExtensionContext): void {
  globalState = context.globalState;
}

// --- Read all templates ---

export function getTemplates(): CodeTemplate[] {
  return globalState.get<CodeTemplate[]>(STORAGE_KEY) ?? [];
}

// --- Save (add or update) a template ---

export function saveTemplate(template: CodeTemplate): void {
  const templates = getTemplates();
  const index = templates.findIndex((t) => t.name === template.name);

  if (index >= 0) {
    templates[index] = template;
  } else {
    templates.push(template);
  }

  globalState.update(STORAGE_KEY, templates);
}

// --- Delete a template by name ---

export function deleteTemplate(name: string): void {
  const templates = getTemplates().filter((t) => t.name !== name);
  globalState.update(STORAGE_KEY, templates);
}

// --- Get a single template by name ---

export function getTemplate(name: string): CodeTemplate | undefined {
  return getTemplates().find((t) => t.name === name);
}
