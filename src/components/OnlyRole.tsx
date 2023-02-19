import { useSession } from "next-auth/react";

import { trpc } from "../utils/api";
import type { Roles } from "../utils/common";

const OnlyRole = ({ filter, children }: { filter: (role: Roles | null) => boolean; children: React.ReactNode }) => {
	const { data: sessionData } = useSession();

	const query = trpc.users.getRole.useQuery(
		{
			id: sessionData?.user?.id ?? "",
		},
		{
			enabled: !!sessionData?.user?.id,
		},
	);

	if (query.isLoading) return null;
	if (query.isError) return <p>Error: {query.error.message}</p>;

	if (filter(query.data)) return <>{children}</>;

	return null;
};

export default OnlyRole;
