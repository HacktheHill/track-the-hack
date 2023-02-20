import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { isExpired } from "../utils/helpers";
import Image from "next/image";

const Navbar = () => {
	const { data: sessionData } = useSession();

	return (
		<>
			<nav
				className="flex gap-8 whitespace-nowrap bg-background1 p-4 text-gray-300 "
				aria-label="Main navigation"
			>
				<div className="flex w-auto items-center justify-center font-coolvetica md:w-full">
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
					className="ml-auto flex whitespace-nowrap rounded border border-dark py-2 px-4 font-coolvetica text-dark hover:text-light sm:visible sm:mr-0"
					onClick={sessionData ? () => void signOut() : () => void signIn()}
				>
					{sessionData ? "Sign out" : "Sign in"}
				</button>
			</nav>
			<nav
				className="absolute bottom-0 hidden w-full items-center justify-evenly gap-8 whitespace-nowrap bg-background1 p-4 text-gray-300 md:flex"
				aria-label="Bottom navigation"
			>
				<BottomMenu />
			</nav>
		</>
	);
};

const BottomMenu = ({ navbar }: BottomMenuProps) => {
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
			<Link
				href="/"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				Home
			</Link>
			<Link
				href="/"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				QR
			</Link>
			<Link
				href="/"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				Schedule
			</Link>
			<Link
				href="/"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				Notifications
			</Link>
			<Link
				href="/"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				Resources
			</Link>
		</>
	);
};

export default Navbar;
