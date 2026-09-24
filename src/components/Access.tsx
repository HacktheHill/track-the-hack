import { useSession } from "next-auth/react";
import Error from "./Error";
import Loading from "./Loading";
import { useTranslation } from "next-i18next";

const Access = ({
	admin = false,
	silent = false,
	children,
}: {
	admin?: boolean;
	silent?: boolean;
	children: React.ReactNode;
}) => {
	const { data, status } = useSession();
	const { t } = useTranslation("common");
	if (status === "loading") return silent ? null : <Loading />;
	const allowed = data?.user?.isOrganizer && (!admin || data.user.isAdmin);
	if (allowed) return <>{children}</>;
	return silent ? null : <Error message={t("unauthorized")} />;
};

export default Access;
