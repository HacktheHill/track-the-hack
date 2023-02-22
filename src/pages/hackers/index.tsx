
import Card from '../../components/Card';
import Search from '../../components/Search';
import App from "../../components/App";

import { trpc } from "../../utils/api";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import { useRouter,  } from 'next/router';
import Hacker from "./hacker";
import { useEffect, useState } from 'react';
const Hackers = () => {
  
  const query = trpc.hackers.all.useQuery();
  const router = useRouter();

	if (query.isLoading || query.data == null) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<Loading />
			</App>
		);
	} else if (query.isError) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={query.error.message} />
				</div>
			</App>
		);
	}

	if (query.data == null) {
		void router.push("/404");
	}

  const [id] = [router.query.id].flat()

  return (
    id?
    <Hacker/>
    :
    <App className="h-full bg-gradient-to-b from-background2 to-background1  py-8 sm:px-20">
      <Search></Search>
				<div className="h-full flex-col gap-8 overflow-y-auto to-mobile:mx-auto grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((hacker) => (
            <Card key={hacker.id} id={hacker.id} firstName={hacker.firstName} lastName={hacker.lastName} university={hacker.university} studyProgram={hacker.studyProgram}/>
          ))}
        </div>
	  </App> 
)
}

export default Hackers