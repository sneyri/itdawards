export function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        if (value == null || value === false) continue;
        if (name.startsWith('on')) node.addEventListener(name.slice(2).toLowerCase(), value);
        else node.setAttribute(name, value === true ? '' : String(value));
    }
    node.append(...children.flat(Infinity).filter(child => child != null && child !== false));
    return node;
}
