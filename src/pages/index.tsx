import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { useEffect, useState } from "react";
import type { z } from "zod";

import Details from "../components/Details";
import Navbar from "../components/Menu";
import QRCode from "../components/QRCode";
import QRScanner from "../components/QRScanner";
import Table from "../components/Table";

import { trpc } from "../utils/api";
import type { roles } from "../utils/common";

const Home: NextPage = () => {
	const { data: sessionData } = useSession();

	return (
		<>
			<Head>
				<title>Track the Hack</title>
				<meta name="description" content="Generated by create-t3-app" />
				<link rel="icon" href="/favicon.ico" />
				<link rel="manifest" href="/manifest.json" />
				<meta name="theme-color" content="#2d3748" />
			</Head>
			<Navbar />
			<main className="p-4">
				<p>{sessionData && <span>Logged in as {sessionData.user?.name}</span>}</p>
				<View />
			</main>
		</>
	);
};

const View = () => {
	const { data: sessionData } = useSession();
	const [role, setRole] = useState<z.infer<typeof roles> | null>(null);

	const mutation = trpc.users.setRole.useMutation();
	const query = trpc.users.getRole.useQuery(
		{
			id: sessionData?.user?.id ?? "",
		},
		{
			enabled: !!sessionData?.user?.id,
		},
	);

	useEffect(() => {
		if (query.data) {
			setRole(query.data);
		}
	}, [query.data]);

	const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const { value } = event.target;
		mutation.mutate({
			id: sessionData?.user?.id ?? "",
			role: value.toUpperCase(),
		});
		setRole(value as z.infer<typeof roles>);
	};

	if (query.isLoading) return <p>Loading...</p>;
	if (query.isError) return <p>Error: {query.error.message}</p>;

	return (
		<>
			<div>
				<label htmlFor="role">Role</label>
				<select id="role" onChange={handleChange} value={role ?? ""}>
					<option value="ORGANIZER">Organizer</option>
					<option value="SPONSOR">Sponsor</option>
					<option value="HACKER">Hacker</option>
				</select>
			</div>
			{role === "ORGANIZER" && <OrganizerView />}
			{role === "SPONSOR" && <SponsorView />}
			{role === "HACKER" && <HackerView />}
		</>
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
