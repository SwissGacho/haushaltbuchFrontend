import {
  ACCESS_LEVEL,
  ATTRIBUTE_TYPE,
  SEMANTIC_ROLE,
  AccessLevel,
  AttributeType,
  SemanticRole
} from './bo.schema.types';

export function isAttributeType(value: unknown): value is AttributeType {
  return typeof value === 'string'
    && (ATTRIBUTE_TYPE as readonly string[]).includes(value);
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === 'string'
    && (ACCESS_LEVEL as readonly string[]).includes(value);
}

export function isSemanticRole(value: unknown): value is SemanticRole {
  return typeof value === 'string'
    && (SEMANTIC_ROLE as readonly string[]).includes(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}