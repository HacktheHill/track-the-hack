
import { Role, type HackerInfo } from "@prisma/client";
import type { NextPage } from "next";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { contextProps } from "@trpc/react-query/shared";
import { procedureTypes } from "@trpc/server";
import { renderToString } from 'react-dom/server';
import type { GetServerSideProps} from "next";



type ServerSideProps = {
	redirect?: { destination: any; permanent: boolean } | null;
	props: { [key: string]: any };
};


export async function hackersRedirect(req: any, res: any, locale: any): Promise<ServerSideProps> {

    const prisma = new PrismaClient();
    const session = await getServerSession(req, res, authOptions);
  
    const user =
      session &&
      (await prisma.user.findUnique({
        where: {
          id: session?.user?.id,
        },
      }));
  
    if (!user) {
        return {
            redirect: {
              destination: "/api/auth/signin",
              permanent: false,
            },
            props: {},
          };
    }
  
    if (user.role !== "ORGANIZER") {
      return {
        redirect: {
          destination: "/",
          permanent: false,
        },
        props: {},
      };
    }
  
    return {
      props: await serverSideTranslations(locale ?? "en", ["common", "hackers"]),
    };
  }


