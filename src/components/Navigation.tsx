import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

const Navbar = () => {
	const { data: sessionData } = useSession();

	return (
		<nav
			className="sticky top-0 z-10 flex gap-8 whitespace-nowrap border border-b border-dark bg-background1 p-4 text-gray-300 shadow-navbar"
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
				className="right-4 ml-auto flex whitespace-nowrap rounded border border-dark bg-background1 py-2 px-4 font-coolvetica text-dark transition-colors hover:bg-background3 sm:visible sm:mr-0 logo-center:absolute"
				onClick={sessionData ? () => void signOut() : () => void signIn()}
			>
				{sessionData ? "Sign out" : "Sign in"}
			</button>
		</nav>
	);
};

const BottomMenu = () => {
	return (
		<nav
			className="sticky bottom-0 hidden w-full items-center justify-evenly gap-8 whitespace-nowrap bg-background1 p-4 text-gray-300 md:flex"
			aria-label="Bottom navigation"
		>
			<Link href="/">
				<Image priority src="/assets/home.svg" height={32} width={32} alt="Home" />
			</Link>
			<Link href="/qr">
				<Image priority src="/assets/qr.svg" height={32} width={32} alt="QR" />
			</Link>
			<Link href="/schedule">
				<Image priority src="/assets/schedule.svg" height={32} width={32} alt="Schedule" />
			</Link>
			<Link href="/notifications">
				<Image priority src="/assets/notifs.svg" height={32} width={32} alt="Notifs" />
			</Link>
			<Link href="/resources">
				<Image priority src="/assets/resources.svg" height={32} width={32} alt="Resources" />
			</Link>
		</nav>
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
				href="/qr"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				QR
			</Link>
			<Link
				href="/schedule"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				Schedule
			</Link>
			<Link
				href="/notifications"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				Notifications
			</Link>
			<Link
				href="/resources"
				className={"ml-5 mr-5 flex items-center font-coolvetica text-2xl text-dark hover:text-light"}
			>
				Resources
			</Link>
		</>
	);
};

export { Navbar, BottomMenu };
