import Hub from './hub';

declare global {
	interface Window {
		PubSub: Hub;
	}
}

window.PubSub = new Hub();