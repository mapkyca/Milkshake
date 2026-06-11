import { Token, TokenizeError } from './types';

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let column = 1;

  while (index < input.length) {
    const char = input[index];

    // Skip whitespace
    if (/\s/.test(char)) {
      index++;
      column++;
      if (char === '\n') {
        line++;
        column = 1;
      }
      continue;
    }

    // LPAREN
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', line, column, index });
      index++;
      column++;
      continue;
    }

    // RPAREN
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', line, column, index });
      index++;
      column++;
      continue;
    }

    // COLON
    if (char === ':') {
      tokens.push({ type: 'COLON', value: ':', line, column, index });
      index++;
      column++;
      continue;
    }

    // EQUALS
    if (char === '=') {
      tokens.push({ type: 'EQUALS', value: '=', line, column, index });
      index++;
      column++;
      continue;
    }

    // LESS or LESS_EQUALS
    if (char === '<') {
      if (input[index + 1] === '=') {
        tokens.push({ type: 'LESS_EQUALS', value: '<=', line, column, index });
        index += 2;
        column += 2;
      } else {
        tokens.push({ type: 'LESS', value: '<', line, column, index });
        index++;
        column++;
      }
      continue;
    }

    // GREATER or GREATER_EQUALS
    if (char === '>') {
      if (input[index + 1] === '=') {
        tokens.push({ type: 'GREATER_EQUALS', value: '>=', line, column, index });
        index += 2;
        column += 2;
      } else {
        tokens.push({ type: 'GREATER', value: '>', line, column, index });
        index++;
        column++;
      }
      continue;
    }

    // Quoted string
    if (char === '"') {
      const startLine = line;
      const startColumn = column;
      const startIndex = index;
      let val = '';
      let closed = false;

      index++; // skip open quote
      column++;

      while (index < input.length) {
        const c = input[index];
        if (c === '\\' && input[index + 1] === '"') {
          val += '"';
          index += 2;
          column += 2;
        } else if (c === '"') {
          closed = true;
          index++;
          column++;
          break;
        } else {
          val += c;
          index++;
          column++;
          if (c === '\n') {
            line++;
            column = 1;
          }
        }
      }

      if (!closed) {
        throw new TokenizeError('Unclosed double quote', startLine, startColumn);
      }

      // Quoted strings are ALWAYS values, never reserved words
      tokens.push({ type: 'VALUE', value: val, line: startLine, column: startColumn, index: startIndex });
      continue;
    }

    // Bare words / identifiers
    const startLine = line;
    const startColumn = column;
    const startIndex = index;
    let val = '';

    while (index < input.length) {
      const c = input[index];
      // Break on separators
      if (
        /\s/.test(c) ||
        c === '(' ||
        c === ')' ||
        c === ':' ||
        c === '<' ||
        c === '>' ||
        c === '='
      ) {
        break;
      }
      val += c;
      index++;
      column++;
    }

    if (val.length === 0) {
      // Prevent infinite loop on unexpected character
      throw new TokenizeError(`Unexpected character "${input[index]}"`, line, column);
    }

    const lower = val.toLowerCase();
    if (lower === 'and') {
      tokens.push({ type: 'AND', value: val, line: startLine, column: startColumn, index: startIndex });
    } else if (lower === 'or') {
      tokens.push({ type: 'OR', value: val, line: startLine, column: startColumn, index: startIndex });
    } else if (lower === 'not') {
      tokens.push({ type: 'NOT', value: val, line: startLine, column: startColumn, index: startIndex });
    } else {
      tokens.push({ type: 'VALUE', value: val, line: startLine, column: startColumn, index: startIndex });
    }
  }

  tokens.push({ type: 'EOF', value: '', line, column, index });
  return tokens;
}
