import { Children, useState } from "react";

/**
 *
 * Tab component
 * @param props.names - Array of tab names
 * @param props.children - Each tab's content should be in its own container
 *
 * @example
 * <Tabs names={["Tab 1", "Tab 2"]}>
 *     <div>Tab 1 content</div>
 *    <div>Tab 2 content</div>
 * </Tabs>
 */
const Tabs = (props: { names: string[]; children: React.ReactNode }) => {
	const { names, children } = props;
	const [activeTab, setActiveTab] = useState(0);
	const tabContent = Children.toArray(children);

	return (
		<div className="flex flex-col items-center gap-6">
			<div className="flex gap-4">
				{names.map((name, index) => (
					<button
						key={index}
						className={`flex cursor-pointer flex-row items-center justify-center gap-2 rounded-lg ${
							activeTab == index ? "bg-dark-primary-color" : ""
						} p-4 font-coolvetica text-light-color`}
						onClick={() => setActiveTab(index)}
					>
						{name}
					</button>
				))}
			</div>
			{tabContent[activeTab]}
		</div>
	);
};

export default Tabs;
