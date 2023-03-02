import Head from "./Head";
import { BottomMenu, Navbar } from "./Navigation";

type AppProps = {
	children: React.ReactNode;
	title?: string;
	noIndex?: boolean;
	integrated?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

const App = ({ children, title, noIndex, integrated, ...rest }: AppProps) => {
	return (
		<>
			<Head title={title} noIndex={noIndex} />
			<div className="flex h-screen flex-col overflow-hidden supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
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
