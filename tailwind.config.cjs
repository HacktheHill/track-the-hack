/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx}", "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}"],
	theme: {
		transparent: "transparent",
		current: "currentColor",
		darkMode: "class",
		extend: {
			backgroundImage: {
				gradient:
					"linear-gradient(0deg, rgba(239, 203, 255, 0) 15%, rgba(236, 211, 247, 0.7723) 48.85%, rgba(236, 210, 248, 0.7373) 48.86%, #ebd5f5 63.96%, #bfcbee 80.96%, #bfcbee 81.77%,#abeffa 100%)",
				gradient1: "linear-gradient(180deg, #5C71AD 0%, #90A1D4 15.1%, #A4B4E2 79.69%, #B2C2ED 96.87%)",
				gradient2: "linear-gradient(180deg, #BFCFF6 11.47%, #5C71AD 146.86%)",
				gradient3: "linear-gradient(180deg, #90A1D4 80%, #BFCFF6 100%)",
			},
			screens: {
				"logo-center": "600px",
				mobile: "900px",
				short: { raw: "(min-height: 700px)" },
				xs: "400px",
			},
			colors: {
				dark: "#3b4779",
				medium: "#3f4e77",
				light: "#5c71ad",
				background1: "#BFCFF6",
				background2: "#90A1D4",
				background3: "#B2CEED",
				accent1: "#FFFFFF",
				accent2: "#BFCFF6",
				accent3: "#5C71AD",
				accent4: "#3B4779",
				tremor: {
					brand: {
						faint: "#5c71ad",
						muted: "#5c71ad",
						subtle: "#5c71ad",
						DEFAULT: "#BFCFF6",
						emphasis: "#5c71ad",
						inverted: "#BFCFF6",
					},
					background: {
						muted: "#5c71ad",
						subtle: "#3f4e77",
						DEFAULT: "#3b4779",
						emphasis: "#3f4e77",
					},
					border: {
						DEFAULT: "#5c71ad",
					},
					ring: {
						DEFAULT: "#3b4779",
					},
					content: {
						subtle: "#BFCFF6",
						DEFAULT: "#BFCFF6",
						emphasis: "#ffffff",
						strong: "#BFCFF6",
						inverted: "#000000",
					},
				},
			},
			content: {
				check: `url(data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Cpath%20d%3D%22M470.6%20105.4c12.5%2012.5%2012.5%2032.8%200%2045.3l-256%20256c-12.5%2012.5-32.8%2012.5-45.3%200l-128-128c-12.5-12.5-12.5-32.8%200-45.3s32.8-12.5%2045.3%200L192%20338.7%20425.4%20105.4c12.5-12.5%2032.8-12.5%2045.3%200z%22%2F%3E%3C%2Fsvg%3E)`,
			},
			boxShadow: {
				// light
				"tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
				"tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
				"tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
				// dark
				"dark-tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
				"dark-tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
				"dark-tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
			},
			borderRadius: {
				normal: "100px",
				"tremor-small": "0.375rem",
				"tremor-default": "0.5rem",
				"tremor-full": "9999px",
			},
			fontFamily: {
				coolvetica: ["Coolvetica", "sans-serif"],
				rubik: ["Rubik", "sans-serif"],
			},
			fontSize: {
				"tremor-label": ["0.75rem"],
				"tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
				"tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
				"tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
			},
			boxShadow: {
				navbar: "0 4px 4px rgba(0, 0, 0, 0.25)",
			},
			animation: {
				"snowflake-fall": "snowflake-fall linear infinite",
				"cloud-drift": "cloud-drift linear infinite alternate",
			},
			keyframes: {
				"snowflake-fall": {
					"0%": { transform: "translateY(-100vh)" },
					"100%": { transform: "translateY(100vh)" },
				},
				"cloud-drift": {
					"0%": { transform: "translateX(-100vw)" },
					"100%": { transform: "translateX(100vw)" },
				},
			},
		},
	},
	safelist: [
		{
			pattern:
				/^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
			variants: ["hover", "ui-selected"],
		},
		{
			pattern:
				/^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
			variants: ["hover", "ui-selected"],
		},
		{
			pattern:
				/^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
			variants: ["hover", "ui-selected"],
		},
		{
			pattern:
				/^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
		},
		{
			pattern:
				/^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
		},
		{
			pattern:
				/^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
		},
	],
	plugins: [require("@headlessui/tailwindcss")],
};
