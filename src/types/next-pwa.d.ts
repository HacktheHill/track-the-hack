declare module "next-pwa" {
	import type { NextConfig } from "next";
	import type { WebpackGenerateSWOptions } from "workbox-build";

	type NextPwaOptions = WebpackGenerateSWOptions & {
		dest?: string;
		register?: boolean;
		disable?: boolean;
		buildExcludes?: WebpackGenerateSWOptions["exclude"];
		fallbacks?: Partial<Record<"audio" | "data" | "document" | "font" | "image" | "video", string>>;
	};

	const withPWA: (options?: NextPwaOptions) => (config?: NextConfig) => NextConfig;

	export = withPWA;
}

declare module "next-pwa/cache" {
	import type { WebpackGenerateSWOptions } from "workbox-build";

	const runtimeCaching: NonNullable<WebpackGenerateSWOptions["runtimeCaching"]>;

	export = runtimeCaching;
}
