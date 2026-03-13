import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "../../helpers/project-root.js";

export interface ModelFixture {
  surveyModels: string;
  approvedModels: string;
  executionModel: string;
  verifierModel: string;
  workUnitBudgetProfile?: string;
}

export async function loadModelFixture(name: string): Promise<ModelFixture> {
  return JSON.parse(
    await readFile(join(projectRoot, "tests", "v2", "fixtures", `${name}.json`), "utf8"),
  ) as ModelFixture;
}
