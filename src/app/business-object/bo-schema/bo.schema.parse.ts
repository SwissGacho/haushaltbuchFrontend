import { AttributeSchema, ObjectSchema } from './bo.schema.types';
import {
    isAccessLevel,
    isAttributeType,
    isRecord,
    isSemanticRole
} from './bo.schema.guards';

// A Fine and Furious Error for Corrupt Metadata
export class SchemaParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SchemaParseError';
    }
}

// Parse a single attribute definition
export function parseAttributeSchema(
    input: unknown,
    attributeName = '<unknown>'
): AttributeSchema {
    if (!isRecord(input)) {
        throw new SchemaParseError(
            `Attribute schema '${attributeName}' is not an object.`
        );
    }

    const { type, flags, access_level, semantic_role } = input;

    if (!isAttributeType(type)) {
        throw new SchemaParseError(
            `Attribute schema '${attributeName}' has invalid type '${String(type)}'.`
        );
    }

    if (!isAccessLevel(access_level)) {
        throw new SchemaParseError(
            `Attribute schema '${attributeName}' has invalid access_level '${String(access_level)}'.`
        );
    }

    if (!isSemanticRole(semantic_role)) {
        throw new SchemaParseError(
            `Attribute schema '${attributeName}' has invalid semantic_role '${String(semantic_role)}'.`
        );
    }

    return {
        type,
        flags: isRecord(flags) ? flags : {},
        accessLevel: access_level,
        semanticRole: semantic_role
    };
}

// Parse a full object schema
export function parseObjectSchema(input: unknown): ObjectSchema {
    if (!isRecord(input)) {
        throw new SchemaParseError('Object schema is not an object.');
    }

    const result: ObjectSchema = {};

    for (const [attributeName, rawAttributeSchema] of Object.entries(input)) {
        result[attributeName] = parseAttributeSchema(rawAttributeSchema, attributeName);
    }

    return result;
}