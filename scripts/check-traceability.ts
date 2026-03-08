import { cwd } from "node:process";
import { loadDocuments } from "../src/config/load-documents.js";
import { evaluateTraceability } from "../src/validation/traceability-gate.js";

const projectRoot = cwd();
const documents = await loadDocuments(projectRoot);
const result = evaluateTraceability(documents);

if (!result.passed) {
  process.stderr.write(`${result.issues.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    JSON.stringify(
      {
        passed: true,
        mustRequirementCount: result.mustRequirementCount,
        acceptanceCount: result.acceptanceCount,
        testPlanCount: result.testPlanCount,
      },
      null,
      2,
    ) + "\n",
  );
}
