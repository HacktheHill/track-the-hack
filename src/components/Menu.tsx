import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isExpired } from "../utils/helpers";

const Navbar = () => {
	const { data: sessionData } = useSession();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth > 640) {
				setOpen(false);
			}
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return (
		<>
			<nav className="flex gap-8 whitespace-nowrap bg-gray-800 p-4 text-gray-300" aria-label="Main navigation">
				<Links navbar={true} />
				<button
					className="invisible ml-auto mr-12 flex whitespace-nowrap rounded border py-2 px-4 hover:text-white sm:visible sm:mr-0"
					onClick={sessionData ? () => void signOut() : () => void signIn()}
				>
					{sessionData ? "Sign out" : "Sign in"}
				</button>
				<button
					className="absolute top-6 right-4 z-20 sm:hidden"
					onClick={() => setOpen(!open)}
					aria-pressed={open}
				>
					<svg className="h-8 w-8 fill-current" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
						<title>Menu</title>
						<path
							d="M0 3h20v2H0V3z"
							className={`origin-top-left transition duration-500 ${
								open ? "translate-x-1/4 rotate-45" : ""
							}`}
						/>
						<path d="M0 9h20v2H0V9z" className={`transition duration-500 ${open ? "opacity-0" : ""}`} />
						<path
							d="M0 15h20v2H0v-2z"
							className={`origin-bottom-left transition duration-500 ${
								open ? "translate-x-1/4 -rotate-45" : ""
							}`}
						/>
					</svg>
				</button>
			</nav>
			<Hamburger open={open} />
		</>
	);
};

type HamburgerProps = {
	open: boolean;
};
const Hamburger = ({ open }: HamburgerProps) => {
	const { data: sessionData } = useSession();

	return (
		<nav
			aria-label="Mobile navigation"
			className={`fixed inset-0 z-10 flex w-screen flex-col flex-wrap items-center justify-center gap-8 bg-gray-800 p-6 text-gray-300 transition duration-500 ${
				open ? "" : "translate-x-full"
			}`}
			aria-hidden={!open}
		>
			<Links />
			<button
				className="rounded border px-4 py-2 hover:text-white"
				onClick={sessionData ? () => void signOut() : () => void signIn()}
			>
				{sessionData && !isExpired(sessionData?.expires) ? "Sign out" : "Sign in"}
			</button>
		</nav>
	);
};

type LinksProps = {
	navbar?: boolean;
};
const Links = ({ navbar }: LinksProps) => {
	return (
		<>
			<h1 className="flex items-center text-xl font-bold">Track the Hack</h1>
			<Link href="/" className={`flex items-center hover:text-white ${navbar ? "hidden sm:flex" : ""}`}>
				Home
			</Link>
			<Link href="/about" className={`flex items-center hover:text-white ${navbar ? "hidden sm:flex" : ""}`}>
				About
			</Link>
		</>
	);
};

export default Navbar;
