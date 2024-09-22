import { RoleName } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "../../server/api/api";

import App from "../../components/App";
import { rolesRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

const Metrics = () => {
	const { t } = useTranslation("metrics");

	const [pieRadius, setPieRadius] = useState(160);

	const { data } = trpc.metrics.getMetrics.useQuery();

	const colors = [
		"#ff6b6b", // Light Red
		"#ffd700", // Goldenrod
		"#ffc1a1", // Peach
		"#8b4513", // Dark Brown
		"#e67300", // Burnt Orange
		"#ff4d6d", // Warm Pink
		"#b5c401", // Light Olive Green
		"#b87333", // Copper
		"#dec5a4", // Muted Beige
		"#ffa07a", // Light Salmon
		"#cc467f", // Muted Magenta
		"#ffcc5c", // Warm Mustard
		"#d68f8f", // Dusty Rose
		"#6a1b9a", // Deep Plum
	];

	useEffect(() => {
		const isSmallScreen = window.innerWidth < 768;
		const pieRadius = isSmallScreen ? 90 : 160;
		setPieRadius(pieRadius);
	}, []);

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
			<div className="flex flex-col items-center justify-center overflow-hidden overflow-y-auto bg-default-gradient p-10">
				<h1 className="p-10 font-rubik text-4xl font-bold">{t("title")}</h1>

				<div className="flex w-full max-w-6xl flex-col items-center gap-6 rounded-lg bg-light-tertiary-color p-6 shadow-lg">
					<h3 className="font-coolvetica text-xl">{t("overview")}</h3>

					<div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
						{data && (
							<>
								<p className="text-lg">
									{t("applied")}: <span className="font-semibold">{data.applied}</span>
								</p>
								<p className="text-lg">
									{t("confirmed")}: <span className="font-semibold">{data.confirmed}</span>
								</p>
								<p className="text-lg">
									{t("checkedIn")}: <span className="font-semibold">{data.checkedIn}</span>
								</p>
								<p className="text-lg">
									{t("walkIn")}: <span className="font-semibold">{data.walkIn}</span>
								</p>
							</>
						)}

						{data && (
							<div className="w-full">
								<h3 className="font-coolvetica text-xl">{t("attendance")}</h3>
								<div className="p-4">
									<ResponsiveContainer width="100%" height={300}>
										<BarChart data={data.attendanceData}>
											<XAxis dataKey="label" stroke="black" />
											<YAxis stroke="black" />
											<Tooltip />
											<Bar dataKey="_sum.value" name={t("attendance")} stroke="black">
												{data.genderData.map((_, index) => (
													<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</div>
						)}
					</div>

					<div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
						{data && (
							<div className="w-full max-w-[400px]">
								<h3 className="font-coolvetica text-xl">{t("genderDistribution")}</h3>
								<ResponsiveContainer width="100%" height={400}>
									<PieChart>
										<Pie
											data={data.genderData}
											dataKey="_count.gender"
											nameKey="gender"
											cx="50%"
											cy="50%"
											outerRadius={pieRadius}
											stroke="black"
											fill="black"
										>
											{data.genderData.map((_, index) => (
												<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
											))}
										</Pie>
										<Tooltip />
									</PieChart>
								</ResponsiveContainer>
							</div>
						)}

						{data && (
							<div className="w-full max-w-[400px]">
								<h3 className="font-coolvetica text-xl">{t("ethnicityDistribution")}</h3>
								<ResponsiveContainer width="100%" height={400}>
									<PieChart>
										<Pie
											data={data.ethnicityData}
											dataKey="_count.raceEthnicity"
											nameKey="raceEthnicity"
											cx="50%"
											cy="50%"
											outerRadius={pieRadius}
											stroke="black"
											fill="black"
										>
											{data.ethnicityData.map((_, index) => (
												<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
											))}
										</Pie>
										<Tooltip />
									</PieChart>
								</ResponsiveContainer>
							</div>
						)}

						{data && (
							<div className="w-full max-w-[400px]">
								<h3 className="font-coolvetica text-xl">{t("ageDistribution")}</h3>
								<ResponsiveContainer width="100%" height={400}>
									<PieChart>
										<Pie
											data={data.ageData}
											dataKey="_count.age"
											nameKey="age"
											cx="50%"
											cy="50%"
											outerRadius={pieRadius}
											stroke="black"
											fill="black"
										>
											{data.ageData.map((_, index) => (
												<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
											))}
										</Pie>
										<Tooltip />
									</PieChart>
								</ResponsiveContainer>
							</div>
						)}
					</div>

					<div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
						{data && (
							<div className="w-full">
								<h3 className="font-coolvetica text-xl">{t("locationDistribution")}</h3>
								<ResponsiveContainer width="100%" height={400}>
									<PieChart>
										<Pie
											data={data.locationData}
											dataKey="_count.travelOrigin"
											nameKey="travelOrigin"
											cx="50%"
											cy="50%"
											outerRadius={pieRadius}
											stroke="black"
											fill="black"
										>
											{data.locationData.map((_, index) => (
												<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
											))}
										</Pie>
										<Tooltip />
									</PieChart>
								</ResponsiveContainer>
							</div>
						)}

						{data && (
							<div className="w-full">
								<h3 className="font-coolvetica text-xl">{t("educationLevelDistribution")}</h3>
								<ResponsiveContainer width="100%" height={400}>
									<PieChart>
										<Pie
											data={data.levelData}
											dataKey="_count.educationLevel"
											nameKey="educationLevel"
											cx="50%"
											cy="50%"
											outerRadius={pieRadius}
											stroke="black"
											fill="black"
										>
											{data.levelData.map((_, index) => (
												<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
											))}
										</Pie>
										<Tooltip />
									</PieChart>
								</ResponsiveContainer>
							</div>
						)}
					</div>

					<div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
						{data && (
							<div className="w-full">
								<h3 className="font-coolvetica text-xl">{t("referralSource")}</h3>
								<div className="p-4">
									<ResponsiveContainer width="100%" height={300}>
										<BarChart
											data={data.referralSourceData}
											margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
										>
											<XAxis dataKey="referralSource" stroke="black" />
											<YAxis stroke="black" />
											<Tooltip />
											<Bar
												dataKey="_count.referralSource"
												name={t("referralSource")}
												stroke="black"
											>
												{data.referralSourceData.map((_, index) => (
													<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</div>
						)}

						{data && (
							<div className="w-full">
								<h3 className="font-coolvetica text-xl">{t("majorsDistribution")}</h3>
								<div className="p-4">
									<ResponsiveContainer width="100%" height={300}>
										<BarChart
											data={data.majorData}
											margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
										>
											<XAxis dataKey="major" stroke="black" />
											<YAxis stroke="black" />
											<Tooltip />
											<Bar dataKey="_count.major" name={t("major")} stroke="black">
												{data.majorData.map((_, index) => (
													<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await rolesRedirect(session, "/metrics", [RoleName.ORGANIZER, RoleName.PREMIER]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["navbar", "common", "metrics"])),
		},
	};
};
export default Metrics;
