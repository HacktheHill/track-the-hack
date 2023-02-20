import { Navbar, BottomMenu } from "../components/Menu";
import Head from "./Head";

type AppProps = {
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const App = ({ children, ...rest }: AppProps) => {
	return (
		<>
			<Head />
			<Navbar />
			<div className="min-h-[calc(100vh-var(--navbar-height)*2)] flex h-full flex-col">
				<main {...rest}>{children}</main>
			</div>
			<BottomMenu />
		</>
	);
};

export default App;
