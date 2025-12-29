import ReactDOM from "react-dom/client";
import "./styles/globals.css";
import { Widget } from "./components/widget";
import { TauriQueryProvider } from "./lib/tauri-query";

// Render the widget
const widgetRoot = document.getElementById("widget-root") as HTMLElement;
if (widgetRoot && !widgetRoot.innerHTML) {
	const root = ReactDOM.createRoot(widgetRoot);
	root.render(
		<TauriQueryProvider>
			<div className="group relative flex h-full w-full items-end justify-center">
				<Widget />
			</div>
		</TauriQueryProvider>,
	);
}
