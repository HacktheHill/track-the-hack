/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
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
	plugins: [],
};
