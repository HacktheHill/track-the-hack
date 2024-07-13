import { useSession } from "next-auth/react";
import { Children } from "react";

import type { RoleName } from "@prisma/client";
import { useTranslation } from "next-i18next";
import { roleHierarchy } from "../utils/common";
import Error from "./Error";
import Loading from "./Loading";

type FilterProps =
	| {
			value: RoleName[];
			method: "some";
			silent?: boolean;
			children: React.ReactNode;
	  }
	| {
			value: (roles: RoleName[]) => boolean;
			method: "function";
			silent?: boolean;
			children: React.ReactNode;
	  }
	| {
			value: RoleName;
			method: "above";
			silent?: boolean;
			children: React.ReactNode;
	  }
	| {
			value?: never;
			method: "none";
			silent?: boolean;
			children: React.ReactNode;
	  }
	| {
			value: RoleName[];
			method: "only";
			silent?: boolean;
			children: React.ReactNode;
	  };

const Filter = (props: FilterProps) => {
	const { value, method, silent, children } = props;
	const childrenArray = Children.toArray(children);

	const { t } = useTranslation("common");

	const { data: sessionData, status } = useSession();
	const roles = sessionData?.user?.roles;

	if (status === "loading" && !silent) {
		return <Loading />;
	}

	if (roles) {
		let shouldRender = false;

		if (method === "some") {
			shouldRender = roles.some(role => value.includes(role));
		} else if (method === "function") {
			shouldRender = value(roles);
		} else if (method === "above") {
			shouldRender = roles.some(role => roleHierarchy.indexOf(role) >= roleHierarchy.indexOf(value));
		} else if (method === "none") {
			shouldRender = roles.length === 0;
		} else if (method === "only") {
			shouldRender = value.some(role => roles.includes(role)) && roles.every(role => value.includes(role));
		}

		if (shouldRender) {
			return <>{childrenArray[0]}</>;
		}
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
