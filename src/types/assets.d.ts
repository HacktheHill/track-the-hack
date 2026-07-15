declare module "*.svg" {
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports
	const content: import("next/image").StaticImageData;
	export default content;
}
