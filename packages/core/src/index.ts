export type GreetingOptions = {
	name: string;
};

export function buildGreeting(options: GreetingOptions): string {
	return `Hello, ${options.name}`;
}
