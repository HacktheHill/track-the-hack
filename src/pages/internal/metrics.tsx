import { RoleName } from "@prisma/client";
import { PieChart, Pie, BarChart, Bar, Cell, Tooltip, Legend, XAxis, YAxis, CartesianGrid } from 'recharts';
import { trpc } from "../../server/api/api";
import { useTranslation } from "next-i18next";


import App from "../../components/App";
import Filter from "../../components/Filter";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { rolesRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";


const MetricsDashboard: React.FC = () => {
  const { t } = useTranslation("internal");

  const { data } = trpc.metrics.getMetrics.useQuery();

  // Colors for charts
  const colors = ['#0088FE', '#00C49F', '#FFBB28', '#AF19FF', '#FF1919', '#19FFB1', '#FF19E0', '#19B3FF', '#FF19B3', '#19FF19', '#FFB319'];

  return (
    <App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("metrics")}>
    <Filter value={RoleName.ADMIN} method="above">

    <div className="flex flex-col items-center justify-center overflow-y-auto bg-default-gradient p-10">
    <h1 className="p-10 font-rubik text-4xl font-bold">{t("metrics")}</h1>

      <div className="flex flex-col items-center gap-6 w-full max-w-6xl bg-light-tertiary-color rounded-lg p-6 shadow-lg">
        <h2 className="font-rubik text-2xl font-bold mb-4">Overall Metrics</h2>
        <div className="grid grid-cols-2 gap-4">
          {data && (
            <>
              <p className="text-lg">Applied: <span className="font-semibold">{data.applied}</span></p>
              <p className="text-lg">Confirmed: <span className="font-semibold">{data.confirmed}</span></p>
              <p className="text-lg">Checked-In: <span className="font-semibold">{data.checkedIn}</span></p>
              <p className="text-lg">Walk-In: <span className="font-semibold">{data.walkIn}</span></p>
            </>
          )}

          {/* Attendance Data */}
          {data && (
            <div>
              <h3 className="font-rubik text-xl mb-4">Attendance</h3>
              <BarChart width={600} height={300} data={data.attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="_sum.value" name="Attendance">   
                  {data.genderData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}             
                </Bar>
              </BarChart>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-8 w-full mt-10">
          {/* Pie chart for Gender */}
          {data && (
            <div>
              <h3 className="font-rubik text-xl mb-4">Gender Distribution</h3>
              <PieChart width={400} height={400}>
                <Pie
                  data={data.genderData}
                  dataKey="_count.gender"
                  nameKey="gender"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  fill="#8884d8"
                >
                  {data.genderData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
          )}

          {/* Pie chart for Ethnicity */}
          {data && (
            <div>
              <h3 className="font-rubik text-xl mb-4">Ethnicity Distribution</h3>
              <PieChart width={400} height={400}>
                <Pie
                  data={data.ethnicityData}
                  dataKey="_count.raceEthnicity"
                  nameKey="raceEthnicity"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  fill="#8884d8"
                >
                  {data.ethnicityData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
          )}

          {/* Pie chart for Age */}
          {data && (
            <div>
              <h3 className="font-rubik text-xl mb-4">Age Distribution</h3>
              <PieChart width={400} height={400}>
                <Pie
                  data={data.ageData}
                  dataKey="_count.age"
                  nameKey="age"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  fill="#8884d8"
                >
                  {data.ageData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
          )}

          {/* New Pie chart for Location */}
          {data && (
            <div>
              <h3 className="font-rubik text-xl mb-4">Location Distribution</h3>
              <PieChart width={400} height={400}>
                <Pie
                  data={data.locationData}
                  dataKey="_count.travelOrigin"
                  nameKey="travelOrigin"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  fill="#8884d8"
                >
                  {data.locationData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
          )}

          {/* New Pie chart for Year of Study */}
          {data && (
            <div>
              <h3 className="font-rubik text-xl mb-4">Year of Study Distribution</h3>
              <PieChart width={400} height={400}>
                <Pie
                  data={data.yearData}
                  dataKey="_count.educationLevel"
                  nameKey="educationLevel"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  fill="#8884d8"
                >
                  {data.yearData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-8 w-full mt-10">
          {/* Bar chart for Referral Source */}
          {data && (
            <div>
              <h3 className="font-rubik text-xl mb-4">Referral Source</h3>
              <BarChart width={500} height={300} data={data.referralSourceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="referralSource" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="_count.referralSource" name="Referral Sources" >
                {data.referralSourceData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}    
                </Bar>
              </BarChart>
            </div>
          )}

          {/* Bar chart for Majors */}
          {data && (
            <div>
              <h3 className="font-rubik text-xl mb-4">Majors Distribution</h3>
              <BarChart width={500} height={300} data={data.majorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="major" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="_count.major" name="Major">
                {data.majorData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}    
                </Bar>
              </BarChart>
            </div>
          )}
        </div>
      </div>
    </div>
    </Filter>
  </App>
  );
};


export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await rolesRedirect(session, "/internal/metrics", [RoleName.ADMIN]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};
export default MetricsDashboard;