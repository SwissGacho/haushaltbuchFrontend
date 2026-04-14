export class BoIdentifier {
    readonly type: string;
    readonly id?: number;
    readonly displayName?: string;
    readonly initialValues?: Record<string, unknown>;

    constructor( type: string, id?: number, initialValues?: Record<string, unknown>, displayName?: string ) {
        this.type = type;
        this.id = id;
        this.initialValues = initialValues;
        this.displayName = displayName;
    }
}