import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import { useState } from "react";
import App from "@/components/App";
import { trpc } from "@/server/api/api";

export default function HardwareCatalogue() {
	const { t } = useTranslation("hardware");
	const [search, setSearch] = useState("");
	const query = trpc.hardware.catalogue.useQuery(undefined, { retry: false, staleTime: 0 });
	const items = (query.data ?? []).filter(item =>
		`${item.name} ${item.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
	);
	return (
		<App title={t("title")} className="overflow-y-auto bg-default-gradient">
			<div className="ui-form-layout space-y-5">
				<h1 className="ui-page-title">{t("catalogue")}</h1>
				<input
					type="search"
					className="ui-field w-full"
					value={search}
					onChange={event => setSearch(event.target.value)}
					placeholder={t("search")}
					aria-label={t("search")}
				/>
				{query.isError && <p role="alert">{t("error")}</p>}
				<div className="grid gap-4 sm:grid-cols-2">
					{items.map(item => (
						<article className="ui-panel p-4" key={item.id}>
							{item.imageURL && (
								<Image
									className="mb-3 h-36 w-full rounded-lg object-contain"
									src={item.imageURL}
									alt=""
									width={320}
									height={144}
								/>
							)}
							<h2 className="font-coolvetica text-xl">{item.name}</h2>
							<p className="text-sm">{t(`category.${item.category}`)}</p>
							<p className="text-sm">{t("owned-by", { owner: t(`owner.${item.owner}`) })}</p>
							{item.description && <p>{item.description}</p>}
							<p className="font-bold">
								{!item.availableForCheckout
									? t("desk-use-only")
									: item.inventoryMode === "COUNTED"
										? item.isAvailable
											? t("available-count", { count: item.availableQuantity })
											: t("out-of-stock")
										: item.isAvailable
											? t("available")
											: t("out-of-stock")}
							</p>
						</article>
					))}
				</div>
				{!query.isLoading && items.length === 0 && <p>{t("empty")}</p>}
			</div>
		</App>
	);
}
export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["hardware", "navbar", "common"]),
});
