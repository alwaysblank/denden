export const LogLevel = {
	FATAL: 0,
	ERROR: 1,
	WARN: 2,
	INFO: 3,
	DEBUG: 4,
} as const;

/**
 * Log a message.
 */
export function log(level: keyof typeof LogLevel, message: string, data?: any) {
	dispatchEvent(new CustomEvent('denden-log', {detail: {...arguments}}));

	if (dendenHideLogs) {
		return;
	}

	switch (level) {
		case 'FATAL':
			console.error(`💣 FATAL ERROR: ${message}`, data);
			break;
		case "ERROR":
			console.error(message, data);
			break;
		case 'WARN':
			console.warn(message, data);
			break;
		case "INFO":
			console.info(message, data);
			break;
		case "DEBUG":
			console.debug(message, data);
			break;
	}
}