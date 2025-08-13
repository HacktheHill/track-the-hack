// Shared constants for deadlines, feature flags, etc.

// ISO date string (UTC) for application deadline
export const APPLICATION_DEADLINE = "2025-10-07T00:00:00.000Z";

// Feature flags
export const FEATURE_FLAGS = {
	APPLICATION_OPEN: true,
	SHOW_QR_AFTER_ACCEPTED: true,
};

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
