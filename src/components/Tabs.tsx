import { Children, useState, useId } from "react";

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
	const baseId = useId();

	return (
		<div className="flex flex-col items-center gap-6">
			<div className="flex gap-4" role="tablist">
				{names.map((name, index) => {
					const tabId = `${baseId}-tab-${index}`;
					const panelId = `${baseId}-panel-${index}`;
					const isActive = activeTab === index;

					return (
						<button
							key={index}
							id={tabId}
							role="tab"
							aria-selected={isActive}
							aria-controls={panelId}
							className={`flex cursor-pointer flex-row items-center justify-center gap-2 rounded-lg ${
								isActive ? "bg-dark-primary-color" : ""
							} p-4 font-coolvetica text-light-color focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
							onClick={() => setActiveTab(index)}
						>
							{name}
						</button>
					);
				})}
			</div>
			<div
				id={`${baseId}-panel-${activeTab}`}
				role="tabpanel"
				aria-labelledby={`${baseId}-tab-${activeTab}`}
				tabIndex={0}
				className="w-full focus-visible:outline-none"
			>
				{tabContent[activeTab]}
			</div>
		</div>
	);
};

export default Tabs;
