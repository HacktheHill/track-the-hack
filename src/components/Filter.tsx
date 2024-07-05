import { useSession } from "next-auth/react";
import { Children } from "react";

import { trpc } from "../utils/api";
import type { Roles } from "../utils/common";

import Error from "./Error";

type FilterProps = {
	filter: (role: Roles) => boolean;
	children: React.ReactNode;
};

const Filter = ({ filter, children }: FilterProps) => {
	const { data: sessionData } = useSession();
	const id = sessionData?.user?.id ?? "";

	const query = trpc.users.getRole.useQuery({ id }, { enabled: !!id });

	if (query.isLoading && query.isSuccess) {
		return null;
	}

	if (query.isError) {
		return <Error message={query.error.message} />;
	}

	if (query.data && filter(query.data)) {
		return <>{children}</>;
	}

	const childrenArray = Children.toArray(children);
	if (query.data && !filter(query.data) && childrenArray.length >= 2) {
		return <>{childrenArray[1]}</>;
	}

	return null;
};

export default Filter;
