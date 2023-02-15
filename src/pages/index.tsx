import { type NextPage } from "next";
import { useState } from "react";
import type { z } from "zod";

import App from "../components/App";
import RoleSelect from "../components/RoleSelect";
import OnlyRole from "../components/OnlyRole";
import Details from "../components/Details";
import QRCode from "../components/QRCode";
import QRScanner from "../components/QRScanner";
import Table from "../components/Table";

import type { roles } from "../utils/common";

const Home: NextPage = () => {
	return (
		<App>
			<RoleSelect />

			<OnlyRole filter={(role: z.infer<typeof roles>) => role === "ORGANIZER"}>
				<OrganizerView />
			</OnlyRole>
			<OnlyRole filter={(role: z.infer<typeof roles>) => role === "SPONSOR"}>
				<SponsorView />
			</OnlyRole>
			<OnlyRole filter={(role: z.infer<typeof roles>) => role === "HACKER"}>
				<HackerView />
			</OnlyRole>
		</App>
	);
};

const OrganizerView = () => {
	const [id, setId] = useState<string | null>(null);
	return (
		<>
			<QRScanner setId={setId} />
			{id}
			{id && <Details id={id} />}
			<Table />
		</>
	);
};

const SponsorView = () => {
	return (
		<>
			<Table />
		</>
	);
};

const HackerView = () => {
	return (
		<>
			<QRCode />
		</>
	);
};

export default Home;
