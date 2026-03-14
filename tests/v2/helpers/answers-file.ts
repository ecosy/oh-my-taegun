import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InterviewAnswerFile } from "../../../src/v2/types.js";

export async function writeAnswersFile(payload: InterviewAnswerFile): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "omt-v2-answers-"));
  const path = join(dir, "answers.json");
  await writeFile(path, JSON.stringify(payload, null, 2));
  return path;
}
