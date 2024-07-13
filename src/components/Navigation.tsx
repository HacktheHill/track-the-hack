import { Role } from "@prisma/client";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import Link from "next/link";
import { trpc } from "../utils/api";
import Filter from "./Filter";
import { useCallback } from "react";

type LinkItemProps = {
	href: string;
	bottom: boolean;
	text: string;
	src: string;
	alt: string;
};

const LinkItem = ({ href, bottom, text, src, alt }: LinkItemProps) => (
	<Link
		href={href}
		className={
			bottom ? "" : "hover:text-light mx-4 flex items-center font-coolvetica text-2xl text-dark-primary-color"
		}
	>
		{bottom ? <Image priority src={src} height={32} width={32} alt={alt} /> : text}
	</Link>
);

type LinkProps = {
	bottom: boolean;
};

const Links = ({ bottom }: LinkProps) => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();

	const qrFilter = useCallback(
		(role: Role) => !!(role === Role.HACKER && sessionData?.user?.hackerId) || role === Role.ORGANIZER,
		[sessionData?.user?.hackerId],
	);

	return (
		<>
			<LinkItem href="/" bottom={bottom} text={t("home")} src="/assets/home.svg" alt={t("home")} />
			<Filter filter={qrFilter} silent>
				<LinkItem href="/qr" bottom={bottom} text={t("qr")} src="/assets/qr.svg" alt={t("qr")} />
			</Filter>
			<LinkItem
				href="/schedule"
				bottom={bottom}
				text={t("schedule")}
				src="/assets/schedule.svg"
				alt={t("schedule")}
			/>
			<LinkItem href="/maps" bottom={bottom} text={t("maps")} src="/assets/maps.svg" alt={t("maps")} />
			<LinkItem
				href="/resources"
				bottom={bottom}
				text={t("resources")}
				src="/assets/resources.svg"
				alt="Resources"
			/>
			{sessionData?.user && (
				<Filter filter={role => role === Role.ORGANIZER || role === Role.SPONSOR} silent>
					<LinkItem
						href="/hackers"
						bottom={bottom}
						text={t("hackers")}
						src="/assets/list.svg"
						alt={t("hackers")}
					/>
				</Filter>
			)}
		</>
	);
};

type NavbarProps = {
	integrated?: boolean;
};

const Navbar = ({ integrated }: NavbarProps) => {
	const { t } = useTranslation("navbar");
	const { data: sessionData } = useSession();

	return (
		<nav
			className={`sticky top-0 z-10 flex gap-4 whitespace-nowrap bg-light-quaternary-color p-4 ${
				integrated ? "" : "border-b border-dark-primary-color shadow-navbar"
			}`}
			aria-label={t("navigation")}
		>
			<div
				className={`${
					integrated ? "items-center justify-center" : "justify-between"
				} flex w-full  font-coolvetica mobile:w-auto`}
			>
				<Link href="/">
					<Image
						className="hidden mobile:block"
						priority
						src="/assets/hackthehill-logo.svg"
						height={64}
						width={64}
						alt={t("logo")}
					/>
					<Image
						className="block mobile:hidden"
						priority
						src="/assets/hackthehill-banner.svg"
						height={238}
						width={238}
						alt={t("logo")}
					/>
				</Link>
			</div>

			<div className="hidden flex-row mobile:flex">
				<Links bottom={false} />
			</div>

			<button
				className="hover:bg-light-quaternary right-4 ml-auto flex whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors sm:visible logo-center:absolute"
				onClick={sessionData ? () => void signOut() : () => void signIn()}
			>
				{sessionData ? t("sign-out") : t("sign-in")}
			</button>
		</nav>
	);
};

const BottomMenu = () => {
	const { t } = useTranslation("navbar");

	return (
		<nav
			className="sticky bottom-0 flex w-full items-center justify-evenly gap-4 whitespace-nowrap bg-light-quaternary-color p-4 mobile:hidden xs:gap-8"
			aria-label={t("bottom-navigation")}
		>
			<Links bottom />
		</nav>
	);
};

export { BottomMenu, Navbar };
