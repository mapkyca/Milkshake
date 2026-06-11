import { QueryNode, ValidationError } from './types';

const VALID_FIELDS = new Set([
  'status',
  'priority',
  'list',
  'tag',
  'due',
  'dueWithin',
  'added',
  'addedWithin',
  'completed',
  'completedWithin',
  'created',
  'createdWithin',
  'updated',
  'updatedWithin',
  'repeat',
  'is',
  'has',
  'parent',
  'text',
  'title',
  'description',
  'url',
  'estimate',
]);

const DATE_SHORTCUTS = new Set([
  'today',
  'tomorrow',
  'yesterday',
  'this-week',
  'next-week',
  'this-month',
  'next-month',
  'overdue',
  'never',
  'any',
]);

export function validate(ast: QueryNode): void {
  validateNode(ast);
}

function validateNode(node: QueryNode): void {
  if (node.type === 'and' || node.type === 'or') {
    for (const child of node.children) {
      validateNode(child);
    }
    return;
  }

  if (node.type === 'not') {
    validateNode(node.child);
    return;
  }

  const { field, operator, value } = node;

  if (!VALID_FIELDS.has(field)) {
    throw new ValidationError(`Unknown smart-list field "${field}"`);
  }

  // Validate status
  if (field === 'status') {
    if (operator !== ':' && operator !== '=') {
      throw new ValidationError(`Invalid operator "${operator}" for status. Expected ":" or "="`);
    }
    const validStatuses = ['incomplete', 'completed', 'any'];
    if (!validStatuses.includes(value)) {
      throw new ValidationError(
        `Invalid status "${value}". Expected ${validStatuses.join(', ')}.`
      );
    }
  }

  // Validate priority
  if (field === 'priority') {
    const validPriorities = ['1', '2', '3', 'none', 'any'];
    if (!validPriorities.includes(value)) {
      throw new ValidationError(
        `Invalid priority "${value}". Expected 1, 2, 3, none, or any.`
      );
    }
  }

  // Validate repeat
  if (field === 'repeat') {
    if (operator !== ':' && operator !== '=') {
      throw new ValidationError(`Invalid operator "${operator}" for repeat. Expected ":" or "="`);
    }
    if (value !== 'any' && value !== 'none') {
      throw new ValidationError(`Invalid repeat "${value}". Expected any or none.`);
    }
  }

  // Validate parent
  if (field === 'parent') {
    if (operator !== ':' && operator !== '=') {
      throw new ValidationError(`Invalid operator "${operator}" for parent. Expected ":" or "="`);
    }
    if (value !== 'any' && value !== 'none') {
      throw new ValidationError(`Invalid parent "${value}". Expected any or none.`);
    }
  }

  // Validate is
  if (field === 'is') {
    if (operator !== ':' && operator !== '=') {
      throw new ValidationError(`Invalid operator "${operator}" for is. Expected ":" or "="`);
    }
    if (value !== 'subtask' && value !== 'repeating') {
      throw new ValidationError(`Invalid is "${value}". Expected subtask or repeating.`);
    }
  }

  // Validate has
  if (field === 'has') {
    if (operator !== ':' && operator !== '=') {
      throw new ValidationError(`Invalid operator "${operator}" for has. Expected ":" or "="`);
    }
    if (value !== 'subtasks' && value !== 'url') {
      throw new ValidationError(`Invalid has "${value}". Expected subtasks or url.`);
    }
  }

  // Validate date fields (due, added, completed, created, updated)
  if (
    field === 'due' ||
    field === 'added' ||
    field === 'completed' ||
    field === 'created' ||
    field === 'updated'
  ) {
    const isComparison = operator === '<' || operator === '<=' || operator === '>' || operator === '>=';
    const isDateLiteral = /^\d{4}-\d{2}-\d{2}$/.test(value);

    if (isComparison) {
      if (!isDateLiteral) {
        throw new ValidationError(
          `Comparison operators require a YYYY-MM-DD date. Found "${value}"`
        );
      }
    } else {
      // Operator is : or =
      if (!DATE_SHORTCUTS.has(value) && !isDateLiteral) {
        throw new ValidationError(
          `Invalid date value "${value}". Expected YYYY-MM-DD or a shortcut like today, tomorrow, this-week, etc.`
        );
      }
    }
  }

  // Validate relative windows (dueWithin, addedWithin, completedWithin, createdWithin, updatedWithin)
  if (field.endsWith('Within')) {
    if (operator !== ':' && operator !== '=') {
      throw new ValidationError(`Invalid operator "${operator}" for ${field}. Expected ":" or "="`);
    }
    // Pattern: "1 day", "7 days", "1 week", "1 month of today"
    const windowPattern = /^\d+\s+(day|days|week|weeks|month|months)(?:\s+of\s+today)?$/i;
    if (!windowPattern.test(value)) {
      throw new ValidationError(
        `Invalid relative window "${value}". Expected format like "1 day", "7 days", "1 week", "1 month of today".`
      );
    }
  }
}
