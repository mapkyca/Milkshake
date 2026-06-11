export type TokenType =
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'COLON'
  | 'LESS'
  | 'LESS_EQUALS'
  | 'GREATER'
  | 'GREATER_EQUALS'
  | 'EQUALS'
  | 'VALUE'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  index: number;
}

export type QueryNode =
  | { type: 'and'; children: QueryNode[] }
  | { type: 'or'; children: QueryNode[] }
  | { type: 'not'; child: QueryNode }
  | {
      type: 'term';
      field: string;
      operator: ':' | '<' | '<=' | '>' | '>=' | '=';
      value: string;
    };

export interface EvaluationContext {
  now: Date;
  timezone: string;
  startOfWeek: 'monday' | 'sunday';
}

export class TokenizeError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`${message} (at line ${line}, column ${column})`);
    this.name = 'TokenizeError';
  }
}

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(`${message} (at line ${token.line}, column ${token.column})`);
    this.name = 'ParseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
