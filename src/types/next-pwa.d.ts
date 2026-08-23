declare module "next-pwa" {
	import type { NextConfig } from "next";

	type RuntimeCaching = {
		urlPattern: RegExp | ((context: { url: URL }) => boolean);
		handler: string;
		method?: string;
		options?: Record<string, unknown>;
	};

	const withPWA: (options: {
		dest: string;
		register?: boolean;
		disable?: boolean;
		buildExcludes?: (string | RegExp)[];
		additionalManifestEntries?: { url: string; revision: string | null }[];
		fallbacks?: { document?: string };
		runtimeCaching?: RuntimeCaching[];
	}) => (config: NextConfig) => NextConfig;

	export = withPWA;
}

declare module "next-pwa/cache" {
	const runtimeCaching: {
		urlPattern: RegExp | ((context: { url: URL }) => boolean);
		handler: string;
		method?: string;
		options?: Record<string, unknown>;
	}[];

	export = runtimeCaching;
}
