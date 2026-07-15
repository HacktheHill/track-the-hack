declare module "next-pwa" {
	import type { NextConfig } from "next";

	const withPWA: (options: {
		dest: string;
		register?: boolean;
		disable?: boolean;
	}) => (config: NextConfig) => NextConfig;

	export = withPWA;
}
