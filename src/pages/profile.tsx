import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "./api/auth/[...nextauth]";
import { RoleName } from "@prisma/client";

const ProfilePage = () => null;

export default ProfilePage;

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));

	// If the user is not signed in, redirect them to the sign in page
	if (!session?.user) {
		return {
			redirect: {
				destination: "/api/auth/signin?callbackUrl=/profile",
				permanent: false,
			},
		};
	}

	// If the user is not a hacker, redirect them to the home page
	if (!session.user.roles.includes(RoleName.HACKER) || !session.user.hackerId) {
		return {
			redirect: {
				destination: "/",
				permanent: false,
			},
		};
	}

	// Redirect to the hacker profile page
	return {
		redirect: {
			destination: `/hackers/hacker?id=${session?.user?.hackerId}`,
			permanent: false,
		},
	};
};
