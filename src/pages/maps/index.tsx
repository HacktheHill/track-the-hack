import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import App from "../../components/App";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "maps"]),
	};
};

const Maps = () => {
	const { t } = useTranslation("maps");

	const mapsLink = (floor: number) => `https://cdn1.hackthehill.com/crx/floorplan/${floor}.png`;
	const MAX_FLOORS = 6;

	return (
		<App
			className="flex h-0 flex-col items-center bg-gradient-to-b from-background2 to-background1"
			title={t("title")}
		>
			<div className="w-full justify-center overflow-y-auto mobile:px-0">
				{
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					[...Array(MAX_FLOORS)].map((e, i) => (
						<>
							<h1 className="py-3 text-center text-xl text-dark">Floor {i}</h1>

							<TransformWrapper>
								<div className="mx-auto block">
									<TransformComponent
										wrapperStyle={{ display: "block", marginLeft: "auto", marginRight: "auto" }}
									>
										<Image width={800} height={400} src={mapsLink(i)} alt={`Floor ${i}`} />
									</TransformComponent>
								</div>
							</TransformWrapper>
						</>
					))
				}
			</div>
		</App>
	);
};

export default Maps;
