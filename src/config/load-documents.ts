import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import YAML from "yaml";
import { loadProfile } from "./load-profile.js";
import type { DocumentSet } from "../shared/types.js";

async function readYaml<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return YAML.parse(raw) as T;
}

export async function loadDocuments(projectRoot: string, profilePath = "docs/spec.yaml"): Promise<DocumentSet> {
  const profile = await loadProfile(projectRoot, profilePath);
  const profileAbsolutePath = resolve(projectRoot, profilePath);
  const docsRoot = dirname(profileAbsolutePath);
  const source = profile.source_documents;

  return {
    projectRoot,
    docsRoot,
    profile,
    requirements: await readYaml(resolve(projectRoot, source.requirements)),
    acceptance: await readYaml(resolve(projectRoot, source.acceptance)),
    testPlan: await readYaml(resolve(projectRoot, source.test_plan)),
    taskContracts: await readYaml(resolve(projectRoot, source.task_contracts)),
    stateSchema: await readYaml(resolve(projectRoot, source.state_schema)),
    testMatrix: await readYaml(resolve(projectRoot, source.test_matrix)),
    modelContracts: source.model_contracts ? await readYaml(resolve(projectRoot, source.model_contracts)) : undefined,
    metrics: source.metrics ? await readYaml(resolve(projectRoot, source.metrics)) : undefined,
    migration: source.migration ? await readFile(resolve(projectRoot, source.migration), "utf8") : undefined,
  };
}
