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

    const { type, flags, access_level } = input;
    const parsedFlags = isRecord(flags) ? flags : {};
    const rawSemanticRole = parsedFlags['semantic_role'];
    const semanticRole = isRecord(rawSemanticRole)
        ? rawSemanticRole['semantic_role']
        : undefined;

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

    if (semanticRole == undefined || !isSemanticRole(semanticRole)) {
        throw new SchemaParseError(
            `Attribute schema '${attributeName}' has invalid flags.semantic_role '${String(semanticRole)}'.`
        );
    }

    return {
        type,
        flags: parsedFlags,
        accessLevel: access_level
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