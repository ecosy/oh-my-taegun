const runIdElement = document.querySelector("#run-id");
const phaseElement = document.querySelector("#phase");
const currentStageElement = document.querySelector("#current-stage");
const repoPathElement = document.querySelector("#repo-path");
const modelPolicyElement = document.querySelector("#model-policy");
const currentWorkUnitElement = document.querySelector("#current-work-unit");
const validationElement = document.querySelector("#validation");
const requirementsElement = document.querySelector("#requirements");
const eventsElement = document.querySelector("#events");
const changedFilesElement = document.querySelector("#changed-files");
const replayHintsElement = document.querySelector("#replay-hints");
const artifactsElement = document.querySelector("#artifacts");
const warningsElement = document.querySelector("#warnings");

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "n/a";
  }
  if (typeof value === "boolean") {
    return value ? "pass" : "fail";
  }
  return String(value);
}

function badge(status) {
  const normalized = String(status || "pending").toLowerCase();
  const tone = ["validated", "completed", "pass"].includes(normalized)
    ? "good"
    : ["blocked", "fail"].includes(normalized)
      ? "bad"
      : normalized === "active" || normalized === "changed" || normalized === "execute"
        ? "warn"
        : "neutral";
  return `<span class="badge badge-${tone}">${String(status || "unknown")}</span>`;
}

function renderKvGrid(container, entries) {
  container.innerHTML = entries
    .map(([label, value]) => `<dt>${label}</dt><dd>${formatValue(value)}</dd>`)
    .join("");
}

function renderList(container, rows, emptyText) {
  if (!rows.length) {
    container.innerHTML = `<div class="stacked-empty">${emptyText}</div>`;
    return;
  }
  container.innerHTML = rows.join("");
}

function render(snapshot) {
  runIdElement.textContent = snapshot.runId || "No run detected";
  phaseElement.innerHTML = badge(snapshot.phase);
  currentStageElement.textContent = snapshot.currentStage || "n/a";
  repoPathElement.textContent = snapshot.repoPath;

  renderKvGrid(modelPolicyElement, [
    ["Surveyed", snapshot.modelPolicy?.surveyedModels ?? []],
    ["Approved", snapshot.modelPolicy?.approvedModels ?? []],
    ["Design", snapshot.modelPolicy?.defaultDesignModel],
    ["Execution", snapshot.modelPolicy?.defaultExecutionModel],
    ["Verifier", snapshot.modelPolicy?.defaultVerifierModel],
    ["Budget", snapshot.modelPolicy?.workUnitBudgetProfile],
  ]);

  currentWorkUnitElement.innerHTML = snapshot.currentWorkUnit
    ? `
      <div class="work-unit-card">
        <div class="work-unit-title">${snapshot.currentWorkUnit.workUnitId}</div>
        <div class="work-unit-meta">requirements: ${formatValue(snapshot.currentWorkUnit.requirementIds)}</div>
        <div class="work-unit-meta">acceptance: ${formatValue(snapshot.currentWorkUnit.acceptanceIds)}</div>
        <div class="work-unit-meta">attempt: ${formatValue(snapshot.currentWorkUnit.attempt)}</div>
      </div>
    `
    : `<div class="stacked-empty">No work unit yet.</div>`;

  renderKvGrid(validationElement, [
    ["Feature", snapshot.validation.featurePassed],
    ["Regression", snapshot.validation.regressionPassed],
    ["Delivery", snapshot.validation.deliveryStatus],
    ["Readiness", snapshot.validation.deliveryReadiness],
    ["Completed Stages", snapshot.completedStages],
  ]);

  renderList(
    requirementsElement,
    snapshot.requirementStatuses.map(
      (item) => `
        <div class="requirement-card">
          <div>
            <strong>${item.requirementId}</strong>
            <p>${item.title}</p>
          </div>
          ${badge(item.status)}
        </div>
      `,
    ),
    "No requirements found.",
  );

  renderList(
    eventsElement,
    snapshot.latestEvents.map(
      (event) => `
        <div class="event-row">
          <div class="event-meta">
            <span>${event.timestamp}</span>
            ${badge(event.phase)}
          </div>
          <strong>${event.type}</strong>
          <pre>${JSON.stringify(event.payload, null, 2)}</pre>
        </div>
      `,
    ),
    "No events recorded yet.",
  );

  renderList(
    changedFilesElement,
    snapshot.changedFiles.map((file) => `<code class="list-code">${file}</code>`),
    "No changed files captured yet.",
  );

  renderList(
    replayHintsElement,
    snapshot.replayHints.map(
      (hint) => `
        <div class="replay-card">
          <div class="replay-header">
            <strong>${hint.levelId}</strong>
            ${badge(hint.seed === null ? "no-seed" : `seed ${hint.seed}`)}
          </div>
          <p>${hint.title}</p>
          <code class="command-block">${hint.command}</code>
        </div>
      `,
    ),
    "No replay hints available yet.",
  );

  renderList(
    artifactsElement,
    Object.entries(snapshot.artifactPaths).map(
      ([label, value]) => `
        <div class="artifact-row">
          <strong>${label}</strong>
          <code class="list-code">${formatValue(value)}</code>
        </div>
      `,
    ),
    "No artifact paths available.",
  );

  renderList(
    warningsElement,
    snapshot.warnings.map((warning) => `<div class="warning-row">${warning}</div>`),
    "No warnings.",
  );
}

async function poll() {
  try {
    const params = new URLSearchParams(window.location.search);
    const response = await fetch(`/api/snapshot?${params.toString()}`);
    const snapshot = await response.json();
    render(snapshot);
  } catch (error) {
    render({
      repoPath: "unknown",
      runId: null,
      phase: "blocked",
      currentStage: null,
      completedStages: [],
      modelPolicy: null,
      currentWorkUnit: null,
      requirementStatuses: [],
      latestEvents: [],
      changedFiles: [],
      validation: {
        featurePassed: null,
        regressionPassed: null,
        deliveryStatus: null,
        deliveryReadiness: null,
      },
      replayHints: [],
      artifactPaths: {
        designSeed: null,
        eventLog: null,
        report: null,
        evalSummary: null,
        replaySummary: null,
      },
      warnings: [error instanceof Error ? error.message : String(error)],
    });
  }
}

void poll();
window.setInterval(() => void poll(), 1000);
