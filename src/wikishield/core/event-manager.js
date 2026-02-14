import { events } from '../config/events.js';
import { conditions } from '../config/conditions.js';
import { sortDependencies } from '../utilities/scripts.js';

export class EventManager {
	constructor(ws) {
		this.ws = ws;

		this.events = events;
		this.conditions = conditions;
	}

	button($el, event) {
		const ws = this.ws;

		const handleClick = e => {
			ws.gui.selectedMenu = null;

			const item = ws.queue.current.item;

			const params = { };
			for (const param of (ws.gui.events.events[event].parameters?.(ws, item) || []))
				if (param.id === "external")
					params[param.id] = e?.altKey || false;

			ws.execute({
				actions: [
					{
						name: event,
						params: params
					}
				]
			});
		};

		$el.addEventListener("click", e => handleClick(e));
	}
	submenu($el, name) {
		const event = this.events[name];
		$el.dataset.eventName = name;

		const current = this.ws.queue.current;
		const id = `${current.type}:${current.item?.id}`;
		const cachedParams = { };
		if ($el.dataset.eventId === id)
			for (const param of event.parameters?.(this.ws, this.ws.queue.current.item) || []) {
				const $input = $el.querySelector(`[data-paramid="${param.id}"]`);
				cachedParams[param.id] = $input.value;
			}
		else
			$el.dataset.eventId = id;

		$el.innerHTML = "";

		const $description = document.createElement("div");
		$description.classList.add("bottom-subcontent-title");
		$description.textContent = event.title;
		$el.appendChild($description);

		const dependencyMap = new Map();

		const actions = { };
		const parameters = sortDependencies(event.parameters?.(this.ws, this.ws.queue.current.item) || []);
		for (const param of parameters) {
			const $param = document.createElement("div");
			$param.classList.add("bottom-subcontent-input-title");
			$param.textContent = param.title;
			$el.appendChild($param);

			const dependencies = { };
			for (const dependent of param.dependencies ?? [])
				dependencies[dependent] = actions[dependent];

			const _default = typeof param.default === "function" ? param.default(dependencies) : param.default;

			let callback = null;
			switch (param.type) {
				case "choice": {
					const $select = document.createElement("select");
					$select.dataset.paramid = param.id;
					$el.appendChild($select);

					const options = typeof param.options === "function" ? param.options(dependencies) : param.options;
					for (const option of options ?? []) {
						const $option = document.createElement("option");
						$option.value = option;
						$option.textContent = option;
						$select.appendChild($option);
					}

					if (cachedParams[param.id] !== undefined) {
						$select.value = cachedParams[param.id];
						actions[param.id] = cachedParams[param.id];
					} else if ("default" in param) {
						$select.value = _default;
						actions[param.id] = _default;
					}

					callback = () => {
						const dependencies = { };
						for (const dependent of param.dependencies ?? [])
							dependencies[dependent] = actions[dependent];

						const value = $select.value;

						const options = typeof param.options === "function" ? param.options(dependencies) : param.options;
						$select.innerHTML = "";
						for (const option of options ?? []) {
							const $option = document.createElement("option");
							$option.value = option;
							$option.textContent = option;
							$select.appendChild($option);
						}

						if (options.includes(value))
							$select.value = value;
						else {
							const _default = typeof param.default === "function" ? param.default(dependencies) : param.default;
							$select.value = _default;
							actions[param.id] = _default;
						}
					};

					$select.addEventListener("change", () => {
						actions[param.id] = $select.value;
						for (const cb of dependencyMap.get(param.id) || [])
							cb();
					});
				} break;
				case "text": {
					const $input = document.createElement("input");
					$input.type = "text";
					$input.dataset.paramid = param.id;
					$el.appendChild($input);

					if (cachedParams[param.id] !== undefined) {
						$input.value = cachedParams[param.id];
						actions[param.id] = cachedParams[param.id];
					} else if ("default" in param) {
						$input.value = _default;
						actions[param.id] = _default;
					}

					$input.addEventListener("change", () => {
						actions[param.id] = $input.value;
						for (const cb of dependencyMap.get(param.id) || [])
							cb();
					});
				} break;
				case "boolean": {
					const $input = document.createElement("input");
					$input.type = "checkbox";
					$input.dataset.paramid = param.id;
					$el.appendChild($input);

					if (cachedParams[param.id] !== undefined) {
						$input.checked = cachedParams[param.id];
						actions[param.id] = cachedParams[param.id];
					} else if ("default" in param) {
						$input.checked = _default;
						actions[param.id] = _default;
					}

					$input.addEventListener("change", () => {
						actions[param.id] = $input.checked;
						for (const cb of dependencyMap.get(param.id) || [])
							cb();
					});
				} break;
				case "duration": {
					const $input = document.createElement("duration-input");
					$input.dataset.paramid = param.id;
					$el.appendChild($input);

					if (cachedParams[param.id] !== undefined) {
						$input.value = cachedParams[param.id];
						actions[param.id] = cachedParams[param.id];
					} else if ("default" in param) {
						$input.value = _default;
						actions[param.id] = _default;
					}

					$input.addEventListener("change", () => {
						actions[param.id] = $input.value;
						for (const cb of dependencyMap.get(param.id) || [])
							cb();
					});
				} break;
			}

			if (typeof callback === "function")
				for (const dependent of param.dependencies ?? []) {
					if (!dependencyMap.has(dependent))
						dependencyMap.set(dependent, [ ]);
					dependencyMap.get(dependent).push(callback);
				}
		}

		const $button = document.createElement("button");
		$button.classList.add("bottom-subcontent-button");
		$button.textContent = "Submit";
		$el.appendChild($button);

		$button.addEventListener("click", () => {
			const params = { };
			for (const param of parameters) {
				const $input = $el.querySelector(`[data-paramid="${param.id}"]`);
				params[param.id] = $input.value;
			}
			this.ws.execute({
				actions: [
					{
						name,
						params
					}
				]
			});
			this.ws.gui.closeMenus();
		});
	}
}