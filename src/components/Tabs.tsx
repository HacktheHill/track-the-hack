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
			<div className="flex gap-4" role="tablist">
				{names.map((name, index) => (
					<button
						key={index}
						role="tab"
						id={`tab-${index}`}
						aria-selected={activeTab === index}
						aria-controls={activeTab === index ? `tabpanel-${index}` : undefined}
						className={`flex cursor-pointer flex-row items-center justify-center gap-2 rounded-lg ${
							activeTab == index ? "bg-dark-primary-color" : ""
						} p-4 font-coolvetica text-light-color focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-primary-color focus-visible:ring-offset-2`}
						onClick={() => setActiveTab(index)}
					>
						{name}
					</button>
				))}
			</div>
			<div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
				{tabContent[activeTab]}
			</div>
		</div>
	);
};

export default Tabs;
