import { QueryNode } from './types';

export function normalize(ast: QueryNode): QueryNode {
  // 1. Recursively normalize terms and flatten operators
  const normalized = normalizeNode(ast);

  // 2. Determine default status rules
  const hasStatus = hasFieldInAST(normalized, (f) => f === 'status');
  const hasCompleted = hasFieldInAST(
    normalized,
    (f) => f === 'completed' || f === 'completedWithin'
  );

  // If status is already explicitly defined, do not alter
  if (hasStatus) {
    return normalized;
  }

  // Determine which status to imply
  const impliedStatus = hasCompleted ? 'completed' : 'incomplete';

  // Inject the status condition
  if (normalized.type === 'and') {
    return {
      type: 'and',
      children: [
        { type: 'term', field: 'status', operator: ':', value: impliedStatus },
        ...normalized.children,
      ],
    };
  }

  return {
    type: 'and',
    children: [
      { type: 'term', field: 'status', operator: ':', value: impliedStatus },
      normalized,
    ],
  };
}

function normalizeNode(node: QueryNode): QueryNode {
  if (node.type === 'and') {
    const children: QueryNode[] = [];
    for (const child of node.children) {
      const normChild = normalizeNode(child);
      if (normChild.type === 'and') {
        children.push(...normChild.children);
      } else {
        children.push(normChild);
      }
    }
    return { type: 'and', children };
  }

  if (node.type === 'or') {
    const children: QueryNode[] = [];
    for (const child of node.children) {
      const normChild = normalizeNode(child);
      if (normChild.type === 'or') {
        children.push(...normChild.children);
      } else {
        children.push(normChild);
      }
    }
    return { type: 'or', children };
  }

  if (node.type === 'not') {
    return { type: 'not', child: normalizeNode(node.child) };
  }

  // Normalize term aliases
  let { field, operator, value } = node;

  // Unqualified text -> text
  if (field === '') {
    field = 'text';
  } else if (field === 'hasTag') {
    field = 'tag';
  } else if (field === 'dueBefore') {
    field = 'due';
    operator = '<';
  } else if (field === 'dueAfter') {
    field = 'due';
    operator = '>';
  } else if (field === 'dueOn') {
    field = 'due';
    operator = '=';
  } else if (field === 'addedBefore') {
    field = 'added';
    operator = '<';
  } else if (field === 'addedAfter') {
    field = 'added';
    operator = '>';
  } else if (field === 'addedOn') {
    field = 'added';
    operator = '=';
  } else if (field === 'completedBefore') {
    field = 'completed';
    operator = '<';
  } else if (field === 'completedAfter') {
    field = 'completed';
    operator = '>';
  } else if (field === 'completedOn') {
    field = 'completed';
    operator = '=';
  } else if (field === 'createdBefore') {
    field = 'created';
    operator = '<';
  } else if (field === 'createdAfter') {
    field = 'created';
    operator = '>';
  } else if (field === 'createdOn') {
    field = 'created';
    operator = '=';
  } else if (field === 'updatedBefore') {
    field = 'updated';
    operator = '<';
  } else if (field === 'updatedAfter') {
    field = 'updated';
    operator = '>';
  } else if (field === 'updatedOn') {
    field = 'updated';
    operator = '=';
  }

  // Recurrence normalization
  if (field === 'is' && value === 'repeating') {
    field = 'repeat';
    value = 'any';
  }

  return { type: 'term', field, operator, value };
}

function hasFieldInAST(
  node: QueryNode,
  test: (field: string, value: string) => boolean
): boolean {
  if (node.type === 'and' || node.type === 'or') {
    return node.children.some((child) => hasFieldInAST(child, test));
  }
  if (node.type === 'not') {
    return hasFieldInAST(node.child, test);
  }
  return test(node.field, node.value);
}
