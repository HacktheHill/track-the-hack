let audioContext: AudioContext | null = null;

function getAudioContext() {
	if (typeof window === "undefined") {
		return null;
	}
	if (!audioContext) {
		audioContext = new window.AudioContext();
	}
	return audioContext;
}

function playNote(frequency: number, duration: number, startTime: number) {
	const audioContext = getAudioContext();
	if (!audioContext) return;

	const oscillator = audioContext.createOscillator();
	const gainNode = audioContext.createGain();

	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);
	oscillator.connect(gainNode);
	gainNode.connect(audioContext.destination);

	gainNode.gain.setValueAtTime(1, audioContext.currentTime + startTime);

	oscillator.start(audioContext.currentTime + startTime);
	gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + startTime + duration);

	oscillator.stop(audioContext.currentTime + startTime + duration);
}

function vibrate(pattern: number[]) {
	if (navigator.vibrate) {
		navigator.vibrate(pattern);
	} else {
		console.log("Vibration API is not supported by this device.");
	}
}

function playSuccessSound() {
	playNote(293.66, 1, 0); // D4
	playNote(587.33, 1, 0.1); // D5

	vibrate([200]);
}

function playErrorSound() {
	playNote(130.813, 0.5, 0); // C3
	playNote(261.63, 0.5, 0); // C4
	playNote(523.25, 0.5, 0); // C5
	playNote(783.99, 0.5, 0); // G5
	playNote(1046.5, 0.5, 0); // C6

	playNote(130.813, 0.5, 0.1); // C3
	playNote(261.63, 0.5, 0.1); // C4
	playNote(523.25, 0.5, 0.1); // C5
	playNote(783.99, 0.5, 0.1); // G5
	playNote(1046.5, 0.5, 0.1); // C6

	vibrate([500, 200, 500]);
}

function playNeutralSound() {
	playNote(440, 1, 0); // A4

	vibrate([100]);
}

export { playSuccessSound, playErrorSound, playNeutralSound };
