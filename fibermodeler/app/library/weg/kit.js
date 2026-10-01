/** Small helpers that keep the process definitions readable. */

/** Node: id, BPMN type, lane, russian label, english label, parameters. */
export function node(id, type, lane, ru, en, props = {}) {
  return { id, type, lane, label: { ru, en }, props };
}

/** Sequence flow with an optional label and branch share (%). */
export function flow(source, target, options = {}) {
  const props = {};
  if (options.share !== undefined) props.probability = options.share;
  if (options.condition) props.condition = options.condition;
  return {
    source,
    target,
    label: options.ru ? { ru: options.ru, en: options.en || options.ru } : undefined,
    props,
  };
}

/** Parameters measured in the field / taken as an industry norm. */
export function work(duration, resource, extra = {}) {
  return { duration, resource, dataSource: 'assumption', ...extra };
}

/** Parameters computed from WEG's published figures. */
export function derived(duration, resource, extra = {}) {
  return { duration, resource, dataSource: 'derived', ...extra };
}

/** Parameters taken straight from the public report. */
export function reported(props) {
  return { dataSource: 'report', ...props };
}

/** A fully automated step: system time, no person occupied. */
export function auto(duration, extra = {}) {
  return { duration, dataSource: 'assumption', ...extra };
}

/** Waiting time that no one works during (queues, transport, customer). */
export function wait(minutes, extra = {}) {
  return { waitTime: minutes, dataSource: 'assumption', ...extra };
}

export const DAY = 480; // one working day in minutes
export const WEEK = DAY * 5;
