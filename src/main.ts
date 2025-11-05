import Hub from './hub';

declare global {
	interface Window {
		denden: Hub;
	}
}

window.denden = new Hub();