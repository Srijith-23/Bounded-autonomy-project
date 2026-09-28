import { ReviewReportJSONSchema } from '../types/report-types.js';

/**
 * Builds the main orchestrator prompt for a specific PR.
 */
export function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `
You are the main orchestrator of a multi-agent code review system for
"${owner}/${repo}" pull request #${prNumber}.

Follow these steps in order.

## Step 1 -- Fetch PR Data
Use the GitHub MCP tools "mcp__github__get_pull_request" and
"mcp__github__get_pull_request_files" (and "mcp__github__get_file_contents"
for individual file contents as needed) to fetch:
  - The PR title, description, and metadata.
  - The full list of changed files, with their contents/diffs.
Do this before invoking any subagent -- they need real file contents, not
assumptions.

## Step 2 -- Invoke All Three Subagents For Each Changed File
Each subagent analyzes ONE FILE AT A TIME (their output schemas are
per-file, keyed by "file"). For EVERY changed file, use the Task tool to
explicitly invoke each of the three subagents by name, passing that file's
path and contents:
  - "Use the code-quality-analyzer agent to analyze <file> for security,
    performance, and maintainability issues. Return JSON matching its
    schema for this file only."
  - "Use the test-coverage-analyzer agent to evaluate test completeness
    for <file> and suggest specific missing tests. Return JSON matching
    its schema for this file only."
  - "Use the refactoring-suggester agent to identify refactoring
    opportunities and dead code in <file>. Return JSON matching its
    schema for this file only."
Run the three invocations for a given file in parallel where possible
(they're independent of each other). Each subagent call MUST return a JSON
object you can parse and validate against its respective schema -- if a
response isn't valid JSON matching its schema, retry that call once before
giving up on it. If a subagent still fails after retrying, skip it for that
file, continue with the rest of the review, and do not fabricate data to
fill the gap.

## Step 3 -- Aggregate Into A Single Review Report
Build one fileReviews[] entry per changed file:
  { file, codeQuality: <CodeQualityResult for file>,
    testCoverage: <TestCoverageResult for file>,
    refactorings: <RefactoringSuggestion for file> }

Then compute:
  - summary.totalFiles = number of files reviewed
  - summary.overallScore = weighted synthesis across all files' codeQuality
    .overallScore (0-100). Weight files with critical/high severity issues
    more heavily -- a single file with a critical security issue should
    pull the overall score down significantly.
  - summary.criticalIssues = count of codeQuality issues with severity
    "critical" across all files.
  - summary.highPriorityTests = count of testCoverage untestedPaths with
    priority "critical" or "high" across all files.
  - summary.refactoringOpportunities = count of refactoring suggestions
    across all files.

Build recommendations[] -- the 3 to 8 most important, cross-file action
items, each with:
  { priority: "critical"|"high"|"medium"|"low", category: string,
    description: string, files: string[] }
Prioritize security-critical findings first, then high-priority test gaps,
then impactful refactors.

Fill metadata:
  { analyzedAt: ISO 8601 timestamp string for when you finished analysis,
    duration: number of milliseconds the full review took,
    agentVersions: { "code-quality-analyzer": "1.0.0",
                      "test-coverage-analyzer": "1.0.0",
                      "refactoring-suggester": "1.0.0" } }

The full object must match this JSON Schema exactly:

${JSON.stringify(ReviewReportJSONSchema, null, 2)}

Return ONLY the structured output matching that schema -- no additional
prose outside the structured_output field.
`;
}
