import { Locale, RoleName } from "@prisma/client";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback } from "react";
import Filter from "./Filter";

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
		(roles: RoleName[]) => {
			const hasOrganizerRole = roles.includes(RoleName.ORGANIZER);
			const isValidHacker = roles.includes(RoleName.HACKER) && !!sessionData?.user?.hackerId;

			return (hasOrganizerRole || isValidHacker) && !(hasOrganizerRole && !isValidHacker);
		},
		[sessionData?.user?.hackerId],
	);

	return (
		<>
			<LinkItem href="/" bottom={bottom} text={t("home")} src="/assets/home.svg" alt={t("home")} />
			<Filter value={qrFilter} silent method="function">
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
				<Filter value={[RoleName.MAYOR, RoleName.PREMIER, RoleName.ORGANIZER]} silent method="some">
					<LinkItem
						href="/hackers"
						bottom={bottom}
						text={t("hackers")}
						src="/assets/list.svg"
						alt={t("hackers")}
					/>
				</Filter>
			)}
			{sessionData?.user && sessionData.user.hackerId && (
				<Filter value={[RoleName.HACKER]} silent method="only">
					<LinkItem
						href="/profile"
						bottom={bottom}
						text={t("profile")}
						src="/assets/profile.svg"
						alt={t("profile")}
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

	const router = useRouter();
	const { locale } = router;

	const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		void router.push(router.pathname, router.asPath, {
			locale: e.target.value.toLocaleLowerCase(),
		});
	};

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
						className="block"
						priority
						src="/assets/hackthehill-logo.svg"
						height={64}
						width={64}
						alt={t("logo")}
					/>
				</Link>
			</div>

			<div className="hidden flex-row mobile:flex">
				<Links bottom={false} />
			</div>

			<select
				className="hover:bg-light-quaternary ml-auto whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors sm:visible"
				onChange={handleLanguageChange}
				value={locale ?? "en"}
			>
				{Object.keys(Locale).map(locale => (
					<option key={locale} value={locale.toLocaleLowerCase()}>
						{locale}
					</option>
				))}
			</select>

			<button
				className="hover:bg-light-quaternary whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors sm:visible"
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
			className="z-10 flex w-full items-center justify-evenly gap-4 whitespace-nowrap bg-light-quaternary-color p-4 mobile:hidden xs:gap-8"
			aria-label={t("bottom-navigation")}
		>
			<Links bottom />
		</nav>
	);
};

export { BottomMenu, Navbar };
