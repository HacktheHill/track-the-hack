import { Navbar, BottomMenu } from "../components/Menu";
import Head from "./Head";

type AppProps = {
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const App = ({ children, ...rest }: AppProps) => {
	return (
		<>
			<Head />
			<div className="flex h-screen flex-col overflow-hidden supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
				<Navbar />
				<div className="flex-auto">
					<main {...rest}>{children}</main>
				</div>
				<BottomMenu />
			</div>
		</>
	);
};

export default App;
