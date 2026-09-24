import { LatteFlavour, LatteMilkBase, LatteOrderStatus, LatteSweetener, LatteTemperature } from "@prisma/client";
import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useState } from "react";
import { z } from "zod";
import App from "@/components/App";
import { trpc, type RouterOutputs } from "@/server/api/api";

type Drink = RouterOutputs["latteLab"]["menu"]["drinks"][number];
const newKey = () => crypto.randomUUID().replaceAll("-", "");

export default function LatteLab() {
	const { t } = useTranslation("latteLab");
	const utils = trpc.useContext();
	const menu = trpc.latteLab.menu.useQuery(undefined, { retry: false, staleTime: 0, refetchInterval: 10000 });
	const active = trpc.latteLab.activeOrder.useQuery(undefined, { retry: false, refetchInterval: 3000 });
	const place = trpc.latteLab.placeOrder.useMutation({ onSuccess: () => void active.refetch() });
	const cancel = trpc.latteLab.cancelQueuedOrder.useMutation({
		onSuccess: async () => {
			await utils.latteLab.activeOrder.invalidate();
		},
	});
	const [drink, setDrink] = useState<Drink>();
	const [pickupName, setPickupName] = useState("");
	const [dismissedOrderId, setDismissedOrderId] = useState("");
	const [temperature, setTemperature] = useState<LatteTemperature>();
	const [milkBase, setMilkBase] = useState<LatteMilkBase>();
	const [flavour, setFlavour] = useState<LatteFlavour>();
	const [sweetener, setSweetener] = useState<LatteSweetener>();
	const choose = (next: Drink) => {
		setDrink(next);
		setTemperature(next.temperatures[0]);
		setMilkBase(next.milkBases.includes(LatteMilkBase.NONE) ? LatteMilkBase.NONE : next.milkBases[0]);
		setFlavour(next.flavours.includes(LatteFlavour.NONE) ? LatteFlavour.NONE : next.flavours[0]);
		setSweetener(next.sweeteners.includes(LatteSweetener.NONE) ? LatteSweetener.NONE : next.sweeteners[0]);
	};
	const currentOrder = active.data?.id === dismissedOrderId ? null : active.data;
	if (currentOrder)
		return (
			<App title={t("title")} className="overflow-y-auto bg-default-gradient">
				<div className="ui-form-layout space-y-5 text-center">
					<h1 className="ui-page-title">{t("title")}</h1>
					<div className="ui-panel space-y-3 p-6">
						<p className="text-2xl font-bold">{t(`status.${currentOrder.status}`)}</p>
						{currentOrder.position && <p>{t("position", { count: currentOrder.position })}</p>}
						<p>
							{t(`drink.${currentOrder.drink}`)} · {t(`temperatureValue.${currentOrder.temperature}`)} ·{" "}
							{t(`milk.${currentOrder.milkBase}`)}
						</p>
						{currentOrder.status === LatteOrderStatus.QUEUED && (
							<button
								className="ui-button"
								disabled={cancel.isLoading}
								onClick={() => cancel.mutate({ orderId: currentOrder.id })}
							>
								{t("cancel")}
							</button>
						)}
					</div>
					{(currentOrder.status === LatteOrderStatus.COMPLETED ||
						currentOrder.status === LatteOrderStatus.CANCELLED) && (
						<button
							className="ui-button ui-button-primary"
							onClick={() => setDismissedOrderId(currentOrder.id)}
						>
							{t("order-another")}
						</button>
					)}
					<p className="text-sm">{t("crossContact")}</p>
				</div>
			</App>
		);
	return (
		<App title={t("title")} className="overflow-y-auto bg-default-gradient">
			<div className="ui-form-layout space-y-6">
				<h1 className="ui-page-title">{t("title")}</h1>
				{menu.data && !menu.data.open && (
					<p className="ui-panel p-4" role="status">
						{t("closed")}
					</p>
				)}
				<section>
					<h2 className="mb-3 font-coolvetica text-2xl">{t("choose")}</h2>
					<div className="grid grid-cols-2 gap-3">
						{menu.data?.drinks.map(option => (
							<button
								key={option.drink}
								type="button"
								disabled={!option.enabled || !menu.data?.open}
								onClick={() => choose(option)}
								className={`ui-panel min-h-32 p-4 text-left ${drink?.drink === option.drink ? "ring-4 ring-dark-primary-color" : ""}`}
							>
								<strong className="block text-lg">{t(`drink.${option.drink}`)}</strong>
								<span className="text-sm">{t(`description.${option.drink}`)}</span>
								{!option.enabled && <span className="block font-bold">{t("unavailable")}</span>}
							</button>
						))}
					</div>
				</section>
				{drink && (
					<form
						className="space-y-5"
						onSubmit={event => {
							event.preventDefault();
							if (temperature && milkBase && flavour && sweetener)
								place.mutate({
									drink: drink.drink,
									temperature,
									milkBase,
									flavour,
									sweetener,
									pickupName,
									submissionKey: newKey(),
								});
						}}
					>
						<div id="customise" className="ui-panel grid gap-4 p-4 sm:grid-cols-2">
							<label>
								{t("temperature")}
								<select
									required
									className="ui-field mt-1 w-full"
									value={temperature}
									onChange={event => {
										const next = z.nativeEnum(LatteTemperature).parse(event.target.value);
										setTemperature(next);
										if (drink.drink === "COFFEE" && next === LatteTemperature.HOT)
											setFlavour(LatteFlavour.NONE);
									}}
								>
									{drink.temperatures.map(value => (
										<option value={value} key={value}>
											{t(`temperatureValue.${value}`)}
										</option>
									))}
								</select>
							</label>
							<label>
								{t("milkBase")}
								<select
									required
									className="ui-field mt-1 w-full"
									value={milkBase}
									onChange={event =>
										setMilkBase(z.nativeEnum(LatteMilkBase).parse(event.target.value))
									}
								>
									{drink.milkBases.map(value => (
										<option value={value} key={value}>
											{t(`milk.${value}`)}
										</option>
									))}
								</select>
							</label>
							<label>
								{t("flavour")}
								<select
									required
									className="ui-field mt-1 w-full"
									value={flavour}
									onChange={event => setFlavour(z.nativeEnum(LatteFlavour).parse(event.target.value))}
								>
									{drink.flavours
										.filter(
											value =>
												drink.drink !== "COFFEE" ||
												temperature === LatteTemperature.ICED ||
												value === LatteFlavour.NONE,
										)
										.map(value => (
											<option value={value} key={value}>
												{t(`flavourValue.${value}`)}
											</option>
										))}
								</select>
							</label>
							<label>
								{t("sweetener")}
								<select
									required
									className="ui-field mt-1 w-full"
									value={sweetener}
									onChange={event =>
										setSweetener(z.nativeEnum(LatteSweetener).parse(event.target.value))
									}
								>
									{drink.sweeteners.map(value => (
										<option value={value} key={value}>
											{t(`sweetenerValue.${value}`)}
										</option>
									))}
								</select>
							</label>
							<label className="sm:col-span-2">
								{t("pickupName")}
								<input
									required
									minLength={1}
									maxLength={40}
									className="ui-field mt-1 w-full"
									value={pickupName}
									onChange={event => setPickupName(event.target.value)}
								/>
							</label>
						</div>
						<div className="ui-panel space-y-2 p-4">
							<div className="flex justify-between">
								<h2 className="font-coolvetica text-2xl">{t("review")}</h2>
								<a href="#customise" className="underline">
									{t("edit")}
								</a>
							</div>
							<p>
								{t(`drink.${drink.drink}`)} · {temperature ? t(`temperatureValue.${temperature}`) : ""}{" "}
								· {milkBase ? t(`milk.${milkBase}`) : ""} ·{" "}
								{flavour ? t(`flavourValue.${flavour}`) : ""} ·{" "}
								{sweetener ? t(`sweetenerValue.${sweetener}`) : ""}
							</p>
							{(milkBase === LatteMilkBase.DAIRY || milkBase === LatteMilkBase.ALMOND) && (
								<p>
									<strong>{t("allergens")}:</strong>{" "}
									{t(milkBase === LatteMilkBase.DAIRY ? "DAIRY" : "ALMOND")}
								</p>
							)}
						</div>
						<p className="text-sm">{t("crossContact")}</p>
						{place.isError && <p role="alert">{t("error")}</p>}
						<button
							disabled={
								place.isLoading ||
								!pickupName.trim() ||
								!temperature ||
								!milkBase ||
								!flavour ||
								!sweetener
							}
							className="ui-button ui-button-primary w-full text-lg"
						>
							{t("place")}
						</button>
					</form>
				)}
			</div>
		</App>
	);
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["latteLab", "navbar", "common"]),
});
