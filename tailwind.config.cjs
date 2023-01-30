/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			backgroundImage: {
				gradient:
					"linear-gradient(0deg, rgba(239, 203, 255, 0) 15%, rgba(236, 211, 247, 0.7723) 48.85%, rgba(236, 210, 248, 0.7373) 48.86%, #ebd5f5 63.96%, #bfcbee 80.96%, #bfcbee 81.77%,#abeffa 100%)",
			},
			colors: {
				dark: "#3b4779",
				medium: "#3f4e77",
				light: "#5c71ad",
			},
			content: {
				check: `url(data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Cpath%20d%3D%22M470.6%20105.4c12.5%2012.5%2012.5%2032.8%200%2045.3l-256%20256c-12.5%2012.5-32.8%2012.5-45.3%200l-128-128c-12.5-12.5-12.5-32.8%200-45.3s32.8-12.5%2045.3%200L192%20338.7%20425.4%20105.4c12.5-12.5%2032.8-12.5%2045.3%200z%22%2F%3E%3C%2Fsvg%3E)`,
			},
			borderRadius: {
				normal: "100px"
			}
		},
	},
	plugins: [],
};
