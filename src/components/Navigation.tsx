import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

type NavbarProps = {
	integrated?: boolean;
};

const Navbar = ({ integrated }: NavbarProps) => {
	const { data: sessionData } = useSession();

	return (
		<nav
			className={`sticky top-0 z-10 flex gap-4 whitespace-nowrap bg-background1 p-4 ${
				integrated ? "" : "border-b border-dark shadow-navbar"
			}`}
			aria-label="Main navigation"
		>
			<div className="flex w-full items-center justify-center font-coolvetica mobile:w-auto">
				<Link href="/">
					<Image
						className="hidden mobile:block"
						priority
						src="/assets/hackthehill-logo.svg"
						height={64}
						width={64}
						alt="Home"
					/>
					<Image
						className="block mobile:hidden"
						priority
						src="/assets/hackthehill-banner.svg"
						height={238}
						width={238}
						alt="Home"
					/>
				</Link>
			</div>

			<div className="hidden flex-row mobile:flex">
				<Links />
			</div>

			<button
				className="right-4 ml-auto flex whitespace-nowrap rounded-lg border border-dark bg-background1 py-2 px-4 font-coolvetica text-dark transition-colors hover:bg-background3 logo-center:absolute sm:visible sm:mr-0"
				onClick={sessionData ? () => void signOut() : () => void signIn()}
			>
				{sessionData ? "Sign out" : "Sign in"}
			</button>
		</nav>
	);
};

const BottomMenu = () => {
	const { data: sessionData } = useSession();
	return (
		<nav
			className="sticky bottom-0 flex w-full items-center justify-evenly gap-8 whitespace-nowrap bg-background1 p-4 mobile:hidden"
			aria-label="Bottom navigation"
		>
			<Link href="/">
				<Image priority src="/assets/home.svg" height={32} width={32} alt="Home" />
			</Link>
			{sessionData?.user && (
				<Link href="/qr">
					<Image priority src="/assets/qr.svg" height={32} width={32} alt="QR" />
				</Link>
			)}
			<Link href="/schedule">
				<Image priority src="/assets/schedule.svg" height={32} width={32} alt="Schedule" />
			</Link>
			<Link href="/resources">
				<Image priority src="/assets/resources.svg" height={32} width={32} alt="Resources" />
			</Link>
			{sessionData?.user && (
				<Link href="/hackers">
					<Image priority src="/assets/list.svg" height={32} width={32} alt="Hackers" />
				</Link>
			)}
		</nav>
	);
};

const Links = () => {
	const { data: sessionData } = useSession();
	return (
		<>
			<Link href="/" className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light">
				Home
			</Link>
			{sessionData?.user && (
				<Link
					href="/qr"
					className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
				>
					QR
				</Link>
			)}
			<Link
				href="/schedule"
				className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
			>
				Schedule
			</Link>
			<Link
				href="/resources"
				className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
			>
				Resources
			</Link>
			{sessionData?.user && (
				<Link
					href="/hackers"
					className="mx-4 flex items-center font-coolvetica text-2xl text-dark hover:text-light"
				>
					Hackers
				</Link>
			)}
		</>
	);
};

export { Navbar, BottomMenu };
