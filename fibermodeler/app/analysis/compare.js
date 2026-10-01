/**
 * Comparing two versions of one process (current state against target state).
 *
 * Both sides are recomputed from the models themselves - nothing here is
 * stored or hand-written, so editing a parameter on either diagram moves the
 * comparison with it.
 *
 * One subtlety the plain "cost per case" number hides: a process that stops
 * killing cases late lets more of them reach the expensive steps, so its cost
 * per *started* case can rise while the cost per *completed* one falls. An end
 * event marked with `completes: true` tells us how many cases actually finish,
 * and `costPerCompletion` divides by that share.
 */
import { analyzeProcess } from './simulate.js';

/** Share of cases that reach an end event marked as a successful completion. */
export function completionShare(diagram, result) {
  const ids = new Set((diagram?.nodes || []).filter((node) => node.props?.completes).map((node) => node.id));
  if (!ids.size) return 1;
  const share = (result?.nodes || []).filter((row) => ids.has(row.id)).reduce((sum, row) => sum + row.runs, 0);
  return share > 0 ? share : 1;
}

/** Metrics compared side by side; `lowerIsBetter` drives the colour of the delta. */
export const COMPARE_METRICS = [
  { key: 'lead', labelKey: 'analysis.lead', kind: 'duration', lowerIsBetter: true },
  { key: 'work', labelKey: 'analysis.work', kind: 'duration', lowerIsBetter: true },
  { key: 'wait', labelKey: 'analysis.wait', kind: 'duration', lowerIsBetter: true },
  { key: 'cost', labelKey: 'analysis.cost', kind: 'money', lowerIsBetter: true },
  { key: 'costPerCompletion', labelKey: 'compare.costPerDone', kind: 'money', lowerIsBetter: true },
  { key: 'annualCost', labelKey: 'analysis.annualCost', kind: 'money', lowerIsBetter: true },
  { key: 'fte', labelKey: 'analysis.fte', kind: 'number', lowerIsBetter: true },
];

function metrics(diagram, result) {
  const done = completionShare(diagram, result);
  return {
    lead: result.totals.leadExpected,
    work: result.totals.workMinutes,
    wait: result.totals.waitMinutes,
    cost: result.totals.costPerRun,
    costPerCompletion: result.totals.costPerRun / done,
    annualCost: result.annual.cost,
    fte: result.annual.fte,
    completion: done,
  };
}

/**
 * @param {object} baseline  diagram of the current state ("as is")
 * @param {object} current   diagram of the target state ("to be")
 */
export function compareProcesses(baseline, current) {
  if (!baseline || !current) return null;
  const baseResult = analyzeProcess(baseline);
  const result = analyzeProcess(current);
  if (!baseResult.ok || !result.ok) return null;
  const a = metrics(baseline, baseResult);
  const b = metrics(current, result);
  const rows = COMPARE_METRICS.map((metric) => {
    const from = a[metric.key];
    const to = b[metric.key];
    const deltaPct = from ? ((to - from) / from) * 100 : 0;
    return {
      ...metric,
      from,
      to,
      deltaPct: Math.round(deltaPct * 10) / 10,
      improved: metric.lowerIsBetter ? to < from : to > from,
    };
  });
  return {
    baselineResult: baseResult,
    result,
    currency: result.settings.currency,
    completion: { from: a.completion, to: b.completion },
    rows,
  };
}
