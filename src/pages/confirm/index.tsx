import { type NextPage } from "next";
import { signIn, signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import { trpc } from "../../utils/api";

const Confirm: NextPage = () => {
    // Get session
    const { data: sessionData } = useSession();

    // Get query params
    const router = useRouter();
    const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;

    // const mutation = trpc.hackers.assign.useMutation();

    const query = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });

    const [shirtSize, setShirtSize] = useState("S");
    const [attendanceType, setAttendanceType] = useState("IN_PERSON");

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!sessionData?.user?.id) {
            void signIn();
            return;
        }

        console.log("Submitting form", {
            id,
            shirtSize,
            attendanceType,
            userId: sessionData.user.id,
        });

        /* mutation.mutate({
            id,
            shirtSize,
            attendanceType,
            userId: sessionData.user.id,
        }); */
    };

    const handleShirtSizeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        setShirtSize(event.target.value);
    }, []);

    const handleAttendanceTypeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAttendanceType(event.target.value);
    }, []);

    return (
        <>
            <Head>
                <title>Track the Hack</title>
                <meta name="description" content="Generated by create-t3-app" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main className="flex h-screen flex-col items-center justify-center gap-4 bg-gradient bg-no-repeat px-12 text-center">
                {query.data ? (
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col items-center justify-center gap-4 px-12 text-center"
                    >
                        <div className="flex flex-col items-center">
                            <Image
                                src="https://hackthehill.com/Logos/hackthehill-logo.svg"
                                alt="Hack the Hill logo"
                                width={128}
                                height={128}
                                priority={true}
                            />
                            <h1 className="font-[Coolvetica] text-[clamp(1rem,3.5vmin,5rem)]  font-normal text-dark">
                                Hack the Hill
                            </h1>
                        </div>
                        <div className="flex max-w-[20rem] flex-col items-start gap-4">
                            <h3 className="font-[Rubik] text-[clamp(1rem,1vmin,5rem)] font-medium text-dark">
                                Congratulations for your acceptance to Hack the Hill 2023!
                            </h3>
                            <p>Please confirm your attendance and T-Shirt size by filling out the form below. </p>
                            <div className="flex items-center justify-center gap-4">
                                <input
                                    type="radio"
                                    id="in-person"
                                    name="attendanceType"
                                    value="IN_PERSON"
                                    onChange={handleAttendanceTypeChange}
                                    className="flex h-4 w-4 appearance-none items-center justify-center rounded-full border border-[#3f4e77] bg-transparent text-black after:m-0.5 after:block after:h-full after:w-full after:border-black after:leading-[calc(100%*3/4)] after:checked:content-check"
                                />
                                <label htmlFor="in-person" className="whitespace-nowrap text-[clamp(1rem,1vmin,5rem)]">
                                    In-Person at the University of Ottawa
                                </label>
                            </div>
                            <div className="flex items-center justify-center gap-4">
                                <input
                                    type="radio"
                                    id="online"
                                    name="attendanceType"
                                    value="ONLINE"
                                    onChange={handleAttendanceTypeChange}
                                    className="flex h-4 w-4 appearance-none items-center justify-center rounded-full border border-[#3f4e77] bg-transparent text-black after:m-0.5 after:block after:h-full after:w-full after:border-black after:leading-[calc(100%*3/4)] after:checked:content-check"
                                />
                                <label htmlFor="online" className="whitespace-nowrap text-[clamp(1rem,1vmin,5rem)]">
                                    Online on Twitch
                                </label>
                            </div>
                            <div className="flex items-center justify-center gap-4">
                                <label htmlFor="shirtSize" className="whitespace-nowrap text-[clamp(1rem,1vmin,5rem)]">
                                    T-Shirt size:
                                </label>
                                <div className="rounded-2xl border border-[#3f4e77] py-2 px-4">
                                    <select
                                        name="shirtSize"
                                        id="shirtSize"
                                        value={shirtSize}
                                        onChange={handleShirtSizeChange}
                                        className="w-full border-none bg-transparent text-inherit text-black focus-visible:outline-none"
                                    >
                                        <option value="S" className="bg-white">
                                            Small
                                        </option>
                                        <option value="M" className="bg-white">
                                            Medium
                                        </option>
                                        <option value="L" className="bg-white">
                                            Large
                                        </option>
                                        <option value="XL" className="bg-white">
                                            X-Large
                                        </option>
                                        <option value="XXL" className="bg-white">
                                            XX-Large
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center gap-4">
                            {sessionData?.user?.id ? (
                                <>
                                    <p>Signed in as {sessionData.user.email}</p>
                                    <button type="button" onClick={() => void signOut()}>
                                        Sign Out
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p>Please sign in to continue</p>
                                    <button type="button" onClick={() => void signIn()}>
                                        Sign In
                                    </button>
                                </>
                            )}
                            <p>This account will be assigned to your registration.</p>
                        </div>

                        <Link href="/">
                            <button
                                type="submit"
                                className="m-4 transform cursor-pointer whitespace-nowrap rounded-[100px] border-0 bg-[#5c71ad] px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-[Rubik] text-[clamp(1rem,1vmin,5rem)] text-white shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-[#3f4e77]"
                            >
                                Submit
                            </button>
                        </Link>
                    </form>
                ) : (
                    <p>Invalid confirmation link. Please use the link from the confirmation email you received.</p>
                )}
            </main>
        </>
    );
};

export default Confirm;
