import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useCallback, useState, useMemo } from "react";
import App from "@/components/App";
import QRScanner from "@/components/QRScanner";
import { trpc, type RouterOutputs } from "@/server/api/api";
import { organizerRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

const newKey = () => crypto.randomUUID().replaceAll("-", "");
type Loan = RouterOutputs["hardware"]["activeLoans"][number];
export default function HardwareDesk() {
	const { t } = useTranslation("hardware");
	const utils = trpc.useContext();
	const inventory = trpc.hardware.organizerCatalogue.useQuery();
	const [search, setSearch] = useState("");
	const [loanSearch, setLoanSearch] = useState("");
	const loans = trpc.hardware.activeLoans.useQuery({ search: loanSearch || undefined });
	const [loanHackerId, setLoanHackerId] = useState("");
	const [showLoanScanner, setShowLoanScanner] = useState(false);
	const scannedLoan = trpc.hardware.loanByParticipant.useQuery(
		{ hackerId: loanHackerId },
		{ enabled: loanHackerId.length >= 22, retry: false },
	);
	const [cart, setCart] = useState<Record<string, number>>({});
	const [hackerId, setHackerId] = useState("");
	const [pickupName, setPickupName] = useState("");
	const [idCollected, setIdCollected] = useState(false);
	const [scannerError, setScannerError] = useState("");
	const checkout = trpc.hardware.checkout.useMutation({
		onSuccess: async () => {
			setCart({});
			setHackerId("");
			setPickupName("");
			setIdCollected(false);
			await Promise.all([
				utils.hardware.organizerCatalogue.invalidate(),
				utils.hardware.activeLoans.invalidate(),
			]);
		},
		onError: () => void utils.hardware.organizerCatalogue.invalidate(),
	});
	const availability = trpc.hardware.setUncountedAvailability.useMutation({
		onSuccess: async () => utils.hardware.organizerCatalogue.invalidate(),
		onError: async () => utils.hardware.organizerCatalogue.invalidate(),
	});
	const scan = useCallback((value: string) => setHackerId(value.trim()), []);
	const selected = useMemo(() => {
		return inventory.data?.filter(item => cart[item.id]) ?? [];
	}, [inventory.data, cart]);
	const visible = useMemo(() => {
		return inventory.data?.filter(item => item.name.toLowerCase().includes(search.toLowerCase())) ?? [];
	}, [inventory.data, search]);
	return (
		<App title={t("organiser-title")} className="overflow-y-auto bg-default-gradient">
			<div className="mx-auto max-w-6xl space-y-8 p-4 py-8">
				<h1 className="ui-page-title">{t("organiser-title")}</h1>
				<section>
					<h2 className="mb-3 font-coolvetica text-2xl">{t("inventory")}</h2>
					<input
						className="ui-field mb-3 w-full"
						aria-label={t("search")}
						placeholder={t("search")}
						value={search}
						onChange={event => setSearch(event.target.value)}
					/>
					<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
						{visible.map(item => {
							const atCartLimit =
								item.inventoryMode === "COUNTED"
									? (cart[item.id] ?? 0) >= (item.availableQuantity ?? 0)
									: (cart[item.id] ?? 0) >= 999;
							return (
								<article className="ui-panel p-4" key={item.id}>
									<h3 className="font-bold">{item.name}</h3>
									<p>
										{item.inventoryMode === "COUNTED"
											? item.isAvailable
												? t("available-count", { count: item.availableQuantity })
												: t("out-of-stock")
											: item.isAvailable
												? t("available")
												: t("out-of-stock")}
									</p>
									<button
										className="ui-button mt-2"
										disabled={!item.isAvailable || atCartLimit}
										onClick={() =>
											setCart(value => ({ ...value, [item.id]: (value[item.id] ?? 0) + 1 }))
										}
									>
										{t("add")}
									</button>
									{item.inventoryMode === "UNCOUNTED" && (
										<button
											type="button"
											className="ui-button ml-2 mt-2"
											disabled={availability.isLoading}
											aria-label={`${item.isAvailable ? t("mark-out-of-stock") : t("mark-available")} ${item.name}`}
											onClick={() =>
												availability.mutate({
													itemId: item.id,
													available: !item.isAvailable,
													expectedUpdatedAt: item.updatedAt,
												})
											}
										>
											{item.isAvailable ? t("mark-out-of-stock") : t("mark-available")}
										</button>
									)}
								</article>
							);
						})}
					</div>
					{availability.isError && <p role="alert">{t("error")}</p>}
				</section>
				<section className="ui-panel space-y-4 p-4">
					<h2 className="font-coolvetica text-2xl">{t("cart")}</h2>
					{selected.map(item => (
						<div className="flex items-center justify-between gap-3" key={item.id}>
							<span>{item.name}</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									className="ui-button"
									aria-label={`${t("remove")} ${item.name}`}
									onClick={() =>
										setCart(value => ({
											...value,
											[item.id]: Math.max(0, (value[item.id] ?? 0) - 1),
										}))
									}
								>
									−
								</button>
								<span>{cart[item.id]}</span>
								<button
									type="button"
									className="ui-button"
									disabled={
										!item.isAvailable ||
										(item.inventoryMode === "COUNTED"
											? (cart[item.id] ?? 0) >= (item.availableQuantity ?? 0)
											: (cart[item.id] ?? 0) >= 999)
									}
									aria-label={`${t("add")} ${item.name}`}
									onClick={() =>
										setCart(value => ({ ...value, [item.id]: (value[item.id] ?? 0) + 1 }))
									}
								>
									+
								</button>
							</div>
						</div>
					))}
					{selected.length > 0 && (
						<>
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<QRScanner onScan={scan} setError={setScannerError} />
									{scannerError && <p role="alert">{scannerError}</p>}
								</div>
								<div className="space-y-3">
									<label>
										{t("participant-id")}
										<input
											required
											className="ui-field mt-1 w-full"
											value={hackerId}
											onChange={event => setHackerId(event.target.value)}
										/>
									</label>
									<label>
										{t("pickup-name")}
										<input
											required
											maxLength={40}
											className="ui-field mt-1 w-full"
											value={pickupName}
											onChange={event => setPickupName(event.target.value)}
										/>
									</label>
									<label className="flex min-h-11 items-center gap-2">
										<input
											type="checkbox"
											className="ui-checkbox"
											checked={idCollected}
											onChange={event => setIdCollected(event.target.checked)}
										/>
										{t("id-collected")}
									</label>
								</div>
							</div>
							<button
								className="ui-button ui-button-primary w-full"
								disabled={checkout.isLoading || !hackerId || !pickupName.trim() || !idCollected}
								onClick={() =>
									checkout.mutate({
										hackerId,
										pickupName,
										idCollected: true,
										idempotencyKey: newKey(),
										lines: selected.map(item => ({
											itemId: item.id,
											quantity: cart[item.id] ?? 0,
										})),
									})
								}
							>
								{t("checkout")}
							</button>
						</>
					)}
					{checkout.isSuccess && <p role="status">{t("checkout-success")}</p>}
					{checkout.isError && <p role="alert">{checkout.error.message}</p>}
				</section>
				<section>
					<h2 className="mb-3 font-coolvetica text-2xl">{t("loans")}</h2>
					<div className="mb-3 grid gap-3 md:grid-cols-[1fr_auto]">
						<input
							className="ui-field w-full"
							placeholder={t("participant-id")}
							aria-label={t("participant-id")}
							value={loanHackerId}
							onChange={event => setLoanHackerId(event.target.value.trim())}
						/>
						<button type="button" className="ui-button" onClick={() => setShowLoanScanner(value => !value)}>
							{t("scan-to-find")}
						</button>
					</div>
					{showLoanScanner && (
						<div className="mb-4 max-w-sm">
							<QRScanner
								onScan={value => {
									setLoanHackerId(value.trim());
									setShowLoanScanner(false);
								}}
								setError={setScannerError}
							/>
						</div>
					)}
					<input
						className="ui-field mb-3 w-full"
						placeholder={t("find-loan")}
						aria-label={t("find-loan")}
						value={loanSearch}
						onChange={event => setLoanSearch(event.target.value)}
					/>
					<div className="space-y-3">
						{[
							...(scannedLoan.data ? [scannedLoan.data] : []),
							...(loans.data ?? []).filter(loan => loan.id !== scannedLoan.data?.id),
						].map(loan => (
							<LoanCard key={loan.id} loan={loan} />
						))}
					</div>
				</section>
			</div>
		</App>
	);
}

function LoanCard({ loan }: { loan: Loan }) {
	const { t } = useTranslation("hardware");
	const utils = trpc.useContext();
	const [values, setValues] = useState(() =>
		Object.fromEntries(
			loan.lines.map(line => [
				line.id,
				{
					good:
						line.borrowedQuantity -
						line.goodQuantity -
						line.damagedQuantity -
						line.missingQuantity -
						line.consumedQuantity,
					damaged: 0,
					missing: 0,
					consumed: 0,
				},
			]),
		),
	);
	const [idReturned, setIdReturned] = useState(false);
	const mutation = trpc.hardware.returnItems.useMutation({
		onSuccess: async () => {
			await Promise.all([
				utils.hardware.activeLoans.invalidate(),
				utils.hardware.organizerCatalogue.invalidate(),
			]);
		},
	});
	const update = (id: string, key: "good" | "damaged" | "missing" | "consumed", raw: string) =>
		setValues(current => ({
			...current,
			[id]: {
				...(current[id] ?? { good: 0, damaged: 0, missing: 0, consumed: 0 }),
				[key]: Math.max(0, Number.parseInt(raw || "0", 10)),
			},
		}));
	return (
		<article className="ui-panel space-y-3 p-4">
			<h3 className="text-xl font-bold">{loan.pickupName}</h3>
			<p className="break-all text-sm">{loan.hackerId}</p>
			{loan.lines.map(line => {
				const outstanding =
					line.borrowedQuantity -
					line.goodQuantity -
					line.damagedQuantity -
					line.missingQuantity -
					line.consumedQuantity;
				const outcomeKeys = line.item.consumptionAllowed
					? (["good", "damaged", "missing", "consumed"] as const)
					: (["good", "damaged", "missing"] as const);
				return (
					<fieldset className="border-t pt-3" key={line.id}>
						<legend className="font-bold">
							{line.item.name}: {t("outstanding", { count: outstanding })}
						</legend>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{outcomeKeys.map(key => (
								<label key={key}>
									{t(key)}
									<input
										className="ui-field mt-1 w-full"
										type="number"
										min={0}
										max={outstanding}
										value={values[line.id]?.[key] ?? 0}
										onChange={event => update(line.id, key, event.target.value)}
									/>
								</label>
							))}
						</div>
					</fieldset>
				);
			})}
			<p className="font-bold">{t("return-id-reminder")}</p>
			<label className="flex min-h-11 items-center gap-2">
				<input
					className="ui-checkbox"
					type="checkbox"
					checked={idReturned}
					onChange={event => setIdReturned(event.target.checked)}
				/>
				{t("id-returned")}
			</label>
			<button
				className="ui-button ui-button-primary"
				disabled={mutation.isLoading}
				onClick={() =>
					mutation.mutate({
						loanId: loan.id,
						idempotencyKey: newKey(),
						idReturned,
						lines: loan.lines
							.map(line => ({
								loanLineId: line.id,
								...(values[line.id] ?? { good: 0, damaged: 0, missing: 0, consumed: 0 }),
							}))
							.filter(line => line.good + line.damaged + line.missing + line.consumed > 0),
					})
				}
			>
				{t("return")}
			</button>
			{mutation.isError && <p role="alert">{mutation.error.message}</p>}
		</article>
	);
}
export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/internal/hardware"),
		props: await serverSideTranslations(locale ?? "en", ["hardware", "qr", "navbar", "common"]),
	};
};
