import { Role } from "@prisma/client";
import { type NextPage } from "next";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import App from "../components/App";
import OnlyRole from "../components/OnlyRole";
import QRCode from "../components/QRCode";
import QRScanner from "../components/QRScanner";
import RoleSelect from "../components/RoleSelect";
import Table from "../components/Table";

const Home: NextPage = () => {
	const router = useRouter();

	useEffect(() => {
		const handler = () => router.back();
		addEventListener("onpopstate", handler);
		return () => {
			removeEventListener("onpopstate", handler);
		};
	}, [router]);

	return (
		<App>
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				<RoleSelect />
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
	const router = useRouter();
	const [id, setId] = useState<string | null>(null);

	useEffect(() => {
		if (id) {
			void router.push(`/hacker?id=${id}`);
		}
	}, [id, router]);

	return (
		<>
			<QRScanner setId={setId} />
			{id}
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
