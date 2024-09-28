import { useTranslation } from "next-i18next";
import { useState } from "react";
import Error from "../components/Error";

import { trpc } from "../server/api/api";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../server/api/root";
import { TRPCClientError } from "@trpc/client";
import { debounce } from "../utils/helpers";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Hacker = RouterOutput["hackers"]["get"];

type HackerData = {
	id: string;
	firstName: string;
	lastName: string;
	Team: {
		name: string;
		hackers: Hacker[];
	};
};

const TeamCreation = ({ hacker }: { hacker: HackerData }) => {
	const { t } = useTranslation("hacker");
	const [teamName, setTeamName] = useState("");

	const createTeamMutation = trpc.teams.create.useMutation();
	const hackerConfirmMutation = trpc.hackers.confirm.useMutation();

	const [display, setDisplay] = useState(<></>);
	const [teamExists, setTeamExists] = useState(false);

	const utils = trpc.useUtils();

	const searchTeamHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTeamName(e.target.value);
		setDisplay(<></>);
		debounceCheckTeam(e.target.value);
	};

	const debounceCheckTeam = debounce(async (name: string) => {
		try {
			const { exists } = await utils.teams.check.fetch({ name });
			if (exists) {
				return setTeamExists(true);
			}
			setTeamExists(false);
		} catch (error) {
			if (error instanceof TRPCClientError) {
				return setDisplay(<div>Error: {error.message}</div>);
			}
			return setDisplay(<UnknownError />);
		}
	}, 300);

	const createTeamHandler = async () => {
		if (teamName && teamName != "") {
			try {
				await createTeamMutation.mutateAsync({ hackerId: hacker.id, teamName });
				window.location.reload();
			} catch (error) {
				if (error instanceof TRPCClientError) {
					return setDisplay(<div>Error: {error.message}</div>);
				}
				return setDisplay(<UnknownError />);
			}
		}
	};

	const joinTeamHandler = async () => {
		try {
			await hackerConfirmMutation.mutateAsync({ id: hacker.id, teamName });
			window.location.reload();
		} catch (error) {
			if (error instanceof TRPCClientError) {
				return setDisplay(<div>Error: {error.message}</div>);
			}
			return setDisplay(<UnknownError />);
		}
	};
	return (
		<div className="flex flex-col content-center gap-4">
			<h3 className="text-center font-coolvetica text-2xl text-dark-color">{t("team")}</h3>
			<>
				<input
					type="text"
					value={teamName}
					placeholder={t("enter-team")}
					onChange={searchTeamHandler}
					className="w-full rounded border-none bg-light-primary-color/75 px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
				/>
				{teamExists ? (
					<button
						className="flex items-center justify-center gap-2 rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
						onClick={e => {
							e.preventDefault();
							void joinTeamHandler();
						}}
					>
						{t("join-team")} {teamName}
					</button>
				) : (
					<button
						className="flex items-center justify-center gap-2 rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
						onClick={e => {
							e.preventDefault();
							void createTeamHandler();
						}}
					>
						{t("create-team")}
					</button>
				)}
			</>

			{display}
		</div>
	);
};

const UnknownError = () => {
	const { t } = useTranslation("hacker");

	return <Error message={t("unknown-error")} />;
};

export default TeamCreation;
