import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentFile = fileURLToPath(import.meta.url);
export const projectRoot = resolve(dirname(currentFile), "..", "..");
