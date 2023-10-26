import { useState } from "react";
import { trpc } from "../../utils/api";
import { useEffect } from "react";
import { useRouter } from "next/router";
//an interface was added for the props passed to the component
import type { PresenceInfo as PresenceInfoNamespace } from "@prisma/client";

type popUpProps = {
	id: string;
	selectedOption: keyof PresenceInfoNamespace;
};

const Popup = ({ id, selectedOption } : popUpProps) => {

	const router = useRouter()
    const presenceQuery = trpc.presence.getFromHackerId.useQuery({id: id ?? ""}, {enabled: !!id})
	const hackerQuery = trpc.hackers.get.useQuery({id: id ?? ""}, {enabled: !!id})
	const presenceMutation = trpc.presence.update.useMutation();

	const [firstName, setFirstName]=useState("")
	const [lastName, setLastName]=useState("")
	const [shirt, setShirt]=useState("")
	const [visibility, setVisibility] = useState("invisible");
	const [queriesLoaded, setQueriesLoaded]=useState(false)
    
	useEffect(()=>{
		if (!hackerQuery.isLoading && !presenceQuery.isLoading){
			
			if (hackerQuery.data){
				setFirstName(hackerQuery.data.firstName)
				setLastName(hackerQuery.data.lastName)
				//shirt size may be null
				if(hackerQuery.data.shirtSize)
					setShirt(hackerQuery.data.shirtSize)	
			} 

			if (presenceQuery.data){
				
				if (presenceQuery.data[selectedOption]===false){
					setVisibility('bg-[#7cf77c] h-30 w-96 z-30 text-center p-2 rounded text-lg')
					const updatedPresenceInfo = { ...presenceQuery.data, [selectedOption]: true}
					console.log(updatedPresenceInfo)
					presenceMutation.mutate({
						id: id ?? "",
						presenceInfo: {selectedOption : true}
					})
				} else {
					setVisibility('bg-[#FF0000] h-30 w-96 z-30 text-center p-2 rounded text-lg')
				}
			}
		}

	}, [hackerQuery.isLoading, presenceQuery.isLoading, hackerQuery.data, presenceQuery.data]);

	useEffect(()=>{
		if (firstName!=="" && lastName!=="" && shirt!=="" && visibility!=="invisible"){
			setQueriesLoaded(true)
		}
	},[firstName, lastName, shirt])

	return(
        <div>
			{queriesLoaded && <div>
				{selectedOption==="checkedIn" && (
					<div className={visibility}>
						<h6 className="font-bold">{firstName} {lastName}</h6>
						<h6>Shirt Size: {shirt}</h6>
						<button onClick={()=>{void router.push(`/hackers/hacker?id=${id}`)}}></button>
					</div>
				)}
				{selectedOption==="breakfast1" && (
					<div className={visibility}>
						<h6 className="font-bold">{firstName} {lastName}</h6>
					</div>
				)}
				{selectedOption==="lunch1" && (
					<div className={visibility}>
						<h6 className="font-bold">{firstName} {lastName}</h6>
					</div>
				)}
				{selectedOption==="dinner1" && (
					<div className={visibility}>
						<h6 className="font-bold">{firstName} {lastName}</h6>
					</div>
				)}
				{selectedOption==="breakfast2" && (
					<div className={visibility}>
						<h6 className="font-bold">{firstName} {lastName}</h6>
					</div>
				)}
				{selectedOption==="lunch2" && (
					<div className={visibility}>
						<h6 className="font-bold">{firstName} {lastName}</h6>
					</div>
				)}					
			</div>}
        </div>
        
    )
}

export default Popup

							//eventSignInValue works, but it's not true or false!! We need a prisma check here to see if the value is true or false!
							// if (eventSignInValueElement) {
							// 	console.log(eventSignInValueElement)
								// if (eventSignInValueElement==false){
								// 	//Its not going to here
								// 	console.log("scanned")
								// 	setVisibility('bg-[#7cf77c] h-30 w-96 z-30 text-center p-2 rounded text-lg')
								// 	const presenceMutation = trpc.presence.update.useMutation();
								// 	const updatedPresenceInfo = {
								// 		...presenceState, 
								// 		eventSignInValueElement: true
								// 	}
								// 	setPresenceState(updatedPresenceInfo);
								// 	presenceMutation.mutate({
								// 		id: data ??"",
								// 		presenceInfo: updatedPresenceInfo
								// 	})
								// 	if (selectedOption==='OpeningCeremony'){
								// 		const hackerQuery = trpc.hackers.get.useQuery({id: data ?? ""}, {enabled:!!data})
								// 		const firstName=hackerQuery.data.firstName
								// 		const lastName=hackerQuery.data.lastName
								// 		const fullName = firstName.concat(lastName)
								// 		setName(fullName)
		
								// 		const shirtSize=hackerQuery.data.shirtSize
								// 		setShirt(shirtSize)
								// 	}
								// 	else{
								// 		const hackerQuery = trpc.hackers.get.useQuery({id: data ?? ""}, {enabled:!!data})
								// 		const firstName=hackerQuery.data.firstName
								// 		const lastName=hackerQuery.data.lastName
								// 		const fullName = firstName.concat(lastName)
								// 		setName(fullName)
								// 	}
								// } else {
								// 	setVisibility('bg-[#FF0000] h-30 w-96 z-30 text-center p-2 rounded text-lg')
								// }
							//}
							//Going to need to add functions to test number of sign ins