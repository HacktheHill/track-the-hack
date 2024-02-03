import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslation } from "next-i18next";

type GeneratorProps = {
	type: "snowflake" | "cloud";
	count: number;
};

const Weather = ({ type, count }: GeneratorProps) => {
	const list = [];
	for (let i = 0; i < count; i++) {
		switch (type) {
			case "snowflake":
				list.push(<Snowflake key={i} />);
				break;
			case "cloud":
				list.push(<Cloud key={i} />);
				break;
		}
	}
	return <>{list}</>;
};

const Snowflake = () => {
	const { t } = useTranslation("index");

	const [x, setX] = useState(0);
	const [y, setY] = useState(0);
	const [size, setSize] = useState(0);
	const [duration, setDuration] = useState(0 + 50);
	const [delay, setDelay] = useState(0);

	useEffect(() => {
		setX(Math.random() * 100);
		setY(Math.random() * 100);
		setSize(Math.random() * 10 + 5);
		setDuration(Math.random() * 100 + 50);
		setDelay(-1 * Math.random() * 100 - 50);
	}, []);

	return (
		<Image
			src="/assets/star.svg"
			width={size}
			height={size}
			alt="Snowflake"
			className="absolute animate-snowflake-fall opacity-50"
			style={{
				top: `${y}%`,
				left: `${x}%`,
				animationDuration: `${duration}s`,
				animationDelay: `${delay}s`,
			}}
		/>
	);
};

const Cloud = () => {
	const { t } = useTranslation("index");

	const [x, setX] = useState(0);
	const [y, setY] = useState(0);
	const [size, setSize] = useState(0);
	const [duration, setDuration] = useState(0 + 50);
	const [number, setNumber] = useState(1);
	const [direction, setDirection] = useState(0);
	const [delay, setDelay] = useState(0);

	useEffect(() => {
		setX(Math.random() * 100);
		setY(Math.random() * 20);
		setSize(Math.random() * 100 + 50);
		setDuration(Math.random() * 50 + 50);
		setNumber(Math.floor(Math.random() * 3) + 1);
		setDirection(Math.random() > 0.5 ? 1 : -1);
		setDelay(-1 * Math.random() * 100 - 50);
	}, []);

	return (
		<Image
			src={`/assets/cloud${number}.svg`}
			width={size}
			height={size}
			alt="Cloud"
			className="absolute animate-cloud-drift opacity-75"
			style={{
				top: `${y}%`,
				left: `${x}%`,
				animationDuration: `${duration}s`,
				animationDirection: direction === 1 ? "alternate" : "alternate-reverse",
				animationDelay: `${delay}s`,
			}}
		/>
	);
};

export default Weather;
