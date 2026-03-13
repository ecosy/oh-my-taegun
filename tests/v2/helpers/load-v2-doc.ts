import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { loadDocuments } from "../../../src/config/load-documents.js";
import { projectRoot } from "../../helpers/project-root.js";

export async function loadV2Yaml<T>(relativePath: string): Promise<T> {
  const raw = await readFile(join(projectRoot, relativePath), "utf8");
  return YAML.parse(raw) as T;
}

export async function loadV2Markdown(relativePath: string): Promise<string> {
  return readFile(join(projectRoot, relativePath), "utf8");
}

export async function loadV2Documents() {
  return loadDocuments(projectRoot, "docs/v2/spec.yaml");
}
