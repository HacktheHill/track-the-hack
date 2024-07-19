import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import type { GetServerSideProps, NextPage } from "next/types";
import { useEffect, useState } from "react";

import App from "../../components/App";
import { trpc } from "../../server/api/api";
import { fields, hackerSchema, patterns } from "../../utils/common";
import { sessionRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";
import { uploadResume } from "../../client/s3";
import Loading from "../../components/Loading";

const processFormData = (formData: FormData) => {
	const data = Object.fromEntries(formData.entries()) as {
		[k: string]: FormDataEntryValue | number | boolean | File | undefined;
	};

	if (data.preferredLanguage === "en" || data.preferredLanguage === "fr") {
		data.preferredLanguage = data.preferredLanguage.toUpperCase();
	} else {
		data.preferredLanguage = undefined;
	}

	if (typeof data.graduationYear === "string") {
		data.graduationYear = parseInt(data.graduationYear);
		if (Number.isNaN(data.graduationYear)) {
			data.graduationYear = undefined;
		}
	}

	if (data.shirtSize === "") {
		data.shirtSize = undefined;
	}

	if (typeof data.numberOfPreviousHackathons === "string") {
		data.numberOfPreviousHackathons = parseInt(data.numberOfPreviousHackathons);
		if (Number.isNaN(data.numberOfPreviousHackathons)) {
			data.numberOfPreviousHackathons = undefined;
		}
	}

	return data;
};

const Apply: NextPage = () => {
	const { t } = useTranslation("apply");
	const router = useRouter();

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const mutation = trpc.hackers.apply.useMutation();

	useEffect(() => {
		if (mutation.error) {
			setError(mutation.error.message);
		}
	}, [mutation.error, t]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setLoading(true);

		const formData = new FormData(event.currentTarget);
		const data = processFormData(formData);

		const resume = formData.get("resume") as File | null;
		data.hasResume = !!resume;

		const parse = hackerSchema.safeParse(data);
		if (!parse.success) {
			setError(t("invalid-form"));
			console.error(parse.error.message);
		} else {
			const result = await mutation.mutateAsync(parse.data);
			if (result.presignedUrl && resume) {
				await uploadResume(result.presignedUrl, resume, resume.name);
			}

			if (!mutation.error) {
				setError("");
				event.currentTarget?.reset();
				setSuccess(true);
			} else {
				setError(mutation.error.message);
			}
		}
		setLoading(false);
	};

  return (
    <div className="w-full relative bg-lightsalmon overflow-hidden flex flex-col items-center justify-start pt-[64px] px-5 pb-[64px] box-border leading-[normal] tracking-[normal]">
      <div className="w-[4674px] h-[4764px] absolute !m-[0] top-[-1683px] left-[-2069px] rounded-[50%] [background:radial-gradient(50%_50%_at_50%_50%,_#fee4a1,_rgba(250,_209,_147,_0.79)_42%,_rgba(234,_138,_96,_0))]" />
      <App className="relative z-10 w-full max-w-3xl" title={t("title")}>
        {success ? (
          <div className="flex flex-col items-center gap-8 bg-white rounded-xl p-8 shadow-lg">
            <h3 className="font-rubik text-4xl font-bold text-maroon-300">{t("title")}</h3>
            <p className="text-maroon-500">{t("success")}</p>
            <button
              className="cursor-pointer [border:none] pt-2 px-6 pb-2 bg-maroon-300 rounded-3xs text-xl font-medium font-p-button text-linen text-center shadow-[0px_4px_4px_rgba(0,_0,_0,_0.25)] hover:bg-maroon-400 transition-colors"
              onClick={() => void router.replace("/")}
            >
              {t("back")}
            </button>
          </div>
        ) : (
          <form onSubmit={e => void handleSubmit(e)} className="flex flex-col items-center gap-8 bg-white rounded-xl p-8 shadow-lg">
            <h3 className="font-rubik text-4xl font-bold text-maroon-300">{t("title")}</h3>
            <div className="flex flex-col gap-4 w-full">
              {fields.map(field => (
                <div key={field.name} className="flex w-full flex-col items-start gap-2">
                  <label htmlFor={field.name} className="font-rubik text-maroon-500">
                    {t(field.name)}
                    {field.required && <span className="text-red-500"> *</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      id={field.name}
                      name={field.name}
                      className="w-full rounded-3xs border-[1px] border-solid border-maroon-600 bg-transparent px-4 py-2 font-p-button text-xl text-maroon-500"
                      required={field.required}
                    >
                      <option value="">{t("select")}</option>
                      {field.options?.map(option => (
                        <option key={option} value={option}>
                          {t(option)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type}
                      className="w-full rounded-3xs border-[1px] border-solid border-maroon-600 bg-transparent px-4 py-2 font-p-button text-xl text-maroon-500"
                      required={field.required}
                      pattern={patterns[field.type]}
                      accept={field.type === "file" ? "application/pdf" : undefined}
                    />
                  )}
                </div>
              ))}
            </div>
            {error && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-center font-rubik text-red-500">{error}</p>
              </div>
            )}
            {loading ? (
              <Loading />
            ) : (
              <button className="cursor-pointer [border:none] pt-2 px-6 pb-2 bg-tomato rounded-3xs text-xl font-medium font-p-button text-linen text-center shadow-[0px_4px_4px_rgba(0,_0,_0,_0.25)] hover:bg-red-600 transition-colors">
                {t("submit")}
              </button>
            )}
          </form>
        )}
      </App>
    </div>
  );
};
export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: sessionRedirect(session, "/apply"),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["apply", "navbar", "common"])),
		},
	};
};

export default Apply;
