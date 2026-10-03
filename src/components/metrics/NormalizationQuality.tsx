import type { NormalizationField } from "@root/private-metrics/normalization";
import type { useTranslation } from "next-i18next";
export const NormalizationQuality = ({
	rows,
	t,
}: {
	rows?: NormalizationField[];
	t: ReturnType<typeof useTranslation>["t"];
}) =>
	!rows ? null : (
		<details className="ui-panel p-4 font-rubik">
			<summary className="cursor-pointer">{t("normalization.title")}</summary>
			<p className="mt-3 text-sm">{t("normalization.note")}</p>
			<div className="mt-4 overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead>
						<tr>
							{["field", "answered", "recognized", "unmapped", "categories", "merged"].map(key => (
								<th className="p-3" key={key}>
									{t(`normalization.${key}`)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map(row => (
							<tr className="border-t" key={row.key}>
								<th scope="row" className="p-3 font-normal">
									{t(`history.dimension.${row.key}`, { defaultValue: t(`dimension.${row.key}`) })}
								</th>
								<td className="p-3">{row.answered}</td>
								<td className="p-3">{row.recognized}</td>
								<td className="p-3">{row.unmapped}</td>
								<td className="p-3">
									{row.sourceCategories} → {row.normalizedCategories}
								</td>
								<td className="p-3">{row.mergedVariants}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	);
