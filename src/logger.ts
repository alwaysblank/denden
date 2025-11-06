export function log(level: 'ERROR'|'DEBUG'|'INFO', message: string, data?: any) {
	switch (level) {
		case 'ERROR':
			console.error(message, data);
			break;
		case 'INFO':
			console.info(message, data);
			break;
		case 'DEBUG':
			console.debug(message, data);
			break;
	}
}