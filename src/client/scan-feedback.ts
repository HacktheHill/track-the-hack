import type { ScanOutcome } from "@/server/services/scanner-workflows";

export type ScanFeedback = ScanOutcome | "error" | "view";

let context: AudioContext | null = null;

export const playScanFeedback = async (feedback: ScanFeedback) => {
	if (typeof window === "undefined") return;
	const cues: Record<ScanFeedback, { notes: number[]; vibration: number[] }> = {
		new: { notes: [523, 784], vibration: [120] },
		incremented: { notes: [587, 784, 988], vibration: [70, 40, 140] },
		unchanged: { notes: [392], vibration: [70, 80, 70] },
		limit: { notes: [392, 330], vibration: [90, 60, 90] },
		error: { notes: [330, 220], vibration: [250, 90, 250] },
		view: { notes: [440], vibration: [60] },
	};
	const cue = cues[feedback];
	try {
		window.navigator.vibrate?.(cue.vibration);
	} catch {
		// Visual feedback remains available when vibration is unsupported.
	}
	try {
		const audio = (context ??= new window.AudioContext());
		if (audio.state === "suspended") await audio.resume();
		const start = audio.currentTime;
		cue.notes.forEach((frequency, index) => {
			const oscillator = audio.createOscillator();
			const volume = audio.createGain();
			const noteStart = start + index * 0.14;
			oscillator.frequency.value = frequency;
			oscillator.type = "triangle";
			volume.gain.setValueAtTime(0.001, noteStart);
			volume.gain.exponentialRampToValueAtTime(0.2, noteStart + 0.01);
			volume.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.2);
			oscillator.connect(volume).connect(audio.destination);
			oscillator.start(noteStart);
			oscillator.stop(noteStart + 0.2);
		});
	} catch {
		// Visual feedback remains available when audio is blocked or unsupported.
	}
};
