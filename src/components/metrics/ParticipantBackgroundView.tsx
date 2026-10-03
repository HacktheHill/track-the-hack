import type { useTranslation } from "next-i18next";
import type { ParticipantBackground } from "@root/private-metrics/background";

export const ParticipantBackgroundView = ({
	data,
	t,
}: {
	data: ParticipantBackground;
	t: ReturnType<typeof useTranslation>["t"];
}) => (
	<div className="flex flex-col gap-6">
		<section className="ui-panel p-5 font-rubik">
			<h2 className="font-coolvetica text-2xl">{t("background.ageSummary")}</h2>
			<div className="mt-4 overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead>
						<tr>
							{[
								"cohortLabel",
								"background.validAges",
								"history.stat.ageMean",
								"history.stat.ageMedian",
								"history.stat.ageStdDev",
								"background.ageRange",
								"history.stat.ageUnder22",
							].map(key => (
								<th className="p-3" key={key}>
									{t(key)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{data.ageStats.map(row => (
							<tr className="border-t border-gray-200" key={row.cohort}>
								<th className="p-3 font-normal">{t(`cohort.${row.cohort}`)}</th>
								<td className="p-3 tabular-nums">{row.answered}</td>
								<td className="p-3 tabular-nums">{row.mean ?? "—"}</td>
								<td className="p-3 tabular-nums">{row.median ?? "—"}</td>
								<td className="p-3 tabular-nums">{row.stdDev ?? "—"}</td>
								<td className="p-3 tabular-nums">
									{row.minimum != null && row.maximum != null ? `${row.minimum}–${row.maximum}` : "—"}
								</td>
								<td className="p-3 tabular-nums">
									{row.under22 != null
										? `${row.under22} · ${row.answered ? Math.round((row.under22 / row.answered) * 1000) / 10 : 0}%`
										: "—"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="mt-3 text-sm">{t("background.ageNote")}</p>
		</section>
		<section className="ui-panel p-5 font-rubik">
			<h2 className="font-coolvetica text-xl">{t("history.stat.accommodationResponses")}</h2>
			<p className="mt-2 text-3xl tabular-nums">{data.accommodationResponses}</p>
			<p className="mt-2 text-sm">{t("background.accommodationNote")}</p>
		</section>
		<p className="font-rubik text-sm">{t("background.cohortNote")}</p>
	</div>
);
