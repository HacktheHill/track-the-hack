import { Role } from "@prisma/client";
import { type NextPage } from "next";
import { useState } from "react";

import App from "../components/App";
import Details from "../components/Details";
import OnlyRole from "../components/OnlyRole";
import QRCode from "../components/QRCode";
import QRScanner from "../components/QRScanner";
import RoleSelect from "../components/RoleSelect";
import Table from "../components/Table";

const Home: NextPage = () => {
	return (
		<App>
			<RoleSelect />
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				<OrganizerView />
			</OnlyRole>
			<OnlyRole filter={role => role === "SPONSOR"}>
				<SponsorView />
			</OnlyRole>
			<OnlyRole filter={role => role === "HACKER"}>
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
