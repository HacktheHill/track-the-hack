import { useSession } from "next-auth/react";
import { Children } from "react";

import type { Roles } from "../utils/common";

import { useTranslation } from "next-i18next";
import Error from "./Error";
import Loading from "./Loading";

type FilterProps = {
	filter: (role: Roles) => boolean;
	silent?: boolean;
	children: React.ReactNode;
};

const Filter = ({ filter, silent, children }: FilterProps) => {
	const childrenArray = Children.toArray(children);

	const { t } = useTranslation("common");

	const { data: sessionData, status } = useSession();
	const role = sessionData?.user?.role;

	if (status === "loading" && !silent) {
		return <Loading />;
	}

	if (role && filter(role)) {
		return <>{childrenArray[0]}</>;
	}

	if (childrenArray.length >= 2) {
		return <>{childrenArray[1]}</>;
	}

	if (silent) {
		return null;
	}

	return <Error message={t("unauthorized")} />;
};

export default Filter;
