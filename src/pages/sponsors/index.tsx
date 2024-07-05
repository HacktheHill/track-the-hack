import type { ChipProps } from "@nextui-org/react";
import {
	Button,
	Chip,
	Input,
	Link,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	Select,
	SelectItem,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
	Tooltip,
	User,
} from "@nextui-org/react";
import { Role } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps, NextPage } from "next/types";
import { useState } from "react";
import DeleteIcon from "./DeleteIcon";
import EditIcon from "./EditIcon";
import EyeIcon from "./EyeIcon";
import PlusIcon from "./PlusIcon";

import { useRouter } from "next/router";
import { useCallback } from "react";
import { z } from "zod";
import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";
import Loading from "../../components/Loading";
import { trpc } from "../../utils/api";
import { addSponsorshipSchema, sponsorshipSchema } from "../../utils/common";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "walk-in"]),
	};
};

const Sponsors: NextPage = () => {
	const { t } = useTranslation("payment");
	const { data: sessionData } = useSession();

	const companyQuery = trpc.payment.getAllCompanies.useQuery(undefined, { enabled: true });

	if (companyQuery.isLoading) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Loading />
				</div>
			</App>
		);
	}

	if (!companyQuery.isLoading && !companyQuery.data) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={"Impossible to load companies"} />
			</App>
		);
	}

	return (
		<App className="overflow-y-auto bg-default-gradient p-8 sm:p-12" title={t("title")}>
			<Filter filter={role => role === Role.ORGANIZER}>
				<SponsorsTable companyQuery={companyQuery} />
				<Error message={t("not-authorized-to-view-this-page")} />
			</Filter>
		</App>
	);
};

const statusColorMap: Record<string, ChipProps["color"]> = {
	paid: "success",
	cancelled: "danger",
	no_payment: "warning",
};

type CompanyQueryResult = {
	data: {
		id: string;
		companyName: string;
		amount: number;
		repName: string;
		tier: string;
		logo: string;
		paid: string;
	}[];
};

type RawCompanyData = {
	id: string;
	companyName: string;
	amount: number;
	repName: string;
	tier: string;
	logo: string;
	paid: string;
};

type Companies = RawCompanyData & { logo: string };

const SponsorsTable = ({ companyQuery }: { companyQuery: CompanyQueryResult }) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isModalOpen2, setIsModalOpen2] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	const router = useRouter();
	const columns = [
		{ name: "Company Name", uid: "company_name" },
		{ name: "Tier", uid: "tier" },
		{ name: "Payment Status", uid: "paid" },
		{ name: "Actions", uid: "actions" },
	];
	const companies: Companies[] = (Array.isArray(companyQuery.data) ? companyQuery.data : [companyQuery.data]).map(
		(company: RawCompanyData) => ({
			...company,
		}),
	);

	const renderCell = useCallback(
		(company: Companies, columnKey: string) => {
			const cellValue = (company[columnKey as keyof Companies] as string) || "";

			switch (columnKey) {
				case "company_name":
					return (
						<User
							avatarProps={{ radius: "full", src: "/icons/favicon-96x96.png", size: "lg" }}
							description={company.id}
							name={cellValue}
							classNames={{
								base: "bg-red",
							}}
						>
							{company.companyName}
						</User>
					);
				case "tier":
					return (
						<div className="flex flex-col">
							<p className="text-bold text-sm capitalize">{cellValue}</p>
							<p className="text-bold text-sm capitalize text-default-400">${company.amount}</p>
						</div>
					);
				case "paid":
					return (
						<Chip className="capitalize" color={statusColorMap[company.paid]} size="sm" variant="flat">
							{cellValue}
						</Chip>
					);
				case "actions":
					return (
						<div className="relative flex items-center gap-2">
							<Tooltip content="Preview">
								<span
									className="cursor-pointer text-lg text-default-400 active:opacity-50"
									onClick={() => {
										router.push(`/payment?id=${company.id}`).catch(error => {
											console.error("Error navigating to payment page:", error);
										});
									}}
								>
									<EyeIcon />
								</span>
							</Tooltip>
							<Tooltip content="Edit">
								<span
									className="cursor-pointer text-lg text-default-400 active:opacity-50"
									onClick={() => {
										setIsModalOpen(true);
										setSelectedUserId(company.id);
									}}
								>
									<EditIcon />
								</span>
							</Tooltip>
							<Tooltip color="danger" content="Delete">
								<span className="cursor-pointer text-lg text-danger active:opacity-50">
									<DeleteIcon />
								</span>
							</Tooltip>
						</div>
					);
				default:
					return cellValue;
			}
		},
		[router],
	);

	return (
		<div>
			<div className="mb-3 mt-0 flex justify-center">
				<Button
					className="bg-dark-primary-color text-light-color"
					onClick={() => {
						setIsModalOpen2(true);
					}}
					endContent={<PlusIcon />}
				>
					Add New Sponsor
				</Button>
			</div>
			<Table aria-label="Table">
				<TableHeader columns={columns}>
					{column => (
						<TableColumn key={column.uid} align={column.uid === "actions" ? "center" : "start"}>
							{column.name}
						</TableColumn>
					)}
				</TableHeader>
				<TableBody items={companies}>
					{item => (
						<TableRow key={item.id}>
							{columnKey => <TableCell>{renderCell(item, String(columnKey))}</TableCell>}
						</TableRow>
					)}
				</TableBody>
			</Table>
			<EditModal
				isModalOpen={isModalOpen}
				setIsModalOpen={setIsModalOpen}
				selectedUserId={selectedUserId}
				setSelectedUserId={setSelectedUserId}
				data={companies}
			/>
			<NewSponsorModal isModalOpen={isModalOpen2} setIsModalOpen={setIsModalOpen2} />
		</div>
	);
};

type EditModalProps = {
	isModalOpen: boolean;
	setIsModalOpen: (isOpen: boolean) => void;
	selectedUserId: string | null;
	setSelectedUserId: (userId: string | null) => void;
	data: Companies[];
};

interface FormData {
	id: string;
	amount?: number;
	tier?: string;
}

const EditModal = ({ isModalOpen, setIsModalOpen, selectedUserId, setSelectedUserId, data }: EditModalProps) => {
	const mutation = trpc.payment.updateCompany.useMutation();
	const informations = data.find(user => user.id === selectedUserId);

	const [actualTier, setActualTier] = useState<string | null>(null);

	const amount = {
		MAYOR: "2500",
		PREMIER: "5000",
		GOVERNOR: "7500",
		PRIME_MINISTER: "10000",
	};

	const [formData, setFormData] = useState<FormData>({
		id: "",
	});
	if (!informations || !isModalOpen) {
		return null;
	}

	const handleInputChange = (key: string, value: string | number) => {
		setFormData(prevFormData => {
			if (key === "tier" && typeof value === "string") {
				const newAmount =
					value === "CUSTOM" || value === "STARTUP"
						? parseFloat(value)
						: amount[value as keyof typeof amount]
							? parseInt(amount[value as keyof typeof amount] ?? "0")
							: 0;
				return {
					...prevFormData,
					[key]: value,
					amount: newAmount,
				};
			}

			return {
				...prevFormData,
				[key]: value,
			};
		});
	};

	const handleSave = (id: string) => {
		try {
			formData.id = id;
			const parse = sponsorshipSchema
				.extend({
					id: z.string(),
				})
				.safeParse(formData);

			if (!parse.success) {
				console.error("Validation Error:", parse.error);
			} else {
				mutation.mutate(parse.data);
			}
			setFormData({ id: "" });
			setIsModalOpen(false);
			setSelectedUserId(null);

			window.location.reload();
		} catch (error) {
			console.error("Error updating company:", error);
		}
	};

	const tiers = [
		{ label: "Startup", value: "STARTUP" },
		{ label: "Mayor", value: "MAYOR" },
		{ label: "Premier", value: "PREMIER" },
		{ label: "Governor", value: "GOVERNOR" },
		{ label: "Prime Minister", value: "PRIME_MINISTER" },
		{ label: "Custom", value: "CUSTOM" },
	];

	const status = [
		{ label: "Paid", value: "paid" },
		{ label: "Cancelled", value: "cancelled" },
		{ label: "No Payment", value: "no_payment" },
	];

	return (
		isModalOpen && (
			<Modal
				isOpen={isModalOpen}
				placement="top-center"
				backdrop="opaque"
				motionProps={{
					variants: {
						enter: {
							y: 0,
							opacity: 1,
							transition: {
								duration: 0.3,
								ease: "easeOut",
							},
						},
						exit: {
							y: -20,
							opacity: 0,
							transition: {
								duration: 0.2,
								ease: "easeIn",
							},
						},
					},
				}}
			>
				<ModalContent>
					<div>
						<ModalHeader className="flex flex-col gap-1">Edit Sponsor Informations</ModalHeader>
						<ModalBody>
							<div className="mb-6 flex w-full flex-col flex-wrap gap-4 md:mb-0 md:flex-nowrap">
								<Input label="ID" placeholder={informations.id} isDisabled={true} />
								<Input
									label="Company Name"
									placeholder={informations.companyName}
									onChange={e => handleInputChange("company_name", e.target.value)}
								/>
								<Select
									label="Tier"
									placeholder="Select a tier"
									defaultSelectedKeys={[informations.tier]}
									onChange={event => {
										const selectedTier = (event.target as HTMLSelectElement).value;
										setActualTier(selectedTier);
										handleInputChange("tier", selectedTier);
									}}
								>
									{tiers.map(tier => (
										<SelectItem key={tier.value} value={tier.value}>
											{tier.label}
										</SelectItem>
									))}
								</Select>
								{actualTier === "CUSTOM" || actualTier === "STARTUP" ? (
									<Input
										label="Amount"
										placeholder={informations.amount.toString()}
										onChange={e => handleInputChange("amount", parseFloat(e.target.value))}
									/>
								) : (
									<Input
										label="Amount"
										placeholder={
											formData.amount !== undefined
												? formData.amount.toString()
												: informations.amount.toString()
										}
										isDisabled={true}
									/>
								)}
								<Input
									label="Reps Name"
									placeholder={informations.repName}
									onChange={e => handleInputChange("reps_name", e.target.value)}
								/>
								<Select
									label="Status"
									placeholder="Select a status"
									defaultSelectedKeys={[informations.paid]}
									onChange={event => {
										const selectedValue = (event.target as HTMLSelectElement).value;
										handleInputChange("paid", selectedValue);
									}}
								>
									{status.map(status => (
										<SelectItem key={status.value} value={status.value}>
											{status.label}
										</SelectItem>
									))}
								</Select>

								<Button
									href={informations.logo}
									as={Link}
									color="primary"
									showAnchorIcon
									variant="solid"
								>
									Company logo
								</Button>
							</div>
						</ModalBody>
						<ModalFooter>
							<Button
								color="danger"
								variant="flat"
								onPress={() => {
									setIsModalOpen(!isModalOpen);
									setSelectedUserId(null);
								}}
							>
								Close
							</Button>
							<Button color="success" onClick={() => handleSave(informations.id)}>
								Save
							</Button>
						</ModalFooter>
					</div>
				</ModalContent>
			</Modal>
		)
	);
};

interface NewSponsorModalProps {
	isModalOpen: boolean;
	setIsModalOpen: (isOpen: boolean) => void;
}

const NewSponsorModal = ({ isModalOpen, setIsModalOpen }: NewSponsorModalProps) => {
	const mutation = trpc.payment.addCompany.useMutation();
	const [actualTier, setActualTier] = useState<string | null>(null);
	const [formData, setFormData] = useState<FormData>({ id: "" });
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const handleChange = (key: string, value: string | number) => {
		setFormData(prevFormData => {
			return {
				...prevFormData,
				[key]: value,
			};
		});
	};

	const handleSave = (id: string) => {
		try {
			formData.id = id;

			if (actualTier) {
				if (actualTier !== "STARTUP" && actualTier !== "CUSTOM") {
					const tierAmount = amount[actualTier as keyof typeof amount];
					formData.amount = parseInt(tierAmount, 10);
				}
			}

			const parse = addSponsorshipSchema
				.extend({
					id: z.string(),
				})
				.safeParse(formData);

			if (!parse.success) {
				setErrorMessage("Please fill all the required fields.");
				console.error("Validation Error:", parse.error);
			} else {
				setIsModalOpen(false);
				setFormData({ id: "" });
				setErrorMessage(null);
				setActualTier(null);
				mutation.mutate(parse.data);
			}
		} catch (error) {
			console.error("Error updating company:", error);
		}
	};

	const generateRandomId = (length: number) => {
		const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";

		for (let i = 0; i < length; i++) {
			const randomIndex = Math.floor(Math.random() * characters.length);
			result += characters.charAt(randomIndex);
		}

		return result;
	};

	const tiers = [
		{ label: "Startup", value: "STARTUP" },
		{ label: "Mayor", value: "MAYOR" },
		{ label: "Premier", value: "PREMIER" },
		{ label: "Governor", value: "GOVERNOR" },
		{ label: "Prime Minister", value: "PRIME_MINISTER" },
		{ label: "Custom", value: "CUSTOM" },
	];

	const status = [
		{ label: "Paid", value: "paid" },
		{ label: "Cancelled", value: "cancelled" },
		{ label: "No Payment", value: "no_payment" },
	];

	type AmountType = {
		MAYOR: string;
		PREMIER: string;
		GOVERNOR: string;
		PRIME_MINISTER: string;
	};

	const amount: AmountType = {
		MAYOR: "2500",
		PREMIER: "5000",
		GOVERNOR: "7500",
		PRIME_MINISTER: "10000",
	};

	return (
		<>
			{isModalOpen && (
				<Modal
					isOpen={true}
					placement="top-center"
					backdrop="opaque"
					motionProps={{
						variants: {
							enter: {
								y: 0,
								opacity: 1,
								transition: {
									duration: 0.3,
									ease: "easeOut",
								},
							},
							exit: {
								y: -20,
								opacity: 0,
								transition: {
									duration: 0.2,
									ease: "easeIn",
								},
							},
						},
					}}
				>
					<ModalContent>
						<div>
							<ModalHeader className="flex flex-col gap-1">Create a new Sponsor</ModalHeader>
							<ModalBody>
								<div className="mb-6 flex w-full flex-col flex-wrap gap-4 md:mb-0 md:flex-nowrap">
									<Input label="ID" placeholder={"ID is generated"} isDisabled={true} />
									<Input
										label="Company Name"
										onChange={event => {
											const company_name = event.target.value;
											handleChange("company_name", company_name);
										}}
										isRequired={true}
									/>
									<Select
										label="Tier"
										placeholder="Select a tier"
										onChange={event => {
											const selectedTier = (event.target as HTMLSelectElement).value;
											setActualTier(selectedTier);
											handleChange("tier", selectedTier);
										}}
										isRequired={true}
									>
										{tiers.map(tier => (
											<SelectItem key={tier.value} value={tier.value}>
												{tier.label}
											</SelectItem>
										))}
									</Select>
									{actualTier === "CUSTOM" || actualTier === "STARTUP" ? (
										<Input
											label="Amount"
											onChange={event => {
												const amount = event.target.value;
												handleChange("amount", parseInt(amount));
											}}
											isRequired={true}
										/>
									) : (
										<Input
											label="Amount"
											placeholder={
												actualTier ? (amount as Record<string, string>)[actualTier] : ""
											}
										/>
									)}
									<Input
										label="Reps Name"
										onChange={event => {
											const amount = event.target.value;
											handleChange("reps_name", amount);
										}}
										isRequired={true}
									/>
									<Select
										label="Status"
										placeholder="Select a status"
										onChange={event => {
											const selectedValue = event.target.value;
											handleChange("paid", selectedValue);
										}}
										isRequired={true}
									>
										{status.map(status => (
											<SelectItem key={status.value} value={status.value}>
												{status.label}
											</SelectItem>
										))}
									</Select>
									<Input
										label="Logo URL"
										onChange={event => {
											const amount = event.target.value;
											handleChange("logo", amount);
										}}
										isRequired={true}
									/>
								</div>
								{errorMessage && (
									<div className="flex items-center justify-center gap-2 text-danger">
										<span>{errorMessage}</span>
									</div>
								)}
							</ModalBody>
							<ModalFooter>
								<Button
									color="danger"
									variant="flat"
									onClick={() => {
										setIsModalOpen(false);
									}}
								>
									Cancel
								</Button>
								<Button
									onClick={() => {
										handleSave(generateRandomId(8));
									}}
									color="success"
								>
									Create
								</Button>
							</ModalFooter>
						</div>
					</ModalContent>
				</Modal>
			)}
		</>
	);
};

export default Sponsors;
