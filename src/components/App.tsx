import { Navbar, BottomMenu } from "./Navigation";
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
				<main {...rest} className={`flex-auto ${rest.className ?? ""}`}>
					{children}
				</main>
				<BottomMenu />
			</div>
		</>
	);
};

export default App;
