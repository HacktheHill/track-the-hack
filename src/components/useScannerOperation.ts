import { useMemo, useRef, useState } from "react";

// One synchronous gate for scans and adjustments, including callbacks fired
// before React has rendered disabled controls.
export const useScannerOperation = () => {
	const locked = useRef(false);
	const [pending, setPending] = useState(false);
	const controls = useMemo(
		() => ({
			begin: () => {
				if (locked.current) return false;
				locked.current = true;
				setPending(true);
				return true;
			},
			end: () => {
				locked.current = false;
				setPending(false);
			},
			isPending: () => locked.current,
		}),
		[],
	);
	// Keep callbacks stable so camera scanning is not restarted on every request.
	return { operation: controls, pending };
};
export type ScannerOperation = ReturnType<typeof useScannerOperation>["operation"];
