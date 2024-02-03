import { nextui } from "@nextui-org/react";
/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx}", "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			backgroundImage: {
				"default-gradient": "linear-gradient(#080508, #5a1656, #6a2468, #80438d)",
				"medium-gradient": "linear-gradient(#f8cc8d, #dd484d)",
			},
			screens: {
				"logo-center": "600px",
				mobile: "900px",
				short: { raw: "(min-height: 700px)" },
				xs: "400px",
			},
			colors: {
				"light-color": "black",
				"dark-color": "white",
				"light-secondary-color": "#994697",
				"medium-secondary-color": "#6a2468",
				"dark-secondary-color": "#4f104e",
				"light-tertiary-color": "#961a63",
				"light-primary-color": "#fac3e3",
				"medium-primary-color": "#cd3f93",
				"dark-primary-color": "#961a63",
				"highlight-color": "#FFFFFF",
				"light-quaternary-color": "#381234",
			},
			content: {
				check: `url(data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Cpath%20d%3D%22M470.6%20105.4c12.5%2012.5%2012.5%2032.8%200%2045.3l-256%20256c-12.5%2012.5-32.8%2012.5-45.3%200l-128-128c-12.5-12.5-12.5-32.8%200-45.3s32.8-12.5%2045.3%200L192%20338.7%20425.4%20105.4c12.5-12.5%2032.8-12.5%2045.3%200z%22%2F%3E%3C%2Fsvg%3E)`,
			},
			borderRadius: {
				normal: "100px",
			},
			fontFamily: {
				coolvetica: ["Coolvetica", "sans-serif"],
				rubik: ["Rubik", "sans-serif"],
			},
			boxShadow: {
				navbar: "0 4px 4px rgba(0, 0, 0, 0.25)",
			},
			animation: {
				"snowflake-fall": "snowflake-fall linear infinite",
				"cloud-drift": "cloud-drift linear infinite alternate",
				"hoverAnimation": "hoverAnimation 2s infinite",
			},
			keyframes: {
				"snowflake-fall": {
					"0%": { transform: "translateY(-100vh)" },
					"100%": { transform: "translateY(100vh)" },
				},
				"hoverAnimation": {
					"0%" : {
					  transform: "translateY(0)"
					},
					"50%" : {
					  transform: "translateY(-5px)"
					},
					"100%" : {
					  transform: "translateY(0)"
					},
				},
				"cloud-drift": {
					"0%": { transform: "translateX(-100vw)" },
					"100%": { transform: "translateX(100vw)" },
				},
			},
		},
	},
	darkMode: "class",
	plugins: [nextui()],
};
