# RSOS Master Bug Audit (Discovery Only)

Date: 2026-08-06  
Scope: Discovery-only audit. No production code changes, no data model changes, no UI redesign.

## Executive Summary
A discovery-only audit was completed across automated suites, build/lint verification, runtime startup behavior, and browser interaction checks. The most severe defects are concentrated in two root-cause groups:
- Navigation wiring regression in major modules (user is trapped in Deal Analyzer view from sidebar in several tools).
- Financial logic defects in Flip/BRRRR analyzers that can produce materially incorrect investment decisions.

A pre-audit rollback checkpoint was created before any potentially destructive verification.
- Checkpoint: [checkpoints/bug-audit-20260806T011557Z/pre-audit-rollback-20260806T011557Z.tgz](checkpoints/bug-audit-20260806T011557Z/pre-audit-rollback-20260806T011557Z.tgz)

## Totals By Severity
- Critical: 3
- High: 5
- Medium: 4
- Low: 2
- Total Findings: 14

## Confirmed Bugs

### BUG-001
- Severity: Critical
- Module: Shared Navigation (Deal Analyzer, Flip Analyzer, BRRRR Analyzer, Deal Intake, Deal Intelligence)
- Title: Sidebar module navigation buttons are non-functional (no click handler)
- Reproduction Steps:
1. Open app at http://127.0.0.1:4173.
2. Enter Deal Analyzer.
3. Click sidebar buttons for Flip, BRRRR, Product Vault, Portfolio, etc.
4. Observe page heading remains Deal Analyzer.
- Expected Result: Each sidebar module button opens its module.
- Actual Result: Sidebar buttons do not route; view remains Deal Analyzer.
- Business Impact: Critical workflow blocker; prevents full module access and downstream QA/operations.
- Evidence:
  - Browser interaction audit: sidebar clicks all yielded h2 = Deal Analyzer.
  - [app/src/components/DealAnalyzer.jsx#L344](app/src/components/DealAnalyzer.jsx#L344)
  - [app/src/components/FlipAnalyzer.jsx#L273](app/src/components/FlipAnalyzer.jsx#L273)
  - [app/src/components/BrrrrAnalyzer.jsx#L356](app/src/components/BrrrrAnalyzer.jsx#L356)
  - [app/src/components/Dealintake.jsx#L316](app/src/components/Dealintake.jsx#L316)
  - [app/src/components/DealIntelligence.jsx#L868](app/src/components/DealIntelligence.jsx#L868)
- Console or Server Error: None required to reproduce.
- Suspected File(s)/Function(s): Sidebar button render blocks (no onClick wiring).
- Existed Before This Audit: Likely yes (same pattern appears in archived copies under backups/checkpoints).
- Recommended Fix Approach: Centralize sidebar route map and wire each button to currentView setters via props.
- Regression Tests Required: UI navigation integration test per module button.
- Dependencies: None.

### BUG-002
- Severity: Critical
- Module: Flip Analyzer
- Title: Best-case scenario is mathematically worse than base-case
- Reproduction Steps:
1. Open Flip Analyzer.
2. Provide any positive-input scenario.
3. Compare best/base/worst outputs.
- Expected Result: Best case should be >= base case for profit/ROI/margin; worst case <= base.
- Actual Result: Best case is forced to 95% of base; worst case 90% of base.
- Business Impact: Inverts scenario logic and can drive incorrect acquisition decisions.
- Evidence:
  - [app/src/components/FlipAnalyzer.jsx#L244](app/src/components/FlipAnalyzer.jsx#L244)
  - [app/src/components/FlipAnalyzer.jsx#L250](app/src/components/FlipAnalyzer.jsx#L250)
- Console or Server Error: None.
- Suspected File(s)/Function(s): scenarioResults useMemo in FlipAnalyzer.
- Existed Before This Audit: Likely yes (same logic pattern seen in archived variants).
- Recommended Fix Approach: Compute best/worst from sensitivity deltas in correct direction or use getScenarioValues outputs.
- Regression Tests Required: Deterministic unit tests asserting best >= base >= worst for profit, ROI, margin.
- Dependencies: BUG-001 (navigation) for broad manual UX revalidation.

### BUG-003
- Severity: Critical
- Module: BRRRR Underwriting Engine
- Title: Refinance LTV percent interpreted as whole number, clamped to 100%, inflating refinance loan
- Reproduction Steps:
1. Set ARV to 300000 and LTV input to 75.
2. Evaluate refinance loan in BRRRR path.
- Expected Result: Max loan should be 225000 at 75% LTV.
- Actual Result: Engine reads 75, clamps to 1.0, computes full-ARV loan.
- Business Impact: Materially overstates leverage and downstream return/risk outputs.
- Evidence:
  - [app/src/components/intelligenceUpgradeEngine.js#L2431](app/src/components/intelligenceUpgradeEngine.js#L2431)
  - [app/src/components/intelligenceUpgradeEngine.js#L2432](app/src/components/intelligenceUpgradeEngine.js#L2432)
- Console or Server Error: None.
- Suspected File(s)/Function(s): BRRRR calculation block in buildUnifiedUnderwritingIntelligence.
- Existed Before This Audit: Likely yes.
- Recommended Fix Approach: Normalize user percent as fraction (divide by 100 when input > 1) before clamp.
- Regression Tests Required: 75->0.75 mapping test; 0.75 remains 0.75; ARV*LTV checks.
- Dependencies: BUG-004, BUG-005.

### BUG-004
- Severity: High
- Module: BRRRR Analyzer UI
- Title: Max Loan Based on LTV displays Not Available despite valid BRRRR metrics
- Reproduction Steps:
1. Open BRRRR Analyzer with valid deal metrics.
2. Check SummaryCard for Max Loan Based on LTV.
- Expected Result: Numeric currency value.
- Actual Result: Not Available due undefined bound value.
- Business Impact: User cannot validate lender cap; underwriting confidence reduced.
- Evidence:
  - Summary reads scenarioResults.base.maxLoanBasedOnLtv
  - base object omits maxLoanBasedOnLtv in UI model
  - [app/src/components/BrrrrAnalyzer.jsx#L319](app/src/components/BrrrrAnalyzer.jsx#L319)
  - [app/src/components/BrrrrAnalyzer.jsx#L423](app/src/components/BrrrrAnalyzer.jsx#L423)
- Console or Server Error: None.
- Suspected File(s)/Function(s): scenarioResults base mapping in BrrrrAnalyzer.
- Existed Before This Audit: Likely yes.
- Recommended Fix Approach: Include maxLoanBasedOnLtv in base mapping from underwriting output.
- Regression Tests Required: UI assertion that field renders numeric with valid ARV/LTV.
- Dependencies: BUG-003.

### BUG-005
- Severity: High
- Module: BRRRR Analyzer / Underwriting Engine
- Title: Return metrics can be exaggerated by double-percent scaling
- Reproduction Steps:
1. Use BRRRR scenario with low cash invested and positive projected profit.
2. Inspect Cash-on-Cash and Return on Total Cost display.
- Expected Result: Consistent percent scale.
- Actual Result: Engine returns percentage-scale value (x100), then UI formatPercent multiplies again.
- Business Impact: Can produce extreme outputs (for example ~16876%) and mislead decisioning.
- Evidence:
  - Engine cashOnCash multiplies by 100: [app/src/components/intelligenceUpgradeEngine.js#L2484](app/src/components/intelligenceUpgradeEngine.js#L2484)
  - UI formatter multiplies by 100 again: [app/src/components/BrrrrAnalyzer.jsx#L63](app/src/components/BrrrrAnalyzer.jsx#L63)
- Console or Server Error: None.
- Suspected File(s)/Function(s): BRRRR percentage normalization/display pipeline.
- Existed Before This Audit: Likely yes.
- Recommended Fix Approach: Standardize percentage convention (fraction internally, multiply only at display).
- Regression Tests Required: Boundary tests for small denominators, zero denominators, and realistic percentage ranges.
- Dependencies: BUG-003.

### BUG-006
- Severity: High
- Module: BRRRR Analyzer
- Title: Equity Created is mapped to cashLeftInDeal, causing semantic and reporting inconsistency
- Reproduction Steps:
1. Open BRRRR Analyzer.
2. Compare Equity Created and Cash Left in Deal derivation.
- Expected Result: Equity created should be an independent measure (value-debt relation), not alias of cash left.
- Actual Result: equityCreated uses cashLeftInDeal directly.
- Business Impact: Distorts refinance evaluation and cross-module consistency.
- Evidence:
  - [app/src/components/BrrrrAnalyzer.jsx#L313](app/src/components/BrrrrAnalyzer.jsx#L313)
- Console or Server Error: None.
- Suspected File(s)/Function(s): scenarioResults base mapping.
- Existed Before This Audit: Likely yes.
- Recommended Fix Approach: Align equity definition with underwriting canonical metric.
- Regression Tests Required: Equity vs cash-left invariants across scenarios.
- Dependencies: BUG-003, BUG-005.

### BUG-007
- Severity: High
- Module: Shared Navigation
- Title: Rehab Project Tracker entry missing from major module sidebars
- Reproduction Steps:
1. Open Deal Analyzer or Flip/BRRRR/Deal Intelligence sidebars.
2. Compare entries to Command Center/global nav.
- Expected Result: Rehab Project Tracker route entry available consistently.
- Actual Result: Rehab Project Tracker absent in multiple module sidebars.
- Business Impact: Operational dead-end for rehab workflows and inconsistent UX.
- Evidence:
  - Missing in [app/src/components/DealAnalyzer.jsx#L8](app/src/components/DealAnalyzer.jsx#L8)
  - Missing in [app/src/components/FlipAnalyzer.jsx#L8](app/src/components/FlipAnalyzer.jsx#L8)
  - Missing in [app/src/components/BrrrrAnalyzer.jsx#L8](app/src/components/BrrrrAnalyzer.jsx#L8)
- Console or Server Error: None.
- Suspected File(s)/Function(s): local navigation arrays.
- Existed Before This Audit: Likely yes.
- Recommended Fix Approach: Single source-of-truth nav map across modules.
- Regression Tests Required: Snapshot/DOM nav presence tests.
- Dependencies: BUG-001.

### BUG-008
- Severity: High
- Module: Startup / Operations
- Title: Backend startup collision and stale status reporting
- Reproduction Steps:
1. Run node server/index.js while 3001 is occupied.
2. Observe EADDRINUSE crash.
3. Run npm run rsos:status.
- Expected Result: Graceful detection and accurate running status.
- Actual Result: EADDRINUSE unhandled boot crash; status can show running false with stale pid while listener exists.
- Business Impact: Dev/prod operations confusion, unreliable lifecycle scripts.
- Evidence:
  - Runtime: listen EADDRINUSE 127.0.0.1:3001
  - Listener present: lsof shows node PID on 3001
  - Status script output inconsistent with active listener
  - [scripts/start-rsos.mjs#L232](scripts/start-rsos.mjs#L232)
- Console or Server Error: Error: listen EADDRINUSE: address already in use 127.0.0.1:3001.
- Suspected File(s)/Function(s): status derives from pid files, not listener/health reconciliation.
- Existed Before This Audit: Yes (reproduced in this audit session repeatedly).
- Recommended Fix Approach: Reconcile pid + port + health in status path; improve preflight conflict handling.
- Regression Tests Required: status correctness with stale pid, live listener, and conflict scenarios.
- Dependencies: None.

### BUG-009
- Severity: Medium
- Module: Authentication/Logout
- Title: Logout action appears non-functional in active UI flow
- Reproduction Steps:
1. Open Deal Intake.
2. Click LOG OUT.
- Expected Result: Session termination and redirect/state change (if auth enabled).
- Actual Result: No URL/view/session-visible change.
- Business Impact: Potential security/session UX issue.
- Evidence:
  - Click captured; URL remains root and page remains in app shell.
- Console or Server Error: None.
- Suspected File(s)/Function(s): module-local logout buttons without auth handlers.
- Existed Before This Audit: Likely yes.
- Recommended Fix Approach: Wire to auth-state service or disable/hide if auth not active.
- Regression Tests Required: logout action integration test for authenticated and unauthenticated modes.
- Dependencies: BUG-001.

### BUG-010
- Severity: Medium
- Module: Portfolio Intelligence
- Title: Duplicate object key causes silent overwrite (supportedArv)
- Reproduction Steps:
1. Build property intelligence object.
2. Inspect returned object keys.
- Expected Result: Unique keys, deterministic mapping.
- Actual Result: supportedArv defined twice; earlier value overwritten silently.
- Business Impact: Data drift risk in portfolio summaries and downstream dashboards.
- Evidence:
  - [app/src/components/portfolioIntelligence.js#L548](app/src/components/portfolioIntelligence.js#L548)
  - [app/src/components/portfolioIntelligence.js#L563](app/src/components/portfolioIntelligence.js#L563)
- Console or Server Error: Lint no-dupe-keys.
- Suspected File(s)/Function(s): property enrichment return object.
- Existed Before This Audit: Yes (lint reproducible).
- Recommended Fix Approach: Remove duplicate key and assert schema in tests.
- Regression Tests Required: object-shape tests and lint gate.
- Dependencies: None.

### BUG-011
- Severity: Medium
- Module: Operations Integration
- Title: Duplicate object key monitoringStatus causes silent overwrite
- Reproduction Steps:
1. Build operations integration payload.
2. Inspect object literal keys.
- Expected Result: Single monitoringStatus definition.
- Actual Result: monitoringStatus appears twice; one overwrites the other.
- Business Impact: Incorrect operations dashboard status projection.
- Evidence:
  - [app/src/utils/operationsIntegration.js#L106](app/src/utils/operationsIntegration.js#L106)
  - [app/src/utils/operationsIntegration.js#L129](app/src/utils/operationsIntegration.js#L129)
- Console or Server Error: Lint no-dupe-keys.
- Suspected File(s)/Function(s): buildBackendHealthSummary return payload.
- Existed Before This Audit: Yes (lint reproducible).
- Recommended Fix Approach: Deduplicate keys and add object-contract tests.
- Regression Tests Required: operations summary field integrity test.
- Dependencies: None.

### BUG-012
- Severity: Medium
- Module: Frontend Quality Gate
- Title: Lint gate fails with 717 problems (708 errors, 9 warnings)
- Reproduction Steps:
1. Run npm run lint in app.
- Expected Result: Clean lint pass for production-quality signal.
- Actual Result: Large failure set (unused vars, useless assignments, duplicate keys, constant expression issues).
- Business Impact: Hidden defects and maintainability risk; increased regression probability.
- Evidence:
  - Logged artifact: [checkpoints/bug-audit-20260806T011557Z/app-lint.log](checkpoints/bug-audit-20260806T011557Z/app-lint.log)
- Console or Server Error: ESLint errors.
- Suspected File(s)/Function(s): Multiple files across app/src/components and app/src/utils.
- Existed Before This Audit: Yes.
- Recommended Fix Approach: staged lint remediation by root-cause clusters, not one-off suppressions.
- Regression Tests Required: lint as required CI gate.
- Dependencies: None.

### BUG-013
- Severity: Low
- Module: Comp Database
- Title: Strongest Comp label may render undefined (C) when compAddress missing
- Reproduction Steps:
1. Have strongest comparable with missing compAddress and grade C.
2. Open summary card.
- Expected Result: Safe fallback text (for example N/A).
- Actual Result: String interpolation can render undefined (C).
- Business Impact: Low direct financial impact, but undermines trust and clarity.
- Evidence:
  - [app/src/components/CompDatabase.jsx#L1090](app/src/components/CompDatabase.jsx#L1090)
- Console or Server Error: None.
- Suspected File(s)/Function(s): summaryStats strongest card string formatting.
- Existed Before This Audit: Suspected.
- Recommended Fix Approach: guard compAddress with safe fallback.
- Regression Tests Required: UI rendering test for missing address fields.
- Dependencies: None.

### BUG-014
- Severity: Low
- Module: Recommendation Consistency Layer
- Title: Cross-engine recommendation contradiction risk (Proceed/Buy vs Insufficient Data/Pause)
- Reproduction Steps:
1. Compare outputs across AI decision, executive posture, buy-box, and underwriting in low-data scenarios.
- Expected Result: Either consistent recommendation or explicit reconciliation explanation.
- Actual Result: Multiple engines with independent rules can diverge without mandatory reconciliation.
- Business Impact: Decision ambiguity and operator error risk.
- Evidence:
  - Independent recommendation engines in [app/src/components/intelligenceUpgradeEngine.js](app/src/components/intelligenceUpgradeEngine.js), [app/src/components/aiDecisionEngine.js](app/src/components/aiDecisionEngine.js), and buy-box service [server/valuationOfferBuyBoxService.js](server/valuationOfferBuyBoxService.js).
- Console or Server Error: None.
- Suspected File(s)/Function(s): recommendation aggregation and display pipeline.
- Existed Before This Audit: Suspected.
- Recommended Fix Approach: add a single reconciliation layer with explicit conflict rationale.
- Regression Tests Required: contradiction detector test suite across engines.
- Dependencies: BUG-003, BUG-005.

## Suspected Bugs Requiring More Evidence
- Comp Database undefined (C) depends on specific missing-address record state (not force-inserted in this audit).
- Portfolio comparison table alignment/labeling issues could not be fully exercised due BUG-001 navigation blockade.
- Portfolio current value/equity reset scenarios require full module CRUD and restart cycle after navigation repair.
- Contradictory Proceed/Buy vs Pause/Insufficient Data should be re-run after navigation is restored so all module displays are reachable.

## False Alarms / Expected Behavior
- Full regression tests passed: 379/379.
- verify-system script passed.
- Production build passed with non-blocking bundle-size warning.
- No NaN/Infinity text surfaced on currently reachable views during runtime probe.

## Cross-Module Root-Cause Groups
1. Navigation Wiring Defects
- Missing click handlers and inconsistent nav arrays across module components.

2. Financial Unit/Normalization Defects
- Percent normalization inconsistency (fraction vs whole percent) and duplicate scaling.

3. Data Mapping/Schema Drift
- UI model fields missing or mis-mapped from underwriting outputs.
- Duplicate object keys causing silent overrides.

4. Operational Lifecycle Defects
- Status scripts relying on stale pid files without full listener/health reconciliation.

## Recommended Repair Order
1. Fix navigation wiring + nav parity first (unblocks module-level verification).
2. Fix critical financial logic (Flip scenario ordering, BRRRR LTV normalization, return scaling).
3. Fix BRRRR mapping defects (Max Loan display, Equity mapping).
4. Fix duplicate-key and status script integrity issues.
5. Sweep remaining lint issues in grouped passes.

## Fewest Safe Implementation Uploads
- Upload A (Critical unblock): Navigation + sidebar parity + logout wiring semantics.
- Upload B (Financial correctness): Flip and BRRRR core math normalization and display mapping.
- Upload C (Integrity hardening): Duplicate-key cleanup, status script reconciliation, lint debt clusters.

## Known Bug Revalidation Matrix
1. Flip best-case lower than base-case profit: Confirmed (BUG-002).
2. BRRRR refinance loan showing full ARV at 75% LTV: Confirmed (BUG-003).
3. Max Loan Based on LTV showing Not Available: Confirmed (BUG-004).
4. BRRRR return metrics showing extreme percentages: Confirmed (BUG-005).
5. Comp Database undefined (C): Suspected (BUG-013).
6. React unique key warning: Not reproduced in live console during this pass; lint debt remains severe.
7. Portfolio comparison alignment/labeling issues: Blocked by BUG-001 for full workflow traversal.
8. Portfolio current value/equity resetting inconsistently: Needs post-navigation-fix revalidation.
9. Proceed/Buy contradiction against Insufficient Data/Pause: Suspected; requires full reachable cross-module screen run.
10. Threshold text such as ARV must remain above $0: Not observed in this pass.

## Automated Test Evidence
- Regression: [checkpoints/bug-audit-20260806T011557Z/npm-test.log](checkpoints/bug-audit-20260806T011557Z/npm-test.log)
- Build: [checkpoints/bug-audit-20260806T011557Z/npm-build.log](checkpoints/bug-audit-20260806T011557Z/npm-build.log)
- Verify: [checkpoints/bug-audit-20260806T011557Z/npm-verify.log](checkpoints/bug-audit-20260806T011557Z/npm-verify.log)
- Lint: [checkpoints/bug-audit-20260806T011557Z/app-lint.log](checkpoints/bug-audit-20260806T011557Z/app-lint.log)

## Data Safety / Change Control Confirmation
- Production code changed during this audit: NO.
- Saved Royal Star records intentionally created/modified/deleted during this audit: NO.
- Test-created data restoration required: No test records were created.
- Rollback checkpoint created before destructive testing: YES.
