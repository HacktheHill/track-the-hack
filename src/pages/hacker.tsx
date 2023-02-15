import { type NextPage } from "next";
import type { z } from "zod";

import App from "../components/App";
import OnlyRole from "../components/OnlyRole";

import type { roles } from "../utils/common";

const Hacker: NextPage = () => {
	return (
		<App>
			<OnlyRole filter={(role: z.infer<typeof roles>) => role === "SPONSOR" || role === "ORGANIZER"}>
				<HackerView />
			</OnlyRole>
			<OnlyRole filter={(role: z.infer<typeof roles>) => role === "HACKER"}>
				You are not authorized to view this page.
			</OnlyRole>
		</App>
	);
};

const HackerView = () => {
	return <p>HackerView</p>;
};

export default Hacker;
