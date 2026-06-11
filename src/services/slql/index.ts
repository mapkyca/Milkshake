import { tokenize } from './tokenizer';
import { parse } from './parser';
import { normalize } from './normalizer';
import { validate } from './validator';
import { evaluate } from './evaluator';
import { EvaluationContext } from './types';
import type { Task, List } from '../../types';

export * from './types';
export { tokenize } from './tokenizer';
export { parse } from './parser';
export { normalize } from './normalizer';
export { validate } from './validator';
export { evaluate } from './evaluator';

export function evaluateSLQL(
  filterStr: string,
  tasks: Task[],
  lists: List[],
  context: EvaluationContext
): Task[] {
  const tokens = tokenize(filterStr);
  const ast = parse(tokens);
  const normalized = normalize(ast);
  validate(normalized);
  return evaluate(normalized, tasks, lists, context);
}
export type { QueryNode } from './types';
