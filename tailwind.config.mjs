/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./src/**/*.{js,ts,jsx,tsx}",
		"./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		current: "currentColor",
		extend: {
			backgroundImage: {
				"default-gradient": "linear-gradient(#C7734F, #EA8A60, #EE9E6F, #F6BC83)",
				"medium-gradient": "linear-gradient(#f8cc8d, #dd484d)",
			},
			screens: {
				mobile: "900px",
				short: { raw: "(min-height: 700px)" },
				xs: "400px",
			},
			colors: {
				"light-color": "white",
				"dark-color": "black",
				"light-secondary-color": "#fff3b6",
				"medium-secondary-color": "#f8cc8d",
				"dark-secondary-color": "#f6bf70",
				"light-tertiary-color": "#ea885f",
				"light-primary-color": "#dd484d",
				"medium-primary-color": "#c11f25",
				"dark-primary-color": "#84010b",
				"highlight-color": "#650014",
				"light-quaternary-color": "#F5C18C",
			},
			content: {
				check: `url(data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Cpath%20d%3D%22M470.6%20105.4c12.5%2012.5%2012.5%2032.8%200%2045.3l-256%20256c-12.5%2012.5-32.8%2012.5-45.3%200l-128-128c-12.5-12.5-12.5-32.8%200-45.3s32.8-12.5%2045.3%200L192%20338.7%20425.4%20105.4c12.5-12.5%2032.8-12.5%2045.3%200z%22%2F%3E%3C%2Fsvg%3E)`,
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
				"fade-in": "fade-in linear forwards",
				"snowflake-fall": "snowflake-fall linear infinite",
				"cloud-drift": "cloud-drift linear infinite alternate",
			},
			keyframes: {
				"fade-in": {
					"0%": { opacity: 0 },
					"100%": { opacity: 1 },
				},
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
	plugins: []
};
