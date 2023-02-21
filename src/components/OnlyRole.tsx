import { useSession } from "next-auth/react";

import { trpc } from "../utils/api";
import type { Roles } from "../utils/common";

import Error from "./Error";

type OnlyRoleProps = {
	roles: Roles[];
	children: React.ReactNode;
};

const OnlyRole = ({ roles, children }: OnlyRoleProps) => {
	const { data: sessionData } = useSession();

	const query = trpc.users.getRole.useQuery(
		{
			id: sessionData?.user?.id ?? "",
		},
		{
			enabled: !!sessionData?.user?.id,
		},
	);

	if (query.isLoading && query.isSuccess) {
		return null;
	}

	if (query.isError) {
		return <Error message={query.error.message} />;
	}

	if (query.data && roles.includes(query.data)) {
		return <>{children}</>;
	}

	return null;
};

export default OnlyRole;
