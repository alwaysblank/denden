import Hub from './hub';
import Queue, {QueueRecord} from "./queue";

declare global {
    interface Window {
        denden: Hub;
        _dendenQueue: QueueRecord<unknown>[];
    }
}

window.denden = new Hub();
if ('_dendenQueue' in window && Array.isArray(window._dendenQueue)) {
    window._dendenQueue = Queue(window._dendenQueue, window.denden);
}