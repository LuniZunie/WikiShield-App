function CreateDOMElement(tag, options = { }) {
    const $el = document.createElement(tag);

    if ("id" in options)
        $el.id = options.id;
    if ("class" in options)
        $el.className = options.class;
    if ("text" in options)
        $el.textContent = options.text;
    if ("html" in options)
        $el.innerHTML = options.html;
    if ("content" in options)
        $el.append(options.content);
    if ("value" in options)
        $el.value = options.value;

    if ("attributes" in options)
        for (const [ key, value ] of Object.entries(options.attributes || { }))
            $el.setAttribute(key, value);

    if ("dataset" in options)
        for (const [ key, value ] of Object.entries(options.dataset || { }))
            $el.dataset[key] = value;

    if ("style" in options)
        for (const [ key, value ] of Object.entries(options.style || { }))
            $el.style.setProperty(key, value);

    return $el;
}

export { CreateDOMElement };