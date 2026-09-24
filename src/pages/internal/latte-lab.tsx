import { LatteCancellationReason, LatteOrderStatus, RoleName } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useState } from "react";
import App from "@/components/App";
import { trpc } from "@/server/api/api";
import { rolesRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

const newKey = () => crypto.randomUUID().replaceAll("-", "");
export default function LatteLabQueue() {
	const { t } = useTranslation("latteLab");
	const utils = trpc.useContext();
	const queue = trpc.latteLab.queue.useQuery(undefined, { refetchInterval: 3000 });
	const refresh = () => void utils.latteLab.queue.invalidate();
	const setOpen = trpc.latteLab.setOpen.useMutation({ onSuccess: refresh });
	const setIngredient = trpc.latteLab.setIngredientAvailability.useMutation({ onSuccess: refresh });
	const transition = trpc.latteLab.transitionOrder.useMutation({ onSuccess: refresh });
	const [reasons, setReasons] = useState<Record<string, LatteCancellationReason>>({});
	const act = (
		orderId: string,
		expectedStatus: LatteOrderStatus,
		nextStatus: LatteOrderStatus,
		reason?: LatteCancellationReason,
	) => transition.mutate({ orderId, expectedStatus, nextStatus, requestKey: newKey(), reason });
	return (
		<App title={t("queue")} className="overflow-y-auto bg-default-gradient">
			<div className="mx-auto max-w-5xl space-y-6 p-4 py-8">
				<h1 className="ui-page-title">{t("queue")}</h1>
				<label className="ui-panel flex min-h-11 items-center gap-3 p-4">
					<input
						className="ui-checkbox"
						type="checkbox"
						checked={queue.data?.open ?? false}
						disabled={setOpen.isLoading}
						onChange={event => setOpen.mutate({ open: event.target.checked })}
					/>
					{t("open")}
				</label>
				<section className="ui-panel p-4">
					<h2 className="mb-3 font-coolvetica text-2xl">{t("ingredients")}</h2>
					<div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
						{queue.data?.ingredients.map(row => (
							<label className="flex min-h-11 items-center gap-2" key={row.ingredient}>
								<input
									className="ui-checkbox"
									type="checkbox"
									checked={row.available}
									onChange={event =>
										setIngredient.mutate({
											ingredient: row.ingredient,
											available: event.target.checked,
										})
									}
								/>
								{t(`ingredient.${row.ingredient}`)}
							</label>
						))}
					</div>
				</section>
				<section>
					<h2 className="mb-3 font-coolvetica text-2xl">{t("orders")}</h2>
					<div className="space-y-3">
						{queue.data?.orders.map(order => (
							<article className="ui-panel p-4" key={order.id}>
								<div className="flex flex-wrap justify-between gap-3">
									<div>
										<h3 className="text-xl font-bold">{order.pickupName}</h3>
										<p>
											{t(`drink.${order.drink}`)} · {t(`temperatureValue.${order.temperature}`)} ·{" "}
											{t(`milk.${order.milkBase}`)} · {t(`flavourValue.${order.flavour}`)}
										</p>
										<p>
											{t(`status.${order.status}`)} · {order.submittedAt.toLocaleTimeString()}
										</p>
										{order.allergens.length > 0 && (
											<p>
												{t("allergens")}: {order.allergens.map(value => t(value)).join(", ")}
											</p>
										)}
									</div>
									<div className="flex flex-wrap items-center gap-2">
										{order.status === LatteOrderStatus.QUEUED && (
											<button
												className="ui-button"
												disabled={transition.isLoading}
												onClick={() => act(order.id, order.status, LatteOrderStatus.PREPARING)}
											>
												{t("start")}
											</button>
										)}
										{order.status === LatteOrderStatus.PREPARING && (
											<button
												className="ui-button"
												disabled={transition.isLoading}
												onClick={() => act(order.id, order.status, LatteOrderStatus.READY)}
											>
												{t("ready")}
											</button>
										)}
										{order.status === LatteOrderStatus.READY && (
											<button
												className="ui-button"
												disabled={transition.isLoading}
												onClick={() => act(order.id, order.status, LatteOrderStatus.COMPLETED)}
											>
												{t("complete")}
											</button>
										)}
										<select
											className="ui-field"
											aria-label={t("cancel-reason")}
											value={reasons[order.id] ?? LatteCancellationReason.OTHER}
											onChange={event =>
												setReasons(current => ({
													...current,
													[order.id]:
														event.target.value ===
														LatteCancellationReason.INGREDIENT_UNAVAILABLE
															? LatteCancellationReason.INGREDIENT_UNAVAILABLE
															: event.target.value === LatteCancellationReason.DUPLICATE
																? LatteCancellationReason.DUPLICATE
																: event.target.value ===
																	  LatteCancellationReason.UNCLAIMED
																	? LatteCancellationReason.UNCLAIMED
																	: LatteCancellationReason.OTHER,
												}))
											}
										>
											{[
												LatteCancellationReason.INGREDIENT_UNAVAILABLE,
												LatteCancellationReason.DUPLICATE,
												LatteCancellationReason.UNCLAIMED,
												LatteCancellationReason.OTHER,
											].map(reason => (
												<option value={reason} key={reason}>
													{t(`reason.${reason}`)}
												</option>
											))}
										</select>
										<button
											className="ui-button"
											disabled={transition.isLoading}
											onClick={() =>
												act(
													order.id,
													order.status,
													LatteOrderStatus.CANCELLED,
													reasons[order.id] ?? LatteCancellationReason.OTHER,
												)
											}
										>
											{t("cancelStaff")}
										</button>
									</div>
								</div>
							</article>
						))}
					</div>
				</section>
				{(queue.isError || transition.isError) && <p role="alert">{t("error")}</p>}
			</div>
		</App>
	);
}
export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: await rolesRedirect(session, "/", [RoleName.ORGANIZER, RoleName.ADMIN]),
		props: await serverSideTranslations(locale ?? "en", ["latteLab", "navbar", "common"]),
	};
};
