/**
 * What each change of a target model is worth, measured on the models.
 *
 * The worksheets quote numbers next to every change. They are not typed in:
 * a change is switched off in a copy of the TO-BE model (its steps get their
 * AS-IS parameters back, its branch shares return to the old values) and the
 * two models are analysed. The difference is what the change contributes.
 * Changes that replace whole steps (a step that exists only in AS-IS cannot be
 * "switched back on" in a copy) are measured by the load of those AS-IS steps.
 */
import { analyzeProcess } from '../../../analysis/simulate.js';
import { completionShare } from '../../../analysis/compare.js';
import { formatDuration, formatMoney } from '../../../analysis/parameters.js';
import { pick } from '../../shared.js';
import { WEG_AS_IS, WEG_TO_BE, buildWegDiagram } from '../index.js';

const COST_KEYS = ['duration', 'waitTime', 'cost'];

const clone = (value) => JSON.parse(JSON.stringify(value));

export function processPair(processId) {
  const tobe = WEG_TO_BE.find((process) => process.id === processId);
  const asis = tobe && WEG_AS_IS.find((process) => process.id === tobe.baselineId);
  return tobe && asis ? { tobe, asis } : null;
}

const cache = new Map();

/**
 * Analysis of a library process; the numbers do not depend on the language.
 * `cost` is the cost of a case that reaches a successful end: a change that
 * stops rejecting late lets more cases into expensive steps, and the cost per
 * *started* case would then punish it for being good.
 */
export function analyse(process) {
  if (!cache.has(process)) {
    const diagram = buildWegDiagram(process, 'en');
    const result = analyzeProcess(diagram);
    const done = completionShare(diagram, result);
    cache.set(process, {
      result,
      done,
      nodes: result.nodes,
      lead: result.totals.leadExpected,
      work: result.totals.workMinutes,
      cost: result.totals.costPerRun / done,
    });
  }
  return cache.get(process);
}

/**
 * A copy of the TO-BE process with one change switched off.
 * `revert`: `nodes` get their AS-IS duration / wait / cost back, `zero` nodes
 * stop costing anything (steps that do not exist in AS-IS), `like` maps a
 * TO-BE step to the AS-IS step it replaced, `edges` are
 * `[source, target, share]` triples that restore a branch share, `rewire`
 * removes and adds flows (to turn a parallel stretch back into a sequence).
 */
export function revertChange(tobe, asis, revert = {}) {
  const process = clone(tobe);
  const before = new Map(asis.spec.nodes.map((node) => [node.id, node]));
  const find = (id) => {
    const found = process.spec.nodes.find((node) => node.id === id);
    if (!found) throw new Error(`${tobe.id}: no step "${id}"`);
    found.props = found.props || {};
    return found;
  };
  for (const id of revert.nodes || []) {
    const step = find(id);
    const old = before.get(id);
    for (const key of COST_KEYS) {
      if (old?.props && key in old.props) step.props[key] = old.props[key];
      else delete step.props[key];
    }
  }
  for (const [id, asisId] of Object.entries(revert.like || {})) {
    // a step that replaced another one gets the parameters of the step it replaced
    const step = find(id);
    const old = before.get(asisId);
    if (!old) throw new Error(`${tobe.id}: no AS-IS step "${asisId}"`);
    for (const key of COST_KEYS) {
      if (old.props && key in old.props) step.props[key] = old.props[key];
      else delete step.props[key];
    }
  }
  for (const id of revert.zero || []) {
    const step = find(id);
    for (const key of COST_KEYS) step.props[key] = 0;
  }
  const rewire = revert.rewire || {};
  for (const [source, target] of rewire.remove || []) {
    const index = process.spec.edges.findIndex((entry) => entry.source === source && entry.target === target);
    if (index < 0) throw new Error(`${tobe.id}: no flow ${source} > ${target}`);
    process.spec.edges.splice(index, 1);
  }
  for (const [source, target, share] of rewire.add || []) {
    process.spec.edges.push({ source, target, props: share === undefined ? {} : { probability: share } });
  }
  for (const [source, target, share] of revert.edges || []) {
    const edge = process.spec.edges.find((entry) => entry.source === source && entry.target === target);
    if (!edge) throw new Error(`${tobe.id}: no flow ${source} > ${target}`);
    edge.props = edge.props || {};
    edge.props.probability = share;
  }
  return process;
}

/** Row of an analysis by the id a step has in the specification. */
function rowsById(process, analysis) {
  const byLabel = new Map(analysis.nodes.map((row) => [row.label, row]));
  const out = new Map();
  for (const node of process.spec.nodes) {
    const row = byLabel.get(node.label.en);
    if (row) out.set(node.id, row);
  }
  return out;
}

/** Row of the analysis for a step, by its id in the specification. */
export function stepRow(process, id) {
  const row = rowsById(process, analyse(process)).get(id);
  if (!row) throw new Error(`${process.id}: no step "${id}"`);
  return row;
}

/** Branch share (percent) of a flow of the specification. */
export function flowShare(process, source, target) {
  const edge = process.spec.edges.find((entry) => entry.source === source && entry.target === target);
  if (!edge) throw new Error(`${process.id}: no flow ${source} > ${target}`);
  return edge.props?.probability;
}

/** Work, waiting and cost per case that a set of AS-IS steps carries. */
export function stepLoad(asis, ids) {
  const analysis = analyse(asis);
  const rows = rowsById(asis, analysis);
  const load = { work: 0, wait: 0, cost: 0 };
  for (const id of ids) {
    const row = rows.get(id);
    if (!row) throw new Error(`${asis.id}: no step "${id}"`);
    load.work += row.totalMinutes;
    load.wait += row.runs * row.wait;
    load.cost += row.totalCost;
  }
  return load;
}

/**
 * Measures one change. Returns the contribution to the lead time, the work and
 * the cost of a case (positive = the change saves that much), the same per
 * year, and the share of the whole transition each one makes up.
 */
export function measureChange(processId, change) {
  const pair = processPair(processId);
  if (!pair) throw new Error(`unknown process ${processId}`);
  const { tobe, asis } = pair;
  const base = analyse(tobe);
  const before = analyse(asis);
  const volume = tobe.analysis?.volumePerYear || 0;
  const gain = {
    lead: before.lead - base.lead,
    work: before.work - base.work,
    cost: before.cost - base.cost,
  };
  let saved;
  let kind;
  if (change.revert) {
    const off = analyse(revertChange(tobe, asis, change.revert));
    saved = {
      lead: off.lead - base.lead,
      work: off.work - base.work,
      cost: off.cost - base.cost,
    };
    kind = 'revert';
  } else if (change.steps) {
    // steps that disappear, less whatever replaces them
    const gone = stepLoad(asis, change.steps);
    const instead = change.by ? stepLoad(tobe, change.by) : { work: 0, wait: 0, cost: 0 };
    saved = {
      lead: gone.work + gone.wait - instead.work - instead.wait,
      work: gone.work - instead.work,
      cost: gone.cost - instead.cost,
    };
    kind = 'steps';
  } else {
    return null;
  }
  const share = (value, total) => (Math.abs(total) > 1e-9 ? value / total : 0);
  return {
    kind,
    saved,
    perYear: { cost: saved.cost * volume, work: saved.work * volume },
    share: { lead: share(saved.lead, gain.lead), work: share(saved.work, gain.work), cost: share(saved.cost, gain.cost) },
    gain,
    volume,
  };
}

/* ----------------------------------------------------------------- wording */

const signed = (value, text) => (value > 0 ? `+${text}` : value < 0 ? `−${text}` : text);
const pct = (value) => `${Math.round(Math.abs(value) * 100)} %`;

/**
 * One line that says what the model attributes to the change. `signed` values
 * are positive when the change helps; wording is "without it ... would be".
 */
export function describeMeasure(measure, locale = 'ru', currency = 'R$') {
  if (!measure) return '';
  const ru = locale === 'ru';
  const { saved, share, perYear, kind } = measure;
  const parts = [];
  if (kind === 'revert') {
    const lead = Math.abs(saved.lead);
    if (lead >= 0.5 && (Math.abs(share.lead) >= 0.02 || lead >= 30)) {
      parts.push(
        ru
          ? `срок ${saved.lead > 0 ? 'длиннее' : 'короче'} на ${formatDuration(lead, 'ru')} (${pct(share.lead)} выигрыша процесса)`
          : `lead time ${formatDuration(lead, 'en')} ${saved.lead > 0 ? 'longer' : 'shorter'} (${pct(share.lead)} of the process gain)`
      );
    }
    if (Math.abs(saved.work) >= 1 && Math.abs(share.work) >= 0.05) {
      parts.push(
        ru
          ? `трудозатраты ${saved.work > 0 ? 'выше' : 'ниже'} на ${formatDuration(Math.abs(saved.work), 'ru')}`
          : `work ${formatDuration(Math.abs(saved.work), 'en')} ${saved.work > 0 ? 'higher' : 'lower'}`
      );
    }
    if (Math.abs(saved.cost) >= 0.05) {
      const money = formatMoney(Math.abs(saved.cost), currency, locale);
      const year = Math.abs(perYear.cost) >= 1e6 ? ` (≈ ${formatMoney(Math.abs(perYear.cost), currency, locale)} ${ru ? 'в год' : 'a year'})` : '';
      parts.push(
        ru
          ? `стоимость случая ${saved.cost > 0 ? 'выше' : 'ниже'} на ${money}${year}`
          : `cost per case ${money} ${saved.cost > 0 ? 'higher' : 'lower'}${year}`
      );
    }
    if (!parts.length) return '';
    return ru ? `Без этого изменения: ${parts.join('; ')}.` : `Without this change: ${parts.join('; ')}.`;
  }
  const bits = [];
  if (saved.work >= 0.5) bits.push(formatDuration(saved.work, locale) + (ru ? ' работы' : ' of work'));
  if (saved.cost >= 0.05) bits.push(formatMoney(saved.cost, currency, locale));
  if (!bits.length) return '';
  return ru
    ? `Новые шаги вместо прежних экономят на каждом случае ${bits.join(' и ')}.`
    : `The new steps in place of the old ones save ${bits.join(' and ')} on every case.`;
}

export { signed };

/**
 * Fills `{lead}`, `{cost}`, `{year}`, `{leadShare}`, `{costShare}`, `{workShare}`
 * in a sentence. `{id:key}` takes the value from another change of the same
 * sheet; a bare `{key}` takes it from `fallback`.
 */
export function fillPlaceholders(text, measures, fallback, locale = 'ru', currency = 'R$') {
  const values = (measure) => {
    if (!measure) return {};
    const { saved, share, perYear } = measure;
    return {
      lead: formatDuration(Math.abs(saved.lead), locale),
      leadShare: pct(share.lead),
      cost: formatMoney(Math.abs(saved.cost), currency, locale),
      year: formatMoney(Math.abs(perYear.cost), currency, locale),
      workShare: pct(share.work),
      costShare: pct(share.cost),
    };
  };
  return text.replace(/\{(?:(\w+):)?(\w+)\}/g, (match, id, key) => {
    const found = values(id ? measures[id] : fallback)[key];
    return found === undefined ? match : found;
  });
}

export function localized(value, locale) {
  return pick(value, locale);
}
