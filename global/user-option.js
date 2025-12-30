export function encodeOptionName(name) {
    return [...name].map(ch => ch.codePointAt(0).toString(16).padStart(4, '0')).join('');
}
export function decodeOptionName(encoded) {
    return encoded.match(/.{4}/g).map(code => String.fromCodePoint(parseInt(code, 16))).join('');
}