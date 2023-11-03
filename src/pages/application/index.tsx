import App from "../../components/App";
import type { NextPage } from "next";
import Dropdown from "../../components/Dropdown";
import { trpc } from "../../utils/api";

const Home: NextPage = () => {
	const mutation = trpc.hackers.walkIn.useMutation();


	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		const formData = new FormData(event.currentTarget);
		const data = Object.fromEntries(formData) as Record<string, string | number | undefined>;
		console.log(data);
		event.preventDefault();
		
	}

	return (
		<App className="relative flex flex-col items-center justify-center gap-2 overflow-auto bg-gradient1 px-8 py-6 sm:gap-8 short:px-16 short:py-12">
			<div className="h-full w-full font-coolvetica">
				<form onSubmit={handleSubmit} className="flex w-full flex-col items-center justify-center gap-4">
					<div className="flex w-full flex-wrap items-center justify-center border-white bg-dark rounded-lg border-2 p-4 text-white">
						<h2 className="text-xl">Language</h2>
						<div className="flex w-full flex-row items-center justify-center ">
							<label htmlFor="language" className="inline-block text-lg ">
								{"What is your preferred language?"}
								<select name="preferredLanguage" id="language" className=" text-dark border-2 rounded-lg inline h-[3rem] m-4 ">
									<option value="English">English</option>
									<option value="French">French</option>
								</select>
							</label>
						</div>
					</div>

					{/* page 2 */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center  bg-dark text-white border-2 rounded-lg  p-4">
						<h2 className="text-lg text-white">Basic Information</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="email" className="inline-block w-full ">
									* E-mail
									<input id="email" type="text" required className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)] ">
								<label htmlFor="firstName" className="inline-block w-full">
									* First Name
									<input id="firstName" type="text" required className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]  ">
								<label htmlFor="lastName" className="inline-block w-full ">
									* Last Name
									<input id="lastName" type="text" required className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="phoneNumber" className="inline-block w-full ">
									* Phone Number
									<input id="phoneNumber" type="text" required className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[10rem]">
								<label htmlFor="age" className="inline-block w-full ">
									* Age
									<input id="age" type="number" required className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(100%-10rem-2rem)]">
								<Dropdown
									name="* Pronouns"
									options={[
										"She/Her",
										"He/Him",
										"They/Them",
										"She/They",
										"He/They",
										"Prefer Not to Answer",
										"Other",
									]}
									required
								></Dropdown>
							</div>
						</div>
					</div>
					
					{/* page 4 */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center border-white border-2 rounded-lg bg-dark text-white p-4">
						<h2 className="text-l text-white text-xl">Experience</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-[calc(50%-1rem)]">
								<Dropdown
								name="Current level of study"
								options={["High School","Undergraduate","Graduate","Post Graduate", "Other"]}>
								</Dropdown>
							</div>
							<div className="w-[calc(50%-1rem)]  ">
								<label htmlFor="school" className="inline-block  w-full ">
									School
									<input id="school" type="text" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]">
								<Dropdown
									name="Program"
									options={[
										"Computer science",
										"Computer engineering",
										"Software engineering",
										"Electrical engineering",
										"Another Engineering discipline",
										"Information technology",
										"System administration",
										"Mathematics",
										"Statistics",
										"Business discipline",
										"Humanities discipline",
										"Social science",
										"Fine arts",
										"Health science",
										"Other",
									]}
								></Dropdown>
							</div>
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="graduationYear" className="inline-block w-full ">
									Expected Graduation Year
									<input id="graduationYear" type="number" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="numberOfHackathonsAttended" className="inline-block w-full ">
									How many hackathons have you attended?
									<input id="numberOfHackathonsAttended" type="number" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
						</div>
					</div>
					
					{/* page 5 */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center  text-white bg-dark border-white border-2 rounded-lg p-4">
						<h2 className="text-lg">Logistics</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="modality" className="inline-block w-full ">
									Do you plan on attending in-person or online?
									<select name="modality" id="modality" className="block w-full p-2 bg-white text-dark">
										<option value="IN_PERSON">In Person</option>
										<option value="ONLINE">Online</option>
									</select>
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]  ">
								<label htmlFor="transport" className="inline-block w-full ">
									Will you require transportation to and from Ottawa?
									<input id="transport" type="text" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]">
									<Dropdown
										name="diet"
										question="Do you have any dietary restrictions?"
										options={[
											"No",
											"Vegetarian",
											"Dairy Free",
											"Gluten Free",
											"Halal",
											"Nut Allergy",
											"Other",
										]}
									></Dropdown>
							</div>
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="tShirtSize" className="inline-block w-full ">
									What is your T-shirt size?
									<select defaultValue={"M"} id="tShirtSize" className="block w-full p-2 bg-white text-dark">
										<option value="XS">XS</option>
										<option value="S">S</option>
										<option value="M">
											M
										</option>
										<option value="L">L</option>
										<option value="XL">XL</option>
										<option value="XXL">XXL</option>
									</select>
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="accessibilityNeeds" className="inline-block w-full ">
									Do you have access needs you would like us to know?
									<input
										id="accessibilityNeeds"
										type="textarea"
										className="block w-full p-2 bg-white text-dark"
										placeholder="Enter your access needs here..."
									/>
								</label>
							</div>
						</div>
					</div>

					{/* page 3 */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center border-white border-2 rounded-lg bg-dark text-white p-4">
						<h2 className="text-l text-white text-xl">Safety</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
						<p>For safety purposes, we require an emergency contact for all in-person attendees.</p>
						<label htmlFor="lastName" className="inline-block w-full ">
								{`* What is your emergency contact's full name?`}
								<input id="emergencyContactName" type="text" required className="block w-full p-2 bg-white text-dark" />
						</label>
						<label htmlFor="lastName" className="inline-block w-full ">
								{`* What is your relationship with your emergency contact?`}
								<input id="emergencyContactName" type="text" required className="block w-full p-2 bg-white text-dark" />
						</label>
						<label htmlFor="lastName" className="inline-block w-full ">
								{`* What is your emergency contact’s phone number?`}
								<input id="emergencyContactName" type="text" required className="block w-full p-2 bg-white text-dark" />
						</label>
						</div>
					</div>
					{/* page 6  */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center  bg-dark text-white border-2 border-white rounded-lg p-4">
						<h2 className="text-lg">Application Question</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-full">
								<label htmlFor="firstName" className="inline-block w-full">
									What are you looking forward to most at Hack the Hill?
									<textarea id="firstName" rows={4} className=" p-2 w-full bg-white text-dark flex-wrap flex" placeholder="Write your answer here..."></textarea>
								</label>
							</div>
						</div>
					</div>
					{/* page 7  */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center  bg-dark text-white border-2 border-white rounded-lg p-4">
						<h2 className="text-lg">Socials</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-full">
								<label htmlFor="linkedin" className="inline-block w-full ">
									Linkedin
									<input id="linkedin" type="text" className="block w-full p-2 bg-white text-dark" placeholder="https://www.linkedin.com/in/bea.var"/>
								</label>
							</div>
							<div className="w-full">
								<label htmlFor="github" className="inline-block w-full ">
									Github
									<input id="github" type="text" className="block w-full p-2 bg-white text-dark" placeholder="https://github.com/bea.var"/>
								</label>
							</div>
							<div className="w-full">
								<label htmlFor="personalWebsite" className="inline-block w-full ">
									Personal Website
									<input id="personalWebsite" type="text" className="block w-full p-2 bg-white text-dark" placeholder="www.beavar.com" />
								</label>
							</div>
						</div>
					</div>
					<div className="flex w-full flex-col flex-wrap items-center justify-center  bg-dark text-white border-2 border-white rounded-lg p-4">
						<label htmlFor="myfile">Upload your resume!</label>
						<input className="flex items-center justify-center" type="file" id="myfile" name="myfile"/>
					</div>
					{/* footer  */}
					<div className="item-start flex w-full flex-col flex-wrap justify-center  p-4">
						<h2 className="text-lg">Terms and Conditions</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-full flex gap-4">
								<label htmlFor="mlhCodeOfConduct">
									I agree to the{" "}
									<a className="underline" href="https://static.mlh.io/docs/mlh-code-of-conduct.pdf">
										MLH code of conduct
									</a>{" "}
									and{" "}
									<a className="underline" href="https://mlh.io/privacy">
										Privacy Policy
									</a>
								</label>
								<input type="checkbox" id="mlhCodeOfConduct" />
							</div>
							<div className="flex w-full gap-4">
								<label htmlFor="mlhCodeOfConduct">
									I agree to the{" "}
									<a
										className="underline"
										href="https://docs.google.com/document/d/1bZIyTa1sFSjJjORoWjIvnifSgixX1oDVYjyecDCH_tQ/edit"
									>
										Hack the Hill code of conduct
									</a>
								</label>
								<input type="checkbox" id="mlhCodeOfConduct" />
							</div>
							<button type="submit" className="rounded-lg bg-dark text-white border-2 border-white p-4">Submit</button>
						</div>
					</div>
					<div className="rounded-4 fixed flex items-center justify-center gap-5 rounded-lg bg-black p-4 text-white">
						You have made changes. Would you like to save your changes?
						<button className="self-center rounded-lg bg-green-500 p-5">Save</button>
					</div>
				</form>
			</div>
		</App>
	);
};

export default Home;
