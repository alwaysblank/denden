import Hub from './hub';
import createQueue, {QueueRecord} from "./queue";

declare global {
    interface Window {
        denden: Hub;
        _dendenQueue: QueueRecord<unknown>[];
    }
}

window.denden = new Hub();
if ('_dendenQueue' in window && Array.isArray(window._dendenQueue)) {
    window._dendenQueue = createQueue(window.denden, (hub, record) => {
        const [channel, payload] = record;
        hub.pub(channel, payload);
    }, window._dendenQueue);
}