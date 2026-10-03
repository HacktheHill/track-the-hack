import type { useTranslation } from "next-i18next";
import { reportCoverage } from "@root/private-metrics/report-coverage";

export const ReportCoverage = ({
	snapshot,
	t,
}: {
	snapshot: Parameters<typeof reportCoverage>[0];
	t: ReturnType<typeof useTranslation>["t"];
}) => (
	<details className="ui-panel p-5 font-rubik">
		<summary className="cursor-pointer">{t("reportCoverage.title")}</summary>
		<p className="mt-3 text-sm">{t("reportCoverage.note")}</p>
		<div className="mt-4 overflow-x-auto">
			<table className="w-full text-left text-sm">
				<thead>
					<tr>
						{[t("reportCoverage.topic"), "HtH I", "HtH II", "HtH III"].map(label => (
							<th className="p-3" key={label}>
								{label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{reportCoverage(snapshot).map(row => (
						<tr key={row.key} className="border-t border-gray-200">
							<th className="p-3 font-normal">{t(`reportCoverage.topics.${row.key}`)}</th>
							{(["i", "ii", "iii"] as const).map(id => (
								<td className="p-3" key={id}>
									{t(`reportCoverage.status.${row[id]}`)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
		<p className="mt-3 text-sm">{t("reportCoverage.limits")}</p>
	</details>
);
