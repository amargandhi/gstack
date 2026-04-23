import { ALL_HOST_CONFIGS } from '../../hosts/index';

/**
 * Host type — derived from host configs in hosts/*.ts.
 * Adding a new host: create hosts/myhost.ts + add to hosts/index.ts.
 * Do NOT hardcode host names here.
 */
export type Host = (typeof ALL_HOST_CONFIGS)[number]['name'];

export interface HostPaths {
  skillRoot: string;
  localSkillRoot: string;
  binDir: string;
  browseDir: string;
  designDir: string;
  makePdfDir: string;
}

/**
 * Brand substitution — swap `/gstack` suffix in host paths for a custom brand
 * (e.g. `gstack-ag` for a personal fork that coexists with Garry's gstack).
 * Set GSTACK_BRAND=<name> env var at gen-skill-docs time to activate.
 *
 * Only substitutes the trailing `/gstack` segment in the host config paths,
 * so `.claude/skills/gstack` → `.claude/skills/gstack-ag` but unrelated
 * occurrences of `gstack` elsewhere in paths are left alone.
 */
function substituteBrand(path: string): string {
  const brand = process.env.GSTACK_BRAND;
  if (!brand || brand === 'gstack') return path;
  return path.replace(/\/gstack(\/|$)/g, `/${brand}$1`);
}

/**
 * HOST_PATHS — derived from host configs.
 * Each config's globalRoot/localSkillRoot determines the path structure.
 * Non-Claude hosts use $GSTACK_ROOT env vars (set by preamble).
 */
function buildHostPaths(): Record<string, HostPaths> {
  const paths: Record<string, HostPaths> = {};
  for (const config of ALL_HOST_CONFIGS) {
    const globalRoot = substituteBrand(config.globalRoot);
    const localSkillRoot = substituteBrand(config.localSkillRoot);
    if (config.usesEnvVars) {
      paths[config.name] = {
        skillRoot: '$GSTACK_ROOT',
        localSkillRoot,
        binDir: '$GSTACK_BIN',
        browseDir: '$GSTACK_BROWSE',
        designDir: '$GSTACK_DESIGN',
        makePdfDir: '$GSTACK_MAKE_PDF',
      };
    } else {
      const root = `~/${globalRoot}`;
      paths[config.name] = {
        skillRoot: root,
        localSkillRoot,
        binDir: `${root}/bin`,
        browseDir: `${root}/browse/dist`,
        designDir: `${root}/design/dist`,
        makePdfDir: `${root}/make-pdf/dist`,
      };
    }
  }
  return paths;
}

export const HOST_PATHS: Record<string, HostPaths> = buildHostPaths();

import type { Model } from '../models';
export type { Model } from '../models';

export interface TemplateContext {
  skillName: string;
  tmplPath: string;
  benefitsFrom?: string[];
  host: Host;
  paths: HostPaths;
  preambleTier?: number;  // 1-4, controls which preamble sections are included
  model?: Model;  // model family for behavioral overlay. Omitted/undefined → no overlay.
}

/** Resolver function signature. args is populated for parameterized placeholders like {{INVOKE_SKILL:name}}. */
export type ResolverFn = (ctx: TemplateContext, args?: string[]) => string;
