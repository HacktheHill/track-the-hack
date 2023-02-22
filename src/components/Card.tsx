import React from 'react'
import type { HackerInfo } from '@prisma/client'
import Link from "next/link";
import Hacker from '../pages/hackers/hacker';
type CardProps = Pick<HackerInfo, "university" | "firstName" | "lastName" | "studyProgram" | "id">

const Card = ({firstName, lastName, university, studyProgram, id}:CardProps) => {
  // dark: "#3b4779",
	// 			medium: "#3f4e77",
	// 			light: "#5c71ad",
	// 			background1: "#BFCFF6",
	// 			background2: "#90A1D4",
	// 			background3: "#B2CEED",
	// 			accent1: "#E9D9F2",
	// 			accent2: "#ABEFFB",
  
  return (

    <Link href={`/hackers?id=${id}`}className="block w-full p-6 bg-dark border border-gray-200 rounded-lg shadow hover:bg-medium  border-gray-700">
			<h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{`${firstName} ${lastName}`}</h5>
			<p className="font-normal text-gray-700 dark:text-gray-400">{university}</p>
      <p className="font-normal text-gray-700 dark:text-gray-400">{studyProgram}</p>
    </Link>
  )
}

export default Card