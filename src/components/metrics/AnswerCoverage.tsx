import type { useTranslation } from "next-i18next";
import { answerCoverage } from "@root/private-metrics/coverage";

export const AnswerCoverage = ({
	dimensions,
	total,
	t,
}: {
	dimensions: Record<string, Array<{ label: string; applicants: number }>>;
	total: number;
	t: ReturnType<typeof useTranslation>["t"];
}) => {
	const rows = Object.entries(dimensions)
		.filter(([key]) => key !== "discipline")
		.map(([key, values]) => ({ key, ...answerCoverage(values, total) }))
		.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
	return (
		<section className="ui-panel p-5">
			<h2 className="font-coolvetica text-xl">{t("coverageByDimension")}</h2>
			<p className="mt-2 font-rubik text-sm">
				{t("populationBase", { count: total, population: t("cohort.applicants") })}
			</p>
			<ul className="mt-4 space-y-4 font-rubik text-sm">
				{rows.map(row => (
					<li key={row.key}>
						<div className="mb-1 flex justify-between gap-4">
							<span>{t(`dimension.${row.key}`)}</span>
							<span className="tabular-nums">{row.rate}</span>
						</div>
						<div aria-hidden className="h-2 overflow-hidden rounded bg-gray-200">
							<div
								className={`h-full rounded ${parseFloat(row.rate) < 80 ? "bg-amber-700" : "bg-teal-700"}`}
								style={{ width: `${parseFloat(row.rate) || 0}%` }}
							/>
						</div>
					</li>
				))}
			</ul>
			<details className="mt-5 font-rubik text-sm">
				<summary className="cursor-pointer">{t("coverageDetails")}</summary>
				<p className="mt-3">{t("coverageByDimensionNote")}</p>
				<div className="mt-3 overflow-x-auto">
					<table className="w-full text-left">
						<thead>
							<tr>
								{["dimensionLabel", "notProvidedCategory", "suppressedCategory", "answerRate"].map(
									key => (
										<th className="p-3" key={key}>
											{t(key)}
										</th>
									),
								)}
							</tr>
						</thead>
						<tbody>
							{rows.map(row => (
								<tr key={row.key} className="border-t border-gray-200">
									<th scope="row" className="p-3 font-normal">
										{t(`dimension.${row.key}`)}
									</th>
									<td className="p-3">{row.missing ?? "—"}</td>
									<td className="p-3">{row.suppressed}</td>
									<td className="p-3">{row.rate}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</section>
	);
};
