import App from "../../components/App";
import type { NextPage } from "next";
import Dropdown from "../../components/Dropdown";
const Home: NextPage = () => {
	return (
		<App className="relative flex flex-col items-center justify-center gap-2 overflow-auto bg-gradient1 px-8 py-6 sm:gap-8 short:px-16 short:py-12">
			<div className="h-full w-full font-coolvetica">
				<form className="flex w-full flex-col items-center justify-center gap-4">
					<div className="flex w-full flex-wrap items-center justify-center border-white bg-dark rounded-lg border-2 p-4 text-white">
						<h2 className="text-xl">Language</h2>
						<div className="flex w-full flex-row items-center justify-center ">
							<label htmlFor="language" className="inline-block text-lg ">
								{"What is your preferred language?"}
								<select name="language dropdown" id="language" className=" text-dark border-2 rounded-lg inline h-[3rem] m-4 ">
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
							<div className="w-[calc(50%-1rem)] ">
								<label htmlFor="firstName" className="inline-block w-full">
									First Name
									<input id="firstName" type="text" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]  ">
								<label htmlFor="lastName" className="inline-block w-full ">
									Last Name
									<input id="lastName" type="text" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="phoneNumber" className="inline-block w-full ">
									Phone Number
									<input id="phoneNumber" type="text" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="email" className="inline-block w-full ">
									E-mail
									<input id="email" type="text" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[10rem]">
								<label htmlFor="age" className="inline-block w-full ">
									Age
									<input id="age" type="number" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-[calc(100%-10rem-2rem)]">
								<Dropdown
									name="Program"
									options={[
										"She/Her",
										"He/Him",
										"They/Them",
										"She/They",
										"He/They",
										"Prefer Not to Answer",
										"Other",
									]}
								></Dropdown>
							</div>
						</div>
					</div>
					{/* page 3 */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center border-white border-2 rounded-lg bg-dark text-white p-4">
						<h2 className="text-l text-white text-xl">Experience</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="levelOfStudy" className="inline-block w-full ">
									Current level of study
									<input id="levelOfStudy" type="text" className="block w-full p-2 bg-white text-dark" />
								</label>
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
						</div>
					</div>

					{/* page 4 */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center  text-white bg-dark border-white border-2 rounded-lg p-4">
						<h2 className="text-lg">Logistics</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-[calc(50%-1rem)]">
								<label htmlFor="modality" className="inline-block w-full ">
									Do you plan on attending in-person or online?
									<input id="modality" type="text" className="block w-full p-2 bg-white text-dark" />
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
									<select id="tShirtSize" className="block w-full p-2 bg-white text-dark">
										<option value="XS">XS</option>
										<option value="S">S</option>
										<option value="M" selected>
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
									/>
								</label>
							</div>
						</div>
					</div>
					{/* page 5  */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center  bg-dark text-white border-2 border-white rounded-lg p-4">
						<h2 className="text-lg">Application Question</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-full">
								<label htmlFor="firstName" className="inline-block w-full">
									What are you looking forward to most at Hack the Hill?
									<input id="firstName" type="text" className=" p-2 w-full bg-white text-dark h-[15vh] flex-wrap flex" />
								</label>
							</div>
						</div>
					</div>
					{/* page 6  */}
					<div className="flex w-full flex-col flex-wrap items-center justify-center  bg-dark text-white border-2 border-white rounded-lg p-4">
						<h2 className="text-lg">Socials</h2>
						<div className="flex w-full flex-wrap items-end justify-start gap-2 p-4">
							<div className="w-full">
								<label htmlFor="linkedin" className="inline-block w-full ">
									Linkedin
									<input id="linkedin" type="text" className="block w-full p-2 bg-white text-dark" />
								</label>
							</div>
							<div className="w-full">
								<label htmlFor="github" className="inline-block w-full ">
									Github
									<input id="github" type="text" className="block w-full p-4 bg-white text-dark" />
								</label>
							</div>
							<div className="w-full">
								<label htmlFor="personalWebsite" className="inline-block w-full ">
									Personal Website
									<input id="personalWebsite" type="text" className="block w-full p-4 bg-white text-dark" />
								</label>
							</div>
						</div>
					</div>
					{/* page 6  */}
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
							<button className="rounded-lg bg-dark text-white border-2 border-white p-4">Submit</button>
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
