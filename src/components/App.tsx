import { Navbar, BottomMenu } from "./Navigation";
import Head from "./Head";

type AppProps = {
	children: React.ReactNode;
	integrated?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

const App = ({ children, integrated, ...rest }: AppProps) => {
	return (
		<>
			<Head />
			<div className="flex h-screen flex-col overflow-hidden overflow-y-auto supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
				<Navbar integrated={integrated} />
				<main {...rest} className={`flex-auto ${rest.className ?? ""}`}>
					{children}
				</main>
				<BottomMenu />
			</div>
		</>
	);
};

export default App;
