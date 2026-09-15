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
			<div className="flex flex-wrap gap-2" role="tablist">
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
							className="ui-button"
							type="button"
							tabIndex={isActive ? 0 : -1}
							onKeyDown={event => {
								let next = index;
								if (event.key === "ArrowRight") next = (index + 1) % names.length;
								else if (event.key === "ArrowLeft") next = (index - 1 + names.length) % names.length;
								else if (event.key === "Home") next = 0;
								else if (event.key === "End") next = names.length - 1;
								else return;
								event.preventDefault();
								setActiveTab(next);
								document.getElementById(`${baseId}-tab-${next}`)?.focus();
							}}
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
				className="w-full"
			>
				{tabContent[activeTab]}
			</div>
		</div>
	);
};

export default Tabs;
