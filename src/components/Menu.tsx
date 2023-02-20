import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isExpired } from "../utils/helpers";
import Image from "next/image";

const Navbar = () => {
	const { data: sessionData } = useSession();
	const [open, setOpen] = useState(false);

	/*
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth > 640) {
				setOpen(false);
			}
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);
	*/

	return (
		<>
			<nav className="flex gap-8 whitespace-nowrap bg-nav p-4 text-gray-300 " aria-label="Main navigation">
				<div className="flex w-auto items-center justify-center md:w-full">
					<Link href="/">
						<Image
							className="block md:hidden"
							priority
							src="/assets/hackthehill-logo.svg"
							height={64}
							width={64}
							alt="Home"
						/>
						<Image
							className="hidden md:block"
							priority
							src="/assets/hackthehill-banner.svg"
							height={238}
							width={238}
							alt="Home"
						/>
					</Link>
				</div>

				<div className="flex flex-row md:hidden">
					<Links />
				</div>

				<button
					className="ml-auto flex whitespace-nowrap rounded border border-dark py-2 px-4 text-dark hover:text-dark_nav sm:visible sm:mr-0"
					onClick={sessionData ? () => void signOut() : () => void signIn()}
				>
					{sessionData ? "Sign out" : "Sign in"}
				</button>
			</nav>
			<nav
				className="absolute bottom-0 flex hidden w-full items-center justify-evenly gap-8 whitespace-nowrap bg-nav p-4 text-gray-300 md:flex"
				aria-label="Bottom navigation"
			>
				<BottomMenu />
			</nav>
		</>
	);
};
/*

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
*/

const BottomMenu = ({ navbar }: BottoMenuProps) => {
	return (
		<>
			<Link href="/">
				<Image priority src="/assets/home.svg" height={32} width={32} alt="Home" />
			</Link>
			<Link href="/">
				<Image priority src="/assets/qr.svg" height={32} width={32} alt="QR" />
			</Link>
			<Link href="/">
				<Image priority src="/assets/schedule.svg" height={32} width={32} alt="Schedule" />
			</Link>
			<Link href="/">
				<Image priority src="/assets/notifs.svg" height={32} width={32} alt="Notifs" />
			</Link>
			<Link href="/">
				<Image priority src="/assets/resources.svg" height={32} width={32} alt="Resources" />
			</Link>
		</>
	);
};

const Links = () => {
	return (
		<>
			<Link href="/" className={"ml-5 mr-5 flex items-center text-xl font-bold text-dark hover:text-dark_nav"}>
				Home
			</Link>
			<Link href="/" className={"ml-5 mr-5 flex items-center text-xl font-bold text-dark hover:text-dark_nav"}>
				QR
			</Link>
			<Link href="/" className={"ml-5 mr-5 flex items-center text-xl font-bold text-dark hover:text-dark_nav"}>
				Schedule
			</Link>
			<Link href="/" className={"ml-5 mr-5 flex items-center text-xl font-bold text-dark hover:text-dark_nav"}>
				Notifications
			</Link>
			<Link href="/" className={"ml-5 mr-5 flex items-center text-xl font-bold text-dark hover:text-dark_nav"}>
				Resources
			</Link>
		</>
	);
};

export default Navbar;
