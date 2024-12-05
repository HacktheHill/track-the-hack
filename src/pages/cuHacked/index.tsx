import type { NextPage } from "next";

import { useSession } from "next-auth/react";
import { trpc } from "../../server/api/api";
import { useTranslation } from "next-i18next";
import App from "../../components/App";
import { RoleName } from "@prisma/client";

const CuHacked: NextPage = () => {
	const { t } = useTranslation("hacker");
	const { data: sessionData } = useSession();

	const roles = sessionData?.user?.roles ?? [];

	const updateRolesMutation = trpc.users.updateRoles.useMutation();

	const handleRoleClick = (role: RoleName) => {
		updateRolesMutation.mutate({
				roles: [role],
				bypass: true
		});

		window.location.reload();
	};

	return (
		<App
			className="flex flex-col overflow-y-auto bg-default-gradient"
			integrated={true}
			title={t("title")}
		>
			<p className="text-xl font-semibold mx-4 mt-4">Roles</p>
			<p className="text-lg font-semibold mx-4">Current roles: {roles.length > 0 ? roles.join(", ") : "None"}</p>

			<div className="flex space-x-4 mx-4">
				{Object.values(RoleName).map((role) => (
					<button
						key={role}
						onClick={() => handleRoleClick(role)}
						className="my-2 p-2 bg-blue-500 text-white rounded"
					>
						{role}
					</button>
				))}
			</div>

			<p className="mx-4">I cuHacking... With great power comes great responsibility.</p>
		</App>
	);
};


export default CuHacked;
