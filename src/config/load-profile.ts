import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import type { SpecProfile } from "../shared/types.js";

export async function loadProfile(projectRoot: string, profilePath = "docs/spec.yaml"): Promise<SpecProfile> {
  const absolutePath = resolve(projectRoot, profilePath);
  const raw = await readFile(absolutePath, "utf8");
  return YAML.parse(raw) as SpecProfile;
}
