import React from 'react'



const Search = () => {
  return (
		<div className="flex flex-col gap-3.5" id="bubble-table-select">
			<form onSubmit={handleSubmit}>   
				<label className="mb-2 text-sm font-medium text-gray-900 sr-only dark:text-white">Search</label>
				<div className="relative">
					<div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
						<svg aria-hidden="true" className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
					</div>
					<input type="search" id="default-search" className="block w-full p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg  bg-background1" placeholder="Search Hackers" required/>
					<button type="submit" className="text-white absolute right-2.5 bottom-2.5 bg-dark hover:bg-medium focus:ring-4 focus:outline-none font-medium rounded-lg text-sm px-4 py-2">Search</button>
				</div>
			</form>
			<div className="flex flex-wrap gap-3.5">
			</div>
		</div>
  )
}   

const handleSubmit	 = (event: React.FormEvent<HTMLFormElement>) => {
	event.preventDefault();
	const searchInput = document.getElementById("default-search") as HTMLInputElement;
	localStorage.setItem("search", searchInput.value);
  }

  


export default Search  

// dark: "#3b4779",
// 			medium: "#3f4e77",
// 			light: "#5c71ad",
// 			background1: "#BFCFF6",
// 			background2: "#90A1D4",
// 			background3: "#B2CEED",
// 			accent1: "#E9D9F2",
// 			accent2: "#ABEFFB",