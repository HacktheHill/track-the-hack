declare module "@root/public/assets/hero/*.svg" {
	import type { StaticImageData } from "next/image";

	const content: StaticImageData;
	export default content;
}
