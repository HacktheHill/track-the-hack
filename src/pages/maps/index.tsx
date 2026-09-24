"use client";

import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { useState } from "react";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import App from "@/components/App";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "maps"]),
	};
};

const MapFloor = ({ floor }: { floor: number }) => {
	const { t } = useTranslation("maps");
	const [zoom, setZoom] = useState(1);
	const [showZoomHint, setShowZoomHint] = useState(false);

	return (
		<TransformWrapper
			initialScale={1}
			minScale={1}
			maxScale={3}
			limitToBounds={false}
			onTransformed={(_ref, state) => setZoom(state.scale)}
		>
			{({ setTransform }) => {
				const updateZoom = (value: number) => {
					setZoom(value);
					setTransform(0, 0, value, 150);
				};

				return (
					<div className="mx-auto block">
						<div className="mb-3 flex items-center justify-center gap-3">
							<label htmlFor={`zoom-floor-${floor}`} className="text-sm text-dark-color">
								{t("zoom")}
							</label>
							<input
								id={`zoom-floor-${floor}`}
								type="range"
								min={1}
								max={3}
								step={0.1}
								value={zoom}
								onChange={e => updateZoom(Number(e.target.value))}
								className="w-48"
							/>
							<button type="button" className="ui-button" onClick={() => updateZoom(1)}>
								{t("reset")}
							</button>
							<span aria-live="polite" className="text-sm text-dark-color">
								{zoom.toFixed(1)}x
							</span>
						</div>

						<div
							className="relative"
							onMouseEnter={() => setShowZoomHint(true)}
							onMouseLeave={() => setShowZoomHint(false)}
						>
							{showZoomHint && (
								<div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-xs text-white">
									{t("zoom-hint")}
								</div>
							)}

							<TransformComponent
								wrapperStyle={{
									display: "block",
									marginLeft: "auto",
									marginRight: "auto",
								}}
							>
								<Image
									width={800}
									height={floor === 4 ? 356 : 400}
									//Image Location
									src={
										floor === 4
											? "/assets/maps/floor4-current.svg"
											: `/assets/maps/floor${floor}.svg`
									}
									alt={t("floor", { floor })}
								/>
							</TransformComponent>
						</div>
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
				<h1 className="ui-page-title pb-3 text-center">{t("title")}</h1>
				{[...Array(MAX_FLOORS).keys()].map(i => (
					<section key={i} aria-labelledby={`floor-${i}-title`}>
						<h2 id={`floor-${i}-title`} className="py-3 text-center text-xl text-dark-color">
							{t("floor", { floor: i })}
						</h2>

						<MapFloor floor={i} />
					</section>
				))}
			</div>
		</App>
	);
};

export default Maps;
