export class BoIdentifier {
    readonly type: string;
    readonly id: number;
    readonly display_name?: string;

    constructor( type: string, id: number, display_name?: string) {
        this.type = type;
        this.id = id;
    }
}