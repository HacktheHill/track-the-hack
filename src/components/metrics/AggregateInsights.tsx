import type { useTranslation } from "next-i18next";
import { outsideCanadaBounds, pooledInsight, type AggregateRow } from "./aggregate-insights";

type Translate = ReturnType<typeof useTranslation>["t"];
export const AggregateInsights = ({
	rows,
	total,
	dimension,
	multiSelect = false,
	t,
}: {
	rows: AggregateRow[];
	total: number;
	dimension: string;
	multiSelect?: boolean;
	t: Translate;
}) => {
	const pooled = pooledInsight(rows, total, multiSelect);
	const geography = ["country", "travelOrigin", "transportOrigins"].includes(dimension);
	const bounds = geography ? outsideCanadaBounds(rows, dimension !== "country") : null;
	const number = bounds
		? bounds.upper < 5
			? bounds.upper === 0
				? "0"
				: t("aggregateInsights.fewerThanFive")
			: bounds.lower === bounds.upper
				? String(bounds.lower)
				: bounds.lower < 5
					? t("aggregateInsights.indeterminate")
					: dimension !== "country"
						? t("aggregateInsights.atLeast", { count: bounds.lower })
						: `${bounds.lower}–${bounds.upper}`
		: "";
	if (!pooled && !geography) return null;
	return (
		<aside className="mt-4 rounded border border-teal-200 bg-teal-50 p-3 font-rubik text-sm">
			{geography && (
				<>
					<h3 className="font-medium">{t("aggregateInsights.outsideCanada")}</h3>
					<p className="mt-1 text-xl tabular-nums">{number}</p>
					<p className="mt-1">
						{t(
							dimension === "country"
								? "aggregateInsights.residenceNote"
								: "aggregateInsights.travelNote",
						)}
					</p>
					{bounds && bounds.lower !== bounds.upper && (
						<p className="mt-1">
							{t(
								dimension === "country"
									? "aggregateInsights.rangeNote"
									: "aggregateInsights.travelUnknownNote",
								{ count: bounds.upper - bounds.lower },
							)}
						</p>
					)}
				</>
			)}
			{pooled && (
				<p className={geography ? "mt-3" : ""}>
					{t(pooled.share === null ? "aggregateInsights.pooledMentions" : "aggregateInsights.pooled", pooled)}
				</p>
			)}
		</aside>
	);
};
