import * as vscode from 'vscode';
import { CodeTemplate } from '../models/models';

const STORAGE_KEY = 'codingtestkit.codeTemplates';
// Maps "SOURCE:LANGUAGE" (e.g. "CODEFORCES:JAVA") to a template name that
// should seed new solution files for that platform+language combination.
const DEFAULTS_KEY = 'codingtestkit.defaultTemplates';

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

  // Drop any platform-default mappings that pointed at the deleted template
  const defaults = getDefaultTemplateMap();
  const cleaned = Object.fromEntries(
    Object.entries(defaults).filter(([, tmplName]) => tmplName !== name),
  );
  if (Object.keys(cleaned).length !== Object.keys(defaults).length) {
    globalState.update(DEFAULTS_KEY, cleaned);
  }
}

// --- Get a single template by name ---

export function getTemplate(name: string): CodeTemplate | undefined {
  return getTemplates().find((t) => t.name === name);
}

// --- Platform default templates ---

export function getDefaultTemplateMap(): Record<string, string> {
  return globalState.get<Record<string, string>>(DEFAULTS_KEY) ?? {};
}

// Pass name=null to clear the default for that platform+language.
export function setDefaultTemplate(source: string, language: string, name: string | null): void {
  const defaults = getDefaultTemplateMap();
  const key = `${source}:${language}`;
  if (name) {
    defaults[key] = name;
  } else {
    delete defaults[key];
  }
  globalState.update(DEFAULTS_KEY, defaults);
}

export function getDefaultTemplateFor(source: string, language: string): CodeTemplate | undefined {
  const name = getDefaultTemplateMap()[`${source}:${language}`];
  return name ? getTemplate(name) : undefined;
}
