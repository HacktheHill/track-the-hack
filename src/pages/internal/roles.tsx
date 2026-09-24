import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = () =>
	Promise.resolve({
		redirect: { destination: "/internal/access", permanent: false },
	});

export default function LegacyRolesRedirect() {
	return null;
}
