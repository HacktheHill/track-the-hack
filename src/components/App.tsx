import { useSession } from "next-auth/react";

import Navbar from "../components/Menu";
import Head from "./Head";

const App = ({ children }: { children: React.ReactNode }) => {
	const { data: sessionData } = useSession();

	return (
		<>
			<Head />
			<Navbar />
			<main className="p-4">
				<p>{sessionData && <span>Logged in as {sessionData.user?.name}</span>}</p>
				<br />
				{children}
			</main>
		</>
	);
};

export default App;
