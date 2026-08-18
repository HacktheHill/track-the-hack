import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { useState } from "react";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import App from "../../components/App";
//import React, { useState } from "react";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "maps"]),
	};
};

const MapFloor = ({ floor }: { floor: number }) => {
	const { t } = useTranslation("maps");
	const [zoom, setZoom] = useState(1);



	return (

		<TransformWrapper
			initialScale={1}
			minScale={1}
			maxScale={3}
			limitToBounds={false}>
			{({ setTransform }) => {

				const updateZoom = (value: number) => {
					setZoom(value);
					setTransform(0, 0, value, 150);
				};

				return (
					<div className="mx-auto block">
						<div className="mb-3 flex items-center justify-center gap-3">
							<span className="text-sm text-dark-color">Zoom</span>
							<input
								type="range"
								min={1}
								max={3}
								step={0.1}
								value={zoom}
								onChange={e => updateZoom(Number(e.target.value))}
								className="w-48"
							/>
							<button onClick={() => updateZoom(1)}>Reset</button>
							<span className="text-sm text-dark-color">{zoom.toFixed(1)}x</span>
						</div>

						<TransformComponent
							wrapperStyle={{
								display: "block",
								marginLeft: "auto",
								marginRight: "auto",
							}}
						>
							<Image
								width={800}
								height={400}
								//Image Location
								src={`/assets/maps/floor${floor}.svg`}
								alt={t("floor", { floor })}
							/>
						</TransformComponent>
					</div>
				);
			}}
		</TransformWrapper>
	);
};
const Maps = () => {
	const { t } = useTranslation("maps");
	const MAX_FLOORS = 6;

	return (
		<App className="flex h-0 flex-col items-center bg-default-gradient" title={t("title")}>
			<div className="w-full justify-center overflow-y-auto p-5">
				{[...Array(MAX_FLOORS).keys()].map(i => (
					<div key={i}>
						<h1 className="py-3 text-center text-xl text-dark-color">
							{t("floor", { floor: i })}
						</h1>

						<MapFloor floor={i} />
					</div>
				))}
			</div>
		</App>
	);
};

export default Maps;
