function truncate(str, len) {
    return str.length > len ? `${str.substring(0, len - 3).trimEnd()}...` : str;
}

module.exports = { truncate };