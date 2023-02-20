import { Navbar, BottomMenu } from "../components/Menu";
import Head from "./Head";

type AppProps = {
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const App = ({ children, ...rest }: AppProps) => {
	return (
		<>
			<Head />
			<div className="flex h-screen flex-col">
				<Navbar />
				<main {...rest}>{children}</main>
				<BottomMenu />
			</div>
		</>
	);
};

export default App;
