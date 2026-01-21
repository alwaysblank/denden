import Message from "./message";

export const LifecycleTypes = [
    'CALLBACKS-FINISHED',
];

export default class Lifecycle<T> extends Event {
    static NAME = 'ddm:lifecycle';
    public readonly event: typeof LifecycleTypes[number];
    public readonly data: T;

    constructor(evt: Lifecycle<T>['event'], data: T) {
        super(Lifecycle.NAME, {bubbles: false});
        this.event = evt;
        this.data = data;
    }
}

export class CallbacksFinished extends Lifecycle<{message: Message, results: Array<unknown>}> {
    static TYPE = 'CALLBACKS-FINISHED' as const;

    constructor(message: Message, results: Array<any>) {
        super(CallbacksFinished.TYPE, {
            message,
            results,
        });
    }
}