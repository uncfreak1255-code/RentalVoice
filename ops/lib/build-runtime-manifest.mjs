#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function readJson(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function readText(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

function parseEnvFile(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function getEnvCandidates() {
  return [
    'server/.env',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
  ].filter((relativePath) => fs.existsSync(path.join(rootDir, relativePath)));
}

function resolveEnvValue(name) {
  for (const relativePath of getEnvCandidates()) {
    const parsed = parseEnvFile(readText(relativePath) || '');
    if (parsed[name]) {
      return { value: parsed[name], source: relativePath };
    }
  }
  return { value: null, source: null };
}

function parseSupabaseProjectRef(url) {
  if (!url) return null;
  const match = String(url).match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

function classifySupabaseProject(projectRef) {
  if (projectRef === 'gqnocsoouudbogwislsl') {
    return 'linked_rental_voice_test_smoke_project';
  }
  if (projectRef === 'cqbzsntmlwpsaxwnoath') {
    return 'separate_project_with_no_app_auth_users';
  }
  return projectRef ? 'unknown_project' : 'unresolved';
}

function runGit(command) {
  return execSync(command, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function detectGitState() {
  try {
    const inside = runGit('git rev-parse --is-inside-work-tree');
    if (inside !== 'true') {
      return {
        available: false,
        branch: null,
        headSha: null,
        dirty: null,
        stagedCount: 0,
        modifiedCount: 0,
        untrackedCount: 0,
      };
    }

    const branch = runGit('git rev-parse --abbrev-ref HEAD');
    const headSha = runGit('git rev-parse HEAD');
    const porcelain = runGit('git status --porcelain');
    const lines = porcelain ? porcelain.split('\n').filter(Boolean) : [];

    let stagedCount = 0;
    let modifiedCount = 0;
    let untrackedCount = 0;

    for (const line of lines) {
      const x = line[0];
      const y = line[1];
      if (x && x !== ' ' && x !== '?') stagedCount += 1;
      if (y && y !== ' ') modifiedCount += 1;
      if (x === '?' && y === '?') untrackedCount += 1;
    }

    return {
      available: true,
      branch,
      headSha,
      dirty: lines.length > 0,
      stagedCount,
      modifiedCount,
      untrackedCount,
    };
  } catch {
    return {
      available: false,
      branch: null,
      headSha: null,
      dirty: null,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
    };
  }
}

const appJson = readJson('app.json');
const easJson = readJson('eas.json');
const configText = readText('src/lib/config.ts') || '';
const serverSupabase = resolveEnvValue('SUPABASE_URL');
const clientSupabase = resolveEnvValue('EXPO_PUBLIC_SUPABASE_URL');
const supabaseUrl = serverSupabase.value || clientSupabase.value || null;
const supabaseProjectRef = parseSupabaseProjectRef(supabaseUrl);
const expoConfig = appJson?.expo || {};
const easProjectId = expoConfig?.extra?.eas?.projectId || null;

const manifest = {
  canonicalSource: 'local_workspace',
  githubCanonical: false,
  gitPromotionPending: true,
  protectedModeIntent: 'foundation_first_personal_mode_freeze',
  currentAppMode: process.env.EXPO_PUBLIC_APP_MODE || 'personal',
  configDefaultAppMode: configText.includes("|| 'personal'") ? 'personal' : null,
  hostawayFirstUxPreserved: true,
  visibleAuthUx: 'hostaway_account_id_and_api_key_only',
  detectedEnvFiles: getEnvCandidates(),
  workspace: {
    rootDir,
  },
  git: detectGitState(),
  supabase: {
    urlSource: serverSupabase.source || clientSupabase.source,
    projectRef: supabaseProjectRef,
    classification: classifySupabaseProject(supabaseProjectRef),
    realFounderEnvironmentResolved: false,
    knownProjects: [
      {
        projectRef: 'gqnocsoouudbogwislsl',
        label: 'Rental Voice',
        status: 'linked_project_with_test_smoke_app_users_only',
      },
      {
        projectRef: 'cqbzsntmlwpsaxwnoath',
        label: "uncfreak1255-code's Project",
        status: 'separate_project_with_no_app_auth_users',
      },
    ],
  },
  expo: {
    projectId: easProjectId,
    slug: expoConfig?.slug || null,
    scheme: expoConfig?.scheme || null,
    runtimeVersionPolicy: expoConfig?.runtimeVersion?.policy || null,
    updatesUrl: expoConfig?.updates?.url || null,
    channels: {
      development: easJson?.build?.development?.channel || null,
      preview: easJson?.build?.preview?.channel || null,
      production: easJson?.build?.production?.channel || null,
    },
  },
};

process.stdout.write(JSON.stringify(manifest, null, 2));
