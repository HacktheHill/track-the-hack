import Navbar from "../components/Menu";
import Head from "./Head";

type AppProps = {
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const App = ({ children, ...rest }: AppProps) => {
	return (
		<>
			<Head />
			<div className="flex flex-col h-screen">
				<Navbar />
				<main {...rest}>{children}</main>
			</div>
		</>
	);
};

export default App;
