export const ATTRIBUTE_TYPE = [
    "int",
    "str",
    "date",
    "datetime",
    "dict",
    "list",
    "flag",
    "relation",
] as const;
export type AttributeType = typeof ATTRIBUTE_TYPE[number];

export const ACCESS_LEVEL = ["write_only", "read_only", "read_write"] as const;
export type AccessLevel = typeof ACCESS_LEVEL[number];

export const SEMANTIC_ROLE = ["raw", "boname"] as const;
export type SemanticRole = typeof SEMANTIC_ROLE[number];

export interface AttributeSchema {
  type: AttributeType;
  flags: Record<string, unknown | SemanticRole>;
  accessLevel: AccessLevel;
}

export type ObjectSchema = Record<string, AttributeSchema>;