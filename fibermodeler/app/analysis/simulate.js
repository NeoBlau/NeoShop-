/**
 * Process calculation engine.
 *
 * Standard process-analysis maths over a BPMN graph:
 *   1. token propagation - how often each step runs per process instance,
 *      following gateway shares and rework loops;
 *   2. time - processing time, waiting time, expected and critical lead time;
 *   3. money - direct cost plus labour cost from role rates;
 *   4. capacity - hours per role per year and the resulting headcount (FTE);
 *   5. bottleneck - the step that consumes the most time per instance.
 *
 * Everything is derived from the parameters stored on the elements, so the
 * numbers change the moment the model changes.
 */
import { BPMN_TYPES } from '../notations/bpmn/types.js';
import {
  analysisSettings,
  edgeProbability,
  nodeCost,
  nodeDuration,
  nodeResource,
  nodeResourceQty,
  nodeWait,
  roleRate,
  round,
} from './parameters.js';

const FLOW_CATEGORIES = new Set(['event', 'activity', 'gateway']);

function isFlowNode(node) {
  const type = BPMN_TYPES[node?.type];
  return !!type && FLOW_CATEGORIES.has(type.category);
}

function typeOf(node) {
  return BPMN_TYPES[node?.type] || null;
}

function laneOf(diagram, node) {
  let current = node;
  const seen = new Set();
  while (current?.parent && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = diagram.nodes.find((x) => x.id === current.parent);
    if (!parent) break;
    if (parent.type === 'lane' || parent.type === 'pool') return parent.label || '';
    current = parent;
  }
  return '';
}

/** Depth-first ordering that also reports the back edges (rework loops). */
function topologicalOrder(ids, outgoing) {
  const state = new Map(ids.map((id) => [id, 0]));
  const order = [];
  const backEdges = [];
  const visit = (id, stack) => {
    state.set(id, 1);
    for (const edge of outgoing.get(id) || []) {
      const next = edge.target;
      if (!state.has(next)) continue;
      if (state.get(next) === 1 || stack.has(next)) {
        backEdges.push(edge);
        continue;
      }
      if (state.get(next) === 0) {
        stack.add(next);
        visit(next, stack);
        stack.delete(next);
      }
    }
    state.set(id, 2);
    order.push(id);
  };
  for (const id of ids) if (state.get(id) === 0) visit(id, new Set([id]));
  return { order: order.reverse(), backEdges };
}

/** Share of tokens that leave `node` through `edge`. */
function branchWeight(node, edge, outgoing) {
  const flows = outgoing.get(node.id) || [];
  if (flows.length <= 1) return 1;
  const type = typeOf(node);
  const explicit = edgeProbability(edge);
  const kind = type?.category === 'gateway' ? node.type : 'implicit';

  if (kind === 'parallelGateway') return 1;
  if (kind === 'inclusiveGateway') return explicit === null ? 1 : explicit;
  if (kind === 'exclusiveGateway' || kind === 'eventBasedGateway' || kind === 'complexGateway') {
    if (explicit !== null) return explicit;
    const known = flows.map(edgeProbability).filter((value) => value !== null);
    const rest = Math.max(0, 1 - known.reduce((sum, value) => sum + value, 0));
    const unknownCount = flows.length - known.length;
    return unknownCount > 0 ? rest / unknownCount : 1 / flows.length;
  }
  return explicit === null ? 1 : explicit;
}

export function analyzeProcess(diagram, overrides = {}) {
  const settings = { ...analysisSettings(diagram), ...overrides };
  const empty = {
    ok: false,
    settings,
    nodes: [],
    totals: { workMinutes: 0, waitMinutes: 0, leadExpected: 0, leadCritical: 0, costPerRun: 0, labourCost: 0, directCost: 0 },
    resources: [],
    bottleneck: null,
    annual: { volume: settings.volumePerYear || 0, hours: 0, cost: 0, fte: 0 },
    issues: [],
  };
  if (!diagram || diagram.notation !== 'bpmn') return empty;

  const flowNodes = diagram.nodes.filter(isFlowNode);
  if (!flowNodes.length) return empty;
  const byId = new Map(flowNodes.map((node) => [node.id, node]));
  const flows = diagram.edges.filter((edge) => edge.type === 'sequenceFlow' && byId.has(edge.source) && byId.has(edge.target));

  const outgoing = new Map(flowNodes.map((node) => [node.id, []]));
  const incoming = new Map(flowNodes.map((node) => [node.id, []]));
  for (const edge of flows) {
    outgoing.get(edge.source).push(edge);
    incoming.get(edge.target).push(edge);
  }

  const ids = flowNodes.map((node) => node.id);
  const { order, backEdges } = topologicalOrder(ids, outgoing);
  const backSet = new Set(backEdges.map((edge) => edge.id));
  void backEdges;

  /* 1. how often does each step run per instance -------------------------- */

  // a node with no incoming flow starts the process - unless it is an end
  // event that was simply left unconnected, which must not create tokens
  const starts = flowNodes.filter((node) => {
    const kind = typeOf(node)?.kind;
    if (kind === 'start') return true;
    if (kind === 'end') return false;
    return (incoming.get(node.id) || []).length === 0;
  });
  const startShare = starts.length ? 1 / starts.length : 0;
  const startIds = new Set(starts.map((node) => node.id));
  const isAndJoin = (node) => ['parallelGateway', 'inclusiveGateway'].includes(node.type);

  // Fixpoint sweep: a plain topological pass cannot see rework loops, so the
  // token counts are relaxed until they converge (they form a geometric
  // series whenever the loop feedback is below 100%).
  const tokens = new Map(ids.map((id) => [id, startIds.has(id) ? startShare : 0]));
  let converged = false;
  for (let pass = 0; pass < 200 && !converged; pass++) {
    let delta = 0;
    for (const id of order) {
      const node = byId.get(id);
      const inflow = incoming.get(id) || [];
      let value = startIds.has(id) ? startShare : 0;
      if (inflow.length) {
        const contributions = inflow.map(
          (edge) => (tokens.get(edge.source) || 0) * branchWeight(byId.get(edge.source), edge, outgoing)
        );
        // an AND-join lets one instance through once, it does not add tokens up
        const merged = isAndJoin(node) && inflow.length > 1 ? Math.max(...contributions) : contributions.reduce((a, b) => a + b, 0);
        value += merged;
      }
      value = Math.min(value, 1e6);
      delta = Math.max(delta, Math.abs(value - (tokens.get(id) || 0)));
      tokens.set(id, value);
    }
    converged = delta < 1e-9;
  }

  /* 2. time ---------------------------------------------------------------- */

  const finishExpected = new Map();
  const finishCritical = new Map();
  for (const id of order) {
    const node = byId.get(id);
    const inflow = (incoming.get(id) || []).filter((edge) => !backSet.has(edge.id));
    const isParallelJoin = node.type === 'parallelGateway' || node.type === 'inclusiveGateway';
    let startExpected = 0;
    let startCritical = 0;
    if (inflow.length) {
      const arrivals = inflow.map((edge) => ({
        expected: finishExpected.get(edge.source) || 0,
        critical: finishCritical.get(edge.source) || 0,
        weight: (tokens.get(edge.source) || 0) * branchWeight(byId.get(edge.source), edge, outgoing),
      }));
      const totalWeight = arrivals.reduce((sum, item) => sum + item.weight, 0);
      startExpected = isParallelJoin || !totalWeight
        ? Math.max(...arrivals.map((item) => item.expected))
        : arrivals.reduce((sum, item) => sum + item.expected * item.weight, 0) / totalWeight;
      startCritical = Math.max(...arrivals.map((item) => item.critical));
    }
    const own = nodeDuration(node) + nodeWait(node);
    finishExpected.set(id, startExpected + own);
    finishCritical.set(id, startCritical + own);
  }

  const ends = flowNodes.filter((node) => typeOf(node)?.kind === 'end' || (outgoing.get(node.id) || []).length === 0);
  // expected lead time averages the end events by how often each one is reached
  const endWeight = ends.reduce((sum, node) => sum + (tokens.get(node.id) || 0), 0);
  const leadAcyclic = !ends.length
    ? 0
    : endWeight > 0
      ? ends.reduce((sum, node) => sum + (finishExpected.get(node.id) || 0) * (tokens.get(node.id) || 0), 0) / endWeight
      : Math.max(...ends.map((node) => finishExpected.get(node.id) || 0));
  const leadCriticalAcyclic = ends.length ? Math.max(...ends.map((node) => finishCritical.get(node.id) || 0)) : 0;
  // repeated steps (rework loops) add their extra passes to the lead time
  let reworkDelay = 0;
  for (const node of flowNodes) {
    const runs = tokens.get(node.id) || 0;
    if (runs > 1.0001) reworkDelay += (runs - 1) * (nodeDuration(node) + nodeWait(node));
  }
  const leadExpected = leadAcyclic + reworkDelay;
  const leadCritical = leadCriticalAcyclic + reworkDelay;

  /* 3. money and resources ------------------------------------------------- */

  const rows = [];
  const resourceMap = new Map();
  let workMinutes = 0;
  let waitMinutes = 0;
  let directCost = 0;
  let labourCost = 0;

  for (const node of flowNodes) {
    const runs = tokens.get(node.id) || 0;
    const duration = nodeDuration(node);
    const wait = nodeWait(node);
    const role = nodeResource(node);
    const qty = nodeResourceQty(node);
    const rate = roleRate(settings, role);
    const minutes = runs * duration;
    const labour = (minutes / 60) * rate * qty;
    const direct = runs * nodeCost(node);
    workMinutes += minutes;
    waitMinutes += runs * wait;
    directCost += direct;
    labourCost += labour;

    if (role) {
      const entry = resourceMap.get(role) || { role, minutesPerRun: 0, costPerRun: 0, rate };
      entry.minutesPerRun += minutes * qty;
      entry.costPerRun += labour;
      entry.rate = rate || entry.rate;
      resourceMap.set(role, entry);
    }

    rows.push({
      id: node.id,
      label: node.label || node.id,
      type: node.type,
      category: typeOf(node)?.category || '',
      lane: laneOf(diagram, node),
      runs: round(runs, 3),
      duration,
      wait,
      resource: role,
      resourceQty: qty,
      totalMinutes: round(minutes, 2),
      totalCost: round(direct + labour, 2),
      dataSource: node.props?.dataSource || '',
      finish: round(finishExpected.get(node.id) || 0, 2),
    });
  }

  const volume = Math.max(0, Number(settings.volumePerYear) || 0);
  const hoursPerFte = Math.max(1, Number(settings.hoursPerFte) || 1800);
  const resources = [...resourceMap.values()]
    .map((entry) => {
      const hoursPerYear = (entry.minutesPerRun / 60) * volume;
      return {
        ...entry,
        minutesPerRun: round(entry.minutesPerRun, 2),
        costPerRun: round(entry.costPerRun, 2),
        hoursPerYear: round(hoursPerYear, 1),
        fte: round(hoursPerYear / hoursPerFte, 2),
        costPerYear: round(entry.costPerRun * volume, 2),
      };
    })
    .sort((a, b) => b.minutesPerRun - a.minutesPerRun);

  const activityRows = rows.filter((row) => row.category === 'activity');
  const bottleneck = activityRows.length
    ? activityRows.reduce((best, row) => (row.totalMinutes > best.totalMinutes ? row : best))
    : null;

  const costPerRun = directCost + labourCost;

  /* 4. data quality checks ------------------------------------------------- */

  const issues = [];
  for (const node of flowNodes) {
    if (typeOf(node)?.category !== 'gateway') continue;
    const flowsOut = outgoing.get(node.id) || [];
    if (flowsOut.length < 2) continue;
    if (!['exclusiveGateway', 'eventBasedGateway', 'complexGateway'].includes(node.type)) continue;
    const values = flowsOut.map(edgeProbability);
    if (values.every((value) => value === null)) continue;
    const sum = values.reduce((acc, value) => acc + (value || 0), 0);
    if (Math.abs(sum - 1) > 0.005) {
      issues.push({
        severity: 'warning',
        code: 'shareSum',
        elementId: node.id,
        params: { name: node.label || node.id, sum: Math.round(sum * 100) },
        message: {
          en: 'Branch shares of “{name}” add up to {sum}% instead of 100%',
          ru: 'Доли веток шлюза «{name}» дают {sum}% вместо 100%',
        },
      });
    }
  }
  const missing = activityRows.filter((row) => !row.duration);
  if (missing.length) {
    issues.push({
      severity: 'info',
      code: 'noDuration',
      elementId: missing[0].id,
      params: { count: missing.length },
      message: {
        en: '{count} task(s) have no processing time - they are counted as instant',
        ru: 'У {count} задач(и) не задано время — они считаются мгновенными',
      },
    });
  }
  const unreachable = rows.filter((row) => !row.runs);
  if (unreachable.length) {
    issues.push({
      severity: 'warning',
      code: 'unreachable',
      elementId: unreachable[0].id,
      params: { count: unreachable.length, name: unreachable[0].label },
      message: {
        en: '{count} element(s) are never reached, starting with “{name}”',
        ru: 'До {count} элемент(ов) поток не доходит, первый — «{name}»',
      },
    });
  }

  return {
    ok: true,
    settings,
    nodes: rows.sort((a, b) => a.finish - b.finish),
    totals: {
      workMinutes: round(workMinutes, 2),
      waitMinutes: round(waitMinutes, 2),
      leadExpected: round(leadExpected, 2),
      leadCritical: round(leadCritical, 2),
      reworkDelay: round(reworkDelay, 2),
      costPerRun: round(costPerRun, 2),
      labourCost: round(labourCost, 2),
      directCost: round(directCost, 2),
      // how much of the elapsed time is spent waiting, and how much labour is
      // packed into one unit of lead time (> 1 means work runs in parallel)
      waitShare: workMinutes + waitMinutes ? round((waitMinutes / (workMinutes + waitMinutes)) * 100, 1) : 0,
      laborPerLead: leadExpected ? round(workMinutes / leadExpected, 2) : 0,
      steps: activityRows.length,
    },
    resources,
    bottleneck,
    annual: {
      volume,
      hours: round((workMinutes / 60) * volume, 1),
      cost: round(costPerRun * volume, 2),
      fte: round(((workMinutes / 60) * volume) / hoursPerFte, 2),
    },
    issues,
  };
}
