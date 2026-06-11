import { Token, TokenType, QueryNode, ParseError } from './types';

export function parse(tokens: Token[]): QueryNode {
  let index = 0;

  function peek(): Token {
    return tokens[index] || { type: 'EOF', value: '', line: 0, column: 0, index: 0 };
  }

  function next(): Token {
    return tokens[index++] || { type: 'EOF', value: '', line: 0, column: 0, index: 0 };
  }

  function consume(type: TokenType, errMsg: string): Token {
    const token = peek();
    if (token.type !== type) {
      throw new ParseError(errMsg, token);
    }
    return next();
  }

  // query := expression
  function parseQuery(): QueryNode {
    // If the input is empty (only EOF), let's return a default empty or dummy node, or throw an error.
    // Wait, the prompt says "Invalid filters produce clear, actionable error messages."
    // What if the filter is completely empty? An empty string doesn't match anything, or maybe we can parse it as status:incomplete.
    // Let's check: if EOF is the first token, we can return status:incomplete or a search term.
    // Wait! Let's check: "Invalid queries must produce helpful parse or validation errors with line, column, token, or nearby context where possible."
    // If we parse an empty query, we can throw ParseError or return a node. If we throw ParseError: "Empty query", that's fine.
    if (peek().type === 'EOF') {
      throw new ParseError('Query cannot be empty', peek());
    }

    const node = parseOr();
    if (peek().type !== 'EOF') {
      throw new ParseError(`Unexpected token "${peek().value}" at end of query`, peek());
    }
    return node;
  }

  // orExpr := andExpr (OR andExpr)*
  function parseOr(): QueryNode {
    const left = parseAnd();
    const children: QueryNode[] = [left];
    while (peek().type === 'OR') {
      next(); // consume 'or'
      children.push(parseAnd());
    }
    return children.length === 1 ? left : { type: 'or', children };
  }

  // andExpr := notExpr ((AND)? notExpr)*
  function parseAnd(): QueryNode {
    const left = parseNot();
    const children: QueryNode[] = [left];
    while (true) {
      const token = peek();
      if (token.type === 'AND') {
        next(); // consume explicit 'and'
        children.push(parseNot());
      } else if (canStartExpression(token.type)) {
        // implicit 'and'
        children.push(parseNot());
      } else {
        break;
      }
    }
    return children.length === 1 ? left : { type: 'and', children };
  }

  function canStartExpression(type: TokenType): boolean {
    return type === 'NOT' || type === 'LPAREN' || type === 'VALUE';
  }

  // notExpr := NOT notExpr | primary
  function parseNot(): QueryNode {
    if (peek().type === 'NOT') {
      next();
      const child = parseNot();
      return { type: 'not', child };
    }
    return parsePrimary();
  }

  // primary := term | "(" expression ")"
  function parsePrimary(): QueryNode {
    const token = peek();
    if (token.type === 'LPAREN') {
      next();
      const expr = parseOr();
      consume('RPAREN', `Expected closing parenthesis matching '(' at line ${token.line}, column ${token.column}`);
      return expr;
    }
    return parseTerm();
  }

  // term := fieldTerm | comparisonTerm | bareText
  function parseTerm(): QueryNode {
    const first = consume('VALUE', 'Expected search term or field');
    const second = peek();
    if (isOperator(second.type)) {
      next(); // consume operator
      const third = consume('VALUE', `Expected value after operator "${second.value}"`);

      const op = second.value as ':' | '<' | '<=' | '>' | '>=' | '=';
      return {
        type: 'term',
        field: first.value,
        operator: op,
        value: third.value,
      };
    } else {
      // bareText: no operator
      return {
        type: 'term',
        field: '',
        operator: ':',
        value: first.value,
      };
    }
  }

  function isOperator(type: TokenType): boolean {
    return (
      type === 'COLON' ||
      type === 'LESS' ||
      type === 'LESS_EQUALS' ||
      type === 'GREATER' ||
      type === 'GREATER_EQUALS' ||
      type === 'EQUALS'
    );
  }

  return parseQuery();
}
