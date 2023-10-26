import { Role, type Prisma } from "@prisma/client";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { useState } from "react";
import Image from "next/image";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { hackersRedirect } from "../../utils/redirects";
import { authOptions } from "../api/auth/[...nextauth]";
import { trpc } from "../../utils/api";
import { useEffect } from "react";
import Popup from "./popup";
import type { GetStaticProps, NextPage } from "next";
import App from "../../components/App";
import Weather from "../../components/Weather";
import OnlyRole from "../../components/OnlyRole";
import QRCode from "../../components/QRCode";
import QRScanner from "../../components/QRScanner";
import { PresenceInfo as PresenceInfoNamespace } from "@prisma/client";
//Figure out why button isn't showing
//Figure out trpc mutations
//Figure out how to get the qr scan to stay scanning

type HackerInfo = Prisma.HackerInfoGetPayload<true>;
type PresenceInfo = Prisma.PresenceInfoGetPayload<true>;

type HackerViewProps = {
	hackerData: HackerInfo;
	presenceData: PresenceInfo;
};


const QR = () => {
	const { t } = useTranslation("qr");
	const router = useRouter();
	const [error, setError] = useState(false);
	const [selectedOption, setSelectedOption] = useState<keyof PresenceInfoNamespace>("breakfast1");
	const [showPopup, setShowPopup] = useState(false)
	const [qrData, setQRData]=useState("")
	const [loaded, setDataLoaded]=useState(false)

	useEffect(()=>{
		if (showPopup && qrData !== ""){
			console.log(qrData)
			setDataLoaded(true)
		}
	}, [showPopup, qrData])


	return (
		<App
			className="relative flex h-full flex-col items-center justify-center gap-16 bg-gradient2"
			title={t("title")}
		>
			<Weather count={30} type="snowflake" />
			<div className="flex flex-col items-center gap-6">
				<OnlyRole filter={role => role === Role.ORGANIZER}>
					<QRScanner
						onScan={(data: string) => {
							setShowPopup(true)
							setQRData(data)
							
						}}
					/>
					{!error && <p className="z-10 max-w-xl text-center text-lg font-bold text-dark">{t("scan-qr")}</p>}
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>
					<QRCode setError={setError} />
					{!error && <p className="z-10 max-w-xl text-center text-lg font-bold text-dark">{t("use-qr")}</p>}
				</OnlyRole>
			</div>
			{error && (
				<div className="flex h-40 items-center justify-center text-dark">
					<p>You need to sign in to access the QR page.</p>
				</div>
			)}
			<select id="eventSignIn" onChange={(event) =>  { 
				setSelectedOption(event.target.value as keyof PresenceInfoNamespace)
				}} 
				className="flex flex-col items-center bg-dark font-bold text-white text-center w-120 h-10 text-lg rounded p-2">
				<option value=''>Select an option</option>
				<option value="checkedIn">Opening Ceremony</option>
				<option value="breakfast1">Friday Dinner</option>
				<option value="lunch1">Saturday Breakfast</option>
				<option value="dinner1">Saturday Lunch</option>
				<option value="breakfast2">Saturday Dinner</option>
				<option value="lunch2">Sunday Lunch</option>
            </select>
			{loaded && <Popup id={qrData} selectedOption={selectedOption} />}
			<div className="h-56 w-full bg-light">
				<Image
					priority
					className="z-10 -my-4 mx-auto"
					src="/assets/beaver-hot-choco.svg"
					alt={t("mascot-choco-alt")}
					width={310}
					height={300}
				/>
			</div>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, authOptions);

	return {
		...(await hackersRedirect(session)),
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "qr"]),
	};
};

export default QR;
